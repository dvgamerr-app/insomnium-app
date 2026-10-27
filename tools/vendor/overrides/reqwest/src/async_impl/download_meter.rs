//! Insomnium patch: count final response payload before content decompression.
//! Headers, transfer framing and decoded output are deliberately excluded.
use crate::error::BoxError;
use bytes::Bytes;
use hyper::body::{Body, Frame, SizeHint};
use pin_project_lite::pin_project;
use std::{
    future::Future,
    pin::Pin,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    task::{Context, Poll},
};
use tower_service::Service;

/// A request-owned verifier of response entity bytes before content decoding.
/// Errors prevent the corresponding frame or successful end from being delivered.
pub trait ResponseVerifier: std::fmt::Debug + Send + Sync {
    /// Checks the original response headers before decoding.
    fn headers(&self, status: http::StatusCode, headers: &http::HeaderMap) -> Result<(), BoxError>;
    /// Consumes an entity chunk before content decoding.
    fn data(&self, bytes: &[u8]) -> Result<(), BoxError>;
    /// Checks trailing response fields before successful EOF.
    fn trailers(&self, headers: &http::HeaderMap) -> Result<(), BoxError>;
    /// Verifies the complete entity at transport EOF.
    fn finish(&self) -> Result<(), BoxError>;
    /// Refuses a consumer's successful completion before transport verification.
    fn check_complete(&self) -> Result<(), BoxError>;
}

#[derive(Clone, Debug, Default)]
pub(crate) struct DownloadCount(Arc<AtomicU64>);
#[derive(Clone, Debug)]
pub(crate) struct OriginalHeaders(pub(crate) http::HeaderMap);
impl DownloadCount {
    pub(crate) fn bytes(&self) -> u64 {
        self.0.load(Ordering::Relaxed)
    }
}

pin_project! {
    #[derive(Debug)]
    pub(crate) struct MeteredBody<B> {
        #[pin]
        inner: B,
        count: DownloadCount,
        verifier: Option<Arc<dyn ResponseVerifier>>,
        error: Option<BoxError>,
        finished: bool,
    }
}
impl<B: Body<Data = Bytes>> Body for MeteredBody<B>
where
    B::Error: Into<BoxError>,
{
    type Data = Bytes;
    type Error = BoxError;
    fn poll_frame(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        let mut this = self.project();
        if let Some(error) = this.error.take() {
            *this.finished = true;
            return Poll::Ready(Some(Err(error)));
        }
        if *this.finished {
            return Poll::Ready(None);
        }
        let result = this.inner.as_mut().poll_frame(cx);
        if let Poll::Ready(Some(Ok(frame))) = &result {
            if let Some(data) = frame.data_ref() {
                this.count.0.fetch_add(data.len() as u64, Ordering::Relaxed);
            }
        }
        let result = match result {
            Poll::Pending => return Poll::Pending,
            Poll::Ready(Some(Err(error))) => {
                *this.finished = true;
                return Poll::Ready(Some(Err(error.into())));
            }
            Poll::Ready(result) => result.map(|frame| frame.map_err(Into::into)),
        };
        if let Some(verifier) = this.verifier.as_ref() {
            let checked = (|| {
                if let Some(Ok(frame)) = &result {
                    if let Some(data) = frame.data_ref() {
                        verifier.data(data)?;
                    }
                    if let Some(trailers) = frame.trailers_ref() {
                        verifier.trailers(trailers)?;
                    }
                }
                if result.is_none() || this.inner.as_ref().get_ref().is_end_stream() {
                    verifier.finish()?;
                    *this.finished = true;
                }
                Ok::<_, BoxError>(())
            })();
            if let Err(error) = checked {
                *this.finished = true;
                return Poll::Ready(Some(Err(error)));
            }
        }
        Poll::Ready(result)
    }
    fn is_end_stream(&self) -> bool {
        self.finished || self.verifier.is_none() && self.inner.is_end_stream()
    }
    fn size_hint(&self) -> SizeHint {
        self.inner.size_hint()
    }
}

#[derive(Clone, Debug)]
pub(crate) struct DownloadMeter<S>(pub(crate) S);
impl<S, ReqBody, ResBody> Service<http::Request<ReqBody>> for DownloadMeter<S>
where
    S: Service<http::Request<ReqBody>, Response = http::Response<ResBody>>,
    ResBody: Body<Data = Bytes>,
{
    type Response = http::Response<MeteredBody<ResBody>>;
    type Error = S::Error;
    type Future = MeterFuture<S::Future>;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.0.poll_ready(cx)
    }
    fn call(&mut self, request: http::Request<ReqBody>) -> Self::Future {
        let verifier = request
            .extensions()
            .get::<Arc<dyn ResponseVerifier>>()
            .cloned();
        MeterFuture {
            inner: self.0.call(request),
            verifier,
        }
    }
}
pin_project! {
    #[derive(Debug)]
    pub(crate) struct MeterFuture<F> {
        #[pin]
        inner: F,
        verifier: Option<Arc<dyn ResponseVerifier>>,
    }
}
impl<F, B, E> Future for MeterFuture<F>
where
    F: Future<Output = Result<http::Response<B>, E>>,
    B: Body<Data = Bytes>,
{
    type Output = Result<http::Response<MeteredBody<B>>, E>;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.project();
        let response = match this.inner.poll(cx) {
            Poll::Pending => return Poll::Pending,
            Poll::Ready(Err(error)) => return Poll::Ready(Err(error)),
            Poll::Ready(Ok(response)) => response,
        };
        let (mut parts, body) = response.into_parts();
        let verifier = this.verifier.take();
        let error = verifier.as_ref().and_then(|verifier| {
            verifier
                .headers(parts.status, &parts.headers)
                .and_then(|()| {
                    if body.is_end_stream() {
                        verifier.finish()
                    } else {
                        Ok(())
                    }
                })
                .err()
        });
        if let Some(verifier) = &verifier {
            parts.extensions.insert(verifier.clone());
        }
        let count = DownloadCount::default();
        parts
            .extensions
            .insert(OriginalHeaders(parts.headers.clone()));
        // Content codings are case-insensitive; retain wire spelling above.
        if let Some(value) = parts.headers.get_mut(http::header::CONTENT_ENCODING) {
            if let Ok(text) = value.to_str() {
                if let Some(coding) = ["gzip", "deflate", "br"]
                    .into_iter()
                    .find(|coding| text.trim().eq_ignore_ascii_case(coding))
                {
                    *value = http::HeaderValue::from_static(coding);
                }
            }
        }
        parts.extensions.insert(count.clone());
        Poll::Ready(Ok(http::Response::from_parts(
            parts,
            MeteredBody {
                inner: body,
                count,
                verifier,
                error,
                finished: false,
            },
        )))
    }
}
