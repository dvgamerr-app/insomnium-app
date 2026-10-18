use std::{future::Future, time::Duration};

pub(crate) fn validate(total: Option<u64>, connect: Option<u64>) -> Result<(), String> {
    if [total, connect]
        .into_iter()
        .flatten()
        .any(|value| value > 3_600_000)
    {
        return Err("Request and connection timeouts must be at most 3,600,000 ms".into());
    }
    Ok(())
}

pub(crate) fn duration(milliseconds: u64) -> Option<Duration> {
    (milliseconds != 0).then(|| Duration::from_millis(milliseconds))
}

pub(crate) fn selected(value: Option<u64>, legacy: u64) -> Option<Duration> {
    duration(value.unwrap_or(legacy.clamp(1, 3_600_000)))
}

pub(crate) async fn run<T>(
    timeout: Option<Duration>,
    operation: impl Future<Output = Result<T, String>>,
    message: &str,
) -> Result<T, String> {
    match timeout {
        Some(timeout) => tokio::time::timeout(timeout, operation)
            .await
            .unwrap_or_else(|_| Err(message.into())),
        None => operation.await,
    }
}
