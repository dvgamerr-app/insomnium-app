//! AWS SigV4 header signing with user-supplied credentials (no credential discovery).
use aws_credential_types::Credentials;
use aws_sigv4::{
    http_request::{
        sign, PayloadChecksumKind, PercentEncodingMode, SignableBody, SignableRequest,
        SigningSettings, UriPathNormalizationMode,
    },
    sign::v4,
};
use reqwest::{header, Request};
use serde::Deserialize;
use std::time::SystemTime;

#[derive(Deserialize)]
#[serde(default, rename_all = "camelCase")]
#[derive(Default)]
pub struct AwsCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: String,
    pub region: String,
    pub service: String,
}

pub(crate) struct Signer<'a> {
    credentials: &'a AwsCredentials,
    region: String,
    service: String,
    host: header::HeaderValue,
}

// Match the legacy aws4 endpoint inference, including SES and reversed ES/AOSS.
fn infer(host: &str) -> (String, String) {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    let prefix = host
        .strip_suffix(".amazonaws.com.cn")
        .or_else(|| host.strip_suffix(".amazonaws.com"));
    let Some(prefix) = prefix else {
        return (String::new(), "us-east-1".into());
    };
    let parts: Vec<_> = prefix.split('.').collect();
    let (mut service, mut region) = if parts.len() > 1 {
        (parts[parts.len() - 2], parts[parts.len() - 1])
    } else {
        (parts[0], "")
    };
    if matches!(region, "es" | "aoss") {
        std::mem::swap(&mut service, &mut region);
    }
    if region == "s3" {
        service = "s3";
        region = "us-east-1";
    } else if let Some(value) = service
        .strip_prefix("s3-")
        .or_else(|| region.strip_prefix("s3-"))
    {
        service = "s3";
        region = value;
    }
    if service == "email" {
        service = "ses";
    }
    (
        service.into(),
        if region.is_empty() {
            "us-east-1"
        } else {
            region
        }
        .into(),
    )
}

/// These generated fields are replaced at signing time and removed on every redirect.
pub(crate) fn clear_headers(request: &mut Request) {
    for name in [
        "authorization",
        "x-amz-date",
        "x-amz-security-token",
        "x-amz-content-sha256",
    ] {
        request.headers_mut().remove(name);
    }
}

impl<'a> Signer<'a> {
    pub(crate) fn new(credentials: &'a AwsCredentials, request: &Request) -> Result<Self, String> {
        if !matches!(request.url().scheme(), "http" | "https") {
            return Err("AWS signing requires an HTTP or HTTPS URL.".into());
        }
        for (name, value) in [
            ("access key ID", &credentials.access_key_id),
            ("secret access key", &credentials.secret_access_key),
            ("session token", &credentials.session_token),
        ] {
            if value.len() > 64 * 1024 || value.chars().any(char::is_control) {
                return Err(format!(
                    "AWS {name} contains control characters or exceeds 64 KiB."
                ));
            }
        }
        if credentials.access_key_id.is_empty() || credentials.secret_access_key.is_empty() {
            return Err("AWS access key ID and secret access key are required.".into());
        }
        if credentials.access_key_id.contains(['/', ',', ' ']) {
            return Err("AWS access key ID contains invalid characters.".into());
        }
        if !request.url().username().is_empty() || request.url().password().is_some() {
            return Err("AWS signing does not support credentials in the URL.".into());
        }
        if request.headers().get_all(header::HOST).iter().count() > 1 {
            return Err("AWS signing requires a single Host header.".into());
        }
        let host = match request.headers().get(header::HOST) {
            Some(value) => value.clone(),
            None => header::HeaderValue::from_str(
                request
                    .url()
                    .as_str()
                    .split("://")
                    .nth(1)
                    .and_then(|rest| rest.split('/').next())
                    .ok_or("Invalid AWS request URL.")?,
            )
            .map_err(|_| "Invalid AWS request host.")?,
        };
        let host_text = host
            .to_str()
            .map_err(|_| "AWS Host must contain ASCII characters.")?;
        if host_text.is_empty() || host_text.contains(['/', '@', '?', '#', ' ', '\\']) {
            return Err("AWS Host must be a hostname with an optional port.".into());
        }
        let host_url = reqwest::Url::parse(&format!("http://{host_text}/"))
            .map_err(|_| "Invalid AWS Host header.")?;
        let (inferred_service, inferred_region) = infer(host_url.host_str().unwrap_or(""));
        let mut service = if credentials.service.is_empty() {
            inferred_service
        } else {
            credentials.service.clone()
        };
        if service == "email" {
            service = "ses".into();
        }
        let region = if credentials.region.is_empty() {
            inferred_region
        } else {
            credentials.region.clone()
        };
        for (name, value) in [("service", &service), ("region", &region)] {
            if value.is_empty()
                || value.len() > 128
                || !value
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-')
            {
                return Err(format!("Set a valid AWS {name} explicitly in Auth; it could not be inferred from Host."));
            }
        }
        if service == "codecommit" && request.method().as_str() == "GIT" {
            return Err("AWS CodeCommit GIT signing has not been migrated yet.".into());
        }
        Ok(Self {
            credentials,
            region,
            service,
            host,
        })
    }

