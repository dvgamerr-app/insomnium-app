import { createPluginVm, inspectPluginVm } from "./plugin-runtime.js";
import { createPluginValueCodec } from "./plugin-values.js";

/** Retained guest module, with only the six-method store capability.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot
 * @param {(operation:{method:string,args:string[]})=>Promise<any>} storeCall */
export function createPluginCallbackRuntime(engine, snapshot, storeCall) {
  const loaded = createPluginVm(engine, snapshot),
    { vm, evaluate } = loaded;
  let closed = false,
    running = false,
    storeAllowed = false,
    calls = 0;
  const pending = new Set();
  const codec = createPluginValueCodec();
  let metadata;
  try {
    metadata = inspectPluginVm(loaded, snapshot.name);
  } catch (error) {
    vm.dispose();
    throw error;
  }
  const bridge = vm.newFunction("store", (request) => {
    if (closed || !running) throw Error("Plugin callback is not active");
    if (!storeAllowed)
      throw Error("Plugin store is unavailable during metadata evaluation");
    if (++calls > 256 || pending.size >= 64)
      throw Error("Plugin store call limit exceeded");
    const json = vm.getString(request);
    if (json.length > 16 * 1024 * 1024)
      throw Error("Plugin store request exceeds its limit");
    const operation = JSON.parse(json),
      deferred = vm.newPromise();
    pending.add(deferred);
    Promise.resolve()
      .then(() => {
        if (closed) throw Error("Plugin session is closed");
        return storeCall(operation);
      })
      .then((value) => {
        if (closed) return;
        const json = JSON.stringify(value ?? null);
        if (json.length > 16 * 1024 * 1024)
          throw Error("Plugin store result exceeds its limit");
        const result =
          value === undefined
            ? vm.undefined
            : evaluate(`JSON.parse(${JSON.stringify(json)})`);
        try {
          deferred.resolve(result);
        } finally {
          if (result !== vm.undefined) result.dispose();
        }
      })
      .catch((error) => {
        if (closed) return;
        const result = vm.newError(
          (error instanceof Error ? error.message : String(error)).slice(
            0,
            8192,
          ),
        );
        try {
          deferred.reject(result);
        } finally {
          result.dispose();
        }
      })
      .finally(() => {
        pending.delete(deferred);
        deferred.dispose();
      });
    return deferred.handle.dup();
  });
  try {
    vm.setProp(vm.global, "__pluginStoreCall", bridge);
    evaluate(
      `globalThis.__pluginValueCodec=(${createPluginValueCodec.toString()})();`,
    ).dispose();
    evaluate(`globalThis.__pluginContext=Object.freeze({store:Object.freeze(Object.fromEntries(
      ['hasItem','getItem','setItem','removeItem','clear','all'].map(method=>[method,(...args)=>{
        const count=method==='setItem'?2:['hasItem','getItem','removeItem'].includes(method)?1:0;
        if(args.length!==count)throw TypeError('Invalid store arguments');
        if(count&&typeof args[0]!=='string')throw TypeError('Plugin store key must be a string');
        if(method==='setItem')args[1]=String(args[1]);
        return __pluginStoreCall(JSON.stringify({method,args}));
      }])
    ))});`).dispose();
  } catch (error) {
    bridge.dispose();
    vm.dispose();
    throw error;
  } finally {
    if (bridge.alive) bridge.dispose();
  }

  return {
    metadata,
    /** @param {string} kind @param {number} index @param {string} args */
    async invoke(kind, index, args) {
      if (closed) throw Error("Plugin session is closed");
      if (running) throw Error("Plugin callback is already running");
      const kinds = [
        "templateTags",
        "templateTagMetadata",
        "requestHooks",
        "responseHooks",
        "requestGroupActions",
        "requestActions",
        "workspaceActions",
        "documentActions",
      ];
      if (
        !kinds.includes(kind) ||
        !Number.isInteger(index) ||
        index < 0 ||
        index > 63 ||
        typeof args !== "string"
      )
        throw Error("Invalid plugin callback");
      // Validate the internal envelope before entering the guest.
      if (!Array.isArray(codec.decode(args)))
        throw Error("Invalid plugin callback arguments");
      running = true;
      storeAllowed = kind !== "templateTagMetadata";
      calls = 0;
      loaded.resetDeadline();
      let handle;
      const deadline = performance.now() + 5000;
      try {
        handle = evaluate(`(async()=>{
          const kind=${JSON.stringify(kind)},item=__pluginExports[kind==='templateTagMetadata'?'templateTags':kind]?.[${index}];
          const args=__pluginValueCodec.decode(${JSON.stringify(args)});
          if(kind==='templateTagMetadata') {
            if(args.length<1||args.length>3)throw Error('Invalid metadata query');
            return __pluginValueCodec.encode(__pluginTagMetadata.resolve(item,...args));
          }
          const fn=kind.endsWith('Hooks')?item:kind==='templateTags'?item?.run:item?.action;
          if(typeof fn!=='function')throw Error('Plugin callback is unavailable');
          const value=await fn.call(item,__pluginContext,...args);
          return __pluginValueCodec.encode(value);
        })()`);
        while (!closed) {
          if (performance.now() > deadline)
            throw Error("Plugin callback exceeded 5 seconds");
          const jobs = vm.runtime.executePendingJobs(64);
          if (jobs.error) {
            try {
              throw Error(
                vm.dump(jobs.error)?.message || "Plugin promise job failed",
              );
            } finally {
              jobs.error.dispose();
            }
          }
          const state = vm.getPromiseState(handle);
          if (state.type === "fulfilled") {
            try {
              if (!pending.size && !vm.runtime.hasPendingJob())
                return vm.getString(state.value);
            } finally {
              state.value.dispose();
            }
          }
          if (state.type === "rejected") {
            try {
              throw Error(
                vm.dump(state.error)?.message || "Plugin callback failed",
              );
            } finally {
              state.error.dispose();
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        throw Error("Plugin session is closed");
      } catch (error) {
        closed = true;
        for (const deferred of pending) deferred.dispose();
        pending.clear();
        throw error;
      } finally {
        handle?.dispose();
        running = false;
        storeAllowed = false;
        if (closed) vm.dispose();
      }
    },
    dispose() {
      if (closed) return;
      closed = true;
      for (const deferred of pending) deferred.dispose();
      pending.clear();
      if (!running) vm.dispose();
    },
  };
}
