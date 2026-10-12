import assert from 'node:assert/strict';
import {assertNativeProbeIdentity,probeIdentifier,resourceCrudProbeIdentifier} from './helpers/native-app.js';
import {assertCrudProfileRestartable} from './helpers/native-profile-ownership.js';

assert.doesNotThrow(()=>assertNativeProbeIdentity(probeIdentifier));
assert.doesNotThrow(()=>assertNativeProbeIdentity(resourceCrudProbeIdentifier,resourceCrudProbeIdentifier));
for(const rejected of ['app.insomnium.desktop','app.insomnium.probe.arbitrary',probeIdentifier+'.extra',resourceCrudProbeIdentifier+'.extra','']){
  assert.throws(()=>assertNativeProbeIdentity(rejected));assert.throws(()=>assertNativeProbeIdentity(rejected,rejected));
}
assert.throws(()=>assertNativeProbeIdentity(resourceCrudProbeIdentifier));assert.throws(()=>assertNativeProbeIdentity(probeIdentifier,resourceCrudProbeIdentifier));
assert.throws(()=>assertCrudProfileRestartable({state:'owned',launches:[{pid:process.pid}]}));
assert.throws(()=>assertCrudProfileRestartable({state:'owned-exited',launches:[{pid:process.pid}]}));
assert.doesNotThrow(()=>assertCrudProfileRestartable({state:'owned-exited',launches:[{pid:process.pid,observedExit:{code:0,observed:Date.now()}}]}));
console.log(JSON.stringify({status:'passed',checks:17,nativeLaunched:false,scope:'Closed identity allowlist/default and live-owned-host restart refusal; no profile or clipboard access'}));
