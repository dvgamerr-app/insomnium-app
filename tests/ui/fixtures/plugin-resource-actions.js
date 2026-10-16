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
      ?`import url,{parse as parseUrl} from 'node:url';import stream,{Readable,Transform,Writable} from 'node:stream';import {pipeline} from 'stream/promises';import {Buffer as Imported} from '#codec';import prefix from '${name}/self';import suffix from 'fixture-dep';import {EventEmitter,once} from 'node:events';import {StringDecoder} from 'node:string_decoder';if(Imported!==Buffer||stream.Readable!==Readable||suffix.mode!=='module')throw Error('module identity');`
      :`const url=require('url'),parseUrl=url.parse;const stream=require('stream'),{Readable,Transform,Writable}=stream,{pipeline}=require('node:stream/promises'),{EventEmitter,once}=require('events'),{StringDecoder}=require('string_decoder'),prefix=require('${name}/self'),suffix=require('fixture-dep');if(require('#codec').Buffer!==Buffer||stream!==require('node:stream')||suffix.mode!=='commonjs')throw Error('module identity');`;
    const moduleSource=moduleImports+(format==='module'?'export const requestActions=':'exports.requestActions=')+`[{label:'Module pipeline',async action(c){const modern=new url.URL('../next?q=ไทย&q=two','https://example.invalid/a/b');if(url.URL!==URL||url.URLSearchParams!==URLSearchParams||modern.pathname!=='/next'||modern.searchParams.getAll('q').join('|')!=='ไทย|two')throw Error('WHATWG URL');modern.searchParams.set('q','ไทย space');if(modern.search!=='?q=%E0%B9%84%E0%B8%97%E0%B8%A2+space'||new URLSearchParams(modern.search).get('q')!=='ไทย space'||URL.canParse('invalid')||URL.parse('invalid')!==null)throw Error('URLSearchParams');const parsed=parseUrl('https://example.invalid/a?word=%E0%B9%84%E0%B8%97%E0%B8%A2',true);if(parsed.query.word!=='ไทย'||url.format(parsed)!=='https://example.invalid/a?word=%E0%B9%84%E0%B8%97%E0%B8%A2'||url.resolve(parsed.href,'../next')!=='https://example.invalid/next')throw Error('URL module');let text='';const bytes=Buffer.from(suffix.text),decoder=new StringDecoder('utf8'),input=Readable.from([Buffer.from(prefix),bytes.subarray(0,1),bytes.subarray(1)]);if(!(input instanceof EventEmitter))throw Error('stream events identity');const emitter=new EventEmitter(),ready=once(emitter,'ready');emitter.emit('ready');await ready;await pipeline(input,new Transform({transform(chunk,enc,done){done(null,decoder.write(chunk));},flush(done){this.push(decoder.end());done();}}),new Writable({write(chunk,enc,done){text+=chunk.toString();done();}}));await c.app.alert('Plugin module pipeline',text);}}];`;
    const moduleFiles=moduleFormat?{'cycle-a.cjs':"exports.owner=module;exports.b=require('./cycle-b.cjs');",'cycle-b.cjs':"exports.a=require('./cycle-a.cjs');exports.sawLoaded=exports.a.owner.loaded;",'fresh.cjs':"module.exports={};",'failed.cjs':"throw Error('fixture load failure');",'self.cjs':"if(require.resolve('./self.cjs')!==__filename||require.resolve(__filename)!==__filename||module.filename!==__filename||module.id!==__filename||module.path!==__dirname||__dirname!=='/'||module.loaded!==false||module.require('buffer').Buffer!==Buffer||require.resolve('node:buffer')!=='node:buffer'||require.resolve('buffer')!=='buffer'||require.resolve('fixture-dep')!=='/node_modules/fixture-dep/index.cjs'||require(require.resolve('fixture-dep')).mode!=='commonjs')throw Error('require.resolve');const a=require('./cycle-a.cjs');if(a.b.a!==a||a.owner.parent!==module||a.owner.loaded!==true||a.b.sawLoaded!==false||module.children.filter(child=>child===a.owner).length!==1)throw Error('module graph');const first=require('./fresh.cjs'),key=require.resolve('./fresh.cjs');if(require(key)!==first||require.cache[key].loaded!==true)throw Error('module cache');delete require.cache[key];if(require(key)===first)throw Error('cache eviction');try{require('./failed.cjs');throw Error('failure missing');}catch(error){if(error.message!=='fixture load failure')throw error;}if(require.cache[require.resolve('./failed.cjs')]||module.children.some(child=>child.filename==='/failed.cjs'))throw Error('failed cache cleanup');module.exports='hello';",'node_modules/fixture-dep/package.json':JSON.stringify({exports:{import:'./index.mjs',require:'./index.cjs'}}),'node_modules/fixture-dep/index.mjs':"export default {mode:'module',text:'ไทย'};",'node_modules/fixture-dep/index.cjs':"module.exports={mode:'commonjs',text:'ไทย'};"}:{};
    registry=createPluginRegistry({getContext:()=>({owner,ready:true,settings:{pluginDirectories:['/fixture'],pluginPathMigrationVersion:1}}),
      discover:async()=>({report:{complete:true,packages:[{name,version:'1',directory:'/fixture',entry:'/fixture/'+entry,format,status:'execution-pending'}]}}),
      readPackage:async()=>({name,entry,format,files:{...moduleFiles,'package.json':JSON.stringify({name,version:'1',...(moduleFormat?{imports:{'#codec':'node:buffer'},exports:{'./self':'./self.cjs'}}:{})}),[entry]:moduleFormat?moduleSource:themes?`exports.themes=[{name:'ocean',displayName:'Ocean',theme:{background:{default:'#123456'},styles:{sidebar:{background:{default:'#234567'}}},rawCss:'[theme="ocean"] { --theme-probe: active; }'}}]`:source}}),
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
