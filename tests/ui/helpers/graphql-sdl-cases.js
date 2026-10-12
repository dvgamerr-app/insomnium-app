import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {buildSchema, introspectionFromSchema, printSchema} from 'graphql';
import {poll} from './native-app.js';
import {inspectOwnedDialogs,requestOwnedDialogClose,submitOwnedSavePath} from './native-window-close.js';
import {withIpcSuccessHook} from './ipc-success-hook.js';
import {lockScenarioCopyWrite} from './windows-workspace-lock.js';

/** Real native SDL export controls; caller preserves the profile after host exit.
 * @param {import('./native-app.js').ScenarioContext} context
 * @param {(id:string,name:string)=>void} registerCollection */
export async function exerciseGraphqlSdlExport({page,pid,invoke,output},registerCollection) {
  assert.equal(typeof registerCollection,'function','Fixture collection ownership registration required');
  const schema=buildSchema('"""Unicode ไทย ✓"""\ntype Query { greeting: String! }');
  const expected=printSchema(schema);
  let introspections=0;
  const server=Bun.serve({hostname:'127.0.0.1',port:0,async fetch(request){
    const body=await request.json();
    assert.equal(request.method,'POST');assert.equal(body.operationName,'IntrospectionQuery');
    introspections++;return Response.json({data:introspectionFromSchema(schema)});
  }});
  try {
    const name='SDL export '+crypto.randomUUID();
    const workspaceId='wrk_sdl_'+crypto.randomUUID(),requestId='req_sdl_'+crypto.randomUUID();
    const resources=[{_id:workspaceId,_type:'workspace',parentId:null,name,scope:'collection'},
      {_id:requestId,_type:'request',parentId:workspaceId,name,method:'POST',url:`http://127.0.0.1:${server.port}/graphql`,headers:[],parameters:[],authentication:{},body:{mimeType:'application/graphql',text:JSON.stringify({query:'{ greeting }',variables:{},operationName:''})}}];
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({resources}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByRole('button',{name:'Import',exact:true}).click();await dialog.waitFor({state:'detached'});
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'GQL '+name,exact:true}).click();
    /** @type {Record<string,any>|undefined} */ let imported;
    await poll(async()=>{const data=await invoke('load_workspace');imported=data.resources.find((/** @type {Record<string,any>} */ row)=>row._type==='workspace'&&row.name===name);return Boolean(imported);},'Actual SDL fixture collection persisted');
    assert.ok(imported);registerCollection(imported._id,imported.name);
    await Bun.write(join(output,'fixture-collection.json'),JSON.stringify({id:imported._id,name:imported.name,sourceWorkspaceId:workspaceId,registeredBeforeIntrospection:true},null,2));
    const panel=page.locator('.graphql-panel');
    await panel.getByRole('button',{name:'Fetch schema',exact:true}).click();
    await panel.getByLabel('Schema types',{exact:true}).waitFor();assert.equal(introspections,1);
    const baseline=await invoke('load_workspace');
    const exportButton=panel.getByRole('button',{name:'Export SDL',exact:true});
    const rows=[];
    const chooser=async()=>{
      let handle='';
      await poll(async()=>{const owned=inspectOwnedDialogs(pid,true);assert.ok(owned.length<=1,'Unambiguous owned chooser');handle=owned[0]?.window??'';return Boolean(handle);},'Owned hidden SDL chooser');
      return handle;
    };
    const settled=async()=>{await poll(async()=>inspectOwnedDialogs(pid).length===0,'SDL chooser closed');assert.equal(await exportButton.isEnabled(),true);};
    const selectPath=async(/** @type {string} */ handle,/** @type {string} */ path)=>{
      let selection;
      await poll(async()=>{
        try {selection=submitOwnedSavePath(pid,handle,'schema.graphql',path);return true;}
        catch(error){
          // An owned HWND can appear before the filename controls initialize.
          // Retry only this zero-match pre-mutation result; ambiguous/foreign
          // windows and every other guard failure still abort immediately.
          if(error instanceof assert.AssertionError&&error.actual===0&&error.expected===1&&error.message.startsWith('Exactly one fixture filename edit required:'))return false;
          throw error;
        }
      },'Owned SDL filename control ready');
      assert.ok(selection);return selection;
    };
    const focusRestored=async()=>{await poll(()=>exportButton.evaluate(element=>element===document.activeElement),'SDL export trigger focus restored');};
    const unchanged=async()=>{assert.deepEqual(await invoke('load_workspace'),baseline,'SDL export must not mutate persisted workspace');assert.equal(introspections,1,'Export must not fetch schema again');};
    // A native successful null reply is observed, without replacing that reply.
    const cancelled=await withIpcSuccessHook(page,'plugin:dialog|save',async()=>{},async()=>{
      const before=await readdir(output);await exportButton.focus();await page.keyboard.press('Enter');
      const handle=await chooser();requestOwnedDialogClose(pid,handle);await settled();await focusRestored();
      assert.deepEqual(await readdir(output),before,'Cancelled SDL chooser creates no artifact');await unchanged();return {window:handle};
    });assert.equal(cancelled.calls,1);assert.equal(cancelled.hooks,1);rows.push({kind:'cancel',...cancelled});
    await Bun.write(join(output,'sdl-progress.json'),JSON.stringify({phase:'cancel-passed',rows},null,2));
    const path=join(output,'schema.graphql');assert.equal(await Bun.file(path).exists(),false);
    const saved=await withIpcSuccessHook(page,'plugin:dialog|save',async()=>{},async()=>{
      await exportButton.focus();await page.keyboard.press('Enter');const handle=await chooser();
      const selection=await selectPath(handle,path);
      await poll(async()=>await Bun.file(path).exists()&&Buffer.from(await Bun.file(path).bytes()).equals(Buffer.from(new TextEncoder().encode(expected))),'Actual native SDL file write completes');
      assert.deepEqual(await Bun.file(path).bytes(),new TextEncoder().encode(expected),'Exact SDL UTF-8 bytes');
      await settled();await focusRestored();await unchanged();return selection;
    });assert.equal(saved.calls,1);assert.equal(saved.hooks,1);rows.push({kind:'save',...saved});
    await Bun.write(join(output,'sdl-progress.json'),JSON.stringify({phase:'save-passed',rows},null,2));
    const deniedPath=join(output,'write-denied.graphql'),sentinel='Owned SDL write refusal sentinel ไทย';
    /** @type {Awaited<ReturnType<typeof lockScenarioCopyWrite>>|undefined} */ let lock;
    try {
      const refused=await withIpcSuccessHook(page,'plugin:dialog|save',async()=>{await Bun.write(deniedPath,sentinel);lock=await lockScenarioCopyWrite(output,deniedPath,'.graphql');},async()=>{
        await exportButton.focus();await page.keyboard.press('Enter');const handle=await chooser();
        await selectPath(handle,deniedPath);
        const alert=panel.getByRole('alert').filter({hasText:'os error 32'});await alert.waitFor();
        await settled();await focusRestored();assert.equal(await Bun.file(deniedPath).text(),sentinel);await unchanged();return await alert.innerText();
      });assert.equal(refused.calls,1);assert.equal(refused.hooks,1);assert.match(refused.value,/os error 32/i);rows.push({kind:'write-refusal',...refused});
    } finally {lock?.release();}
    await Bun.write(join(output,'sdl-export.json'),JSON.stringify({status:'passed',renderingMode:'native-hidden',rows,introspections,expectedBytes:new TextEncoder().encode(expected).length,limits:'Actual Windows owned hidden chooser and native writes; exact SDL/cancel/write-refusal/focus/workspace acceptance only. Other platforms/full GraphQL/migration remain required.'},null,2));
  } finally {server.stop(true);}
}
