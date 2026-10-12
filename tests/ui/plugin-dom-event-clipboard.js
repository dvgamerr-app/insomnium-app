import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withPreview} from './helpers/preview-app.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
const token=crypto.randomUUID(),wire=/** @type {any[]} */([]);let text='original fixture text';
await withPreview('plugin-dom-event-clipboard',async(page,output)=>{
 const fixture=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});assert.equal(fixture.success,true);await page.evaluate(await fixture.outputs[0].text());
 const files=(await readdir('build/_app/immutable/workers')).filter(path=>/^plugin\.worker-.*\.js$/.test(path));assert.equal(files.length,1);const path='build/_app/immutable/workers/'+files[0],workerSha256=createHash('sha256').update(await Bun.file(path).bytes()).digest('hex'),url=new URL('/_app/immutable/workers/'+files[0],page.url()).href;
 const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginGuestDom[method](...args),{method,args});const observations=[];
 try{
  await call('open',[url]);await call('clipboardProvider',[Object.fromEntries(['read','write','clear'].map(method=>[method,new URL('/'+token+'/'+method,page.url()).href]))]);
  const value='live ไทย😀 '+crypto.randomUUID();assert.equal(await call('clipboardEvent',[value]),'prepared');const dialog=page.getByRole('dialog',{name:'Clipboard event dialog',exact:true});await dialog.waitFor();const box=dialog.getByRole('checkbox',{name:'Clipboard event checkbox',exact:true});
  for(const before of ['original fixture text','external fixture update']){
   text=before;await box.click();const status=await dialog.getByRole('status').textContent();assert.ok(status);const result=JSON.parse(status);observations.push(result);assert.deepEqual(result,{before,after:value,write:'undefined',clear:'undefined',prevented:true});assert.equal(await box.isChecked(),false);assert.equal(text,'');await page.waitForTimeout(20);
  }
  assert.equal(wire.length,8);for(let offset=0;offset<8;offset+=4){assert.deepEqual(wire.slice(offset,offset+4).map(row=>[row.method,row.action]),[['GET','read'],['POST','write'],['GET','read'],['POST','clear']]);assert.deepEqual(wire[offset+1].body,{text:value});assert.deepEqual(wire[offset+3].body,{});}
  await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */ row)=>row.terminated));
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:['Actual production retained guest routes fresh clipboard read/write/read/clear on original native pointer stack','Independent fixture update remains live and void mutation returns are preserved','Eight exact wire operations finish before original checkbox cancellation; owned worker terminates'],observations,wire,records,workerSha256,osClipboardTouched:false,nativeOsClipboardAccepted:false,scope:'Actual production Event/session/guest with independent Bun HTTP clipboard fixture; no native OS clipboard, held-provider cancellation or complete event parity acceptance.'},null,2));
 }finally{await call('close').catch(()=>{});}
},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'},fetch:async request=>{
 const path=new URL(request.url).pathname;if(!path.startsWith('/'+token+'/'))return undefined;const action=path.split('/').at(-1);let body;
 if(action==='read'&&request.method==='GET'){wire.push({method:'GET',action});return Response.json(text);}
 if(request.method==='POST'){body=await request.json();wire.push({method:'POST',action,body});if(action==='write'&&Object.keys(body).join(',')==='text'&&typeof body.text==='string'){text=body.text;return Response.json(null);}if(action==='clear'&&!Object.keys(body).length){text='';return Response.json(null);}}
 return new Response('refused',{status:403});
}});
