//! Select call policy on resolver/config readiness, independently of transport capacity.
use super::{channel, retry, service_config, Channel, Connection};
use tokio::time::Instant;

#[derive(Debug)]
pub(crate) enum Error {
    Configuration(String),
    Selection(String),
    Transport(String),
    Deadline,
}
impl From<String> for Error {
    fn from(message: String) -> Self {
        Self::Configuration(message)
    }
}
impl From<&str> for Error {
    fn from(message: &str) -> Self {
        Self::Configuration(message.into())
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Configuration(message) | Self::Selection(message) | Self::Transport(message) => {
                f.write_str(message)
            }
            Self::Deadline => f.write_str("gRPC deadline exceeded."),
        }
    }
}
impl Error {
    pub(super) fn status(self) -> Result<tonic::Status, String> {
        match self {
            Self::Configuration(message) => Err(message),
            Self::Selection(message) | Self::Transport(message) => {
                Ok(tonic::Status::unavailable(message))
            }
            Self::Deadline => Ok(tonic::Status::deadline_exceeded("gRPC deadline exceeded.")),
        }
    }
}
pub(super) struct Prepared {
    pub(super) channel: Channel,
    pub(super) session: retry::Session,
    pub(super) budget: service_config::CallDeadline,
}
fn select(
    config: &Connection,
    service: &str,
    method: &str,
    previous: Option<Instant>,
) -> Result<(retry::Session, service_config::CallDeadline), Error> {
    let policy = config
        .resolution_config
        .method(service, method)
        .map_err(Error::Selection)?;
    let budget = policy.deadline(previous)?;
    let session = policy.retry()?;
    Ok((session, budget))
}
pub(super) async fn connect_with(
    config: &Connection,
    service: &str,
    method: &str,
    previous: Option<Instant>,
    mut on_selected: impl FnMut(),
) -> Result<Prepared, Error> {
    let mut updates = config.resolution_config.policy_updates();
    let mut selected: Option<(retry::Session, service_config::CallDeadline)> = None;
    let connection = channel(config);
    tokio::pin!(connection);
    loop {
        let expires = match &selected {
            Some((_, budget)) => budget.timer,
            None => previous,
        };
        tokio::select! {
            biased;
            _ = async {
                match expires {
                    Some(deadline) => tokio::time::sleep_until(deadline).await,
                    None => std::future::pending::<()>().await,
                }
            } => return Err(Error::Deadline),
            result = &mut connection => {
                let channel = result?;
                // Static/proxy/socket paths have no DNS config publication.
                let (session, budget) = match selected {
                    Some(selected) => selected,
                    None => {
                        let selected = select(config, service, method, previous)?;
                        on_selected();
                        selected
                    },
                };
                return Ok(Prepared { channel, session, budget });
            }
            // Poll connection setup first so a changed proxy/static route can
            // clear a previously cached DNS selector before it is consumed.
            result = async {
                if selected.is_none() && config.resolution_config.config_available(&config.url) {
                    Ok(())
                } else {
                    updates.changed().await
                }
            } => {
                result.map_err(|_| Error::Selection("gRPC service-config state unavailable.".into()))?;
                if selected.is_none() && config.resolution_config.config_available(&config.url) {
                    selected = Some(select(config, service, method, previous)?);
                    on_selected();
                }
            }
        }
    }
}
