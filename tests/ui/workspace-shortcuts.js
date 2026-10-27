import assert from "node:assert/strict";
import {withPreview} from "./helpers/preview-app.js";
import {withNativeApp,poll} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {dirname,join} from 'node:path';
import {initialData,newRequest,id} from "../../src/lib/model.js";
import {addWideCollectionFixture} from './helpers/collection-actions-cases.js';

const nativeNavigation=process.env.INSOMNIUM_NAVIGATION_NATIVE==='1';
const shortcutData=initialData();
const shortcutRequest=shortcutData.resources.find(row=>row._id===shortcutData.activeRequestId);
assert.ok(shortcutRequest);
shortcutRequest.headers=[{name:'X-Escape',value:'quote\'"\\tail'},{name:'__proto__',value:'literal-header'}];
shortcutRequest.settingEncodeUrl=false;
let generatedFetchRequests=0;
/** Execute only owned cURL fixtures using the installed shell. @param {string} code @param {string} platform */
async function runGeneratedSnippet(code,platform){
  const command=platform==='windows'?['powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')]:[process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh','-s'];
  const child=Bun.spawn(command,{stdout:'pipe',stderr:'pipe',windowsHide:true,...(platform==='linux'?{stdin:Buffer.from(code+'\n')}:{})});
  const timer=setTimeout(()=>child.kill(),15000);
  try{
    const [stdout,stderr,exit]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
    assert.equal(exit,0,stderr);return JSON.parse(stdout.replace(/^\uFEFF/,''));
  }finally{clearTimeout(timer);}
}

