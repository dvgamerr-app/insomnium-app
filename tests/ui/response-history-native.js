import assert from 'node:assert/strict';
import {mkdir,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer as createHttp2Server} from 'node:http2';
import {createServer as createHttpsServer} from 'node:https';
import {http2Metadata} from './helpers/http2-metadata.js';
import {lockScenarioDownloadReplacement} from './helpers/windows-workspace-lock.js';
import {respondToOwnedSaveDialog} from './helpers/windows-save-dialog.js';
import {respondToOwnedOpenDialog} from './helpers/windows-open-dialog.js';
import {initialData,historyLimit} from '../../src/lib/model.js';
import {withNativeApp,resourceCrudProbeIdentifier,selectedNativeProbeIdentifier,poll} from './helpers/native-app.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {exerciseNativeResponseHistory} from './helpers/response-history-native-cases.js';
import {createManualHttpFixture,manualMultipartParts} from './helpers/http-manual-fixture.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {exerciseManualHttpWorkflow} from './helpers/http-manual-workflow.js';
import {multipartBytes,exerciseMultipartResponse} from './helpers/response-multipart-cases.js';
import {ownedPdf} from './helpers/owned-pdf.js';

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Current audited embedded history/lease candidate required');
const downloadFailureOnly = process.env.INSOMNIUM_RESPONSE_DOWNLOAD_FAILURE_ONLY === "1";
const downloadsOnly = downloadFailureOnly || process.env.INSOMNIUM_RESPONSE_DOWNLOAD_NATIVE_ONLY === "1";
const actionsOnly = process.env.INSOMNIUM_REQUEST_ACTIONS_NATIVE_ONLY === "1";
const multipartOnly = process.env.INSOMNIUM_RESPONSE_MULTIPART_NATIVE_ONLY === "1";
const manualFocus = process.env.INSOMNIUM_HTTP_MANUAL_NATIVE === "1";
const oauthOnly = process.env.INSOMNIUM_HTTP_OAUTH_NATIVE === "1";
const http2Tls = process.env.INSOMNIUM_HTTP2_TLS_NATIVE === "1";
const http2Automatic = process.env.INSOMNIUM_HTTP2_AUTOMATIC === "1";
const http2Only = process.env.INSOMNIUM_HTTP2_NATIVE === "1" || http2Tls;
const multipartPicker = process.env.INSOMNIUM_HTTP_MULTIPART_PICKER_NATIVE === "1";
const pickerDiagnostic = process.env.INSOMNIUM_HTTP_PHYSICAL_PICKER_NATIVE === "1" || multipartPicker;
const htmlPreview = process.env.INSOMNIUM_RESPONSE_HTML_NATIVE === "1";
const imagePreview = process.env.INSOMNIUM_RESPONSE_IMAGE_NATIVE === "1";
const audioPreview = process.env.INSOMNIUM_RESPONSE_AUDIO_NATIVE === "1";
const csvPreview = process.env.INSOMNIUM_RESPONSE_CSV_NATIVE === "1";
const pdfPreview = process.env.INSOMNIUM_RESPONSE_PDF_NATIVE === "1";
const charsetPreview = process.env.INSOMNIUM_RESPONSE_CHARSET_NATIVE === "1";
assert.ok(!http2Automatic || http2Tls);
assert.ok([actionsOnly,downloadsOnly,multipartOnly,manualFocus,oauthOnly,http2Only,pickerDiagnostic,htmlPreview,imagePreview,audioPreview,csvPreview,pdfPreview,charsetPreview].filter(Boolean).length<=1);
const ownedCrud = !!process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
const nativeOptions = ownedCrud ? {expectedIdentifier:resourceCrudProbeIdentifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP} : {expectedIdentifier:selectedNativeProbeIdentifier()};
const runScenario = async () => withResourceProbePreserved(async(capture)=>{
 let fixture = /** @type {Awaited<ReturnType<typeof createManualHttpFixture>>|undefined} */(undefined);
 let scenarioOutput = '';
 const failures = /** @type {unknown[]} */([]);
 const h2Records=/** @type {Record<string,any>[]} */([]),h2Sessions=new Set();let h2Server=/** @type {ReturnType<typeof createHttp2Server>|undefined} */(undefined),h2TlsFixture=/** @type {Awaited<ReturnType<typeof http2Metadata>>|undefined} */(undefined),h2Url='';
 if(http2Only&&!http2Tls){
  h2Server=createHttp2Server();h2Server.on('session',session=>{h2Sessions.add(session);session.on('close',()=>h2Sessions.delete(session));session.on('error',()=>{});});
  h2Server.on('stream',(stream,headers)=>{const row={method:headers[':method'],path:headers[':path']};h2Records.push(row);stream.on('error',()=>{});(/** @type {import('node:http2').ServerHttp2Stream} */(stream)).respond({':status':200,'content-type':'text/plain','x-owned-http2':'yes'});stream.end('owned HTTP/2 response');});
  const server=h2Server;await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(null));});const address=server.address();assert.ok(address&&typeof address==='object');h2Url=`http://127.0.0.1:${address.port}/owned-http2`;
 }
 if(ownedCrud || actionsOnly || downloadsOnly || multipartOnly || manualFocus || oauthOnly || pickerDiagnostic) fixture = await createManualHttpFixture(multipartOnly?{reply:()=>({body:multipartBytes,contentType:'multipart/mixed; boundary="owned+parts"'})}:charsetPreview?{reply:()=>({body:Buffer.from([65,0,0,0,66,0,0,0]),contentType:'text/plain; charset=utf-32le'})}:downloadsOnly?{reply:record=>({body:Buffer.from(record.token==='owned-download-explicit'?[42,0,255,127,10,13]:[0,255,13,10,42]),contentType:'application/octet-stream'})}:oauthOnly?{reply:record=>record.token!=='oauth-resource'?{body:Buffer.from(JSON.stringify({access_token:'owned-oauth-token',token_type:'Bearer',expires_in:3600})),contentType:'application/json'}:{body:Buffer.from('owned response'),contentType:'text/plain'}}:{});
 try {await withNativeApp(multipartOnly?'response-multipart-native':downloadsOnly?'response-download-native':actionsOnly?'request-action-ownership-native':'response-history-native',async(context)=>{
  const {page,invoke,output,pid}=context;
  scenarioOutput=output;
  if(ownedCrud){
    const ownership=await Bun.file(/** @type {string} */(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP)).json();
    assert.equal(ownership.identifier,resourceCrudProbeIdentifier);assert.equal(ownership.state,'owned');
    const launch=ownership.launches.at(-1);assert.equal(launch?.pid,pid);
    assert.equal(launch.directoryAbsentAtBind,false,'Manual workflow requires reviewed existing owned profile');
    assert.equal(launch.profileBinding,'native-path-directory');await capture();
  }
  const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
  const original=await invoke('load_workspace'),owned=initialData(),collection=owned.resources.find(row=>row._type==='workspace');assert.ok(collection);collection.name='Native history '+crypto.randomUUID();const request=owned.resources.find(row=>row._id===owned.activeRequestId);assert.ok(request);request.name=downloadsOnly?'owned-download':collection.name;
  if(http2Tls){h2TlsFixture=await http2Metadata(output,Buffer.from('owned HTTP/2 response'));h2Url=h2TlsFixture.url;}
  if(multipartOnly){assert.ok(fixture);request.url=fixture.target('owned-multipart','finite');}
  if(http2Only)request.url=h2Url;
  if(pickerDiagnostic){assert.ok(fixture);request.url=fixture.target('physical-picker','finite');request.method='POST';}
  if(oauthOnly){assert.ok(fixture);request.url=fixture.target('oauth-resource','finite');request.authentication={type:'oauth2',grantType:'client_credentials',accessTokenUrl:fixture.target('oauth-token','finite'),clientId:'owned-client',clientSecret:'owned-secret'};}
  const history=(multipartOnly?[]:[200,404,503]).map((status,index)=>({_id:'res_native_history_'+crypto.randomUUID(),_type:'response',requestId:owned.activeRequestId,created:1720000030000-index*10000,status,statusText:'Owned '+status,elapsedMs:10,size:20,headers:[['Content-Type','text/plain']],body:'Owned history body '+status}));
  let htmlBody='';
  if(htmlPreview){assert.ok(fixture);const target=fixture.target('preview-blocked','finite');htmlBody=`<!doctype html><html><head><style>#mark{color:rgb(12,34,56)}</style><meta http-equiv="refresh" content="0;url=${target}"></head><body><h1 id="mark">HTML preview ไทย</h1><p id="script-state">not executed</p><script>document.querySelector('#script-state').textContent='executed'</script><img src="${target}"><iframe src="${target}"></iframe><audio src="${target}" autoplay></audio></body></html>`;history.splice(1);Object.assign(history[0],{headers:[['Content-Type','text/html; charset=utf-8']],body:htmlBody,bodyBase64:Buffer.from(htmlBody).toString('base64')});owned.resources.push({_id:'reqm_'+crypto.randomUUID(),_type:'request_meta',parentId:owned.activeRequestId,previewMode:'source'});}
  let imageBase64='';
  if(imagePreview){const bytes=await Bun.file('static/app-icon.png').bytes();imageBase64=Buffer.from(bytes).toString('base64');history.splice(1);Object.assign(history[0],{headers:[['Content-Type','image/png']],body:'Owned image text',bodyBase64:imageBase64});owned.resources.push({_id:'reqm_'+crypto.randomUUID(),_type:'request_meta',parentId:owned.activeRequestId,previewMode:'source'});}
  let audioBase64='';
  if(audioPreview){const bytes=Buffer.alloc(204);bytes.write('RIFF',0);bytes.writeUInt32LE(196,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(160,40);audioBase64=bytes.toString('base64');history.splice(1);Object.assign(history[0],{headers:[['Content-Type','audio/wav']],body:'Owned audio text',bodyBase64:audioBase64});owned.resources.push({_id:'reqm_'+crypto.randomUUID(),_type:'request_meta',parentId:owned.activeRequestId,previewMode:'source'});}
  let csvBody='';
  if(csvPreview){csvBody='\ufeffname,note,id\r\n"A, ไทย","line1\r\nline2","0007"\r\nliteral,"<img src=x onerror=alert(1)>",9007199254740993\r\n\r\n'+Array.from({length:205},(_,index)=>`row-${index},value-${index},${index}`).join('\r\n');history.splice(1);Object.assign(history[0],{headers:[['Content-Type','text/csv; charset=utf-8']],body:csvBody,bodyBase64:Buffer.from(csvBody).toString('base64')});}
  const pdfBase64=pdfPreview?ownedPdf():'';
  if(pdfPreview){history.splice(1);Object.assign(history[0],{headers:[['Content-Type','application/pdf'],['Content-Disposition',"attachment; filename=report.pdf; filename*=UTF-8''%E0%B9%84%E0%B8%97%E0%B8%A2.pdf"]],body:'Owned PDF text representation',bodyBase64:pdfBase64});}
  if(charsetPreview){history.splice(1);Object.assign(history[0],{headers:[['Content-Type','text/plain; charset=utf-32le'],['Content-Disposition','attachment; filename="owned-utf32.bin"']],body:'A\0\0\0B\0\0\0',bodyBase64:Buffer.from([65,0,0,0,66,0,0,0]).toString('base64')});}
  if(downloadsOnly&&!downloadFailureOnly)for(const [index,name] of ['CONIN$.bin','CONOUT$.bin'].entries()){history[index].headers.push(['Content-Disposition',`attachment; filename="${name}"`]);Object.assign(history[index],{bodyBase64:'AP8NCio=',size:5});}
  const maxHistory=Math.max(historyLimit(original.settings.maxHistory),original.history.length+history.length);assert.equal(historyLimit(maxHistory),maxHistory,'Owned fixtures must fit the existing bounded history policy');
  const seed={...original,settings:{...original.settings,maxHistory,...(multipartOnly?{proxy:'',timeout:30000}:{}),...(http2Tls?{caPem:h2TlsFixture?.ca,validateCertificates:true,proxy:''}:{})},resources:[...original.resources,...owned.resources],history:[...original.history,...history],activeWorkspaceId:owned.activeWorkspaceId,activeRequestId:owned.activeRequestId,activeEnvironmentId:'',openTabs:[...original.openTabs,owned.activeRequestId]};
  await invoke('save_workspace',{data:seed});const actual=await invoke('load_workspace'),saved=actual.resources.find((/** @type {any} */row)=>row._id===collection._id&&row._type==='workspace');assert.ok(saved);assert.equal(saved.name,collection.name);registerResourceProbeCollection(saved._id,saved.name);
  await Bun.write(output+'/fixture-collection.json',JSON.stringify({id:saved._id,name:saved.name,requestId:owned.activeRequestId,historyBudget:{original:original.settings.maxHistory,fixture:maxHistory,originalRows:original.history.length,ownedRows:history.length},registeredBeforeReloadAndHistoryOperations:true},null,2));await page.reload();
  if(charsetPreview){
   assert.ok(fixture);const editor=page.locator('textarea[aria-label="Response body"]').first();await poll(async()=>await editor.inputValue()==='AB','UTF-32 response decoded');
   const path=join(output,'owned-utf32.bin'),saving=respondToOwnedSaveDialog(pid,output,path,'.bin','owned-utf32.bin');void saving.catch(()=>{});await page.getByRole('button',{name:'Save response',exact:true}).click();await saving;await poll(()=>Bun.file(path).exists(),'Original UTF-32 response saved');assert.deepEqual([...await Bun.file(path).bytes()],[65,0,0,0,66,0,0,0]);await unlink(path);
   const modes=page.getByRole('group',{name:'Response formatting',exact:true});await modes.getByRole('button',{name:'Raw',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===request._id&&r.previewMode==='raw'),'Raw charset mode saved');await page.reload();await poll(async()=>await editor.inputValue()==='AB','UTF-32 display survives reload');
   const restored=(await invoke('load_workspace')).history.find((/** @type {any} */r)=>r._id===history[0]._id);assert.equal(restored.body,history[0].body);assert.equal(restored.bodyBase64,Buffer.from([65,0,0,0,66,0,0,0]).toString('base64'));assert.equal(fixture.records.length,0);
   const target=fixture.target('utf32-live','finite');await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(target);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();await page.getByRole('button',{name:'Send',exact:true}).click();
   await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */r)=>r.requestId===request._id&&r.url===target&&r.status===200),'UTF-32 live response saved');await poll(async()=>await editor.inputValue()==='AB','UTF-32 live response displayed');
   const live=(await invoke('load_workspace')).history.find((/** @type {any} */r)=>r.requestId===request._id&&r.url===target);assert.equal(live.bodyBase64,Buffer.from([65,0,0,0,66,0,0,0]).toString('base64'));assert.equal(live.body,'AB');
   const livePath=join(output,'live-utf32.bin'),liveSaving=respondToOwnedSaveDialog(pid,output,livePath,'.bin','response.bin');void liveSaving.catch(()=>{});await page.getByRole('button',{name:'Save response',exact:true}).click();await liveSaving;await poll(()=>Bun.file(livePath).exists(),'Live UTF-32 response saved');assert.deepEqual([...await Bun.file(livePath).bytes()],[65,0,0,0,66,0,0,0]);await unlink(livePath);
   await page.reload();await poll(async()=>await editor.inputValue()==='AB','UTF-32 live response retained after reload');assert.equal(fixture.records.length,1);assert.deepEqual(errors,[]);
   await Bun.write(output+'/charset-preview-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',utf32Decoded:true,saveExactBytes:true,rawReload:true,storedBodyUnchanged:true,liveHttp:true,liveSaveExact:true,liveReload:true,requests:1},null,2));return;
  }
  if(pdfPreview){
   assert.ok(fixture);await page.getByText('PDF page text',{exact:true}).click();await page.locator('.pdf-preview pre').filter({hasText:'Owned PDF page one'}).waitFor();
   const path=join(output,'owned-pdf.bin'),saving=respondToOwnedSaveDialog(pid,output,path,'.bin','ไทย.pdf');void saving.catch(()=>{});await page.getByRole('button',{name:'Save response',exact:true}).click();await saving;await poll(()=>Bun.file(path).exists(),'PDF response saved');assert.equal(Buffer.from(await Bun.file(path).bytes()).toString('base64'),pdfBase64);await unlink(path);
   const canvas=page.locator('canvas[aria-label="PDF page 1"]');assert.deepEqual(await canvas.evaluate(el=>{const c=/** @type {HTMLCanvasElement} */(el),ctx=c.getContext('2d');if(!ctx)throw Error('PDF canvas unavailable');return Array.from(ctx.getImageData(Math.floor(c.width*25/300),Math.floor(c.height*175/200),1,1).data);}),[0,0,255,255]);
   await page.getByRole('button',{name:'Next page',exact:true}).click();await page.locator('.pdf-preview pre').filter({hasText:'Owned PDF page two'}).waitFor();await page.getByRole('combobox',{name:'PDF zoom',exact:true}).selectOption('1.5');await page.waitForFunction(()=>document.querySelector('canvas[aria-label="PDF page 2"]')?.getAttribute('style')?.includes('450px'));
   await page.getByRole('button',{name:'Previous page',exact:true}).click();await page.locator('.pdf-preview pre').filter({hasText:'Owned PDF page one'}).waitFor();assert.equal(await page.evaluate(()=>!!/** @type {any} */(window).__ownedPdfAction),false);
   const modes=page.getByRole('group',{name:'Response formatting',exact:true});await modes.getByRole('button',{name:'Raw',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===request._id&&r.previewMode==='raw'),'Raw PDF mode saved');await page.reload();await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');assert.equal((await invoke('load_workspace')).history.find((/** @type {any} */r)=>r._id===history[0]._id).bodyBase64,pdfBase64);
   assert.equal(fixture.records.length,0);assert.deepEqual(errors,[]);await Bun.write(output+'/pdf-preview-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',pages:2,canvasPixels:true,pageText:true,navigation:true,zoom:true,documentActionNotExecuted:true,saveExact:true,rawReload:true,bytesPreserved:true},null,2));return;
  }
  if(csvPreview){
   assert.ok(fixture);const table=page.getByRole('table',{name:'CSV response',exact:true});await table.waitFor();assert.equal(await table.getByRole('row').count(),200);
   assert.deepEqual(await table.getByRole('row',{name:'CSV row 2',exact:true}).getByRole('cell').allTextContents(),['A, ไทย','line1\r\nline2','0007']);
   assert.equal(await table.getByRole('row',{name:'CSV row 3',exact:true}).getByRole('cell').nth(2).textContent(),'9007199254740993');assert.equal(await table.locator('img,script').count(),0);
   await page.getByRole('button',{name:'Next rows',exact:true}).click();await table.getByRole('row',{name:'CSV row 208',exact:true}).waitFor();assert.equal(await table.getByRole('row').count(),8);
   assert.deepEqual(await table.getByRole('row',{name:'CSV row 208',exact:true}).getByRole('cell').allTextContents(),['row-204','value-204','204']);
   const number=page.getByRole('spinbutton',{name:'CSV page',exact:true});await number.fill('1');await number.press('Tab');await table.getByRole('row',{name:'CSV row 1',exact:true}).waitFor();
   const modes=page.getByRole('group',{name:'Response formatting',exact:true});await modes.getByRole('button',{name:'Source',exact:true}).click();assert.equal(await page.locator('.response-pane .CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),csvBody.replaceAll('\r\n','\n'));
   await modes.getByRole('button',{name:'Raw',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===request._id&&r.previewMode==='raw'),'Raw CSV mode saved');
   await page.reload();await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');assert.equal((await invoke('load_workspace')).history.find((/** @type {any} */r)=>r._id===history[0]._id).body,csvBody);
   assert.equal(fixture.records.length,0);assert.deepEqual(errors,[]);await Bun.write(output+'/csv-preview-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',rows:208,pageRows:200,quotedFields:true,unicode:true,markupEscaped:true,sourceExact:true,rawReload:true,bodyPreserved:true},null,2));return;
  }
  if(audioPreview){
   assert.ok(fixture);const modes=page.getByRole('group',{name:'Response formatting',exact:true}),iframe=page.getByTitle('Audio response preview',{exact:true});
   await modes.getByRole('button',{name:'Preview',exact:true}).click();await iframe.waitFor();assert.equal(await iframe.getAttribute('sandbox'),'');
   const preview=page.frameLocator('iframe[title="Audio response preview"]'),player=preview.getByLabel('Response audio',{exact:true});
   let mediaState=/** @type {any} */({});
   await poll(async()=>{mediaState=await player.evaluate(el=>{const audio=/** @type {HTMLAudioElement} */(el);return {readyState:audio.readyState,networkState:audio.networkState,error:audio.error?.code??null,message:audio.error?.message??'',support:audio.canPlayType('audio/wav')};});if(mediaState.error!==null)throw Error('Audio decode failed: '+JSON.stringify(mediaState));return mediaState.readyState>=1;},'Audio metadata loaded',10000).catch(error=>{throw Error(String(error)+' '+JSON.stringify(mediaState));});
   assert.deepEqual(await player.evaluate(el=>{const audio=/** @type {HTMLAudioElement} */(el);return {paused:audio.paused,autoplay:audio.autoplay,controls:audio.controls,duration:audio.duration};}),{paused:true,autoplay:false,controls:true,duration:0.01});
   assert.equal(await player.getAttribute('src'),'data:audio/wav;base64,'+audioBase64);assert.equal(await preview.locator('body').evaluate(()=>{try{void parent.document.body;return true;}catch{return false;}}),false);
   const box=await player.boundingBox();assert.ok(box&&box.width>50&&box.height>20);await player.click({position:{x:25,y:box.height/2}});
   await poll(async()=>await player.evaluate(el=>/** @type {HTMLAudioElement} */(el).ended),'Native audio control plays to completion',10000);
   await modes.getByRole('button',{name:'Raw',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===request._id&&r.previewMode==='raw'),'Raw audio mode saved');
   await page.reload();await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');assert.equal((await invoke('load_workspace')).history.find((/** @type {any} */r)=>r._id===history[0]._id).bodyBase64,audioBase64);
   assert.equal(fixture.records.length,0);assert.deepEqual(errors,[]);await Bun.write(output+'/audio-preview-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',sandbox:true,opaqueOrigin:true,metadataDuration:0.01,paused:true,autoplay:false,controls:true,controlPlaybackEnded:true,exactDataUrl:true,rawReload:true,bytesPreserved:true},null,2));return;
  }
  if(imagePreview){
   assert.ok(fixture);const modes=page.getByRole('group',{name:'Response formatting',exact:true}),iframe=page.getByTitle('Image response preview',{exact:true});
   await modes.getByRole('button',{name:'Preview',exact:true}).click();await iframe.waitFor();assert.equal(await iframe.getAttribute('sandbox'),'');
   const preview=page.frameLocator('iframe[title="Image response preview"]'),image=preview.getByAltText('Response image',{exact:true});
   const dimensions=await image.evaluate(async el=>{const image=/** @type {HTMLImageElement} */(el);await image.decode();return [image.naturalWidth,image.naturalHeight];});
   const bytes=Buffer.from(imageBase64,'base64');assert.deepEqual(dimensions,[bytes.readUInt32BE(16),bytes.readUInt32BE(20)]);assert.equal(await image.getAttribute('src'),'data:image/png;base64,'+imageBase64);
   assert.equal(await preview.locator('body').evaluate(()=>{try{void parent.document.body;return true;}catch{return false;}}),false);
   await modes.getByRole('button',{name:'Raw',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===request._id&&r.previewMode==='raw'),'Raw image mode saved');
   await page.reload();await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');assert.equal((await invoke('load_workspace')).history.find((/** @type {any} */r)=>r._id===history[0]._id).bodyBase64,imageBase64);
   assert.equal(fixture.records.length,0);assert.deepEqual(errors,[]);await Bun.write(output+'/image-preview-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',sandbox:true,opaqueOrigin:true,dimensions,exactDataUrl:true,rawReload:true,bytesPreserved:true,loopbackRequests:0},null,2));return;
  }
  if(htmlPreview){
   assert.ok(fixture);const modes=page.getByRole('group',{name:'Response formatting',exact:true}),iframe=page.getByTitle('HTML response preview',{exact:true});
   await modes.getByRole('button',{name:'Preview',exact:true}).click();await iframe.waitFor();assert.equal(await iframe.getAttribute('sandbox'),'');
   const preview=page.frameLocator('iframe[title="HTML response preview"]');await preview.locator('#mark').waitFor();
   assert.equal(await preview.locator('#mark').innerText(),'HTML preview ไทย');assert.equal(await preview.locator('#mark').evaluate(el=>getComputedStyle(el).color),'rgb(12, 34, 56)');
   assert.equal(await preview.locator('#script-state').innerText(),'not executed');assert.equal(await preview.locator('body').evaluate(()=>{try{void parent.document.body;return true;}catch{return false;}}),false);
   await poll(async()=>await preview.locator('audio').evaluate(el=>/** @type {HTMLAudioElement} */(el).error?.code===4),'Remote audio rejected',10000);
   await modes.getByRole('button',{name:'Source',exact:true}).click();assert.equal(await page.locator('.response-pane .CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),htmlBody);
   await modes.getByRole('button',{name:'Raw',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===request._id&&r.previewMode==='raw'),'Raw preview mode saved');
   await page.reload();await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.response-pane .CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),htmlBody);
   assert.equal(fixture.records.length,0,'Sandbox makes no requests to loopback');assert.deepEqual(errors,[]);
   await Bun.write(output+'/html-preview-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',sandbox:true,scriptBlocked:true,opaqueOrigin:true,loopbackRequests:0,sourceExact:true,rawReload:true},null,2));return;
  }
  if(pickerDiagnostic){
   await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Body',exact:true}).click();await page.getByRole('combobox',{name:'Body type',exact:true}).selectOption(multipartPicker?'multipart/form-data':'application/octet-stream');
   if(multipartPicker){await page.getByRole('button',{name:'Add parameter',exact:true}).click();await page.getByRole('textbox',{name:'Parameter 1',exact:true}).fill('upload');await page.locator('.kv-row').first().getByRole('combobox',{name:'Field type',exact:true}).selectOption('file');}
   const input=multipartPicker?page.locator('.kv-row').first().locator('input[type=file]'):page.locator('.binary-picker input[type=file]');
   const body=async()=>(await invoke('load_workspace')).resources.find((/** @type {any} */row)=>row._id===request._id)?.body;const selectedBytes=async()=>multipartPicker?(await body())?.params?.[0]?.base64:(await body())?.base64;
   assert.ok(fixture);let chooser=respondToOwnedOpenDialog(pid,output,null,'file','.json',{webview:true});void chooser.catch(()=>{});await input.click();const cancel=await chooser;assert.ok(!await selectedBytes());
   const file=join(output,'owned-upload.json'),bytes=Buffer.from([0,255,13,10,42,128]);await Bun.write(file,bytes);chooser=respondToOwnedOpenDialog(pid,output,file,'file','.json',{webview:true});void chooser.catch(()=>{});await input.click();const selected=await chooser;
   await poll(async()=>await selectedBytes()===bytes.toString('base64'),'Physical picker selection persisted',60000);
   chooser=respondToOwnedOpenDialog(pid,output,null,'file','.json',{webview:true});void chooser.catch(()=>{});await input.click();const cancelReplacement=await chooser;assert.equal(await selectedBytes(),bytes.toString('base64'));
   const replacementFile=join(output,'replacement.json'),replacementBytes=Buffer.from([42,0,128,255,10]);await Bun.write(replacementFile,replacementBytes);chooser=respondToOwnedOpenDialog(pid,output,replacementFile,'file','.json',{webview:true});void chooser.catch(()=>{});await input.click();const replacement=await chooser;await poll(async()=>await selectedBytes()===replacementBytes.toString('base64'),'Physical picker replacement persisted',60000);
   await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>fixture.records.some(row=>row.token==='physical-picker'&&row.bodyReadAt!==null),'Physical picker bytes sent',60000);
   if(multipartPicker){const parts=manualMultipartParts(Buffer.from(fixture.records[0].bodyBase64,'base64'),fixture.records[0].headers['content-type']);assert.equal(parts.length,1);assert.match(parts[0].headers,/name="upload"; filename="replacement\.json"/);assert.deepEqual(parts[0].body,replacementBytes);}else assert.equal(fixture.records[0].bodyBase64,replacementBytes.toString('base64'));
   await page.reload();assert.equal(await selectedBytes(),replacementBytes.toString('base64'));assert.equal(fixture.records.length,1);assert.deepEqual(errors,[]);
   await Bun.write(output+'/picker-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',multipart:multipartPicker,cancel,selected,cancelReplacement,replacement,physicalSelection:true,initialBytes:[...bytes],replacementBytes:[...replacementBytes],wire:true,reload:true},null,2));return;
  }
  if(http2Only){
   const records=http2Tls?h2TlsFixture?.requests:h2Records;assert.ok(records);
   const version=http2Automatic?'default':'2-prior-knowledge';await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Settings',exact:true}).click();await page.getByLabel('HTTP version',{exact:true}).selectOption(version);
   await poll(async()=>(await invoke('load_workspace')).resources.find((/** @type {any} */row)=>row._id===request._id)?.settingHttpVersion===version,'HTTP version setting persisted',60000);
   await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.body==='owned HTTP/2 response'&&row.httpVersion==='HTTP/2'),'HTTP/2 response persisted',60000);
   assert.equal(records.length,1);assert.equal(records[0].method,'GET');assert.equal(records[0].path,http2Tls?'/gzip':'/owned-http2');if(http2Tls)assert.equal(records[0].alpn,'h2');await page.reload();await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Settings',exact:true}).click();assert.equal(await page.getByLabel('HTTP version',{exact:true}).inputValue(),version);
   await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>records.length===2,'HTTP/2 resend after reload',60000);await poll(async()=>(await invoke('load_workspace')).history.filter((/** @type {any} */row)=>row.requestId===request._id&&row.httpVersion==='HTTP/2').length===2,'HTTP/2 histories persisted',60000);if(http2Tls)assert.ok(records.every(row=>row.alpn==='h2'));assert.deepEqual(errors,[]);
   if(http2Automatic){
    const sockets=new Set(),requests=/** @type {string[]} */([]),server=createHttpsServer({key:await Bun.file(join(output,'http2-fixture','server.key')).text(),cert:await Bun.file(join(output,'http2-fixture','server.pem')).text(),ALPNProtocols:['http/1.1']},(req,res)=>{requests.push(req.url||'');res.writeHead(200,{'content-type':'text/plain','connection':'close'});res.end('owned HTTP/1 fallback');});
    server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(null));});
    try{const address=server.address();assert.ok(address&&typeof address==='object');await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(`https://127.0.0.1:${address.port}/fallback`);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.httpVersion==='HTTP/1.1'&&row.body==='owned HTTP/1 fallback'),'Automatic HTTPS HTTP/1 fallback',60000);assert.deepEqual(requests,['/fallback']);}
    finally{await new Promise(resolve=>server.close(()=>resolve(null)));assert.equal(sockets.size,0);}
   }
   await Bun.write(output+'/http2-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',priorKnowledge:!http2Automatic,tls:http2Tls,alpn:http2Tls?'h2':null,requests:records,response:'owned HTTP/2 response',settingReloaded:true,histories:2,automaticHttp1Fallback:http2Automatic},null,2));return;
  }
  if(oauthOnly){
   assert.ok(fixture);await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Auth',exact:true}).click();
   await page.getByRole('button',{name:'Fetch token',exact:true}).click();await page.getByText('API token ready',{exact:true}).waitFor({timeout:60000});
   assert.equal(fixture.records.length,1);assert.equal(fixture.records[0].token,'oauth-token');assert.equal(fixture.records[0].method,'POST');assert.equal(fixture.records[0].headers.authorization,'Basic '+Buffer.from('owned-client:owned-secret').toString('base64'));assert.equal(new URLSearchParams(Buffer.from(fixture.records[0].bodyBase64,'base64').toString()).get('grant_type'),'client_credentials');
   await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>fixture.records.some(row=>row.token==='oauth-resource'&&row.bodyReadAt!==null),'OAuth API request arrived',60000);
   assert.equal(fixture.records.length,2);assert.equal(fixture.records[1].headers.authorization,'Bearer owned-oauth-token');await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.status===200),'OAuth response persisted',60000);
   await page.reload();await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Auth',exact:true}).click();await page.getByText('API token ready',{exact:true}).waitFor({timeout:60000});assert.equal(fixture.records.length,2);
   const previousTokens=(await invoke('load_workspace')).resources.filter((/** @type {any} */row)=>row._type==='oauth2_token'&&row.parentId===request._id);assert.equal(previousTokens.length,1);
   const stale=fixture.target('oauth-stale','held');await page.getByLabel('Access token URL',{exact:true}).fill(stale);await page.getByRole('button',{name:'Fetch token',exact:true}).click();
   await poll(async()=>fixture.records.some(row=>row.token==='oauth-stale'&&row.bodyReadAt!==null),'Stale OAuth exchange reached peer',60000);await page.getByLabel('Client ID',{exact:true}).fill('changed-client');assert.equal(fixture.release('oauth-stale'),true);
   await page.getByText(/OAuth settings or environment changed/).waitFor({timeout:60000});await poll(async()=>JSON.stringify((await invoke('load_workspace')).resources.filter((/** @type {any} */row)=>row._type==='oauth2_token'&&row.parentId===request._id))===JSON.stringify(previousTokens),'Stale exchange keeps prior token',60000);
   const held=fixture.target('oauth-held','held');await page.getByLabel('Access token URL',{exact:true}).fill(held);await page.getByRole('button',{name:'Fetch token',exact:true}).click();
   await poll(async()=>fixture.records.some(row=>row.token==='oauth-held'&&row.bodyReadAt!==null),'Held OAuth exchange reached peer',60000);
   await page.getByRole('button',{name:'Manage '+request.name,exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Delete…',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();await dialog.waitFor({state:'detached'});
   await poll(async()=>fixture.records.find(row=>row.token==='oauth-held')?.cancelled===true,'Deleted owner cancels token exchange',60000);assert.equal(fixture.release('oauth-held'),false);
   await poll(async()=>!(await invoke('load_workspace')).resources.some((/** @type {any} */row)=>row._id===request._id||row.parentId===request._id),'Deleted request and token remain absent',60000);await page.reload();assert.ok(!(await invoke('load_workspace')).resources.some((/** @type {any} */row)=>row._id===request._id||row.parentId===request._id));assert.equal(fixture.records.length,4);assert.deepEqual(errors,[]);
   await Bun.write(output+'/oauth-acceptance.json',JSON.stringify({passed:true,grant:'client_credentials',renderingMode:'native-hidden',tokenExchange:true,basicCredentials:true,resourceBearer:true,responsePersisted:true,reloadTokenReady:true,changedSettingsDiscardLateToken:true,priorTokenPreserved:true,deleteOwnerCancelsHeldExchange:true,deletedTokenAbsent:true,requests:fixture.records.length},null,2));return;
  }
  if(multipartOnly){
   assert.ok(fixture);await page.getByRole('button',{name:'Send',exact:true}).click();
   await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.url===request.url),'Actual multipart response saved');
   const loadHistory=async()=>(await invoke('load_workspace')).history;
   const received=(await loadHistory()).filter((/** @type {any} */row)=>row.requestId===request._id);assert.equal(received.length,1);
   assert.equal(received[0].status,200);assert.equal(received[0].bodyBase64,multipartBytes.toString('base64'));assert.equal(received[0].bytesRead,multipartBytes.length);
   const result=await exerciseMultipartResponse({page,output,pid,loadHistory});
   assert.equal(fixture.records.length,1);assert.equal(fixture.records[0].method,'GET');assert.equal(fixture.records[0].bodyBytes,0);assert.deepEqual(errors,[]);
   assert.deepEqual((await loadHistory()).filter((/** @type {any} */row)=>row.requestId!==request._id),original.history);
   await Bun.write(output+'/multipart-acceptance.json',JSON.stringify({...result,renderingMode:'native-hidden',mockedIpc:false,realHttpSend:true,requests:fixture.records,originalHistoryPreserved:true},null,2));return;
  }
  if(downloadsOnly){
   assert.ok(fixture);
   if(!downloadFailureOnly){
    const trigger=page.getByRole('button',{name:'Response history',exact:true}),list=page.getByRole('listbox',{name:'Response history',exact:true});
    for(const [index,name] of ['CONIN$.bin','CONOUT$.bin'].entries()){
     await trigger.click();await list.waitFor();await list.getByRole('option').nth(index).click();await list.waitFor({state:'detached'});
     const saved=join(output,`device-name-${index}.bin`),saving=respondToOwnedSaveDialog(pid,output,saved,'.bin','_'+name);void saving.catch(()=>{});
     await page.getByRole('button',{name:'Save response',exact:true}).click();await saving;await poll(()=>Bun.file(saved).exists(),'Sanitized native response saved');
     assert.deepEqual([...await Bun.file(saved).bytes()],[0,255,13,10,42]);await unlink(saved);
    }
   }
   const directory=join(output,'downloads');await mkdir(directory);
   const target=fixture.target('owned-download','finite'),explicit=fixture.target('owned-download-explicit','finite'),saveTarget=fixture.target('owned-download-save','finite'),file=join(directory,'owned-download.bin');
   await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(target);
   await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
   const actions=page.getByRole('button',{name:'Request actions',exact:true});await actions.click();
   let chooser;
   if(!downloadFailureOnly){
   chooser=respondToOwnedOpenDialog(pid,output,null,'folder');
   await page.getByRole('button',{name:'Download After Send',exact:true}).click();await chooser;
   await poll(async()=>page.getByRole('button',{name:'Download After Send',exact:true}).isEnabled(),'Cancelled native folder chooser callback settled');
   await page.getByText('Download After Send is off.',{exact:true}).waitFor();
   }
   chooser=respondToOwnedOpenDialog(pid,output,directory,'folder');
   await page.getByRole('button',{name:'Download After Send',exact:true}).click();await chooser;
   await poll(async()=>(await page.getByText('Download After Send:',{exact:false}).textContent())?.includes(directory)===true,'Selected native destination displayed');
   await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
   if(downloadFailureOnly){
    await Bun.write(file,Uint8Array.from([9,8,7]));
    const lock=await lockScenarioDownloadReplacement(output,file);
    let autoError='',explicitError='';
    try{
     await page.getByRole('button',{name:'Send',exact:true}).click();
     const notice=page.getByRole('status').filter({hasText:'Response received; download failed:'});await notice.waitFor();autoError=await notice.innerText();
     await page.getByRole('button',{name:'Send',exact:true}).waitFor();
     assert.deepEqual([...await Bun.file(file).bytes()],[9,8,7]);
     assert.deepEqual((await readdir(directory)).sort(),['owned-download.bin']);
     await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(explicit);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
     await actions.click();await page.getByRole('button',{name:'Send And Download',exact:true}).click();
     const alert=page.locator('.notification.error[role=alert]');await alert.waitFor();explicitError=await alert.innerText();assert.match(explicitError,/os error [0-9]+/i);
     await poll(async()=>actions.isEnabled(),'Failed explicit write completion');
     assert.deepEqual([...await Bun.file(file).bytes()],[9,8,7]);assert.deepEqual((await readdir(directory)).sort(),['owned-download.bin']);
    }finally{lock.release();}
    await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(target);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(async()=>JSON.stringify([...await Bun.file(file).bytes()])===JSON.stringify([0,255,13,10,42]),'Unlocked retry writes response');
    await page.getByRole('button',{name:'Send',exact:true}).waitFor();assert.equal(await page.locator('.notification.error[role=alert]').count(),0);
    const final=await invoke('load_workspace'),responses=final.history.filter((/** @type {any} */row)=>row.requestId===request._id&&[target,explicit].includes(row.url));assert.equal(responses.length,3);assert.ok(responses.every((/** @type {any} */row)=>row.status===200));assert.equal(fixture.records.length,3);
    await unlink(file);await actions.click();await page.getByRole('button',{name:'Stop Auto-Download',exact:true}).click();await page.getByText('Download After Send is off.',{exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(errors,[]);
    await Bun.write(output+'/download-failure-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',automaticRefused:true,explicitRefused:true,originalBytesPreserved:[9,8,7],temporaryFilesAbsent:true,httpResponsesPreserved:3,retry:true,retryBytes:[0,255,13,10,42],autoError,explicitError,filesDeleted:true,requests:3},null,2));return;
   }
   await page.getByRole('button',{name:'Send',exact:true}).click();
   await poll(async()=>Bun.file(file).exists(),'Native automatic download file');
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   assert.deepEqual([...await Bun.file(file).bytes()],[0,255,13,10,42]);
   await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(explicit);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
   await actions.click();await page.getByRole('button',{name:'Send And Download',exact:true}).click();
   await poll(async()=>JSON.stringify([...await Bun.file(file).bytes()])===JSON.stringify([42,0,255,127,10,13]),'Native explicit download overwrites with latest response bytes');
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   assert.deepEqual([...await Bun.file(file).bytes()],[42,0,255,127,10,13]);await unlink(file);
   await actions.click();await page.getByRole('button',{name:'Stop Auto-Download',exact:true}).click();
   await page.getByText('Download After Send is off.',{exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
   await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(saveTarget);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
   await actions.click();let save=respondToOwnedSaveDialog(pid,output,null,'.bin');
   await page.getByRole('button',{name:'Send And Download',exact:true}).click();await save;
   await poll(async()=>actions.isEnabled(),'Cancelled native Save callback settled');
   const savedFile=join(output,'saved-response.bin');await actions.click();save=respondToOwnedSaveDialog(pid,output,savedFile,'.bin');
   await page.getByRole('button',{name:'Send And Download',exact:true}).click();await save;
   await poll(async()=>Bun.file(savedFile).exists(),'Explicit native Save file');await poll(async()=>actions.isEnabled(),'Native Save write settled');
   assert.deepEqual([...await Bun.file(savedFile).bytes()],[0,255,13,10,42]);await unlink(savedFile);
   const final=await invoke('load_workspace');assert.equal(final.history.filter((/** @type {any} */row)=>row.requestId===request._id&&[target,explicit,saveTarget].includes(row.url)&&row.status===200).length,4);assert.equal(fixture.records.length,4);assert.deepEqual(errors,[]);

   await Bun.write(output+'/download-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',cancelChooser:true,selectChooser:true,automatic:true,explicit:true,stopAutomatic:true,cancelSaveChooser:true,saveChooser:true,saveBytes:[0,255,13,10,42],automaticBytes:[0,255,13,10,42],explicitBytes:[42,0,255,127,10,13],overwrite:true,invocationResponseDistinct:true,filesDeleted:true,requests:4},null,2));return;
  }
  if(actionsOnly){
   assert.ok(fixture);
   const manual=fixture.target('schedule-manual','held'),scheduled=fixture.target('schedule-owned','held');
   const url=page.getByRole('textbox',{name:'Request URL',exact:true}),actions=page.getByRole('button',{name:'Request actions',exact:true});
   await url.fill(manual);await url.blur();await actions.click();
   await page.getByLabel('Delay or interval (seconds)',{exact:true}).fill('60');
   await page.getByRole('button',{name:'Repeat on Interval',exact:true}).click();
   await page.keyboard.press('Control+Enter');
   await poll(async()=>fixture.records.some(row=>row.token==='schedule-manual'&&row.bodyReadAt!==null),'Native manual send reaches held peer');
   const first=fixture.records.find(row=>row.token==='schedule-manual');assert.ok(first);
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   assert.equal(fixture.release('schedule-manual'),true,'Retiring schedule preserves independent held manual connection');
   await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.url===manual&&row.status===200),'Independent manual response persisted');
   assert.equal(first.cancelled,false);assert.ok(first.responseEndedAt!==null);
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   await url.fill(scheduled);await url.blur();await actions.click();
   await page.getByLabel('Delay or interval (seconds)',{exact:true}).fill('0.02');
   await page.getByRole('button',{name:'Repeat on Interval',exact:true}).click();
   await poll(async()=>fixture.records.some(row=>row.token==='schedule-owned'&&row.bodyReadAt!==null),'Native scheduled send reaches held peer');
   const second=fixture.records.find(row=>row.token==='schedule-owned');assert.ok(second);
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await poll(async()=>second.cancelled&&second.responseClosedAt!==null,'Native scheduled cancellation closes held response');
   assert.equal(fixture.release('schedule-owned'),false);
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   await Bun.sleep(80);assert.equal(fixture.records.length,2);assert.deepEqual(errors,[]);
   const final=await invoke('load_workspace');for(const old of original.history)assert.deepEqual(final.history.find((/** @type {any} */row)=>row._id===old._id),old);
   await page.screenshot({path:output+'/ownership.png'});
   await Bun.write(output+'/action-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',manualRunPreserved:true,scheduledRunCancelled:true,requests:fixture.records,originalHistoryPreserved:true},null,2));
   return;
  }
  const result=await exerciseNativeResponseHistory(page,output,()=>invoke('load_workspace'));assert.equal(result.rows.length,6);assert.deepEqual(errors,[]);await Bun.write(output+'/history-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',...result,originalResourcesPreserved:true,clipboardTouched:false},null,2));
  if(ownedCrud||manualFocus){assert.ok(fixture);await exerciseManualHttpWorkflow(context,fixture,saved._id,original);assert.deepEqual(errors,[]);}
 },nativeOptions);}catch(error){failures.push(error);}
 if(fixture){
  try{const retirement=await fixture.closeAfterHostExit();if(scenarioOutput)await Bun.write(scenarioOutput+'/manual-http-socket-retirement.json',JSON.stringify(retirement,null,2));}
  catch(error){if(scenarioOutput)await Bun.write(scenarioOutput+'/manual-http-socket-retirement-failure.json',JSON.stringify({passed:false,liveSockets:fixture.liveSockets,pending:fixture.pending,records:fixture.records,sockets:fixture.socketRecords,afterNativeAppSettlement:true,error:String(error)},null,2));failures.push(error);}
 }
 if(h2Server){try{await poll(async()=>h2Sessions.size===0,'HTTP/2 sessions retired after host exit',15000);await new Promise((resolve,reject)=>h2Server.close(error=>error?reject(error):resolve(null)));if(scenarioOutput)await Bun.write(scenarioOutput+'/http2-retirement.json',JSON.stringify({passed:true,openSessions:h2Sessions.size},null,2));}catch(error){h2Server.close();h2Server.unref();failures.push(error);}}
 if(h2TlsFixture){try{await h2TlsFixture.close();}catch(error){failures.push(error);}}
 if(failures.length)throw new AggregateError(failures,'Native history/manual HTTP and socket retirement failures retained');
},ownedCrud?{...nativeOptions,lazyCapture:true}:nativeOptions);

if(actionsOnly || downloadsOnly || multipartOnly || manualFocus || oauthOnly || http2Only || pickerDiagnostic) await preserveNativeProfile(runScenario,{responseDownloads:downloadsOnly}); else await runScenario();
