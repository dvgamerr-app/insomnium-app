import {
  createOAuthPreviewHistoryGuard,
  oauthSourceContext,
} from "../../../src/lib/oauth-model.js";
import { initialData, newRequest } from "../../../src/lib/model.js";
import {mount, unmount} from 'svelte';
import OAuthEditor from '../../../src/lib/components/OAuthEditor.svelte';
import {workspace, withWorkspaceRunsPaused, authorizeOAuth, useSavedOAuth} from '../../../src/lib/workspace.svelte.js';
import {oauthContext} from '../../../src/lib/oauth-model.js';
import {requestDataScope} from '../../../src/lib/request-scope.js';
let phase='idle';
/** @type {(()=>void)|undefined} */ let resume;
/** @type {ReturnType<typeof mount>|undefined} */ let editor;
/** @type {any} */ (window).__pluginOAuthPreviewFixture = {
  createOAuthPreviewHistoryGuard,
  oauthSourceContext,
  initialData,
  newRequest,
  mountEditor(){
    workspace.data=initialData();workspace.ready=true;
    const request=newRequest(workspace.data.activeWorkspaceId,{url:'https://owned.invalid/resource',authentication:{type:'oauth2',grantType:'client_credentials',clientId:'owned',accessTokenUrl:'https://owned.invalid/token'}});
    workspace.data.resources.push(request);
    workspace.data.resources.push({_id:'tok_owned_preview',_type:'oauth2_token',parentId:request._id,accessToken:'owned-preview-token',tokenType:'Bearer',obtainedAt:Date.now(),expiresAt:Date.now()+60000,_oauthContext:oauthContext(requestDataScope(workspace.data,request._id),request)});
    const target=document.createElement('section');target.setAttribute('aria-label','Owned OAuth preview');document.body.appendChild(target);
    editor=mount(OAuthEditor,{target,props:{request,onchange:()=>{}}});
  },
  pause(){void withWorkspaceRunsPaused(async()=>{phase='paused';await new Promise(resolve=>{resume=()=>resolve(undefined);});}).finally(()=>{phase='idle';});},
  resume(){resume?.();},
  phase:()=>phase,
  async operationOwnership(){
    const checks=[];
    for(const mode of ['fetch','saved-error','saved-success']){
      workspace.data=initialData();workspace.ready=true;workspace.running={};workspace.oauthErrors={};workspace.oauthProgress={};
      const request=newRequest(workspace.data.activeWorkspaceId,{url:'https://owned.invalid/resource',authentication:{type:'oauth2',grantType:'client_credentials',clientId:mode==='saved-success'?'owned':'{{ broken(',accessTokenUrl:'https://owned.invalid/token'}});
      workspace.data.resources.push(request);
      workspace.data.resources.push({_id:'tok_owned_operation',_type:'oauth2_token',parentId:request._id,accessToken:'owned',tokenType:'Bearer',_oauthImported:true});
      const pending=mode==='fetch'?authorizeOAuth(request._id):useSavedOAuth(request._id,'tok_owned_operation');
      if(!workspace.running[request._id])throw Error('OAuth operation must enter its async run');
      if(mode==='saved-error'){
        workspace.running[request._id]={id:'replacement-run',controller:new AbortController()};
        workspace.oauthProgress[request._id]={id:'replacement-run',stage:'waiting',mode:'manual'};
      }else workspace.data=JSON.parse(JSON.stringify(workspace.data));
      workspace.oauthErrors[request._id]='replacement feedback';
      const result=await pending;
      if(workspace.oauthErrors[request._id]!=='replacement feedback')throw Error('Retired OAuth operation overwrote feedback');
      if(mode==='saved-error'&&(workspace.running[request._id]?.id!=='replacement-run'||workspace.oauthProgress[request._id]?.id!=='replacement-run'))throw Error('Retired OAuth cleanup removed replacement run/progress');
      if(mode==='saved-success'&&(result!==false||workspace.data.resources.filter(r=>r._type==='oauth2_token').length!==1))throw Error('Retired token adoption changed replacement workspace');
      delete workspace.running[request._id];delete workspace.oauthProgress[request._id];
      checks.push(mode);
    }
    return checks;
  },
  async dispose(){resume?.();if(editor)await unmount(editor);},
};