if(!nativeNavigation&&!process.argv.includes('--websocket-only')) await withPreview("workspace-shortcuts",async (page,output) => {
  const url = page.getByRole("textbox",{name:"Request URL",exact:true});
  await url.waitFor();
  const originalUrl = await url.inputValue();
  await url.click();
  await url.press("End");
  await url.pressSequentially("0");
  await page.evaluate(async () => {
    const path = "/owned-editor-history.js";
    const { runEditorHistory } = await import(path);
    runEditorHistory("undo");
  });
  await page.waitForFunction((expected) => {
    const data = JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}");
    return data.resources?.find((/** @type {any} */ row) => row._id === data.activeRequestId)?.url === expected;
  }, originalUrl);
  assert.equal(await url.inputValue(), originalUrl);
  await page.evaluate(async () => {
    const path = "/owned-editor-history.js";
    const { runEditorHistory } = await import(path);
    runEditorHistory("redo");
  });
  assert.equal(await url.inputValue(), originalUrl + "0");
  await page.evaluate(async () => {
    const path = "/owned-editor-history.js";
    const { runEditorHistory } = await import(path);
    runEditorHistory("undo");
  });
  await page.keyboard.press("Control+Alt+Shift+Comma");
  assert.equal(await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Settings",exact:true}).getAttribute("aria-selected"),"true");
  assert.equal(await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Settings",exact:true}).evaluate((el) => document.activeElement === el),true);
  await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Body',exact:true}).click();
  await page.keyboard.press('Control+Alt+Shift+Comma');
  assert.equal(await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Settings',exact:true}).getAttribute('aria-selected'),'true');
  await page.keyboard.press('Control+Shift+Slash');
  const shortcutsTitle=page.getByRole('heading',{name:'Shortcuts',exact:true});await shortcutsTitle.waitFor();
  assert.equal(await shortcutsTitle.evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Close Preferences',exact:true}).click();
  await page.keyboard.press('Control+Alt+Shift+Comma');
  const skipBody = page.getByRole("checkbox",{name:"Skip rendering of request body",exact:true});
  assert.equal(await skipBody.isChecked(),false);
  await skipBody.check();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._type === "request" && r.settingDisableRenderRequestBody === true));
  await page.reload();
  await url.waitFor();
  await page.keyboard.press("Control+Alt+Shift+Comma");
  assert.equal(await skipBody.isChecked(),true);
  await skipBody.uncheck();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._type === "request" && r.settingDisableRenderRequestBody === false));
  await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Body",exact:true}).click();
  await page.keyboard.press("Control+l");
  assert.equal(await url.evaluate((el) => document.activeElement === el),true);
  assert.equal(await url.evaluate((el) => /** @type {HTMLInputElement} */ (el).selectionEnd), (await url.inputValue()).length);
  await page.keyboard.press("Control+Shift+f");
  assert.equal(await page.getByPlaceholder("Filter requests",{exact:true}).evaluate((el) => document.activeElement === el),true);
  await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Body',exact:true}).click();
  await page.getByRole('combobox',{name:'Body type',exact:true}).selectOption('application/json');
  const bodyEditor=page.locator('.shared-code-editor').filter({has:page.getByLabel('Request body',{exact:true})}).locator('.CodeMirror');
  await bodyEditor.evaluate(el=>{const cm=/** @type {any} */(el).CodeMirror;cm.setValue('{"large":9007199254740993}');cm.focus();});
  const history = await bodyEditor.evaluate(async (el) => {
    const path = "/owned-editor-history.js";
    const { runEditorHistory } = await import(path);
    const cm = /** @type {any} */ (el).CodeMirror;
    const before = cm.getValue();
    cm.clearHistory();
    cm.replaceRange(" ", cm.posFromIndex(before.length));
    cm.focus();
    runEditorHistory("undo");
    const undo = cm.getValue();
    runEditorHistory("redo");
    const redo = cm.getValue();
    cm.setOption("readOnly", true);
    runEditorHistory("undo");
    const readonly = cm.getValue();
    cm.setOption("readOnly", false);
    runEditorHistory("undo");
    return { before, undo, redo, readonly, final: cm.getValue() };
  });
  assert.equal(history.undo, history.before);
  assert.equal(history.redo, history.before + " ");
  assert.equal(history.readonly, history.redo);
  assert.equal(history.final, history.before);
  await page.keyboard.press('Control+Shift+f');
  assert.match(await bodyEditor.evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),/\n\s+"large": 9007199254740993\n/);
  assert.equal(await bodyEditor.evaluate(el=>/** @type {any} */(el).CodeMirror.hasFocus()),true);
  await url.fill('https://codegen.invalid/request?item=one&item=two');
  await bodyEditor.evaluate(el=>/** @type {any} */(el).CodeMirror.focus());
  await page.keyboard.press('Control+Shift+g');
  const generated=page.getByRole('dialog',{name:'Generate code',exact:true});await generated.waitFor();
  await generated.getByRole('button',{name:'Copy code',exact:true}).waitFor();
  await page.waitForFunction(()=>{const cm=/** @type {any} */(document.querySelector('dialog[open] .CodeMirror'))?.CodeMirror;return cm?.getValue().includes('9007199254740993');});
  const generatedCode=()=>generated.locator('.CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue());
  assert.match(await generatedCode(),/curl/);
  assert.ok((await generatedCode()).includes('item=one&item=two'));
  const platforms=generated.getByRole('combobox',{name:'cURL platform',exact:true});
  assert.deepEqual(await platforms.locator('option').evaluateAll(rows=>rows.map(row=>/** @type {HTMLOptionElement} */(row).value)),['linux','windows']);
  assert.equal(await generated.getByRole('combobox').count(),1);
  assert.equal(await generated.locator('.CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getOption('readOnly')),true);
  await page.keyboard.press('Escape');await generated.waitFor({state:'detached'});
  await page.getByRole('combobox',{name:'HTTP method',exact:true}).selectOption('POST');
  const curlUrl=new URL("/owned-code-generation/it's?item=one&item=two&literal=%24%28owned%29",page.url()).href;
  await url.fill(curlUrl);
  const body=await bodyEditor.evaluate(el=>/** @type {any} */(el).CodeMirror.getValue());
  const binary=Buffer.from([0,255,128,239,187,191,195,40,13,10,0,65]);
  const cases=[];
  for(const kind of ['text','binary','multipart']){
    if(kind==='binary'){
      await page.getByRole('combobox',{name:'Body type',exact:true}).selectOption('application/octet-stream');
      await page.locator('.binary-picker input[type="file"]').setInputFiles({name:'owned-codegen.bin',mimeType:'application/octet-stream',buffer:binary});
      await page.waitForFunction(expected=>{const data=JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}');return data.resources?.find((/** @type {any} */row)=>row._id===data.activeRequestId)?.body?.base64===expected;},binary.toString('base64'));
    }
    if(kind==='multipart'){
      await page.getByRole('combobox',{name:'Body type',exact:true}).selectOption('multipart/form-data');
      await page.getByRole('button',{name:'Add parameter',exact:true}).click();
      await page.getByRole('textbox',{name:'Parameter 1',exact:true}).fill('upload');
      await page.getByRole('combobox',{name:'Field type',exact:true}).first().selectOption('file');
      await page.getByLabel('File value 1',{exact:true}).setInputFiles({name:'owned-codegen.bin',mimeType:'application/octet-stream',buffer:binary});
    }
    await page.getByRole('button',{name:'Generate code',exact:true}).click();await generated.waitFor();
    for(const platform of process.platform==='win32'?['linux','windows']:['linux']){
      await platforms.selectOption(platform);
      await page.waitForFunction(platform=>{const code=/** @type {any} */(document.querySelector('dialog[open] .CodeMirror'))?.CodeMirror.getValue();return platform==='windows'?code?.includes('& curl.exe'):code?.includes('curl --disable');},platform);
      const before=generatedFetchRequests;
      const code=await generatedCode();
      assert.equal(generatedFetchRequests,before,'Generation must not dispatch the request');
      const wire=await runGeneratedSnippet(code,platform);
      assert.equal(wire.count,before+1);assert.equal(wire.url,curlUrl);
      assert.equal(wire.escape,'quote\'"\\tail');assert.equal(wire.proto,'literal-header');
      if(kind==='text')assert.equal(wire.body,body);
      else if(kind==='binary')assert.equal(wire.bodyBase64,binary.toString('base64'));
      else assert.deepEqual(wire.parts,[{name:'upload',fileName:'owned-codegen.bin',contentType:'application/octet-stream',bodyBase64:binary.toString('base64')}]);
      await Bun.write(output+'/curl-'+platform+'-'+kind+'.json',JSON.stringify(wire,null,2));cases.push({platform,kind});
    }
    await generated.getByRole('button',{name:'Regenerate',exact:true}).click();
    await generated.getByRole('button',{name:'Copy code',exact:true}).waitFor();
    await page.keyboard.press('Escape');await generated.waitFor({state:'detached'});
  }
  await page.getByRole('button',{name:'Generate code',exact:true}).click();await generated.waitFor();
  await page.waitForFunction(()=>/** @type {any} */(document.querySelector('dialog[open] .CodeMirror'))?.CodeMirror.getValue().includes('curl'));
  assert.equal(await platforms.inputValue(),process.platform==='win32'?'windows':'linux');
  await generated.screenshot({path:output+'/code-generation.png'});
  await page.keyboard.press('Escape');await generated.waitFor({state:'detached'});
  await Bun.write(output+'/curl-acceptance.json',JSON.stringify({passed:true,headless:true,cases,onlyTwoPlatforms:true,preferenceRestored:true},null,2));
  for (const [chord,label] of [["Control+Shift+e","Active environment"],["Meta+Shift+l","HTTP method"]]) {
    await page.keyboard.press(chord);
    assert.equal(await page.getByRole("combobox",{name:label,exact:true}).evaluate((el) => el === document.activeElement || el.contains(document.activeElement)),true,label);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("combobox",{name:label,exact:true}).evaluate((el) => document.activeElement === el),true,label + " restores focus");
  }
  await page.keyboard.press("Control+e");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.keyboard.press("Control+k");
  assert.equal(await dialog.getByRole("combobox",{name:"Environment to edit",exact:true}).count(),1);
  await page.keyboard.press("Escape");
  await dialog.waitFor({state:"detached"});
  await page.keyboard.press("Control+k");
  await dialog.waitFor();
  await dialog.getByText("Cookie management is available in the desktop app.",{exact:true}).waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({state:"detached"});
  await page.keyboard.press("Control+Comma");
  const close = page.getByRole("button",{name:"Close Preferences",exact:true});
  await close.waitFor();
  await close.click();
  await url.waitFor();
  const count = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length);
  await page.evaluate(async () => {
    for (const extra of [{repeat:true},{isComposing:true},{altKey:true,key:"x",code:"KeyX"}])
      window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",ctrlKey:true,bubbles:true,cancelable:true,...extra}));
    const event = new KeyboardEvent("keydown",{key:"n",ctrlKey:true,bubbles:true,cancelable:true});
    event.preventDefault();window.dispatchEvent(event);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length),count);
  await page.keyboard.press("Control+Alt+n");
  await page.waitForFunction((count) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length === count + 1,count);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  await page.keyboard.press("Control+d");
  await page.waitForFunction((count) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length === count + 2,count);
  const copied = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  assert.notEqual(copied.activeRequestId,original.activeRequestId);
  assert.deepEqual(copied.resources.find((/** @type {any} */ r) => r._id === copied.activeRequestId).body,original.resources.find((/** @type {any} */ r) => r._id === original.activeRequestId).body);
  await page.getByRole('button',{name:'Search requests',exact:true}).click();
  const switchSearch=page.getByRole('textbox',{name:'Search requests',exact:true});
  const switchChoices=page.getByRole('listbox',{name:'Matching requests',exact:true});
  await switchSearch.waitFor();
  assert.equal(await switchSearch.evaluate(el=>el===document.activeElement),true);
  await switchSearch.fill('owned-no-matching-request');
  assert.equal(await switchChoices.locator('option').count(),0);
  await switchSearch.fill('');
  await switchChoices.selectOption(original.activeRequestId);
  await page.keyboard.press('Enter');
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').activeRequestId===id,original.activeRequestId);
  await page.keyboard.down('Control');
  await page.keyboard.press('Tab');
  await page.getByRole('dialog',{name:'Recent requests',exact:true}).waitFor();
  assert.equal(await switchChoices.inputValue(),copied.activeRequestId);
  await page.keyboard.up('Control');
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').activeRequestId===id,copied.activeRequestId);
  await page.keyboard.down('Control');await page.keyboard.press('Shift+Tab');
  await page.getByRole('dialog',{name:'Recent requests',exact:true}).waitFor();
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await page.keyboard.up('Control');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').activeRequestId),copied.activeRequestId);
  await page.keyboard.press("Control+Shift+Delete");
  await dialog.waitFor();
  await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._id === id),copied.activeRequestId),true);
  await page.keyboard.press("Meta+Shift+Delete");
  await dialog.getByRole("button",{name:"Delete request",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  await page.waitForFunction((id) => !JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._id === id),copied.activeRequestId);
  await page.keyboard.press("Meta+Shift+n");
  await dialog.getByRole("textbox",{name:"Name",exact:true}).fill("Owned shortcut folder");
  await dialog.getByRole("button",{name:"Create",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._type === "request_group" && r.name === "Owned shortcut folder"));
  await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,shortcuts:5,modalGuard:true,repeatCompositionAltConsumedGuards:true,focusedHistoryDispatch:true,plainInputHistory:true,readOnlyHistoryGuard:true,generatedCurlWire:true,scope:"Actual built-app keyboard/focus/dialogs/history and generated cURL to an owned loopback peer; no native menu/provider"},null,2));
},{fetch:async (request) => {
  if(new URL(request.url).pathname.startsWith('/owned-code-generation/')){
    const parts=[];
    if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
      for(const [name,value] of await request.clone().formData())parts.push(typeof value==='string'?{name,value}:{name,fileName:value.name,contentType:value.type,bodyBase64:Buffer.from(await value.arrayBuffer()).toString('base64')});
    }
    const bytes=Buffer.from(await request.arrayBuffer());
    return Response.json({count:++generatedFetchRequests,url:request.url,parts,body:new TextDecoder().decode(bytes),bodyBase64:bytes.toString('base64'),size:bytes.length,ownedHeader:request.headers.get('x-owned'),requestedWith:request.headers.get('x-requested-with'),contentType:request.headers.get('content-type'),escape:request.headers.get('x-escape'),proto:request.headers.get('__proto__')});
  }
  if (new URL(request.url).pathname === "/owned-editor-history.js")
    return new Response(await Bun.file("src/lib/editor-history.js").text(), {headers:{"Content-Type":"text/javascript"}});
},beforeNavigate:async (page) => {
  await page.addInitScript((data) => {
    localStorage.setItem("insomnium:generate-code",JSON.stringify({target:"removed-language",client:"native"}));
    if (!localStorage.getItem("insomnium-tauri-preview-v1"))
      localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data));
  },shortcutData);
}});

