import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSvelteUiFixturePlugin} from './component-fixture.js';
import {exerciseEventSubclasses,observeNativeSubclass,exerciseOwnedFocus,exerciseOwnedRanges,exerciseBlobFiles,exerciseObjectUrls,exerciseAbortSignals,exerciseAbortTimeouts,exerciseFileReaders,exerciseOwnedFiles,exerciseDataTransfers,installPointerTransfer} from './plugin-dom-event-subclass-cases.js';
/** @param {import('playwright-core').Page} page @param {string} output @param {{nativeFixturePath?:string,focus?:string}} [options] */
export async function runEventSubclassScenario(page,output,options={}){
    const focus=options.focus||'';assert.ok(['','ErrorEvent','MessageEvent','StorageEvent','InputEvent','Blob','DataTransfer','FileReader','ObjectURL','AbortSignal'].includes(focus));
    const oracle = await page.evaluate(
      ({source,focus}) => new Function("return (" + source + ")(globalThis,"+(focus==='AbortSignal'||focus==='ObjectURL'||focus==='FileReader'||focus==='DataTransfer'?'undefined':JSON.stringify(focus))+")")(),
      {source:(focus==='AbortSignal'?exerciseAbortSignals:focus==='ObjectURL'?exerciseObjectUrls:focus==='FileReader'?exerciseFileReaders:focus==='DataTransfer'?exerciseDataTransfers:focus==='Blob'?exerciseBlobFiles:exerciseEventSubclasses).toString(),focus},
    );
    if(focus==='StorageEvent'){
      const row=oracle.StorageEvent;assert.equal(row.values.url,'owned\u0000\ufffd');assert.equal(row.values.key,'key\u0000ไทย\ud800');
      assert.deepEqual(row.defaultValues,{key:null,oldValue:null,newValue:null,url:'',storageArea:null});
      assert.ok(row.initEventRetains&&row.refusedInitRetains&&row.writeRejected&&row.illegalRejected);assert.ok(row.invalid.every((/** @type {string} */value)=>value==='TypeError'));assert.ok(row.legacyRefusals.every((/** @type {string} */value)=>value==='TypeError'));
    }
    await Bun.write(output + "/oracle.json", JSON.stringify(oracle, null, 2));
    const timeoutOracle=focus==='AbortSignal'?await page.evaluate(source=>new Function('return ('+source+')(globalThis)')(),exerciseAbortTimeouts.toString()):undefined;if(timeoutOracle)await Bun.write(output+'/timeout-oracle.json',JSON.stringify(timeoutOracle,null,2));
    if(options.nativeFixturePath){
      const path=options.nativeFixturePath,bytes=await Bun.file(path).bytes(),served=await page.evaluate(async url=>Array.from(new Uint8Array(await(await fetch(url)).arrayBuffer())), '/'+path.replace(/^build\//,''));
      assert.equal(createHash('sha256').update(Uint8Array.from(served)).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
      await page.evaluate(await Bun.file(path).text());
    }else{
      const fixture=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});
      assert.equal(fixture.success,true);await page.evaluate(await fixture.outputs[0].text());
    }
    const files = (await readdir("build/_app/immutable/workers")).filter((name) =>
      /^plugin\.worker-.*\.js$/.test(name),
    );
    assert.equal(files.length, 1);
    const path = "build/_app/immutable/workers/" + files[0],
      url = new URL("/_app/immutable/workers/" + files[0], page.url()).href,
      workerSha256 = createHash("sha256")
        .update(await Bun.file(path).bytes())
        .digest("hex");
    const call = (/** @type {string} */ method, /** @type {any[]} */ args = []) =>
      page.evaluate(
        ({ method, args }) => /** @type {any} */ (window).__pluginGuestDom[method](...args),
        { method, args },
      );
    const initialized = [],ownedRanges=[];
    try {
      for (const format of ["commonjs", "module"]) {
        await call("open", [url, format]);
        if(focus==='AbortSignal'){
          assert.equal(await call('eventSubclasses',['timeout-foreign-wait']),'waiting');await page.waitForFunction(async()=>await /** @type {any} */(window).__pluginGuestDom.eventSubclasses('timeout-module-state')==='TimeoutError|denied');
          const guest=await call('eventSubclasses',['abort']);await Bun.write(output+'/'+format+'.json',JSON.stringify(guest,null,2));assert.deepEqual(guest,oracle);await call('eventSubclasses',['abort-cross-owner']);const cross=page.getByRole('dialog',{name:'Abort cross owner',exact:true});await cross.waitFor();const before=await call('eventGuardState'),crossResult=await call('abortWithoutOwner');assert.deepEqual(crossResult,{aborted:true,reason:'cross-owner'});await cross.getByRole('button',{name:'Abort owned target',exact:true}).evaluate(node=>node.dispatchEvent(new Event('owned:abort-cross')));assert.equal(await cross.getByRole('status').innerText(),'waiting');const after=await call('eventGuardState'),old=after.domMetrics[before.domMetrics.length-1];assert.equal(after.domMetrics.length,before.domMetrics.length,'Pure abort allocates no DOM owner');assert.equal(after.closed,false);assert.deepEqual(await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors),[]);assert.equal(old?.methods['dom.unlisten'],1);await call('abortSelfAsync');const selfDialog=page.getByRole('dialog',{name:'Abort self owner',exact:true});await selfDialog.getByRole('button',{name:'Abort self target',exact:true}).evaluate(node=>node.dispatchEvent(new Event('owned:self')));await selfDialog.getByRole('status').filter({hasText:'continued'}).waitFor();assert.deepEqual(await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors),[]);const reuse=await call('eventSubclasses',['abort-lease-reuse']);assert.deepEqual(reuse,{first:70,reused:60,aborted:true});await Bun.write(output+'/'+format+'-lifecycle.json',JSON.stringify({crossResult,reuse,selfAbortContinues:true,retainedBefore:before.retainedCallbackCount,oldOwnerUnlistens:old.methods['dom.unlisten'],newOwnerUnlistens:0,pureAbort:true},null,2));
          const timed=await call('eventSubclasses',['timeout']);await Bun.write(output+'/'+format+'-timeouts.json',JSON.stringify(timed,null,2));assert.deepEqual(timed,timeoutOracle);await call('disposeDomOwners');await call('eventSubclasses',['timeout-idle']);const idle=page.getByRole('dialog',{name:'Timeout idle owner',exact:true});await idle.getByRole('status').filter({hasText:'TimeoutError|event-subclasses'}).waitFor();await call('disposeDomOwners');const marker=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records.at(-1).taskEvents.length);const quota=await call('eventSubclasses',['timeout-quota']);assert.equal(quota.created,128);assert.match(quota.error,/timeout.*limit/i);const ids=await page.evaluate(marker=>/** @type {any} */(window).__pluginGuestDom.records.at(-1).taskEvents.slice(marker).filter((/** @type {any} */row)=>row.type==='timeout-retain').map((/** @type {any} */row)=>row.id),marker);assert.equal(ids.length,128);await call('disposeDomOwners');await page.waitForFunction(ids=>ids.every((/** @type {number} */id)=>/** @type {any} */(window).__pluginGuestDom.records.at(-1).taskEvents.some((/** @type {any} */row)=>row.type==='timeout-release'&&row.id===id)),ids);const expired=await page.evaluate(ids=>/** @type {any} */(window).__pluginGuestDom.records.at(-1).taskEvents.filter((/** @type {any} */row)=>row.type==='timeout-ready'&&ids.includes(row.id)).length,ids);assert.equal(expired,0);assert.equal(await call('eventSubclasses',['timeout-repair']),'TimeoutError');assert.equal(await call('eventSubclasses',['timeout-slow']),'TimeoutError');await Bun.write(output+'/'+format+'-timeout-lifecycle.json',JSON.stringify({idle:true,cancelled:ids.length,expired,repaired:true,quota},null,2));initialized.push(format);await call('retireSession');await page.waitForFunction(()=>/** @type {any} */(window).__pluginGuestDom.records.every((/** @type {any} */row)=>row.terminated));continue;
        }
        if(focus==='ObjectURL'){
          const guest=await call('eventSubclasses',['object-urls']);await compareObjectURLs(page,output,format,oracle,guest);
          const startedURL=guest.rows.find((/** @type {any} */row)=>row.label==='binary').url;await page.evaluate(async url=>{/** @type {any} */(window).__pendingObjectURLResponse=await fetch(url);},startedURL);await call('eventSubclasses',['url-revoke',startedURL]);const startedRead=await page.evaluate(async()=>{const response=/** @type {any} */(window).__pendingObjectURLResponse,bytes=new Uint8Array(await response.arrayBuffer());delete /** @type {any} */(window).__pendingObjectURLResponse;return {length:bytes.length,exact:bytes.every((byte,index)=>byte===index%251)};});assert.deepEqual(startedRead,{length:131080,exact:true});assert.equal(await objectURLFetchFails(page,startedURL),true);await Bun.write(output+'/'+format+'-started-fetch.json',JSON.stringify(startedRead,null,2));
          const moduleURL=await call('eventSubclasses',['url-initialized']);assert.ok(moduleURL.alias&&moduleURL.hidden);await checkObjectURLRows(page,{rows:[{label:'module',url:moduleURL.url,expected:{bytes:[109,111,100,117,108,101,239,191,189],type:''},revoked:false}]});
          const foreign=await page.evaluate(()=>URL.createObjectURL(new Blob(['foreign'])));await call('eventSubclasses',['url-revoke',foreign]);assert.equal(await page.evaluate(async url=>await(await fetch(url)).text(),foreign),'foreign');
          await call('eventSubclasses',['url-files']);const dialog=page.getByRole('dialog',{name:'Object URL dialog',exact:true}),input=dialog.getByLabel('Object URL file',{exact:true}),path=output+'/'+format+'-url.bin';await Bun.write(path,Uint8Array.from({length:131080},(_,i)=>i%251));await input.setInputFiles(path);
          const selectedOracle=await page.evaluate(source=>new Function('return ('+source+')')()(globalThis,/** @type {HTMLInputElement} */(document.querySelector('input[aria-label="Object URL file"]')).files?.[0]),exerciseObjectUrls.toString());await dialog.getByRole('button',{name:'Create selected URLs',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent?.startsWith('{'));const selected=JSON.parse(await dialog.getByRole('status').innerText());await compareObjectURLs(page,output,format+'-selected',selectedOracle,selected);
          const releaseBefore=await call('eventGuardState');for(const row of selected.rows.filter((/** @type {any} */row)=>row.label==='selected'||row.label==='lazy-parts')){await call('eventSubclasses',['url-revoke',row.url]);assert.equal(await objectURLFetchFails(page,row.url),true,'Owned lazy URL revoked through the VM registry');}
          const releaseAfter=await call('eventGuardState'),releaseCount=(/** @type {any} */state)=>state.domMetrics.reduce((/** @type {number} */sum,/** @type {any} */row)=>sum+row.urlReleases,0);assert.equal(releaseCount(releaseAfter)-releaseCount(releaseBefore),2,'VM revocation releases both parent registrations');await Bun.write(output+'/'+format+'-explicit-release.json',JSON.stringify({released:2},null,2));
          const live=selected.rows.find((/** @type {any} */row)=>row.label==='binary').url;await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await objectURLFetchFails(page,live),false,'Memory URLs outlive a hidden dialog');await call('disposeDomOwners');assert.equal(await objectURLFetchFails(page,live),false,'Memory URLs outlive the DOM owner');const retired=selected.rows.find((/** @type {any} */row)=>row.label==='selected-owner-close');assert.equal(await objectURLFetchFails(page,retired.url),true,'DOM owner disposal revokes lazy URLs');
          if(format==='module'){const guards=await call('objectURLGuards');await Bun.write(output+'/guards.json',JSON.stringify(guards,null,2));assert.ok(guards.malformed.every((/** @type {string} */value)=>value!=='leaked'));assert.notEqual(guards.foreign,'leaked');assert.deepEqual(guards.bytes,[117,97,114]);assert.match(guards.capacity,/object URL handle limit/);assert.match(guards.budget,/DOM text limit/);assert.match(guards.retired,/owner changed/);assert.equal(await objectURLFetchFails(page,guards.url),true);assert.equal(guards.foreignRelease,false);assert.equal(guards.stillOwned,'uar');assert.equal(guards.released,true);assert.equal(guards.replayed,false);assert.deepEqual(guards.restoredBytes,[117,97,114]);assert.equal(await objectURLFetchFails(page,guards.repaired),true);}
          await call('retireSession');await page.waitForFunction(()=>/** @type {any} */(window).__pluginGuestDom.records.every((/** @type {any} */row)=>row.terminated));for(const row of [...guest.rows,...selected.rows])assert.equal(await objectURLFetchFails(page,row.url),true,'VM disposal revokes its own resources');assert.equal(await objectURLFetchFails(page,moduleURL.url),true);assert.equal(await page.evaluate(async url=>await(await fetch(url)).text(),foreign),'foreign');await page.evaluate(url=>URL.revokeObjectURL(url),foreign);
          await page.evaluate(rows=>rows.forEach((/** @type {any} */row)=>URL.revokeObjectURL(row.url)),selectedOracle.rows);initialized.push(format);continue;
        }
        if(focus==='FileReader'){
          const syncOracle=await page.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/event-probe/event-probe-worker.js',{type:'module'});worker.onmessage=event=>{worker.terminate();if(event.data.error)reject(Error(event.data.error));else resolve(event.data.value);};worker.onerror=event=>{worker.terminate();reject(Error(event.message));};worker.postMessage({type:'file-reader-sync-oracle'});}));const syncGuest=await call('eventSubclasses',['reader-sync']);await Bun.write(output+'/'+format+'-sync.json',JSON.stringify({oracle:syncOracle,guest:syncGuest},null,2));assert.deepEqual(syncGuest,syncOracle);
          const guest=await call('eventSubclasses',['reader']);await Bun.write(output+'/'+format+'.json',JSON.stringify({reference:oracle,guest},null,2));assert.deepEqual(guest,oracle);
          await call('eventSubclasses',['reader-files']);const dialog=page.getByRole('dialog',{name:'FileReader dialog',exact:true}),input=dialog.getByLabel('Reader file',{exact:true}),path=output+'/'+format+'-reader.bin';await Bun.write(path,Uint8Array.from({length:131080},(_,index)=>index%251));await input.setInputFiles(path);
          const admissionBefore=await call('eventGuardState');const reference=await page.evaluate(source=>new Function('return ('+source+')')()(globalThis,/** @type {HTMLInputElement} */(document.querySelector('input[aria-label="Reader file"]')).files?.[0],document.createElement('button')),exerciseFileReaders.toString());await dialog.getByRole('button',{name:'Read with FileReader',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent?.startsWith('{'));const selected=JSON.parse(await dialog.getByRole('status').innerText());await Bun.write(output+'/'+format+'-selected.json',JSON.stringify({reference,guest:selected},null,2));assert.deepEqual(selected,reference);assert.deepEqual(selected.selected.value,{length:131080,exact:true});const selectedSyncOracle=await page.evaluate(()=>new Promise((resolve,reject)=>{const file=/** @type {HTMLInputElement} */(document.querySelector('input[aria-label="Reader file"]')).files?.[0],worker=new Worker('/event-probe/event-probe-worker.js',{type:'module'});worker.onmessage=event=>{worker.terminate();if(event.data.error)reject(Error(event.data.error));else resolve(event.data.value);};worker.onerror=event=>{worker.terminate();reject(Error(event.message));};worker.postMessage({type:'file-reader-sync-oracle',file});}));await dialog.getByRole('status').evaluate(node=>node.textContent='');await dialog.getByRole('button',{name:'Read with FileReaderSync',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent?.startsWith('{'));const syncSelected=JSON.parse(await dialog.getByRole('status').innerText());await Bun.write(output+'/'+format+'-sync-selected.json',JSON.stringify({oracle:selectedSyncOracle,guest:syncSelected},null,2));assert.deepEqual(syncSelected,selectedSyncOracle);const admissionAfter=await call('eventGuardState'),listenCount=(/** @type {any} */state)=>state.domMetrics.reduce((/** @type {number} */total,/** @type {any} */row)=>total+(row.methods['dom.listen']??0),0);const admissionCounts={retained:admissionAfter.retainedCallbackCount-admissionBefore.retainedCallbackCount,listens:listenCount(admissionAfter)-listenCount(admissionBefore)};await Bun.write(output+'/'+format+'-admission-counts.json',JSON.stringify(admissionCounts,null,2));assert.deepEqual(admissionCounts,{retained:6,listens:6});await page.evaluate(()=>{const input=/** @type {HTMLInputElement} */(document.querySelector('input[aria-label="Reader file"]'));Object.defineProperty(input.files?.[0],'slice',{configurable:true,value:()=>({arrayBuffer:async()=>{throw new DOMException('Selected File unavailable','NotReadableError');}})});const status=document.querySelector('dialog [role="status"]');if(status)status.textContent='';});await dialog.getByRole('button',{name:'Read with FileReader',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent?.startsWith('{'));const failure=JSON.parse(await dialog.getByRole('status').innerText());await Bun.write(output+'/'+format+'-read-failure.json',JSON.stringify(failure,null,2));for(const row of[failure.selected,failure.slice]){assert.equal(row.error,'NotReadableError');assert.equal(row.value,null);assert.deepEqual(row.events.map((/** @type {any} */e)=>e.type),['loadstart','error','loadend']);}await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'hidden'});initialized.push(format);continue;
        }
        if(focus==='DataTransfer'){assert.deepEqual(await call('eventSubclasses',['transfer-initialized']),{text:'module',order:['microtask','task']});const guest=await call('eventSubclasses',['transfer']);await Bun.write(output+'/'+format+'.json',JSON.stringify(guest,null,2));assert.deepEqual(guest,oracle);const bound=await call('eventSubclasses',['bound-transfer']);await Bun.write(output+'/'+format+'-bound.json',JSON.stringify(bound,null,2));assert.deepEqual(bound,oracle);await runTransferBridgeScenario(page,output,call,format);initialized.push(format);continue;}
        if(focus==='Blob'){
          const guest=await call('eventSubclasses',['blob']);await Bun.write(output+'/'+format+'.json',JSON.stringify(guest,null,2));assert.deepEqual(guest.surface,oracle);assert.ok(Object.values(guest.exports).every(value=>value===true));assert.deepEqual(guest.initialized,{blobSize:9,fileSize:9,fileName:'module',lastModified:17});
          await call('eventSubclasses',['files']);
          const dialog=page.getByRole('dialog',{name:'Owned file dialog',exact:true}),input=dialog.getByLabel('Owned files',{exact:true});
          const binary=output+'/'+format+'-owned.bin',text=output+'/'+format+'-text.txt';await Bun.write(binary,Uint8Array.from({length:131080},(_,index)=>index%251));await Bun.write(text,'\ufeffไทย\ud800');await input.setInputFiles([binary,text]);
          const reference=await page.evaluate(source=>{const selected=/** @type {HTMLInputElement} */(document.querySelector('input[aria-label="Owned files"]')),input=document.createElement('input'),peer=document.createElement('input'),transfer=new DataTransfer();input.type=peer.type='file';for(const file of selected.files??[])transfer.items.add(file);input.files=transfer.files;return new Function('return ('+source+')')()(globalThis,input,peer);},exerciseOwnedFiles.toString());
          await dialog.getByRole('button',{name:'Read owned files',exact:true}).click();
          await page.waitForFunction(()=>{const text=document.querySelector('dialog [role="status"]')?.textContent;return text?.startsWith('{');});
          const selected=JSON.parse(await dialog.getByRole('status').innerText());await Bun.write(output+'/'+format+'-selected-files.json',JSON.stringify({reference,guest:selected},null,2));assert.deepEqual(selected,reference);assert.ok(selected.data.exact&&selected.stream.exact&&selected.fresh);
          await input.setInputFiles([]);await dialog.getByRole('status').evaluate(element=>{element.textContent='';});await dialog.getByRole('button',{name:'Read retained File',exact:true}).click();
          await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent?.startsWith('{'));assert.deepEqual(JSON.parse(await dialog.getByRole('status').innerText()),{length:0,bytes:[1,2,3,4]});
          await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'hidden'});
          const guards=await call('fileGuards');await Bun.write(output+'/'+format+'-file-guards.json',JSON.stringify(guards,null,2));assert.ok(guards.invalid.every((/** @type {string} */value)=>value!=='leaked'));assert.notEqual(guards.foreign,'leaked');assert.notEqual(guards.foreignList,'leaked');assert.deepEqual(guards.failure,{error:{name:'NotReadableError',message:'Selected File unavailable'}});assert.ok(guards.waitsForRead&&guards.drained);assert.match(guards.retired,/owner changed/);assert.match(guards.late,/owner changed/);
          initialized.push(format);continue;
        }
        if(focus){
          const initializedGuest=await call('eventSubclasses',['initialized']),guest=await call('eventSubclasses',[focus==='InputEvent'?'input':focus==='ErrorEvent'?'error':focus==='StorageEvent'?'storage':'message']);
          assert.deepEqual({[focus]:initializedGuest[focus]},oracle);assert.deepEqual(guest,oracle);
          if(focus==='InputEvent'){const oracle=await page.evaluate(source=>new Function('return ('+source+')')()(globalThis,[document.createElement('div'),document.createTextNode('text'),document.createComment('comment'),document.createDocumentFragment()]),exerciseOwnedRanges.toString()),guest=await call('eventSubclasses',['ranges-owned']);await Bun.write(output+'/'+format+'-ranges.json',JSON.stringify({oracle,guest},null,2));assert.deepEqual(guest,oracle);assert.ok(guest.input.fresh&&guest.input.detachedArray&&!guest.iteratorClosed&&!guest.input.same&&!guest.input.original&&!guest.input.duplicate);assert.ok(guest.invalid.every((/** @type {string} */value)=>value==='TypeError'));ownedRanges.push(guest);}
          await Bun.write(output+'/'+format+'.json',JSON.stringify(guest,null,2));initialized.push(format);continue;
        }
        const initializedGuest = await call("eventSubclasses", ["initialized"]);
        assert.deepEqual(initializedGuest, oracle);
        const guest = await call("eventSubclasses", ["surface"]);
        await Bun.write(output + "/" + format + ".json", JSON.stringify(guest, null, 2));
        assert.deepEqual(guest, oracle);
        const permissions=await call("eventSubclasses",["device-permission"]);
        assert.deepEqual(permissions,["NotSupportedError","NotSupportedError"]);
        initialized.push(format);
      }
      if(focus==='AbortSignal'){await call('open',[url,'module']);await assert.rejects(call('eventSubclasses',['timeout-wall']),/5 seconds|deadline|timed out|exceeded/i);await call('retireSession');await page.waitForFunction(()=>/** @type {any} */(window).__pluginGuestDom.records.every((/** @type {any} */row)=>row.terminated));await Bun.write(output+'/timeout-wall.json',JSON.stringify({refused:true,limitMs:5000},null,2));await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */row)=>row.terminated));await Bun.write(output+'/'+(options.nativeFixturePath?'native-subclasses-acceptance.json':'result.json'),JSON.stringify({status:'passed',focus,initialized,records,workerSha256,headless:!options.nativeFixturePath,renderingMode:options.nativeFixturePath?'native-hidden':'headless',fullAbortSignal:false},null,2));return;}
      if(focus==='ObjectURL'){
        await call('open',[url,'module']);await call('eventSubclasses',['url-credit-files']);const dialog=page.getByRole('dialog',{name:'URL credit dialog',exact:true}),path=output+'/credit.bin';await Bun.write(path,new Uint8Array([0,1,2]));await dialog.getByLabel('URL credit file',{exact:true}).setInputFiles(path);const before=await call('eventGuardState');await dialog.getByRole('button',{name:'Check URL credits',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent?.startsWith('{'));const credit=JSON.parse(await dialog.getByRole('status').innerText()),after=await call('eventGuardState'),count=(/** @type {any} */state)=>state.domMetrics.reduce((/** @type {number} */sum,/** @type {any} */row)=>sum+(row.methods['dom.url.create']??0),0);assert.equal(credit.created,8);assert.match(credit.blocked,/object URL byte limit/);assert.equal(count(after)-count(before),1,'Quota failure precedes native creation; explicit revoke frees credits');await checkObjectURLRows(page,{rows:[{label:'repaired',url:credit.repaired,expected:{bytes:[97,0,1,2],type:'application/x-credit'},revoked:false}]});await call('disposeDomOwners');assert.equal(await objectURLFetchFails(page,credit.repaired),true);const reused=await call('eventSubclasses',['url-credit-reuse']);await Bun.write(output+'/owner-release.json',JSON.stringify(reused,null,2));assert.equal(reused.byteCount,8,'Owner disposal returns copied payload credits');assert.equal(reused.byteFailure,'');assert.equal(reused.handleCount,2048,'Owner disposal returns URL handle credits');assert.match(reused.handleFailure,/object URL handle limit/);await Bun.write(output+'/credits.json',JSON.stringify({...credit,parentCreates:count(after)-count(before),reused},null,2));
        await call('close');await page.waitForFunction(()=>/** @type {any} */(window).__pluginGuestDom.records.every((/** @type {any} */row)=>row.terminated));assert.equal(await objectURLFetchFails(page,credit.repaired),true);
await page.evaluate(rows=>rows.forEach((/** @type {any} */row)=>URL.revokeObjectURL(row.url)),oracle.rows);const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */row)=>row.terminated));await Bun.write(output+'/'+(options.nativeFixturePath?'native-subclasses-acceptance.json':'result.json'),JSON.stringify({status:'passed',focus,initialized,records,workerSha256,headless:!options.nativeFixturePath,renderingMode:options.nativeFixturePath?'native-hidden':'headless',fullFileApi:false},null,2));return;}
      if(focus==='FileReader'){await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */row)=>row.terminated));await Bun.write(output+'/'+(options.nativeFixturePath?'native-subclasses-acceptance.json':'result.json'),JSON.stringify({status:'passed',focus,initialized,records,workerSha256,headless:!options.nativeFixturePath,renderingMode:options.nativeFixturePath?'native-hidden':'headless',fullFileApi:false},null,2));return;}
      if(focus==='DataTransfer'){await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */row)=>row.terminated));await Bun.write(output+'/'+(options.nativeFixturePath?'native-subclasses-acceptance.json':'result.json'),JSON.stringify({status:'passed',focus,oracle,initialized,records,workerSha256,headless:!options.nativeFixturePath,renderingMode:options.nativeFixturePath?'native-hidden':'headless',fullDataTransfer:false},null,2));return;}
      if(focus==='Blob'){await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */row)=>row.terminated));assert.deepEqual(oracle.snapshot,[1,2,3,3,4]);assert.equal(oracle.privateGetters,0);assert.ok(oracle.invalid.every((/** @type {string} */value)=>value==='TypeError'));await Bun.write(output+'/'+(options.nativeFixturePath?'native-subclasses-acceptance.json':'result.json'),JSON.stringify({status:'passed',focus,oracle,initialized,records,workerSha256,headless:!options.nativeFixturePath,renderingMode:options.nativeFixturePath?'native-hidden':'headless',fullFileApi:false},null,2));return;}
      const prepared=await call("eventSubclasses", [focus==='InputEvent'?'ranges-native':focus==='MessageEvent'?'message-native':'native']);
      const dialog = page.getByRole("dialog", { name: "Event subclass dialog", exact: true }),
        input = dialog.getByRole("textbox", { name: "Guest subclass input" });
      await input.waitFor();
      if(focus){
        const oracleRows=await input.evaluate((element,{source,focus})=>{
          const observe=new Function('return ('+source+')')(),rows=/** @type {any[]} */([]),retained=new Map(),type=focus==='InputEvent'?'owned:input-ranges':focus==='ErrorEvent'?'owned:error':focus==='StorageEvent'?'owned:storage':'owned:message';
          element.addEventListener(type,event=>{const row=observe(event,globalThis,[element,document.querySelector('[aria-label="Guest subclass peer"]')]);if(focus==='MessageEvent'){const value=/** @type {MessageEvent} */(event),previous=retained.get(value);row.cachedData=!previous||previous.data===value.data;row.cachedPorts=!previous||previous.ports===value.ports;retained.set(value,{data:value.data,ports:value.ports});}rows.push(row);});
          if(focus==='ErrorEvent'){
            const failure=new TypeError('owned error',{cause:{owned:'cause'}});Object.defineProperty(failure,'stack',{value:'owned-stack',configurable:true});/** @type {any} */(failure).self=failure;
            for(const error of [undefined,null,{owned:['data']},failure,new Error('default lazy stack')])element.dispatchEvent(new ErrorEvent(type,{message:'broken\u0000ไทย\ud800',filename:'owned\ud800.js',lineno:4294967297,colno:-1,error,bubbles:true,cancelable:true}));
          }else if(focus==='InputEvent'){
            const peer=document.querySelector('[aria-label="Guest subclass peer"]');if(!peer)throw Error('Missing owned peer');const range=new StaticRange({startContainer:element,startOffset:0,endContainer:peer,endOffset:0});for(const targetRanges of [[],[range],[range,range]]){const event=new InputEvent(type,{targetRanges,data:'ไทย',inputType:'insertText',bubbles:true,cancelable:true});element.dispatchEvent(event);element.dispatchEvent(event);}
          }else if(focus==='StorageEvent'){
            for(const fields of [{},{key:'key\u0000\ud800',oldValue:null,newValue:'new\ud800',url:'url\ud800'},{key:null,oldValue:'old',newValue:null}]){const event=new StorageEvent(type,{...fields,bubbles:true,cancelable:true});element.dispatchEvent(event);element.dispatchEvent(event);}
          }else{
            for(const [index,data]of [null,undefined,'ไทย\u0000\ud800',{owned:['data']},new TypeError('message failure')].entries()){const event=new MessageEvent(type,{data,origin:'origin\u0000\ud800',lastEventId:'id\u0000\ud800',source:index%2?window:null,bubbles:true,cancelable:true});element.dispatchEvent(event);element.dispatchEvent(event);}
          }
          return rows;
        },{source:observeNativeSubclass.toString(),focus});
        await page.waitForFunction(({expected,type})=>{const status=[...document.querySelectorAll('dialog [role="status"]')].find(node=>node.textContent?.includes(type));try{return JSON.parse(status?.textContent||'[]').length===expected;}catch{return false;}},{expected:oracleRows.length,type:focus==='InputEvent'?'owned:input-ranges':focus==='ErrorEvent'?'owned:error':focus==='StorageEvent'?'owned:storage':'owned:message'});
        const guest=JSON.parse(await dialog.getByRole('status').innerText());assert.deepEqual(guest,oracleRows);
        let refusals=/** @type {any[]} */([]);
        if(focus==='MessageEvent'){
          await input.evaluate(element=>{const channel=new MessageChannel();try{element.dispatchEvent(new MessageEvent('owned:message',{data:'foreign source',source:channel.port1}));element.dispatchEvent(new MessageEvent('owned:message',{data:'foreign ports',ports:[channel.port1]}));}finally{channel.port1.close();channel.port2.close();}});
          await page.waitForFunction(()=>/** @type {any} */(window).__pluginGuestDom.errors.length===2);refusals=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors);
          assert.ok(refusals.every((/** @type {any} */value)=>JSON.stringify(value).includes('MessageEvent requires an owned source and no MessagePorts')));assert.equal(JSON.parse(await dialog.getByRole('status').innerText()).length,oracleRows.length);
        }
        if(focus==='StorageEvent'){
          await input.evaluate(element=>element.dispatchEvent(new StorageEvent('owned:storage',{storageArea:localStorage})));
          await page.waitForFunction(()=>/** @type {any} */(window).__pluginGuestDom.errors.length===1);refusals=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors);assert.ok(JSON.stringify(refusals).includes('StorageEvent requires an owned Storage'));assert.equal(JSON.parse(await dialog.getByRole('status').innerText()).length,oracleRows.length);
        }
        if(focus==='InputEvent'){
          await input.evaluate(element=>element.dispatchEvent(new InputEvent('owned:input-ranges',{targetRanges:[new StaticRange({startContainer:document.body,startOffset:0,endContainer:document.body,endOffset:1})]})));await page.waitForFunction(()=>/** @type {any} */(window).__pluginGuestDom.errors.length===1);refusals=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors);assert.ok(JSON.stringify(refusals).includes('InputEvent target ranges require owned Nodes'));assert.equal(JSON.parse(await dialog.getByRole('status').innerText()).length,oracleRows.length);
        }
        await call('close');const records=await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.records);assert.ok(records.every((/** @type {any} */r)=>r.terminated));
        await Bun.write(output+'/'+(options.nativeFixturePath?'native-subclasses-acceptance.json':'result.json'),JSON.stringify({status:'passed',headless:!options.nativeFixturePath,renderingMode:options.nativeFixturePath?'native-hidden':'headless',focus,oracle,initialized,ownedRanges,guestNative:guest,nativeOracle:oracleRows,refusals,records,workerSha256,eventFeatureComplete:false},null,2));return;
      }
      const ownedFocusOracle=await input.evaluate((element,source)=>{const peer=document.querySelector('[aria-label="Guest subclass peer"]');return new Function('return ('+source+')')()(globalThis,[element,peer]);},exerciseOwnedFocus.toString());
      assert.deepEqual(prepared.ownedFocus,ownedFocusOracle);
      await Bun.write(output+'/owned-focus.json',JSON.stringify({guest:prepared.ownedFocus,oracle:ownedFocusOracle},null,2));
      await input.evaluate((element, source) => {
        /** @type {any} */ (window).__subclassOracle = [];
        const observe = new Function("return (" + source + ")")();
        const peer=document.querySelector('[aria-label="Guest subclass peer"]');
        const status=element.parentElement?.querySelector('[role="status"]');
        if(status instanceof HTMLElement){status.style.position='absolute';status.style.pointerEvents='none';}
        for (const type of ["click", "keydown", "keyup","wheel","focus","blur","focusin","focusout","beforeinput","input","compositionstart","compositionupdate","compositionend","submit","hashchange","deviceorientation","devicemotion","owned:beforeunload","close","textInput","progress","animationstart","animationiteration","animationend","animationcancel","transitionrun","transitionstart","transitionend","transitioncancel"])
          element.addEventListener(type, (event) =>
            /** @type {any} */ (window).__subclassOracle.push(observe(event, globalThis,[element,peer])),
          );
      }, observeNativeSubclass.toString());
      await input.click();
      await input.hover();
      await page.mouse.wheel(23.5,-45.5);
      await page.waitForFunction(()=>/** @type {any} */(window).__subclassOracle.some((/** @type {any} */ row)=>row.wheel));
      await dialog.getByRole('status').filter({hasText:'WheelEvent'}).waitFor();
      await input.evaluate(element=>{for(const type of ['compositionstart','compositionupdate','compositionend'])element.dispatchEvent(new CompositionEvent(type,{data:'ไทย漢字',bubbles:true,cancelable:true,view:window}));});
      await dialog.getByRole('status').filter({hasText:'CompositionEvent'}).waitFor();
      await input.evaluate(element=>element.dispatchEvent(new SubmitEvent('submit',{submitter:document.querySelector('[aria-label="Guest subclass peer"]'),bubbles:true,cancelable:true})));
      await dialog.getByRole('status').filter({hasText:'SubmitEvent'}).waitFor();
      await input.evaluate(element=>{const event=document.createEvent('TextEvent');event.initTextEvent('textInput',true,true,window,'ไทย\u0000\ud800');element.dispatchEvent(event);});
      await dialog.getByRole('status').filter({hasText:'TextEvent'}).waitFor();
      await input.evaluate(element=>{element.dispatchEvent(new AnimationEvent('animationiteration',{animationName:'pulse\u0000ไทย',elapsedTime:1.25,pseudoElement:'::before',bubbles:true}));element.dispatchEvent(new TransitionEvent('transitioncancel',{propertyName:'opacity',elapsedTime:2.5,pseudoElement:'::after',bubbles:true}));});
      await dialog.getByRole('status').filter({hasText:'TransitionEvent'}).waitFor();
      await input.evaluate(element=>{const style=document.createElement('style');style.textContent='@keyframes insomnium-owned-probe {from{opacity:0.8}to{opacity:1}}';document.head.appendChild(style);element.style.animation='insomnium-owned-probe 0.05s linear';});
      await page.waitForFunction(()=>/** @type {any} */(window).__subclassOracle.some((/** @type {any} */ row)=>row.type==='animationend'&&row.trusted));
      await input.evaluate(element=>{element.style.animation='none';element.style.opacity='0.75';element.style.transition='opacity 0.05s linear';getComputedStyle(element).opacity;element.style.opacity='0.9';});
      await page.waitForFunction(()=>/** @type {any} */(window).__subclassOracle.some((/** @type {any} */ row)=>row.type==='transitionend'&&row.trusted));
      await input.evaluate(element=>{const event=document.createEvent('BeforeUnloadEvent');event.initEvent('owned:beforeunload',true,true);event.returnValue='host\u0000ไทย\ud800';element.dispatchEvent(event);});
      await dialog.getByRole('status').filter({hasText:'BeforeUnloadEvent'}).waitFor();
      await input.evaluate(element=>{element.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:12.5,beta:null,gamma:-0,absolute:true,bubbles:true}));element.dispatchEvent(new DeviceMotionEvent('devicemotion',{acceleration:{x:1.25,y:null,z:-0},rotationRate:{alpha:3.75,beta:null,gamma:400},interval:16.5,bubbles:true}));});
      await dialog.getByRole('status').filter({hasText:'DeviceMotionEvent'}).waitFor();
      await input.evaluate(element=>element.dispatchEvent(new CloseEvent('close',{code:4001,reason:'closed\u0000ไทย\ud800😀',wasClean:true,bubbles:true,cancelable:true})));
      await dialog.getByRole('status').filter({hasText:'CloseEvent'}).waitFor();
      assert.equal(await dialog.isVisible(),true,'A bubbling child CloseEvent must not close the owned dialog');
      await input.evaluate(element=>element.dispatchEvent(new ProgressEvent('progress',{lengthComputable:true,loaded:3.75,total:100.5,bubbles:true,cancelable:true})));
      await dialog.getByRole('status').filter({hasText:'ProgressEvent'}).waitFor();
      await input.evaluate(element=>element.dispatchEvent(new HashChangeEvent('hashchange',{oldURL:'old\ud800',newURL:'ใหม่\u0000',bubbles:true,cancelable:true})));
      await dialog.getByRole('status').filter({hasText:'HashChangeEvent'}).waitFor();
      await input.press("Shift+K");
      await dialog.getByRole('textbox',{name:'Guest subclass peer'}).click();
      await input.click();
      const text = await dialog.getByRole("status").textContent();
      assert.ok(text);
      const guestNative = JSON.parse(text),
        nativeOracle = await page.evaluate(() => /** @type {any} */ (window).__subclassOracle);
      await Bun.write(
        output + "/native.json",
        JSON.stringify({ guestNative, nativeOracle }, null, 2),
      );
      assert.deepEqual(guestNative, nativeOracle);
      assert.ok(guestNative.some((/** @type {any} */ row) => row.pointer && row.trusted));
      assert.ok(guestNative.some((/** @type {any} */ row)=>row.wheel&&row.trusted&&row.deltaX===23.5&&row.deltaY===-45.5));
      assert.ok(guestNative.some((/** @type {any} */ row)=>row.focus&&row.relatedOwnedIndex===1&&row.trusted));
      assert.ok(guestNative.some((/** @type {any} */ row)=>row.input&&row.data==='K'&&row.inputType==='insertText'&&row.trusted));
      assert.ok(
        guestNative.some(
          (/** @type {any} */ row) => row.keyboard && row.key === "K" && row.shiftKey,
        ),
      );
      await dialog.evaluate(element=>/** @type {HTMLDialogElement} */(element).close());
      await dialog.waitFor({state:"hidden"});
      await call("close");
      const records = await page.evaluate(
        () => /** @type {any} */ (window).__pluginGuestDom.records,
      );
      assert.ok(records.every((/** @type {any} */ row) => row.terminated));
      await Bun.write(
        output + "/"+(options.nativeFixturePath?"native-subclasses-acceptance.json":"result.json"),
        JSON.stringify(
          {
            status: "passed",
            headless: !options.nativeFixturePath,
            renderingMode:options.nativeFixturePath?"native-hidden":"headless",
            checks: [
              "Implemented constructor/factory surfaces match browser in CommonJS",
              "Twelve constructor surfaces match browser in ES module",
              "Actual trusted Wheel fields and inherited Mouse brand match browser",
              "Actual trusted owned Focus relatedTarget matches browser",
              "Owned Focus constructor identity and legacy UI initialization match browser",
              "Actual trusted Input data and inputType match browser",
              "Actual trusted pointer brand and serialized values match same browser event",
              "Actual trusted keyboard brands and values match same browser events",
            ],
            oracle,
            initialized,
            guestNative,
            nativeOracle,
            records,
            workerSha256,
            eventFeatureComplete: false,
          limits:
            "Owned native view uses an isolated Window facade; foreign/null views do not expose a host Window. Full Window APIs, legacy mouse/keyboard initializers, extended modifiers, pointer coalesced/predicted samples and full synthetic dispatch remain open.",
          },
          null,
          2,
        ),
      );
    } catch(error){
      await Bun.write(output+'/subclass-failure-state.json',JSON.stringify({guard:await call('eventGuardState').catch(()=>null),errors:await page.evaluate(()=>/** @type {any} */(window).__pluginGuestDom.errors).catch(()=>[]),oracle:await page.evaluate(()=>/** @type {any} */(window).__subclassOracle).catch(()=>null),status:await page.getByRole('dialog',{name:'Event subclass dialog'}).getByRole('status').allTextContents().catch(()=>[])},null,2));
      throw error;
    } finally {
      await call("close").catch(() => {});
    }
}

