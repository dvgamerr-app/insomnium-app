import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { id } from "./model.js";

/** @param {Record<string, any>} request @param {string} protocol @param {AbortSignal} signal @param {(event: Record<string, any>) => void} onmessage */
export async function connectStream(request, protocol, signal, onmessage) {
  if (!isTauri())
    throw new Error(
      "Open the desktop app to use WebSocket and SSE with native headers, cookies and TLS.",
    );
  if (signal.aborted) return;
  /** @type {Channel<Record<string, any>>} */
  const channel = new Channel();
  channel.onmessage = ({ event, sequence }) => {
    if (signal.aborted && event.kind === "started")
      void invoke("cancel_http", { id: request.id }).catch((error) =>
        onmessage({ kind: "warning", message: String(error) }),
      );
    try {
      onmessage(event);
    } finally {
      if (sequence != null)
        void invoke("acknowledge_stream", { id: request.id, sequence }).catch(
          (error) => onmessage({ kind: "warning", message: String(error) }),
        );
    }
  };
  await invoke("connect_stream", { request, protocol, onEvent: channel });
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
  while (
    response.events.length > 1 &&
    (response.events.length > 1000 || response.retainedBytes > 8 * 1024 * 1024)
  ) {
    response.retainedBytes -= response.events.shift().byteLength;
    response.dropped = (response.dropped || 0) + 1;
  }
  return entry;
}
