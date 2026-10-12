import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withNativeApp} from './helpers/native-app.js';
import {withResourceProbePreserved} from './helpers/resource-manager-cases.js';
import {runEventSubclassScenario} from './helpers/plugin-dom-event-subclass-scenario.js';
import {runSyntheticDispatchScenario} from './helpers/plugin-dom-synthetic-scenario.js';
const mode=process.argv[2];assert.ok(['subclasses','invoke','native','host-wait','focus-input-invoke','focus-input-native','focus-input-host-wait'].includes(mode),'Closed current native scenario');assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Current audited candidate required');
await withResourceProbePreserved(async()=>await withNativeApp('plugin-dom-current-native-'+mode,async({page,output})=>{
 assert.equal(await page.evaluate(()=>crossOriginIsolated),true);const workers=(await readdir('build/_app/immutable/workers')).filter(name=>/^plugin\.worker-.*\.js$/.test(name));assert.equal(workers.length,1);const path='build/_app/immutable/workers/'+workers[0],served=await page.evaluate(async url=>Array.from(new Uint8Array(await(await fetch(url)).arrayBuffer())),'/'+path.slice(6)),workerSha256=createHash('sha256').update(await Bun.file(path).bytes()).digest('hex');assert.equal(createHash('sha256').update(Uint8Array.from(served)).digest('hex'),workerSha256,'Actual served current worker exact');
 const options={nativeFixturePath:'build/event-probe/event-subclass-fixture.js'};if(mode==='subclasses')await runEventSubclassScenario(page,output,options);else{const result=await runSyntheticDispatchScenario(page,output,{...options,mode});assert.equal(result.checks.length,mode.startsWith('focus-input-')?7:3);}
 await Bun.write(output+'/current-native-binding.json',JSON.stringify({passed:true,mode,workerSha256,renderingMode:'native-hidden',clipboardTouched:false,eventFeatureComplete:false},null,2));
}));
