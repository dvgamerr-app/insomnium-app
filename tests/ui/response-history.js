import assert from 'node:assert/strict';
import {withComponentFixture} from './helpers/component-fixture.js';

await withComponentFixture('response-history',async(page,output)=>{
 const trigger=page.getByRole('button',{name:'Response history',exact:true});
 const list=page.getByRole('listbox',{name:'Response history',exact:true});
 /** @param {import('playwright-core').Locator} locator */
 const focused=locator=>locator.evaluate(el=>el===document.activeElement);
 const rows=[];
 // Preserve a direct regression: Escape from inside the popup must close it.
 await trigger.click();await list.waitFor();if(await list.getByRole('button').count())await list.getByRole('button').first().focus();else await list.getByRole('option').first().focus();
 await page.keyboard.press('Escape');await list.waitFor({state:'detached'});assert.equal(await focused(trigger),true);
 for(const theme of ['dark','light'])for(const width of [1440,900,760]){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.setViewportSize({width,height:600});
  await page.getByRole('button',{name:'Reset history fixture',exact:true}).click();await trigger.focus();
  await page.keyboard.press('ArrowDown');await list.waitFor();let options=list.getByRole('option');
  assert.equal(await options.count(),3);assert.equal(await focused(options.nth(1)),true,'Open focuses current response');
  assert.equal(await options.nth(1).getAttribute('aria-selected'),'true');
  await page.keyboard.press('End');assert.equal(await focused(options.nth(2)),true);await page.keyboard.press('ArrowDown');assert.equal(await focused(options.nth(0)),true);
  await page.keyboard.press('ArrowUp');assert.equal(await focused(options.nth(2)),true);await page.keyboard.press('Home');assert.equal(await focused(options.nth(0)),true);
  assert.equal(await page.getByLabel('History selections',{exact:true}).textContent(),'0','Navigation never selects');
  await page.keyboard.press('Escape');await list.waitFor({state:'detached'});assert.equal(await focused(trigger),true);assert.equal(await page.getByLabel('Selected response ID',{exact:true}).textContent(),'res_history_b');
  await page.keyboard.press('ArrowUp');await list.waitFor();options=list.getByRole('option');await page.keyboard.press('Home');await page.keyboard.press('Enter');await list.waitFor({state:'detached'});
  assert.equal(await page.getByLabel('Selected response ID',{exact:true}).textContent(),'res_history_a');assert.equal(await page.getByLabel('History selections',{exact:true}).textContent(),'1');assert.equal(await focused(trigger),true);
  await trigger.click();await list.waitFor();options=list.getByRole('option');await options.nth(2).click();await list.waitFor({state:'detached'});assert.equal(await page.getByLabel('Selected response ID',{exact:true}).textContent(),'res_history_c');assert.equal(await focused(trigger),true);
  await trigger.click();await list.waitFor();await page.keyboard.press('Tab');await list.waitFor({state:'detached'});assert.equal(await focused(page.getByRole('button',{name:'Outside history',exact:true})),true);
  await trigger.click();await list.waitFor();await page.getByRole('button',{name:'Outside history',exact:true}).click();await list.waitFor({state:'detached'});assert.equal(await page.getByLabel('History selections',{exact:true}).textContent(),'2');
  await trigger.click();await list.waitFor();const box=await list.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width&&box.y+box.height<=600,'Popup stays inside viewport');
  await page.screenshot({path:output+`/${theme}-${width}.png`});await page.keyboard.press('Escape');rows.push({theme,width,keyboard:true,selection:true,focus:true,outside:true,geometry:true});
 }
 await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,rows},null,2));
});
