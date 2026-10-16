//! Dedicated, connection-owned proxy challenge transport. No spawned driver.
use crate::{
    async_impl::body::{Body, ResponseBody},
    connect::Connector,
    error::BoxError,
    proxy::ProxyChallengeProvider,
};
use bytes::Bytes;
use futures_util::future::poll_fn;
use http::{header, HeaderMap, Request, Response, StatusCode, Uri};
use http_body::{Body as HttpBody, Frame, SizeHint};
use http_body_util::BodyExt;
use hyper::client::conn::http1::SendRequest;
use hyper_util::client::legacy::connect::{Connected, Connection};
use std::{
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll},
};
use tower_service::Service;

fn failed(message: &'static str) -> BoxError {
    std::io::Error::other(message).into()
}

/// Synchronous ownership wrapper, not a spawned task or unsafe Sync assertion.
pub(crate) struct SyncFuture<T>(Mutex<Pin<Box<dyn Future<Output = T> + Send>>>);
impl<T> SyncFuture<T> {
    pub(crate) fn new(future: impl Future<Output = T> + Send + 'static) -> Self {
        Self(Mutex::new(Box::pin(future)))
    }
}
impl<T> Future for SyncFuture<T> {
    type Output = T;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<T> {
        self.0.lock().expect("owned future lock").as_mut().poll(cx)
    }
}

#[derive(Clone)]
pub(crate) struct Driver(
    Arc<Mutex<Option<Pin<Box<dyn Future<Output = Result<(), hyper::Error>> + Send>>>>>,
);
impl Driver {
    fn new(future: impl Future<Output = Result<(), hyper::Error>> + Send + 'static) -> Self {
        Self(Arc::new(Mutex::new(Some(Box::pin(future)))))
    }
    fn poll(&self, cx: &mut Context<'_>) -> Result<(), BoxError> {
        let mut state = self.0.lock().expect("owned connection lock");
        if let Some(future) = state.as_mut() {
            if let Poll::Ready(result) = future.as_mut().poll(cx) {
                *state = None;
                result.map_err(|error| Box::new(error) as BoxError)?;
            }
        }
        Ok(())
    }
    async fn run<F: Future>(&self, future: F) -> Result<F::Output, BoxError> {
        let mut future = std::pin::pin!(future);
        poll_fn(|cx| {
            if let Err(error) = self.poll(cx) {
                return Poll::Ready(Err(error));
            }
            future.as_mut().poll(cx).map(Ok)
        })
        .await
    }
    pub(crate) async fn upgrade(
        &self,
        future: hyper::upgrade::OnUpgrade,
    ) -> Result<hyper::upgrade::Upgraded, BoxError> {
        self.run(future)
            .await?
            .map_err(|error| Box::new(error) as BoxError)
    }
}

struct Live {
    key: String,
    sender: SendRequest<Body>,
    driver: Driver,
    certificate: Option<Vec<u8>>,
    origin_certificate: Option<Vec<u8>>,
    connected: Connected,
}
/// Private per-client slot, never the Hyper pool. Its exclusive lease lasts
/// through the final body; only complete reusable responses return a sender.
#[derive(Clone, Default)]
pub(crate) struct Slot(Arc<tokio::sync::Mutex<Option<Live>>>);

struct Lease {
    guard: tokio::sync::OwnedMutexGuard<Option<Live>>,
    reusable: bool,
}
impl std::ops::Deref for Lease {
    type Target = Option<Live>;
    fn deref(&self) -> &Self::Target {
        &self.guard
    }
}
impl std::ops::DerefMut for Lease {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.guard
    }
}
impl Drop for Lease {
    fn drop(&mut self) {
        if !self.reusable {
            *self.guard = None;
        }
    }
}

