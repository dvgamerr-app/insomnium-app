import {newQuickJSWASMModuleFromVariant,newVariant} from 'quickjs-emscripten-core';
import release from '@jitl/quickjs-wasmfile-release-sync';
import {createPluginVm} from '../../../src/lib/plugin-runtime.js';
import {createPluginValueCodec} from '../../../src/lib/plugin-values.js';
import {createPluginEventCaller,takePluginEventInvocation} from '../../../src/lib/plugin-dom-event-channel.js';
/** @type {ReturnType<typeof createPluginVm>|undefined} */let loaded;
/** @type {ReturnType<typeof createPluginEventCaller>|undefined} */let caller;
const codec=createPluginValueCodec();
/** @type {import('quickjs-emscripten-core').QuickJSHandle|undefined} */let nestedHandle;
self.onmessage=async event=>{
 const message=event.data;
 if(message.type==='init'){
  const wasmBinary=await(await fetch(new URL('./event-engine.wasm',import.meta.url))).arrayBuffer();
  const engine=await newQuickJSWASMModuleFromVariant(newVariant(release,{wasmBinary}));
  loaded=createPluginVm(engine,{name:'event-channel-probe',entry:'main.cjs',format:'commonjs',files:{'main.cjs':'exports.templateTags=[];'}});
  loaded.evaluate(`Object.defineProperty(globalThis,'__pluginValueCodec',{value:(${createPluginValueCodec.toString()})()});`).dispose();
  const vm=loaded.vm;
  const rpc=vm.newFunction('probeEventControl',operation=>vm.newString(caller?.call(vm.getString(operation))??''));
  vm.setProp(vm.global,'__probeEventControl',rpc);rpc.dispose();
  const dom=vm.newFunction('probeDom',operation=>{
   const call=codec.decode(vm.getString(operation));return vm.newString(caller?.call(JSON.stringify({kind:'dom',call}))??'');
  });vm.setProp(vm.global,'__pluginDomSync',dom);dom.dispose();
  nestedHandle=loaded.evaluate(`(()=>{let count=0;const seed='retained nested closure';return (depth,deep)=>{const call=++count,node=document.createElement('span');node.dataset.nested=seed;if(deep&&depth===1)__probeEventControl(JSON.stringify({kind:'invoke-deeper'}));const cancelled=__probeEventControl(JSON.stringify({kind:'event',method:'preventDefault'}));return {seed,count:call,depth,observed:node.dataset.nested,cancelled};};})()`);
  self.postMessage({ready:true});return;
 }
 if(!loaded)return;
 const activeVm=loaded.vm;
 const frames=message.frames;
 const enterNested=(/** @type {number} */ depth)=>{
  const next=frames?.[depth];if(!next)return;
  const command=takePluginEventInvocation(next,message.owner);if(command===undefined)return;
  const saved=caller;caller=createPluginEventCaller(next,message.owner,{poll:()=>enterNested(depth+1)});
  try{if(command!=='retained-nested'||!nestedHandle)throw Error('Invalid nested callback frame');
   const arg=activeVm.newNumber(depth);let value;
   try{value=activeVm.unwrapResult(activeVm.callFunction(nestedHandle,activeVm.undefined,arg,message.kind==='nested-deep'?activeVm.true:activeVm.false));caller.finish(codec.encode(activeVm.dump(value)));}finally{value?.dispose();arg.dispose();}
  }catch(error){caller.finish(String(error),true);}finally{caller=saved;}
 };
 caller=createPluginEventCaller(message.buffer,message.owner,{poll:()=>enterNested(1)});
 const direct=activeVm.newFunction('probeNativeDirect',()=>{
  const xhr=new XMLHttpRequest();xhr.open('GET',message.directURL,false);xhr.timeout=250;xhr.send();
  if(xhr.status!==200)throw Error('Direct transport refused');return activeVm.newString(xhr.responseText);
 });activeVm.setProp(activeVm.global,'__probeNativeDirect',direct);direct.dispose();
 try{
  if(message.kind==='silent')return;
  loaded.resetDeadline();
  const source=`(()=>{
   const event={preventDefault(){return __probeEventControl(JSON.stringify({kind:'event',method:'preventDefault'}));},stopPropagation(){__probeEventControl(JSON.stringify({kind:'event',method:'stopPropagation'}));},stopImmediatePropagation(){__probeEventControl(JSON.stringify({kind:'event',method:'stopImmediatePropagation'}));}};
   ${message.kind==='spin'?'while(true){}':message.kind==='oversize'?"__probeEventControl('x'.repeat(70000));":['native-promise','reentry'].includes(message.kind)?"__probeEventControl(JSON.stringify({kind:"+JSON.stringify(message.kind)+"}));":['nested-owned','nested-deep'].includes(message.kind)?"const body=document.createElement('div'),button=document.createElement('button'),deeper=document.createElement('button');button.textContent='Nested owned control';deeper.id='deeper';body.appendChild(button);body.appendChild(deeper);__pluginGuestDom.app(()=>true).dialog('Nested owned probe',body);__probeEventControl(JSON.stringify({kind:'prepare-owned'}));button.click();button.click();return {cancelled:event.preventDefault()};":"const native="+(message.kind==='direct-transport'?"JSON.parse(__probeNativeDirect())":"undefined")+";const element=document.createElement('div');element.dataset.live='ไทย😀';const observed=element.dataset.live;const cancelled=event.preventDefault();if("+JSON.stringify(message.kind)+"==='immediate')event.stopImmediatePropagation();if("+JSON.stringify(message.kind)+"==='stop')event.stopPropagation();return native?{observed,cancelled,native}:{observed,cancelled};"}
  })()`;
  const result=loaded.evaluate(source);try{caller.finish(codec.encode(loaded.vm.dump(result)));}finally{result.dispose();}
 }catch(error){caller.finish(String(error),true);}
};
