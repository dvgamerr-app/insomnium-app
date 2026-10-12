import {withPreview} from './helpers/preview-app.js';
import {runEventSubclassScenario} from './helpers/plugin-dom-event-subclass-scenario.js';
await withPreview('plugin-dom-event-subclasses',runEventSubclassScenario,{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}});
