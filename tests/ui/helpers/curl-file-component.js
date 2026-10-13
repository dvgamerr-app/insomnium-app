import assert from 'node:assert/strict';
import { withComponentFixture } from './component-fixture.js';
const limit='Error: Files larger than 20 MiB are not supported yet. Select a smaller file.';
const file={name:'owned.bin',mimeType:'application/octet-stream',buffer:Buffer.from([0,13,10,255,65])};
/** Saved controlled-component oracle; never Tauri, IPC, network or OS selection. */
export async function runCurlFileComponent(){
  await withComponentFixture('curl-file-component',async(page,output)=>{
    const rows=/** @type {Record<string,any>[]} */ ([]), baseline=/** @type {Record<string,any>[]} */ ([]);
    /** @param {string} method @param {any} [arg] */
    const probe=(method,arg)=>page.evaluate(([method,arg])=>(/** @type {any} */ (window)).__curlFileComponent[method](arg),[method,arg]);
    /** @param {number} n */
    const input=n=>page.getByLabel('File for body part '+n,{exact:true});
    const snap=()=>probe('snapshot');
    /** @param {number} n @param {string} [mode] */
    const select=async(n,mode='ordinary')=>{await probe('mode',mode);await input(n).setInputFiles(file);};
    const settled=()=>page.waitForFunction(()=>(/** @type {any} */ (window)).__curlFileComponent.snapshot().pendingReads===0&&[...document.querySelectorAll('input[type=file]')].every(node=>(/** @type {HTMLInputElement} */ (node)).value===''));
    for(const theme of ['dark','light'])for(const width of [1440,900,760]){
      await page.setViewportSize({width,height:600});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      const measure=()=>page.locator('[data-curl-fixture]').evaluate(host=>{const box=(/** @type {Element} */ node)=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {host:box(host),controls:[...host.querySelectorAll('.ui-file-picker,textarea')].map(node=>{const s=getComputedStyle(node);return {...box(node),font:s.font,color:s.color,background:s.backgroundColor,border:s.border,padding:s.padding};})};});
      await probe('reset','baseline');const before=await measure();await select(1,'oversize');await settled();assert.equal(await page.getByText(limit,{exact:true}).count(),1);await select(2);await settled();assert.equal(await page.getByText(limit,{exact:true}).count(),0);baseline.push({theme,width,sourceEvidenceConfirmed:true,errorErasedByOtherRow:true,geometry:before});
      await probe('reset');assert.deepEqual(await measure(),before);
      await input(1).focus();assert.equal(await input(1).evaluate(node=>node===document.activeElement),true);
      await page.keyboard.press('Tab');assert.equal(await input(2).evaluate(node=>node===document.activeElement),true);await page.keyboard.press('Shift+Tab');assert.equal(await input(1).evaluate(node=>node===document.activeElement),true);
      const initial=await snap();await select(1,'oversize');await settled();assert.deepEqual(await snap(),initial);
      const association=await input(1).evaluate(node=>({id:node.id,invalid:node.getAttribute('aria-invalid'),description:node.getAttribute('aria-describedby')}));assert.equal(association.invalid,'true');assert.equal(association.description,association.id+'-error');assert.equal(await page.locator('#'+association.description).textContent(),limit);assert.equal(await input(2).getAttribute('aria-invalid'),null);
      await select(2);await settled();assert.equal(await input(1).getAttribute('aria-invalid'),'true');assert.equal(await page.getByText(limit,{exact:true}).count(),1);assert.equal((await snap()).calls.length,1);
      await select(1);await settled();assert.equal(await input(1).getAttribute('aria-invalid'),null);assert.equal(await page.getByText(limit,{exact:true}).count(),0);assert.equal((await snap()).request.body.curlSegments[0].base64,file.buffer.toString('base64'));
      await probe('reset');await select(1,'reject');await settled();assert.equal(await input(1).getAttribute('aria-invalid'),'true');assert.equal(await page.getByText('Error: Owned file read failure',{exact:true}).count(),1);assert.equal((await snap()).calls.length,0);
      for(const retire of ['replaceRow','rowABA','dataABA','requestABA','remount']){await probe('reset');const before=await snap();await select(1,'gate-reject');await probe(retire);await probe('release');await settled();assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual((await snap()).calls,before.calls);rows.push({theme,width,case:retire,staleSuppressed:true});}
      await probe('reset');await select(1,'gate-reject');await probe('pause');await probe('release');await page.waitForFunction(()=>(/** @type {any} */ (window)).__curlFileComponent.snapshot().paused);await settled();assert.equal((await snap()).calls.length,0);assert.equal(await page.getByRole('alert').count(),0);await probe('resume');await page.waitForFunction(()=>!(/** @type {any} */ (window)).__curlFileComponent.snapshot().paused);
      await probe('reset');await select(1,'gate-reject');await select(1);await probe('release');await settled();assert.equal(await page.getByRole('alert').count(),0);assert.equal((await snap()).calls.length,1);
      await probe('reset');await probe('pause');await page.waitForFunction(()=>(/** @type {any} */ (window)).__curlFileComponent.snapshot().paused);const admission=await snap();await select(1);await settled();assert.equal(await page.getByRole('alert').textContent(),'Error: Workspace operations are stopping.');assert.equal(await input(1).getAttribute('aria-invalid'),null);assert.deepEqual(await snap(),admission);await probe('resume');
      await probe('reset');await probe('callbackFailure',true);await select(1);await settled();assert.equal(await page.getByRole('alert').textContent(),'Error: Owned callback failure');assert.equal(await input(1).getAttribute('aria-invalid'),null);assert.equal((await snap()).calls.length,0);
      await probe('reset');await probe('configure',{curlFileMode:'unsupported'});await select(1);await settled();assert.equal(await page.getByRole('alert').textContent(),'Error: Unsupported imported file mode. Import the command again.');assert.equal(await input(1).getAttribute('aria-invalid'),null);await select(2);await settled();assert.equal(await page.getByRole('alert').textContent(),'Error: Unsupported imported file mode. Import the command again.');
      await probe('reset');await select(1,'oversize');await select(2,'reject');await settled();const ids=await page.getByRole('alert').evaluateAll(nodes=>nodes.map(node=>node.id));assert.equal(new Set(ids).size,2);assert.equal(ids.length,2);for(const n of [1,2])assert.equal(await input(n).getAttribute('aria-invalid'),'true');
      await probe('reset');await select(1,'reject-long');await settled();assert.equal(await input(1).getAttribute('aria-invalid'),'true');assert.equal((await snap()).calls.length,0);
      const bounds=await page.getByRole('alert').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),p=(/** @type {HTMLElement} */ (node.closest('[data-curl-fixture]'))).getBoundingClientRect();const style=getComputedStyle(node);return {left:r.left,right:r.right,parentLeft:p.left,parentRight:p.right,scroll:node.scrollWidth,client:node.clientWidth,width:r.width,height:r.height,dpr:devicePixelRatio,display:style.display,overflowWrap:style.overflowWrap,whiteSpace:style.whiteSpace,padding:style.padding,border:style.border,overflowX:style.overflowX};}));await Bun.write(output+"/long-error-before-assert-"+theme+"-"+width+".json",JSON.stringify({theme,width,native:false,bounds},null,2));for(const b of bounds){assert.ok(b.left>=b.parentLeft&&b.right<=b.parentRight);assert.ok(b.scroll<=b.client);}
      rows.push({theme,width,case:'rowOwnershipAndGlobalPhases',association,normalGeometryExact:true,bounds});
    }
    await Bun.write(output+'/curl-component.json',JSON.stringify({native:false,controlledOwnedFileMethods:true,osChooser:false,executed:true,baseline,rows},null,2));
  });
}
