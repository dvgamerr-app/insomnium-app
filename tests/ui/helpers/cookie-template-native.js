import assert from 'node:assert/strict';
import {withNativeApp,poll,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './native-app.js';
import {preserveNativeProfile} from './native-profile-preservation.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './resource-manager-cases.js';
import {newRequest,id} from '../../../src/lib/model.js';

export async function runCookieTemplateNative(){
  assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const wire=/** @type {{cookie:string,tag:string}[]} */([]);
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){
    wire.push({cookie:request.headers.get('cookie')||'',tag:request.headers.get('x-cookie-source')||''});
    return Response.json({owned:true},{headers:{connection:'close'}});
  }});
  const target=`http://127.0.0.1:${server.port}/api/item`;
  try{
    await preserveNativeProfile(()=>withResourceProbePreserved(async()=>{
      await withNativeApp('cookie-template-native',async({page,invoke,output})=>{
        const data=await invoke('load_workspace');
        const workspaceId=id('wrk'),environmentId=id('env'),name='Owned template cookie sources';
        registerResourceProbeCollection(workspaceId,name);
        const cookie=(/** @type {string} */ key)=>`{% cookie '${target}', '${key}' %}`;
        const request=newRequest(workspaceId,{name:'Cookie source wire',method:'GET',url:target,
          headers:[{name:'X-Cookie-Source',value:cookie('session')}]});
        data.resources.push({_id:workspaceId,_type:'workspace',parentId:null,name,scope:'collection'},
          {_id:environmentId,_type:'environment',parentId:workspaceId,name:'Source values',
            data:{cookieName:'session',token:'source',host:'127.0.0.1',cookiePath:'/api',expiry:new Date(Date.now()+86400000).toISOString()}},
          {_id:id('wm'),_type:'workspace_meta',parentId:workspaceId,activeEnvironmentId:environmentId},request);
        Object.assign(data,{activeWorkspaceId:workspaceId,activeRequestId:request._id,activeEnvironmentId:environmentId,openTabs:[request._id]});
        Object.assign(data.settings,{useCookies:true,proxy:'',caPem:'',validateCertificates:true});
        await invoke('save_workspace',{data});
        await invoke('change_cookie',{workspaceId,url:target,raw:'session=native; Path=/api; SameSite=Lax',previous:null,clear:false});
        await page.reload();
        const open=async()=>{
          await page.getByRole('button',{name:'Cookies',exact:true}).click();
          const dialog=page.getByRole('dialog',{name:'Cookies',exact:true});
          await dialog.locator('summary').filter({hasText:'Template cookie sources'}).click();
          return dialog;
        };
        const source={key:'{{ _.cookieName }}',value:cookie('dependency'),domain:'{{ _.host }}',path:'{{ _.cookiePath }}',
          expires:'{{ _.expiry }}',hostOnly:true,sameSite:'strict'};
        const dependency={...source,key:'dependency',value:'{{ _.token }}'};
        const save=async(/** @type {Record<string,any>[]} */cookies)=>{
          const dialog=await open();
          await dialog.getByRole('textbox',{name:'Template cookie sources JSON',exact:true}).fill(JSON.stringify(cookies));
          await dialog.getByRole('button',{name:'Preview template sources',exact:true}).click();
          await dialog.getByRole('button',{name:`Save ${cookies.length} template sources`,exact:true}).click();
          await dialog.getByRole('status').filter({hasText:'Template cookie sources saved.'}).waitFor();
          await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
        };
        await save([source,dependency]);
        await page.reload();
        await page.getByRole('button',{name:'Send',exact:true}).click();
        await poll(async()=>wire.length===1,'Actual template cookie wire');
        assert.equal(wire[0].tag,'source');
        assert.equal(wire[0].cookie,'dependency=source; session=source');
        await poll(async()=>await page.getByRole('button',{name:'Cancel request',exact:true}).count()===0,'Send settles');
        const native=await invoke('snapshot_request_cookies',{workspaceId,includeExpired:true});
        assert.equal(native.cookies.length,1);assert.equal(native.cookies[0].value,'native');
        assert.equal(native.cookies[0].sameSite,'lax');
        await save([{...source,value:cookie('session')},dependency]);
        await page.getByRole('button',{name:'Send',exact:true}).click();
        await page.getByText('Request failed',{exact:true}).waitFor();
        assert.equal(wire.length,1,'Cycle must fail before network dispatch');
        const dialog=await open();
        await dialog.getByRole('button',{name:'Clear all…',exact:true}).click();
        await dialog.getByRole('button',{name:'Confirm clear',exact:true}).click();
        await dialog.getByRole('status').filter({hasText:'Cookies saved.'}).waitFor();
        await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
        const cleared=await invoke('load_workspace');
        assert.equal(cleared.resources.some((/** @type {any} */r)=>r.parentId===workspaceId&&r._activeTemplateCookieSource),false);
        cleared.resources.find((/** @type {any} */r)=>r._id===request._id).headers=[];
        await invoke('save_workspace',{data:cleared});await page.reload();
        await page.getByRole('button',{name:'Send',exact:true}).click();
        await poll(async()=>wire.length===2,'Clear source recovery wire');
        assert.equal(wire[1].cookie,'');
        await poll(async()=>await page.getByRole('button',{name:'Cancel request',exact:true}).count()===0,'Recovery settles');
        await Bun.write(output+'/acceptance.json',JSON.stringify({status:'passed',wire,
          uiActivationAndReload:true,renderedScopeAndExpiry:true,cookieTagValueChain:true,
          liveJarUnchangedAndSameSitePreserved:true,cycleRefusedBeforeWire:true,clearDoesNotResurrect:true},null,2));
      });
    },{expectedIdentifier:integrationProbeIdentifier}));
  }finally{server.stop(true);}
}
