import '../../../src/lib/styles/index.css';
const host=/** @type {any} */(window);
if(host.__TAURI_INTERNALS__?.metadata?.currentWindow?.label!=='main'||!host.__spectralNativeSeed)throw Error('Real main native window and saved seed required');
// Never install the preview IPC shim: preserve the owned host's real Rust invoke.
const shell=document.querySelector('.app-shell');if(shell instanceof HTMLElement)shell.style.display='none';
const target=document.createElement('div');target.dataset.spectralNativeFixture='';document.body.prepend(target);
const {mount}=await import('svelte');const {default:Fixture}=await import('./spectral-api-design-native.svelte');mount(Fixture,{target});