const websocketData = initialData();
const websocket = websocketData.resources.find((r) => r._id === websocketData.activeRequestId);
assert.ok(websocket);
Object.assign(websocket,{_type:"websocket_request",url:"ws://owned.invalid",activePayloadId:"wsp_shortcut"});
websocketData.resources.push({_id:"wsp_shortcut",_type:"websocket_payload",parentId:websocket._id,name:"Owned invalid JSON",mode:"application/json",value:"{"});
websocketData.resources.push({_id:"wsp_shortcut_other",_type:"websocket_payload",parentId:websocket._id,name:"Owned other payload",mode:"text/plain",value:"Other message"});
if(!nativeNavigation) await withPreview("websocket-message-shortcut",async (page,output) => {
  await page.getByRole("textbox",{name:"Request URL",exact:true}).waitFor();
  await page.keyboard.press("Control+Shift+Enter");
  await page.keyboard.press("Control+Enter");
  await page.getByRole("alert").filter({hasText:/JSON|Expected|Unexpected/i}).first().waitFor();
  assert.equal(await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Message",exact:true}).getAttribute("aria-selected"),"true");
  const alert = page.locator("#request-editor-panel").getByRole("alert").filter({hasText:/JSON|Expected|Unexpected/i}).first();
  const firstError = await alert.textContent();
  const editor = page.locator(".shared-code-editor").filter({has:page.getByLabel("WebSocket message",{exact:true})}).locator(".CodeMirror");
  await editor.evaluate((el) => {const cm=/** @type {any} */ (el).CodeMirror;cm.setValue('{"x":}');cm.focus();});
  await page.keyboard.press("Meta+Enter");
  await page.waitForFunction((before) => [...document.querySelectorAll('[role="alert"]')].some((el) => /JSON|Expected|Unexpected/i.test(el.textContent || "") && el.textContent !== before),firstError);
  await page.getByLabel("Saved WebSocket payload",{exact:true}).selectOption("wsp_shortcut_other");
  await alert.waitFor({state:"detached"});
  await page.getByLabel("Saved WebSocket payload",{exact:true}).selectOption("wsp_shortcut");
  assert.equal(await alert.count(),0);
  await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,selectedPayloadValidated:true,opensMessageTab:true,scope:"Actual shortcut dispatch and invalid JSON refusal before connection; no native/wire"},null,2));
},{beforeNavigate:async (page) => {
  await page.addInitScript((data) => localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data)),websocketData);
}});

