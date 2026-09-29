/** Application-owned interaction state shared only by one render session.
 * Templates cannot create or publish these notifications.
 */
export function createTemplateInteraction() {
  /** @type {Set<(waiting:boolean)=>void>} */
  const listeners = new Set();
  let waits = 0;
  let disposed = false;
  const notify = () => {
    for (const listener of [...listeners]) listener(waits > 0);
  };
  return {
    /** @param {(waiting:boolean)=>void} listener */
    subscribe(listener) {
      if (disposed) {
        listener(false);
        return () => {};
      }
      listeners.add(listener);
      listener(waits > 0);
      return () => {
        listeners.delete(listener);
      };
    },
    begin() {
      if (disposed) return () => {};
      if (++waits === 1) notify();
      let released = false;
      return () => {
        if (released || disposed) return;
        released = true;
        if (--waits === 0) notify();
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      waits = 0;
      notify();
      listeners.clear();
    },
  };
}
