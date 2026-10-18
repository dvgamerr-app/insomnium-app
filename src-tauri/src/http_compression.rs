/// None preserves the existing application/client policy for old callers.
pub(crate) fn client(
    builder: reqwest::ClientBuilder,
    enabled: Option<bool>,
) -> reqwest::ClientBuilder {
    if enabled == Some(false) {
        builder.no_gzip().no_brotli().no_deflate().no_zstd()
    } else {
        builder
    }
}

pub(crate) fn request(
    builder: reqwest::RequestBuilder,
    enabled: Option<bool>,
    manual_accept: bool,
) -> reqwest::RequestBuilder {
    if enabled == Some(true) && !manual_accept {
        // Also request compression for Range requests, as curl does.
        builder.header(reqwest::header::ACCEPT_ENCODING, "gzip, deflate, br")
    } else {
        builder
    }
}

pub(crate) fn response(
    response: &mut reqwest::Response,
    enabled: Option<bool>,
) -> Result<(), String> {
    if enabled == Some(true) {
        let codings = response
            .original_headers()
            .get_all(reqwest::header::CONTENT_ENCODING)
            .iter()
            .map(|value| {
                value
                    .to_str()
                    .map_err(|_| "Invalid response Content-Encoding.")
            })
            .collect::<Result<Vec<_>, _>>()?;
        let codings: Vec<_> = codings
            .iter()
            .flat_map(|value| value.split(','))
            .map(str::trim)
            .filter(|value| !value.eq_ignore_ascii_case("identity"))
            .collect();
        if codings.len() > 1
            || (!codings.is_empty()
                && response
                    .headers()
                    .contains_key(reqwest::header::CONTENT_ENCODING))
            || codings.iter().any(|value| {
                !["gzip", "deflate", "br"]
                    .iter()
                    .any(|known| value.eq_ignore_ascii_case(known))
            })
        {
            return Err(
                "Unsupported compressed response Content-Encoding. Supported: gzip, deflate, br."
                    .into(),
            );
        }
    }
    if enabled.is_some() {
        let original = response.original_headers().clone();
        *response.headers_mut() = original;
    }
    Ok(())
}
