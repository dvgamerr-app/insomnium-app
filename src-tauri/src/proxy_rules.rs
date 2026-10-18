//! Destination-scheme proxy rules shared by explicit proxy authentication modes.
use reqwest::Proxy;

pub(crate) fn configured(
    value: &str,
    scheme: Option<&str>,
    bypass: Option<&str>,
) -> Result<Proxy, String> {
    if value.len() > 8192 || value.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("Invalid bounded proxy URL".into());
    }
    let bypass = bypass.filter(|value| !value.is_empty());
    if bypass.is_some_and(|value| value.len() > 8192 || value.chars().any(char::is_control)) {
        return Err("Invalid bounded proxy bypass list".into());
    }
    let proxy = match scheme {
        None => Proxy::all(value),
        Some("http") => Proxy::http(value),
        Some("https") => Proxy::https(value),
        _ => return Err("Invalid proxy destination scheme".into()),
    }
    .map_err(|_| "Invalid proxy configuration".to_string())?;
    Ok(proxy.no_proxy(bypass.and_then(reqwest::NoProxy::from_string)))
}
