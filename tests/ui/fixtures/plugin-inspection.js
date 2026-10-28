import {inspectBunPluginPackage,decodePluginInspection} from '../../../src/lib/plugin-inspection.js';
import {openBunPluginSession} from '../../../src/lib/plugin-bun-session.js';
import {createPluginRegistry} from '../../../src/lib/plugin-registry.js';
import {createPluginNativeAppEndpoint} from '../../../src/lib/plugin-app-native.js';
import {createPluginDomRenderOwner} from '../../../src/lib/plugin-dom-render-owner.js';
import {createPluginObjectURLs} from '../../../src/lib/plugin-object-urls.js';
import {mount} from 'svelte';
import PluginDomDialogHost from '../../../src/lib/components/PluginDomDialogHost.svelte';
mount(PluginDomDialogHost,{target:document.body.appendChild(document.createElement('div'))});
/** @type {typeof openBunPluginSession} */
const open=(source,options)=>openBunPluginSession(source,{...options,createFileWorker:()=>new Worker('/event-probe/plugin-file-worker.js',{type:'module'})});
Object.assign(window,{__bunPluginInspection:{inspect:inspectBunPluginPackage,decode:decodePluginInspection,open,registry:createPluginRegistry,nativeApp:createPluginNativeAppEndpoint,domOwner:createPluginDomRenderOwner,objectURLs:createPluginObjectURLs}});
