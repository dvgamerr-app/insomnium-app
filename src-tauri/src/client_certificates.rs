use base64::{engine::general_purpose::STANDARD, Engine};
use cbc::cipher::{block_padding::Pkcs7, BlockModeDecrypt, KeyIvInit};
use md5::{Digest, Md5};
use p12_keystore::KeyStore;
use rustls::{
    client::ResolvesClientCert,
    pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer},
    sign::{CertifiedKey, SigningKey},
    SignatureAlgorithm, SignatureScheme,
};
use serde::Deserialize;
use std::sync::Arc;
use std::{fs::File, io::Read};

const MAX_FILE: usize = 1024 * 1024;

struct Candidate {
    key: Arc<CertifiedKey>,
    issuers: Vec<Vec<u8>>,
}

struct WebSocketIdentities(Vec<Candidate>);

impl std::fmt::Debug for WebSocketIdentities {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WebSocketIdentities")
            .field("count", &self.0.len())
            .finish()
    }
}

impl ResolvesClientCert for WebSocketIdentities {
    fn resolve(&self, hints: &[&[u8]], schemes: &[SignatureScheme]) -> Option<Arc<CertifiedKey>> {
        for scheme in schemes {
            for candidate in &self.0 {
                if candidate.key.key.choose_scheme(&[*scheme]).is_some()
                    && (hints.is_empty()
                        || candidate
                            .issuers
                            .iter()
                            .any(|issuer| hints.contains(&issuer.as_slice())))
                {
                    return Some(candidate.key.clone());
                }
            }
        }
        None
    }
    fn has_certs(&self) -> bool {
        !self.0.is_empty()
    }
}

