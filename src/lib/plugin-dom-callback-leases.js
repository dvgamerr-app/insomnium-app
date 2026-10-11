import { createPluginValueCodec } from "./plugin-values.js";

/** Retain actual guest functions, never serialized functions or evaluated source.
 * One lease manager must share the VM's exclusive operation queue when integrated.
 * The caller owns the VM and must close it after a terminal execution failure.
 * @param {ReturnType<import('./plugin-runtime.js').createPluginVm>} loaded
 * @param {{onFatal:(error:Error)=>void}} options */
export function createPluginDomCallbackLeases(loaded, options) {
  if (!options || typeof options.onFatal !== "function")
    throw Error("DOM callback leases require a terminal VM cleanup handler");
  const { vm, evaluate } = loaded;
  const codec = createPluginValueCodec();
  /** @typedef {{handle:import('quickjs-emscripten-core').QuickJSHandle,current:()=>boolean,signal:AbortSignal,abort:()=>void}} Lease */
  const leases = new Map(/** @type {[number,Lease][]} */ ([]));
  let sequence = 0, executing = 0, queued = 0, closed = false;
  let queue = Promise.resolve();
  /** @type {import('quickjs-emscripten-core').QuickJSHandle|undefined} */ let activeHandle;
  const current = (/** @type {Lease} */ lease) => {
    try { return !closed && !lease.signal.aborted && lease.current() === true; }
    catch { return false; }
  };
  const release = (/** @type {number} */ id) => {
    const lease = leases.get(id);
    if (!lease) return false;
    leases.delete(id);
    lease.signal.removeEventListener("abort", lease.abort);
    lease.handle.dispose();
    return true;
  };
  const dispose = () => {
    if (closed) return;
    closed = true;
    for (const id of leases.keys()) release(id);
    clearInterval(ownerTimer);
  };
  const ownerTimer = setInterval(() => {
    for (const [id, lease] of leases) if (!current(lease)) release(id);
  }, 100);
  const dispatch = vm.newFunction("ownedDomCallback", (id, ...args) => {
    if (!activeHandle || !executing || vm.getNumber(id) !== executing)
      throw Error("DOM callback dispatch is not active");
    const lease = leases.get(executing);
    if (!lease || !current(lease)) throw Error("DOM callback lease is no longer current");
    return vm.unwrapResult(vm.callFunction(activeHandle, vm.undefined, ...args));
  });
  try {
    vm.setProp(vm.global, "__pluginDomCallbackDispatch", dispatch);
    evaluate(`Object.defineProperty(globalThis,'__pluginDomCallbackDispatch',{writable:false,configurable:false});
      Object.defineProperty(globalThis,'__pluginDomCallbackCodec',{value:(${createPluginValueCodec.toString()})(),writable:false,configurable:false});`).dispose();
  } catch (error) {
    dispose();
    throw error;
  } finally { dispatch.dispose(); }

  return Object.freeze({
    /** Caller must capture the trusted dialog owner, not a guest-supplied owner.
     * @param {import('quickjs-emscripten-core').QuickJSHandle} handle
     * @param {{current:()=>boolean,signal:AbortSignal}} owner */
    retain(handle, owner) {
      if (closed) throw Error("DOM callback leases are closed");
      if (!owner || typeof owner.current !== "function" || !(owner.signal instanceof AbortSignal))
        throw Error("DOM callback requires a trusted owner");
      if (vm.typeof(handle) !== "function") throw Error("DOM callback must be a guest function");
      if (leases.size >= 128) throw Error("DOM callback lease limit exceeded");
      const id = ++sequence;
      const lease = {handle:handle.dup(),current:owner.current,signal:owner.signal,abort:()=>{release(id);}};
      if (!current(lease)) { lease.handle.dispose(); throw Error("DOM callback lease is no longer current"); }
      leases.set(id,lease);
      owner.signal.addEventListener("abort",lease.abort,{once:true});
      return id;
    },
    release,
    dispose,
    /** Copy arguments before queueing. Late/stale events cannot enter the guest.
     * @param {number} id @param {any[]} [args] */
    invoke(id, args = []) {
      let wire;
      try {
        const lease = leases.get(id);
        if (!lease || !current(lease)) throw Error("DOM callback lease is no longer current");
        if (!Array.isArray(args)) throw Error("DOM callback arguments must be an array");
        if (queued >= 64) throw Error("DOM callback queue limit exceeded");
        wire = codec.encode(args);
      } catch (error) { return Promise.reject(error); }
      queued++;
      const job = queue.then(async () => {
        const lease = leases.get(id);
        if (!lease || !current(lease)) throw Error("DOM callback lease is no longer current");
        activeHandle = lease.handle.dup();
        executing = id;
        loaded.resetDeadline();
        let result;
        /** @type {Error|undefined} */ let fatal;
        const started = performance.now();
        try {
          result = evaluate(`(async()=>__pluginDomCallbackCodec.encode(await __pluginDomCallbackDispatch(${id},...__pluginDomCallbackCodec.decode(${JSON.stringify(wire)}))))()`);
          while (true) {
            if (!leases.has(id) || !current(lease)) throw Error("DOM callback lease is no longer current");
            if (performance.now() - started > 5000) throw Error("DOM callback exceeded 5 seconds");
            const jobs = loaded.executePendingJobs(64);
            if (jobs.error) {
              try { throw Error(vm.dump(jobs.error)?.message || "DOM callback promise job failed"); }
              finally { jobs.error.dispose(); }
            }
            const state = vm.getPromiseState(result);
            if (state.type === "fulfilled") {
              try {
                if (!vm.runtime.hasPendingJob()) return codec.decode(vm.getString(state.value));
              }
              finally { state.value.dispose(); }
            }
            if (state.type === "rejected") {
              try { throw Error(vm.dump(state.error)?.message || "DOM callback failed"); }
              finally { state.error.dispose(); }
            }
            await new Promise(resolve => setTimeout(resolve,1));
          }
        } catch (error) {
          // Unsettled jobs may retain guest state after cancellation/failure.
          // Never reuse a possibly interrupted or partially active VM.
          const failure = error instanceof Error ? error : Error(String(error));
          dispose();
          fatal = failure;
          throw failure;
        } finally {
          result?.dispose();
          activeHandle?.dispose();
          activeHandle = undefined;
          executing = 0;
          if (fatal) options.onFatal(fatal);
        }
      }).finally(() => {queued--;});
      queue = job.then(() => {}, () => {});
      return job;
    },
  });
}
