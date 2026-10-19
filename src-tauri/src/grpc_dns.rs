//! grpc-js system/alternative DNS paths, preserving the endpoint's authority.
use super::lb_transport::{Channel, PickFirst, Pool, SubchannelCache};
use super::{
    proxy,
    service_config::{PolicyKind, ResolutionConfig},
};
use hickory_resolver::{
    config::{LookupIpStrategy, NameServerConfig, ResolveHosts, ResolverConfig},
    net::runtime::TokioRuntimeProvider,
    TokioResolver,
};
use reqwest::Url;
use std::{collections::HashSet, io, net::SocketAddr, sync::Arc, time::Duration};
use tonic::transport::Endpoint;

// A logical connection owns OS lookups even when its async waiter is dropped.
// Closing admission and taking the handles use the same lock as submission.
#[derive(Clone, Default)]
pub(crate) struct LookupWork(Arc<std::sync::Mutex<LookupJobs>>);
#[derive(Default)]
struct LookupJobs {
    closed: bool,
    jobs: Vec<tokio::task::JoinHandle<()>>,
}
impl LookupWork {
    pub(super) async fn resolve(&self, name: String, port: u16) -> io::Result<Vec<SocketAddr>> {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        {
            let mut work = self.0.lock().unwrap_or_else(|error| error.into_inner());
            if work.closed {
                return Err(io::Error::other("gRPC DNS owner closed."));
            }
            work.jobs.retain(|job| !job.is_finished());
            work.jobs.push(tokio::task::spawn_blocking(move || {
                use std::net::ToSocketAddrs;
                let result = (name.as_str(), port)
                    .to_socket_addrs()
                    .map(Iterator::collect);
                let _ = sender.send(result);
            }));
        }
        receiver
            .await
            .map_err(|_| io::Error::other("gRPC DNS resolver stopped unexpectedly."))?
    }

    pub(crate) async fn drain(&self) {
        let jobs = {
            let mut work = self.0.lock().unwrap_or_else(|error| error.into_inner());
            work.closed = true;
            std::mem::take(&mut work.jobs)
        };
        for job in &jobs {
            job.abort();
        }
        for job in jobs {
            let _ = job.await;
        }
    }
}

struct LookupCache {
    answer: Option<(
        tokio::time::Instant,
        Result<Vec<SocketAddr>, Arc<io::Error>>,
    )>,
    retry_at: Option<tokio::time::Instant>,
    next_delay_ms: f64,
}
impl Default for LookupCache {
    fn default() -> Self {
        Self {
            answer: None,
            retry_at: None,
            next_delay_ms: 1000.0,
        }
    }
}

fn enabled() -> bool {
    std::env::var("GRPC_NODE_USE_ALTERNATIVE_RESOLVER").is_ok_and(|value| value == "true")
}

fn alternative_resolver(server: Option<SocketAddr>) -> Result<TokioResolver, String> {
    let mut builder = if let Some(server) = server {
        let mut config = NameServerConfig::udp_and_tcp(server.ip());
        for connection in &mut config.connections {
            connection.port = server.port();
        }
        TokioResolver::builder_with_config(
            ResolverConfig::from_name_servers(vec![config]),
            TokioRuntimeProvider::default(),
        )
    } else {
        TokioResolver::builder_tokio().map_err(|_| "Could not read system gRPC DNS servers.")?
    };
    let options = builder.options_mut();
    options.ip_strategy = LookupIpStrategy::Ipv4AndIpv6;
    options.use_hosts_file = ResolveHosts::Never;
    // The shared successful-lookup cache owns the minimum resolution interval.
    options.cache_size = 0;
    builder
        .build()
        .map_err(|_| "Invalid gRPC DNS configuration.".into())
}

