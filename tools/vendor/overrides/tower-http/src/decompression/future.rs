#![allow(unused_imports)]

use super::{body::BodyInner, DecompressionBody};
use crate::compression_utils::{AcceptEncoding, CompressionLevel, WrapBody};
use crate::content_encoding::SupportedEncodings;
use http::{header, Response};
use http_body::Body;
use pin_project_lite::pin_project;
use std::{
    future::Future,
    pin::Pin,
    task::{ready, Context, Poll},
};

pin_project! {
    /// Response future of [`Decompression`].
    ///
    /// [`Decompression`]: super::Decompression
    #[derive(Debug)]
    pub struct ResponseFuture<F> {
        #[pin]
        pub(crate) inner: F,
        pub(crate) accept: AcceptEncoding,
    }
}

impl<F, B, E> Future for ResponseFuture<F>
where
    F: Future<Output = Result<Response<B>, E>>,
    B: Body,
{
    type Output = Result<Response<DecompressionBody<B>>, E>;

    #[allow(unreachable_code, unused_mut, unused_variables)]
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let res = ready!(self.as_mut().project().inner.poll(cx)?);
        Poll::Ready(Ok(decompress_response(res, self.accept)))
    }
}

#[allow(unreachable_code, unused_mut, unused_variables)]
pub(super) fn decompress_response<B: Body>(
    response: Response<B>,
    accept: AcceptEncoding,
) -> Response<DecompressionBody<B>> {
    let (mut parts, body) = response.into_parts();
    let Some(encoding) = parts.headers.get(header::CONTENT_ENCODING) else {
        return Response::from_parts(parts, DecompressionBody::new(BodyInner::identity(body)));
    };
    let body = match encoding.as_bytes() {
        #[cfg(feature = "decompression-gzip")]
        b"gzip" if accept.gzip() => DecompressionBody::new(BodyInner::gzip(WrapBody::new(
            body,
            CompressionLevel::default(),
        ))),
        #[cfg(feature = "decompression-deflate")]
        b"deflate" if accept.deflate() => DecompressionBody::new(BodyInner::deflate(
            WrapBody::new(body, CompressionLevel::default()),
        )),
        #[cfg(feature = "decompression-br")]
        b"br" if accept.br() => DecompressionBody::new(BodyInner::brotli(WrapBody::new(
            body,
            CompressionLevel::default(),
        ))),
        #[cfg(feature = "decompression-zstd")]
        b"zstd" if accept.zstd() => DecompressionBody::new(BodyInner::zstd(WrapBody::new(
            body,
            CompressionLevel::default(),
        ))),
        _ => return Response::from_parts(parts, DecompressionBody::new(BodyInner::identity(body))),
    };
    parts.headers.remove(header::CONTENT_ENCODING);
    parts.headers.remove(header::CONTENT_LENGTH);
    Response::from_parts(parts, body)
}
