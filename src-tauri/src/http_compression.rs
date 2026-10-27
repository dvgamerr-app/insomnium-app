use futures_util::StreamExt;
use http_body_util::{BodyStream, StreamBody};
use reqwest::ResponseBuilderExt;

/// None preserves the existing application/client policy for old callers.
pub(crate) fn client(
    builder: reqwest::ClientBuilder,
    enabled: Option<bool>,
) -> reqwest::ClientBuilder {
    if enabled.is_some() {
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
        let original = response.original_headers().clone();
        let mut codings = Vec::new();
        for value in original.get_all(reqwest::header::CONTENT_ENCODING) {
            for coding in value
                .to_str()
                .map_err(|_| "Invalid response Content-Encoding.")?
                .split(',')
            {
                let coding = coding.trim();
                if coding.eq_ignore_ascii_case("identity") {
                    continue;
                }
                if !["gzip", "deflate", "br"]
                    .iter()
                    .any(|known| coding.eq_ignore_ascii_case(known))
                {
                    return Err("Unsupported compressed response Content-Encoding. Supported: gzip, deflate, br.".into());
                }
                if codings.len() == 5 {
                    return Err("Response Content-Encoding exceeds the five-layer limit.".into());
                }
                codings.push(coding.to_ascii_lowercase());
            }
        }
        if !codings.is_empty() {
            let url = response.url().clone();
            let wire = std::mem::replace(response, hyper::Response::new("").into());
            let mut decoded: hyper::Response<reqwest::Body> = wire.into();
            decoded = decoded.map(cooperative_body);
            for coding in codings.iter().rev() {
                decoded.headers_mut().insert(
                    reqwest::header::CONTENT_ENCODING,
                    reqwest::header::HeaderValue::from_str(coding)
                        .map_err(|_| "Invalid response Content-Encoding.")?,
                );
                decoded = tower_http::decompression::DecompressionBody::from_response(decoded)
                    .map(|body| cooperative_body(reqwest::Body::wrap(body)));
            }
            let (parts, body) = decoded.into_parts();
            let mut rebuilt = hyper::Response::builder()
                .status(parts.status)
                .version(parts.version)
                .url(url)
                .body(body)
                .map_err(|error| error.to_string())?;
            *rebuilt.headers_mut() = original;
            rebuilt.extensions_mut().extend(parts.extensions);
            *response = rebuilt.into();
        }
    }
    if enabled.is_some() {
        let original = response.original_headers().clone();
        *response.headers_mut() = original;
    }
    Ok(())
}

fn cooperative_body(body: reqwest::Body) -> reqwest::Body {
    // Yield between decoder frames so an expanding inner layer cannot starve cancellation.
    reqwest::Body::wrap(StreamBody::new(BodyStream::new(body).then(|frame| async {
        tokio::task::yield_now().await;
        frame
    })))
}
