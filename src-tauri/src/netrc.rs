//! Native netrc discovery and Basic authentication. See NETRC-COMPATIBILITY.md.
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{header::HeaderValue, Url};
use std::{io::Read, path::Path};

const MAX_FILE: usize = 1024 * 1024;
const MAX_FIELD: usize = 16 * 1024;

pub(crate) struct Session {
    files: Vec<Result<Option<Vec<u8>>, String>>,
    original: Url,
    selector: Vec<u8>,
}

impl Session {
    pub(crate) async fn load(original: &str) -> Result<Self, String> {
        let original = Url::parse(original).map_err(|_| "Invalid netrc URL")?;
        let selector = percent_encoding::percent_decode_str(original.username()).collect();
        let files = tokio::task::spawn_blocking(discover)
            .await
            .map_err(|_| "Could not read netrc credentials")?;
        Ok(Self {
            files,
            original,
            selector,
        })
    }

    pub(crate) fn header(&self, url: &Url) -> Result<Option<HeaderValue>, String> {
        let host = url.host_str().ok_or("Netrc URL has no hostname")?;
        // IPv6 machine names have no URI brackets. A selector is never inherited
        // by a different hostname. Every hop starts with an empty credential pair.
        let host = host.trim_start_matches('[').trim_end_matches(']');
        let selector = if url.host_str() == self.original.host_str() {
            self.selector.as_slice()
        } else {
            &[]
        };
        for file in &self.files {
            let Some(file) = file.as_ref().map_err(Clone::clone)? else {
                continue;
            };
            if let Some(credentials) = lookup(file, host.as_bytes(), selector)? {
                return credentials.header();
            }
        }
        Ok(None)
    }
}

fn discover() -> Vec<Result<Option<Vec<u8>>, String>> {
    let home = std::env::var_os("HOME")
        .filter(|s| !s.is_empty())
        .map(std::path::PathBuf::from);
    #[cfg(windows)]
    let home = home.or_else(|| {
        std::env::var_os("USERPROFILE")
            .filter(|s| !s.is_empty())
            .map(std::path::PathBuf::from)
    });
    #[cfg(not(windows))]
    let home = home.or_else(std::env::home_dir);
    let Some(home) = home else {
        return Vec::new();
    };
    let files = vec![read_file(&home.join(".netrc"))];
    #[cfg(windows)]
    let files = {
        let mut files = files;
        files.push(read_file(&home.join("_netrc")));
        files
    };
    files
}

fn read_file(path: &Path) -> Result<Option<Vec<u8>>, String> {
    let metadata = match std::fs::metadata(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Could not access netrc file; check its permissions.".into()),
    };
    if !metadata.is_file() || metadata.len() > MAX_FILE as u64 {
        return Err("Netrc must be a regular file no larger than 1 MiB.".into());
    }
    let file = std::fs::File::open(path).map_err(|_| "Could not open netrc file.")?;
    let mut data = Vec::new();
    file.take((MAX_FILE + 1) as u64)
        .read_to_end(&mut data)
        .map_err(|_| "Could not read netrc file.")?;
    if data.len() > MAX_FILE {
        return Err("Netrc file exceeds 1 MiB.".into());
    }
    Ok(Some(data))
}

struct Credentials {
    login: Option<Vec<u8>>,
    password: Option<Vec<u8>>,
}
impl Credentials {
    fn selected(login: Option<Vec<u8>>, password: Option<Vec<u8>>, selector: &[u8]) -> Self {
        let login = if password.is_some() && login.is_none() && !selector.is_empty() {
            Some(selector.to_vec())
        } else {
            login
        };
        Self { login, password }
    }
    fn header(self) -> Result<Option<HeaderValue>, String> {
        if self.login.is_none() && self.password.is_none() {
            return Ok(None);
        }
        let mut bytes = self.login.unwrap_or_default();
        if bytes.contains(&b':') {
            return Err("Netrc Basic usernames cannot contain a colon.".into());
        }
        bytes.push(b':');
        bytes.extend(self.password.unwrap_or_default());
        let mut header = HeaderValue::from_str(&format!("Basic {}", STANDARD.encode(bytes)))
            .map_err(|_| "Invalid netrc authorization")?;
        header.set_sensitive(true);
        Ok(Some(header))
    }
}

