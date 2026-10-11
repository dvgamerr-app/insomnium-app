import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
import {poll} from './helpers/native-app.js';
await withPreview('plugin-dom-tokens',async(page,output)=>{
  const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});
  assert.equal(bundle.success,true,bundle.logs.map(String).join('\n'));await page.evaluate(await bundle.outputs[0].text());
  const names=(await readdir('build/_app/immutable/workers')).filter(path=>path.startsWith('plugin.worker-')&&path.endsWith('.js'));assert.equal(names.length,1);
  const path='build/_app/immutable/workers/'+names[0],url=new URL('/_app/immutable/workers/'+names[0],page.url()).href;
  const hash=(/** @type {Uint8Array|string} */ value)=>createHash('sha256').update(value).digest('hex');
  const workerSha256=hash(await Bun.file(path).bytes());assert.equal(hash(await page.evaluate(async url=>await(await fetch(url)).text(),url)),workerSha256);
  const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginGuestDom[method](...args),{method,args});
  try{
    await call('open',[url]);const oracle=await call('tokenOracle'),guest=await call('tokens');
    await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guest,workerSha256},null,2));
    assert.deepEqual(guest,oracle,'Genuine guest classList must match browser DOMTokenList');
    await call('open',[url,'module']);const guestModule=await call('tokens');assert.deepEqual(guestModule,oracle,'ES module token list must match browser');
    assert.equal(await call('tokenDialog'),'prepared');const dialog=page.getByRole('dialog',{name:'Retained token dialog',exact:true});await dialog.waitFor();
    const original=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(original);await original.evaluate(body=>{body.setAttribute('class','host late');});
    await dialog.getByRole('button',{name:'Read retained tokens',exact:true}).click();
    const retained={identity:true,tokens:['host','late','callback'],value:'host late callback'};await dialog.getByRole('status').filter({hasText:JSON.stringify(retained)}).waitFor();
    await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'detached'});
    await poll(async()=>await original.getAttribute('data-token-cleanup')!==null,'Detached token cleanup');
    const cleanup=JSON.parse(await original.getAttribute('data-token-cleanup')||'null');assert.deepEqual(cleanup,{detached:true,tokens:['host','late','callback','cleanup'],value:'host late callback cleanup'});await original.dispose();
    const guards=await call('tokenGuards');assert.equal(guards.length,8);assert.ok(guards.every((/** @type {string} */ value)=>value!=='leaked'));
    const budget=await call('tokenBudget');assert.match(budget.error,/text limit exceeded/);assert.equal(budget.unchanged,true);
    await call('close');const workers=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(workers.every((/** @type {any} */ worker)=>worker.terminated));
    await Bun.write(output+'/comparison.json',JSON.stringify({oracle,guest,guestModule,workerSha256},null,2));
    await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:[...Object.keys(oracle),'ES module','retained host mutation','detached async cleanup','foreign and malformed token guards','token write quota atomicity'],workerSha256,workers,retained,cleanup,guards,budget,limits:'Owned real DOM/guest differential and retained cleanup; fresh native token acceptance and broader DOM/migration gates remain required.'},null,2));
  }finally{await call('close').catch(()=>{});}
},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
