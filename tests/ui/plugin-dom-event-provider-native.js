import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withNativeApp,poll} from './helpers/native-app.js';
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Fresh production event build required');
await withNativeApp('plugin-dom-event-production',async({page,output})=>{
 const hash=(/** @type {Uint8Array} */ bytes)=>createHash('sha256').update(bytes).digest('hex'),assets=/** @type {Record<string,string>} */({}),urls=/** @type {Record<string,string>} */({});
 assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
 const fixture='build/event-probe/event-owner-fixture.js';assets[fixture]=hash(await Bun.file(fixture).bytes());
 const served=await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch('/event-probe/event-owner-fixture.js')).arrayBuffer())));assert.equal(hash(Uint8Array.from(served)),assets[fixture]);
 for(const kind of ['plugin','template']){
  const files=(await readdir('build/_app/immutable/workers')).filter(name=>name.startsWith(kind+'.worker-')&&name.endsWith('.js'));assert.equal(files.length,1);
  const path='build/_app/immutable/workers/'+files[0];assets[path]=hash(await Bun.file(path).bytes());urls[kind]=new URL('/_app/immutable/workers/'+files[0],page.url()).href;
  const served=await page.evaluate(async url=>Array.from(new Uint8Array(await(await fetch(url)).arrayBuffer())),urls[kind]);assert.equal(hash(Uint8Array.from(served)),assets[path]);
 }
 await page.evaluate(await Bun.file(fixture).text());
 const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginDomRenderOwner[method](...args),{method,args});
 const checks=[],observations=/** @type {any[]} */([]);
 try{
  if(process.env.INSOMNIUM_NATIVE_PROVIDER_LIFECYCLE==='1'){
   const source='build/event-probe/native-provider-lifecycle.js';assets[source]=hash(await Bun.file(source).bytes());
   const served=await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch('/event-probe/native-provider-lifecycle.js')).arrayBuffer())));assert.equal(hash(Uint8Array.from(served)),assets[source]);
   await page.evaluate(await Bun.file(source).text());const result=await page.evaluate(()=>/** @type {any} */(window).__nativeProviderLifecycle.run());
   await Bun.write(output+'/native-provider-lifecycle.json',JSON.stringify(result,null,2));
   assert.deepEqual(result.protocolInfo,result.info);assert.deepEqual(result.renewedInfo,result.info);assert.equal(result.protocolDesktop,result.desktop);
   assert.equal(result.changedLease,true);assert.equal(result.oldStatus,403);assert.equal(result.retiredStatus,403);assert.equal(result.aborted,true);assert.equal(result.eventDenied,true);assert.equal(result.clipboardTouched,false);
   checks.push('Actual native info/Desktop endpoint agrees with independently leased provider; refresh retires old lease and owner Abort retires replacement/denies further dispatch');
  }
  await call('open',[urls]);const expected=await call('nativeExpected');assert.equal(await call('renderTerminal',['native-event']),'terminal prepared');
  const dialog=page.getByRole('dialog',{name:'Native app event dialog',exact:true});await dialog.waitFor();const box=dialog.getByRole('checkbox',{name:'Native app event checkbox',exact:true});
  for(const round of ['initial','renewed']){
   if(round==='renewed')await page.waitForTimeout(21000);
   await box.click();const text=await dialog.getByRole('status').textContent();assert.ok(text);const result=JSON.parse(text);observations.push({round,result,checked:await box.isChecked()});await Bun.write(output+'/partial.json',JSON.stringify({expected,observations,assets},null,2));
   assert.deepEqual(result,{...expected,prevented:true,current:true,trusted:true});assert.equal(await box.isChecked(),false);checks.push(round+': actual renderer/session/guest Event receives fresh Rust info/Desktop and cancels native pointer activation');
  }
  const body=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(body);const status=await dialog.getByRole('status').textContent();await call('abort');await dialog.waitFor({state:'detached'});
  await body.evaluate(element=>/** @type {HTMLInputElement} */(element.querySelector('input')).click());assert.equal(await body.evaluate(element=>element.querySelector('[role=status]')?.textContent),status);await body.dispose();checks.push('Original request owner Abort removes retained native event listener and prevents detached late helper invocation');
  await call('close');await poll(async()=>await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records.every((/** @type {any} */ row)=>row.terminated)),'Owned production and template workers terminated');
  const records=await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records);assert.ok(records.length&&records.every((/** @type {any} */ row)=>row.terminated));
  await Bun.write(output+'/acceptance.json',JSON.stringify({passed:true,checks,expected,observations,assets,records,clipboardTouched:false,eventFeatureComplete:false,scope:'Actual registry/request renderer/render-independent owner/session/retained QuickJS/guest native Event/independent Rust providers. Clipboard, busy/nested frames and complete Event parity remain required.'},null,2));
 }finally{await call('close').catch(()=>{});}
});
