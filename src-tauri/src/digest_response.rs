use digest_auth::{Algorithm, AlgorithmType, AuthContext, AuthorizationHeader, Qop};
use reqwest::{header::HeaderMap, ResponseVerifier, StatusCode};
use std::{
    collections::HashMap,
    error::Error,
    fmt,
    sync::{Arc, Mutex},
};

type BoxError = Box<dyn Error + Send + Sync>;

#[derive(Debug)]
struct ProofError(String);
impl fmt::Display for ProofError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Digest response authentication failed: {}", self.0)
    }
}
impl Error for ProofError {}

enum EntityHash {
    Md5(md5::Md5),
    Sha256(sha2::Sha256),
    Sha512(sha2::Sha512_256),
}
impl EntityHash {
    fn new(algorithm: Algorithm) -> Self {
        use md5::Digest as _;
        use sha2::Digest as _;
        match algorithm.algo {
            AlgorithmType::MD5 => Self::Md5(md5::Md5::new()),
            AlgorithmType::SHA2_256 => Self::Sha256(sha2::Sha256::new()),
            AlgorithmType::SHA2_512_256 => Self::Sha512(sha2::Sha512_256::new()),
        }
    }
    fn update(&mut self, bytes: &[u8]) {
        use md5::Digest as _;
        use sha2::Digest as _;
        match self {
            Self::Md5(hash) => hash.update(bytes),
            Self::Sha256(hash) => hash.update(bytes),
            Self::Sha512(hash) => hash.update(bytes),
        }
    }
    fn finish(self) -> String {
        use md5::Digest as _;
        use sha2::Digest as _;
        match self {
            Self::Md5(hash) => hash
                .finalize()
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect(),
            Self::Sha256(hash) => format!("{:x}", hash.finalize()),
            Self::Sha512(hash) => format!("{:x}", hash.finalize()),
        }
    }
}

struct State {
    headers_seen: bool,
    present: bool,
    advertised: bool,
    fields: HashMap<String, String>,
    bytes: usize,
    entity: Option<EntityHash>,
    failure: Option<String>,
    finished: bool,
}

