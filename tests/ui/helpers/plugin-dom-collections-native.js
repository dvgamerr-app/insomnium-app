import assert from 'node:assert/strict';
import {exerciseDomCollections} from './plugin-dom-collection-cases.js';
import {poll} from './native-app.js';

export function pluginDomCollectionsNativeSource(){
  return `const collectionReflection={define:Object.defineProperty,defines:Object.defineProperties,reflect:Reflect.defineProperty};
  exports.templateTags.push({name:'nativecollections',run(){return JSON.stringify((${exerciseDomCollections.toString()})(document,NodeList,HTMLCollection,collectionReflection));}},
  {name:'nativecollectiondialog',run(c){
    const body=document.createElement('div'),list=document.createElement('div'),first=document.createElement('span'),button=document.createElement('button'),status=document.createElement('span');
    first.id='first';list.appendChild(first);body.appendChild(list);body.appendChild(button);body.appendChild(status);
    button.textContent='Native read collections';status.setAttribute('role','status');
    const live=list.children,nodes=list.childNodes,staticList=list.querySelectorAll('span');
    button.addEventListener('click',()=>{status.textContent=JSON.stringify({length:live.length,nodes:nodes.length,staticLength:staticList.length,identity:live===list.children,late:live.namedItem('late')===list.querySelector('#late'),first:staticList[0]===first});});
    c.app.dialog('Native collection dialog',body,{onHide:async()=>{await Promise.resolve();body.setAttribute('data-collection-cleanup',JSON.stringify({detached:!body.isConnected,length:live.length,nodes:nodes.length,staticLength:staticList.length}));}});
    return 'native-collection-dialog';
  }});`;
}

/** @param {{page:import('playwright-core').Page,output:string,wire:any[],body:(text:string)=>Promise<void>,send:(expected:string|null)=>Promise<void>}} context */
export async function exercisePluginDomCollectionsNative({page,output,wire,body,send}){
  const oracle=await page.evaluate(source=>(0,eval)('('+source+')')(document,NodeList,HTMLCollection),exerciseDomCollections.toString());
  await body('{% nativecollections %}');await send(JSON.stringify(oracle));
  const guest=JSON.parse(wire.at(-1).body);assert.deepEqual(guest,oracle);
  await body('{% nativecollectiondialog %}');await send('native-collection-dialog');
  const dialog=page.getByRole('dialog',{name:'Native collection dialog',exact:true});await dialog.waitFor();
  const original=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(original);
  await original.evaluate(body=>{const list=body.firstElementChild;if(!list)throw Error('Missing native owned list');const late=document.createElement('span');late.id='late';list.appendChild(late);});
  await dialog.getByRole('button',{name:'Native read collections',exact:true}).click();
  const retained={length:2,nodes:2,staticLength:1,identity:true,late:true,first:true};
  await dialog.getByRole('status').filter({hasText:JSON.stringify(retained)}).waitFor();
  await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'detached'});
  await poll(async()=>await original.getAttribute('data-collection-cleanup')!==null,'Native detached collection cleanup');
  const cleanup=JSON.parse(await original.getAttribute('data-collection-cleanup')||'null');assert.deepEqual(cleanup,{detached:true,length:2,nodes:2,staticLength:1});await original.dispose();
  const checks=['Actual native Send compares all collection/reflection groups against WebView2 DOM with module-captured intrinsics','Original retained native collection facade reads independent host mutation after HTTP completion','Detached native async onHide reads live and static collections before lease retirement'];
  const evidence={status:'passed',checks,oracle,guest,retained,cleanup};await Bun.write(output+'/dom-collections.json',JSON.stringify(evidence,null,2));return evidence;
}
