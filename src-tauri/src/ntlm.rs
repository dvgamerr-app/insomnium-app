//! Per-operation NTLMv2 using SSPI and a connection-bound reqwest handshake.
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{header, Response};
use serde::Deserialize;
use sha2::{Digest, Sha224, Sha256, Sha384, Sha512};
use sspi::ntlm::NtlmConfig;
use sspi::{
    AuthIdentity, AuthIdentityBuffers, BufferType, ClientRequestFlags, CredentialUse,
    DataRepresentation, Ntlm, SecurityBuffer, SecurityStatus, Sspi, SspiImpl, Username,
};
use std::{
    future::Future,
    pin::Pin,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    task::{Context, Poll},
};
use tower::{Layer, Service};

type BoxError = Box<dyn std::error::Error + Send + Sync>;

#[derive(Clone, Default)]
pub(crate) struct ConnectionGuard {
    pinned: Arc<AtomicBool>,
    installed: Arc<AtomicBool>,
    rejected: Arc<AtomicBool>,
}
impl ConnectionGuard {
    pub(crate) fn installed(&self) {
        self.installed.store(true, Ordering::SeqCst);
    }
    pub(crate) fn release(&self) {
        self.pinned.store(false, Ordering::SeqCst);
        self.rejected.store(false, Ordering::SeqCst);
    }
    pub(crate) fn rejected(&self) -> bool {
        self.rejected.load(Ordering::SeqCst)
    }
    fn pin(&self) {
        self.pinned.store(true, Ordering::SeqCst);
    }
}
impl<S> Layer<S> for ConnectionGuard {
    type Service = GuardedConnector<S>;
    fn layer(&self, inner: S) -> Self::Service {
        GuardedConnector {
            inner,
            guard: self.clone(),
        }
    }
}
#[derive(Clone)]
pub(crate) struct GuardedConnector<S> {
    inner: S,
    guard: ConnectionGuard,
}
impl<S, R> Service<R> for GuardedConnector<S>
where
    S: Service<R, Error = BoxError>,
    S::Future: Send + 'static,
    S::Response: 'static,
{
    type Response = S::Response;
    type Error = BoxError;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, BoxError>> + Send>>;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), BoxError>> {
        self.inner.poll_ready(cx)
    }
    fn call(&mut self, request: R) -> Self::Future {
        // Checked before calling the underlying connector: Type 3 must never
        // be transmitted on a replacement connection, even after a pool retry.
        if self.guard.pinned.load(Ordering::SeqCst) {
            self.guard.rejected.store(true, Ordering::SeqCst);
            return Box::pin(async {
                Err(std::io::Error::other("NTLM connection closed during authentication; send again to start a new handshake").into())
            });
        }
        Box::pin(self.inner.call(request))
    }
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NtlmCredentials {
    pub username: String,
    pub password: String,
    pub domain: String,
    pub workstation: String,
    #[serde(skip)]
    pub(crate) connection: ConnectionGuard,
}

