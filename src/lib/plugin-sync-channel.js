// This mailbox stays in the host worker, outside the QuickJS guest and codec.
export const PLUGIN_SYNC_BYTES = 4 * 1024 * 1024;
export const PLUGIN_SYNC_HEADER = 16;

/** @param {any} value @param {number} callbackId @param {number} id */
export function validatePluginSyncMailbox(value, callbackId, id) {
  if (
    typeof SharedArrayBuffer === "undefined" ||
    !(value instanceof SharedArrayBuffer) ||
    value.byteLength !== PLUGIN_SYNC_HEADER + PLUGIN_SYNC_BYTES ||
    !Number.isInteger(callbackId) ||
    callbackId <= 0 ||
    callbackId > 2147483647 ||
    !Number.isInteger(id) ||
    id <= 0 ||
    id > 2147483647
  )
    throw Error("Invalid plugin synchronous mailbox");
  const control = new Int32Array(value, 0, 4);
  if (
    Atomics.load(control, 2) !== callbackId ||
    Atomics.load(control, 3) !== id
  )
    throw Error("Invalid plugin synchronous mailbox ownership");
  return control;
}

/** Publish only to a still-pending mailbox. A timed-out caller cannot receive a
 * late reply and a different callback never shares this buffer.
 * @param {SharedArrayBuffer} buffer @param {number} callbackId @param {number} id
 * @param {string} text @param {boolean} [error] */
export function replyPluginSyncMailbox(
  buffer,
  callbackId,
  id,
  text,
  error = false,
) {
  const control = validatePluginSyncMailbox(buffer, callbackId, id);
  if (Atomics.load(control, 0) !== 0) return false;
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > PLUGIN_SYNC_BYTES)
    throw Error("Plugin synchronous reply exceeds its limit");
  new Uint8Array(buffer, PLUGIN_SYNC_HEADER, bytes.length).set(bytes);
  Atomics.store(control, 1, bytes.length);
  if (Atomics.compareExchange(control, 0, 0, error ? 2 : 1) !== 0) return false;
  Atomics.notify(control, 0);
  return true;
}

/** Only call inside a dedicated worker. The UI thread remains asynchronous.
 * @param {(message:any)=>void} post @param {()=>number} owner
 * @returns {(operation:string)=>string} */
export function createPluginSyncCaller(post, owner, options=/** @type {{poll?:()=>void}} */({})) {
  let sequence = 0;
  return (operation) => {
    if (
      typeof SharedArrayBuffer === "undefined" ||
      globalThis.crossOriginIsolated !== true
    )
      throw Error("Plugin synchronous helpers require cross-origin isolation");
    const callbackId = owner(),
      id = ++sequence;
    const buffer = new SharedArrayBuffer(
      PLUGIN_SYNC_HEADER + PLUGIN_SYNC_BYTES,
    );
    const control = new Int32Array(buffer, 0, 4);
    Atomics.store(control, 2, callbackId);
    Atomics.store(control, 3, id);
    validatePluginSyncMailbox(buffer, callbackId, id);
    post({ type: "sync-helper", callbackId, id, operation, buffer });
    const end = performance.now() + 4000;
    while (Atomics.load(control, 0) === 0) {
      options.poll?.();
      const left = end - performance.now();
      if (left <= 0) {
        if (Atomics.compareExchange(control, 0, 0, 3) === 0)
          throw new DOMException(
            "Plugin synchronous helper exceeded 4 seconds",
            "TimeoutError",
          );
        break;
      }
      Atomics.wait(control, 0, 0, options.poll?Math.min(left,1):left);
    }
    const state = Atomics.load(control, 0),
      length = Atomics.load(control, 1);
    if (![1, 2].includes(state) || length < 0 || length > PLUGIN_SYNC_BYTES)
      throw Error("Invalid plugin synchronous reply");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      // Web TextDecoder forbids shared views; copy only the published bytes.
      new Uint8Array(buffer, PLUGIN_SYNC_HEADER, length).slice(),
    );
    if (state === 2) throw Error(text);
    return text;
  };
}
