import {mount} from 'svelte';
import GraphqlEditor from '../../../src/lib/components/GraphqlEditor.svelte';
import {workspace,cacheSchema} from '../../../src/lib/workspace.svelte.js';
import {initialData} from '../../../src/lib/model.js';
import {readSchema} from '../../../src/lib/graphql.js';
import '../../../src/lib/styles/index.css';

workspace.data=initialData();workspace.ready=true;
const request=workspace.data.resources.find(r=>r._type==='request');
if(!request)throw Error('Missing fixture request');
request.body={mimeType:'application/graphql',text:JSON.stringify({query:'{ user { id } }'})};
request.url=location.origin+'/held-schema';
const schema='type Query { user: User } type User { id: ID!, friend: User }';
cacheSchema(request._id,readSchema(schema),'local','Fixture');
mount(GraphqlEditor,{target:document.body,props:{request,onchange:()=>{}}});
/** @type {any} */(window).replaceNavigationSchema=()=>cacheSchema(request._id,readSchema('type Query { next: String }'),'local','Replacement');
