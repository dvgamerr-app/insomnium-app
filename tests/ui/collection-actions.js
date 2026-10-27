import assert from 'node:assert/strict';
import {initialData,newRequest} from '../../src/lib/model.js';
import {withPreview} from './helpers/preview-app.js';
import {exerciseCollectionActions,addCollectionDepthFixture,exerciseCollectionDepth} from './helpers/collection-actions-cases.js';

const data=initialData(),selected=data.resources.find(r=>r._id===data.activeRequestId);
assert.ok(selected);selected.name='Owned selected action';
const collection=data.resources.find(row=>row._id===data.activeWorkspaceId);assert.ok(collection);collection.name='Owned retiring cookie wrk_01234567890123456789012345678901';
data.resources.push({_id:'fld_owned_actions',_type:'request_group',parentId:data.activeWorkspaceId,name:'Owned action folder'}, {...newRequest('fld_owned_actions'),_id:'req_owned_actions',name:'Owned idle action'});
const depth=addCollectionDepthFixture(data);
await withPreview('collection-actions',async(page,output)=>{
 const headerRows=[];
 for(const theme of ['dark','light'])for(const width of [1440,1200,1101,1100,900,760]){
  await page.setViewportSize({width,height:960});
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await Bun.write(output+'/header-layout.json',JSON.stringify(await page.locator('.app-header').evaluate(el=>[...el.querySelectorAll('.header-collections, .header-collections > *, .header-search, .header-tools')].map(node=>({tag:node.tagName,class:node.className,rect:node.getBoundingClientRect().toJSON(),minWidth:getComputedStyle(node).minWidth,maxWidth:getComputedStyle(node).maxWidth}))),null,2));
  for(const name of ['New collection','Manage collection','Search requests','Toggle theme']){
   const button=page.getByRole('button',{name,exact:true});
   assert.equal(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,`${name} remains pointer-accessible at ${width}`);
  }
  const search=await page.getByRole('button',{name:'Search requests',exact:true}).boundingBox();assert.ok(search);
  assert.ok(Math.abs(search.x+search.width/2-width/2)<1,'Search remains centered');
  const chooser=page.getByRole('combobox',{name:'Collection',exact:true});await chooser.click();
  assert.equal(await chooser.evaluate(el=>el.matches(':open')),true,'Collection picker opens despite clipped selected text');
  if(width===1440||width===760)await page.screenshot({path:output+`/collection-picker-${theme}-${width}.png`});
  await chooser.press('Escape');
  await page.getByRole('button',{name:'Manage collection',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Manage collection',exact:true});await dialog.waitFor();
  assert.equal(await dialog.getByRole('textbox',{name:'Name',exact:true}).inputValue(),collection.name);
  await dialog.press('Escape');await dialog.waitFor({state:'detached'});headerRows.push({theme,width,controls:4,centered:true,manageClick:true});
 }
 await Bun.write(output+'/header.json',JSON.stringify({passed:true,rows:headerRows},null,2));
 await exerciseCollectionDepth(page,output,depth);
 const rows=await exerciseCollectionActions(page,output);await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,rows,resourcesReadOnly:true,historyReadOnly:true,depth:64},null,2));
},{buildRoot:process.env.INSOMNIUM_UI_PREVIEW_BUILD,beforeNavigate:async page=>{await page.addInitScript(value=>{if(!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(value));},data);}});
