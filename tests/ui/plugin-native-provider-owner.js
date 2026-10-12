import assert from 'node:assert/strict';
import {launchUiBrowser} from './helpers/preview-app.js';
import {mkdir} from 'node:fs/promises';

const output='artifacts/playwright/plugin-native-provider-owner';await mkdir(output,{recursive:true});
const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-native-provider-owner.js'],target:'browser',format:'iife'});
assert.equal(bundle.success,true,bundle.logs.map(String).join('\n'));
const script=await bundle.outputs[0].text();await Bun.write(output+'/fixture.js',script);
const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response('<!doctype html><title>Native provider owner scenario</title>',{headers:{'Content-Type':'text/html'}})});
const browser=await launchUiBrowser();
try{
  const page=await browser.newPage(),errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.port}`);await page.evaluate(script);
  const result=await page.evaluate(()=>/** @type {any} */(window).__nativeProviderOwner.run());
  await Bun.write(output+'/observed.json',JSON.stringify({result,errors},null,2));
  assert.equal(result.rows.length,10);
  for(const row of result.rows){assert.deepEqual(row.beforeRelease.outcome,{sameReason:true});assert.equal(row.beforeRelease.calls,row.method==='app.getInfo'?2:1);assert.equal(row.beforeRelease.removed,1);assert.deepEqual(row.final,{sameReason:true});assert.equal(row.noRedispatch,true);}
  assert.equal(result.staleDenied,true);assert.equal(result.staleCalls,1);assert.equal(result.clipboardTouched,false);assert.deepEqual(errors,[]);
  assert.deepEqual(result.falsyReasons,[true,true,true]);
  const local=await browser.newPage();await local.route('https://tauri.localhost/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Controlled local native lease</title>'}));
  await local.goto('https://tauri.localhost');await local.evaluate(script);
  const renewal=await local.evaluate(()=>/** @type {any} */(window).__nativeProviderOwner.renewal());
  assert.deepEqual(renewal,{begins:2,retired:['lease-1','lease-2'],allocated:1,rejected:true,denied:true});
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:16,result,renewal,errors,limits:'Actual endpoint with documented controlled Tauri IPC and routed local origin for lease lifecycle. No OS clipboard access, native binary acceptance or synchronous native Event gate acceptance.'},null,2));
}finally{await browser.close();server.stop(true);}
