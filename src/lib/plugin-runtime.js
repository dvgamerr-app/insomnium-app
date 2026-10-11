import { resolvePluginModule, pluginModuleFormat } from "./plugin-modules.js";
import { createPluginTagMetadata } from "./plugin-tag-metadata.js";
import { createPluginValueCodec } from "./plugin-values.js";
import { pluginBufferSource } from "./generated/plugin-buffer.js";
import { createPluginGuestDom } from "./plugin-guest-dom.js";

/** Load a package in its own bounded VM; caller owns the returned context.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot */
export function createPluginVm(engine, snapshot) {
  if (
    !snapshot ||
    typeof snapshot.name !== "string" ||
    typeof snapshot.entry !== "string" ||
    !["commonjs", "module"].includes(snapshot.format)
  )
    throw Error("Invalid plugin source snapshot");
  const files = snapshot.files;
  if (
    !files ||
    Object.keys(files).length > 128 ||
    Object.values(files).some(
      (source) => typeof source !== "string" || source.length > 1024 * 1024,
    ) ||
    JSON.stringify(snapshot).length > 16 * 1024 * 1024 ||
    !Object.hasOwn(files, snapshot.entry)
  )
    throw Error("Plugin source snapshot exceeds its bounds");
  const vm = engine.newContext();
  vm.runtime.setMemoryLimit(128 * 1024 * 1024);
  vm.runtime.setMaxStackSize(512 * 1024);
  let deadline = performance.now() + 2000;
  /** @type {number|undefined} */ let pausedAt;
  /** @type {number|undefined} */ let executingAt;
  let pausedExecution = 0;
  // Exclude trusted idle waiting, never time spent executing guest jobs.
  vm.runtime.setInterruptHandler(
    () =>
      performance.now() >=
      deadline +
        (pausedAt === undefined
          ? 0
          : (executingAt ?? pausedAt) - pausedAt - pausedExecution),
  );
  /** @template T @param {()=>T} run @returns {T} */
  const execute = (run) => {
    if (executingAt !== undefined) return run();
    executingAt = performance.now();
    try {
      return run();
    } finally {
      if (pausedAt !== undefined)
        pausedExecution += performance.now() - executingAt;
      executingAt = undefined;
    }
  };
  /** @param {string} source @param {string} [filename] @param {import('quickjs-emscripten-core').ContextEvalOptions} [options] */
  const evaluate = (source, filename = "plugin-bootstrap.js", options = {}) => {
    const result = execute(() => vm.evalCode(source, filename, options));
    if (result.error) {
      try {
        throw Error(vm.dump(result.error)?.message || "Plugin module failed");
      } finally {
        result.error.dispose();
      }
    }
    return result.value;
  };
  try {
    // Install realm-local collection reflection before modules can capture it.
    // These closures grant no DOM access until the callback runtime binds its
    // guarded transport; initialization itself performs no host operations.
    evaluate(`(() => {
      const dom=(${createPluginGuestDom.toString()})((method,args)=>__pluginValueCodec.decode(__pluginDomSync(__pluginValueCodec.encode({method,args}))),callback=>__pluginRetainDomCallback(callback));
      Object.defineProperty(globalThis,'__pluginGuestDom',{value:dom,writable:false,configurable:false});
      for(const key of ['document','Node','HTMLElement','NodeList','HTMLCollection','DOMTokenList','DOMException'])Object.defineProperty(globalThis,key,{value:dom[key],writable:false,configurable:false});
    })();`, "plugin-dom-bootstrap.js").dispose();
    evaluate(pluginBufferSource, "plugin-buffer.js").dispose();
    vm.runtime.setModuleLoader(
      (name) => {
        const format = pluginModuleFormat(files, name);
        if (format === "module") return files[name].replace(/^\uFEFF/, "");
        return `export default globalThis.__requirePluginModule(${JSON.stringify(name)});`;
      },
      (parent, request) => resolvePluginModule(files, request, parent),
    );
    evaluate(`(() => {
      const files = ${JSON.stringify(files)};
      const resolvePluginModule = ${resolvePluginModule.toString()};
      const pluginModuleFormat = ${pluginModuleFormat.toString()};
      const cache = Object.create(null);
      globalThis.__requirePluginModule = function load(id) {
        if (Object.hasOwn(cache, id)) return cache[id].exports;
        const format = pluginModuleFormat(files, id);
        if (format === 'module') throw Error('CommonJS require of an ES module is not supported yet: ' + id);
        const module = { exports: {} }; cache[id] = module;
        try {
          if (format === 'json') module.exports = JSON.parse(files[id]);
          else {
            const source = files[id].replace(/^\\uFEFF/, '').replace(/^#![^\\n]*\\n/, '\\n');
            const run = new Function('module', 'exports', 'require', '__filename', '__dirname', source);
            run.call(module.exports, module, module.exports, request => load(resolvePluginModule(files, request, id)), id, id.split('/').slice(0,-1).join('/'));
          }
          return module.exports;
        } catch (error) { delete cache[id]; throw error; }
      };
    })();`).dispose();
    if (snapshot.format === "module") {
      evaluate(
        `import * as exports from ${JSON.stringify("./" + snapshot.entry)};globalThis.__pluginExports=exports;`,
        "plugin-entry.mjs",
        { type: "module" },
      ).dispose();
    } else {
      evaluate(
        `globalThis.__pluginExports=globalThis.__requirePluginModule(${JSON.stringify(snapshot.entry)});`,
      ).dispose();
    }
    return {
      vm,
      evaluate,
      resetDeadline: () => {
        deadline = performance.now() + 2000;
        pausedAt = undefined;
        pausedExecution = 0;
      },
      /** Only the worker's trusted callback owner may control idle waiting.
       * @param {boolean} waiting */
      setInteractionWaiting(waiting) {
        if (waiting && pausedAt === undefined) {
          pausedAt = performance.now();
          pausedExecution = 0;
        } else if (!waiting && pausedAt !== undefined) {
          deadline += performance.now() - pausedAt - pausedExecution;
          pausedAt = undefined;
          pausedExecution = 0;
        }
      },
      /** @param {number} count */
      executePendingJobs: (count) =>
        execute(() => vm.runtime.executePendingJobs(count)),
      /** Bounded host waiting is not guest execution; this hook stays in worker.
       * @param {number} milliseconds */
      accountHostWait(milliseconds) {
        if (!Number.isFinite(milliseconds) || milliseconds < 0)
          throw Error("Invalid plugin host wait accounting");
        if (pausedAt === undefined) deadline += milliseconds;
        else pausedExecution -= milliseconds;
      },
      abortExecution() {
        deadline = -Infinity;
      },
    };
  } catch (error) {
    vm.dispose();
    throw error;
  }
}

