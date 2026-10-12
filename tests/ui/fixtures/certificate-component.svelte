<script>
 import {tick} from 'svelte';
 import ClientCertificates from '../../../src/lib/components/ClientCertificates.svelte';
 import Button from '../../../src/lib/components/ui/Button.svelte';
 import {workspace,persist,selectWorkspace} from '../../../src/lib/workspace.svelte.js';
 import {isTauri} from '@tauri-apps/api/core';
 import * as dialog from './certificate-component-dialog.js';
 const original=structuredClone($state.snapshot(workspace.data));
 const A='wrk_certificate_owned_a',B='wrk_certificate_owned_b';
 let collection=$state(A),mounted=$state(true);
 function data(){return {...structuredClone(original),activeWorkspaceId:A,activeRequestId:'',openTabs:[],history:[],resources:[A,B].flatMap(id=>[{_id:id,_type:'workspace',parentId:null,name:id===A?'Owned A':'Owned B',scope:'collection',created:1,modified:1},{_id:'crt_'+id,_type:'client_certificate',parentId:id,host:'owned.invalid',cert:'/owned/original.pem',key:null,pfx:null,passphrase:null,disabled:false,isPrivate:true,created:1,modified:1},{_id:'ca_'+id,_type:'ca_certificate',parentId:id,path:'/owned/ca.pem',disabled:false,isPrivate:true,created:1,modified:1}])};}
 workspace.data=data();workspace.ready=true;
 async function reset(){if(dialog.snapshot().pending)throw Error('Reset while pending');mounted=false;await tick();workspace.data=data();workspace.ready=true;await persist();collection=A;mounted=true;await tick();}
 /** @param {string} name */
 async function action(name){if(name==='switch'){collection=collection===A?B:A;selectWorkspace(collection);await persist();}else if(name==='replace'){workspace.data=structuredClone($state.snapshot(workspace.data));}else if(name==='unmount'){mounted=false;}else if(name==='mount'){mounted=true;}else throw Error('Closed lifecycle action');await tick();}
 /** @type {any} */(window).__certificateComponent={reset,action,arm:dialog.arm,release:dialog.release,snapshot:()=>({data:structuredClone($state.snapshot(workspace.data)),collection,mounted,picker:dialog.snapshot(),saved:localStorage.getItem('insomnium-tauri-preview-v1'),workspaceReady:workspace.ready,realNative:isTauri(),hasNativeInternals:!!/** @type {any} */(window).__TAURI_INTERNALS__})};
</script>
<main class="certificate-fixture"><Button onclick={()=>action('switch')}>Switch owned collection</Button><Button onclick={()=>action('unmount')}>Close owned certificate editor</Button>{#if mounted}<ClientCertificates collectionId={collection} collectionName={collection===A?'Owned A':'Owned B'}/>{/if}</main>
<style>.certificate-fixture{padding:16px;max-width:900px;margin:auto}</style>