struct OwnedBody {
    incoming: hyper::body::Incoming,
    driver: Driver,
    lease: Option<Lease>,
    reusable: bool,
}
impl Drop for OwnedBody {
    fn drop(&mut self) {
        if let Some(mut lease) = self.lease.take() {
            *lease = None;
        }
    }
}
impl HttpBody for OwnedBody {
    type Data = Bytes;
    type Error = BoxError;
    fn poll_frame(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Bytes>, BoxError>>> {
        if let Err(error) = self.driver.poll(cx) {
            return Poll::Ready(Some(Err(error)));
        }
        match Pin::new(&mut self.incoming).poll_frame(cx) {
            Poll::Ready(None) => {
                if let Some(mut lease) = self.lease.take() {
                    lease.reusable = self.reusable;
                }
                Poll::Ready(None)
            }
            Poll::Ready(Some(Err(error))) => Poll::Ready(Some(Err(Box::new(error)))),
            Poll::Ready(Some(Ok(frame))) => Poll::Ready(Some(Ok(frame))),
            Poll::Pending => Poll::Pending,
        }
    }
    // Force a final poll even for zero-length responses so ownership settles.
    fn is_end_stream(&self) -> bool {
        self.lease.is_none() && self.incoming.is_end_stream()
    }
    fn size_hint(&self) -> SizeHint {
        self.incoming.size_hint()
    }
}

fn headers_bounded(headers: &HeaderMap) -> Result<(), BoxError> {
    let size = headers.iter().try_fold(0usize, |sum, (name, value)| {
        sum.checked_add(name.as_str().len() + value.as_bytes().len())
            .ok_or_else(|| failed("Proxy challenge headers exceed limit"))
    })?;
    if size > 96 * 1024 {
        return Err(failed("Proxy challenge headers exceed 96 KiB"));
    }
    Ok(())
}
async fn drain(mut incoming: hyper::body::Incoming, driver: &Driver) -> Result<(), BoxError> {
    let mut size = 0usize;
    while let Some(frame) = driver.run(incoming.frame()).await? {
        let frame = frame.map_err(|error| Box::new(error) as BoxError)?;
        if let Some(bytes) = frame.data_ref() {
            size = size
                .checked_add(bytes.len())
                .ok_or_else(|| failed("Proxy challenge body exceeds limit"))?;
        }
        if size > 1024 * 1024 {
            return Err(failed("Proxy challenge body exceeds 1 MiB"));
        }
    }
    Ok(())
}
async fn exchange(
    live: &mut Live,
    method: http::Method,
    uri: Uri,
    headers: HeaderMap,
    bytes: Bytes,
    provider: Arc<dyn ProxyChallengeProvider>,
    challenge: bool,
) -> Result<Response<hyper::body::Incoming>, BoxError> {
    let mut session = None;
    let mut authorization = None;
    for round in 0..=3 {
        live.driver
            .run(live.sender.ready())
            .await?
            .map_err(|error| Box::new(error) as BoxError)?;
        let mut request = Request::new(Body::reusable(bytes.clone()));
        *request.method_mut() = method.clone();
        *request.uri_mut() = uri.clone();
        *request.version_mut() = http::Version::HTTP_11;
        *request.headers_mut() = headers.clone();
        request.headers_mut().remove(header::PROXY_AUTHORIZATION);
        if let Some(value) = authorization.clone() {
            request
                .headers_mut()
                .insert(header::PROXY_AUTHORIZATION, value);
        }
        let response = live
            .driver
            .run(live.sender.send_request(request))
            .await?
            .map_err(|error| Box::new(error) as BoxError)?;
        if !challenge || response.status() != StatusCode::PROXY_AUTHENTICATION_REQUIRED {
            return Ok(response);
        }
        if round == 3 {
            return Err(failed("Proxy authentication retry limit exceeded"));
        }
        headers_bounded(response.headers())?;
        if response
            .headers()
            .get(header::CONNECTION)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| {
                v.split(',')
                    .any(|part| part.trim().eq_ignore_ascii_case("close"))
            })
        {
            return Err(failed(
                "Proxy closed challenged connection; authentication cannot reconnect",
            ));
        }
        if session.is_none() {
            session = Some(provider.create_session()?);
        }
        let value = session
            .as_mut()
            .expect("proxy session")
            .authenticate_request(
                response.headers(),
                live.certificate.as_deref(),
                &method,
                &uri.to_string(),
                bytes.as_ref(),
            )?;
        if value.as_bytes().len() > 96 * 1024 {
            return Err(failed("Proxy authentication header exceeds limit"));
        }
        authorization = Some(value);
        drain(response.into_body(), &live.driver).await?;
    }
    unreachable!()
}

