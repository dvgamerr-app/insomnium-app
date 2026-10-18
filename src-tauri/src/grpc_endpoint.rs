pub(crate) struct Target {
    pub url: reqwest::Url,
    pub addresses: Vec<reqwest::Url>,
    pub socket_path: Option<String>,
}

pub(crate) fn parse(raw: &str) -> Result<Target, String> {
    let lower = raw.to_ascii_lowercase();
    let secure = lower.starts_with("grpcs://");
    let mut address = if secure {
        &raw[8..]
    } else if lower.starts_with("grpc://") {
        &raw[7..]
    } else {
        raw
    };
    if address.to_ascii_lowercase().starts_with("unix:") {
        let original = address[5..].to_lowercase();
        let mut path = original.clone();
        if let Some(rest) = original.strip_prefix("//") {
            if let Some((authority, tail)) = rest.split_once('/') {
                if !tail.is_empty() {
                    path = if authority.is_empty() {
                        format!("/{tail}")
                    } else {
                        tail.to_owned()
                    };
                }
            }
        }
        if path.is_empty() || path.contains('\0') {
            return Err("Enter a gRPC socket path without NUL.".into());
        }
        return Ok(Target {
            url: reqwest::Url::parse(if secure {
                "https://localhost/"
            } else {
                "http://localhost/"
            })
            .map_err(|_| "Invalid gRPC socket authority.")?,
            addresses: Vec::new(),
            socket_path: Some(path),
        });
    }
    let dns = address.to_ascii_lowercase().starts_with("dns:");
    if dns {
        let mut path = &address[4..];
        if let Some(rest) = path.strip_prefix("//") {
            let (authority, host) = rest.split_once('/').ok_or("Invalid gRPC DNS target.")?;
            if !authority.is_empty() {
                return Err("Custom gRPC DNS servers are not supported yet.".into());
            }
            path = host;
        }
        if path.is_empty() || path.contains(['/', '?', '#', '@', '\\']) {
            return Err("Enter a gRPC DNS host and port without a path or credentials.".into());
        }
        let tail = if path.starts_with('[') {
            path.find(']').map(|end| &path[end + 1..]).unwrap_or(path)
        } else if path.matches(':').count() == 1 {
            &path[path.find(':').unwrap()..]
        } else {
            ""
        };
        if !tail.is_empty()
            && !tail
                .strip_prefix(':')
                .is_some_and(|port| !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()))
        {
            return Err("Invalid gRPC DNS target port.".into());
        }
        address = path;
    }
    let family = if dns {
        None
    } else if address.to_ascii_lowercase().starts_with("ipv4:") {
        Some(false)
    } else if address.to_ascii_lowercase().starts_with("ipv6:") {
        Some(true)
    } else {
        None
    };
    if let Some(ipv6) = family {
        let mut path = &address[5..];
        if let Some(rest) = path.strip_prefix("//") {
            path = rest.split_once('/').ok_or("Invalid gRPC IP target.")?.1;
        }
        let entries: Vec<_> = path.split(',').collect();
        if entries.len() > 256 {
            return Err("gRPC targets exceed 256 addresses.".into());
        }
        let mut addresses = Vec::with_capacity(entries.len());
        for entry in entries {
            let (host, port) = if let Some(rest) = entry.strip_prefix('[') {
                let (host, tail) = rest.split_once(']').ok_or("Invalid gRPC IP target.")?;
                let port = if tail.is_empty() {
                    None
                } else {
                    Some(tail.strip_prefix(':').ok_or("Invalid gRPC IP target.")?)
                };
                if !ipv6 {
                    return Err("An ipv4 target requires IPv4 addresses.".into());
                }
                (host, port)
            } else if entry.matches(':').count() == 1 {
                let (host, port) = entry.split_once(':').unwrap();
                (host, Some(port))
            } else {
                (entry, None)
            };
            let ip: std::net::IpAddr = host.parse().map_err(|_| "Invalid gRPC IP target.")?;
            if ip.is_ipv6() != ipv6 {
                return Err("Invalid gRPC IP target address family.".into());
            }
            let port = match port {
                Some(port) if !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()) => port
                    .parse::<u16>()
                    .map_err(|_| "Invalid gRPC IP target port.")?,
                None => 443,
                _ => return Err("Invalid gRPC IP target port.".into()),
            };
            let authority = std::net::SocketAddr::new(ip, port);
            addresses.push(
                reqwest::Url::parse(&format!(
                    "{}://{authority}/",
                    if secure { "https" } else { "http" }
                ))
                .map_err(|_| "Invalid gRPC IP target.")?,
            );
        }
        return Ok(Target {
            url: addresses[0].clone(),
            addresses,
            socket_path: None,
        });
    }
    let grpc_style = dns
        || !raw.contains("://")
        || lower.starts_with("grpc://")
        || lower.starts_with("grpcs://");
    let host = if grpc_style
        && !address.starts_with('[')
        && address.matches(':').count() > 1
        && !address.contains(['/', '?', '#', '@'])
    {
        format!("[{address}]")
    } else {
        address.to_owned()
    };
    let normalized = if !grpc_style {
        raw.to_owned()
    } else {
        format!("{}://{host}", if secure { "https" } else { "http" })
    };
    let mut url = reqwest::Url::parse(&normalized).map_err(|_| "Invalid gRPC endpoint.")?;
    if grpc_style {
        // A non-special scheme retains explicit :80 instead of normalizing it away.
        let target = format!("grpc://{host}");
        let target = reqwest::Url::parse(&target).map_err(|_| "Invalid gRPC endpoint.")?;
        if target.port().is_none() {
            url.set_port(Some(443))
                .map_err(|_| "Invalid gRPC endpoint.")?;
        }
    }
    Ok(Target {
        url,
        addresses: Vec::new(),
        socket_path: None,
    })
}
