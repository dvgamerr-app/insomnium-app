import assert from 'node:assert/strict';
import {initialData,newRequest} from '../../src/lib/model.js';
import {withPreview} from './helpers/preview-app.js';

const data=initialData(),selected=data.resources.find(r=>r._id===data.activeRequestId);
assert.ok(selected);selected.name='Owned selected action';
data.resources.push({_id:'fld_owned_actions',_type:'request_group',parentId:data.activeWorkspaceId,name:'Owned action folder'}, {...newRequest('fld_owned_actions'),_id:'req_owned_actions',name:'Owned idle action'});
await withPreview('collection-actions',async(page,output)=>{
 const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
 const rows=[];
 for(const theme of ['dark','light'])for(const width of [1440,900,760]){
  await page.setViewportSize({width,height:960});
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  await page.keyboard.press('Control+s');
  await page.waitForFunction(t=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').settings?.theme===t,theme);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
  const cases=/** @type {Array<[string,string,boolean]>} */([['Owned selected action','.tree-request-row',true],['Owned idle action','.tree-request-row',false],['Owned action folder','.tree-folder',false]]);
  for(const [name,selector,active] of cases){
   const action=page.getByRole('button',{name:'Manage '+name,exact:true});
   const row=page.locator(selector).filter({has:action});assert.equal(await row.count(),1);
   await page.getByRole('button',{name:'Toggle theme',exact:true}).focus();await page.mouse.move(width-2,958);
   await page.waitForFunction(n=>{const el=document.querySelector(`button[aria-label="Manage ${n}"]`);return el&&getComputedStyle(el).opacity==='0';},name);
   const box=await row.boundingBox();assert.ok(box);
   // Hover the padded edge outside both buttons to prove the complete row owns hover.
   await page.mouse.move(box.x+box.width-2,box.y+box.height/2);
   await page.waitForFunction(n=>{const el=document.querySelector(`button[aria-label="Manage ${n}"]`);return el&&getComputedStyle(el).opacity==='1';},name);
   const hover=await row.evaluate((el,active)=>{const style=getComputedStyle(el);return {actual:style.backgroundColor,token:style.getPropertyValue(active?'--selected':'--hover').trim()};},active);
   const expected=await row.evaluate((el,active)=>{const p=document.createElement('span');p.style.backgroundColor=`var(${active?'--selected':'--hover'})`;el.appendChild(p);const value=getComputedStyle(p).backgroundColor;p.remove();return value;},active);
   assert.equal(hover.actual,expected,'Full row uses its hover/selection token');
   if(selector==='.tree-request-row'){
    await row.locator('.tree-request').hover();
    assert.equal(await row.locator('.tree-request').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Hovered nested button does not cover row hover');
   }
   await page.mouse.move(width-2,958);
   await row.locator(active||selector==='.tree-request-row'?'.tree-request':'.folder-label').focus();await page.keyboard.press('Tab');
   if(selector==='.tree-folder')await page.keyboard.press('Tab');
   assert.equal(await action.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),true,'Keyboard reaches exact action');
   assert.equal(await action.evaluate(el=>getComputedStyle(el).opacity),'1','Keyboard action visible without hover');
   await page.keyboard.press('Enter');const dialog=page.getByRole('dialog',{name:selector==='.tree-folder'?'Manage folder':'Manage request',exact:true});await dialog.waitFor();
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   rows.push({theme,width,name,active,edgeHover:true,keyboard:true,dialog:true,background:expected});
  }
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));assert.deepEqual(after.resources,before.resources);assert.deepEqual(after.history,before.history);
  await page.screenshot({path:output+`/${theme}-${width}.png`});
 }
 assert.deepEqual(errors,[]);await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,rows,resourcesReadOnly:true,historyReadOnly:true},null,2));
},{buildRoot:process.env.INSOMNIUM_UI_PREVIEW_BUILD,beforeNavigate:async page=>{await page.addInitScript(value=>{if(!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(value));},data);}});
