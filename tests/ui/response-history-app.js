import assert from 'node:assert/strict';
import {initialData} from '../../src/lib/model.js';
import {withPreview} from './helpers/preview-app.js';

const data=initialData();
const legacyIdsOnly=process.env.INSOMNIUM_RESPONSE_LEGACY_IDS_ONLY==='1';
const charsetOnly=process.env.INSOMNIUM_RESPONSE_CHARSET_ONLY==='1';
const charsetBytes=Buffer.from([65,0,0,0,66,0,0,0]);
let charsetRequests=0;
if(charsetOnly){const request=data.resources.find(resource=>resource._id===data.activeRequestId);if(!request)throw Error('Missing charset request');request.name='Owned Response';}
const htmlOnly=process.env.INSOMNIUM_RESPONSE_HTML_ONLY==='1';
const imageOnly=process.env.INSOMNIUM_RESPONSE_IMAGE_ONLY==='1';
const audioOnly=process.env.INSOMNIUM_RESPONSE_AUDIO_ONLY==='1';
const csvOnly=process.env.INSOMNIUM_RESPONSE_CSV_ONLY==='1';
const multipartOnly=process.env.INSOMNIUM_RESPONSE_MULTIPART_ONLY==='1';
const multipartJson='{"message":"ไทย","id":9007199254740993}';
const metadataPoints=Array.from(multipartJson),metadataBytes=Buffer.alloc(metadataPoints.length*4);
metadataPoints.forEach((char,index)=>metadataBytes.writeUInt32LE(char.codePointAt(0)||0,index*4));
const multipartBytes=Buffer.concat([Buffer.from('preamble\r\n--owned+parts\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json; charset=utf-32le\r\nContent-Transfer-Encoding: 8bit\r\nX-Owned: first\r\n\r\n'),metadataBytes,Buffer.from('\r\n--owned+parts\r\nContent-Disposition: attachment; name="binary"; filename="owned.bin"\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: BASE64\r\n\r\n'),Buffer.from('AP8N\r\nCio='),Buffer.from('\r\n--owned+parts--\r\nepilogue')]);
const pdfOnly=process.env.INSOMNIUM_RESPONSE_PDF_ONLY==='1';
function ownedPdf(){
 const first='BT /F1 18 Tf 30 120 Td (Owned PDF page one) Tj ET\n0 0 1 rg 20 20 20 20 re f\n';
 const second='BT /F1 18 Tf 30 120 Td (Owned PDF page two) Tj ET\n1 0 0 rg 20 20 20 20 re f\n';
 const objects=['<< /Type /Catalog /Pages 2 0 R /OpenAction 8 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
 `<< /Length ${first.length} >>\nstream\n${first}endstream`,
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
 `<< /Length ${second.length} >>\nstream\n${second}endstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 '<< /Type /Action /S /JavaScript /JS (globalThis.__ownedPdfAction = true) >>'];
 let text='%PDF-1.4\n';const offsets=[0];for(const [index,value] of objects.entries()){offsets.push(text.length);text+=`${index+1} 0 obj\n${value}\nendobj\n`;}
 const xref=text.length;text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');
 return Buffer.from(text+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`).toString('base64');
}
const pdfBase64=pdfOnly?ownedPdf():'';
const csvBody='\ufeffname,note,id\r\n"A, ไทย","line1\r\nline2","0007"\r\nliteral,"<img src=x onerror=alert(1)>",9007199254740993\r\n\r\n'+Array.from({length:205},(_,index)=>`row-${index},value-${index},${index}`).join('\r\n');
const visualOnly=htmlOnly||imageOnly||audioOnly;
const audioBytes=new Uint8Array(204);
if(audioOnly){const view=new DataView(audioBytes.buffer);for(const [offset,text] of /** @type {[number,string][]} */([[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']]))audioBytes.set(new TextEncoder().encode(text),offset);view.setUint32(4,196,true);view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);view.setUint32(40,160,true);}
const audioBase64=Buffer.from(audioBytes).toString('base64');
const imageBytes=imageOnly?new Uint8Array(await Bun.file('static/app-icon.png').arrayBuffer()):new Uint8Array();
const imageBase64=Buffer.from(imageBytes).toString('base64');
const htmlBody='<!doctype html><html><head><style>#owned-html-mark {color:rgb(12,34,56)}</style><meta http-equiv="refresh" content="0;url=https://owned-preview.invalid/blocked-navigation"></head><body><h1 id="owned-html-mark">HTML preview ไทย</h1><p id="owned-script-state">not executed</p><script>document.querySelector("#owned-script-state").textContent="executed"</script><img src="https://owned-preview.invalid/blocked-image"><iframe src="https://owned-preview.invalid/blocked-frame"></iframe></body></html>';
const errors=/** @type {string[]} */([]);
data.history=[200,404,503].map((status,index)=>({_id:'res_owned_history_'+index,_type:'response',requestId:data.activeRequestId,created:1720000030000-index*10000,status,statusText:'Owned '+status,elapsedMs:10,size:20,headers:[['Content-Type','text/plain']],body:'Owned history body '+status}));
if(legacyIdsOnly){delete data.history[0]._id;delete data.history[1]._id;}
const visualBody=audioOnly?'Owned audio text representation':imageOnly?'Owned image text representation':htmlBody;
if(visualOnly){data.history=data.history.slice(0,1).map(entry=>({...entry,headers:[['Content-Type',audioOnly?'audio/wav':imageOnly?'image/png':'text/plain; charset=utf-8']],body:visualBody,bodyBase64:audioOnly?audioBase64:imageOnly?imageBase64:Buffer.from(htmlBody).toString('base64')}));data.resources.push({_id:'reqm_html',_type:'request_meta',parentId:data.activeRequestId,previewMode:'source'});}
if(csvOnly)data.history=data.history.slice(0,1).map(entry=>({...entry,headers:[['Content-Type','text/csv; charset=utf-8']],body:csvBody,bodyBase64:Buffer.from(csvBody).toString('base64')}));
if(pdfOnly)data.history=data.history.slice(0,1).map(entry=>({...entry,headers:[['Content-Type','application/pdf'],['Content-Disposition',"attachment; filename=report.pdf; filename*=UTF-8''%E0%B9%84%E0%B8%97%E0%B8%A2.pdf"]],body:'Owned PDF text representation',bodyBase64:pdfBase64}));
if(multipartOnly)data.history=data.history.slice(0,1).map(entry=>({...entry,headers:[['Content-Type','multipart/mixed; boundary="owned+parts"']],body:multipartBytes.toString('utf8'),bodyBase64:multipartBytes.toString('base64')}));
if(charsetOnly)data.history=data.history.slice(0,1).map(entry=>({...entry,headers:[['Content-Type','text/plain; charset=utf-32le']],body:'A\u0000\u0000\u0000B\u0000\u0000\u0000',bodyBase64:charsetBytes.toString('base64')}));
await withPreview(legacyIdsOnly?'response-legacy-ids':charsetOnly?'response-charset-preview':multipartOnly?'response-multipart-preview':pdfOnly?'response-pdf-preview':csvOnly?'response-csv-preview':audioOnly?'response-audio-preview':imageOnly?'response-image-preview':htmlOnly?'response-html-preview':'response-history-app',async(page,output)=>{
 if(legacyIdsOnly){
  const trigger=page.getByRole('button',{name:'Response history',exact:true});
  await trigger.waitFor();await trigger.click();
  const list=page.getByRole('listbox',{name:'Response history',exact:true});
  await list.waitFor();assert.equal(await list.getByRole('option').count(),3);
  await list.getByRole('option').nth(1).click();
  await page.locator('.status-badge').filter({hasText:'404 Owned 404'}).waitFor();
  await page.waitForFunction(()=>{const saved=JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}');const id=saved.history?.[1]?._id;return typeof id==='string'&&saved.responseSelections?.[saved.activeRequestId]===id;});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
  const ids=before.history.map((/** @type {Record<string,any>} */ entry)=>entry._id);assert.equal(new Set(ids).size,3);assert.ok(ids.every((/** @type {unknown} */ id)=>typeof id==='string'&&id));assert.equal(ids[2],'res_owned_history_2');
  assert.deepEqual(before.history.map((/** @type {Record<string,any>} */ entry)=>entry.body),data.history.map(entry=>entry.body));
  await page.reload();await trigger.waitFor();
  await page.locator('.status-badge').filter({hasText:'404 Owned 404'}).waitFor();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
  assert.deepEqual(after.history,before.history);assert.deepEqual(after.responseSelections,before.responseSelections);assert.deepEqual(errors,[]);
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,legacyIdsAssigned:true,selectionReload:true,knownIdPreserved:true,bodiesPreserved:true,clipboardTouched:false}));return;
 }
 if(charsetOnly){
  const editor=page.locator('textarea[aria-label="Response body"]').first();
  await page.waitForFunction(()=>/** @type {HTMLTextAreaElement|null} */(document.querySelector('textarea[aria-label="Response body"]'))?.value==='AB');
  assert.equal(await editor.inputValue(),'AB');
  await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(new URL('/owned-charset-response',page.url()).href);
  const savedEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Request actions',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Send And Download',exact:true}).click();
  const saved=await savedEvent;assert.equal(saved.suggestedFilename(),'owned-response.txt');assert.equal(charsetRequests,1);
  const savedPath=await saved.path();assert.ok(savedPath);assert.deepEqual(Buffer.from(await Bun.file(savedPath).bytes()),charsetBytes);
  await page.getByRole('group',{name:'Response formatting',exact:true}).getByRole('button',{name:'Raw',exact:true}).click();
  await page.reload();await page.waitForFunction(()=>/** @type {HTMLTextAreaElement|null} */(document.querySelector('textarea[aria-label="Response body"]'))?.value==='AB');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history.find((/** @type {any} */ entry)=>entry._id==='res_owned_history_0'));assert.equal(stored.body,'A\u0000\u0000\u0000B\u0000\u0000\u0000');assert.equal(stored.bodyBase64,charsetBytes.toString('base64'));assert.deepEqual(errors,[]);
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,decodedCharset:true,exactSavedBytes:true,sendAndDownload:true,wireRequests:charsetRequests,filename:'owned-response.txt',reload:true,originalHistoryUnchanged:true},null,2));return;
 }
 if(multipartOnly){
  const selector=page.getByRole('combobox',{name:'Response part',exact:true});await selector.waitFor();
  assert.equal(await selector.locator('option').count(),2);
  const editor=page.locator('textarea[aria-label="Response part body"]').first();
  await page.waitForFunction(()=>/** @type {HTMLTextAreaElement|null} */(document.querySelector('textarea[aria-label="Response part body"]'))?.value.includes('ไทย'));
  assert.match(await editor.inputValue(),/9007199254740993/);
  await page.getByRole('button',{name:'Part headers',exact:true}).click();
  assert.match(await page.getByLabel('Part headers',{exact:true}).textContent()||'',/X-Ownedfirst/);
  await selector.selectOption('1');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Save part',exact:true}).click();
  const file=await downloaded;assert.equal(file.suggestedFilename(),'owned.bin');const path=await file.path();assert.ok(path);
  assert.deepEqual(Buffer.from(await Bun.file(path).bytes()),Buffer.from([0,255,13,10,42]));
  await page.screenshot({path:output+'/multipart-preview.png'});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history[0].bodyBase64),multipartBytes.toString('base64'));
  assert.deepEqual(errors,[]);
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,parts:2,jsonUnicodeAndLargeInteger:true,utf32Part:true,transferBase64:true,headers:true,exactBinaryDownload:true,originalBytes:true},null,2));return;
 }
 if(pdfOnly){
  const deadline=setTimeout(()=>{void page.close();},15000);
  try{
   const attempts=/** @type {string[]} */([]);await page.route('https://owned-preview.invalid/**',route=>{attempts.push(route.request().url());return route.abort();});
   await page.getByText('PDF page text',{exact:true}).click();
   await page.locator('.pdf-preview pre').filter({hasText:'Owned PDF page one'}).waitFor();
   const responseDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Save response',exact:true}).click();
   const saved=await responseDownload;assert.equal(saved.suggestedFilename(),'ไทย.pdf');const savedPath=await saved.path();assert.ok(savedPath);
   assert.equal(Buffer.from(await Bun.file(savedPath).bytes()).toString('base64'),pdfBase64);
   const canvas=page.locator('canvas[aria-label="PDF page 1"]');
   assert.deepEqual(await canvas.evaluate(el=>{const c=/** @type {HTMLCanvasElement} */(el);const context=c.getContext('2d');if(!context)throw new Error('PDF canvas context unavailable');return Array.from(context.getImageData(Math.floor(c.width*25/300),Math.floor(c.height*175/200),1,1).data);}),[0,0,255,255]);
   await page.getByRole('button',{name:'Next page',exact:true}).click();await page.locator('.pdf-preview pre').filter({hasText:'Owned PDF page two'}).waitFor();
   await page.getByRole('combobox',{name:'PDF zoom',exact:true}).selectOption('1.5');
   await page.waitForFunction(()=>document.querySelector('canvas[aria-label="PDF page 2"]')?.getAttribute('style')?.includes('450px'));
   await page.locator('.pdf-preview pre').filter({hasText:'Owned PDF page two'}).waitFor();
   await page.screenshot({path:output+'/pdf-preview.png'});
   await page.getByRole('button',{name:'Previous page',exact:true}).click();await page.locator('.pdf-preview pre').filter({hasText:'Owned PDF page one'}).waitFor();
   assert.equal(await page.evaluate(()=>!!/** @type {any} */(window).__ownedPdfAction),false);assert.deepEqual(attempts,[]);
   const modes=page.getByRole('group',{name:'Response formatting',exact:true});await modes.getByRole('button',{name:'Raw',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.previewMode==='raw'));
   await page.reload();await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history[0].bodyBase64),pdfBase64);assert.deepEqual(errors,[]);
   await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,pages:2,canvasPixels:true,unicodeFilenameAndExactDownload:true,pageText:true,navigation:true,zoom:true,noDocumentActions:true,networkAttempts:attempts,rawReload:true,exactSavedBytes:true},null,2));
  }finally{clearTimeout(deadline);}
  return;
 }
 if(csvOnly){
  const deadline=setTimeout(()=>{void page.close();},10000);
  try{
   const table=page.getByRole('table',{name:'CSV response',exact:true});await table.waitFor();
   assert.equal(await table.getByRole('row').count(),200);
   const cells=table.getByRole('row',{name:'CSV row 2',exact:true}).getByRole('cell');
   assert.deepEqual(await cells.allTextContents(),['A, ไทย','line1\r\nline2','0007']);
   assert.equal(await table.getByRole('row',{name:'CSV row 3',exact:true}).getByRole('cell').nth(2).textContent(),'9007199254740993');
   assert.equal(await table.locator('img,script').count(),0,'Cell markup remains text');
   await page.getByRole('button',{name:'Next rows',exact:true}).click();
   await table.getByRole('row',{name:'CSV row 208',exact:true}).waitFor();
   assert.equal(await table.getByRole('row').count(),8);
   assert.deepEqual(await table.getByRole('row',{name:'CSV row 208',exact:true}).getByRole('cell').allTextContents(),['row-204','value-204','204']);
   const pageNumber=page.getByRole('spinbutton',{name:'CSV page',exact:true});await pageNumber.fill('1');await pageNumber.press('Tab');
   await table.getByRole('row',{name:'CSV row 1',exact:true}).waitFor();
   await page.screenshot({path:output+'/csv-preview.png'});
   const modes=page.getByRole('group',{name:'Response formatting',exact:true});
   await modes.getByRole('button',{name:'Source',exact:true}).click();await page.locator('.response-pane .CodeMirror').waitFor();
   assert.equal(await page.locator('.response-pane .CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),csvBody.replaceAll('\r\n','\n'));
   await modes.getByRole('button',{name:'Raw',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.previewMode==='raw'));
   await page.reload();await modes.waitFor();assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history[0].body),csvBody);
   assert.deepEqual(errors,[]);
   await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,totalRows:208,pageRows:200,allRowsReachable:true,quotedFields:true,unicode:true,stringsPreserved:true,markupEscaped:true,sourceAndRaw:true,savedBodyUnchanged:true},null,2));
  }finally{clearTimeout(deadline);}
  return;
 }
 if(visualOnly){
  const deadline=setTimeout(()=>{void page.close();},10000);
  try {
  await page.getByRole('textbox',{name:'Request URL',exact:true}).waitFor();
  const modes=page.getByRole('group',{name:'Response formatting',exact:true});
  const previewTitle=audioOnly?'Audio response preview':imageOnly?'Image response preview':'HTML response preview';
  const iframe=page.getByTitle(previewTitle,{exact:true});
  const attempts=/** @type {string[]} */([]);
  await page.route('https://owned-preview.invalid/**',route=>{attempts.push(route.request().url());return route.abort();});
  assert.equal(await modes.getByRole('button',{name:'Source',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await iframe.count(),0);
  await modes.getByRole('button',{name:'Preview',exact:true}).click();
  await iframe.waitFor();assert.equal(await iframe.getAttribute('sandbox'),'');
  const preview=page.frameLocator('iframe[title="'+previewTitle+'"]');
  if(audioOnly){
    const player=preview.getByLabel('Response audio',{exact:true});
    await player.evaluate(el=>{
      const audio=/** @type {HTMLAudioElement} */(el);
      if(audio.readyState>=1)return;
      return new Promise((resolve,reject)=>{
        audio.addEventListener('loadedmetadata',()=>resolve(null),{once:true});
        audio.addEventListener('error',()=>reject(Error('Audio decode failed')),{once:true});
      });
    });
    assert.deepEqual(await player.evaluate(el=>{const audio=/** @type {HTMLAudioElement} */(el);return {paused:audio.paused,autoplay:audio.autoplay,controls:audio.controls,duration:audio.duration};}),{paused:true,autoplay:false,controls:true,duration:0.01});
    assert.equal(await player.getAttribute('src'),'data:audio/wav;base64,'+audioBase64);
  }else if(imageOnly){
    const dimensions=await preview.getByAltText('Response image',{exact:true}).evaluate(async el=>{const image=/** @type {HTMLImageElement} */(el);await image.decode();return [image.naturalWidth,image.naturalHeight];});
    const header=new DataView(imageBytes.buffer);assert.deepEqual(dimensions,[header.getUint32(16),header.getUint32(20)]);
    assert.equal(await preview.getByAltText('Response image',{exact:true}).getAttribute('src'),'data:image/png;base64,'+imageBase64);
  }else{
  await preview.locator('#owned-html-mark').waitFor();
  assert.equal(await preview.locator('#owned-html-mark').innerText(),'HTML preview ไทย');
  assert.equal(await preview.locator('#owned-html-mark').evaluate(el=>getComputedStyle(el).color),'rgb(12, 34, 56)');
  assert.equal(await preview.locator('#owned-script-state').innerText(),'not executed');
  }
  assert.equal(await preview.locator('body').evaluate(()=>{try{void parent.document.body;return true;}catch{return false;}}),false,'opaque sandbox cannot access app DOM');
  assert.deepEqual(attempts,[],'CSP blocks resources and frame navigation before network');
  await page.screenshot({path:output+(audioOnly?'/audio-preview.png':imageOnly?'/image-preview.png':'/html-preview.png')});
  await modes.getByRole('button',{name:'Source',exact:true}).click();
  assert.deepEqual(attempts,[],'No response-initiated network during preview lifetime');
  await page.locator('.response-pane .CodeMirror').waitFor();
  assert.equal(await page.locator('.response-pane .CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),visualBody);
  assert.equal(await iframe.count(),0);
  await modes.getByRole('button',{name:'Raw',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources.some((/** @type {any} */r)=>r._type==='request_meta'&&r.previewMode==='raw'));
  await page.reload();await modes.waitFor();
  assert.equal(await modes.getByRole('button',{name:'Raw',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.response-pane .CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),visualBody);
  if(imageOnly)assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history[0].bodyBase64),imageBase64);
  if(audioOnly)assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history[0].bodyBase64),audioBase64);
  assert.equal(await iframe.count(),0);assert.deepEqual(errors,[]);
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,...(audioOnly?{audioMetadata:true,noAutoplay:true,exactSavedBytes:true}:imageOnly?{imageDecoded:true,exactSavedBytes:true}:{staticHtml:true,inlineStyle:true,scriptsBlocked:true}),networkAttempts:attempts,opaqueOrigin:true,sourceExact:true,rawReload:true},null,2));
  } finally {clearTimeout(deadline);}
  return;
 }
 const trigger=page.getByRole('button',{name:'Response history',exact:true});
 const list=page.getByRole('listbox',{name:'Response history',exact:true});
 await trigger.waitFor();
 // Theme changes persist collection context as part of ordinary app startup.
 // Settle that setup before recording the read-only history-action boundary.
 await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').settings?.theme==='light');
 const rows=[];
 for(const theme of ['dark','light'])for(const width of [1440,900,760]){
  await page.setViewportSize({width,height:960});if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await page.waitForFunction(theme=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').settings?.theme===theme,theme);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
  await trigger.focus();await page.keyboard.press('ArrowDown');await list.waitFor();
  const options=list.getByRole('option');assert.equal(await options.count(),3);
  assert.equal(await options.first().evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('End');await page.keyboard.press('Enter');await list.waitFor({state:'detached'});
  await page.locator('.status-badge').filter({hasText:'503 Owned 503'}).waitFor();
  await page.locator('.response-pane .CodeMirror-code').filter({hasText:'Owned history body 503'}).waitFor();
  assert.equal(await page.locator('.response-pane .CodeMirror-line').innerText(),'Owned history body 503');
  assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  await trigger.focus();await page.keyboard.press('ArrowUp');await list.waitFor();await page.keyboard.press('Home');await page.keyboard.press('Space');await list.waitFor({state:'detached'});
  await page.locator('.status-badge').filter({hasText:'200 Owned 200'}).waitFor();
  await page.locator('.response-pane .CodeMirror-code').filter({hasText:'Owned history body 200'}).waitFor();
  assert.equal(await page.locator('.response-pane .CodeMirror-line').innerText(),'Owned history body 200');
  await trigger.click();await list.waitFor();await page.keyboard.press('Escape');await list.waitFor({state:'detached'});assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));assert.deepEqual(after.history,before.history,'History selection is read-only');assert.deepEqual(after.resources,before.resources,'Request/resources unchanged');
  await page.screenshot({path:output+`/${theme}-${width}.png`});rows.push({theme,width,statuses:[503,200],space:true,escape:true,focus:true,historyReadOnly:true});
 }
 await page.reload();await trigger.waitFor();await page.locator('.status-badge').filter({hasText:'200 Owned 200'}).waitFor();
 assert.deepEqual(errors,[]);
 await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,rows,reload:true},null,2));
},{fetch:request=>charsetOnly&&new URL(request.url).pathname==='/owned-charset-response'?(charsetRequests++,new Response(charsetBytes,{headers:{'Content-Type':'text/plain; charset=utf-32le'}})):undefined,...(visualOnly?{headers:{'Content-Security-Policy':'frame-src blob:','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}:{}),beforeNavigate:async page=>{page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(value=>{if(window.top===window&&!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(value));},data);}});
