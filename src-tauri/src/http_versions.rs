use reqwest::{ClientBuilder, Version};

pub(crate) fn selected(value: Option<&str>) -> Result<Option<Version>, String> {
    match value {
        None => Ok(None),
        Some("1.0") => Ok(Some(Version::HTTP_10)),
        Some("1.1") => Ok(Some(Version::HTTP_11)),
        Some("2-prior-knowledge") => Ok(Some(Version::HTTP_2)),
        _ => Err("Unsupported HTTP version selection".into()),
    }
}

pub(crate) fn configure(
    builder: ClientBuilder,
    value: Option<&str>,
    websocket: bool,
    ntlm: bool,
) -> Result<ClientBuilder, String> {
    let version = selected(value)?;
    if websocket && version.is_some_and(|v| v != Version::HTTP_11) {
        return Err("WebSocket handshake requires HTTP/1.1".into());
    }
    if ntlm && version == Some(Version::HTTP_2) {
        return Err("NTLM authentication requires HTTP/1.x".into());
    }
    Ok(match version {
        Some(Version::HTTP_10 | Version::HTTP_11) => builder.http1_only(),
        Some(Version::HTTP_2) => builder.http2_prior_knowledge(),
        _ => builder,
    })
}
