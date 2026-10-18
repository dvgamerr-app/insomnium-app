//! grpc-js's opt-in c-ares-style DNS path, preserving the endpoint's authority.
use super::proxy;
use hickory_resolver::{
    config::{LookupIpStrategy, NameServerConfig, ResolveHosts, ResolverConfig},
    net::runtime::TokioRuntimeProvider,
    TokioResolver,
};
use reqwest::Url;
use std::{collections::HashSet, io, net::SocketAddr, sync::Arc, time::Duration};
use tonic::transport::{Channel, Endpoint};

pub(crate) fn enabled() -> bool {
    std::env::var("GRPC_NODE_USE_ALTERNATIVE_RESOLVER").is_ok_and(|value| value == "true")
}

pub(crate) async fn connect(
    endpoint: Endpoint,
    target: &Url,
    server: Option<SocketAddr>,
    timeout: Option<Duration>,
) -> Result<Channel, String> {
    let selected = proxy::select(target, |key| std::env::var(key).ok())?;
    let host = target
        .host_str()
        .ok_or("Invalid gRPC DNS hostname.")?
        .trim_start_matches('[')
        .trim_end_matches(']');
    // CONNECT delegates origin resolution to the proxy; numeric targets need no DNS.
    if selected.is_some() || host.parse::<std::net::IpAddr>().is_ok() {
        return proxy::connect_selected(endpoint, target, selected).await;
    }
    let operation = async {
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
        // grpc-js's successful lookup cache uses a 30-second minimum interval,
        // independent of DNS TTL. Keep that policy outside Hickory's TTL cache.
        options.cache_size = 0;
        let resolver = Arc::new(
            builder
                .build()
                .map_err(|_| "Invalid gRPC DNS configuration.")?,
        );
        let name = if host.ends_with('.') {
            host.to_owned()
        } else {
            format!("{host}.")
        };
        let port = target.port_or_known_default().unwrap_or(443);
        let cache = Arc::new(tokio::sync::Mutex::new(
            None::<(tokio::time::Instant, Vec<SocketAddr>)>,
        ));
        let resolve: proxy::AddressResolver = Arc::new(move || {
            let resolver = resolver.clone();
            let name = name.clone();
            let cache = cache.clone();
            Box::pin(async move {
                let mut cached = cache.lock().await;
                if let Some((at, addresses)) = cached.as_ref() {
                    if at.elapsed() < Duration::from_secs(30) {
                        return Ok(addresses.clone());
                    }
                }
                let started = tokio::time::Instant::now();
                let result = resolver
                    .lookup_ip(name)
                    .await
                    .map_err(|_| io::Error::other("gRPC DNS name resolution failed."))?;
                let mut addresses = Vec::new();
                let mut seen = HashSet::new();
                for ip in result.iter() {
                    let address = SocketAddr::new(ip, port);
                    if seen.insert(address) {
                        addresses.push(address);
                    }
                }
                if addresses.is_empty() {
                    return Err(io::Error::other("gRPC DNS returned no addresses."));
                }
                *cached = Some((started, addresses.clone()));
                Ok(addresses)
            })
        });
        let addresses = resolve().await.map_err(|error| error.to_string())?;
        proxy::connect_resolved(endpoint, &addresses, resolve, timeout).await
    };
    match timeout {
        Some(timeout) => tokio::time::timeout(timeout, operation)
            .await
            .map_err(|_| "gRPC DNS connection timed out.".to_owned())?,
        None => operation.await,
    }
}
