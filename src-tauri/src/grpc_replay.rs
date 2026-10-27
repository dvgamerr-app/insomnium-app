//! Owned replay storage with independent attempt cursors and commitment.
use futures_util::Stream;
use prost::Message;
use std::{
    collections::BTreeMap,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll, Waker},
};
use tokio::sync::mpsc;

const PER_CALL: usize = 1 << 20;
const PER_CHANNEL: usize = 1 << 24;

struct Entry<M> {
    message: M,
    bytes: usize,
}
struct Cursor {
    next: u64,
    wake: Option<Waker>,
}
struct State<M> {
    receiver: mpsc::Receiver<M>,
    cache: BTreeMap<u64, Entry<M>>,
    next: u64,
    cursors: BTreeMap<u64, Cursor>,
    bytes: usize,
    generation: u64,
    winner: Option<u64>,
    committed: bool,
    cancelled: bool,
    ended: bool,
}
pub(crate) struct Input<M> {
    state: Mutex<State<M>>,
    budget: Arc<Mutex<usize>>,
    pub(super) changes: tokio::sync::Notify,
}
pub(super) struct Guard<M>(pub(super) Arc<Input<M>>);
pub(super) struct Attempt<M> {
    input: Arc<Input<M>>,
    generation: u64,
}

impl<M> Drop for Guard<M> {
    fn drop(&mut self) {
        self.0.cancel();
    }
}
impl<M> Drop for Input<M> {
    fn drop(&mut self) {
        let state = self
            .state
            .get_mut()
            .unwrap_or_else(|error| error.into_inner());
        let mut budget = self
            .budget
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *budget = budget.saturating_sub(state.bytes);
    }
}
impl<M> Input<M> {
    pub(super) fn new(
        receiver: super::admission::Receiver<M>,
        budget: Arc<Mutex<usize>>,
        replay: bool,
    ) -> Guard<M> {
        let mut binding = receiver
            .binding
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let input = Arc::new(Self {
            state: Mutex::new(State {
                receiver: receiver.inner,
                cache: BTreeMap::new(),
                next: 0,
                cursors: BTreeMap::new(),
                bytes: 0,
                generation: 0,
                winner: None,
                committed: !replay,
                cancelled: false,
                ended: false,
            }),
            budget,
            changes: tokio::sync::Notify::new(),
        });
        *binding = Some(Arc::downgrade(&input));
        Guard(input)
    }
    fn release(&self, state: &mut State<M>, bytes: usize) {
        state.bytes = state.bytes.saturating_sub(bytes);
        let mut budget = self
            .budget
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *budget = budget.saturating_sub(bytes);
    }
    fn wake(state: &mut State<M>) {
        for cursor in state.cursors.values_mut() {
            if let Some(wake) = cursor.wake.take() {
                wake.wake();
            }
        }
    }
    fn trim(&self, state: &mut State<M>) {
        let Some(next) = state
            .winner
            .and_then(|id| state.cursors.get(&id))
            .map(|cursor| cursor.next)
        else {
            return;
        };
        while state
            .cache
            .first_key_value()
            .is_some_and(|(&start, _)| start < next)
        {
            let entry = state.cache.pop_first().unwrap().1;
            self.release(state, entry.bytes);
        }
    }
    pub(super) fn committed(&self) -> bool {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .committed
    }
    pub(super) fn winner(&self) -> Option<u64> {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .winner
    }
    pub(super) fn commit(&self, id: u64) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.cancelled || !state.cursors.contains_key(&id) || state.winner.is_some() {
            return;
        }
        state.committed = true;
        state.winner = Some(id);
        self.trim(&mut state);
        Self::wake(&mut state);
        self.changes.notify_one();
    }
    pub(super) fn claim_status(&self, id: u64) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(winner) = state.winner {
            return winner == id;
        }
        state.committed = true;
        state.winner = Some(id);
        Self::wake(&mut state);
        self.changes.notify_one();
        true
    }
    pub(super) fn cancel(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.cancelled = true;
        state.committed = true;
        let bytes = state.bytes;
        self.release(&mut state, bytes);
        state.cache = BTreeMap::new();
        Self::wake(&mut state);
        state.cursors.clear();
        state.receiver.close();
        while state.receiver.try_recv().is_ok() {}
    }
    pub(super) fn end_attempt(&self, id: u64) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        // Retained HTTP/2 bodies lose input ownership immediately on failure.
        if let Some(cursor) = state.cursors.remove(&id) {
            if let Some(wake) = cursor.wake {
                wake.wake();
            }
        }
    }
    pub(super) fn attempt(self: &Arc<Self>) -> Attempt<M> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.generation = state.generation.wrapping_add(1);
        let generation = state.generation;
        let next = state
            .cache
            .first_key_value()
            .map_or(state.next, |(&start, _)| start);
        state
            .cursors
            .insert(generation, Cursor { next, wake: None });
        if state.committed && state.winner.is_none() {
            state.winner = Some(generation);
        }
        Attempt {
            input: self.clone(),
            generation,
        }
    }
}
impl<M> Attempt<M> {
    pub(super) fn id(&self) -> u64 {
        self.generation
    }
}
impl<M: Message + Clone> Input<M> {
    pub(super) fn enqueue(&self, permit: mpsc::OwnedPermit<M>, message: M) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        permit.send(message);
        Self::wake(&mut state);
        if state.cancelled || state.committed {
            return;
        }
        let pending = state.receiver.len();
        for _ in 0..pending {
            let Ok(message) = state.receiver.try_recv() else {
                break;
            };
            self.stage(&mut state, message);
            if state.committed {
                break;
            }
        }
    }
    fn stage(&self, state: &mut State<M>, message: M) {
        // grpc-js buffers after identity framing: one flag plus four length
        // bytes. Empty protobuf payloads therefore still consume five bytes.
        let bytes = message.encoded_len().saturating_add(5);
        let mut total = self
            .budget
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let charged = if bytes > PER_CALL.saturating_sub(state.bytes)
            || bytes > PER_CHANNEL.saturating_sub(*total)
        {
            drop(total);
            state.committed = true;
            // First active attempt with the most delivered messages wins.
            // A failure between attempts disables further configured replay.
            state.winner = state
                .cursors
                .iter()
                .max_by(|(left_id, left), (right_id, right)| {
                    left.next
                        .cmp(&right.next)
                        .then_with(|| right_id.cmp(left_id))
                })
                .map(|(&id, _)| id);
            self.changes.notify_one();
            self.trim(state);
            0
        } else {
            *total += bytes;
            state.bytes += bytes;
            drop(total);
            bytes
        };
        state.cache.insert(
            state.next,
            Entry {
                message,
                bytes: charged,
            },
        );
        state.next += 1;
        Self::wake(state);
    }
    pub(super) fn stage_pending(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.committed || state.cancelled {
            return;
        }
        let pending = state.receiver.len();
        for _ in 0..pending {
            let Ok(message) = state.receiver.try_recv() else {
                break;
            };
            self.stage(&mut state, message);
            if state.committed {
                break;
            }
        }
    }
    pub(super) async fn backoff(&self, delay: std::time::Duration) {
        let timer = tokio::time::sleep(delay);
        tokio::pin!(timer);
        let input = futures_util::future::poll_fn(|cx| {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state.committed || state.cancelled {
                return Poll::Pending;
            }
            for _ in 0..32 {
                match state.receiver.poll_recv(cx) {
                    Poll::Ready(Some(message)) => {
                        self.stage(&mut state, message);
                        if state.committed {
                            return Poll::Pending;
                        }
                    }
                    Poll::Ready(None) | Poll::Pending => return Poll::Pending,
                }
            }
            cx.waker().wake_by_ref();
            Poll::<()>::Pending
        });
        tokio::pin!(input);
        tokio::select! { biased; _ = &mut input => {}, _ = &mut timer => {} }
        self.stage_pending();
    }
}
impl<M: Message + Clone> Stream for Attempt<M> {
    type Item = M;
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<M>> {
        let mut state = self
            .input
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        loop {
            if state.cancelled || state.winner.is_some_and(|winner| winner != self.generation) {
                return Poll::Ready(None);
            }
            let Some(cursor) = state.cursors.get_mut(&self.generation) else {
                return Poll::Ready(None);
            };
            cursor.wake = Some(cx.waker().clone());
            let next = cursor.next;
            if next < state.next {
                let Some(entry) = state.cache.get(&next) else {
                    return Poll::Ready(None);
                };
                let message = entry.message.clone();
                state.cursors.get_mut(&self.generation).unwrap().next += 1;
                if state.committed {
                    self.input.trim(&mut state);
                }
                return Poll::Ready(Some(message));
            }
            let message = match state.receiver.poll_recv(cx) {
                Poll::Ready(Some(message)) => message,
                Poll::Ready(None) => {
                    if !state.ended {
                        state.ended = true;
                        Input::<M>::wake(&mut state);
                    }
                    return Poll::Ready(None);
                }
                other => return other,
            };
            if state.committed {
                state.next += 1;
                state.cursors.get_mut(&self.generation).unwrap().next += 1;
                return Poll::Ready(Some(message));
            }
            self.input.stage(&mut state, message);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::StreamExt;

    #[derive(Clone, PartialEq, Message)]
    struct Blob {
        #[prost(bytes = "vec", tag = "1")]
        data: Vec<u8>,
    }
    fn boundary() -> Blob {
        let message = Blob {
            data: vec![42; PER_CALL - 9],
        };
        assert_eq!(message.encoded_len() + 5, PER_CALL);
        message
    }
    #[tokio::test]
    async fn replay_budget_counts_framing_and_releases_exactly() {
        let budget = Arc::new(Mutex::new(0));
        let (sender, receiver) = super::super::admission::channel(2);
        let guard = Input::new(receiver, budget.clone(), true);
        sender.send(boundary()).await.unwrap();
        assert!(!guard.0.committed());
        assert_eq!(
            *budget.lock().unwrap(),
            PER_CALL,
            "Replay includes the five-byte frame header"
        );
        sender.send(Blob::default()).await.unwrap();
        assert!(
            guard.0.committed(),
            "Even an empty protobuf adds five wire bytes"
        );
        drop(sender);
        let mut attempt = guard.0.attempt();
        assert_eq!(attempt.next().await.unwrap(), boundary());
        assert_eq!(attempt.next().await.unwrap(), Blob::default());
        assert!(attempt.next().await.is_none());
        assert_eq!(*budget.lock().unwrap(), 0);
        drop(attempt);
        drop(guard);

        let (sender, receiver) = super::super::admission::channel(2);
        let guard = Input::new(receiver, budget.clone(), true);
        sender.send(Blob::default()).await.unwrap();
        sender.send(Blob::default()).await.unwrap();
        drop(sender);
        assert_eq!(*budget.lock().unwrap(), 10);
        let mut first = guard.0.attempt();
        let mut second = guard.0.attempt();
        for _ in 0..2 {
            assert_eq!(first.next().await.unwrap(), Blob::default());
            assert_eq!(second.next().await.unwrap(), Blob::default());
        }
        assert!(first.next().await.is_none());
        assert!(second.next().await.is_none());
        assert_eq!(
            *budget.lock().unwrap(),
            10,
            "Uncommitted attempts retain replay storage"
        );
        drop(guard);
        assert_eq!(
            *budget.lock().unwrap(),
            0,
            "Cancellation releases once despite retained cursors"
        );
        drop(first);
        drop(second);

        let mut owners = Vec::new();
        for _ in 0..16 {
            let (sender, receiver) = super::super::admission::channel(1);
            let owner = Input::new(receiver, budget.clone(), true);
            sender.send(boundary()).await.unwrap();
            drop(sender);
            assert!(!owner.0.committed());
            owners.push(owner);
        }
        assert_eq!(*budget.lock().unwrap(), PER_CHANNEL);
        let (sender, receiver) = super::super::admission::channel(1);
        let overflow = Input::new(receiver, budget.clone(), true);
        sender.send(Blob::default()).await.unwrap();
        drop(sender);
        assert!(
            overflow.0.committed(),
            "Shared channel budget counts empty frames too"
        );
        assert_eq!(*budget.lock().unwrap(), PER_CHANNEL);
        drop(owners.pop());
        assert_eq!(*budget.lock().unwrap(), PER_CHANNEL - PER_CALL);
        let (sender, receiver) = super::super::admission::channel(1);
        let reused = Input::new(receiver, budget.clone(), true);
        sender.send(Blob::default()).await.unwrap();
        drop(sender);
        assert!(!reused.0.committed());
        assert_eq!(*budget.lock().unwrap(), PER_CHANNEL - PER_CALL + 5);
        drop(reused);
        drop(overflow);
        drop(owners);
        assert_eq!(*budget.lock().unwrap(), 0);
    }
}