pub(crate) struct Proof {
    algorithm: Algorithm,
    ha1: String,
    nonce: String,
    cnonce: Option<String>,
    nc: u32,
    qop: Option<Qop>,
    uri: String,
    head: bool,
    state: Mutex<State>,
}
impl fmt::Debug for Proof {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DigestResponseProof")
            .finish_non_exhaustive()
    }
}
impl Proof {
    pub(crate) fn new(answer: &AuthorizationHeader, context: &AuthContext<'_>, head: bool) -> Self {
        let algorithm = answer.algorithm;
        let mut ha1 = algorithm.hash_str(&format!(
            "{}:{}:{}",
            context.username, answer.realm, context.password
        ));
        if algorithm.sess {
            ha1 = algorithm.hash_str(&format!(
                "{ha1}:{}:{}",
                answer.nonce,
                answer.cnonce.as_deref().unwrap_or("")
            ));
        }
        Self {
            algorithm,
            ha1,
            nonce: answer.nonce.clone(),
            cnonce: answer.qop.and(answer.cnonce.clone()),
            nc: answer.nc,
            qop: answer.qop,
            uri: answer.uri.clone(),
            head,
            state: Mutex::new(State {
                headers_seen: false,
                present: false,
                advertised: false,
                fields: HashMap::new(),
                bytes: 0,
                failure: None,
                finished: false,
                entity: (answer.qop == Some(Qop::AUTH_INT)).then(|| EntityHash::new(algorithm)),
            }),
        }
    }
    fn apply(&self, action: impl FnOnce(&mut State) -> Result<(), String>) -> Result<(), BoxError> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| ProofError("verifier state unavailable".into()))?;
        if let Some(error) = &state.failure {
            return Err(Box::new(ProofError(error.clone())));
        }
        if let Err(error) = action(&mut state) {
            state.failure = Some(error.clone());
            return Err(Box::new(ProofError(error)));
        }
        Ok(())
    }
    pub(crate) fn check(&self) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|_| "Digest response verifier state unavailable")?;
        if !state.headers_seen {
            return Err("Digest response verifier did not receive response headers".into());
        }
        state
            .failure
            .as_ref()
            .map_or(Ok(()), |error| Err(ProofError(error.clone()).to_string()))
    }
    fn parameters(state: &mut State, headers: &HeaderMap) -> Result<(), String> {
        for value in headers.get_all("authentication-info") {
            state.present = true;
            state.bytes += value.as_bytes().len();
            if state.bytes > 8192 {
                return Err("Authentication-Info exceeds 8 KiB".into());
            }
            let text = std::str::from_utf8(value.as_bytes())
                .map_err(|_| "invalid Authentication-Info encoding")?;
            let prefixed = format!("Digest {text}");
            let mut parsed = http_auth::ChallengeParser::new(&prefixed);
            let item = parsed
                .next()
                .ok_or("empty Authentication-Info")?
                .map_err(|_| "malformed Authentication-Info")?;
            if item.params.is_empty() || parsed.next().is_some() {
                return Err("malformed Authentication-Info".into());
            }
            for (name, value) in &item.params {
                if state.fields.len() >= 32
                    || state
                        .fields
                        .insert(name.to_ascii_lowercase(), value.to_unescaped())
                        .is_some()
                {
                    return Err("duplicate or excessive Authentication-Info parameters".into());
                }
            }
        }
        Ok(())
    }
    fn verify(&self, state: &State, entity: Option<&str>, final_body: bool) -> Result<(), String> {
        let fields = &state.fields;
        if let Some(value) = fields.get("qop") {
            if self.qop.map(|qop| qop.to_string()).as_deref() != Some(value.as_str()) {
                return Err("qop does not match the signed request".into());
            }
        }
        if let Some(value) = fields.get("cnonce") {
            if self.cnonce.as_ref() != Some(value) {
                return Err("cnonce does not match the signed request".into());
            }
        }
        if let Some(value) = fields.get("nc") {
            if self.qop.is_none()
                || value.len() != 8
                || u32::from_str_radix(value, 16).ok() != Some(self.nc)
            {
                return Err("nonce count does not match the signed request".into());
            }
        }
        if (fields.contains_key("rspauth") || fields.contains_key("qop"))
            && self.qop.is_some()
            && (final_body || !state.advertised)
            && ["qop", "rspauth", "cnonce", "nc"]
                .iter()
                .any(|name| !fields.contains_key(*name))
        {
            return Err("missing Digest response proof parameters".into());
        }
        if final_body && state.advertised && !state.present {
            return Err("missing Authentication-Info trailer".into());
        }
        if let Some(actual) = fields.get("rspauth") {
            let a2 = if self.qop == Some(Qop::AUTH_INT) {
                let Some(entity) = entity else {
                    return Ok(());
                };
                format!(":{}:{entity}", self.uri)
            } else {
                format!(":{}", self.uri)
            };
            let ha2 = self.algorithm.hash_str(&a2);
            let expected = match self.qop {
                Some(qop) => self.algorithm.hash_str(&format!(
                    "{}:{}:{:08x}:{}:{qop}:{ha2}",
                    self.ha1,
                    self.nonce,
                    self.nc,
                    self.cnonce.as_deref().unwrap_or("")
                )),
                None => self
                    .algorithm
                    .hash_str(&format!("{}:{}:{ha2}", self.ha1, self.nonce)),
            };
            if actual.len() != expected.len()
                || actual
                    .bytes()
                    .zip(expected.bytes())
                    .fold(0, |different, (a, b)| {
                        different | (a.to_ascii_lowercase() ^ b)
                    })
                    != 0
            {
                return Err("invalid rspauth".into());
            }
        }
        Ok(())
    }
    fn complete(&self, state: &mut State) -> Result<(), String> {
        if state.finished {
            return Ok(());
        }
        let entity = state.entity.take().map(EntityHash::finish);
        self.verify(state, entity.as_deref(), true)?;
        state.finished = true;
        Ok(())
    }
}
impl ResponseVerifier for Proof {
    fn headers(&self, status: StatusCode, headers: &HeaderMap) -> Result<(), BoxError> {
        self.apply(|state| {
            if state.headers_seen {
                return Err("response headers repeated".into());
            }
            state.headers_seen = true;
            state.advertised = headers
                .get_all(reqwest::header::TRAILER)
                .iter()
                .any(|value| {
                    value.to_str().is_ok_and(|value| {
                        value
                            .split(',')
                            .any(|name| name.trim().eq_ignore_ascii_case("authentication-info"))
                    })
                });
            Self::parameters(state, headers)?;
            self.verify(state, None, false)?;
            if self.head
                || status.is_informational()
                || status == StatusCode::NO_CONTENT
                || status == StatusCode::NOT_MODIFIED
            {
                self.complete(state)?;
            }
            Ok(())
        })
    }
    fn data(&self, bytes: &[u8]) -> Result<(), BoxError> {
        self.apply(|state| {
            if state.finished && !bytes.is_empty() {
                return Err("unexpected response entity bytes".into());
            }
            if let Some(hash) = &mut state.entity {
                hash.update(bytes);
            }
            Ok(())
        })
    }
    fn trailers(&self, headers: &HeaderMap) -> Result<(), BoxError> {
        self.apply(|state| {
            Self::parameters(state, headers)?;
            self.verify(state, None, false)
        })
    }
    fn finish(&self) -> Result<(), BoxError> {
        self.apply(|state| self.complete(state))
    }
    fn check_complete(&self) -> Result<(), BoxError> {
        let state = self
            .state
            .lock()
            .map_err(|_| ProofError("verifier state unavailable".into()))?;
        if let Some(error) = &state.failure {
            return Err(Box::new(ProofError(error.clone())));
        }
        if !state.finished {
            return Err(Box::new(ProofError(
                "response entity did not reach its verified end".into(),
            )));
        }
        Ok(())
    }
}

pub(crate) fn check_complete(proof: Option<&Arc<dyn ResponseVerifier>>) -> Result<(), String> {
    proof.map_or(Ok(()), |proof| {
        proof.check_complete().map_err(|error| error.to_string())
    })
}

pub(crate) fn body_error(error: &reqwest::Error) -> String {
    let mut source: Option<&(dyn Error + 'static)> = Some(error);
    while let Some(error) = source {
        if let Some(proof) = error.downcast_ref::<ProofError>() {
            return proof.to_string();
        }
        source = error.source();
    }
    error.to_string()
}
