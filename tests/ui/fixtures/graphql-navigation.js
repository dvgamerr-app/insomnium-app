import {mount} from 'svelte';
import GraphqlEditor from '../../../src/lib/components/GraphqlEditor.svelte';
import {workspace,cacheSchema,clearSchema} from '../../../src/lib/workspace.svelte.js';
import {initialData} from '../../../src/lib/model.js';
import {readSchema} from '../../../src/lib/graphql.js';
import '../../../src/lib/styles/index.css';

workspace.data=initialData();workspace.ready=true;
const request=workspace.data.resources.find(r=>r._type==='request');
if(!request)throw Error('Missing fixture request');
request.body={mimeType:'application/graphql',text:JSON.stringify({query:'query Find($id: ID) { user(id: $id) { id } }',variables:'{ "'})};
workspace.data.settings.autocompleteDelay=0;
request.url=location.origin+'/held-schema';
const schema='directive @trace(level: Int = 1) on FIELD enum Role { ADMIN READER } "user id appear in this description" type Query { user(id: ID): User } type User { id: ID!, friend: User }';
cacheSchema(request._id,readSchema(schema),'local','Fixture');
mount(GraphqlEditor,{target:document.body,props:{request,onchange:body=>{request.body=body;}}});
/** @type {any} */(window).replaceNavigationSchema=()=>cacheSchema(request._id,readSchema('type Query { next: String }'),'local','Replacement');

/** @type {any} */(window).refreshNavigationSchema=()=>cacheSchema(request._id,readSchema(schema),'local','Refreshed fixture');

/** @type {any} */(window).setNavigationCompletionDelay=(/** @type {number} */delay)=>{workspace.data.settings.autocompleteDelay=delay;};

/** @type {any} */(window).exerciseSchemaCacheOrder=(/** @type {{id:string,sdl:string,time:number}[]} */ entries)=>{
  for(const key of Object.keys(workspace.schemas))clearSchema(key);
  for(const {id} of entries)if(!workspace.data.resources.some(row=>row._id===id))
    workspace.data.resources.push({...request,_id:id});
  const before=JSON.stringify(workspace.data),clock=Date.now,snapshots=[];
  try{
    for(const {id,sdl,time} of entries){
      Date.now=()=>time;
      cacheSchema(id,readSchema(sdl),'local','Cache order fixture');
      snapshots.push(Object.fromEntries(Object.entries(workspace.schemas).map(([key,entry])=>[key,{loadedAt:entry.loadedAt,bytes:entry.bytes}])));
    }
  }finally{Date.now=clock;}
  return {snapshots,dataUnchanged:JSON.stringify(workspace.data)===before,clockRestored:Date.now===clock};
};
