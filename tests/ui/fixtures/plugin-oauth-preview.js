import {
  createOAuthPreviewHistoryGuard,
  oauthSourceContext,
} from "../../../src/lib/oauth-model.js";
import { initialData, newRequest } from "../../../src/lib/model.js";
import {mount, unmount} from 'svelte';
import OAuthEditor from '../../../src/lib/components/OAuthEditor.svelte';
import {workspace, withWorkspaceRunsPaused} from '../../../src/lib/workspace.svelte.js';
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
  async dispose(){resume?.();if(editor)await unmount(editor);},
};