pub(crate) struct Session {
    ntlm: Ntlm,
    credentials: Option<AuthIdentityBuffers>,
}
impl Session {
    pub(crate) fn new(c: &NtlmCredentials) -> Result<Self, String> {
        if !c.connection.installed.load(Ordering::SeqCst) {
            return Err("NTLM requires its dedicated native connection guard.".into());
        }
        if c.username.is_empty() {
            return Err(
                "NTLM requires an explicit username; automatic OS sign-in is not used.".into(),
            );
        }
        if [&c.username, &c.password, &c.domain, &c.workstation]
            .iter()
            .any(|v| v.len() > 16 * 1024 || v.contains('\0'))
        {
            return Err("NTLM fields must be at most 16 KiB and contain no NUL.".into());
        }
        let username = if c.domain.is_empty() {
            Username::parse(&c.username)
        } else {
            Username::new(&c.username, Some(&c.domain))
        }
        .map_err(|_| {
            "Invalid NTLM username/domain. Use DOMAIN\\user, user@domain, or a separate domain."
        })?;
        let identity = AuthIdentity {
            username,
            password: c.password.clone().into(),
        };
        let mut ntlm = Ntlm::with_config(NtlmConfig {
            client_computer_name: (!c.workstation.is_empty()).then(|| c.workstation.clone()),
        });
        let credentials = ntlm
            .acquire_credentials_handle()
            .with_credential_use(CredentialUse::Outbound)
            .with_auth_data(&identity)
            .execute(&mut ntlm)
            .map_err(|_| "Could not initialize explicit NTLM credentials.")?
            .credentials_handle;
        Ok(Self { ntlm, credentials })
    }
    pub(crate) fn negotiate(&mut self) -> Result<header::HeaderValue, String> {
        self.step(None)
    }
    pub(crate) fn authenticate(
        &mut self,
        token: Vec<u8>,
        response: &Response,
        guard: &ConnectionGuard,
    ) -> Result<header::HeaderValue, String> {
        guard.pin();
        if response.url().scheme() == "https" {
            let der = response
                .extensions()
                .get::<reqwest::tls::TlsInfo>()
                .and_then(|v| v.peer_certificate())
                .ok_or("NTLM TLS channel binding requires the peer certificate.")?;
            self.ntlm.set_channel_bindings(&certificate_binding(der)?);
        }
        self.step(Some(token))
    }
    fn step(&mut self, token: Option<Vec<u8>>) -> Result<header::HeaderValue, String> {
        let mut output = vec![SecurityBuffer::new(Vec::new(), BufferType::Token)];
        let second = token.is_some();
        let mut input = vec![SecurityBuffer::new(
            token.unwrap_or_default(),
            BufferType::Token,
        )];
        let mut builder = self
            .ntlm
            .initialize_security_context()
            .with_credentials_handle(&mut self.credentials)
            .with_context_requirements(ClientRequestFlags::ALLOCATE_MEMORY)
            .with_target_data_representation(DataRepresentation::Native)
            .with_output(&mut output);
        if second {
            builder = builder.with_input(&mut input);
        }
        let result = self
            .ntlm
            .initialize_security_context_impl(&mut builder)
            .and_then(|mut g| g.resolve_to_result())
            .map_err(|_| "Invalid or unsupported NTLM challenge.")?;
        if matches!(
            result.status,
            SecurityStatus::CompleteAndContinue | SecurityStatus::CompleteNeeded
        ) {
            self.ntlm
                .complete_auth_token(&mut output)
                .map_err(|_| "Could not complete NTLM token.")?;
        }
        if output[0].buffer.is_empty() || output[0].buffer.len() > 64 * 1024 {
            return Err("Invalid NTLM output token size.".into());
        }
        let mut value =
            header::HeaderValue::from_str(&format!("NTLM {}", STANDARD.encode(&output[0].buffer)))
                .map_err(|_| "Invalid NTLM Authorization header.")?;
        value.set_sensitive(true);
        Ok(value)
    }
}