pub(crate) async fn connect(
    endpoint: Endpoint,
    target: &Url,
    server: Option<SocketAddr>,
    timeout: Option<Duration>,
    resolution_config: &ResolutionConfig,
    lookup_work: &LookupWork,
    target_key: &str,
) -> Result<Channel, String> {
    let selected = proxy::select(target, |key| std::env::var(key).ok())?;
    let host = target
        .host_str()
        .ok_or("Invalid gRPC DNS hostname.")?
        .trim_start_matches('[')
        .trim_end_matches(']');
    // CONNECT delegates origin resolution to the proxy; numeric targets need no DNS.
    if selected.is_some() || host.parse::<std::net::IpAddr>().is_ok() {
        resolution_config.clear();
        return proxy::connect_selected(endpoint, target, selected, lookup_work)
            .await
            .map(Into::into);
    }
    let operation = async {
        // Like grpc-js dns.lookup({all:true}), the default path uses the OS
        // resolver (including hosts/search policy), without constructing Hickory.
        // A URI's custom DNS server is used only with the alternative resolver.
        let alternative = enabled();
        let resolver = alternative
            .then(|| alternative_resolver(server))
            .transpose()?
            .map(Arc::new);
        // TXT resolution is independent of OS address lookup. Configuration
        // failure here must not turn a successful address lookup into an error.
        let txt_resolver = resolver
            .clone()
            .or_else(|| alternative_resolver(None).ok().map(Arc::new));
        let resolution_config = resolution_config.clone();
        let retry_target = super::endpoint_url::channel_target(target_key);
        let resolution_target = format!(
            "{retry_target}|{alternative}|{:?}",
            if alternative { server } else { None }
        );
        let name = host.to_owned();
        let port = target.port_or_known_default().unwrap_or(443);
        let cache = Arc::new(tokio::sync::Mutex::new(LookupCache::default()));
        let completed = Arc::new(std::sync::atomic::AtomicU64::new(0));
        let policy = resolution_config.clone();
        let canonical = Arc::new(std::sync::RwLock::new(None::<(u64, u64, Vec<SocketAddr>)>));
        let published = canonical.clone();
        let lookup_work = lookup_work.clone();
        let resolve: proxy::AddressResolver = Arc::new(move || {
            let resolver = resolver.clone();
            let name = name.clone();
            let cache = cache.clone();
            let completed = completed.clone();
            let txt_resolver = txt_resolver.clone();
            let resolution_config = resolution_config.clone();
            let resolution_target = resolution_target.clone();
            let retry_target = retry_target.clone();
            let published = published.clone();
            let lookup_work = lookup_work.clone();
            Box::pin(async move {
                use std::sync::atomic::Ordering;
                let observed = completed.load(Ordering::Acquire);
                let mut cached = cache.lock().await;
                if let Some((at, result)) = cached.answer.as_ref() {
                    // Waiters share the lookup they overlapped, including its
                    // failure. Later independent requests may retry failures;
                    // only successful answers have the minimum-interval cache.
                    if completed.load(Ordering::Acquire) != observed
                        || (result.is_ok() && at.elapsed() < Duration::from_secs(30))
                    {
                        return result
                            .clone()
                            .map_err(|error| io::Error::new(error.kind(), error.to_string()));
                    }
                }
                if let Some(due) = cached.retry_at {
                    tokio::time::sleep_until(due).await;
                }
                let started = tokio::time::Instant::now();
                // Start the backoff clock with the DNS attempt, not its error.
                // A slow failed lookup has already spent this interval.
                let retry_at = started + Duration::from_millis(cached.next_delay_ms.trunc() as u64);
                let sample = (uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1)) as f64
                    / (1_u64 << 53) as f64;
                cached.next_delay_ms =
                    (cached.next_delay_ms * 1.6).min(120_000.0) * (0.8 + sample * 0.4);
                let mut attempt_generation = None;
                let result = async {
                    let absolute = if name.ends_with('.') {
                        name.clone()
                    } else {
                        format!("{name}.")
                    };
                    // OS address resolution remains usable without a TXT
                    // resolver, but still needs a fresh target/config owner.
                    resolution_config.refresh(
                        txt_resolver,
                        absolute,
                        resolution_target,
                        retry_target,
                    );
                    let generation = resolution_config.generation();
                    attempt_generation = Some(generation);
                    resolution_config.lookup_started(generation, started);
                    let mut addresses: Vec<SocketAddr> = if let Some(resolver) = resolver {
                        let absolute = if name.ends_with('.') {
                            name
                        } else {
                            format!("{name}.")
                        };
                        resolver
                            .lookup_ip(absolute)
                            .await
                            .map_err(|error| {
                                io::Error::other(format!(
                                    "gRPC DNS name resolution failed: {error}"
                                ))
                            })?
                            .iter()
                            .map(|ip| SocketAddr::new(ip, port))
                            .collect()
                    } else {
                        lookup_work.resolve(name, port).await.map_err(|error| {
                            io::Error::new(
                                error.kind(),
                                format!("gRPC DNS name resolution failed: {error}"),
                            )
                        })?
                    };
                    // Retain OS/resolver ordering and scope IDs; never truncate the
                    // complete list before the transport interleaves address families.
                    let mut seen = HashSet::new();
                    addresses.retain(|address| seen.insert(*address));
                    if addresses.is_empty() {
                        return Err(io::Error::other("gRPC DNS returned no addresses."));
                    }
                    let raw = addresses.clone();
                    let address_revision = resolution_config
                        .publish_addresses(generation, started, raw.clone())
                        .unwrap_or(0);
                    *published.write().unwrap_or_else(|error| error.into_inner()) =
                        Some((generation, address_revision, raw));
                    // Address lookup success alone is not resolver acceptance.
                    // Without a previous selector, invalid TXT must enter the
                    // failure/backoff route instead of dialing a default child.
                    if let Some(error) = resolution_config.resolution_error(generation) {
                        return Err(io::Error::other(error));
                    }
                    resolution_config.shuffle_addresses(&mut addresses);
                    Ok(addresses)
                }
                .await;
                if result.is_ok() {
                    cached.retry_at = None;
                    cached.next_delay_ms = 1000.0;
                } else {
                    cached.retry_at = Some(retry_at);
                    // DNS errors stop the successful-resolution minimum timer.
                    // Retain the last address publication for the existing LB.
                    if let Some(generation) = attempt_generation {
                        resolution_config.lookup_failed(generation, started, retry_at);
                    }
                }
                cached.answer = Some((
                    started,
                    result
                        .as_ref()
                        .map(Clone::clone)
                        .map_err(|error: &io::Error| {
                            Arc::new(io::Error::new(error.kind(), error.to_string()))
                        }),
                ));
                completed.fetch_add(1, Ordering::Release);
                result
            })
        });
        let addresses = match resolve().await {
            Ok(addresses) => addresses,
            Err(error) => {
                // Keep the failed logical channel alive. Its owner retries DNS
                // using the resolver backoff and adopts a later publication.
                let generation = policy.generation();
                let kind = policy.policy_kind();
                let revision = policy.policy_revision();
                return Ok(super::lb_transport::route_policy(
                    Channel::Unavailable(error.to_string().into()),
                    kind,
                    policy,
                    SubchannelCache::new(endpoint, target_key),
                    Vec::new(),
                    resolve,
                    generation,
                    0,
                    revision,
                ));
            }
        };
        let (generation, address_revision, raw) = canonical
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
            .ok_or("gRPC DNS result was not published.")?;
        let kind = policy.policy_kind();
        let subchannels = SubchannelCache::new(endpoint.clone(), target_key);
        let initial_policy_revision = policy.policy_revision();
        let initial = if matches!(
            kind,
            PolicyKind::WeightedRoundRobin | PolicyKind::OutlierDetection
        ) {
            Channel::RoundRobin(
                Pool::pending_policy(
                    subchannels.clone(),
                    &raw,
                    policy.pool_config().unwrap_or_default(),
                )
                .decided()
                .await,
            )
        } else if kind == PolicyKind::RoundRobin {
            // Legacy starts the RPC without waitForReady. A failed initial
            // policy must reach the logical owner/status path instead of
            // withholding that owner until a connection eventually succeeds.
            Channel::RoundRobin(Pool::pending(subchannels.clone(), &raw).decided().await)
        } else {
            Channel::PickFirst(
                PickFirst::pending(subchannels.clone(), addresses)
                    .decided()
                    .await,
            )
        };
        Ok(super::lb_transport::route_policy(
            initial,
            kind,
            policy,
            subchannels,
            raw,
            resolve,
            generation,
            address_revision,
            initial_policy_revision,
        ))
    };
    match timeout {
        Some(timeout) => tokio::time::timeout(timeout, operation)
            .await
            .map_err(|_| "gRPC DNS connection timed out.".to_owned())?,
        None => operation.await,
    }
}
