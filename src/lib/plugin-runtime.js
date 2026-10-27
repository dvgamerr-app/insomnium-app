import {inspectPluginMetadata} from "./plugin-metadata.js";
import { resolvePluginModule, pluginModuleFormat } from "./plugin-modules.js";
import { createPluginTagMetadata } from "./plugin-tag-metadata.js";
import { createPluginValueCodec } from "./plugin-values.js";
import { pluginBufferSource } from "./generated/plugin-buffer.js";
import { createPluginGuestDom,pluginEventHandlerTypes } from "./plugin-guest-dom.js";

/** Load a package in its own bounded VM; caller owns the returned context.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot
 * @param {number} [eventTimeOrigin] Owning Window origin; inspection uses this worker's origin.
 * @param {(url:string)=>void} [onRevokeObjectURL]
 * @param {{owner:()=>number,capture:(id:number)=>number,ready:(id:number)=>void,release:(id:number)=>void}} [taskHooks] */
export function createPluginVm(engine, snapshot, eventTimeOrigin = performance.timeOrigin, onRevokeObjectURL, taskHooks) {
  if (!Number.isFinite(eventTimeOrigin) || eventTimeOrigin < 0)
    throw Error("Invalid plugin Event time origin");
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
  let beginCheckpoint=/** @type {import('quickjs-emscripten-core').QuickJSHandle|undefined} */(undefined);
  let finishCheckpoint=/** @type {import('quickjs-emscripten-core').QuickJSHandle|undefined} */(undefined);
  let taskCount=/** @type {import('quickjs-emscripten-core').QuickJSHandle|undefined} */(undefined);
  let runTask=/** @type {import('quickjs-emscripten-core').QuickJSHandle|undefined} */(undefined);
  const objectURLs=new Map();let objectURLBytes=0;
  const assertObjectURLCapacity=(bytes=0)=>{if(objectURLs.size>=2048)throw Error('Plugin object URL handle limit exceeded');if(!Number.isSafeInteger(bytes)||bytes<0||bytes>128*1024*1024-objectURLBytes)throw Error('Plugin object URL byte limit exceeded');};
  const adoptObjectURL=(/** @type {string} */url,bytes=0,notify=false)=>{assertObjectURLCapacity(bytes);if(typeof url!=='string'||!url.startsWith('blob:')||objectURLs.has(url))throw Error('Invalid native object URL');objectURLs.set(url,{bytes,notify});objectURLBytes+=bytes;};
  const revokeObjectURL=(/** @type {string} */url,notify=true)=>{let key;try{key=new URL(url).href;}catch{return;}if(!objectURLs.has(key))return;URL.revokeObjectURL(key);const entry=objectURLs.get(key);objectURLBytes-=entry.bytes;objectURLs.delete(key);if(notify&&entry.notify)onRevokeObjectURL?.(key);};
  const timeouts=new Map(/** @type {[number,{handle:import('quickjs-emscripten-core').QuickJSHandle,owner:number,at:number,ready:boolean,timer:ReturnType<typeof setTimeout>|undefined}][]} */([]));let timeoutId=0;
  const cancelTimeout=(/** @type {number} */id)=>{const record=timeouts.get(id);if(!record)return false;timeouts.delete(id);clearTimeout(record.timer);record.handle.dispose();taskHooks?.release(id);return true;};
  const cancelTimeouts=()=>{for(const id of timeouts.keys())cancelTimeout(id);};
  const readyTimeout=()=>[...timeouts].find(([,record])=>record.ready&&record.owner===(taskHooks?.owner()??0))?.[0];
  const executeTimeout=(/** @type {number} */id)=>{const record=timeouts.get(id);if(!record?.ready||record.owner!==(taskHooks?.owner()??0))throw Error('Timeout task owner changed');timeouts.delete(id);clearTimeout(record.timer);try{return execute(()=>vm.unwrapResult(vm.callFunction(record.handle,vm.undefined)));}finally{record.handle.dispose();taskHooks?.release(id);}};
  const disposeVm=vm.dispose.bind(vm);
  vm.dispose=()=>{cancelTimeouts();for(const url of objectURLs.keys())URL.revokeObjectURL(url);objectURLs.clear();objectURLBytes=0;for(const hook of[beginCheckpoint,finishCheckpoint,taskCount,runTask])if(hook?.alive)hook.dispose();disposeVm();};
  let nestedCpu=0,creditedWait=0;
  vm.runtime.setMemoryLimit(128 * 1024 * 1024);
  vm.runtime.setMaxStackSize(512 * 1024);
  let deadline = performance.now() + 2000;
  let interrupted=false;
  const throwIfInterrupted=()=>{if(interrupted)throw Error('Plugin execution interrupted');};
  /** @type {number|undefined} */ let pausedAt;
  /** @type {number|undefined} */ let executingAt;
  let pausedExecution = 0;
  // Exclude trusted idle waiting, never time spent executing guest jobs.
  vm.runtime.setInterruptHandler(() => {
    if(performance.now() >=
      deadline +
        (pausedAt === undefined
          ? 0
          : (executingAt ?? pausedAt) - pausedAt - pausedExecution))interrupted=true;
    return interrupted;
  });
  /** @template T @param {()=>T} run @returns {T} */
  const execute = (run) => {
    throwIfInterrupted();
    if (executingAt !== undefined) return run();
    executingAt = performance.now();
    try {
      const result=run();
      // QuickJS can turn an interrupt inside a Promise job into a rejection.
      // Retire the VM even if guest code catches it or the job queue reports success.
      if(interrupted){
        const owned=/** @type {any} */(result);
        if(owned?.dispose)owned.dispose();
        else if(owned?.error?.dispose)owned.error.dispose();
        else if(owned?.value?.dispose)owned.value.dispose();
        throwIfInterrupted();
      }
      return result;
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
  const hasGuestDomTasks=(checkpoint=false)=>{const hook=taskCount;if(!hook)return false;const value=execute(()=>vm.unwrapResult(vm.callFunction(hook,vm.undefined,checkpoint?vm.true:vm.false)));try{return vm.getNumber(value)>0;}finally{value.dispose();}};
  const hasDomTasks=(checkpoint=false)=>hasGuestDomTasks(checkpoint)||!checkpoint&&readyTimeout()!==undefined;
  const executeDomTask=()=>{if(hasGuestDomTasks()){const hook=runTask;if(!hook)throw Error('DOM tasks are unavailable');execute(()=>vm.unwrapResult(vm.callFunction(hook,vm.undefined))).dispose();}else{const id=readyTimeout();if(id!==undefined)executeTimeout(id).dispose();}};
  /** @param {any} error */
  const rejectInitialization=(error)=>{
    try {
      vm.dispose();
    } catch (cleanup) {
      // Keep the original initialization failure observable. The caller owns
      // this isolated worker and must retire it; a failed VM is never reused.
      if (!(error instanceof Error))
        error = new Error(String(error), { cause: error });
      Object.defineProperty(error, "cleanupError", {
        value: (cleanup instanceof Error ? cleanup.message : String(cleanup)).slice(0, 8192),
      });
    }
    throw error;
  };
  try {
    const installCheckpoints=vm.newFunction('installEventCheckpoints',(begin,finish,count,task)=>{
      if(beginCheckpoint||finishCheckpoint||[begin,finish,count,task].some(hook=>vm.typeof(hook)!=='function'))throw Error('Invalid Event checkpoint hooks');
      beginCheckpoint=begin.dup();finishCheckpoint=finish.dup();taskCount=count.dup();runTask=task.dup();
      return vm.undefined;
    });
    try{vm.setProp(vm.global,'__pluginInstallEventCheckpoints',installCheckpoints);}finally{installCheckpoints.dispose();}
    // Capture a clock-only host primitive before package code runs. The private
    // closure performs no RPC and grants no DOM/helper access during loading.
    const scheduleTimeout=vm.newFunction('scheduleTimeout',(callback,milliseconds)=>{
      const delay=vm.getNumber(milliseconds);if(vm.typeof(callback)!=='function'||!Number.isFinite(delay)||delay<0||delay>Number.MAX_SAFE_INTEGER||Math.trunc(delay)!==delay)throw Error('Invalid timeout task');
      if(timeouts.size>=128)throw Error('Plugin timeout task limit exceeded');
      const id=++timeoutId,record={handle:callback.dup(),owner:0,at:performance.now()+delay,ready:false,timer:/** @type {ReturnType<typeof setTimeout>|undefined} */(undefined)};timeouts.set(id,record);
      try{record.owner=taskHooks?.capture(id)??0;const fire=()=>{if(!timeouts.has(id))return;const remaining=record.at-performance.now();if(remaining>0){record.timer=setTimeout(fire,Math.min(remaining,2147483647));return;}record.ready=true;taskHooks?.ready(id);};record.timer=setTimeout(fire,Math.min(delay,2147483647));return vm.undefined;}catch(error){cancelTimeout(id);throw error;}
    });
    try{vm.setProp(vm.global,'__pluginScheduleTimeout',scheduleTimeout);}finally{scheduleTimeout.dispose();}
    const eventClock = vm.newFunction("eventClock", () =>
      vm.newNumber(Math.max(0, performance.timeOrigin - eventTimeOrigin + performance.now())),
    );
    try { vm.setProp(vm.global, "__pluginEventClock", eventClock); }
    finally { eventClock.dispose(); }
    const readBlobSync=vm.newFunction('readBlobSync',(value,length)=>{
      const url=vm.getString(value),size=vm.getNumber(length);if(!objectURLs.has(url)||!Number.isSafeInteger(size)||size<0||size>128*1024*1024)throw Error('Invalid owned synchronous File read');
      const started=performance.now();try{const xhr=new XMLHttpRequest();xhr.open('GET',url,false);xhr.responseType='arraybuffer';xhr.timeout=4000;xhr.send();if(xhr.status!==200||!(xhr.response instanceof ArrayBuffer)||xhr.response.byteLength!==size)throw Error('Owned File could not be read');return vm.newArrayBuffer(xhr.response);}finally{const elapsed=performance.now()-started;creditedWait+=elapsed;if(pausedAt===undefined)deadline+=elapsed;else pausedExecution-=elapsed;}
    });
    try{vm.setProp(vm.global,'__pluginReadBlobSync',readBlobSync);}finally{readBlobSync.dispose();}
    const decodeFileText=vm.newFunction('decodeFileText',(buffer,label)=>{
      const bytes=vm.getArrayBuffer(buffer);
      try{
        // shortcut: Chromium ignores MIME charset, recalibrate when another engine is supported.
        const raw=vm.typeof(label)==='undefined'?'utf-8':vm.getString(label);let encoding;
        try{encoding=new TextDecoder(raw).encoding;}catch{encoding='utf-8';}
        const data=bytes.value;
        if(data[0]===0xef&&data[1]===0xbb&&data[2]===0xbf)encoding='utf-8';
        else if(data[0]===0xff&&data[1]===0xfe)encoding='utf-16le';
        else if(data[0]===0xfe&&data[1]===0xff)encoding='utf-16be';
        // QuickJS newString uses a C string; JSON preserves embedded NULs.
        return vm.newString(JSON.stringify(new TextDecoder(encoding??'utf-8').decode(data)));
      }finally{bytes.dispose();}
    });
    try{vm.setProp(vm.global,'__pluginDecodeFileText',decodeFileText);}finally{decodeFileText.dispose();}
    const createURL=vm.newFunction('createObjectURL',(buffer,type)=>{const bytes=vm.getArrayBuffer(buffer);try{assertObjectURLCapacity(bytes.value.byteLength);const url=URL.createObjectURL(new Blob([new Uint8Array(bytes.value)],{type:vm.getString(type)}));adoptObjectURL(url,bytes.value.byteLength);return vm.newString(url);}finally{bytes.dispose();}});
    const revokeURL=vm.newFunction('revokeObjectURL',url=>{revokeObjectURL(vm.getString(url));return vm.undefined;});
    try{vm.setProp(vm.global,'__pluginCreateObjectURL',createURL);vm.setProp(vm.global,'__pluginRevokeObjectURL',revokeURL);}finally{createURL.dispose();revokeURL.dispose();}
    // Install realm-local collection reflection before modules can capture it.
    // These closures grant no DOM access until the callback runtime binds its
    // guarded transport; initialization itself performs no host operations.
    evaluate(`(() => {
      const parseFileText=JSON.parse;
      const now=globalThis.__pluginEventClock;delete globalThis.__pluginEventClock;const decodeFileText=globalThis.__pluginDecodeFileText;delete globalThis.__pluginDecodeFileText;const readBlobSync=globalThis.__pluginReadBlobSync;delete globalThis.__pluginReadBlobSync;const createURL=globalThis.__pluginCreateObjectURL,revokeURL=globalThis.__pluginRevokeObjectURL,scheduleTimeout=globalThis.__pluginScheduleTimeout;delete globalThis.__pluginScheduleTimeout;delete globalThis.__pluginCreateObjectURL;delete globalThis.__pluginRevokeObjectURL;
      const dom=(${createPluginGuestDom.toString()})((method,args)=>__pluginValueCodec.decode(__pluginDomSync(__pluginValueCodec.encode({method,args}))),callback=>__pluginRetainDomCallback(callback),now,${JSON.stringify(pluginEventHandlerTypes)},(buffer,label)=>parseFileText(decodeFileText(buffer,label)),createURL,revokeURL,scheduleTimeout,readBlobSync);
      const {beginEventCheckpoint,finishEventCheckpoint,hasDomTasks,executeDomTask,...publicDom}=dom;
      __pluginInstallEventCheckpoints(beginEventCheckpoint,finishEventCheckpoint,hasDomTasks,executeDomTask);delete globalThis.__pluginInstallEventCheckpoints;
      Object.defineProperty(globalThis,'__pluginGuestDom',{value:Object.freeze(publicDom),writable:false,configurable:false});
      for(const key of ['document','window','self','AbstractRange','StaticRange','DataTransfer','DataTransferItem','DataTransferItemList','EventTarget','FileReader','FileReaderSync','AbortController','AbortSignal','Event','UIEvent','MouseEvent','DragEvent','PointerEvent','WheelEvent','KeyboardEvent','FocusEvent','InputEvent','CompositionEvent','TextEvent','AnimationEvent','TransitionEvent','DeviceOrientationEvent','DeviceMotionEvent','DeviceMotionEventAcceleration','DeviceMotionEventRotationRate','BeforeUnloadEvent','CloseEvent','ProgressEvent','HashChangeEvent','ErrorEvent','MessageEvent','StorageEvent','SubmitEvent','CustomEvent','Node','CharacterData','Text','Comment','HTMLElement','DocumentFragment','FileList','NodeList','HTMLCollection','DOMTokenList','DOMStringMap','DOMException'])Object.defineProperty(globalThis,key,{value:dom[key],writable:false,configurable:false});
    })();`, "plugin-dom-bootstrap.js").dispose();
    const endings=vm.newString(new Blob(['\n'],{endings:'native'}).size===2?'\r\n':'\n');
    try{vm.setProp(vm.global,'__pluginNativeEndings',endings);}finally{endings.dispose();}
    evaluate(pluginBufferSource, "plugin-buffer.js").dispose();
    vm.runtime.setModuleLoader(
      (name) => {
        if(name==='insomnium:url')return 'export const {URL,URLSearchParams,Url,parse,format,resolve,resolveObject}=globalThis.__pluginUrlModule;export default globalThis.__pluginUrlModule;';
        if(name==='insomnium:buffer')return 'export const {Buffer,SlowBuffer,INSPECT_MAX_BYTES,kMaxLength,Blob,File}=globalThis.__pluginBufferModule;export default globalThis.__pluginBufferModule;';
        if(name==='insomnium:events')return 'export const {EventEmitter,once,listenerCount,defaultMaxListeners}=globalThis.__pluginEventsModule;export default globalThis.__pluginEventsModule;';
        if(name==='insomnium:string_decoder')return 'export const {StringDecoder}=globalThis.__pluginStringDecoderModule;export default globalThis.__pluginStringDecoderModule;';
        if(name==='insomnium:stream')return 'export const {Stream,Readable,Writable,Duplex,Transform,PassThrough,pipeline,finished,compose,addAbortSignal,destroy,isDestroyed,isDisturbed,isErrored,isReadable,isWritable,getDefaultHighWaterMark,setDefaultHighWaterMark,promises}=globalThis.__pluginStreamModule;export default globalThis.__pluginStreamModule;';
        if(name==='insomnium:stream/web')return 'export const {ReadableStream,ReadableStreamDefaultReader,ReadableStreamBYOBReader,ReadableStreamDefaultController,ReadableByteStreamController,ReadableStreamBYOBRequest,WritableStream,WritableStreamDefaultWriter,WritableStreamDefaultController,TransformStream,TransformStreamDefaultController,ByteLengthQueuingStrategy,CountQueuingStrategy}=globalThis.__pluginWebStreamsModule;export default globalThis.__pluginWebStreamsModule;';
        if(name==='insomnium:stream/promises')return 'export const {pipeline,finished}=globalThis.__pluginStreamPromises;export default globalThis.__pluginStreamPromises;';
        const format = pluginModuleFormat(files, name);
        if (format === "module") return files[name].replace(/^\uFEFF/, "");
        return `export default globalThis.__requirePluginModule(${JSON.stringify(name)});`;
      },
      (parent, request) => resolvePluginModule(files, request, parent, 'import'),
    );
    evaluate(`(() => {
      const files = ${JSON.stringify(files)};
      const resolvePluginModule = ${resolvePluginModule.toString()};
      const pluginModuleFormat = ${pluginModuleFormat.toString()};
      const cache = Object.create(null);
      globalThis.__requirePluginModule = function load(id, parent = null) {
        if(id==='insomnium:url')return globalThis.__pluginUrlModule;
        if(id==='insomnium:buffer')return globalThis.__pluginBufferModule;
        if(id==='insomnium:events')return globalThis.__pluginEventsModule;
        if(id==='insomnium:string_decoder')return globalThis.__pluginStringDecoderModule;
        if(id==='insomnium:stream')return globalThis.__pluginStreamModule;
        if(id==='insomnium:stream/web')return globalThis.__pluginWebStreamsModule;
        if(id==='insomnium:stream/promises')return globalThis.__pluginStreamPromises;
        const filename = '/' + id;
        const attach = child => {
          if (parent && !parent.children.includes(child)) parent.children.push(child);
        };
        if (Object.hasOwn(cache, filename)) {
          attach(cache[filename]);
          return cache[filename].exports;
        }
        const format = pluginModuleFormat(files, id);
        if (format === 'module') throw Error('CommonJS require of an ES module is not supported yet: ' + id);
        const dirname = filename.slice(0, filename.lastIndexOf('/')) || '/';
        const module = { exports: {}, id: filename, filename, path: dirname, loaded: false, parent, children: [] };
        cache[filename] = module;
        attach(module);
        try {
          if (format === 'json') module.exports = JSON.parse(files[id]);
          else {
            const source = files[id].replace(/^\\uFEFF/, '').replace(/^#![^\\n]*\\n/, '\\n');
            const run = new Function('module', 'exports', 'require', '__filename', '__dirname', source);
            const resolve = request => typeof request === 'string' && request.startsWith('/')
              ? resolvePluginModule(files, '.' + request, '')
              : resolvePluginModule(files, request, id);
            const require = request => load(resolve(request), module);
            require.cache = cache;
            require.resolve = request => {
              const resolved = resolve(request);
              return resolved.startsWith('insomnium:')
                ? (request.startsWith('node:') ? 'node:' : '') + resolved.slice('insomnium:'.length)
                : '/' + resolved;
            };
            module.require = require;
            run.call(module.exports, module, module.exports, require, filename, dirname);
          }
          module.loaded = true;
          return module.exports;
        } catch (error) {
          delete cache[filename];
          if (parent) {
            const index = parent.children.indexOf(module);
            if (index !== -1) parent.children.splice(index, 1);
          }
          throw error;
        }
      };
    })();`).dispose();
    const ready=(async()=>{
    if (snapshot.format === "module") {
      const initialization = evaluate(
        `import * as exports from ${JSON.stringify("./" + snapshot.entry)};globalThis.__pluginExports=exports;`,
        "plugin-entry.mjs",
        { type: "module" },
      );
      try {
        // Module evaluation can finish only after its original native jobs.
        // Initialization remains outside all callback/helper owner scopes.
        while (true) {
          if(performance.now()>=deadline)throw Error("Plugin module initialization interrupted");
          const state = vm.getPromiseState(initialization);
          if (state.type === "rejected") {
            try { const error = vm.dump(state.error);throw Error(error?.message || String(error) || "Plugin module initialization failed"); }
            finally { state.error.dispose(); }
          }
          const ready = state.type === "fulfilled";
          if (ready && !state.notAPromise) state.value.dispose();
          if (!vm.runtime.hasPendingJob()) {
            if(hasDomTasks()){executeDomTask();continue;}
            if(!ready){
              const at=Math.min(...[...timeouts.values()].filter(record=>record.owner===0).map(record=>record.at));
              if(!Number.isFinite(at))throw Error('Plugin module initialization is pending without executable guest jobs');
              await new Promise(resolve=>setTimeout(resolve,Math.max(1,Math.min(at-performance.now(),deadline-performance.now()))));continue;
            }
            break;
          }
          // Tiny jobs can finish before QuickJS next polls its interrupt hook.
          // Keep the original initialization deadline at every job boundary.
          if (performance.now() >= deadline) throw Error("Plugin module initialization interrupted");
          const jobs = execute(() => vm.runtime.executePendingJobs(1));
          if (jobs.error) {
            try { throw Error(vm.dump(jobs.error)?.message || "Plugin module initialization job failed"); }
            finally { jobs.error.dispose(); }
          }
        }
      } finally { initialization.dispose(); }
    } else {
      evaluate(
        `globalThis.__pluginExports=globalThis.__requirePluginModule(${JSON.stringify(snapshot.entry)});`,
      ).dispose();
      while(vm.runtime.hasPendingJob()||hasDomTasks()){
        if(performance.now()>=deadline)throw Error('Plugin module initialization interrupted');
        if(!vm.runtime.hasPendingJob()){executeDomTask();continue;}
        const jobs=execute(()=>vm.runtime.executePendingJobs(1));if(jobs.error){try{throw Error(vm.dump(jobs.error)?.message||'Plugin module initialization job failed');}finally{jobs.error.dispose();}}
      }
    }
    })().catch(rejectInitialization);
    return {
      ready,
      cancelTimeout,
      cancelTimeouts,
      readyTimeouts:()=>[...timeouts].filter(([,record])=>record.ready).map(([id])=>id),
      executeTimeout,
      vm,
      evaluate,
      hasDomTasks,
      executeDomTask,
      assertObjectURLCapacity,
      adoptObjectURL,
      /** @param {string[]} urls */
      releaseObjectURLs(urls){for(const url of urls)revokeObjectURL(url,false);},
      beginDomEventCheckpoint(){const hook=beginCheckpoint;if(!hook)throw Error('Event checkpoint is unavailable');execute(()=>vm.unwrapResult(vm.callFunction(hook,vm.undefined))).dispose();},
      finishDomEventCheckpoint(){const hook=finishCheckpoint;if(!hook)throw Error('Event checkpoint is unavailable');execute(()=>vm.unwrapResult(vm.callFunction(hook,vm.undefined))).dispose();},
      /** Keep reentered guest execution charged even inside an outer host wait.
       * @template T @param {()=>T} run @returns {T} */
      executeNativeNested(run){const started=performance.now(),beforeCpu=nestedCpu,beforeWait=creditedWait;try{return run();}finally{nestedCpu+=Math.max(0,performance.now()-started-(creditedWait-beforeWait)-(nestedCpu-beforeCpu));}},
      beginHostWait:()=>({started:performance.now(),nestedCpu,creditedWait}),
      resetDeadline: (budget = 2000) => {
        throwIfInterrupted();
        if(![2000,5000].includes(budget))throw Error("Invalid plugin CPU budget");
        deadline = performance.now() + budget;
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
      throwIfInterrupted,
      /** Bounded host waiting is not guest execution; this hook stays in worker.
       * @param {{started:number,nestedCpu:number,creditedWait:number}} wait */
      accountHostWait(wait) {
        if (!wait||Object.values(wait).some(value=>!Number.isFinite(value)||value<0))
          throw Error("Invalid plugin host wait accounting");
        const milliseconds=Math.max(0,performance.now()-wait.started-(nestedCpu-wait.nestedCpu)-(creditedWait-wait.creditedWait));
        creditedWait+=milliseconds;
        if (pausedAt === undefined) deadline += milliseconds;
        else pausedExecution -= milliseconds;
      },
      abortExecution() {
        interrupted=true;
        deadline = -Infinity;
      },
    };
  } catch (error) { return rejectInitialization(error); }
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
  const result = evaluate(`__pluginMetadataCodec.encode((${inspectPluginMetadata.toString()})(__pluginExports,__pluginTagMetadata))`);
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
export async function inspectPluginExportsIsolated(engine, snapshot) {
  const loaded = createPluginVm(engine, snapshot);
  await loaded.ready;
  try {
    return inspectPluginVm(loaded, snapshot.name);
  } finally {
    loaded.vm.dispose();
  }
}