// RFC5929: hash the complete DER certificate with its signature hash; upgrade
// MD5/SHA1 to SHA256. Parse PSS parameters instead of assuming SHA256.
pub(crate) fn certificate_binding(der: &[u8]) -> Result<Vec<u8>, String> {
    use x509_parser::{parse_x509_certificate, signature_algorithm::SignatureAlgorithm};
    let (remaining, cert) =
        parse_x509_certificate(der).map_err(|_| "Invalid NTLM TLS certificate.")?;
    if !remaining.is_empty() {
        return Err("Invalid trailing TLS certificate data.".into());
    }
    let signature = &cert.signature_algorithm;
    let mut oid = signature.algorithm.to_id_string();
    if oid == "1.2.840.113549.1.1.10" {
        let SignatureAlgorithm::RSASSA_PSS(params) = SignatureAlgorithm::try_from(signature)
            .map_err(|_| "Invalid TLS RSA-PSS parameters.")?
        else {
            return Err("Invalid TLS RSA-PSS signature.".into());
        };
        oid = params.hash_algorithm_oid().to_id_string();
    }
    let hash = match oid.as_str() {
        "1.2.840.113549.1.1.4"
        | "1.2.840.113549.1.1.5"
        | "1.2.840.10045.4.1"
        | "1.2.840.10040.4.3"
        | "1.3.14.3.2.26"
        | "1.2.840.113549.1.1.11"
        | "1.2.840.10045.4.3.2"
        | "2.16.840.1.101.3.4.3.2"
        | "2.16.840.1.101.3.4.2.1" => Sha256::digest(der).to_vec(),
        "1.2.840.113549.1.1.14"
        | "1.2.840.10045.4.3.1"
        | "2.16.840.1.101.3.4.3.1"
        | "2.16.840.1.101.3.4.2.4" => Sha224::digest(der).to_vec(),
        "1.2.840.113549.1.1.12"
        | "1.2.840.10045.4.3.3"
        | "2.16.840.1.101.3.4.3.3"
        | "2.16.840.1.101.3.4.2.2" => Sha384::digest(der).to_vec(),
        "1.2.840.113549.1.1.13"
        | "1.2.840.10045.4.3.4"
        | "2.16.840.1.101.3.4.3.4"
        | "2.16.840.1.101.3.4.2.3" => Sha512::digest(der).to_vec(),
        _ => return Err("Unsupported certificate signature hash for NTLM channel binding.".into()),
    };
    let mut binding = b"tls-server-end-point:".to_vec();
    binding.extend(hash);
    Ok(binding)
}

// Split challenge lists outside quoted values. NTLM uses token68, which the
// Digest parameter parser does not expose. Never confuse Negotiate with NTLM.
pub(crate) fn challenge(response: &Response) -> Result<Option<Vec<u8>>, String> {
    let mut bare = false;
    let mut found = None;
    for value in response.headers().get_all(header::WWW_AUTHENTICATE) {
        let value = value
            .to_str()
            .map_err(|_| "Invalid authentication challenge text.")?;
        if value.len() > 96 * 1024 {
            return Err("NTLM challenge exceeds 96 KiB.".into());
        }
        let (mut quoted, mut escaped, mut start) = (false, false, 0);
        let mut parts = Vec::new();
        for (i, ch) in value.char_indices() {
            if escaped {
                escaped = false;
                continue;
            }
            if quoted && ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == '"' {
                quoted = !quoted;
            }
            if ch == ',' && !quoted {
                parts.push(&value[start..i]);
                start = i + 1;
            }
        }
        parts.push(&value[start..]);
        for part in parts {
            let part = part.trim();
            let end = part.find(char::is_whitespace).unwrap_or(part.len());
            if !part[..end].eq_ignore_ascii_case("ntlm") {
                continue;
            }
            let encoded = part[end..].trim();
            if encoded.is_empty() {
                bare = true;
                continue;
            }
            if found.is_some() {
                return Err("Ambiguous NTLM challenges.".into());
            }
            let token = STANDARD
                .decode(encoded)
                .map_err(|_| "Invalid NTLM challenge base64.")?;
            if token.len() < 32
                || token.len() > 64 * 1024
                || &token[..8] != b"NTLMSSP\0"
                || token[8..12] != [2, 0, 0, 0]
            {
                return Err("Invalid NTLM Type 2 challenge.".into());
            }
            found = Some(token);
        }
    }
    if found.is_none() && !bare {
        return Err("The server returned no NTLM challenge.".into());
    }
    Ok(found)
}

pub(crate) async fn drain(mut response: Response) -> Result<(), String> {
    let mut size = 0;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Could not drain NTLM handshake response.")?
    {
        size += chunk.len();
        if size > 1024 * 1024 {
            return Err("NTLM handshake response exceeds 1 MiB.".into());
        }
    }
    Ok(())
}
