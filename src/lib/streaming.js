import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { id } from "./model.js";
import { createNativeCancellation } from "./native-cancellation.js";

/** @param {Record<string, any>} request @param {string} protocol @param {AbortSignal} signal @param {(event: Record<string, any>) => void} onmessage */
export async function connectStream(request, protocol, signal, onmessage) {
  if (!isTauri())
    throw new Error(
      "Open the desktop app to use WebSocket and SSE with native headers, cookies and TLS.",
    );
  if (signal.aborted) return;
  const cancellation = createNativeCancellation(request.id, signal);
  /** @type {Channel<Record<string, any>>} */
  const channel = new Channel();
  /** @type {Set<Promise<void>>} */
  const pending = new Set();
  let deliveryFailed = false;
  /** @type {unknown} */
  let deliveryError;
  /** @param {unknown} error */
  const failed = (error) => {
    if (!deliveryFailed) deliveryError = error;
    deliveryFailed = true;
    cancellation.request();
  };
  /** @param {Promise<unknown>} operation */
  const track = (operation) => {
    const completion = operation.catch(failed).then(() => { pending.delete(completion); });
    pending.add(completion);
  };
  const drain = async () => {
    // Drain delivered ACKs before retiring the cancellation owner.
    while (pending.size) await Promise.all(pending);
  };
  channel.onmessage = ({ event, sequence }) => {
    if (event.kind === "started") cancellation.started();
    try {
      onmessage(event);
    } catch (error) {
      failed(error);
    } finally {
      if (sequence != null)
        track(invoke("acknowledge_stream", { id: request.id, sequence }));
    }
  };
  try {
    await invoke("connect_stream", { request, protocol, onEvent: channel });
    await drain();
    if (deliveryFailed) throw deliveryError;
  } finally {
    await drain();
    await cancellation.close();
  }
  if (cancellation.failed) throw cancellation.error;
}

/** @param {string} runId @param {string} format @param {string} data */
export async function sendMessage(runId, format, data) {
  if (!isTauri())
    throw new Error("WebSocket sending is available in the desktop app.");
  await invoke("send_stream_message", { id: runId, format, data });
}

/** Bound the visible/saved stream log, retaining a large newest message intact.
 * @param {Record<string, any>} response @param {Record<string, any>} event */
export function appendStreamEvent(response, event) {
  const entry = { ...event, _id: id("evt"), created: Date.now() };
  const byteLength = new TextEncoder().encode(JSON.stringify(entry)).byteLength;
  response.events.push({ ...entry, byteLength });
  response.retainedBytes = (response.retainedBytes || 0) + byteLength;
  const budget = 8 * 1024 * 1024;
  // Terminal/status events must not evict the newest complete large payload.
  // A newer payload replaces this exception; surrounding metadata stays bounded.
  let oversized;
  for (let index = response.events.length - 1; index >= 0; index--) {
    const candidate = response.events[index];
    if (
      candidate.kind === "sse" ||
      candidate.kind === "sent" ||
      (candidate.kind === "message" &&
        !["ping", "pong"].includes(candidate.format))
    ) {
      if (candidate.byteLength > budget) oversized = candidate;
      break;
    }
  }
  while (
    response.events.length > 1 &&
    (response.events.length > 1000 || response.retainedBytes > budget)
  ) {
    const protectedFirst = response.events[0] === oversized;
    if (
      protectedFirst &&
      response.events.length <= 1000 &&
      response.retainedBytes - oversized.byteLength <= budget
    )
      break;
    const [removed] = response.events.splice(protectedFirst ? 1 : 0, 1);
    response.retainedBytes -= removed.byteLength;
    response.dropped = (response.dropped || 0) + 1;
  }
  return entry;
}
