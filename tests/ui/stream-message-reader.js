import assert from "node:assert/strict";
import {initialData} from "../../src/lib/model.js";
import {withPreview} from "./helpers/preview-app.js";

const message = "Owned stream Ω\n".repeat(5000);
const rawJson='{"number":9007199254740993, "escape":"\\u03a9"}';
const formattedJson='{\n  "number": 9007199254740993,\n  "escape": "Ω"\n}';
const binaryJson='{"unicode":"ไทย","number":9007199254740993}';
const binaryBase64=Buffer.from(binaryJson).toString('base64');
const expandingJson='['+'0,'.repeat(19999)+'0]';
for (const protocol of ["sse","websocket"]) {
  const data = initialData();
  const request = data.resources.find((r) => r._id === data.activeRequestId);
  assert.ok(request);
  Object.assign(request,protocol === "sse" ? {responseMode:"sse"} : {_type:"websocket_request"});
  data.history = [{_id:"res_reader",requestId:request._id,protocol,created:1700000000000,connectionState:"closed",events:[{_id:"event_reader",kind:protocol === "sse" ? "sse" : "message",format:"text",data:message,created:1700000000000}]}];
  data.history[0].events.unshift({_id:'event_json',kind:protocol==='sse'?'sse':'message',format:'text',data:rawJson,created:1699999999000});
  if(protocol==='websocket')data.history[0].events.unshift({_id:'event_binary',kind:'message',format:'binary',data:binaryBase64,created:1699999998000});
  if(protocol==='websocket')data.history[0].events.unshift({_id:'event_expansion',kind:'message',format:'text',data:expandingJson,created:1699999997000});
  data.history[0].events.unshift(
    {_id:'event_open',kind:'open',url:'https://stream.example.test',created:1699999995000},
    {_id:'event_close',kind:'closed',reason:'Policy violation',created:1699999996000},
  );
  Object.assign(data.history[0],{settingSendCookies:false,settingStoreCookies:false,headers:[
    ['sEt-CoOkIe','session=first==; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT; HttpOnly'],
    ['set-cookie','session=second; Path=/other; Secure'],
    ['SET-COOKIE','malformed cookie'],
    ['x-not-a-cookie','leave out'],
  ]});
  await withPreview("stream-message-reader-" + protocol,async (page,output) => {
    await page.getByRole("button",{name:"Open complete stream event",exact:true}).click();
    const dialog = page.getByRole("dialog",{name:"Complete stream event",exact:true});
    const editor = dialog.locator(".CodeMirror");
    await editor.waitFor();
    assert.equal(await editor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),message);
    await editor.locator("textarea").focus();
    await page.keyboard.type("must not modify");
    assert.equal(await editor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),message);
    await page.keyboard.press("Control+End");
    assert.equal(await editor.evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      return cm.indexFromPos(cm.getCursor());
    }),message.length);
    await page.keyboard.press("Escape");
    await dialog.waitFor({state:"detached"});
    await page.locator('.stream-event').filter({hasText:'escape'}).click();
    const mode=page.getByRole('combobox',{name:'Stream event display',exact:true});
    assert.equal(await mode.inputValue(),'friendly');
    assert.equal(await page.locator('.stream-event-body').textContent(),formattedJson);
    await mode.selectOption('raw');
    await page.waitForFunction(raw=>document.querySelector('.stream-event-body')?.textContent===raw,rawJson);
    await page.waitForFunction(requestId=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources
      .some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===requestId&&r.previewMode==='raw'),request._id);
    await page.reload();
    await page.locator('.stream-event').filter({hasText:'escape'}).click();
    assert.equal(await mode.inputValue(),'raw');
    assert.equal(await page.locator('.stream-event-body').textContent(),rawJson);
    await mode.selectOption('source');
    const source=page.locator('.stream-event-source .CodeMirror');
    await source.waitFor();
    assert.equal(await source.evaluate(element=>/** @type {any} */(element).CodeMirror.getValue()),rawJson);
    assert.equal(await source.evaluate(element=>!!/** @type {any} */(element).CodeMirror.getOption('readOnly')),true);
    await page.waitForFunction(requestId=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources
      .some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===requestId&&r.previewMode==='source'),request._id);
    await page.reload();
    await page.locator('.stream-event').filter({hasText:'escape'}).click();
    assert.equal(await mode.inputValue(),'source');
    await source.waitFor();
    assert.equal(await source.evaluate(element=>/** @type {any} */(element).CodeMirror.getValue()),rawJson);
    await mode.selectOption('friendly');
    await page.waitForFunction(expected=>document.querySelector('.stream-event-body')?.textContent===expected,formattedJson);
    if(protocol==='websocket'){
      await page.locator('.stream-event').filter({hasText:expandingJson.slice(0,100)}).click();
      await page.getByRole('button',{name:'Open complete stream event',exact:true}).waitFor();
      const displayed=await page.locator('.stream-event-body').textContent();
      assert.ok(displayed!==null);assert.ok(displayed.length<=64*1024);
      await page.locator('.stream-event').filter({hasText:binaryBase64}).click();
      const encoding=page.getByRole('combobox',{name:'Binary event encoding',exact:true});
      assert.equal(await encoding.inputValue(),'base64');
      assert.equal(await page.locator('.stream-event-body').textContent(),binaryBase64);
      const search=page.getByRole('textbox',{name:'Filter stream events',exact:true});
      await search.fill('ไทย');
      await page.waitForFunction(()=>document.querySelectorAll('.stream-event').length===1);
      assert.equal(await page.locator('.stream-event').count(),1);
      assert.ok((await page.locator('.stream-event').textContent())?.includes(binaryBase64));
      await search.fill('no matching stream event');
      await page.waitForFunction(()=>document.querySelectorAll('.stream-event').length===0);
      assert.equal(await page.locator('.stream-event').count(),0);
      await search.fill('');
      await page.locator('.stream-event').filter({hasText:binaryBase64}).waitFor();
      await mode.selectOption('raw');await encoding.selectOption('utf8');
      await page.waitForFunction(expected=>document.querySelector('.stream-event-body')?.textContent===expected,binaryJson);
      await page.getByRole('button',{name:'Copy stream event',exact:true}).click();
      assert.equal(await page.evaluate(()=>/** @type {any} */(window).__streamCopied),binaryJson);
      await page.waitForFunction(requestId=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources
        .some((/** @type {any} */r)=>r._type==='request_meta'&&r.parentId===requestId&&r.streamBinaryEncoding==='utf8'),request._id);
      await page.reload();
      await page.locator('.stream-event').filter({hasText:binaryBase64}).click();
      assert.equal(await encoding.inputValue(),'utf8');
      assert.equal(await page.locator('.stream-event-body').textContent(),binaryJson);
    }
    const type=page.getByRole('combobox',{name:'Stream event type',exact:true});
    await type.selectOption('message');
    const messageCount=data.history[0].events.filter((/** @type {Record<string,any>} */event)=>['message','sse','sent'].includes(event.kind)).length;
    await page.waitForFunction(count=>document.querySelectorAll('.stream-event').length===count,messageCount);
    await type.selectOption('open');
    await page.locator('.stream-event').filter({hasText:'https://stream.example.test'}).waitFor();
    assert.equal(await page.locator('.stream-event').count(),1);
    await type.selectOption('closed');
    const search=page.getByRole('textbox',{name:'Filter stream events',exact:true});
    await search.fill('POLICY');
    await page.locator('.stream-event').filter({hasText:'Policy violation'}).waitFor();
    assert.equal(await page.locator('.stream-event').count(),1);
    await page.getByRole('button',{name:'Clear view',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.stream-event').length===0);
    assert.equal(await page.getByRole('button',{name:'Copy stream event',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Save stream event',exact:true}).isDisabled(),true);
    await type.selectOption('');await search.fill('');
    assert.equal(await page.locator('.stream-event').count(),0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").history),data.history);
    await page.reload();
    await page.waitForFunction(count=>document.querySelectorAll('.stream-event').length===count,data.history[0].events.length);
    assert.equal(await page.getByRole('button',{name:'Copy stream event',exact:true}).isDisabled(),false);
    await page.getByRole('tab',{name:'Cookies',exact:true}).click();
    const cookieTable=page.getByRole('table',{name:'Response cookies',exact:true});
    await cookieTable.waitFor();
    assert.equal(await cookieTable.getByRole('row').count(),4);
    assert.equal(await cookieTable.getByRole('cell',{name:'session',exact:true}).count(),2);
    assert.equal(await cookieTable.getByRole('cell',{name:'(invalid cookie)',exact:true}).count(),1);
    assert.ok((await cookieTable.textContent())?.includes('first=='));
    assert.ok(!(await cookieTable.textContent())?.includes('leave out'));
    await cookieTable.locator('summary').first().click();
    assert.equal(await cookieTable.locator('details code').first().textContent(),data.history[0].headers[0][1]);
    await page.getByRole('status').filter({hasText:'Automatic sending and storing of cookies was disabled'}).waitFor();
    await page.getByRole('button',{name:'Manage cookies',exact:true}).click();
    const cookiesDialog=page.getByRole('dialog',{name:'Cookies',exact:true});
    await cookiesDialog.waitFor();
    await page.keyboard.press('Escape');await cookiesDialog.waitFor({state:'detached'});
    await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,protocol,completeText:true,readOnly:true,tailNavigation:true,escape:true,historyUnchanged:true,rawAndFormatted:true,sourceReadOnly:true,sourceReload:true,losslessNumbersAndEscapes:true,previewModeReload:true,binaryUtf8DisplayCopyReload:protocol==='websocket',scope:"Actual built-app saved history/shared editor; controlled browser clipboard boundary, no system clipboard/native/network"},null,2));
  },{beforeNavigate:async (page) => {
    await page.addInitScript((data) => {
      const key='insomnium-tauri-preview-v1';
      if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(/** @type {string} */text)=>{
        /** @type {any} */(window).__streamCopied=text;
      }}});
    },data);
  }});
}
