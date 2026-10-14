import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withNativeApp} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {nativeEventFixtureAssets} from '../../scripts/prepare-native-event-fixtures.mjs';
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Explicit fresh native transport build required');
const currentAssets=await nativeEventFixtureAssets();
await preserveNativeProfile(async()=>withNativeApp('plugin-dom-event-transport',async({page,output,invoke})=>{
 assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
 const hash=(/** @type {Uint8Array|string} */ bytes)=>createHash('sha256').update(bytes).digest('hex'),assets=/** @type {Record<string,string>} */({});
 for(const name of ['event-fixture.js','event-probe-worker.js','event-engine.wasm']){
  const path='build/event-probe/'+name;assets[path]=hash(await Bun.file(path).bytes());
  const current=currentAssets.get(name);assert.ok(current);
  assert.equal(assets[path],hash(current),`Stale ${name}; run bun scripts/prepare-native-event-fixtures.mjs before rebuilding the native candidate`);
  const served=await page.evaluate(async url=>Array.from(new Uint8Array(await(await fetch(url)).arrayBuffer())),new URL('/event-probe/'+name,page.url()).href);assert.equal(hash(Uint8Array.from(served)),assets[path]);
 }
 await page.evaluate(await Bun.file('build/event-probe/event-fixture.js').text());
 const worker=new URL('/event-probe/event-probe-worker.js',page.url()).href;
 const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__eventChannel[method](...args),{method,args});
 const checks=[],observations=/** @type {any[]} */([]);let lease;
 try{
  await call('open',[worker]);const expected=await call('nativeExpected');lease=await invoke('begin_plugin_event_transport',{ttlMs:20000});
  for(const [key,url] of [['info',lease.infoUrl],['desktop',lease.desktopUrl]]){
   const row=await call('run',['direct-transport',true,false,false,url]);observations.push({key,row});await Bun.write(output+'/partial.json',JSON.stringify({expected,observations,assets},null,2));
   assert.equal(row.error,undefined);assert.equal(row.checked,false);assert.deepEqual(row.result.native,expected[key]);checks.push('Actual native '+key+' reply reaches QuickJS before owned DOM operations and original checkbox cancellation');
  }
  const pointer=call('run',['direct-transport',true,false,true,lease.infoUrl]);await page.getByRole('checkbox',{name:'Probe event checkbox',exact:true}).click();const trusted=await pointer;assert.equal(trusted.error,undefined);assert.equal(trusted.isTrusted,true);assert.equal(trusted.checked,false);assert.deepEqual(trusted.result.native,expected.info);observations.push({trusted});checks.push('Trusted native pointer dispatch receives live Rust reply and cancels the original checkbox');
  for(const kind of ['nested-owned','nested-deep']){const row=await call('run',[kind]);assert.equal(row.error,undefined);assert.equal(row.checked,false);assert.ok(row.nested.every((/** @type {any} */ node)=>node.defaultPrevented));observations.push({kind,row});checks.push(kind+' executes retained QuickJS closure on the original nested native DOM stack');}
  const guards=await call('nestedGuards');assert.equal(guards.length,4);assert.ok(guards.every((/** @type {string} */ row)=>row!=='leaked'));checks.push('Native nested transport rejects foreign, overlapping and abandoned command frames');
  for(const url of [lease.infoUrl.replace('/info?','/store?'),lease.infoUrl.replace(lease.token,'0'.repeat(32))]){const row=await call('run',['direct-transport',true,false,false,url]);assert.match(row.error,/Direct transport refused/);observations.push({refusal:row});await call('open',[worker]);}checks.push('Native protocol refuses unknown operation and invalid capability before DOM/event effects');
  assert.equal(await invoke('end_plugin_event_transport',{token:lease.token}),true);const retired=await call('run',['direct-transport',true,false,false,lease.infoUrl]);assert.match(retired.error,/Direct transport refused/);observations.push({retired});await call('open',[worker]);checks.push('Retired native capability cannot publish metadata or cancel a later event');lease=undefined;
  const expired=await invoke('begin_plugin_event_transport',{ttlMs:100});await page.waitForTimeout(160);const stale=await call('run',['direct-transport',true,false,false,expired.infoUrl]);assert.match(stale.error,/Direct transport refused/);observations.push({expired:stale});await invoke('end_plugin_event_transport',{token:expired.token});await call('open',[worker]);checks.push('Native expiry refuses an otherwise valid worker URL');
  await assert.rejects(invoke('begin_plugin_event_transport',{ttlMs:0}),/lifetime/);checks.push('Native lease admission rejects invalid lifetime');
  await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__eventChannel.records);assert.ok(records.every((/** @type {any} */ row)=>row.terminated));
  const evidence={passed:true,checks,observations,assets,records,clipboardTouched:false,productionEventParityComplete:false,scope:'Fresh Rust/WebView2 read-only transport candidate plus custom event adapter; production guest Event/session adoption, root plugin ownership and clipboard/platform parity remain required.'};
  await Bun.write(output+'/acceptance.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({checks:checks.length,output}));
 }finally{if(lease)await invoke('end_plugin_event_transport',{token:lease.token}).catch(()=>{});await call('close').catch(()=>{});}
}));
