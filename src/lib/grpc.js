import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { createNativeCancellation as cancellation } from "./native-cancellation.js";

function nativeOnly() {
  if (!isTauri())
    throw new Error("Open the desktop app to use gRPC and server reflection.");
}
/** @param {Record<string,any>} request @param {AbortSignal} signal */
export async function loadGrpcSchema(request, signal) {
  nativeOnly();
  if (signal.aborted) throw new Error("gRPC schema lookup cancelled.");
  const cancel = cancellation(request.id, signal);
  const onStarted = new Channel();
  onStarted.onmessage = cancel.started;
  try {
    const result = await invoke("load_grpc_schema", { request, onStarted });
    if (signal.aborted) throw new Error("gRPC schema lookup cancelled.");
    return /** @type {Record<string,any>} */ (result);
  } finally {
    await cancel.close();
  }
}

/** @param {Record<string,any>} request @param {AbortSignal} signal @param {(event:Record<string,any>)=>void} onmessage */
export async function connectGrpc(request, signal, onmessage) {
  nativeOnly();
  if (signal.aborted) throw new Error("gRPC call cancelled.");
  const cancel = cancellation(request.id, signal);
  /** @type {Channel<Record<string,any>>} */
  const channel = new Channel();
  /** @type {Set<Promise<void>>} */
  const acknowledgements = new Set();
  const drain = async () => {
    while (acknowledgements.size) await Promise.all(acknowledgements);
  };
  /** @type {unknown} */
  let deliveryError;
  let deliveryFailed = false;
  /** @param {unknown} error */
  const failed = (error) => {
    if (!deliveryFailed) deliveryError = error;
    deliveryFailed = true;
    cancel.request();
  };
  channel.onmessage = ({ event, sequence }) => {
    if (event.kind === "started") cancel.started();
    try {
      onmessage(event);
    } catch (error) {
      failed(error);
    } finally {
      const acknowledgement = invoke("acknowledge_grpc", { id: request.id, sequence })
        .catch(failed)
        .then(() => { acknowledgements.delete(acknowledgement); });
      acknowledgements.add(acknowledgement);
    }
  };
  try {
    await invoke("connect_grpc", { request, onEvent: channel });
    await drain();
    if (deliveryFailed) throw deliveryError;
  } finally {
    // Keep the call tracked until ACK callbacks settle, including native failure.
    await drain();
    await cancel.close();
  }
  if (cancel.failed) throw cancel.error;
}
/** @param {string} runId @param {string|null} text @param {boolean} [finish] */
export async function sendGrpcMessage(runId, text, finish = false) {
  nativeOnly();
  await invoke("send_grpc_message", { id: runId, text, finish });
}
