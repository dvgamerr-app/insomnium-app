import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
import {exerciseEventSurface} from './helpers/plugin-dom-event-cases.js';
await withPreview('plugin-dom-event-surface',async(page,output)=>{
 const oracle=await page.evaluate(source=>new Function('return ('+source+')(Event)')(),exerciseEventSurface.toString());await Bun.write(output+'/oracle.json',JSON.stringify(oracle,null,2));
 const fixture=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});assert.equal(fixture.success,true);await page.evaluate(await fixture.outputs[0].text());
 const files=(await readdir('build/_app/immutable/workers')).filter(name=>/^plugin\.worker-.*\.js$/.test(name));assert.equal(files.length,1);const path='build/_app/immutable/workers/'+files[0],url=new URL('/_app/immutable/workers/'+files[0],page.url()).href,workerSha256=createHash('sha256').update(await Bun.file(path).bytes()).digest('hex');
 const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginGuestDom[method](...args),{method,args});let guest,retained;
 const initialized=[];
 try{
  for(const format of ['commonjs','module']){
   const before=await page.evaluate(()=>performance.now());await call('open',[url,format]);const probe=await call('eventInitialized');const after=await page.evaluate(()=>performance.now());
   assert.deepEqual(probe.surface,oracle);assert.equal(probe.retained,true);assert.equal(probe.initializationDomBlocked,true);assert.equal(probe.privateClockHidden,true);assert.equal(probe.privateCheckpointsHidden,true);
   assert.ok(probe.stamp>=before-5&&probe.stamp<=after+5,'Module Event timestamp uses owning Window origin');assert.ok(probe.later>=probe.stamp&&probe.later<=after+5,'Callback Event uses same monotonic clock');initialized.push({format,before,after,...probe});
  }
  await Bun.write(output+'/initialized.json',JSON.stringify(initialized,null,2));
  await call('open',[url]);guest=await call('eventSurface');await Bun.write(output+'/guest.json',JSON.stringify(guest,null,2));assert.deepEqual(guest,oracle);
  assert.equal(await call('eventRetained'),'prepared');const dialog=page.getByRole('dialog',{name:'Retained Event dialog',exact:true});await dialog.waitFor();const box=dialog.getByRole('checkbox',{name:'Retained Event checkbox',exact:true});await box.click();await dialog.getByRole('status').filter({hasText:'during'}).waitFor();const text=await dialog.getByRole('status').textContent();assert.ok(text);retained={...JSON.parse(text),after:await call('eventRetainedAfter')};await Bun.write(output+'/retained.json',JSON.stringify(retained,null,2));
  assert.deepEqual(retained,{during:{instance:true,tag:'[object Event]',thisTarget:true,target:true,current:true,phase:2,trusted:true,composed:true,own:['isTrusted'],targetWrite:false,phaseWrite:false,trustedWrite:false,path:['box','body'],prevented:true,returnValue:false},after:{current:null,phase:0,path:[],prevented:true,returnValue:false,target:true}});assert.equal(await box.isChecked(),false);
  await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */ row)=>row.terminated));await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:[...Object.keys(oracle),'CommonJS module initialization Event/guarded DOM/private monotonic clock','ES module initialization Event/guarded DOM/private monotonic clock','Actual original native pointer Event brand/read-only identity/cancellation and retained post-return state'],oracle,guest,initialized,retained,records,workerSha256,eventFeatureComplete:false,limits:'Base Event surface; shared identity across native listener callbacks, event subclasses/synthetic dispatch, busy/nested frames, microtask checkpoint ordering and complete migration remain required.'},null,2));
 }finally{await call('close').catch(()=>{});}
},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