/** @param {ReturnType<typeof createPluginVm>} loaded @param {string} name */
export function inspectPluginVm(loaded, name) {
  const { vm, evaluate } = loaded;
  evaluate(
    `globalThis.__pluginTagMetadata=(${createPluginTagMetadata.toString()})();`,
  ).dispose();
  evaluate(
    `globalThis.__pluginMetadataCodec=(${createPluginValueCodec.toString()})();`,
  ).dispose();
  const result = evaluate(`__pluginMetadataCodec.encode((() => {
      const exports = globalThis.__pluginExports;
      if (!exports || (typeof exports !== 'object' && typeof exports !== 'function')) throw Error('Plugin exports must be an object');
      const names = ['templateTags','requestHooks','responseHooks','themes','requestGroupActions','requestActions','workspaceActions','documentActions'];
      const contributions = [];
      for (const kind of names) {
        if (exports[kind] === undefined) continue;
        const values = exports[kind];
        if (!Array.isArray(values) || values.length > 64) throw Error('Invalid contribution array: ' + kind);
        const items = values.map((value, index) => {
          if (kind.endsWith('Hooks')) { if (typeof value !== 'function') throw Error('Hook must be a function: ' + kind); return { index }; }
          if (!value || typeof value !== 'object') throw Error('Invalid contribution: ' + kind);
          if (kind === 'templateTags') {
            const definition=__pluginTagMetadata.inspect(value);
            const name=definition.name,label=definition.displayName??definition.label??name;
            if(label.length>1024)throw Error('Contribution label exceeds its limit');
            return {index,name,label,definition};
          }
          if (kind.endsWith('Actions') && typeof value.action !== 'function') throw Error('Action requires an action function: ' + kind);
          const name = typeof value.name === 'string' ? value.name : '';
          const label = typeof value.displayName === 'string' ? value.displayName : typeof value.label === 'string' ? value.label : name;
          if (name.length > 256 || label.length > 1024) throw Error('Contribution label exceeds its limit');
          return { index, name, label };
        });
        contributions.push({ kind, count: items.length, items });
      }
      return { contributions, unknownExports: Object.keys(exports).filter(name => !names.includes(name)).slice(0,64) };
    })())`);
  try {
    const json = vm.getString(result);
    if (json.length > 256 * 1024)
      throw Error("Plugin metadata exceeds the 256 KiB limit");
    return { name, ...createPluginValueCodec().decode(json) };
  } finally {
    result.dispose();
  }
}

/** Execute a package and retain metadata only; inspection never invokes callbacks.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot */
export function inspectPluginExportsIsolated(engine, snapshot) {
  const loaded = createPluginVm(engine, snapshot);
  try {
    return inspectPluginVm(loaded, snapshot.name);
  } finally {
    loaded.vm.dispose();
  }
}
