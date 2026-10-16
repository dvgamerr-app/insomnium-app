import {mount,unmount} from 'svelte';
import Fixture from './plugin-resource-actions.svelte';
import {workspace,pluginRegistry} from '../../../src/lib/workspace.svelte.js';
import {initialData} from '../../../src/lib/model.js';
import {createPluginRegistry} from '../../../src/lib/plugin-registry.js';
import {openPluginSession} from '../../../src/lib/plugin-session.js';
/** @type {ReturnType<typeof mount>|undefined} */let app;
/** @type {ReturnType<typeof createPluginRegistry>|undefined} */let registry;
const name='insomnia-plugin-action-ui';
const source=`exports.requestActions=[{label:'Request action',async action(c,{request}){const label=request.name;request.name='guest edit';await c.app.alert('Run Request action',label);}}];
exports.requestGroupActions=[{label:'Folder action',async action(c,{requestGroup,requests}){if(requestGroup._id!=='group_action'||requests.map(r=>r._id).join(',')!=='req_action,private_action')throw Error('folder arguments');await c.app.alert('Run Folder action',requestGroup.name);}}];
exports.workspaceActions=[{label:'Collection action',async action(c,{workspace,requests,requestGroups}){if(requests.length!==1||requestGroups.length!==1)throw Error('collection privacy');await c.app.alert('Run Collection action',workspace.name);}}];
exports.documentActions=[{label:'Document action',hideAfterClick:true,async action(c,spec){if(c.network!==undefined||spec.format!=='openapi')throw Error('document arguments');await c.app.alert('Run Document action',spec.contents.info.title);}},{label:'Throw action',action(){throw Error('owned action failure');}}];`;
/** @type {any} */(window).__resourceActions={
  /** @param {string} url */
  async open(url,themes=false,moduleFormat=''){
    workspace.data=initialData();workspace.ready=true;
    workspace.data.activeWorkspaceId='wrk_action';
    workspace.data.resources=[{_id:'wrk_action',_type:'workspace',parentId:null,name:'Action collection'},
      {_id:'group_action',_type:'request_group',parentId:'wrk_action',name:'Action folder'},
      {_id:'req_action',_type:'request',parentId:'group_action',name:'Public request',url:'https://example.invalid',metaSortKey:10},
      {_id:'private_action',_type:'request',parentId:'group_action',name:'Private request',isPrivate:true,metaSortKey:20},
      {_id:'spec_action',_type:'api_spec',parentId:'wrk_action',contents:'openapi: 3.1.0\ninfo:\n  title: ไทย\n'}];
    const owner=workspace.data;
    const format=moduleFormat==='module'?'module':'commonjs',entry=moduleFormat?(format==='module'?'index.mjs':'index.cjs'):'index.js';
    const moduleImports=format==='module'
      ?`import stream,{Readable,Transform,Writable} from 'node:stream';import {pipeline} from 'stream/promises';import {Buffer as Imported} from 'node:buffer';import {EventEmitter,once} from 'node:events';import {StringDecoder} from 'node:string_decoder';if(Imported!==Buffer||stream.Readable!==Readable)throw Error('module identity');`
      :`const stream=require('stream'),{Readable,Transform,Writable}=stream,{pipeline}=require('node:stream/promises'),{EventEmitter,once}=require('events'),{StringDecoder}=require('string_decoder');if(require('buffer').Buffer!==Buffer||stream!==require('node:stream'))throw Error('module identity');`;
    const moduleSource=moduleImports+(format==='module'?'export const requestActions=':'exports.requestActions=')+`[{label:'Module pipeline',async action(c){let text='';const bytes=Buffer.from('ไทย'),decoder=new StringDecoder('utf8'),input=Readable.from([Buffer.from('hello'),bytes.subarray(0,1),bytes.subarray(1)]);if(!(input instanceof EventEmitter))throw Error('stream events identity');const emitter=new EventEmitter(),ready=once(emitter,'ready');emitter.emit('ready');await ready;await pipeline(input,new Transform({transform(chunk,enc,done){done(null,decoder.write(chunk));},flush(done){this.push(decoder.end());done();}}),new Writable({write(chunk,enc,done){text+=chunk.toString();done();}}));await c.app.alert('Plugin module pipeline',text);}}];`;
    registry=createPluginRegistry({getContext:()=>({owner,ready:true,settings:{pluginDirectories:['/fixture'],pluginPathMigrationVersion:1}}),
      discover:async()=>({report:{complete:true,packages:[{name,version:'1',directory:'/fixture',entry:'/fixture/'+entry,format,status:'execution-pending'}]}}),
      readPackage:async()=>({name,entry,format,files:{'package.json':JSON.stringify({name,version:'1'}),[entry]:moduleFormat?moduleSource:themes?`exports.themes=[{name:'ocean',displayName:'Ocean',theme:{background:{default:'#123456'},styles:{sidebar:{background:{default:'#234567'}}},rawCss:'[theme="ocean"] { --theme-probe: active; }'}}]`:source}}),
      openSession:(snapshot,options)=>openPluginSession(snapshot,{...options,createWorker:()=>new Worker(url,{type:'module'})})});
    pluginRegistry.captureResourceActions=registry.captureResourceActions.bind(registry);
    pluginRegistry.subscribe=registry.subscribe.bind(registry);
    pluginRegistry.captureThemes=registry.captureThemes.bind(registry);
    await registry.prepare(name);
    const target=document.createElement('div');document.body.appendChild(target);
    app=mount(Fixture,{target,props:{themes}});
  },
  editRequest(/** @type {string} */name){const request=workspace.data.resources.find(r=>r._id==='req_action');if(request)request.name=name;},
  snapshot:()=>JSON.stringify(workspace.data.resources),
  unload(){registry?.invalidate(name);},
  async close(){if(app)await unmount(app);registry?.dispose();},
};
