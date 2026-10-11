import assert from 'node:assert/strict';
import {exerciseDomTokens} from './plugin-dom-token-cases.js';
import {poll} from './native-app.js';

export function pluginDomTokensNativeSource(){
  return `exports.templateTags.push({name:'nativetokens',run(){return JSON.stringify((${exerciseDomTokens.toString()})(document,DOMTokenList));}},
  {name:'nativetokendialog',run(c){
    const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');body.className='original';
    const tokens=body.classList;button.textContent='Native read tokens';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);
    button.addEventListener('click',()=>{tokens.add('callback');status.textContent=JSON.stringify({identity:tokens===body.classList,tokens:[...tokens],value:tokens.value});});
    c.app.dialog('Native token dialog',body,{onHide:async()=>{await Promise.resolve();tokens.add('cleanup');body.setAttribute('data-token-cleanup',JSON.stringify({detached:!body.isConnected,tokens:[...tokens],value:tokens.value}));}});
    return 'native-token-dialog';
  }});`;
}

/** @param {{page:import('playwright-core').Page,output:string,wire:any[],body:(text:string)=>Promise<void>,send:(expected:string|null)=>Promise<void>}} context */
export async function exercisePluginDomTokensNative({page,output,wire,body,send}){
  const observed=await page.evaluate(source=>(0,eval)('('+source+')')(document,DOMTokenList),exerciseDomTokens.toString());
  // Actual HTTP bodies use JSON; compare the oracle through that same codec.
  const oracle=JSON.parse(JSON.stringify(observed));
  await body('{% nativetokens %}');await send(JSON.stringify(oracle));const guest=JSON.parse(wire.at(-1).body);assert.deepEqual(guest,oracle);
  await body('{% nativetokendialog %}');await send('native-token-dialog');const dialog=page.getByRole('dialog',{name:'Native token dialog',exact:true});await dialog.waitFor();
  const original=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(original);await original.evaluate(body=>body.setAttribute('class','host late'));
  await dialog.getByRole('button',{name:'Native read tokens',exact:true}).click();
  const retained={identity:true,tokens:['host','late','callback'],value:'host late callback'};await dialog.getByRole('status').filter({hasText:JSON.stringify(retained)}).waitFor();
  await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'detached'});
  await poll(async()=>await original.getAttribute('data-token-cleanup')!==null,'Native detached token cleanup');const cleanup=JSON.parse(await original.getAttribute('data-token-cleanup')||'null');
  assert.deepEqual(cleanup,{detached:true,tokens:['host','late','callback','cleanup'],value:'host late callback cleanup'});await original.dispose();
  const checks=['Actual native Send compares DOMTokenList mutation/reflection/DOMException groups against WebView2 DOM','Original native classList observes host mutation and guest write in retained callback after Send','Detached async native onHide reads and updates the original owned classList'];
  const evidence={status:'passed',checks,oracle,guest,retained,cleanup};await Bun.write(output+'/dom-tokens.json',JSON.stringify(evidence,null,2));return evidence;
}
