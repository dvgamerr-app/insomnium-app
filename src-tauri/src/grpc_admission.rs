//! Serialize producer admission with replay accounting, before body polling.
use super::replay::Input;
use prost::Message;
use std::sync::{Arc, Mutex, Weak};
use tokio::sync::mpsc;

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
