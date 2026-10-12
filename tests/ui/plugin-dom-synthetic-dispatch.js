import {withPreview} from './helpers/preview-app.js';
import {runSyntheticDispatchScenario} from './helpers/plugin-dom-synthetic-scenario.js';
for(const mode of ['invoke','native','host-wait','focus-input-invoke','focus-input-native','focus-input-host-wait','wheel-invoke','wheel-native','wheel-host-wait'])
 await withPreview('plugin-dom-synthetic-dispatch-'+mode,async(page,output)=>{await runSyntheticDispatchScenario(page,output,{mode});},{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
