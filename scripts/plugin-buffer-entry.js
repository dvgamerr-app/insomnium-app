import {installPluginFiles} from './plugin-file-runtime.js';
import { Readable, Stream } from "readable-stream/lib/ours/browser.js";
import { Buffer, SlowBuffer, INSPECT_MAX_BYTES, kMaxLength } from "buffer/";
import EventEmitter from 'events';
import {StringDecoder} from 'string_decoder/';
import legacyUrl from 'url/url.js';
import URL from 'core-js-pure/actual/url/index.js';
import URLSearchParams from 'core-js-pure/actual/url-search-params/index.js';
import * as webStreams from 'web-streams-polyfill';
// This runs inside the isolated QuickJS VM, never the application global.
const nativeEndings=globalThis.__pluginNativeEndings;delete globalThis.__pluginNativeEndings;
const {Blob,File}=installPluginFiles(Buffer,StringDecoder,webStreams,nativeEndings,kMaxLength);
for(const [name,value]of Object.entries(webStreams))Object.defineProperty(globalThis,name,{value,writable:false,configurable:false});
Object.defineProperty(globalThis,'__pluginWebStreamsModule',{value:Object.freeze({...webStreams})});
globalThis.Buffer = Buffer;
Object.defineProperty(globalThis, "__pluginBuffer", { value: Buffer });
Object.defineProperty(globalThis, "__pluginBufferModule", {
  value:Object.freeze({Buffer,SlowBuffer,INSPECT_MAX_BYTES,kMaxLength,Blob,File}),
});

Object.defineProperty(globalThis, "__pluginReadable", { value: Readable });
Object.defineProperty(globalThis, "__pluginStreamModule", { value: Stream });
Object.defineProperty(globalThis, "__pluginStreamPromises", { value: Stream.promises });
Object.defineProperty(globalThis, "__pluginEventsModule", { value: EventEmitter });
Object.defineProperty(globalThis, "__pluginStringDecoderModule", { value:Object.freeze({StringDecoder}) });
if(globalThis.__pluginGuestDom)Object.defineProperties(URL,{createObjectURL:{value:globalThis.__pluginGuestDom.createObjectURL,writable:true,enumerable:true,configurable:true},revokeObjectURL:{value:globalThis.__pluginGuestDom.revokeObjectURL,writable:true,enumerable:true,configurable:true}});
globalThis.URL = URL;
globalThis.URLSearchParams = URLSearchParams;
Object.defineProperty(globalThis, "__pluginUrlModule", { value:Object.assign(legacyUrl, {URL, URLSearchParams}) });
