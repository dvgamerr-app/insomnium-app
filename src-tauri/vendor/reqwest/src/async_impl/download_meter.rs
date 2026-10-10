//! Insomnium patch: count final response payload before content decompression.
//! Headers, transfer framing and decoded output are deliberately excluded.
use bytes::Buf;
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

#[derive(Clone, Debug, Default)]
pub(crate) struct DownloadCount(Arc<AtomicU64>);
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
    }
}
impl<B: Body> Body for MeteredBody<B> {
    type Data = B::Data;
    type Error = B::Error;
    fn poll_frame(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        let this = self.project();
        let result = this.inner.poll_frame(cx);
        if let Poll::Ready(Some(Ok(frame))) = &result {
            if let Some(data) = frame.data_ref() {
                this.count
                    .0
                    .fetch_add(data.remaining() as u64, Ordering::Relaxed);
            }
        }
        result
    }
    fn is_end_stream(&self) -> bool {
        self.inner.is_end_stream()
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
{
    type Response = http::Response<MeteredBody<ResBody>>;
    type Error = S::Error;
    type Future = MeterFuture<S::Future>;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.0.poll_ready(cx)
    }
    fn call(&mut self, request: http::Request<ReqBody>) -> Self::Future {
        MeterFuture {
            inner: self.0.call(request),
        }
    }
}
pin_project! {
    #[derive(Debug)]
    pub(crate) struct MeterFuture<F> {
        #[pin]
        inner: F,
    }
}
impl<F, B, E> Future for MeterFuture<F>
where
    F: Future<Output = Result<http::Response<B>, E>>,
{
    type Output = Result<http::Response<MeteredBody<B>>, E>;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let response = match self.project().inner.poll(cx) {
            Poll::Pending => return Poll::Pending,
            Poll::Ready(Err(error)) => return Poll::Ready(Err(error)),
            Poll::Ready(Ok(response)) => response,
        };
        let (mut parts, body) = response.into_parts();
        let count = DownloadCount::default();
        parts.extensions.insert(count.clone());
        Poll::Ready(Ok(http::Response::from_parts(
            parts,
            MeteredBody { inner: body, count },
        )))
    }
}