// Ordered sections retain duplicate machine entries and byte-valued credentials.
// Partial sections never borrow fields from another section or redirect target.
fn lookup(data: &[u8], host: &[u8], selector: &[u8]) -> Result<Option<Credentials>, String> {
    let mut tokens = Tokens { data, offset: 0 };
    let mut matched = false;
    let mut login = None;
    let mut password = None;
    let mut selected = true;
    let mut saw_login = false;
    while let Some(token) = tokens.next()? {
        if token.eq_ignore_ascii_case(b"machine") || token.eq_ignore_ascii_case(b"default") {
            if matched && (selected || !saw_login) {
                return Ok(Some(Credentials::selected(login, password, selector)));
            }
            matched = if token.eq_ignore_ascii_case(b"machine") {
                tokens
                    .next()?
                    .ok_or("Netrc machine requires a hostname.")?
                    .eq_ignore_ascii_case(host)
            } else {
                true
            };
            login = None;
            password = None;
            selected = true;
            saw_login = false;
        } else if token.eq_ignore_ascii_case(b"macdef") {
            tokens.skip_macro();
        } else if token.eq_ignore_ascii_case(b"login")
            || token.eq_ignore_ascii_case(b"password")
            || token.eq_ignore_ascii_case(b"account")
        {
            let value = tokens
                .next()?
                .ok_or("Netrc credential keyword requires a value.")?;
            if !matched {
                continue;
            }
            if token.eq_ignore_ascii_case(b"login") {
                saw_login = true;
                selected = selector.is_empty() || value == selector;
                if selected {
                    login = Some(value);
                } else {
                    login = None;
                    password = None;
                }
            } else if token.eq_ignore_ascii_case(b"password") && selected {
                password = Some(value);
            }
            if login.is_some() && password.is_some() {
                return Ok(Some(Credentials { login, password }));
            }
        }
    }
    Ok((matched && (selected || !saw_login))
        .then(|| Credentials::selected(login, password, selector)))
}

struct Tokens<'a> {
    data: &'a [u8],
    offset: usize,
}
impl Tokens<'_> {
    fn next(&mut self) -> Result<Option<Vec<u8>>, String> {
        while self.offset < self.data.len() {
            match self.data[self.offset] {
                b'#' => {
                    while self.offset < self.data.len() && self.data[self.offset] != b'\n' {
                        self.offset += 1;
                    }
                }
                c if c.is_ascii_whitespace() => self.offset += 1,
                _ => break,
            }
        }
        if self.offset == self.data.len() {
            return Ok(None);
        }
        let quoted = self.data[self.offset] == b'"';
        if quoted {
            self.offset += 1;
        }
        let mut value = Vec::new();
        while self.offset < self.data.len() {
            let mut c = self.data[self.offset];
            self.offset += 1;
            if quoted && c == b'"' {
                return Ok(Some(value));
            }
            if !quoted && c.is_ascii_whitespace() {
                return Ok(Some(value));
            }
            if quoted && matches!(c, b'\r' | b'\n') {
                return Err("Netrc quoted value must end on the same line.".into());
            }
            if quoted && c == b'\\' {
                c = *self
                    .data
                    .get(self.offset)
                    .ok_or("Incomplete netrc escape.")?;
                self.offset += 1;
                c = match c {
                    b'n' => b'\n',
                    b'r' => b'\r',
                    b't' => b'\t',
                    b'\n' | b'\r' => return Err("Incomplete netrc escape.".into()),
                    other => other,
                };
            }
            if c == 0 {
                return Err("Netrc values cannot contain NUL.".into());
            }
            value.push(c);
            if value.len() > MAX_FIELD {
                return Err("Netrc field exceeds 16 KiB.".into());
            }
        }
        if quoted {
            return Err("Unclosed netrc quoted value.".into());
        }
        Ok(Some(value))
    }

    fn skip_macro(&mut self) {
        // Skip the remainder of the macdef declaration, then all lines up to a
        // genuinely empty line; whitespace-only lines are still macro content.
        while self.offset < self.data.len() && self.data[self.offset] != b'\n' {
            self.offset += 1;
        }
        self.offset = (self.offset + 1).min(self.data.len());
        while self.offset < self.data.len() {
            let start = self.offset;
            while self.offset < self.data.len() && self.data[self.offset] != b'\n' {
                self.offset += 1;
            }
            let end = self.offset;
            self.offset = (self.offset + 1).min(self.data.len());
            if end == start || (end == start + 1 && self.data[start] == b'\r') {
                break;
            }
        }
    }
}
