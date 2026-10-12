import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
import {poll} from './helpers/native-app.js';
await withPreview('plugin-dom-event-cancellation',async(page,output)=>{
 const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});
 assert.equal(bundle.success,true,bundle.logs.map(String).join('\n'));await page.evaluate(await bundle.outputs[0].text());
 const files=(await readdir('build/_app/immutable/workers')).filter(path=>/^plugin\.worker-.*\.js$/.test(path));assert.equal(files.length,1);
 const path='build/_app/immutable/workers/'+files[0],workerSha256=createHash('sha256').update(await Bun.file(path).bytes()).digest('hex'),url=new URL('/_app/immutable/workers/'+files[0],page.url()).href;
 const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginGuestDom[method](...args),{method,args});
 let observed;
 try{
  await call('open',[url]);assert.equal(await call('eventCancelBaseline'),'prepared');const dialog=page.getByRole('dialog',{name:'Baseline event cancellation',exact:true});await dialog.waitFor();
  const checkbox=dialog.getByRole('checkbox',{name:'Baseline event checkbox',exact:true});await checkbox.click();await poll(async()=>!!await dialog.getByRole('status').textContent(),'Guest event cancellation result');
  observed={checked:await checkbox.isChecked(),status:await dialog.getByRole('status').textContent(),workerSha256};await Bun.write(output+'/observation.json',JSON.stringify(observed,null,2));
  assert.equal(observed.checked,false,'Guest preventDefault must cancel actual native checkbox activation');assert.equal(observed.status,'cancelled');
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:['Actual production retained guest callback cancels native checkbox activation'],observed},null,2));
 }finally{
  await call('close');const workers=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(workers.every((/** @type {any} */ row)=>row.terminated));
  if(observed)await Bun.write(output+'/observation.json',JSON.stringify({...observed,workers},null,2));
 }
},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
