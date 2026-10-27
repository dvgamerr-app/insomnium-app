//! Serialize producer admission with replay accounting, before body polling.
use super::replay::Input;
use prost::Message;
use std::sync::{Arc, Mutex, Weak};
use tokio::sync::{mpsc, watch};

type Binding<M> = Arc<Mutex<Option<Weak<Input<M>>>>>;
pub(crate) struct Receiver<M> {
    pub(super) inner: mpsc::Receiver<M>,
    pub(super) binding: Binding<M>,
}
pub(crate) struct Sender<M> {
    inner: mpsc::Sender<M>,
    binding: Binding<M>,
}
impl<M> Clone for Sender<M> {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
            binding: self.binding.clone(),
        }
    }
}
impl<M> From<mpsc::Receiver<M>> for Receiver<M> {
    fn from(inner: mpsc::Receiver<M>) -> Self {
        Self {
            inner,
            binding: Arc::new(Mutex::new(None)),
        }
    }
}
pub(crate) fn channel<M>(capacity: usize) -> (Sender<M>, Receiver<M>) {
    let (sender, receiver) = mpsc::channel(capacity);
    let binding = Arc::new(Mutex::new(None));
    (
        Sender {
            inner: sender,
            binding: binding.clone(),
        },
        Receiver {
            inner: receiver,
            binding,
        },
    )
}
pub(crate) struct Permit<M> {
    inner: mpsc::OwnedPermit<M>,
    binding: Binding<M>,
}
impl<M: Message + Clone> Sender<M> {
    pub(crate) async fn reserve_owned(self) -> Result<Permit<M>, mpsc::error::SendError<()>> {
        Ok(Permit {
            inner: self.inner.reserve_owned().await?,
            binding: self.binding,
        })
    }
    /// A call can end while its transport still retains the body receiver.
    /// Cancellation must release queued producers without waiting for that drop.
    pub(crate) async fn send_until_cancelled(
        &self,
        message: M,
        cancellation: &mut watch::Receiver<bool>,
    ) -> Result<(), mpsc::error::SendError<()>> {
        if *cancellation.borrow() || cancellation.has_changed().is_err() {
            return Err(mpsc::error::SendError(()));
        }
        let permit = tokio::select! {
            biased;
            _ = cancellation.changed() => return Err(mpsc::error::SendError(())),
            result = self.clone().reserve_owned() => result?,
        };
        if *cancellation.borrow() || cancellation.has_changed().is_err() {
            return Err(mpsc::error::SendError(()));
        }
        permit.send(message);
        Ok(())
    }
    pub(crate) async fn send(&self, message: M) -> Result<(), mpsc::error::SendError<()>> {
        self.clone().reserve_owned().await?.send(message);
        Ok(())
    }
}
impl<M: Message + Clone> Permit<M> {
    pub(crate) fn send(self, message: M) {
        // Binding serializes startup with producers that reserved before setup.
        let binding = self
            .binding
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(input) = binding.as_ref().and_then(Weak::upgrade) {
            input.enqueue(self.inner, message);
        } else {
            self.inner.send(message);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    fn message(seconds: i64) -> prost_types::Duration {
        prost_types::Duration { seconds, nanos: 0 }
    }
    #[tokio::test]
    async fn call_cancellation_releases_admission_with_retained_receiver() {
        // Old command path: cancellation cannot wake send while the live body
        // receiver keeps a full queue. Keep that control instead of dropping it.
        let (sender, mut receiver) = channel(1);
        sender.send(message(1)).await.unwrap();
        let (cancel, mut cancelled) = watch::channel(false);
        let mut old = Box::pin(sender.send(message(2)));
        assert!(futures_util::poll!(&mut old).is_pending());
        cancel.send(true).unwrap();
        assert!(tokio::time::timeout(Duration::from_millis(20), &mut old)
            .await
            .is_err());
        drop(old);
        assert_eq!(receiver.inner.recv().await.unwrap().seconds, 1);
        assert!(receiver.inner.try_recv().is_err());
        // An already-cancelled call must not consume an available permit.
        assert!(sender
            .send_until_cancelled(message(3), &mut cancelled)
            .await
            .is_err());
        assert!(receiver.inner.try_recv().is_err());
        for close_owner in [false, true] {
            let (sender, mut receiver) = channel(1);
            sender.send(message(10)).await.unwrap();
            let (cancel, mut cancelled) = watch::channel(false);
            let mut pending = Box::pin(sender.send_until_cancelled(message(20), &mut cancelled));
            assert!(futures_util::poll!(&mut pending).is_pending());
            if close_owner {
                drop(cancel);
            } else {
                cancel.send(true).unwrap();
            }
            assert!(tokio::time::timeout(Duration::from_secs(1), &mut pending)
                .await
                .unwrap()
                .is_err());
            drop(pending);
            assert_eq!(receiver.inner.recv().await.unwrap().seconds, 10);
            assert!(
                receiver.inner.try_recv().is_err(),
                "Cancelled message must never enter the retained queue"
            );
        }
        let (sender, mut receiver) = channel(1);
        let (_cancel, mut cancelled) = watch::channel(false);
        sender
            .send_until_cancelled(message(30), &mut cancelled)
            .await
            .unwrap();
        assert_eq!(receiver.inner.recv().await.unwrap().seconds, 30);
        drop(receiver);
        assert!(sender
            .send_until_cancelled(message(40), &mut cancelled)
            .await
            .is_err());
        println!("Old send remains pending after call cancellation; cancel/owner-close wake new admission with receiver retained; no cancelled enqueue; healthy/closed-receiver controls pass");
    }
}
