import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withNativeApp,poll} from './helpers/native-app.js';
import {createClipboardPreserver} from './helpers/clipboard-preservation.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {nativeEventFixtureAssets} from '../../scripts/prepare-native-event-fixtures.mjs';
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Fresh clipboard event build required');
const currentAssets=await nativeEventFixtureAssets();
const protectedClipboard=createClipboardPreserver(),seed='owned-clipboard-'+crypto.randomUUID();
let output,restored=false,primaryError;
let snapshot=/** @type {ReturnType<ReturnType<typeof createClipboardPreserver>['capture']>|undefined} */(undefined);
function boundedError(/** @type {unknown} */ value){const seen=new Set();let count=0;const visit=/** @type {(error:any,depth:number)=>any} */((/** @type {any} */ error,/** @type {number} */ depth)=>{if(depth>6||count++>=32)return{truncated:true};if(!error||typeof error!=='object')return{type:typeof error};if(seen.has(error))return{circular:true};seen.add(error);return{name:String(error.name??'Error').slice(0,80),message:String(error.message??'').split(/\r?\n/,1)[0].slice(0,512),...typeof error.actual==='number'?{actual:error.actual}:{},...typeof error.expected==='number'?{expected:error.expected}:{},...error.cause!==undefined?{cause:visit(error.cause,depth+1)}:{},...error instanceof AggregateError?{errors:Array.from(error.errors).slice(0,16).map(child=>visit(child,depth+1))}:{}};});return visit(value,0);}
try{
 snapshot=protectedClipboard.capture();
 await preserveNativeProfile(async()=>withNativeApp('plugin-dom-event-clipboard-native',async({page,pid,invoke,output:nativeOutput})=>{
  let stage='fixture-preflight';let lease=/** @type {any} */(undefined),diagnosticReceipt=/** @type {any} */(undefined);
  try{
  output=nativeOutput;const assets=/** @type {Record<string,string>} */({}),urls=/** @type {Record<string,string>} */({}),hash=(/** @type {Uint8Array} */ bytes)=>createHash('sha256').update(bytes).digest('hex');
  const fixture='build/event-probe/event-owner-fixture.js';assets[fixture]=hash(await Bun.file(fixture).bytes());const current=currentAssets.get('event-owner-fixture.js');assert.ok(current);assert.equal(assets[fixture],hash(typeof current==='string'?new TextEncoder().encode(current):current),'Embedded clipboard fixture must match current saved generator');const served=await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch('/event-probe/event-owner-fixture.js')).arrayBuffer())));assert.equal(hash(Uint8Array.from(served)),assets[fixture]);
  for(const kind of ['plugin','template']){const files=(await readdir('build/_app/immutable/workers')).filter(name=>name.startsWith(kind+'.worker-')&&name.endsWith('.js'));assert.equal(files.length,1);const path='build/_app/immutable/workers/'+files[0];assets[path]=hash(await Bun.file(path).bytes());urls[kind]=new URL('/_app/immutable/workers/'+files[0],page.url()).href;const bytes=await page.evaluate(async url=>Array.from(new Uint8Array(await(await fetch(url)).arrayBuffer())),urls[kind]);assert.equal(hash(Uint8Array.from(bytes)),assets[path]);}
  await page.evaluate(await Bun.file(fixture).text());const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginDomRenderOwner[method](...args),{method,args});
  const checks=[];let acceptance,scenarioError,lastReceipt,fixtureText='';
  try{
   await call('open',[urls]);fixtureText=await call('clipboardFixture');assert.equal(typeof fixtureText,'string');stage='original-sequence-preflight';protectedClipboard.assertUnchanged();stage='guard-begin';lease=await invoke('begin_plugin_clipboard_probe',{expectedSequence:protectedClipboard.sequence()});assert.equal(lease.sequence,protectedClipboard.sequence());assert.equal(lease.mutations,0);stage='guarded-seed';const seeded=await invoke('write_plugin_clipboard_probe',{token:lease.token,text:seed});lastReceipt=seeded;diagnosticReceipt=seeded;assert.equal(seeded.mutations,1);stage='seed-receipt-admission';protectedClipboard.adoptOwnedReceipt(seeded,pid);
   stage='real-guest-event';assert.equal(await call('renderTerminal',['native-clipboard',seed]),'terminal prepared');const dialog=page.getByRole('dialog',{name:'Native clipboard event dialog',exact:true});await dialog.waitFor();const box=dialog.getByRole('checkbox',{name:'Native clipboard event checkbox',exact:true});await box.click();
   const text=await dialog.getByRole('status').textContent();assert.ok(text);const result=JSON.parse(text);const receipt=await invoke('get_plugin_clipboard_probe',{token:lease.token});lastReceipt=receipt;assert.equal(receipt.mutations,3,'Guarded seed, actual guest write and clear must all be authenticated');assert.equal(receipt.error,null);protectedClipboard.adoptOwnedReceipt(receipt,pid);await Bun.write(output+'/partial.json',JSON.stringify({result,receipt,checked:await box.isChecked(),assets},null,2));assert.deepEqual(result,{beforeMatchesSeed:true,afterMatchesFixture:true,empty:true,write:'undefined',clear:'undefined',prevented:true});assert.equal(await box.isChecked(),false);checks.push('Actual renderer/session/guest/native pointer performs live OS clipboard read/write/read/clear/empty-read with void results before original default cancellation');
   await call('abort');await dialog.waitFor({state:'detached'});await call('close');await poll(async()=>await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records.every((/** @type {any} */ row)=>row.terminated)),'All actual workers terminated');
   const records=await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records);assert.ok(records.every((/** @type {any} */ row)=>row.terminated));checks.push('Owner Abort and close retire original native callbacks/workers');
   acceptance={passed:true,checks,result,assets,records,eventFeatureComplete:false,scope:'Live OS text clipboard operations with complete supported-current-format snapshot/restore; arbitrary formats refuse before mutation. Original held-provider cancellation and full event/native/platform gates remain required.'};
  }catch(error){scenarioError=error;throw error;}finally{try{
   const cleanupErrors=[];
   try{await call('close');}catch(error){cleanupErrors.push(error);}
   if(lease){try{lastReceipt=await invoke('get_plugin_clipboard_probe',{token:lease.token});diagnosticReceipt=lastReceipt;protectedClipboard.adoptOwnedReceipt(lastReceipt,pid);}catch(error){cleanupErrors.push(error);}try{await invoke('end_plugin_clipboard_probe',{token:lease.token});}catch(error){cleanupErrors.push(error);}}
   try{const restoration=protectedClipboard.restore();restored=true;await Bun.write(output+'/clipboard-restoration.json',JSON.stringify({snapshot,restoration,plaintextLogged:false,unsupportedFormatsRefused:true},null,2));}catch(error){cleanupErrors.push(error);if(lease&&lastReceipt){try{protectedClipboard.emergencyRestoreOwnedProbe(lastReceipt,{token:lease.token,ownerProcessId:pid,seed,fixtureText});restored=true;}catch(emergencyError){cleanupErrors.push(emergencyError);}}}
   if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Native clipboard cleanup failed');
  }catch(cleanupError){if(scenarioError)throw new AggregateError([scenarioError,cleanupError],'Native clipboard scenario and restoration failed');throw cleanupError;}}
  assert.ok(restored&&acceptance,'Acceptance requires verified complete restoration');await Bun.write(output+'/acceptance.json',JSON.stringify(acceptance,null,2));
  }catch(error){const diagnostic={stage,leaseStarted:!!lease,restored,snapshotSequence:snapshot?.sequence,receipt:diagnosticReceipt?{sequence:diagnosticReceipt.sequence,mutations:diagnosticReceipt.mutations,owner:diagnosticReceipt.owner,hasError:diagnosticReceipt.error!==null}:null,error:boundedError(error),clipboardBytesLogged:false};try{await Bun.write(nativeOutput+'/clipboard-error.json',JSON.stringify(diagnostic,null,2));}catch(logError){throw new AggregateError([error,logError],'Clipboard failure diagnostic write failed');}throw error;}
 }));
}catch(error){primaryError=error;throw error;}finally{try{
 const cleanupErrors=[];
 try{if(snapshot&&!restored){const restoration=protectedClipboard.restore();if(output)await Bun.write(output+'/clipboard-restoration.json',JSON.stringify({snapshot,restoration,plaintextLogged:false,unsupportedFormatsRefused:true},null,2));}}catch(error){cleanupErrors.push(error);}
 try{protectedClipboard.dispose();}catch(error){cleanupErrors.push(error);}
 if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Final clipboard cleanup failed');
}catch(cleanupError){if(primaryError)throw new AggregateError([primaryError,cleanupError],'Clipboard/profile scenario and final cleanup failed');throw cleanupError;}}
