import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

function nativeOnly() {
  if (!isTauri())
    throw new Error("Open the desktop app to use gRPC and server reflection.");
}
/** @param {string} id @param {AbortSignal} signal */
function cancellation(id, signal) {
  let active = true;
  /** @type {unknown} */
  let error;
  const cancel = () => {
    if (active && signal.aborted)
      void invoke("cancel_http", { id }).catch((e) => {
        error = e;
      });
  };
  signal.addEventListener("abort", cancel);
  return {
    started: cancel,
    close: () => {
      active = false;
      signal.removeEventListener("abort", cancel);
    },
    get error() {
      return error;
    },
  };
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
    cancel.close();
  }
}

/** @param {Record<string,any>} request @param {AbortSignal} signal @param {(event:Record<string,any>)=>void} onmessage */
export async function connectGrpc(request, signal, onmessage) {
  nativeOnly();
  if (signal.aborted) throw new Error("gRPC call cancelled.");
  const cancel = cancellation(request.id, signal);
  /** @type {Channel<Record<string,any>>} */
  const channel = new Channel();
  /** @type {unknown} */
  let deliveryError;
  channel.onmessage = ({ event, sequence }) => {
    if (event.kind === "started") cancel.started();
    try {
      onmessage(event);
    } catch (error) {
      deliveryError = error;
      void invoke("cancel_http", { id: request.id }).catch(() => {});
    } finally {
      void invoke("acknowledge_grpc", { id: request.id, sequence }).catch(
        (error) => {
          deliveryError = error;
          void invoke("cancel_http", { id: request.id }).catch(() => {});
        },
      );
    }
  };
  try {
    await invoke("connect_grpc", { request, onEvent: channel });
    if (deliveryError) throw deliveryError;
    if (cancel.error) throw cancel.error;
  } finally {
    cancel.close();
  }
}
/** @param {string} runId @param {string|null} text @param {boolean} [finish] */
export async function sendGrpcMessage(runId, text, finish = false) {
  nativeOnly();
  await invoke("send_grpc_message", { id: runId, text, finish });
}
