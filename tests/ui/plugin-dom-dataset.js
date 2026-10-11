import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
import {poll} from './helpers/native-app.js';
await withPreview('plugin-dom-dataset',async(page,output)=>{
 const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});
 assert.equal(bundle.success,true,bundle.logs.map(String).join('\n'));await page.evaluate(await bundle.outputs[0].text());
 const names=(await readdir('build/_app/immutable/workers')).filter(path=>path.startsWith('plugin.worker-')&&path.endsWith('.js'));assert.equal(names.length,1);
 const path='build/_app/immutable/workers/'+names[0],url=new URL('/_app/immutable/workers/'+names[0],page.url()).href,hash=(/** @type {Uint8Array|string} */ value)=>createHash('sha256').update(value).digest('hex');
 const workerSha256=hash(await Bun.file(path).bytes());assert.equal(hash(await page.evaluate(async url=>await(await fetch(url)).text(),url)),workerSha256);
 const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginGuestDom[method](...args),{method,args});
 try{
  await call('open',[url]);const oracle=await call('datasetOracle');await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guestPending:true,workerSha256},null,2));
  const guest=await call('dataset');await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guest,workerSha256},null,2));
  assert.deepEqual(guest,oracle,'Genuine owned dataset must match browser DOMStringMap');
  const edgesOracle=await call('datasetEdgesOracle'),edges=await call('datasetEdges');
  await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guest,edgesOracle,edges,workerSha256},null,2));
  assert.deepEqual(edges,edgesOracle,'Dataset enumeration and receiver reflection must match browser');
  await call('open',[url,'module']);const guestModule=await call('dataset'),edgesModule=await call('datasetEdges');
  assert.deepEqual(guestModule,oracle);assert.deepEqual(edgesModule,edgesOracle);
  assert.equal(await call('datasetDialog'),'prepared');const dialog=page.getByRole('dialog',{name:'Retained dataset dialog',exact:true});await dialog.waitFor();
  const original=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(original);await original.evaluate(body=>{body.setAttribute('data-original','host');body.setAttribute('data-late','ไทย😀');});
  await dialog.getByRole('button',{name:'Read retained dataset',exact:true}).click();
  const retained={identity:true,original:'host',late:'ไทย😀',callback:'guest'};await dialog.getByRole('status').filter({hasText:JSON.stringify(retained)}).waitFor();
  await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'detached'});
  await poll(async()=>await original.getAttribute('data-dataset-cleanup')!==null,'Detached dataset cleanup');const cleanup=JSON.parse(await original.getAttribute('data-dataset-cleanup')||'null');
  assert.deepEqual(cleanup,{detached:true,original:'host',late:'ไทย😀',callback:'guest',cleanup:'done'});await original.dispose();
  const guards=await call('datasetGuards');assert.equal(guards.length,8);assert.ok(guards.every((/** @type {string} */ value)=>value!=='leaked'));
  const budget=await call('datasetBudget');assert.match(budget.error,/text limit exceeded/);assert.equal(budget.unchanged,true);
  await call('close');const workers=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(workers.every((/** @type {any} */ row)=>row.terminated));
  await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guest,edgesOracle,edges,guestModule,edgesModule,workerSha256},null,2));
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:[...Object.keys(oracle),...Object.keys(edgesOracle),'ES module captured intrinsics','retained host mutation and guest write','detached async cleanup','foreign and malformed dataset guards','dataset quota atomicity'],workerSha256,workers,retained,cleanup,guards,budget,limits:'Owned actual DOM/genuine VM differential and retained cleanup; fresh native dataset acceptance and full migration remain required.'},null,2));
 }finally{await call('close').catch(()=>{});}
},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