if(nativeNavigation){
 assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Audited native candidate required');
 await preserveNativeProfile(async({workspacePath})=>{
  let peerRequests=0;
  const peer=Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>{peerRequests++;return new Response('Unexpected navigation request',{status:500});}});
  try{
   const data=initialData(),foreign=initialData(),a=data.activeWorkspaceId,b=foreign.activeWorkspaceId,alpha=data.activeRequestId,other=foreign.activeRequestId,folder=id('fld');
   const wide=addWideCollectionFixture(foreign);
   const alphaRow=data.resources.find(row=>row._id===alpha),otherRow=foreign.resources.find(row=>row._id===other);assert.ok(alphaRow&&otherRow);
   alphaRow.name='Alpha ไทย';alphaRow.parentId=folder;otherRow.name='Foreign ค้น';
   const beta=newRequest(a,{name:'Beta root'}),socket=newRequest(a,{_type:'websocket_request',name:'Socket pinned'}),rpc=newRequest(folder,{_type:'grpc_request',name:'RPC pinned',metadata:[],protoFileId:'',protoMethodName:'',body:{text:'{}'},grpcJsonMode:'legacy'});
   data.resources.push(...foreign.resources,{_id:folder,_type:'request_group',parentId:a,name:'Navigation folder'},beta,socket,rpc,
    {_id:id('wrkm'),_type:'workspace_meta',parentId:a,activeRequestId:alpha,sidebarFilter:'',navigationCustom:'workspace'},
    {_id:id('wrkm'),_type:'workspace_meta',parentId:b,activeRequestId:other,sidebarFilter:'Foreign ค้น'},
    {_id:id('fldm'),_type:'request_group_meta',parentId:folder,collapsed:true,navigationCustom:'folder'},
    ...[alpha,socket._id,rpc._id,other].map(parentId=>({_id:id('meta'),_type:parentId===rpc._id?'grpc_request_meta':'request_meta',parentId,pinned:parentId!==alpha,navigationCustom:parentId,responseFilter:'$.owned'})));
   for(const row of data.resources)if(['request','websocket_request','grpc_request'].includes(row._type))row.url=(row._type==='websocket_request'?'ws:':'http:')+'//127.0.0.1:'+peer.port+'/never-send';
   data.openTabs=[alpha,beta._id,alpha,folder,other,'req_owned_missing_tab',beta._id];
   await Bun.write(workspacePath,JSON.stringify(data));await Bun.write(join(dirname(workspacePath),'workspace-v1.previous.json'),JSON.stringify(data));
   await withNativeApp('collection-navigation',async({page,invoke,output})=>{
    const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
    const load=()=>invoke('load_workspace'),meta=(/** @type {any} */ value,/** @type {string} */ type,/** @type {string} */ parent)=>value.resources.find((/** @type {any} */ row)=>row._type===type&&row.parentId===parent);
    const sidebar=page.getByRole('complementary',{name:'Collections',exact:true}),filter=sidebar.getByRole('textbox',{name:'Filter requests',exact:true}),collection=page.getByRole('combobox',{name:'Collection',exact:true}),folderButton=sidebar.getByRole('button',{name:'Navigation folder',exact:true}),pins=sidebar.getByRole('region',{name:'Pinned requests',exact:true});
    const requestRow=(/** @type {string} */ name)=>sidebar.locator('.tree-request-row').filter({hasText:name}).first().locator('.tree-request');
    const select=async(/** @type {string} */ name,/** @type {string} */ requestId)=>{await requestRow(name).click();await poll(async()=>(await load()).activeRequestId===requestId,'Native request selection persisted');};
    const togglePin=async(/** @type {string} */ requestId,/** @type {boolean} */ pinned)=>{await page.keyboard.press('Control+Shift+p');await poll(async()=>meta(await load(),requestId===rpc._id?'grpc_request_meta':'request_meta',requestId)?.pinned===pinned,'Native keyboard pin persisted');};
    await filter.waitFor();await folderButton.waitFor();assert.equal(await folderButton.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('.request-tabs .request-tab').count(),2,'Restored native tabs are unique requests');
    assert.match(await pins.innerText(),/Socket pinned/);assert.match(await pins.innerText(),/RPC pinned/);assert.doesNotMatch(await pins.innerText(),/Foreign ค้น/);
    await togglePin(alpha,true);assert.match(await pins.innerText(),/Alpha ไทย/);
    assert.deepEqual((await load()).openTabs,[alpha,beta._id,other],'Native save retains foreign tabs and removes duplicate/non-request/missing IDs');
    await filter.fill('Alpha ไทย');await poll(async()=>meta(await load(),'workspace_meta',a)?.sidebarFilter==='Alpha ไทย','Unicode filter saved');
    assert.equal(await folderButton.getAttribute('aria-expanded'),'true');assert.equal(meta(await load(),'request_group_meta',folder).collapsed,true);
    await filter.fill('');await poll(async()=>meta(await load(),'workspace_meta',a)?.sidebarFilter==='','Filter cleared');assert.equal(await folderButton.getAttribute('aria-expanded'),'false');
    await select('Beta root',beta._id);await folderButton.click();await poll(async()=>meta(await load(),'request_group_meta',folder).collapsed===false,'Folder expansion saved');
    await select('Alpha ไทย',alpha);await page.getByRole('button',{name:'Close Alpha ไทย',exact:true}).click();await poll(async()=>(await load()).activeRequestId===beta._id,'Closing active tab selects remaining request');
    assert.equal(meta(await load(),'workspace_meta',a).activeRequestId,beta._id);
    await filter.fill('Alpha ไทย');await folderButton.click();await poll(async()=>meta(await load(),'request_group_meta',folder).collapsed===true,'Stored collapse preserved beneath search');
    await collection.selectOption(b);await poll(async()=>(await load()).activeRequestId===other,'Foreign collection selection restored');assert.equal(await filter.inputValue(),'Foreign ค้น');assert.match(await pins.innerText(),/Foreign ค้น/);assert.doesNotMatch(await pins.innerText(),/Alpha ไทย|Socket pinned|RPC pinned/);
    await collection.selectOption(a);await poll(async()=>(await load()).activeRequestId===beta._id,'Collection remembers tab fallback');assert.equal(await filter.inputValue(),'Alpha ไทย');assert.equal(await folderButton.getAttribute('aria-expanded'),'true');
    await filter.fill('');await select('Socket pinned',socket._id);await togglePin(socket._id,false);assert.doesNotMatch(await pins.innerText(),/Socket pinned/);
    await select('RPC pinned',rpc._id);await togglePin(rpc._id,false);assert.doesNotMatch(await pins.innerText(),/RPC pinned/);
    await select('Alpha ไทย',alpha);await togglePin(alpha,false);await pins.waitFor({state:'detached'});
    await select('Beta root',beta._id);await filter.fill('Alpha ไทย');await poll(async()=>meta(await load(),'workspace_meta',a).sidebarFilter==='Alpha ไทย','Final filter persisted');
    await page.reload();await folderButton.waitFor();assert.equal(await collection.inputValue(),a);assert.equal(await filter.inputValue(),'Alpha ไทย');assert.equal(await folderButton.getAttribute('aria-expanded'),'true');
    const reloaded=await load();assert.equal(reloaded.activeRequestId,beta._id);assert.equal(meta(reloaded,'workspace_meta',a).activeRequestId,beta._id);assert.equal(meta(reloaded,'workspace_meta',b).activeRequestId,other);assert.equal(meta(reloaded,'workspace_meta',b).sidebarFilter,'Foreign ค้น');
    for(const requestId of [alpha,socket._id,rpc._id]){const value=meta(reloaded,requestId===rpc._id?'grpc_request_meta':'request_meta',requestId);assert.equal(value.pinned,false);assert.equal(value.navigationCustom,requestId);assert.equal(value.responseFilter,'$.owned');}
    assert.equal(meta(reloaded,'request_meta',other).pinned,true);assert.equal(meta(reloaded,'workspace_meta',a).navigationCustom,'workspace');assert.equal(meta(reloaded,'request_group_meta',folder).navigationCustom,'folder');assert.equal(meta(reloaded,'request_group_meta',folder).collapsed,true);
    await filter.fill('');await poll(async()=>meta(await load(),'workspace_meta',a).sidebarFilter==='','Final clear saved');assert.equal(await folderButton.getAttribute('aria-expanded'),'false');
    assert.equal(await pins.count(),0);assert.equal(peerRequests,0);assert.deepEqual((await load()).history,[]);assert.deepEqual(errors,[]);
    const wideIds=new Set(wide.requests.map(row=>row._id));
    assert.deepEqual(reloaded.resources.filter((/** @type {any} */row)=>wideIds.has(row._id)),wide.requests,'All background requests remain exact');
    await Bun.write(output+'/wide-collection.json',JSON.stringify({passed:true,requests:wide.requests.length,resourcesUnchanged:true,selectionFilterPinsReload:true,peerRequests},null,2));
    await Bun.write(output+'/acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',flows:['HTTP/WS/gRPC pin and unpin through keyboard with imported metadata retained','nested collapsed folder temporarily revealed by Unicode search without changing stored collapse','folder expansion/collapse persisted','active-tab close fallback remembered per collection','independent collection filters and foreign pins excluded','renderer reload retains selection/filter/pin/collapse/custom metadata'],peerRequests,historyEntries:0,limits:'Named Windows navigation and renderer reload; not physical keyboard/AT, OS restart/close, complete CRUD/import/export/provider/platform parity'},null,2));
   });
   await withNativeApp('collection-navigation-reopen',async({page,invoke,output})=>{
    const sidebar=page.getByRole('complementary',{name:'Collections',exact:true}),folderButton=sidebar.getByRole('button',{name:'Navigation folder',exact:true}),collection=page.getByRole('combobox',{name:'Collection',exact:true}),filter=sidebar.getByRole('textbox',{name:'Filter requests',exact:true});
    await folderButton.waitFor();assert.equal(await collection.inputValue(),a);assert.equal(await filter.inputValue(),'');assert.equal(await folderButton.getAttribute('aria-expanded'),'false');
    const loaded=await invoke('load_workspace');assert.equal(loaded.activeRequestId,beta._id);
    for(const requestId of [alpha,socket._id,rpc._id])assert.equal(loaded.resources.find((/** @type {any} */ row)=>row.parentId===requestId&&['request_meta','grpc_request_meta'].includes(row._type)).pinned,false);
    assert.equal(await sidebar.getByRole('region',{name:'Pinned requests',exact:true}).count(),0);
    await collection.selectOption(b);await poll(async()=>(await invoke('load_workspace')).activeRequestId===other,'Reopened foreign selection');assert.equal(await filter.inputValue(),'Foreign ค้น');assert.match(await sidebar.getByRole('region',{name:'Pinned requests',exact:true}).innerText(),/Foreign ค้น/);
    await collection.selectOption(a);await poll(async()=>(await invoke('load_workspace')).activeRequestId===beta._id,'Reopened collection selection');assert.equal(await filter.inputValue(),'');assert.equal(await folderButton.getAttribute('aria-expanded'),'false');
    assert.equal(peerRequests,0);assert.deepEqual((await invoke('load_workspace')).history,[]);
    await Bun.write(output+'/acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',relaunched:true,selectionRetained:true,collectionFiltersIsolated:true,pinsRetained:true,collapseRetained:true,peerRequests,historyEntries:0,limits:'Actual new host after explicit destroy cleanup; not WM_CLOSE/OS restart/provider/platform acceptance'},null,2));
   });
  }finally{peer.stop(true);}
 });
}