/** @param {import('playwright-core').Page} page @param {string} output
 * @param {(method:string,args?:any[])=>Promise<any>} call @param {string} format */
async function runTransferBridgeScenario(page,output,call,format){
  assert.equal((await Bun.file('src-tauri/tauri.conf.json').json()).app.windows[0].dragDropEnabled,false);
  await call('eventSubclasses',['transfer-dispatch']);
  const dialog=page.getByRole('dialog',{name:'Owned transfer dialog',exact:true});await dialog.waitFor();
  await page.evaluate(()=>{
    const target=document.querySelector('[aria-label="Owned transfer target"]');if(!target)throw Error('Missing owned transfer target');
    const rows=/** @type {any[]} */([]);/** @type {any} */(window).__ownedTransferHost={rows};
    for(const type of ['drop','beforeinput'])target.addEventListener(type,event=>{
      const transfer=/** @type {any} */(event).dataTransfer,file=transfer.files[0],derived=transfer.files[1],row={type,fromGuest:transfer.getData('from-guest'),name:file.name,size:file.size,sameFiles:derived===file,derived:derived?.name==='derived.bin'?derived.arrayBuffer().then((/** @type {ArrayBuffer} */buffer)=>({name:derived.name,type:derived.type,lastModified:derived.lastModified,bytes:Array.from(new Uint8Array(buffer))})):null,bytes:file.arrayBuffer().then((/** @type {ArrayBuffer} */buffer)=>{const bytes=new Uint8Array(buffer);return {length:bytes.length,exact:bytes.every((value,index)=>value===index%251)};})};rows.push(row);transfer.setData('from-host','host mutation');
    });
  });
  await dialog.getByRole('button',{name:'Run guest transfer',exact:true}).click();
  const wait=async(/** @type {number} */count)=>{await page.waitForFunction(count=>{try{const value=JSON.parse(document.querySelector('dialog [role="status"]')?.textContent??'null');return value.error||value.length===count&&value.every((/** @type {any} */row)=>row.done);}catch{return false;}},count);};
  await wait(1);
  const file=output+'/'+format+'-host-owned.bin';await Bun.write(file,Uint8Array.from({length:131080},(_,index)=>index%251));await dialog.getByLabel('Transfer source',{exact:true}).setInputFiles(file);
  const host=[];
  for(const type of ['drop','beforeinput']){
    host.push(await page.evaluate(type=>{const target=document.querySelector('[aria-label="Owned transfer target"]'),input=/** @type {HTMLInputElement} */(document.querySelector('[aria-label="Transfer source"]')),state=/** @type {any} */(window).__ownedTransferHost;const file=input?.files?.[0];if(!target||!file)throw Error('Missing owned transfer source');const transfer=state.transfer??=new DataTransfer();if(!transfer.items.length){transfer.setData('text/plain','host source');transfer.items.add(file);}const event=type==='drop'?new DragEvent(type,{dataTransfer:transfer,bubbles:true,cancelable:true}):new InputEvent(type,{dataTransfer:transfer,inputType:'insertFromDrop',bubbles:true,cancelable:true});return {result:target.dispatchEvent(event),fromGuest:transfer.getData('from-guest')};},type));await wait(host.length+1);
  }
  const rows=JSON.parse(await dialog.getByRole('status').innerText()),observed=await page.evaluate(async()=>{const state=/** @type {any} */(window).__ownedTransferHost;return Promise.all(state.rows.map(async(/** @type {any} */row)=>({...row,bytes:await row.bytes,derived:await row.derived})));});
  await Bun.write(output+'/'+format+'-dispatch.json',JSON.stringify({rows,observed,host},null,2));assert.equal(rows.length,3);assert.equal(observed.length,3);assert.deepEqual(rows.map((/** @type {any} */row)=>row.same),[true,false,true]);
  for(const row of rows){assert.equal(row.initiallyPrevented,false);assert.ok(row.done&&row.sameListener&&row.bytes.exact);assert.equal(row.bytes.length,131080);assert.equal(row.fromHost,'host mutation');assert.equal(row.second,'guest mutation');assert.deepEqual(row.order,['first','second','microtask','string']);assert.equal(row.text,row.original);}
  assert.deepEqual(rows.map((/** @type {any} */row)=>[row.drag,row.input]),[[true,false],[true,false],[false,true]]);for(const row of observed){assert.equal(row.fromGuest,'guest mutation');assert.deepEqual(row.bytes,{length:131080,exact:true});}assert.ok(host.every(row=>row.result===false&&row.fromGuest==='guest mutation'));
  assert.equal(observed[0].derived,null);assert.deepEqual(observed.map(row=>row.sameFiles),[true,false,false]);for(const row of observed.slice(1))assert.deepEqual(row.derived,{name:'derived.bin',type:'text/x',lastModified:19,bytes:[1,2,3,4,116,97,105,108]});
  await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await call('eventSubclasses',['pointer-transfer']);
  const pointer=page.getByRole('dialog',{name:'Pointer transfer dialog',exact:true});await pointer.waitFor();await pointer.getByLabel('Pointer file',{exact:true}).setInputFiles(file);
  await page.evaluate(source=>{const target=document.querySelector('[data-pointer-target]'),input=/** @type {HTMLInputElement} */(document.querySelector('[aria-label="Pointer file"]'));const parent=target?.parentElement;if(!target||!parent)throw Error('Missing pointer transfer target');target.addEventListener('drop',event=>{const value=/** @type {DragEvent} */(event).dataTransfer,file=value?.files[0];/** @type {any} */(window).__pointerTransferHost=file?file.arrayBuffer().then(buffer=>({trusted:event.isTrusted,length:buffer.byteLength,exact:new Uint8Array(buffer).every((byte,index)=>byte===index%251)})):null;});const reference=document.createElement('div'),from=document.createElement('div'),to=document.createElement('div'),status=document.createElement('span');from.dataset.pointerOracleSource='';to.dataset.pointerOracleTarget='';status.dataset.pointerOracleStatus='';status.style.display='none';reference.append(from,to,status);parent.append(reference);new Function('return ('+source+')')()(globalThis,from,to,status,input);},installPointerTransfer.toString());
  await pointer.locator('[data-pointer-oracle-source]').dragTo(pointer.locator('[data-pointer-oracle-target]'));
  await page.waitForFunction(()=>document.querySelector('[data-pointer-oracle-status]')?.textContent?.startsWith('{'));
  const referencePointer=JSON.parse(await pointer.locator('[data-pointer-oracle-status]').innerText());
  await pointer.locator('[data-pointer-source]').dragTo(pointer.locator('[data-pointer-target]'));
  await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent?.startsWith('{'));
  const physical=JSON.parse(await pointer.getByRole('status').innerText()),hostPhysical=await page.evaluate(()=>/** @type {any} */(window).__pointerTransferHost);await Bun.write(output+'/'+format+'-pointer.json',JSON.stringify({reference:referencePointer,guest:physical,host:hostPhysical},null,2));assert.deepEqual(physical.start,referencePointer.start);assert.deepEqual(physical.drop,referencePointer.drop);assert.ok(physical.start.trusted&&physical.drop.trusted);assert.equal(physical.start.text,'pointer source');assert.equal(physical.start.effect,'copy');assert.equal(physical.start.files,1);assert.ok(physical.protected.length>0);for(const row of physical.protected){assert.ok(row.trusted);assert.equal(row.text,'');assert.equal(row.files,0);assert.deepEqual(row,referencePointer.protected[0]);}assert.equal(physical.unexpected,0);assert.ok(['pointer source',format+'-host-owned.bin'].includes(referencePointer.drop.text));assert.equal(physical.drop.callback,physical.drop.text);assert.equal(physical.drop.effect,'copy');assert.equal(physical.drop.dropEffect,'copy');assert.equal(physical.drop.readonlyText,'');assert.equal(physical.drop.readonlyAdd,null);assert.equal(physical.drop.remove,'InvalidStateError');assert.deepEqual(physical.drop.after,{text:'',files:0});if(referencePointer.drop.bytes){assert.deepEqual(physical.drop.bytes,{length:131080,exact:true});assert.ok(hostPhysical.trusted&&hostPhysical.exact);assert.equal(hostPhysical.length,131080);}else assert.equal(hostPhysical,null);
  const cdp=await page.context().newCDPSession(page),external=[];
  try{
    for(const [target,status]of [['[data-pointer-oracle-target]','[data-pointer-oracle-status]'],['[data-pointer-target]','[role="status"]']]){
      const locator=pointer.locator(target);await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box);const data={items:[{mimeType:'text/plain',data:'external source'}],files:[file],dragOperationsMask:1};
      for(const type of /** @type {('dragEnter'|'dragOver'|'drop')[]} */(['dragEnter','dragOver','drop']))await cdp.send('Input.dispatchDragEvent',{type,x:box.x+box.width/2,y:box.y+box.height/2,data});
      await page.waitForFunction(selector=>{try{const value=JSON.parse(document.querySelector('dialog '+selector)?.textContent??'null');return value.error||value.drop?.text==='external source'&&value.drop?.callback==='external source';}catch{return false;}},status);external.push(JSON.parse(await pointer.locator(status).innerText()));
    }
    const input=pointer.getByLabel('Pointer file',{exact:true});await input.setInputFiles([]);await input.scrollIntoViewIfNeeded();const box=await input.boundingBox();assert.ok(box);const data={items:[],files:[file],dragOperationsMask:1};for(const type of /** @type {('dragEnter'|'dragOver'|'drop')[]} */(['dragEnter','dragOver','drop']))await cdp.send('Input.dispatchDragEvent',{type,x:box.x+box.width/2,y:box.y+box.height/2,data});await page.waitForFunction(()=>/** @type {HTMLInputElement|null} */(document.querySelector('[aria-label="Pointer file"]'))?.files?.length===1);
  }finally{await cdp.detach();}
  const externalHost=await page.evaluate(()=>/** @type {any} */(window).__pointerTransferHost);await Bun.write(output+'/'+format+'-external-drop.json',JSON.stringify({reference:external[0],guest:external[1],host:externalHost},null,2));assert.deepEqual(external[1].drop,external[0].drop);assert.equal(external[1].drop.files,1);assert.deepEqual(external[1].drop.bytes,{length:131080,exact:true});assert.equal(external[1].unexpected,0);assert.ok(externalHost.trusted&&externalHost.exact);assert.equal(externalHost.length,131080);assert.ok(external[1].protected.some((/** @type {any} */row)=>row.files===0&&row.text===''&&row.types.includes('Files')));
  await pointer.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await pointer.waitFor({state:'hidden'});
  const beforeUrl=page.url(),navigation=await page.context().newCDPSession(page);
  try{await page.evaluate(()=>window.addEventListener('drop',event=>{/** @type {any} */(window).__unhandledFileDrop={trusted:event.isTrusted,prevented:event.defaultPrevented};},{once:true}));const data={items:[],files:[file],dragOperationsMask:1};for(const type of /** @type {('dragEnter'|'dragOver'|'drop')[]} */(['dragEnter','dragOver','drop']))await navigation.send('Input.dispatchDragEvent',{type,x:4,y:4,data});await page.waitForFunction(()=>/** @type {any} */(window).__unhandledFileDrop);const policy=await page.evaluate(()=>/** @type {any} */(window).__unhandledFileDrop);assert.deepEqual(policy,{trusted:true,prevented:true});assert.equal(page.url(),beforeUrl);await Bun.write(output+'/'+format+'-drop-policy.json',JSON.stringify({policy,beforeUrl,afterUrl:page.url(),fileInputDefaultAccepted:true},null,2));}finally{await navigation.detach();}
  const guards=await call('transferGuards');await Bun.write(output+'/'+format+'-guards.json',JSON.stringify(guards,null,2));assert.equal(guards.malformed.length,9);assert.ok(guards.malformed.every((/** @type {string} */value)=>value!=='leaked'));for(const name of['foreign','foreignItem','foreignFile','foreignTicket','replay','binaryBudget','pendingLimit','retired'])assert.notEqual(guards[name],'leaked');assert.deepEqual(guards.text,{text:'guard'});assert.equal(guards.queued,64);assert.ok(guards.waitsForTasks&&guards.drained);assert.notEqual(guards.capacity.handleLimit,'leaked');assert.notEqual(guards.capacity.entryLimit,'leaked');assert.equal(guards.capacity.afterHandleRefusal,2047);assert.equal(guards.capacity.afterEntryRefusal,2048);assert.equal(guards.capacity.replacement,'replacement');
}
/** @param {import('playwright-core').Page} page @param {string} url */
export async function objectURLFetchFails(page,url){return page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},url);}
/** @param {import('playwright-core').Page} page @param {any} packet */
export async function checkObjectURLRows(page,packet,receipt=''){
 const observed=await page.evaluate(async rows=>{const result=[],policies=/** @type {any[]} */([]),onPolicy=(/** @type {SecurityPolicyViolationEvent} */event)=>policies.push({directive:event.effectiveDirective,blocked:event.blockedURI,policy:event.originalPolicy});document.addEventListener('securitypolicyviolation',onPolicy);try{for(const row of rows){try{const response=await fetch(row.url),bytes=new Uint8Array(await response.arrayBuffer()),type=response.headers.get('content-type')??'';result.push({label:row.label,status:response.status,type,length:bytes.length,exact:row.expected.pattern?bytes.every((value,index)=>value===index%251):JSON.stringify(Array.from(bytes))===JSON.stringify(row.expected.bytes),origin:new URL(row.url).origin});}catch(error){result.push({label:row.label,error:'unavailable',reason:String(error)});}}await new Promise(resolve=>setTimeout(resolve,0));return {rows:result,policies};}finally{document.removeEventListener('securitypolicyviolation',onPolicy);}},packet.rows);
 const rows=observed.rows;if(receipt)await Bun.write(receipt,JSON.stringify(observed,null,2));
 const origin=new URL(page.url()).origin;for(let i=0;i<rows.length;i++){const row=rows[i],expected=packet.rows[i];if(expected.revoked)assert.equal(row.error,'unavailable',expected.label);else{assert.equal(row.status,200,expected.label);assert.equal(row.type,expected.expected.type);assert.equal(row.length,expected.expected.length??expected.expected.bytes.length);assert.equal(row.exact,true,expected.label);assert.equal(row.origin,origin);}}
 return rows;
}
/** @param {import('playwright-core').Page} page @param {string} output @param {string} name @param {any} reference @param {any} guest */
export async function compareObjectURLs(page,output,name,reference,guest){
 await Bun.write(output+'/'+name+'.json',JSON.stringify({reference,guest},null,2));
 const shape=(/** @type {any} */packet)=>({...packet,rows:packet.rows.map((/** @type {any} */row)=>({...row,url:new URL(row.url).protocol}))});assert.deepEqual(shape(guest),shape(reference));assert.equal(guest.getterCalls,0);assert.equal(guest.unique,true);assert.deepEqual(guest.invalid,Array(8).fill('TypeError'));const native=await checkObjectURLRows(page,reference,output+'/'+name+'-reference-fetch.json'),actual=await checkObjectURLRows(page,guest,output+'/'+name+'-guest-fetch.json');await Bun.write(output+'/'+name+'.json',JSON.stringify({reference,guest,native,actual},null,2));assert.deepEqual(actual,native);
}
