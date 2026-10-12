import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
const fixtures=new Map(/** @type {[string,()=>Response][]} */([]));
const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
await withPreview('plugin-dom-event-channel',async(page,output)=>{
 const [fixture,worker]=await Promise.all([
  Bun.build({entrypoints:['tests/ui/fixtures/plugin-dom-event-channel.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()]}),
  Bun.build({entrypoints:['tests/ui/fixtures/plugin-dom-event-channel.worker.js'],target:'browser',format:'esm'}),
 ]);
 for(const bundle of [fixture,worker])assert.equal(bundle.success,true,bundle.logs.map(String).join('\n'));
 const workerText=await worker.outputs[0].text(),wasmBytes=Buffer.from(await Bun.file('node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm').bytes());
 fixtures.set('/event-probe-worker.js',()=>new Response(workerText,{headers:{...headers,'Content-Type':'text/javascript'}}));
 fixtures.set('/event-engine.wasm',()=>new Response(wasmBytes,{headers:{...headers,'Content-Type':'application/wasm'}}));
 await page.evaluate(await fixture.outputs[0].text());
 const url=new URL('/event-probe-worker.js',page.url()).href,call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__eventChannel[method](...args),{method,args});
 const checks=[],observations=/** @type {any[]} */([]);
 const wire=/** @type {string[]} */([]),token=crypto.randomUUID(),nativeValue={version:crypto.randomUUID(),platform:'fixture'};
 fixtures.set('/'+token,()=>{wire.push('/'+token);return new Response(JSON.stringify(nativeValue),{headers:{...headers,'Content-Type':'application/json'}});});
 try{
  await call('open',[url]);const normal=await call('run',['normal']);observations.push(normal);assert.equal(normal.error,undefined);assert.equal(normal.defaultPrevented,true);assert.equal(normal.checked,false);assert.equal(normal.dispatched,false);assert.deepEqual(normal.trace,['before','after','peer','parent']);assert.deepEqual(normal.result,{observed:'ไทย😀',cancelled:'true'});checks.push('Actual QuickJS guest/owned DOM operations finish before native checkbox cancellation and dispatch return');
  for(const [kind,trace] of [['stop',['before','after','peer']],['immediate',['before','after']]]){const row=await call('run',[kind]);observations.push(row);assert.equal(row.error,undefined);assert.deepEqual(row.trace,trace);checks.push(kind+' applies to original native event before peer/parent listeners');}
  for(const [cancelable,passive] of [[false,false],[true,true]]){const row=await call('run',['normal',cancelable,passive]);observations.push(row);assert.equal(row.error,undefined);assert.equal(row.defaultPrevented,false);assert.equal(row.checked,true);assert.equal(row.dispatched,true);checks.push('Native uncancelable/passive default activation remains browser-owned');}
  const pointer=call('run',['normal',true,false,true]);await page.getByRole('checkbox',{name:'Probe event checkbox',exact:true}).click();const pointerResult=await pointer;observations.push(pointerResult);assert.equal(pointerResult.isTrusted,true);assert.equal(pointerResult.error,undefined);assert.equal(pointerResult.defaultPrevented,true);assert.equal(pointerResult.checked,false);checks.push('Saved trusted pointer click cancels actual checkbox activation before the native event returns');
  const directURL=new URL('/'+token,page.url()).href,direct=await call('run',['direct-transport',true,false,false,directURL]);observations.push(direct);await Bun.write(output+'/direct-transport.json',JSON.stringify({direct,wire,nativeValue},null,2));assert.equal(direct.error,undefined);assert.deepEqual(direct.result.native,nativeValue);assert.equal(direct.checked,false);assert.deepEqual(wire,['/'+token]);checks.push('Dedicated worker receives live independent HTTP reply while browser native dispatch services owned DOM and cancellation');
  const nested=await call('run',['nested-owned']);await Bun.write(output+'/nested.json',JSON.stringify(nested,null,2));assert.equal(nested.error,undefined);assert.equal(nested.checked,false);
  assert.deepEqual(nested.trace,['before','nested-before','nested-after','nested-peer','nested-before','nested-after','nested-peer','after','peer','parent']);
  assert.deepEqual(nested.nested.map((/** @type {any} */ row)=>row.value.count),[1,2]);assert.ok(nested.nested.every((/** @type {any} */ row)=>row.defaultPrevented&&row.value.seed==='retained nested closure'&&row.value.observed==='retained nested closure'));checks.push('Original owned button.click reenters a retained QuickJS closure twice on the blocked stack, preserving outer native event');
  const deep=await call('run',['nested-deep']);await Bun.write(output+'/nested-deep.json',JSON.stringify(deep,null,2));assert.equal(deep.error,undefined);assert.equal(deep.checked,false);assert.deepEqual(deep.nested.map((/** @type {any} */ row)=>row.value.depth),[2,1,2,1]);assert.deepEqual(deep.nested.map((/** @type {any} */ row)=>row.value.count),[4,3,6,5]);assert.ok(deep.nested.every((/** @type {any} */ row)=>row.defaultPrevented&&row.value.cancelled==='true'));checks.push('Two native owned click levels preserve the same guest closure and restore every outer event/caller frame');
  const nestedGuards=await call('nestedGuards');assert.equal(nestedGuards.length,4);assert.ok(nestedGuards.every((/** @type {string} */ row)=>row!=='leaked'));checks.push('Nested command frames refuse foreign ownership, overlap and abandoned-frame reuse');
  const guards=await call('guards');assert.equal(guards.length,6);assert.ok(guards.every((/** @type {string} */ row)=>row!=='leaked'));checks.push('Foreign/invalid mailbox identity and retired owner cannot dispatch');
  for(const kind of ['oversize','native-promise','reentry','silent','spin']){
   const row=await call('run',[kind]);observations.push(row);assert.match(row.error,/payload limit|synchronous reply|timed out/);assert.ok(row.elapsed<1000);checks.push(kind+' is explicitly refused/terminated within the host bound');await call('open',[url]);
  }
  await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__eventChannel.records);assert.ok(records.every((/** @type {any} */ row)=>row.terminated));
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks,observations,nested,deep,nestedGuards,guards,records,directTransport:{wire,nativeValue},workerSha256:createHash('sha256').update(await worker.outputs[0].text()).digest('hex'),scope:'Saved standalone candidate with real QuickJS/production owned DOM and native browser event; custom event control adapter and Bun HTTP fixture, not production guest Event facade/session adoption, Tauri protocol or native app helper acceptance.',productionEventParityComplete:false},null,2));
 }finally{await call('close').catch(()=>{});fixtures.clear();}
},{headers,fetch:request=>fixtures.get(new URL(request.url).pathname)?.()});
