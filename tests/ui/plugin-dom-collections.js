import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
import {poll} from './helpers/native-app.js';
await withPreview('plugin-dom-collections',async(page,output)=>{
  const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});
  assert.equal(bundle.success,true,bundle.logs.map(String).join('\n'));await page.evaluate(await bundle.outputs[0].text());
  const names=(await readdir('build/_app/immutable/workers')).filter(path=>path.startsWith('plugin.worker-')&&path.endsWith('.js'));assert.equal(names.length,1);
  const path='build/_app/immutable/workers/'+names[0],url=new URL('/_app/immutable/workers/'+names[0],page.url()).href;
  const hash=(/** @type {Uint8Array|string} */ value)=>createHash('sha256').update(value).digest('hex');
  const workerSha256=hash(await Bun.file(path).bytes());assert.equal(hash(await page.evaluate(async url=>await(await fetch(url)).text(),url)),workerSha256);
  const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginGuestDom[method](...args),{method,args});
  let oracle,guest,guestModule;
  try{
    await call('open',[url]);oracle=await call('collectionOracle');guest=await call('collections');
    await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guest},null,2));
    assert.equal(await call('collectionDialog'),'prepared');const dialog=page.getByRole('dialog',{name:'Retained collection dialog',exact:true});await dialog.waitFor();
    const original=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(original);
    // Actual host DOM mutation tests retained membership independently of guest writes.
    await original.evaluate(body=>{const list=body.firstElementChild;assertList(list);function assertList(/** @type {Element|null} */ node){if(!node)throw Error('Missing owned list');}
      const extra=document.createElement('span');extra.id='late';extra.textContent='late';list?.appendChild(extra);});
    await dialog.getByRole('button',{name:'Read retained collections',exact:true}).click();
    const expected={length:2,nodes:2,staticLength:1,identity:true,late:true,first:true,version:'retained collection'};
    await dialog.getByRole('status').filter({hasText:JSON.stringify(expected)}).waitFor();
    await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'detached'});
    await poll(async()=>await original.getAttribute('data-collection-cleanup')!==null,'Retained live collections remain readable during detached onHide');
    const cleanup=JSON.parse(await original.getAttribute('data-collection-cleanup')||'null');assert.deepEqual(cleanup,{detached:true,length:2,nodes:2,staticLength:1});await original.dispose();
    const guards=await call('collectionGuards');assert.equal(guards.length,5);assert.ok(guards.every((/** @type {string} */ value)=>value!=='leaked'));
    await call('open',[url,'module']);guestModule=await call('collections');
    await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guest,guestModule},null,2));
    await call('close');await poll(async()=>await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records.every((/** @type {any} */ row)=>row.terminated)),'Owned collection worker terminated');
    await Bun.write(output+'/controls.json',JSON.stringify({retained:expected,cleanup,guards,allWorkersTerminated:true,workerSha256,descriptorParityComplete:false},null,2));
    assert.deepEqual(guest,oracle,'Genuine guest collections must match browser DOM collections');
    assert.deepEqual(guestModule,oracle,'ES module captured intrinsics must match browser DOM collections');
    await Bun.write(output+'/controls.json',JSON.stringify({retained:expected,cleanup,guards,allWorkersTerminated:true,workerSha256,descriptorParityComplete:true},null,2));
    await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:[...Object.keys(oracle),'ES module captured intrinsics','retained host mutation','detached async onHide collections','malformed and foreign graph refusal'],oracle,guest,guestModule,retained:expected,cleanup,guards,workerSha256,limits:'Genuine production VM and actual owned host graph compared with browser DOM. Fresh native collections acceptance remains required; broader DOM/event/private parity remains open.'},null,2));
  }finally{await call('close').catch(()=>{});}
},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
