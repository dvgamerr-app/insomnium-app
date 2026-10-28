import assert from 'node:assert/strict';
import {poll} from './native-app.js';
import {pluginWorkerRecords} from './plugin-worker-probe.js';

/** Genuine guest callbacks use the original captured request capabilities.
 * @param {string} helper */
export function pluginDomTerminalNativeSource(helper){
  return `exports.templateTags.push({name:'ownednativeterminal',run(c,mode){
    const body=document.createElement('div'),button=document.createElement('button');let hidden=0;
    body.setAttribute('data-cleanup-mode',mode);button.textContent='Hold native terminal helper';body.appendChild(button);
    const held=async()=>{const saved=await c.util.models.request.getById(${JSON.stringify(helper)});return await c.network.sendRequest(saved);};
    button.addEventListener('click',async()=>{try{await held();}catch{}});
    c.app.dialog('Native terminal dialog',body,{onHide:async()=>{
      const detached=!body.isConnected;body.setAttribute('data-cleanup-count',String(++hidden));await Promise.resolve();
      if(mode==='throw')throw Error('native terminal cleanup failure');
      if(mode==='cpu')while(true){}
      if(mode==='wait')await new Promise(()=>{});
      if(mode==='held-hide')try{await held();}catch{}
      let render=false,store=false,reopen=false;
      try{render=(await c.util.render('{{ scope }}'))==='base';}catch{}
      if(!render){try{await c.store.setItem('terminal-forbidden','leaked');store=true;}catch{}
        try{c.app.dialog('Forbidden native cleanup reopen',body);reopen=true;}catch{}}
      body.setAttribute('data-cleanup-permissions',JSON.stringify({render,store,reopen}));body.textContent='cleanup:'+detached;
    }});return 'native-terminal-value';
  }});`;
}

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string,wire:any[],requestId:string,plugin:string,baseUrl:string,body:(text:string)=>Promise<void>,releaseHeld:()=>void}} context */
export async function exercisePluginDomTerminalOwnerNative({page,invoke,output,wire,requestId,plugin,baseUrl,body,releaseHeld}){
  const checks=[],observations=/** @type {any[]} */([]),reported=/** @type {string[]} */([]);
  const bun=process.env.INSOMNIUM_BUN_PLUGIN_WORKFLOW==='1',nativeSnapshots=/** @type {any[]} */([]);
  const nativeRetired=async()=>{
    const reserved=[];
    try{for(let index=0;index<3;index++)reserved.push(await invoke('reserve_plugin_inspection'));return true;}
    catch{return false;}
    finally{for(const id of reserved)assert.equal(await invoke('cancel_plugin_inspection',{id}),true);}
  };
  const listener=(/** @type {import('playwright-core').ConsoleMessage} */ message)=>{if(message.type()==='error')reported.push(message.text());};
  page.on('console',listener);
  const dialog=()=>page.getByRole('dialog',{name:'Native terminal dialog',exact:true});
  const saved=()=>invoke('load_workspace').then(data=>data.resources.find((/** @type {any} */ row)=>row._id===requestId));
  const click=async(/** @type {import('playwright-core').Locator} */ target)=>target.evaluate(element=>/** @type {HTMLElement} */(element).click());
  const catalog=async(/** @type {'Unload plugin'|'Load plugin'} */ action)=>{
    await click(page.getByRole('button',{name:'Preferences',exact:true}).first());
    await click(page.getByRole('tab',{name:'Plugins',exact:true}));
    await page.waitForFunction(()=>document.querySelector('.plugins-panel')?.getAttribute('aria-busy')==='false');
    const card=page.locator('.plugin-card').filter({has:page.getByRole('heading',{name:plugin,exact:true})});
    await click(card.getByRole('button',{name:action,exact:true}));
    if(action==='Load plugin')await card.getByText('Plugin loaded in isolation. Supported template tags, hooks, actions and themes are available.',{exact:true}).waitFor();
    await click(page.getByRole('button',{name:'Close Preferences',exact:true}));
  };
  const changeSource=async()=>{
    await page.locator('.request-editor .CodeMirror').first().evaluate(element=>/** @type {any} */(element).CodeMirror.setValue('native terminal source revoked'));
    await poll(async()=>(await saved()).body.text==='native terminal source revoked','Actual native terminal source edit saved');
  };
  try{
    for(const action of ['source','unload','active-source','active-unload','abort','active-abort','queued-abort','close-unload','normal-close','throw','cpu','wait']){
      const fatal=['throw','cpu','wait'].includes(action),mode=fatal?action:action==='close-unload'?'held-hide':'permissions';
      const heldRoot=['abort','active-abort','queued-abort'].includes(action),path=heldRoot?'/dom-owner-held':'/render';
      await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(baseUrl+path);
      await poll(async()=>(await saved()).url===baseUrl+path,'Native terminal root URL saved');
      await body("{% ownednativeterminal '"+mode+"' %}");const before=wire.length,beforeErrors=reported.length;
      await page.getByRole('button',{name:'Send',exact:true}).click();await dialog().waitFor();
      await poll(async()=>wire.length===before+1,'Native terminal root reaches real HTTP peer');
      assert.equal(wire.at(-1).body,'native-terminal-value');assert.equal(new URL(wire.at(-1).url).pathname,path);
      if(!heldRoot)await page.getByRole('button',{name:'Send',exact:true}).waitFor();
      const node=await dialog().locator('.plugin-dom-body > div').elementHandle();assert.ok(node);
      const workerIndex=bun?undefined:await node.evaluate(element=>/** @type {any} */(window).__pluginWorkerProbe.trackTerminalNode(element));
      if(action.startsWith('active-')||action==='queued-abort'){
        await dialog().getByRole('button',{name:'Hold native terminal helper',exact:true}).click();
        await poll(async()=>wire.length===before+2,'Retained guest helper reaches actual native HTTP peer');
        assert.equal(new URL(wire.at(-1).url).pathname,'/dom-terminal-helper-held');
        if(action==='queued-abort')await dialog().getByRole('button',{name:'Hold native terminal helper',exact:true}).click();
      }
      const started=Date.now();
      if(action==='unload'||action==='active-unload')await catalog('Unload plugin');
      else if(action==='close-unload'){
        await click(dialog().getByRole('button',{name:'Close plugin dialog',exact:true}));
        await poll(async()=>wire.length===before+2,'Normal onHide awaits actual native helper before unload');
        await catalog('Unload plugin');
      }else if(heldRoot)await click(page.locator('.send-button').filter({hasText:'Cancel'}));
      else if(action==='normal-close')await dialog().getByRole('button',{name:'Close plugin dialog',exact:true}).click();
      else await changeSource();
      await dialog().waitFor({state:'detached'});
      if(fatal){
        await poll(bun?nativeRetired:async()=>(await pluginWorkerRecords(page))[workerIndex].terminated,'Native bounded faulty cleanup retirement',12000);
        assert.equal(await node.getAttribute('data-cleanup-count'),'1');assert.ok(reported.length>beforeErrors);
        const errors=reported.slice(beforeErrors);assert.match(errors.join('\n'),action==='throw'?/native terminal cleanup failure/:action==='cpu'?(bun?/CPU limit/:/interrupted/):(bun?/cleanup exceeded 5 seconds|exceeded its wall deadline/i:/cleanup exceeded 5 seconds/i));
        observations.push({action,mode,workerIndex,cleanupStarted:true,elapsedMs:Date.now()-started,reported:errors});
      }else{
        await poll(async()=>await node.evaluate(element=>element.textContent)==='cleanup:true','Actual native detached async onHide finishes before held remote replies');
        assert.equal(await node.getAttribute('data-cleanup-count'),'1');assert.equal(await node.evaluate(element=>element.isConnected),false);
        const permissions=JSON.parse(await node.getAttribute('data-cleanup-permissions')||'null');
        assert.deepEqual(permissions,{render:action==='normal-close',store:false,reopen:false});
        observations.push({action,mode,workerIndex,elapsedMs:Date.now()-started,permissions,cleanupFinished:true,detached:true,count:1});
      }
      const after=wire.length;releaseHeld();await page.waitForTimeout(750);
      assert.equal(wire.length,after,'Cancelled helper and queued guest events cannot issue late native requests');
      assert.equal(await page.getByRole('dialog',{name:'Forbidden native cleanup reopen',exact:true}).count(),0);
      if(heldRoot)await page.getByRole('button',{name:'Send',exact:true}).waitFor();
      assert.equal(await invoke('plugin_store',{plugin,operation:{action:'hasItem',key:'terminal-forbidden'}}),false);
      observations.at(-1).lateSuppression={stableForMs:750,noAdditionalWire:true,noReopen:true,forbiddenStoreAbsent:true};
      checks.push(action+': actual native ownership revocation/Close preserves exactly-once detached onHide or reports bounded faulty cleanup');
      if(bun)nativeSnapshots.push(await node.evaluate(body=>({text:body.textContent,count:body.getAttribute('data-cleanup-count'),connected:body.isConnected,mode:body.getAttribute('data-cleanup-mode')})));
      await node.dispose();
      if(action!=='unload'&&action!=='active-unload'&&action!=='close-unload')await catalog('Unload plugin');
      await poll(bun?nativeRetired:async()=>(await pluginWorkerRecords(page))[workerIndex].terminated,'Original native terminal VM retired');
      await catalog('Load plugin');
    }
    await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(baseUrl+'/render');
    await poll(async()=>(await saved()).url===baseUrl+'/render','Native terminal original root URL restored');
    const records=await pluginWorkerRecords(page),snapshots=bun?nativeSnapshots:records.flatMap((/** @type {any} */ row)=>row.terminalCleanup);
    assert.equal(snapshots.length,12);assert.ok(snapshots.every((/** @type {any} */ row)=>row.count==='1'&&row.connected===false));
    assert.equal(snapshots.filter((/** @type {any} */ row)=>row.text==='cleanup:true').length,9);
    const evidence={status:'passed',checks,observations,reported,snapshots,wire:wire.filter(row=>new URL(row.url).pathname==='/dom-terminal-helper-held'),clipboardTouched:false,
      cancellationMethod:'Programmatic actual Cancel and Preferences handlers under owned modal; native Send, child send, persistence and plugin Load/Unload are real',
      limits:'Saved native WebView2 HTTP ownership cases and genuine guest VM/DOM; no OS clipboard or artificially held native store IPC. Remote replies released only after cleanup/retirement; no claim of delivered post-cancel payload.'};
    await Bun.write(output+'/dom-terminal-owner-acceptance.json',JSON.stringify(evidence,null,2));return evidence;
  }catch(error){
    await Bun.write(output+'/dom-terminal-owner-diagnostics.json',JSON.stringify({checks,observations,reported,wire,records:await pluginWorkerRecords(page),error:String(error)},null,2));
    throw error;
  }finally{page.off('console',listener);releaseHeld();}
}
