import {newQuickJSWASMModuleFromVariant,newVariant} from "quickjs-emscripten-core";
import release from "@jitl/quickjs-wasmfile-release-sync";
import {createPluginVm} from "../../../src/lib/plugin-runtime.js";
import {createPluginDomCallbackLeases} from "../../../src/lib/plugin-dom-callback-leases.js";
/** @type {ReturnType<typeof createPluginVm>|undefined} */ let loaded;
/** @type {ReturnType<typeof createPluginDomCallbackLeases>|undefined} */ let leases;
const owners=new Map(/** @type {[number,{controller:AbortController,current:boolean}][]} */([]));
const failures=/** @type {string[]} */([]);
const source=`exports.make=seed=>{let calls=0;return async arg=>{await Promise.resolve();return {seed,calls:++calls,text:arg.text,negativeZero:Object.is(arg.number,-0)};};};
exports.hold=()=>new Promise(resolve=>{globalThis.releaseHeld=resolve;});
exports.spin=()=>{while(true){}};exports.fail=()=>{throw Error('owned guest callback failure');};`;
self.onmessage=async event=>{
  const message=event.data;
  try {
    let value;
    if(message.type==="init") {
      const wasmBinary=await(await fetch(new URL("./callback-engine.wasm",import.meta.url))).arrayBuffer();
      const engine=await newQuickJSWASMModuleFromVariant(newVariant(release,{wasmBinary}));
      loaded=createPluginVm(engine,{name:"owned-dom-callbacks",entry:"main.cjs",format:"commonjs",files:{"main.cjs":source}});
      leases=createPluginDomCallbackLeases(loaded,{onFatal:error=>failures.push(error.message)});
      value={ready:true};
    } else {
      if(!loaded||!leases)throw Error("Callback fixture not initialized");
      if(message.type==="retain") {
        const kind=message.kind;
        if(!["normal","hold","spin","fail"].includes(kind))throw Error("Unknown fixture callback");
        const handle=loaded.evaluate(kind==="normal"?"__pluginExports.make('ไทย😀')":"__pluginExports."+kind);
        const owner={controller:new AbortController(),current:true};
        try {
          value=leases.retain(handle,{signal:owner.controller.signal,current:()=>owner.current});
          owners.set(value,owner);
        } finally {handle.dispose();}
      } else if(message.type==="invoke")value=await leases.invoke(message.lease,message.args);
      else if(message.type==="detach") {
        const arg={text:"before queue",number:-0};
        const job=leases.invoke(message.lease,[arg]);arg.text="changed after queue";
        value=await job;
      }
      else if(message.type==="release")value=leases.release(message.lease);
      else if(message.type==="abort") {owners.get(message.lease)?.controller.abort();value=true;}
      else if(message.type==="owner-loss") {const owner=owners.get(message.lease);if(owner)owner.current=false;value=true;}
      else if(message.type==="failures")value=failures;
      else if(message.type==="close") {leases.dispose();loaded.vm.dispose();leases=undefined;loaded=undefined;value=true;}
      else throw Error("Unknown callback command");
    }
    self.postMessage({id:message.id,value});
  } catch(error) {self.postMessage({id:message.id,error:String(error)});}
};
