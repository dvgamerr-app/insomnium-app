import { createPluginValueCodec } from "./plugin-values.js";

/** Retain actual guest functions, never serialized functions or evaluated source.
 * One manager shares the VM operation queue; native reentry requires a trusted
 * same-owner frame and preserves the outer retained handle and execution budget.
 * The caller owns the VM and must close it after a terminal execution failure.
 * @param {ReturnType<import('./plugin-runtime.js').createPluginVm>} loaded
 * @param {{onFatal:(error:Error)=>void,isIdle?:()=>boolean,isRetiring?:()=>boolean,deadlineExpired?:(elapsed:number)=>boolean}} options */
export function createPluginDomCallbackLeases(loaded, options) {
  if (!options || typeof options.onFatal !== "function")
    throw Error("DOM callback leases require a terminal VM cleanup handler");
  const { vm, evaluate } = loaded;
  const codec = createPluginValueCodec();
  /** @typedef {{handle:import('quickjs-emscripten-core').QuickJSHandle,current:()=>boolean,signal:AbortSignal,abort:()=>void}} Lease */
  const leases = new Map(/** @type {[number,Lease][]} */ ([]));
  let sequence = 0, executing = 0, queued = 0, closed = false;
  let waiting=false;
  let queue = Promise.resolve();
  /** @type {import('quickjs-emscripten-core').QuickJSHandle|undefined} */ let activeHandle;
  /** @type {Lease|undefined} */let activeLease;
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
    const lease = activeLease;
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
    /** Reenter the retained function on an existing native stack. Native DOM
     * ignores listener return values; its microtasks stay on the outer queue.
     * @param {number} id @param {any[]} args */
    invokeNativeNested(id,args){
      const lease=leases.get(id);
      if(closed||!lease||!current(lease)||!Array.isArray(args)||args.length>64)throw Error('Invalid nested owned DOM callback');
      return loaded.executeNativeNested(()=>{
        const previousHandle=activeHandle,previousLease=activeLease,previousId=executing,previousWaiting=waiting;let result,checkpointOpen=false;
        activeHandle=lease.handle.dup();activeLease=lease;executing=id;waiting=false;
        try{
          const wire=codec.encode(args);loaded.beginDomEventCheckpoint();checkpointOpen=true;
          result=evaluate(`__pluginDomCallbackDispatch(${id},...__pluginDomCallbackCodec.decode(${JSON.stringify(wire)}))`);
          loaded.finishDomEventCheckpoint();checkpointOpen=false;
          return undefined;
        }finally{
          if(checkpointOpen)try{loaded.finishDomEventCheckpoint();}catch{/* A terminal interrupted VM is retired by its owner. */}
          result?.dispose();activeHandle?.dispose();activeHandle=previousHandle;activeLease=previousLease;executing=previousId;waiting=previousWaiting;
        }
      });
    },
    /** Enter a ready retained callback only while the outer guest stack is idle.
     * Runtime caller must prove the same trusted capability owner first.
     * @param {number} id @param {any[]} args */
    invokeWhileWaiting(id,args){
      const lease=leases.get(id);
      if(closed||!executing||executing===id||!waiting||!lease||!current(lease))throw Error('DOM callback is not waiting for a distinct same-owner entry');
      if(!Array.isArray(args)||args.length>64)throw Error('Invalid waiting DOM callback arguments');
      const previousHandle=activeHandle,previousLease=activeLease,previousId=executing;let result,checkpointOpen=false;
      activeHandle=lease.handle.dup();activeLease=lease;executing=id;waiting=false;
      try{
        const wire=codec.encode(args);
        loaded.beginDomEventCheckpoint();checkpointOpen=true;
        result=evaluate(`(async()=>__pluginDomCallbackCodec.encode(await __pluginDomCallbackDispatch(${id},...__pluginDomCallbackCodec.decode(${JSON.stringify(wire)}))))()`);
        while(true){
          if(!current(lease))throw Error('DOM callback lease is no longer current');
          const jobs=loaded.executePendingJobs(64);
          if(jobs.error){try{throw Error(vm.dump(jobs.error)?.message||'DOM waiting callback job failed');}finally{jobs.error.dispose();}}
          const state=vm.getPromiseState(result);
          if(state.type==='fulfilled'){try{if(!vm.runtime.hasPendingJob()){loaded.finishDomEventCheckpoint();checkpointOpen=false;return codec.decode(vm.getString(state.value));}}finally{state.value.dispose();}}
          if(state.type==='rejected'){try{throw Error(vm.dump(state.error)?.message||'DOM waiting callback failed');}finally{state.error.dispose();}}
          if(!vm.runtime.hasPendingJob())throw Error('Waiting DOM callback needs an additional asynchronous frame');
        }
      }finally{if(checkpointOpen)try{loaded.finishDomEventCheckpoint();}catch{/* Terminal failure. */}result?.dispose();activeHandle?.dispose();activeHandle=previousHandle;activeLease=previousLease;executing=previousId;waiting=true;}
    },
    /** Copy arguments before queueing. Late/stale events cannot enter the guest.
     * @param {number} id @param {any[]} [args] @param {()=>void} [onPrefix] */
    invoke(id, args = [], onPrefix) {
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
        activeLease=lease;
        executing = id;
        waiting=false;
        loaded.resetDeadline();
        let result;
        let rejected=false;
        let prefixPublished=false;
        let checkpointOpen=false;
        /** @type {Error|undefined} */ let fatal;
        const started = performance.now();
        try {
          loaded.beginDomEventCheckpoint();checkpointOpen=true;
          result = evaluate(`(async()=>__pluginDomCallbackCodec.encode(await __pluginDomCallbackDispatch(${id},...__pluginDomCallbackCodec.decode(${JSON.stringify(wire)}))))()`);
          // Drain the ready guest checkpoint on the native stack. Only a real
          // asynchronous host wait publishes an unfinished prefix; settled
          // callbacks finish their trusted frame before the next listener.
          while (true) {
            waiting=false;
            if (!current(lease)) throw Error("DOM callback lease is no longer current");
            const elapsed=performance.now()-started;
            if (options.deadlineExpired ? options.deadlineExpired(elapsed) : elapsed>5000)
              throw Error("DOM callback exceeded its deadline");
            const jobs = loaded.executePendingJobs(64);
            if (jobs.error) {
              try { throw Error(vm.dump(jobs.error)?.message || "DOM callback promise job failed"); }
              finally { jobs.error.dispose(); }
            }
            const state = vm.getPromiseState(result);
            if (state.type === "fulfilled") {
              try {
                if (!vm.runtime.hasPendingJob() && (!options.isIdle || options.isIdle())) {
                  if(checkpointOpen){loaded.finishDomEventCheckpoint();checkpointOpen=false;}
                  return codec.decode(vm.getString(state.value));
                }
              }
              finally { state.value.dispose(); }
            }
            if (state.type === "rejected") {
              if(checkpointOpen){loaded.finishDomEventCheckpoint();checkpointOpen=false;}
              rejected=true;
              try { throw Error(vm.dump(state.error)?.message || "DOM callback failed"); }
              finally { state.error.dispose(); }
            }
            if(vm.runtime.hasPendingJob())continue;
            if(!prefixPublished){if(checkpointOpen){loaded.finishDomEventCheckpoint();checkpointOpen=false;}prefixPublished=true;onPrefix?.();}
            waiting=true;
            await new Promise(resolve => setTimeout(resolve,1));
          }
        } catch (error) {
          // Unsettled jobs may retain guest state after cancellation/failure.
          // Never reuse a possibly interrupted or partially active VM.
          const failure = error instanceof Error ? error : Error(String(error));
          // A settled owner-cancellation rejection can drain before admitted
          // onHide. CPU interruption or unsettled jobs remain terminal.
          if(!(rejected&&options.isRetiring?.()===true&&!vm.runtime.hasPendingJob())){
            dispose();fatal = failure;
          }
          throw failure;
        } finally {
          if(checkpointOpen)try{loaded.finishDomEventCheckpoint();}catch{/* Terminal failure. */}
          result?.dispose();
          activeHandle?.dispose();
          activeHandle = undefined;
          activeLease=undefined;
          executing = 0;
          waiting=false;
          if (fatal) options.onFatal(fatal);
        }
      }).finally(() => {queued--;});
      queue = job.then(() => {}, () => {});
      return job;
    },
  });
}
