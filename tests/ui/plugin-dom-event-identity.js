import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
await withPreview('plugin-dom-event-identity',async(page,output)=>{
 const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});assert.equal(bundle.success,true);await page.evaluate(await bundle.outputs[0].text());
 const files=(await readdir('build/_app/immutable/workers')).filter(name=>/^plugin\.worker-.*\.js$/.test(name));assert.equal(files.length,1);const path='build/_app/immutable/workers/'+files[0],url=new URL('/_app/immutable/workers/'+files[0],page.url()).href,workerSha256=createHash('sha256').update(await Bun.file(path).bytes()).digest('hex');
 const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginGuestDom[method](...args),{method,args});
 try{
  await call('open',[url]);assert.equal(await call('eventIdentity'),'prepared');const dialog=page.getByRole('dialog',{name:'Shared Event identity dialog',exact:true});await dialog.waitFor();const box=dialog.getByRole('checkbox',{name:'Shared Event checkbox',exact:true});await box.click();
  const text=await dialog.getByRole('status').textContent(),observations=text?JSON.parse(text):[],errors=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors),checked=await box.isChecked();
  await Bun.write(output+'/observed.json',JSON.stringify({observations,errors,checked,workerSha256},null,2));
  assert.deepEqual(errors,[],'All native listeners enter their retained guest callbacks');
  assert.deepEqual(observations,[{listener:'first',prevented:true,current:true},{listener:'second',same:true,mark:'first listener',prevented:true,current:true},{listener:'parent',same:true,mark:'first listener',prevented:true,current:true,target:true,phase:3}]);assert.equal(checked,false);
  const redispatch=await page.evaluate(()=>{const box=document.querySelector('[aria-label="Shared Event checkbox"]');if(!box)throw Error('Missing owned checkbox');const event=new MouseEvent('click',{bubbles:true,cancelable:true});return {first:box.dispatchEvent(event),second:box.dispatchEvent(event)};});assert.deepEqual(redispatch,{first:false,second:false});
  const retainedText=await dialog.getByRole('status').textContent();assert.ok(retainedText);const retained=JSON.parse(retainedText);assert.equal(retained.length,9);
  assert.deepEqual(retained.slice(3,6),[{listener:'first',prevented:true,current:true,previousSame:false},observations[1],observations[2]]);assert.deepEqual(retained.slice(6),[{listener:'first',prevented:true,current:true,previousSame:true},observations[1],observations[2]]);assert.equal(await box.isChecked(),false);
  assert.deepEqual(await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors),[]);await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */ row)=>row.terminated));
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:['Original pointer identity and expandos across two target listeners and parent bubbling','Distinct native Event has distinct guest identity','Same native Event redispatch preserves retained guest identity/cancellation','All owned callbacks finish without queue refusal and worker terminates'],observations,retained,redispatch,records,workerSha256,eventFeatureComplete:false,limits:'Callbacks draining ready jobs; callbacks held on asynchronous host providers, busy/nested frames, full async Event checkpoint semantics and native Tauri acceptance remain required.'},null,2));
 }finally{await call('close').catch(()=>{});}
},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
