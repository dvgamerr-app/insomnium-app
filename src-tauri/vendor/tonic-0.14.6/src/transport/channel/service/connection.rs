use super::super::ready::{
    Connectivity, ConnectivityState, DriverObservation, Monitor, Observation,
};
use super::{AddOrigin, Reconnect, SharedExec, UserAgent};
use crate::{
    body::Body,
    transport::{Endpoint, channel::BoxFuture, service::GrpcTimeout},
};
use http::{Request, Response, Uri};
use hyper::rt;
use hyper::{client::conn::http2::Builder, rt::Executor};
use hyper_util::rt::TokioTimer;
use std::{
    fmt,
    task::{Context, Poll},
};
use tower::load::Load;
use tower::{
    ServiceBuilder, ServiceExt,
    layer::Layer,
    limit::{concurrency::ConcurrencyLimitLayer, rate::RateLimitLayer},
    util::BoxService,
};
use tower_service::Service;

pub(crate) struct Connection {
    inner: BoxService<Request<Body>, Response<Body>, crate::BoxError>,
    monitor: Option<Monitor>,
}

impl Connection {
    fn new<C>(connector: C, endpoint: Endpoint, is_lazy: bool, readiness_errors: bool) -> Self
    where
        C: Service<Uri> + Send + 'static,
        C::Error: Into<crate::BoxError> + Send,
        C::Future: Send,
        C::Response: rt::Read + rt::Write + Unpin + Send + 'static,
    {
        let mut settings: Builder<SharedExec> = Builder::new(endpoint.executor.clone())
            .initial_stream_window_size(endpoint.init_stream_window_size)
            .initial_connection_window_size(endpoint.init_connection_window_size)
            .keep_alive_interval(endpoint.http2_keep_alive_interval)
            .timer(TokioTimer::new())
            .clone();

        if let Some(val) = endpoint.max_frame_size {
            settings.max_frame_size(val);
        }

        if let Some(val) = endpoint.http2_keep_alive_timeout {
            settings.keep_alive_timeout(val);
        }

        if let Some(val) = endpoint.http2_keep_alive_while_idle {
            settings.keep_alive_while_idle(val);
        }

        if let Some(val) = endpoint.http2_adaptive_window {
            settings.adaptive_window(val);
        }

        if let Some(val) = endpoint.http2_header_table_size {
            settings.header_table_size(val);
        }

        if let Some(val) = endpoint.http2_max_header_list_size {
            settings.max_header_list_size(val);
        }

        let stack = ServiceBuilder::new()
            .layer_fn(|s| {
                let origin = endpoint.origin.as_ref().unwrap_or(endpoint.uri()).clone();

                AddOrigin::new(s, origin)
            })
            .layer_fn(|s| UserAgent::new(s, endpoint.user_agent.clone()))
            .layer_fn(|s| GrpcTimeout::new(s, endpoint.timeout))
            .option_layer(endpoint.concurrency_limit.map(ConcurrencyLimitLayer::new))
            .option_layer(endpoint.rate_limit.map(|(l, d)| RateLimitLayer::new(l, d)))
            .into_inner();

        let monitor = readiness_errors.then(Monitor::new);
        let make_service = MakeSendRequestService::new(
            connector,
            endpoint.executor.clone(),
            settings,
            monitor.clone(),
        );

        let conn = Reconnect::new(make_service, endpoint.uri().clone(), is_lazy)
            .with_readiness_errors(readiness_errors);

        Self {
            inner: BoxService::new(stack.layer(conn)),
            monitor,
        }
    }

    pub(crate) fn connectivity(&self) -> Option<tokio::sync::watch::Receiver<Connectivity>> {
        self.monitor.as_ref().map(Monitor::subscribe)
    }
    pub(crate) fn idle_after_failure(&self, generation: u64) -> bool {
        self.monitor
            .as_ref()
            .is_some_and(|monitor| monitor.idle_after_failure(generation))
    }

    pub(crate) async fn connect<C>(
        connector: C,
        endpoint: Endpoint,
    ) -> Result<Self, crate::BoxError>
    where
        C: Service<Uri> + Send + 'static,
        C::Error: Into<crate::BoxError> + Send,
        C::Future: Unpin + Send,
        C::Response: rt::Read + rt::Write + Unpin + Send + 'static,
    {
        Self::new(connector, endpoint, false, false)
            .ready_oneshot()
            .await
    }

    pub(crate) fn lazy<C>(connector: C, endpoint: Endpoint) -> Self
    where
        C: Service<Uri> + Send + 'static,
        C::Error: Into<crate::BoxError> + Send,
        C::Future: Send,
        C::Response: rt::Read + rt::Write + Unpin + Send + 'static,
    {
        Self::new(connector, endpoint, true, false)
    }

