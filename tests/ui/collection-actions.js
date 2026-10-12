import assert from 'node:assert/strict';
import {initialData,newRequest} from '../../src/lib/model.js';
import {withPreview} from './helpers/preview-app.js';
import {exerciseCollectionActions} from './helpers/collection-actions-cases.js';

const data=initialData(),selected=data.resources.find(r=>r._id===data.activeRequestId);
assert.ok(selected);selected.name='Owned selected action';
data.resources.push({_id:'fld_owned_actions',_type:'request_group',parentId:data.activeWorkspaceId,name:'Owned action folder'}, {...newRequest('fld_owned_actions'),_id:'req_owned_actions',name:'Owned idle action'});
await withPreview('collection-actions',async(page,output)=>{
 const rows=await exerciseCollectionActions(page,output);await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,rows,resourcesReadOnly:true,historyReadOnly:true},null,2));
},{buildRoot:process.env.INSOMNIUM_UI_PREVIEW_BUILD,beforeNavigate:async page=>{await page.addInitScript(value=>{if(!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(value));},data);}});