fn certificate_algorithm(chain: &[CertificateDer<'static>]) -> Result<SignatureAlgorithm, String> {
    let leaf = chain.first().ok_or("Client certificate chain is empty.")?;
    let (_, cert) = x509_parser::parse_x509_certificate(leaf.as_ref())
        .map_err(|_| "Invalid client certificate DER.")?;
    match cert
        .public_key()
        .algorithm
        .algorithm
        .to_id_string()
        .as_str()
    {
        "1.2.840.113549.1.1.1" | "1.2.840.113549.1.1.10" => Ok(SignatureAlgorithm::RSA),
        "1.2.840.10045.2.1" => Ok(SignatureAlgorithm::ECDSA),
        "1.3.101.112" => Ok(SignatureAlgorithm::ED25519),
        _ => Err("Unsupported WebSocket client certificate key algorithm.".into()),
    }
}

/// Legacy WSS supplies independent certificate/key arrays, matched by algorithm,
/// with later entries replacing earlier entries of that algorithm. PFX is loaded
/// after the PEM arrays. HTTP/SSE retain Curl's last populated field selection.
pub(crate) fn websocket_identity(
    sources: &[ClientCertificateSource],
    fallback: Option<&str>,
) -> Result<Option<reqwest::Identity>, String> {
    if sources.is_empty() {
        return fallback
            .filter(|pem| !pem.is_empty())
            .map(|pem| reqwest::Identity::from_pem(pem.as_bytes()).map_err(|e| e.to_string()))
            .transpose();
    }
    if sources.len() > 32 {
        return Err("More than 32 client certificates match this destination.".into());
    }
    let provider = rustls::crypto::ring::default_provider();
    let mut chains: Vec<(SignatureAlgorithm, Vec<CertificateDer<'static>>)> = Vec::new();
    let mut keys: Vec<Arc<dyn SigningKey>> = Vec::new();
    let mut add_chain = |value: &str| -> Result<(), String> {
        let chain = CertificateDer::pem_slice_iter(value.as_bytes())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| "Invalid WebSocket client certificate PEM.")?;
        let algorithm = certificate_algorithm(&chain)?;
        chains.retain(|(existing, _)| *existing != algorithm);
        chains.push((algorithm, chain));
        Ok(())
    };
    let add_key = |value: &str,
                   password: &str,
                   chains: &[(SignatureAlgorithm, Vec<CertificateDer<'static>>)],
                   keys: &mut Vec<Arc<dyn SigningKey>>|
     -> Result<(), String> {
        let pem = key_material(value, password)?;
        let der = PrivateKeyDer::from_pem_slice(pem.as_bytes())
            .map_err(|_| "Invalid WebSocket client private key PEM.")?;
        let key = provider
            .key_provider
            .load_private_key(der)
            .map_err(|_| "Unsupported WebSocket client private key.")?;
        if let Some((_, chain)) = chains
            .iter()
            .find(|(algorithm, _)| *algorithm == key.algorithm())
        {
            CertifiedKey::new(chain.clone(), key.clone())
                .keys_match()
                .map_err(|_| "WebSocket client certificate and private key do not match.")?;
        }
        keys.retain(|existing| existing.algorithm() != key.algorithm());
        keys.push(key);
        Ok(())
    };
    for source in sources {
        let password = source.passphrase.as_deref().unwrap_or("");
        if password.len() > 32768 {
            return Err("Client certificate passphrase exceeds 32 KiB.".into());
        }
        if let Some(path) = source.cert.as_deref().filter(|path| !path.is_empty()) {
            let value = String::from_utf8(read_file(path)?)
                .map_err(|_| "Client certificate PEM must be UTF-8.")?;
            add_chain(&certificate_chain(&value)?)?;
        }
    }
    drop(add_chain);
    // Node loads every certificate first, then checks each key immediately.
    // An earlier mismatched key must not be hidden by a later valid key.
    for source in sources {
        let password = source.passphrase.as_deref().unwrap_or("");
        if let Some(path) = source.cert.as_deref().filter(|path| !path.is_empty()) {
            let value = String::from_utf8(read_file(path)?)
                .map_err(|_| "Client certificate PEM must be UTF-8.")?;
            if source
                .key
                .as_deref()
                .filter(|path| !path.is_empty())
                .is_none()
                && value.contains("PRIVATE KEY-----")
            {
                add_key(&value, password, &chains, &mut keys)?;
            }
        }
        if let Some(path) = source.key.as_deref().filter(|path| !path.is_empty()) {
            let value = String::from_utf8(read_file(path)?)
                .map_err(|_| "Client private key PEM must be UTF-8.")?;
            add_key(&value, password, &chains, &mut keys)?;
        }
    }
    // Node's secure-context initialization adds PFX after its certificate/key arrays.
    for source in sources {
        if source.pfx.as_deref().is_some_and(|path| !path.is_empty()) {
            let pfx = ClientCertificateSource {
                cert: None,
                key: None,
                pfx: source.pfx.clone(),
                passphrase: source.passphrase.clone(),
            };
            if let Some(value) = load_identity(&[pfx], None)? {
                let chain = CertificateDer::pem_slice_iter(value.as_bytes())
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|_| "Invalid WebSocket client certificate PEM.")?;
                let algorithm = certificate_algorithm(&chain)?;
                chains.retain(|(existing, _)| *existing != algorithm);
                chains.push((algorithm, chain));
                add_key(&value, "", &chains, &mut keys)?;
            }
        }
    }
    let mut candidates = Vec::new();
    for key in keys {
        let chain = chains
            .iter()
            .find(|(algorithm, _)| *algorithm == key.algorithm())
            .map(|(_, chain)| chain.clone())
            .ok_or("WebSocket private key has no matching certificate algorithm.")?;
        let certified = CertifiedKey::new(chain, key);
        certified
            .keys_match()
            .map_err(|_| "WebSocket client certificate and private key do not match.")?;
        let mut issuers = Vec::new();
        for cert in &certified.cert {
            let (_, parsed) = x509_parser::parse_x509_certificate(cert.as_ref())
                .map_err(|_| "Invalid client certificate DER.")?;
            issuers.push(parsed.issuer().as_raw().to_vec());
        }
        candidates.push(Candidate {
            key: Arc::new(certified),
            issuers,
        });
    }
    if candidates.is_empty() {
        if !chains.is_empty() {
            return Err("WebSocket client certificate has no private key.".into());
        }
        return Ok(None);
    }
    Ok(Some(reqwest::Identity::from_rustls_resolver(Arc::new(
        WebSocketIdentities(candidates),
    ))))
}

#[derive(Clone, Deserialize)]
pub(crate) struct ClientCertificateSource {
    pub cert: Option<String>,
    pub key: Option<String>,
    pub pfx: Option<String>,
    pub passphrase: Option<String>,
}

fn read_file(path: &str) -> Result<Vec<u8>, String> {
    if path.is_empty() || path.len() > 32768 || path.contains('\0') {
        return Err("Invalid client certificate file path.".into());
    }
    let file = File::open(path).map_err(|_| "Cannot open client certificate file.")?;
    let metadata = file
        .metadata()
        .map_err(|_| "Cannot inspect client certificate file.")?;
    if !metadata.is_file() || metadata.len() > MAX_FILE as u64 {
        return Err("Client certificate files must be regular files of at most 1 MiB.".into());
    }
    let mut bytes = Vec::new();
    file.take((MAX_FILE + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read client certificate file.")?;
    if bytes.len() > MAX_FILE {
        return Err("Client certificate file exceeds 1 MiB.".into());
    }
    Ok(bytes)
}

fn pem(label: &str, bytes: &[u8]) -> String {
    let encoded = STANDARD.encode(bytes);
    let mut value = format!("-----BEGIN {label}-----\n");
    for line in encoded.as_bytes().chunks(64) {
        value.push_str(std::str::from_utf8(line).expect("Base64 is ASCII"));
        value.push('\n');
    }
    value.push_str(&format!("-----END {label}-----\n"));
    value
}

fn private_key(value: &str, password: &str) -> Result<String, String> {
    if value.contains("-----BEGIN ENCRYPTED PRIVATE KEY-----") {
        let (label, document) = pkcs8::SecretDocument::from_pem(value)
            .map_err(|_| "Invalid encrypted PKCS8 private key PEM.")?;
        if label != "ENCRYPTED PRIVATE KEY" {
            return Err("Expected an encrypted PKCS8 private key.".into());
        }
        let encrypted = pkcs8::EncryptedPrivateKeyInfoRef::try_from(document.as_bytes())
            .map_err(|_| "Invalid encrypted PKCS8 private key.")?;
        let parameters = encrypted
            .encryption_algorithm
            .pbes2()
            .ok_or("Unsupported private key encryption; use PKCS8 PBES2.")?;
        let bounded = match &parameters.kdf {
            pkcs8::pkcs5::pbes2::Kdf::Pbkdf2(params) => params.iteration_count <= 1_000_000,
            pkcs8::pkcs5::pbes2::Kdf::Scrypt(params) => {
                params.parallelization <= 16
                    && params
                        .cost_parameter
                        .checked_mul(u64::from(params.block_size))
                        .and_then(|n| n.checked_mul(128))
                        .is_some_and(|memory| memory <= 256 * 1024 * 1024)
            }
            _ => false,
        };
        if !bounded {
            return Err("Encrypted private key derivation exceeds supported limits.".into());
        }
        let decrypted = encrypted
            .decrypt(password)
            .map_err(|_| "Cannot decrypt client private key; check its password and format.")?;
        return Ok(pem("PRIVATE KEY", decrypted.as_bytes()));
    }
    if value.contains("Proc-Type: 4,ENCRYPTED") || value.contains("DEK-Info:") {
        return legacy_private_key(value, password);
    }
    Ok(value.to_owned())
}

/// OpenSSL traditional PEM uses EVP_BytesToKey with MD5/count=1 and the first
/// eight IV bytes as salt. CBC/padding are supplied by RustCrypto, not reimplemented.
fn legacy_private_key(value: &str, password: &str) -> Result<String, String> {
    let error = "Cannot decrypt traditional PEM private key; check its password and format.";
    let mut lines = value.lines();
    let label = lines
        .next()
        .and_then(|line| line.strip_prefix("-----BEGIN "))
        .and_then(|line| line.strip_suffix("-----"))
        .ok_or(error)?;
    if !matches!(label, "RSA PRIVATE KEY" | "EC PRIVATE KEY") {
        return Err(error.into());
    }
    if lines.next().map(str::trim) != Some("Proc-Type: 4,ENCRYPTED") {
        return Err(error.into());
    }
    let dek = lines
        .next()
        .and_then(|line| line.strip_prefix("DEK-Info:"))
        .and_then(|line| line.trim().split_once(','))
        .ok_or(error)?;
    let (key_len, iv_len) = match dek.0 {
        "AES-128-CBC" => (16, 16),
        "AES-192-CBC" => (24, 16),
        "AES-256-CBC" => (32, 16),
        "DES-EDE3-CBC" => (24, 8),
        "DES-CBC" => (8, 8),
        _ => return Err("Unsupported traditional PEM cipher.".into()),
    };
    if dek.1.len() != iv_len * 2 || !dek.1.is_ascii() {
        return Err(error.into());
    }
    let iv: Vec<u8> = (0..dek.1.len())
        .step_by(2)
        .map(|offset| u8::from_str_radix(&dek.1[offset..offset + 2], 16))
        .collect::<Result<_, _>>()
        .map_err(|_| error)?;
    if lines.next().map(str::trim) != Some("") {
        return Err(error.into());
    }
    let end = format!("-----END {label}-----");
    let mut encoded = String::new();
    let mut ended = false;
    for line in lines {
        if line.trim() == end {
            ended = true;
            break;
        }
        encoded.push_str(line.trim());
    }
    if !ended {
        return Err(error.into());
    }
    let mut encrypted = STANDARD.decode(encoded).map_err(|_| error)?;
    let mut key = Vec::new();
    let mut previous = Vec::new();
    while key.len() < key_len {
        let mut hash = Md5::new();
        hash.update(&previous);
        hash.update(password.as_bytes());
        hash.update(&iv[..8]);
        previous = hash.finalize().to_vec();
        key.extend_from_slice(&previous);
    }
    key.truncate(key_len);
    macro_rules! decrypt {
        ($cipher:ty) => {
            cbc::Decryptor::<$cipher>::new_from_slices(&key, &iv)
                .map_err(|_| error)?
                .decrypt_padded::<Pkcs7>(&mut encrypted)
                .map_err(|_| error)?
                .to_vec()
        };
    }
    let bytes = match dek.0 {
        "AES-128-CBC" => decrypt!(aes::Aes128),
        "AES-192-CBC" => decrypt!(aes::Aes192),
        "AES-256-CBC" => decrypt!(aes::Aes256),
        "DES-EDE3-CBC" => decrypt!(des::TdesEde3),
        "DES-CBC" => decrypt!(des::Des),
        _ => unreachable!(),
    };
    Ok(pem(label, &bytes))
}

fn certificate_chain(value: &str) -> Result<String, String> {
    let mut remaining = value;
    let mut output = String::new();
    while let Some(start) = remaining.find("-----BEGIN CERTIFICATE-----") {
        let suffix = &remaining[start..];
        let end = suffix
            .find("-----END CERTIFICATE-----")
            .map(|n| n + "-----END CERTIFICATE-----".len())
            .ok_or("Incomplete client certificate PEM.")?;
        output.push_str(&suffix[..end]);
        output.push('\n');
        remaining = &suffix[end..];
    }
    if output.is_empty() {
        return Err("Client certificate PEM contains no certificates.".into());
    }
    Ok(output)
}

fn key_material(value: &str, password: &str) -> Result<String, String> {
    for label in [
        "ENCRYPTED PRIVATE KEY",
        "RSA PRIVATE KEY",
        "EC PRIVATE KEY",
        "PRIVATE KEY",
    ] {
        let begin = format!("-----BEGIN {label}-----");
        if let Some(start) = value.find(&begin) {
            let finish = format!("-----END {label}-----");
            let end = value[start..]
                .find(&finish)
                .map(|n| start + n + finish.len())
                .ok_or("Incomplete client private key PEM.")?;
            return private_key(&value[start..end], password);
        }
    }
    Err("Client identity PEM contains no private key.".into())
}

/// Curl's legacy selection overwrites only populated fields, in resource order.
/// PFX overrides PEM when both are populated in the same resource.
pub(crate) fn load_identity(
    sources: &[ClientCertificateSource],
    fallback: Option<&str>,
) -> Result<Option<String>, String> {
    if sources.len() > 32 {
        return Err("More than 32 client certificates match this destination.".into());
    }
    if sources.is_empty() {
        return Ok(fallback.filter(|s| !s.is_empty()).map(str::to_owned));
    }
    let mut certificate = None;
    let mut key = None;
    let mut password = "";
    for source in sources {
        if let Some(path) = source.cert.as_deref().filter(|s| !s.is_empty()) {
            certificate = Some((path, false));
        }
        if let Some(path) = source.pfx.as_deref().filter(|s| !s.is_empty()) {
            certificate = Some((path, true));
        }
        if let Some(path) = source.key.as_deref().filter(|s| !s.is_empty()) {
            key = Some(path);
        }
        if let Some(value) = source.passphrase.as_deref().filter(|s| !s.is_empty()) {
            password = value;
        }
    }
    if password.len() > 32768 {
        return Err("Client certificate passphrase exceeds 32 KiB.".into());
    }
    let Some((path, pfx)) = certificate else {
        return if key.is_some() {
            Err("Client certificate has a private key but no certificate file.".into())
        } else {
            Ok(None)
        };
    };
    let bytes = read_file(path)?;
    let value = if pfx {
        let (key, certs) = KeyStore::first_tls_identity(&bytes, password)
            .map_err(|_| "Cannot decode PFX client certificate; check its password and format.")?;
        let provider = rustls::crypto::ring::default_provider();
        let signing_key = provider
            .key_provider
            .load_private_key(PrivateKeyDer::Pkcs8(key.as_der().to_vec().into()))
            .map_err(|_| "Unsupported PFX private key.")?;
        let leaf = certs
            .iter()
            .position(|cert| {
                CertifiedKey::new(
                    vec![CertificateDer::from(cert.as_der().to_vec())],
                    signing_key.clone(),
                )
                .keys_match()
                .is_ok()
            })
            .ok_or("First PFX private key has no matching certificate.")?;
        let mut output = String::new();
        output.push_str(&pem("CERTIFICATE", certs[leaf].as_der()));
        for (index, cert) in certs.iter().enumerate() {
            if index == leaf {
                continue;
            }
            output.push_str(&pem("CERTIFICATE", cert.as_der()));
        }
        output.push_str(&pem("PRIVATE KEY", key.as_der()));
        output
    } else {
        let certificate =
            String::from_utf8(bytes).map_err(|_| "Client certificate PEM must be UTF-8.")?;
        let mut output = certificate_chain(&certificate)?;
        let material = if let Some(path) = key {
            String::from_utf8(read_file(path)?)
                .map_err(|_| "Client private key PEM must be UTF-8.")?
        } else {
            certificate
        };
        output.push_str(&key_material(&material, password)?);
        output
    };
    if value.len() > 2 * MAX_FILE {
        return Err("Combined client identity exceeds 2 MiB.".into());
    }
    Ok(Some(value))
}