    pub(crate) fn sign(&self, request: &mut Request) -> Result<(), String> {
        if request.url().query_pairs().any(|(name, _)| {
            matches!(
                name.to_ascii_lowercase().as_str(),
                "x-amz-signature"
                    | "x-amz-algorithm"
                    | "x-amz-credential"
                    | "x-amz-security-token"
                    | "x-amz-date"
            )
        }) {
            return Err("Remove AWS signing parameters from the URL or disable AWS IAM to send a presigned URL.".into());
        }
        clear_headers(request);
        request
            .headers_mut()
            .insert(header::HOST, self.host.clone());
        let identity = Credentials::new(
            self.credentials.access_key_id.clone(),
            self.credentials.secret_access_key.clone(),
            (!self.credentials.session_token.is_empty())
                .then(|| self.credentials.session_token.clone()),
            None,
            "Insomnium request",
        )
        .into();
        let mut settings = SigningSettings::default();
        // These can be added/rewritten by reqwest, the WebSocket upgrade or a proxy.
        settings.excluded_headers.get_or_insert_default().extend(
            [
                "connection",
                "content-length",
                "expect",
                "te",
                "trailer",
                "upgrade",
                "proxy-authorization",
                "proxy-authenticate",
                "keep-alive",
                "accept-encoding",
                "sec-websocket-key",
                "sec-websocket-version",
                "sec-websocket-extensions",
                "sec-websocket-protocol",
                "cookie",
            ]
            .map(Into::into),
        );
        if self.service == "s3" {
            settings.percent_encoding_mode = PercentEncodingMode::Single;
            settings.uri_path_normalization_mode = UriPathNormalizationMode::Disabled;
            settings.payload_checksum_kind = PayloadChecksumKind::XAmzSha256;
        }
        let params = v4::SigningParams::builder()
            .identity(&identity)
            .region(&self.region)
            .name(&self.service)
            .time(SystemTime::now())
            .settings(settings)
            .build()
            .map_err(|_| "Could not prepare AWS signing parameters.")?
            .into();
        let headers = request
            .headers()
            .iter()
            .map(|(name, value)| {
                value
                    .to_str()
                    .map(|value| (name.as_str(), value))
                    .map_err(|_| "AWS signed headers must contain ASCII characters.")
            })
            .collect::<Result<Vec<_>, _>>()?;
        let body = request
            .body()
            .and_then(|body| body.as_bytes())
            .unwrap_or(&[]);
        let signable = SignableRequest::new(
            request.method().as_str(),
            request.url().as_str(),
            headers.into_iter(),
            SignableBody::Bytes(body),
        )
        .map_err(|_| "Could not canonicalize AWS request.")?;
        let (instructions, _) = sign(signable, &params)
            .map_err(|_| "Could not sign AWS request.")?
            .into_parts();
        for value in instructions.into_parts().0 {
            let mut header = header::HeaderValue::from_str(value.value())
                .map_err(|_| "Invalid AWS signing header.")?;
            header.set_sensitive(value.sensitive());
            request.headers_mut().insert(value.name(), header);
        }
        Ok(())
    }
}
