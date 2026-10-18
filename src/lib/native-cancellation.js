import { invoke } from "@tauri-apps/api/core";

/** @param {string} id @param {AbortSignal} signal */
export function createNativeCancellation(id, signal) {
  let active = true;
  let failed = false;
  /** @type {Set<Promise<void>>} */
  const pending = new Set();
  /** @type {unknown} */
  let error;
  const request = () => {
    if (!active) return;
    const operation = invoke("cancel_http", { id }).catch((e) => {
      if (!failed) error = e;
      failed = true;
    }).then(() => { pending.delete(operation); });
    pending.add(operation);
  };
  const cancel = () => {
    if (signal.aborted) request();
  };
  signal.addEventListener("abort", cancel);
  return {
    started: cancel,
    request,
    close: async () => {
      active = false;
      signal.removeEventListener("abort", cancel);
      await Promise.all(pending);
    },
    get failed() {
      return failed;
    },
    get error() {
      return error;
    },
  };
}
