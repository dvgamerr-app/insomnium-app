export const RENDER_ACTIVE_MS = 5000;
export const PROMPT_TOTAL_MS = 10 * 60 * 1000;
export const WORKER_HEARTBEAT_MS = 1000;

/** A shared elapsed-time budget; overlapping pauses resume only after all release.
 * @param {number} milliseconds @param {()=>void} onTimeout
 */
export function createRenderDeadline(milliseconds, onTimeout) {
  let remaining = milliseconds;
  let started = performance.now();
  let pauses = 0;
  let disposed = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const expire = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    onTimeout();
  };
  const arm = () => {
    started = performance.now();
    timer = setTimeout(expire, Math.max(0, remaining));
  };
  arm();
  return {
    pause() {
      if (disposed) return () => {};
      if (pauses++ === 0) {
        remaining -= performance.now() - started;
        clearTimeout(timer);
        if (remaining <= 0) expire();
      }
      let released = false;
      return () => {
        if (released || disposed) return;
        released = true;
        if (--pauses === 0) arm();
      };
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
