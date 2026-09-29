//! Fragment token parsing for an API client, not an OpenID identity verifier.
use crate::oauth::{OAuthConfig, OAuthToken};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use oauth2::CsrfToken;
use serde::Deserialize;
use std::{
    collections::HashMap,
    time::{SystemTime, UNIX_EPOCH},
};

pub struct Implicit {
    pub response_type: &'static str,
    pub nonce: Option<CsrfToken>,
    use_identity: bool,
}

impl Implicit {
    pub fn new(config: &OAuthConfig) -> Result<Self, String> {
        let response_type = match config.response_type.as_str() {
            "" | "token" => "token",
            "id_token" => "id_token",
            "id_token token" | "token id_token" => "id_token token",
            "none" => "none",
            _ => return Err("Choose token, id_token, id_token token or none for Implicit; use Authorization Code for code responses.".into()),
        };
        if response_type == "id_token" && !config.use_identity_token {
            return Err("ID-token-only responses require explicitly selecting Use ID token as API credential.".into());
        }
        if config.use_identity_token && !response_type.contains("id_token") {
            return Err(
                "Use ID token as API credential requires an id_token response type.".into(),
            );
        }
        Ok(Self {
            response_type,
            nonce: response_type
                .contains("id_token")
                .then(CsrfToken::new_random),
            use_identity: config.use_identity_token,
        })
    }

    pub fn token(&self, params: &HashMap<String, String>) -> Result<Option<OAuthToken>, String> {
        if params.contains_key("code") {
            return Err("Unexpected authorization code in Implicit callback.".into());
        }
        if self.response_type == "none" {
            if [
                "access_token",
                "id_token",
                "refresh_token",
                "token_type",
                "expires_in",
            ]
            .iter()
            .any(|key| params.contains_key(*key))
            {
                return Err("Response type none must not return tokens.".into());
            }
            return Ok(None);
        }
        let access = params.get("access_token");
        let identity = params.get("id_token");
        let needs_access = self.response_type.split(' ').any(|value| value == "token");
        if needs_access != access.is_some() || self.nonce.is_some() != identity.is_some() {
            return Err("Implicit callback does not match the requested token types.".into());
        }
        if let Some(access) = access {
            header_token(access)?;
            if !params
                .get("token_type")
                .is_some_and(|value| value.eq_ignore_ascii_case("bearer"))
            {
                return Err("Implicit access tokens require token_type=Bearer.".into());
            }
        }
        if let (Some(identity), Some(nonce)) = (identity, &self.nonce) {
            header_token(identity)?;
            let parts: Vec<_> = identity.split('.').collect();
            if parts.len() != 3 || parts.iter().any(|part| part.is_empty()) {
                return Err("Expected a compact signed ID token for nonce checking.".into());
            }
            URL_SAFE_NO_PAD
                .decode(parts[2])
                .map_err(|_| "Invalid ID token signature encoding.")?;
            #[derive(Deserialize)]
            struct Header {
                alg: String,
            }
            #[derive(Deserialize)]
            struct Claims {
                nonce: String,
            }
            let header: Header = serde_json::from_slice(
                &URL_SAFE_NO_PAD
                    .decode(parts[0])
                    .map_err(|_| "Invalid ID token encoding.")?,
            )
            .map_err(|_| "Invalid ID token header.")?;
            let claims: Claims = serde_json::from_slice(
                &URL_SAFE_NO_PAD
                    .decode(parts[1])
                    .map_err(|_| "Invalid ID token encoding.")?,
            )
            .map_err(|_| "ID token must contain one nonce claim.")?;
            if header.alg.is_empty()
                || header.alg.eq_ignore_ascii_case("none")
                || CsrfToken::new(claims.nonce) != *nonce
            {
                return Err("ID token nonce or signing format was not accepted.".into());
            }
            // Deliberately no claim of JWT signature/issuer/audience verification:
            // this token is collected as API input, never used to authenticate the app user.
        }
        let obtained_at = u64::try_from(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| "Invalid system clock.")?
                .as_millis(),
        )
        .map_err(|_| "Invalid system clock.")?;
        let expires_at = params
            .get("expires_in")
            .map(|value| {
                if value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
                    return Err("Invalid OAuth expiry.");
                }
                value
                    .parse::<u64>()
                    .ok()
                    .and_then(|v| v.checked_mul(1000))
                    .and_then(|v| obtained_at.checked_add(v))
                    .filter(|v| *v <= 8_640_000_000_000_000)
                    .ok_or("OAuth expiry is out of range.")
            })
            .transpose()?;
        let selected = if self.use_identity { identity } else { access }
            .ok_or("No API credential in OAuth response.")?;
        Ok(Some(OAuthToken {
            access_token: selected.clone(),
            credential_kind: if self.use_identity {
                "id_token"
            } else {
                "access_token"
            }
            .into(),
            refresh_token: params.get("refresh_token").cloned(),
            identity_token: identity.cloned(),
            token_type: "Bearer".into(),
            scope: params.get("scope").cloned(),
            expires_at,
            obtained_at,
            warnings: if self.use_identity {
                vec!["Using the ID token as an API credential by explicit selection. Its signature and identity claims are not verified.".into()]
            } else {
                Vec::new()
            },
        }))
    }
}

fn header_token(value: &str) -> Result<(), String> {
    if value.is_empty() || value.bytes().any(|b| !b.is_ascii_graphic()) {
        return Err("OAuth token is empty or has invalid header characters.".into());
    }
    Ok(())
}
