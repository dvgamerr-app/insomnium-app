/** Pause new tracked runs while cancelling and settling accepted work.
 * This does not lock resource edits or replace the persistence/native transaction.
 * @param {{cancel:()=>Promise<unknown>,pending:()=>Promise<unknown>[],onChange?:(active:boolean)=>void,timeoutMs?:number}} options */
export function createRunDrain({
  cancel,
  pending,
  onChange = () => {},
  timeoutMs = 10000,
}) {
  let active = false;
  /** @template T @param {()=>Promise<T>} operation @returns {Promise<T>} */
  async function pause(operation) {
    if (active) throw new Error("Workspace operations are already stopping.");
    active = true;
    /** @type {ReturnType<typeof setTimeout>|undefined} */ let timer;
    try {
      onChange(true);
      const initial = [...pending()];
      const drain = async () => {
        // Cancellation IPC is inside the same deadline as completion callbacks.
        const outcomes = await Promise.allSettled([
          Promise.resolve().then(cancel),
          ...initial,
        ]);
        const seen = new Set(initial);
        for (;;) {
          const next = pending().filter((p) => !seen.has(p));
          if (!next.length) break;
          for (const p of next) seen.add(p);
          outcomes.push(...(await Promise.allSettled(next)));
        }
        const failed = outcomes.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      };
      await Promise.race([
        drain(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Connections are still closing. Try again in a moment.",
                ),
              ),
            timeoutMs,
          );
        }),
      ]);
      clearTimeout(timer);
      // Outside drain(): a timed-out drain must never invoke this callback later.
      return await operation();
    } finally {
      clearTimeout(timer);
      active = false;
      onChange(false);
    }
  }
  return {
    pause,
    get active() {
      return active;
    },
  };
}
