//! Local gRPC transports retain localhost authority and bypass HTTP proxies.
use hyper_util::rt::TokioIo;
use std::io;
use tonic::transport::{Channel, Endpoint};

#[cfg(unix)]
async fn open(path: String) -> io::Result<tokio::net::UnixStream> {
    tokio::net::UnixStream::connect(path).await
}

#[cfg(windows)]
async fn open(path: String) -> io::Result<tokio::net::windows::named_pipe::NamedPipeClient> {
    use tokio::net::windows::named_pipe::ClientOptions;
    // CreateFile also opens ordinary files. Accept only the named-pipe namespace.
    let path = path.replace('/', "\\");
    let mut parts = path.strip_prefix("\\\\").unwrap_or("").splitn(3, '\\');
    let server = parts.next().unwrap_or("");
    let namespace = parts.next().unwrap_or("");
    let name = parts.next().unwrap_or("");
    if server.is_empty() || !namespace.eq_ignore_ascii_case("pipe") || name.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "gRPC unix targets on Windows require a named-pipe path.",
        ));
    }
    loop {
        match ClientOptions::new().open(&path) {
            Ok(pipe) => return Ok(pipe),
            // ERROR_PIPE_BUSY. Yield so Endpoint's connect timeout/cancellation
            // remains effective while a server instance is occupied.
            Err(error) if error.raw_os_error() == Some(231) => {
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
            Err(error) => return Err(error),
        }
    }
}

pub(crate) async fn connect(endpoint: Endpoint, path: &str) -> Result<Channel, String> {
    let path = path.to_owned();
    endpoint
        .connect_with_connector(tower::service_fn(move |_| {
            let path = path.clone();
            async move { open(path).await.map(TokioIo::new) }
        }))
        .await
        .map_err(|error| {
            format!(
                "Could not connect to gRPC socket: {}",
                super::lb_transport::describe(&error)
            )
        })
}