pub(crate) async fn request(
    mut connector: Connector,
    slot: Slot,
    proxy_uri: Uri,
    provider: Arc<dyn ProxyChallengeProvider>,
    request: Request<Body>,
) -> Result<Response<ResponseBody>, BoxError> {
    let (mut parts, mut body) = request.into_parts();
    let bytes = if let Some(bytes) = body.as_bytes() {
        if bytes.len() > 20 * 1024 * 1024 {
            return Err(failed("Proxy request body exceeds 20 MiB"));
        }
        Bytes::copy_from_slice(bytes)
    } else {
        let mut buffered = bytes::BytesMut::new();
        while let Some(frame) = body.frame().await {
            let frame = frame?;
            if let Some(data) = frame.data_ref() {
                if buffered.len().saturating_add(data.len()) > 20 * 1024 * 1024 {
                    return Err(failed("Proxy request body exceeds 20 MiB"));
                }
                buffered.extend_from_slice(data);
            } else {
                return Err(failed(
                    "Proxy challenge request trailers cannot be replayed",
                ));
            }
        }
        buffered.freeze()
    };
    let destination = parts.uri.clone();
    let key = format!(
        "{}://{}|{}",
        destination.scheme_str().unwrap_or(""),
        destination.authority().map(|a| a.as_str()).unwrap_or(""),
        proxy_uri
    );
    let mut lease = Lease {
        guard: slot.0.clone().lock_owned().await,
        reusable: false,
    };
    if lease
        .as_ref()
        .is_some_and(|live| live.key != key || live.sender.is_closed())
    {
        *lease = None;
    }
    if let Some(live) = lease.as_mut() {
        if !matches!(live.driver.run(live.sender.ready()).await, Ok(Ok(()))) {
            *lease = None;
        }
    }
    if lease.is_none() {
        poll_fn(|cx| connector.poll_ready(cx)).await?;
        let conn = connector.call(destination.clone()).await?;
        let connected = conn.connected();
        let peer_certificate = conn.tls_peer_certificate();
        let is_origin = destination.scheme_str() == Some("https");
        let certificate = if is_origin {
            None
        } else {
            peer_certificate.clone()
        };
        let origin_certificate = if is_origin { peer_certificate } else { None };
        let (sender, connection) = hyper::client::conn::http1::Builder::new()
            .max_buf_size(96 * 1024)
            .handshake(conn)
            .await?;
        *lease = Some(Live {
            key,
            sender,
            driver: Driver::new(connection.with_upgrades()),
            certificate,
            origin_certificate,
            connected,
        });
    }
    let live = lease.as_mut().expect("owned connection");
    let plain = destination.scheme_str() == Some("http");
    if !parts.headers.contains_key(header::HOST) {
        parts.headers.insert(
            header::HOST,
            http::HeaderValue::from_str(
                destination
                    .authority()
                    .ok_or_else(|| failed("Proxy request lacks authority"))?
                    .as_str(),
            )?,
        );
    }
    if !plain {
        parts.uri = destination
            .path_and_query()
            .map(|path| path.as_str())
            .unwrap_or("/")
            .parse()?;
    }
    let response = match exchange(
        live,
        parts.method,
        parts.uri,
        parts.headers,
        bytes,
        provider,
        plain,
    )
    .await
    {
        Ok(value) => value,
        Err(error) => {
            *lease = None;
            return Err(error);
        }
    };
    let driver = live.driver.clone();
    let upgrade = response.status() == StatusCode::SWITCHING_PROTOCOLS;
    let reusable = !upgrade
        && !response
            .headers()
            .get(header::CONNECTION)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.split(',').any(|p| p.trim().eq_ignore_ascii_case("close")));
    let (mut parts, incoming) = response.into_parts();
    response_extras(&live.connected, &mut parts.extensions);
    #[cfg(feature = "__tls")]
    if !plain {
        parts.extensions.insert(crate::tls::TlsInfo {
            peer_certificate: live.origin_certificate.clone(),
        });
    }
    if upgrade {
        parts.extensions.insert(driver.clone());
    }
    Ok(Response::from_parts(
        parts,
        OwnedBody {
            incoming,
            driver,
            lease: Some(lease),
            reusable,
        }
        .boxed(),
    ))
}