    pub(crate) fn lazy_ready<C>(connector: C, endpoint: Endpoint) -> Self
    where
        C: Service<Uri> + Send + 'static,
        C::Error: Into<crate::BoxError> + Send,
        C::Future: Send,
        C::Response: rt::Read + rt::Write + Unpin + Send + 'static,
    {
        Self::new(connector, endpoint, true, true)
    }

    pub(crate) async fn connect_ready<C>(
        connector: C,
        endpoint: Endpoint,
    ) -> Result<Self, crate::BoxError>
    where
        C: Service<Uri> + Send + 'static,
        C::Error: Into<crate::BoxError> + Send,
        C::Future: Unpin + Send,
        C::Response: rt::Read + rt::Write + Unpin + Send + 'static,
    {
        Self::new(connector, endpoint, false, true)
            .ready_oneshot()
            .await
    }
}

impl Service<Request<Body>> for Connection {
    type Response = Response<Body>;
    type Error = crate::BoxError;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Service::poll_ready(&mut self.inner, cx).map_err(Into::into)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        self.inner.call(req)
    }
}

impl Load for Connection {
    type Metric = usize;

    fn load(&self) -> Self::Metric {
        0
    }
}

impl fmt::Debug for Connection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Connection").finish()
    }
}

struct SendRequest {
    inner: hyper::client::conn::http2::SendRequest<Body>,
    observation: Option<Observation>,
}

impl From<hyper::client::conn::http2::SendRequest<Body>> for SendRequest {
    fn from(inner: hyper::client::conn::http2::SendRequest<Body>) -> Self {
        Self {
            inner,
            observation: None,
        }
    }
}

impl tower::Service<Request<Body>> for SendRequest {
    type Response = Response<Body>;
    type Error = crate::BoxError;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let result = self.inner.poll_ready(cx);
        if matches!(&result, Poll::Ready(Err(_))) {
            if let Some(observation) = &self.observation {
                observation.publish(ConnectivityState::Disconnected);
            }
        }
        result.map_err(Into::into)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let fut = self.inner.send_request(req);

        Box::pin(async move { fut.await.map_err(Into::into).map(|res| res.map(Body::new)) })
    }
}

struct MakeSendRequestService<C> {
    connector: C,
    executor: SharedExec,
    settings: Builder<SharedExec>,
    monitor: Option<Monitor>,
}

impl<C> MakeSendRequestService<C> {
    fn new(
        connector: C,
        executor: SharedExec,
        settings: Builder<SharedExec>,
        monitor: Option<Monitor>,
    ) -> Self {
        Self {
            connector,
            executor,
            settings,
            monitor,
        }
    }
}

impl<C> tower::Service<Uri> for MakeSendRequestService<C>
where
    C: Service<Uri> + Send + 'static,
    C::Error: Into<crate::BoxError> + Send,
    C::Future: Send,
    C::Response: rt::Read + rt::Write + Unpin + Send,
{
    type Response = SendRequest;
    type Error = crate::BoxError;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        let result = self.connector.poll_ready(cx);
        if matches!(&result, Poll::Ready(Err(_))) {
            if let Some(monitor) = &self.monitor {
                monitor.failed();
            }
        }
        result.map_err(Into::into)
    }

    fn call(&mut self, req: Uri) -> Self::Future {
        let fut = self.connector.call(req);
        let builder = self.settings.clone();
        let executor = self.executor.clone();
        let observation = self.monitor.as_ref().map(Monitor::begin);

        Box::pin(async move {
            let io = match fut.await {
                Ok(io) => io,
                Err(error) => {
                    if let Some(observation) = &observation {
                        observation.publish(ConnectivityState::TransientFailure);
                    }
                    return Err(error.into());
                }
            };
            let (send_request, conn) = match builder.handshake(io).await {
                Ok(connection) => connection,
                Err(error) => {
                    if let Some(observation) = &observation {
                        observation.publish(ConnectivityState::TransientFailure);
                    }
                    return Err(error.into());
                }
            };
            if let Some(observation) = &observation {
                observation.publish(ConnectivityState::Ready);
            }
            let driver_observation = DriverObservation(observation.clone());

            Executor::<BoxFuture<'static, ()>>::execute(
                &executor,
                Box::pin(async move {
                    if let Err(e) = conn.await {
                        tracing::debug!("connection task error: {:?}", e);
                    }
                    drop(driver_observation);
                }) as _,
            );

            Ok(SendRequest {
                inner: send_request,
                observation,
            })
        })
    }
}
