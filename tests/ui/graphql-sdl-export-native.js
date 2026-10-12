import assert from 'node:assert/strict';
import {withNativeApp} from './helpers/native-app.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {exerciseGraphqlSdlExport} from './helpers/graphql-sdl-cases.js';

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Explicit current audited native candidate required');
await withResourceProbePreserved(async()=>{
  await withNativeApp('graphql-sdl-export-native',context=>exerciseGraphqlSdlExport(context,registerResourceProbeCollection));
});
