import assert from 'node:assert/strict';
import {exerciseDomDataset,exerciseDomDatasetEdges} from './plugin-dom-dataset-cases.js';
import {poll} from './native-app.js';

export function pluginDomDatasetNativeSource(){
 return `const capturedDataset={define:Object.defineProperty,defines:Object.defineProperties,reflect:Reflect.defineProperty};
 exports.templateTags.push({name:'nativedataset',run(){return JSON.stringify((${exerciseDomDataset.toString()})(document,DOMStringMap,capturedDataset));}},
 {name:'nativedatasetedges',run(){return JSON.stringify((${exerciseDomDatasetEdges.toString()})(document,DOMStringMap,capturedDataset));}},
 {name:'nativedatasetdialog',run(c){
  const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');body.dataset.original='first';
  const data=body.dataset;button.textContent='Native read dataset';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);
  button.addEventListener('click',()=>{data.callback='guest';status.textContent=JSON.stringify({identity:data===body.dataset,original:data.original,late:data.late,callback:data.callback});});
  c.app.dialog('Native dataset dialog',body,{onHide:async()=>{await Promise.resolve();data.cleanup='done';body.setAttribute('data-dataset-cleanup',JSON.stringify({detached:!body.isConnected,original:data.original,late:data.late,callback:data.callback,cleanup:data.cleanup}));}});
  return 'native-dataset-dialog';
 }});`;
}

/** @param {{page:import('playwright-core').Page,output:string,wire:any[],body:(text:string)=>Promise<void>,send:(expected:string|null)=>Promise<void>}} context */
export async function exercisePluginDomDatasetNative({page,output,wire,body,send}){
 const observed=await page.evaluate(source=>(0,eval)('('+source+')')(document,DOMStringMap),exerciseDomDataset.toString());
 const edgeObserved=await page.evaluate(source=>(0,eval)('('+source+')')(document,DOMStringMap),exerciseDomDatasetEdges.toString());
 const oracle=JSON.parse(JSON.stringify(observed)),edgesOracle=JSON.parse(JSON.stringify(edgeObserved));
 await body('{% nativedataset %}');await send(JSON.stringify(oracle));const guest=JSON.parse(wire.at(-1).body);assert.deepEqual(guest,oracle);
 await body('{% nativedatasetedges %}');await send(JSON.stringify(edgesOracle));const edges=JSON.parse(wire.at(-1).body);assert.deepEqual(edges,edgesOracle);
 await body('{% nativedatasetdialog %}');await send('native-dataset-dialog');const dialog=page.getByRole('dialog',{name:'Native dataset dialog',exact:true});await dialog.waitFor();
 const original=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(original);await original.evaluate(body=>{body.setAttribute('data-original','host');body.setAttribute('data-late','ไทย😀');});
 await dialog.getByRole('button',{name:'Native read dataset',exact:true}).click();
 const retained={identity:true,original:'host',late:'ไทย😀',callback:'guest'};await dialog.getByRole('status').filter({hasText:JSON.stringify(retained)}).waitFor();
 await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'detached'});
 await poll(async()=>await original.getAttribute('data-dataset-cleanup')!==null,'Native detached dataset cleanup');const cleanup=JSON.parse(await original.getAttribute('data-dataset-cleanup')||'null');
 assert.deepEqual(cleanup,{detached:true,original:'host',late:'ไทย😀',callback:'guest',cleanup:'done'});await original.dispose();
 const checks=['Native Send dataset values and attribute reflection match WebView2','Native Send dataset enumeration and receiver reflection match WebView2','Retained native dataset observes independent host mutation and guest callback write','Detached async native onHide reads and writes original owned dataset'];
 const evidence={status:'passed',checks,oracle,guest,edgesOracle,edges,retained,cleanup};await Bun.write(output+'/dom-dataset.json',JSON.stringify(evidence,null,2));return evidence;
}
