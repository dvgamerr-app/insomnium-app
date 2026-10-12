import assert from 'node:assert/strict';
import {poll} from './native-app.js';

/** Existing actual-app history workflow, using real saved native data.
 * @param {import('playwright-core').Page} page @param {string} output
 * @param {()=>Promise<any>} load */
export async function exerciseNativeResponseHistory(page,output,load){
  const trigger=page.getByRole('button',{name:'Response history',exact:true}),list=page.getByRole('listbox',{name:'Response history',exact:true}),rows=[];
  await trigger.waitFor();
  const theme=async(/** @type {string} */value)=>{if(await page.locator('html').getAttribute('data-theme')!==value)await page.getByRole('button',{name:'Toggle theme',exact:true}).click();await poll(async()=> (await load()).settings.theme===value,'Native theme save settled');};
  await theme('light');
  for(const value of ['dark','light'])for(const width of [1440,900,760]){
    await page.setViewportSize({width,height:960});await theme(value);const before=await load();
    await trigger.focus();await page.keyboard.press('ArrowDown');await list.waitFor();const options=list.getByRole('option');assert.equal(await options.count(),3);assert.equal(await options.first().evaluate(el=>el===document.activeElement),true);
    const box=await list.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width&&box.y+box.height<=960,'History popup stays in actual native viewport');
    await page.keyboard.press('End');await page.keyboard.press('Enter');await list.waitFor({state:'detached'});await page.locator('.status-badge').filter({hasText:'503 Owned 503'}).waitFor();await page.locator('.response-pane .CodeMirror-code').filter({hasText:'Owned history body 503'}).waitFor();assert.equal(await page.locator('.response-pane .CodeMirror-line').innerText(),'Owned history body 503');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    await trigger.focus();await page.keyboard.press('ArrowUp');await list.waitFor();await page.keyboard.press('Home');await page.keyboard.press('Space');await list.waitFor({state:'detached'});await page.locator('.status-badge').filter({hasText:'200 Owned 200'}).waitFor();await page.locator('.response-pane .CodeMirror-code').filter({hasText:'Owned history body 200'}).waitFor();assert.equal(await page.locator('.response-pane .CodeMirror-line').innerText(),'Owned history body 200');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    await trigger.click();await list.waitFor();await page.keyboard.press('Escape');await list.waitFor({state:'detached'});assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    const after=await load();assert.deepEqual(after.history,before.history,'History selection is read-only');assert.deepEqual(after.resources,before.resources,'All request/resources unchanged');await page.screenshot({path:output+`/${value}-${width}.png`});rows.push({theme:value,width,statuses:[503,200],space:true,escape:true,focus:true,historyReadOnly:true,resourcesReadOnly:true,geometry:true});
  }
  await page.reload();await trigger.waitFor();await page.locator('.status-badge').filter({hasText:'200 Owned 200'}).waitFor();return {rows,reload:true};
}
