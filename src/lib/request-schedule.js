/** Run an owned timer without overlapping sends or retaining missed ticks.
 * Cancellation clears the timer immediately but awaits an accepted send.
 * @param {{signal:AbortSignal, milliseconds:number, repeat:boolean, current:()=>boolean, run:()=>Promise<unknown>}} options
 */
export async function runRequestSchedule({ signal, milliseconds, repeat, current, run }) {
  if (!Number.isFinite(milliseconds) || milliseconds < 1 || milliseconds > 2147483647)
    throw new Error("Enter a delay between 0.001 and 2147483.647 seconds.");
  if (signal.aborted || !current()) return;
  /** @type {Promise<unknown>|undefined} */ let pending;
  /** @type {unknown} */ let failure;
  let failed = false;
  /** @type {()=>void} */ let finish = () => {};
  const stopped = new Promise(resolve => { finish = () => resolve(undefined); });
  /** @type {ReturnType<typeof setInterval>|undefined} */ let timer;
  const stopTimer = () => { clearInterval(timer); finish(); };
  const tick = () => {
    if (signal.aborted || !current()) { stopTimer(); return; }
    if (pending) return;
    if (!repeat) clearInterval(timer);
    // Keep synchronous throws and rejected sends inside the owned completion.
    pending = Promise.resolve().then(() => {
      if (!signal.aborted && current()) return run();
    }).catch(error => { failed = true; failure = error; stopTimer(); }).finally(() => {
      pending = undefined;
      if (!repeat) finish();
    });
  };
  signal.addEventListener("abort", stopTimer, { once: true });
  try {
    timer = setInterval(tick, milliseconds);
    await stopped;
    await pending;
    if (failed) throw failure;
  } finally {
    clearInterval(timer);
    signal.removeEventListener("abort", stopTimer);
  }
}
