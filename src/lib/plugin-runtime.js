import { resolvePluginModule, pluginModuleFormat } from "./plugin-modules.js";

/** Execute a package in a fresh VM and retain only declarative export metadata.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot */
export function inspectPluginExportsIsolated(engine, snapshot) {
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
  const deadline = performance.now() + 2000;
  vm.runtime.setInterruptHandler(() => performance.now() >= deadline);
  /** @param {string} source @param {string} [filename] @param {import('quickjs-emscripten-core').ContextEvalOptions} [options] */
  const evaluate = (source, filename = "plugin-bootstrap.js", options = {}) => {
    const result = vm.evalCode(source, filename, options);
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
    const result = evaluate(`JSON.stringify((() => {
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
          if (kind === 'templateTags' && (typeof value.name !== 'string' || typeof value.run !== 'function')) throw Error('Template tag requires name and run');
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
      return { name: snapshot.name, ...JSON.parse(json) };
    } finally {
      result.dispose();
    }
  } finally {
    vm.dispose();
  }
}