pub(crate) async fn tunnel<T>(
    io: T,
    certificate: Option<Vec<u8>>,
    destination: Uri,
    provider: Arc<dyn ProxyChallengeProvider>,
    mut headers: HeaderMap,
) -> Result<UpgradedIo, BoxError>
where
    T: hyper::rt::Read + hyper::rt::Write + Connection + Unpin + Send + 'static,
{
    let host = destination
        .host()
        .ok_or_else(|| failed("CONNECT destination lacks host"))?;
    let port = destination.port_u16().unwrap_or(443);
    let authority = if host.contains(':') && !host.starts_with('[') {
        format!("[{}]:{}", host, port)
    } else {
        format!("{}:{}", host, port)
    };
    headers.insert(header::HOST, http::HeaderValue::from_str(&authority)?);
    let connected = Arc::new(io.connected());
    let (sender, connection) = hyper::client::conn::http1::Builder::new()
        .max_buf_size(96 * 1024)
        .handshake(io)
        .await?;
    let mut live = Live {
        key: String::new(),
        sender,
        driver: Driver::new(connection.with_upgrades()),
        certificate,
        origin_certificate: None,
        connected: Connected::new(),
    };
    let response = exchange(
        &mut live,
        http::Method::CONNECT,
        authority.parse()?,
        headers,
        Bytes::new(),
        provider,
        true,
    )
    .await?;
    if !response.status().is_success() {
        return Err(failed("Proxy refused CONNECT tunnel"));
    }
    live.driver
        .upgrade(hyper::upgrade::on(response))
        .await
        .map(|io| UpgradedIo(Mutex::new(io), connected))
}

/// Synchronizes polling without spawning, allowing the upgraded tunnel to satisfy
/// the existing connector's Send + Sync bounds.
pub(crate) struct UpgradedIo(Mutex<hyper::upgrade::Upgraded>, Arc<Connected>);

#[derive(Clone)]
struct PreservedProxyExtras(Arc<Connected>);
impl Connection for UpgradedIo {
    fn connected(&self) -> Connected {
        Connected::new().extra(PreservedProxyExtras(self.1.clone()))
    }
}
fn response_extras(connected: &Connected, extensions: &mut http::Extensions) {
    let mut outer = http::Extensions::new();
    connected.get_extras(&mut outer);
    if let Some(proxy) = outer.remove::<PreservedProxyExtras>() {
        proxy.0.get_extras(extensions);
        #[cfg(feature = "__tls")]
        extensions.remove::<crate::tls::TlsInfo>();
    }
    extensions.extend(outer);
}
impl hyper::rt::Read for UpgradedIo {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buffer: hyper::rt::ReadBufCursor<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut *self.0.lock().expect("tunnel IO lock")).poll_read(cx, buffer)
    }
}
impl hyper::rt::Write for UpgradedIo {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        bytes: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut *self.0.lock().expect("tunnel IO lock")).poll_write(cx, bytes)
    }
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(&mut *self.0.lock().expect("tunnel IO lock")).poll_flush(cx)
    }
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(&mut *self.0.lock().expect("tunnel IO lock")).poll_shutdown(cx)
    }
}
