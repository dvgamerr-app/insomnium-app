//! OAuth token endpoint exchanges. Interactive authorization is a separate lifecycle.
use oauth2::{
    basic::{
        BasicErrorResponse, BasicRevocationErrorResponse, BasicTokenIntrospectionResponse,
        BasicTokenType,
    },
    AuthType, AuthorizationCode, Client, ClientId, ClientSecret, ExtraTokenFields,
    PkceCodeVerifier, RedirectUrl, RefreshToken, RequestTokenError, ResourceOwnerPassword,
    ResourceOwnerUsername, Scope, StandardRevocableToken, StandardTokenResponse, TokenResponse,
    TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::{
    future::Future,
    io,
    pin::Pin,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthConfig {
    pub grant_type: String,
    pub client_id: String,
    pub client_secret: String,
    pub credentials_in_body: bool,
    pub username: String,
    pub password: String,
    pub scope: String,
    pub audience: String,
    pub resource: String,
    pub origin: String,
    pub refresh_token: String,
    #[serde(default)]
    pub authorization_url: String,
    #[serde(default)]
    pub redirect_url: String,
    #[serde(default)]
    pub state: String,
    #[serde(default = "default_pkce")]
    pub use_pkce: bool,
    #[serde(default)]
    pub pkce_method: String,
    #[serde(default)]
    pub response_type: String,
    #[serde(default)]
    pub callback_mode: String,
    #[serde(default)]
    pub issuer: String,
    #[serde(default)]
    pub use_identity_token: bool,
    #[serde(default)]
    pub browser_mode: String,
    #[serde(default)]
    pub browser_session: String,
}
fn default_pkce() -> bool {
    true
}

pub struct CodeGrant {
    pub code: AuthorizationCode,
    pub redirect: RedirectUrl,
    pub verifier: Option<PkceCodeVerifier>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct ExtraFields {
    id_token: Option<String>,
}
impl ExtraTokenFields for ExtraFields {}
type Token = StandardTokenResponse<ExtraFields, BasicTokenType>;
type OAuthClient = Client<
    BasicErrorResponse,
    Token,
    BasicTokenIntrospectionResponse,
    StandardRevocableToken,
    BasicRevocationErrorResponse,
>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthToken {
    pub access_token: String,
    pub credential_kind: String,
    pub refresh_token: Option<String>,
    pub identity_token: Option<String>,
    pub token_type: String,
    pub scope: Option<String>,
    pub expires_at: Option<u64>,
    pub obtained_at: u64,
    pub warnings: Vec<String>,
}

struct TokenHttp {
    client: reqwest::Client,
    origin: Option<reqwest::header::HeaderValue>,
}
impl<'c> oauth2::AsyncHttpClient<'c> for TokenHttp {
    type Error = io::Error;
    type Future =
        Pin<Box<dyn Future<Output = Result<oauth2::HttpResponse, Self::Error>> + Send + 'c>>;
    fn call(&'c self, outgoing: oauth2::HttpRequest) -> Self::Future {
        Box::pin(async move {
            let mut outgoing: reqwest::Request = outgoing
                .try_into()
                .map_err(|_| io::Error::other("Invalid OAuth request."))?;
            if let Some(value) = &self.origin {
                outgoing
                    .headers_mut()
                    .insert(reqwest::header::ORIGIN, value.clone());
            }
            let mut response = self.client.execute(outgoing).await.map_err(|e| {
                io::Error::other(if e.is_timeout() {
                    "OAuth token request timed out."
                } else {
                    "OAuth token connection failed. Check endpoint, proxy and TLS settings."
                })
            })?;
            if response.status().is_redirection() {
                return Err(io::Error::other(
                    "Token endpoint redirects are not followed. Set its final URL explicitly.",
                ));
            }
            let mut result = oauth2::http::Response::builder().status(response.status());
            for (name, value) in response.headers() {
                result = result.header(name, value);
            }
            let mut body = Vec::new();
            while let Some(chunk) = response
                .chunk()
                .await
                .map_err(|_| io::Error::other("Could not read OAuth token response."))?
            {
                if body.len() + chunk.len() > 1024 * 1024 {
                    return Err(io::Error::other("OAuth token response exceeds 1 MiB."));
                }
                body.extend_from_slice(&chunk);
            }
            result
                .body(body)
                .map_err(|_| io::Error::other("Invalid OAuth response headers."))
        })
    }
}

/// The supplied client must have redirects disabled. No response body or credentials enter errors.
pub async fn exchange(
    client: &reqwest::Client,
    url: &reqwest::Url,
    config: &OAuthConfig,
) -> Result<OAuthToken, String> {
    exchange_grant(client, url, config, None).await
}

pub async fn exchange_code(
    client: &reqwest::Client,
    url: &reqwest::Url,
    config: &OAuthConfig,
    grant: CodeGrant,
) -> Result<OAuthToken, String> {
    exchange_grant(client, url, config, Some(grant)).await
}

async fn exchange_grant(
    client: &reqwest::Client,
    url: &reqwest::Url,
    config: &OAuthConfig,
    code: Option<CodeGrant>,
) -> Result<OAuthToken, String> {
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("Use an HTTP(S) token URL without user information or a fragment.".into());
    }
    if config.client_id.is_empty() {
        return Err("OAuth client ID is required.".into());
    }
    let mut oauth = OAuthClient::new(ClientId::new(config.client_id.clone()))
        .set_token_uri(TokenUrl::from_url(url.clone()))
        .set_auth_type(if config.credentials_in_body {
            AuthType::RequestBody
        } else {
            AuthType::BasicAuth
        });
    // A public body-auth client sends only client_id. An explicitly selected
    // Basic header still has an empty password when no secret was supplied.
    if !config.credentials_in_body || !config.client_secret.is_empty() {
        oauth = oauth.set_client_secret(ClientSecret::new(config.client_secret.clone()));
    }
    let origin = if config.origin.is_empty() {
        None
    } else {
        Some(
            reqwest::header::HeaderValue::from_str(&config.origin)
                .map_err(|_| "Invalid OAuth Origin header.")?,
        )
    };
    let http = TokenHttp {
        client: client.clone(),
        origin,
    };
    let scopes = || {
        config
            .scope
            .split_ascii_whitespace()
            .map(|s| Scope::new(s.into()))
    };
    let extras: Vec<(&str, &str)> = [
        ("audience", config.audience.as_str()),
        ("resource", config.resource.as_str()),
    ]
    .into_iter()
    .filter(|(_, value)| !value.is_empty())
    .collect();
    let result = match config.grant_type.as_str() {
        "authorization_code" => {
            let grant =
                code.ok_or("Start authorization in the browser before exchanging a code.")?;
            let oauth = oauth.set_redirect_uri(grant.redirect);
            let mut request = oauth.exchange_code(grant.code);
            if let Some(verifier) = grant.verifier {
                request = request.set_pkce_verifier(verifier);
            }
            // Preserve the legacy optional state form field only when configured by the user.
            if !config.state.is_empty() {
                request = request.add_extra_param("state", config.state.as_str());
            }
            for (key, value) in &extras {
                request = request.add_extra_param(*key, *value);
            }
            request.request_async(&http).await
        }
        "client_credentials" => {
            let mut request = oauth.exchange_client_credentials().add_scopes(scopes());
            for (key, value) in &extras {
                request = request.add_extra_param(*key, *value);
            }
            request.request_async(&http).await
        }
        "password" => {
            if config.username.is_empty() {
                return Err("OAuth username is required.".into());
            }
            let username = ResourceOwnerUsername::new(config.username.clone());
            let password = ResourceOwnerPassword::new(config.password.clone());
            let mut request = oauth
                .exchange_password(&username, &password)
                .add_scopes(scopes());
            for (key, value) in &extras {
                request = request.add_extra_param(*key, *value);
            }
            request.request_async(&http).await
        }
        "refresh_token" => {
            if config.refresh_token.is_empty() {
                return Err("No refresh token is available.".into());
            }
            let refresh = RefreshToken::new(config.refresh_token.clone());
            let mut request = oauth.exchange_refresh_token(&refresh).add_scopes(scopes());
            for (key, value) in &extras {
                request = request.add_extra_param(*key, *value);
            }
            request.request_async(&http).await
        }
        _ => return Err("This grant requires browser authorization or is unsupported.".into()),
    };
    let token = result.map_err(|error| match error {
        RequestTokenError::Request(error) => error.to_string(),
        RequestTokenError::ServerResponse(error) => {
            let code = error.error().as_ref();
            let code = match code { "invalid_request" | "invalid_client" | "invalid_grant" | "unauthorized_client" | "unsupported_grant_type" | "invalid_scope" => code, _ => "server_error" };
            format!("OAuth token endpoint rejected the request ({code}).")
        },
        _ => "OAuth endpoint must return a valid JSON token response with access_token and token_type, or a standard OAuth error.".into(),
    })?;
    if token.token_type() != &BasicTokenType::Bearer {
        return Err(
            "Only Bearer OAuth tokens are supported. The server returned another token type."
                .into(),
        );
    }
    let access_token = token.access_token().secret();
    if access_token.is_empty() || access_token.bytes().any(|b| !b.is_ascii_graphic()) {
        return Err(
            "The OAuth access token is empty or contains invalid header characters.".into(),
        );
    }
    let obtained_at = u64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "System clock is before the Unix epoch.")?
            .as_millis(),
    )
    .map_err(|_| "System clock is out of range.")?;
    let expires_at = token
        .expires_in()
        .map(|duration| {
            let milliseconds =
                u64::try_from(duration.as_millis()).map_err(|_| "OAuth expiry is out of range.")?;
            obtained_at
                .checked_add(milliseconds)
                .filter(|value| *value <= 8_640_000_000_000_000)
                .ok_or("OAuth expiry is out of range.")
        })
        .transpose()?;
    Ok(OAuthToken {
        access_token: access_token.clone(),
        credential_kind: "access_token".into(),
        refresh_token: token.refresh_token().map(|value| value.secret().clone()),
        identity_token: token.extra_fields().id_token.clone(),
        token_type: "Bearer".into(),
        scope: token.scopes().map(|values| {
            values
                .iter()
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(" ")
        }),
        expires_at,
        obtained_at,
        warnings: Vec::new(),
    })
}
