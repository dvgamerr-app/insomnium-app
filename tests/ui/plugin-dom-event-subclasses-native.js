import assert from 'node:assert/strict';
import {withNativeApp} from './helpers/native-app.js';
import {runEventSubclassScenario} from './helpers/plugin-dom-event-subclass-scenario.js';
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Fresh integrated native build required');
await withNativeApp('plugin-dom-event-subclasses-native',async({page,output})=>{assert.equal(await page.evaluate(()=>crossOriginIsolated),true);await runEventSubclassScenario(page,output,{nativeFixturePath:'build/event-probe/event-subclass-fixture.js'});});
