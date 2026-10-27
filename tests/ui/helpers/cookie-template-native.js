import assert from 'node:assert/strict';
import {withNativeApp,poll,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './native-app.js';
import {preserveNativeProfile} from './native-profile-preservation.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './resource-manager-cases.js';
import {newRequest,id} from '../../../src/lib/model.js';
import {readFile,lstat,realpath,mkdtemp,rename} from 'node:fs/promises';
import {join,resolve,basename,parse} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {lockProbeWorkspaceReplacement} from './windows-workspace-lock.js';

export async function runCookieTemplateNative(){
  assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  if(process.env.INSOMNIUM_COOKIE_RETIRE_NATIVE==='1')return runCookieRetirementNative();
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

async function runCookieRetirementNative(){
 const sha=(/** @type {Uint8Array} */ bytes)=>createHash('sha256').update(bytes).digest('hex');
 let received=0,aborted=0,capturedCookie='',release=()=>{};
 const held=new Promise(resolve=>{release=()=>resolve(undefined);});
 const server=Bun.serve({hostname:'127.0.0.1',port:0,async fetch(request){received++;capturedCookie=request.headers.get('cookie')||'';request.signal.addEventListener('abort',()=>aborted++,{once:true});await held;return new Response('late owned reply',{headers:{'Set-Cookie':'late_retired=must-not-return; Path=/; Max-Age=3600',connection:'close'}});}});
 try{await preserveNativeProfile(async({profile,workspacePath})=>withResourceProbePreserved(async()=>{
  const known=/** @type {Map<string,{sha256:string,name:string}>} */(new Map());let output='';
  try{await withNativeApp('cookie-retirement-native',async({page,invoke,output:ownedOutput})=>{
   output=ownedOutput;
   const original=await invoke('load_workspace'),owner=id('wrk'),other=id('wrk'),ownerName='Owned retiring cookie '+owner,otherName='Owned foreign cookie '+other;
   const target='http://127.0.0.1:'+server.port+'/held';
   const request=newRequest(owner,{name:'Owned held retired cookie',url:target}),foreignRequest=newRequest(other,{name:'Owned cookie control',url:target});
   const owned=[{_id:owner,_type:'workspace',parentId:null,name:ownerName},{_id:id('env'),_type:'environment',parentId:owner,name:'Base Environment',data:{}},request];
   const seed={...original,resources:[...original.resources,...owned,{_id:other,_type:'workspace',parentId:null,name:otherName},foreignRequest],activeWorkspaceId:owner,activeRequestId:request._id,activeEnvironmentId:'',openTabs:[...original.openTabs,request._id]};
   await invoke('save_workspace',{data:seed});registerResourceProbeCollection(owner,ownerName);registerResourceProbeCollection(other,otherName);
   const snapshot=(/** @type {string} */ workspaceId)=>invoke('snapshot_request_cookies',{workspaceId});
   const set=(/** @type {string} */ workspaceId,/** @type {string} */ raw)=>invoke('change_cookie',{workspaceId,url:target,raw,previous:null,clear:false});
   const remember=async()=>{
    const lifecycle=await Bun.file(join(profile,'cookie-lifecycle-v1.json')).json(),epoch=lifecycle.owners[owner];assert.match(epoch,/^[0-9a-f-]{36}$/);
    for(const name of [owner+'.'+epoch+'.json',owner+'.'+epoch+'.previous.json']){
     const path=join(profile,'cookies',name);if(!await Bun.file(path).exists())continue;
     const stat=await lstat(path);assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),resolve(path).toLowerCase());known.set(path,{name,sha256:sha(await readFile(path))});
    }
   };
   await set(owner,'retired_canary=first-owned; Path=/; Max-Age=3600');await remember();
   await set(owner,'retired_canary=second-owned; Path=/; Max-Age=3600');await remember();
   await set(other,'foreign_canary=preserve-owned; Path=/; Max-Age=3600');
   const oldSnapshot=await snapshot(owner),foreignSnapshot=await snapshot(other),foreignCookies=await invoke('list_cookies',{workspaceId:other});assert.equal(oldSnapshot.cookies.length,1);
   const before=await readFile(workspacePath),removal={...seed,resources:seed.resources.filter((/** @type {any} */ row)=>row._id!==owner&&row.parentId!==owner),activeWorkspaceId:other,activeRequestId:foreignRequest._id,openTabs:[foreignRequest._id]};
   const lock=await lockProbeWorkspaceReplacement(integrationProbeIdentifier);
   try{await assert.rejects(invoke('save_workspace',{data:removal}),error=>/os error 5|access.*denied/i.test(String(error)));assert.deepEqual(await readFile(workspacePath),before);assert.deepEqual(await snapshot(owner),oldSnapshot);}finally{lock.release();}
   await page.reload();await poll(async()=>await page.getByRole('combobox',{name:'Collection',exact:true}).inputValue()===owner,'Owned collection ready');
   await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>received===1,'Held native cookie request reaches peer');
   assert.equal(capturedCookie,'retired_canary=second-owned','Held request uses the retiring native jar');
   await page.getByRole('button',{name:'Manage collection',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Delete…',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();
   await poll(async()=>!(await invoke('load_workspace')).resources.some((/** @type {any} */ row)=>row._id===owner),'Actual collection deletion persisted');
   await poll(async()=>aborted===1,'Deleting owner cancels held native request');release();
   await assert.rejects(invoke('list_cookies',{workspaceId:owner}),error=>/no longer exists/i.test(String(error)));
   await assert.rejects(set(owner,'late_write=must-not-return; Path=/'),error=>/no longer exists/i.test(String(error)));
   await assert.rejects(snapshot(owner),error=>/no longer exists/i.test(String(error)));
   const absent=await invoke('snapshot_request_cookies',{workspaceId:owner,allowMissingOwner:true});assert.deepEqual(absent.cookies,[]);assert.equal(absent.jar_id,'');
   assert.deepEqual(await snapshot(other),foreignSnapshot);assert.deepEqual(await invoke('list_cookies',{workspaceId:other}),foreignCookies);
   const deleted=await invoke('load_workspace');assert.equal(deleted.history.some((/** @type {any} */ row)=>row.requestId===request._id),false);
   const recreated={...deleted,resources:[...deleted.resources,...owned],activeWorkspaceId:owner,activeRequestId:request._id,activeEnvironmentId:'',openTabs:[...deleted.openTabs,request._id]};
   await invoke('save_workspace',{data:recreated});const fresh=await snapshot(owner);assert.notEqual(fresh.jar_id,oldSnapshot.jar_id);assert.deepEqual(fresh.cookies,[]);assert.deepEqual(await invoke('list_cookies',{workspaceId:owner}),[]);
   await assert.rejects(invoke('read_template_cookie',{workspaceId:owner,url:target,name:'retired_canary',cookieSnapshot:oldSnapshot}),error=>/jar changed/i.test(String(error)));
   await page.reload();await poll(async()=>await page.getByRole('combobox',{name:'Collection',exact:true}).inputValue()===owner,'Same-ID collection reload');
   assert.deepEqual((await snapshot(owner)).cookies,[]);assert.deepEqual(await snapshot(other),foreignSnapshot);assert.deepEqual(await invoke('list_cookies',{workspaceId:other}),foreignCookies);assert.equal(received,1);assert.equal(aborted,1);
   const final=await invoke('load_workspace');for(const row of original.resources)assert.deepEqual(final.resources.find((/** @type {any} */ current)=>current._id===row._id),row);
   for(const [path,record] of known)assert.equal(sha(await readFile(path)),record.sha256,'Retired physical cookie bytes remain retained');
   await Bun.write(output+'/acceptance.json',JSON.stringify({passed:true,failedSavePreservesLiveJar:true,uiDeleteCancelsHeldRequest:true,deletedOwnerAdmissionRefused:true,exportOnlyMissingOwnerEmpty:true,sameIdFreshJar:true,oldSnapshotRefused:true,foreignJarUnchanged:true,retiredFilesRetained:true,rendererReload:true,received,aborted,capturedCookie},null,2));
  });}finally{
   if(known.size){
    const archive=await mkdtemp(join(tmpdir(),'insomnium-cookie-retirement-')),files=[];
    for(const [path,record] of known){
     const stat=await lstat(path);assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),resolve(path).toLowerCase());assert.equal(sha(await readFile(path)),record.sha256);
     const target=join(archive,basename(path));assert.equal(parse(target).root.toLowerCase(),parse(path).root.toLowerCase());assert.equal(await Bun.file(target).exists(),false);await rename(path,target);assert.equal(sha(await readFile(target)),record.sha256);files.push({...record,from:path,to:target});
    }
    assert.ok(output);await Bun.write(output+'/retired-cookie-archive.json',JSON.stringify({retained:true,directory:archive,files},null,2));
   }
  }
 },{expectedIdentifier:integrationProbeIdentifier}));}finally{release();server.stop(true);}
}
