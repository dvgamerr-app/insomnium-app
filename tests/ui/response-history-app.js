import assert from 'node:assert/strict';
import {initialData} from '../../src/lib/model.js';
import {withPreview} from './helpers/preview-app.js';

const data=initialData();
const errors=/** @type {string[]} */([]);
data.history=[200,404,503].map((status,index)=>({_id:'res_owned_history_'+index,_type:'response',requestId:data.activeRequestId,created:1720000030000-index*10000,status,statusText:'Owned '+status,elapsedMs:10,size:20,headers:[['Content-Type','text/plain']],body:'Owned history body '+status}));
await withPreview('response-history-app',async(page,output)=>{
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
},{beforeNavigate:async page=>{page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(value=>{if(!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(value));},data);}});
