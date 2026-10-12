import assert from "node:assert/strict";

/** Actual KeyValue/FilePicker components; controlled reads affect an owned File
 * instance only, never prototypes/global APIs or native profile data.
 * @param {import('playwright-core').Page} page @param {string} output @param {{deferAggregate?:boolean}} [options] */
export async function measureMultipartFileFields(page, output, options = {}) {
  const region=page.getByRole("region",{name:"Multipart file ownership probe",exact:true});
  const rows=/** @type {Record<string,any>[]} */([]),failures=/** @type {Record<string,any>[]} */([]);
  const phaseRows=/** @type {Record<string,any>[]} */([]);
  const snapshot=async()=>JSON.parse(/** @type {string} */(await region.locator("output[data-file-probe]").getAttribute("data-file-probe")));
  const reset=async()=>region.getByRole("button",{name:"Reset owned multipart files",exact:true}).click();
  const file=(/** @type {number} */ i)=>region.locator('input[type="file"]').nth(i);
  const payload={name:"same.txt",mimeType:"text/plain",buffer:Buffer.from([0,65,255])};
  for(const theme of ["dark","light"]) for(const width of [1440,900,760]) {
    await page.setViewportSize({width,height:600});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await reset(); await region.scrollIntoViewIfNeeded();
    const initial=await snapshot();
    const geometry=await region.locator(".kv-row").evaluateAll(elements=>elements.map(row=>{
      const box=(/** @type {Element} */el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor};};
      const label=row.querySelector(".ui-file-picker"),name=row.querySelector(':scope > .ui-input'),type=row.querySelector(".ui-select"),remove=row.querySelector(":scope > button");
      if(!label||!name||!type||!remove)throw Error("Actual multipart row controls missing");
      return {row:box(row),label:box(label),name:box(name),type:box(type),remove:box(remove),wrapperDisplay:getComputedStyle(/** @type {Element} */(row.querySelector(".kv-value-field"))).display};
    }));
    for(const row of geometry) assert.ok(row.row.x>=0&&row.row.x+row.row.width<=width);
    const names=[];
    for(let i=0;i<2;i++) {
      const state=await file(i).evaluate(el=>({id:el.id,label:/** @type {HTMLInputElement} */(el).labels?.[0]?.textContent?.trim(),aria:el.getAttribute("aria-label"),invalid:el.getAttribute("aria-invalid"),description:el.getAttribute("aria-describedby")}));
      assert.ok(state.id);
      names.push({...state,ariaSnapshot:await file(i).ariaSnapshot()});
    }
    assert.notEqual(names[0].id,names[1].id,"Existing native FilePicker IDs are distinct");
    assert.equal(await region.locator("label label").count(),0,"Actual file fields never nest labels");
    for(let i=1;i<=2;i++)assert.equal(await region.getByRole("button",{name:`File value ${i}`,exact:true}).count(),1);
    await file(0).focus(); await file(0).press("Tab");
    assert.equal(await region.locator(".kv-row").nth(0).getByRole("combobox",{name:"Field type",exact:true}).evaluate(el=>el===document.activeElement),true);
    await file(1).setInputFiles({name:"over-limit.bin",mimeType:"application/octet-stream",buffer:Buffer.alloc(20*1024*1024+1,65)});
    await region.getByRole("alert").filter({hasText:"Files larger than 20 MiB"}).waitFor();
    assert.deepEqual(await snapshot(),initial,"Actual limit refusal has no callback/data/byte mutation");
    const invalid=await file(1).evaluate(el=>({id:el.id,invalid:el.getAttribute("aria-invalid"),description:el.getAttribute("aria-describedby"),nativeValue:/** @type {HTMLInputElement} */(el).value}));
    assert.equal(invalid.nativeValue,"","Shared async selection reset retained on refusal");
    if(invalid.invalid!=="true"||invalid.description!==invalid.id+"-error") failures.push({kind:"row-read-error-unassociated",theme,width,invalid});
    assert.equal(await region.getByRole("button",{name:"File value 2",exact:true}).count(),1,"Invalid-state indexed name remains exact");
    const errorGeometry=await region.locator(".kv-row").nth(1).evaluate(row=>{
      const box=(/** @type {Element} */el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor};};
      return {row:box(row),label:box(/** @type {Element} */(row.querySelector(".ui-file-picker"))),type:box(/** @type {Element} */(row.querySelector(".ui-select")))};
    });
    for(const key of /** @type {const} */(["label","type"])) {
      assert.equal(errorGeometry[key].width,geometry[1][key].width,"Actual error must not shrink "+key);
      assert.equal(errorGeometry[key].height,geometry[1][key].height,"Actual error must not resize "+key);
      assert.equal(errorGeometry[key].font,geometry[1][key].font);
    }
    const errorBounds=await region.getByRole("alert").evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height,bottom:r.bottom,scroll:el.scrollWidth,client:el.clientWidth};});
    assert.ok(errorBounds.x>=errorGeometry.row.x&&errorBounds.x+errorBounds.width<=errorGeometry.row.x+errorGeometry.row.width);
    assert.equal(errorBounds.scroll,errorBounds.client,"Actual feedback has no horizontal overflow");
    assert.ok(errorBounds.bottom<=600,"Actual feedback remains in measured viewport");
    assert.equal(await region.locator(".kv-row").nth(1).getByRole("combobox",{name:"Field type",exact:true}).getAttribute("aria-invalid"),null,"Type selector remains outside file error context");
    await file(0).setInputFiles(payload);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").calls===1);
    const corrected=await snapshot();
    assert.equal(corrected.rows[0].base64,"AEH/");
    assert.deepEqual(corrected.rows[1],initial.rows[1]);
    const unrelatedAlerts=await region.getByRole("alert").count();
    if(unrelatedAlerts===0) failures.push({kind:"other-row-success-clears-invalid-row-error",theme,width});
    await file(1).setInputFiles(payload);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").calls===2);
    assert.equal(await region.getByRole("alert").count(),0);
    const accepted=await snapshot();
    assert.equal(accepted.rows[0].base64,"AEH/"); assert.equal(accepted.rows[1].base64,"AEH/");
    const sameNames=[await file(0).ariaSnapshot(),await file(1).ariaSnapshot()];
    await reset();
    const beforeReadFailure=await snapshot();
    await region.getByRole("button",{name:"Fail next owned file read",exact:true}).click();
    await file(1).setInputFiles({...payload,name:"read-fails.txt"});
    await region.getByRole("alert").filter({hasText:"Owned fixture file read failed."}).waitFor();
    assert.deepEqual(await snapshot(),beforeReadFailure,"Controlled File.arrayBuffer failure has no callback/data mutation");
    const readFailure=await file(1).evaluate(el=>({id:el.id,invalid:el.getAttribute("aria-invalid"),description:el.getAttribute("aria-describedby"),nativeValue:/** @type {HTMLInputElement} */(el).value}));
    assert.equal(readFailure.nativeValue,"");
    if(readFailure.invalid!=="true"||readFailure.description!==readFailure.id+"-error") failures.push({kind:"controlled-read-error-unassociated",theme,width,readFailure});
    await file(1).setInputFiles(payload);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").calls===1);
    assert.equal(await region.getByRole("alert").count(),0);
    assert.equal((await snapshot()).rows[1].base64,"AEH/");
    // A successful read followed by a caller exception is not a file error.
    await reset();
    const beforeCallback=await snapshot();
    await region.getByRole("button",{name:"Fail next owned file callback",exact:true}).click();
    await file(0).setInputFiles(payload);
    await region.getByRole("alert").filter({hasText:"Owned fixture onchange failed."}).waitFor();
    assert.deepEqual(await snapshot(),beforeCallback,"Caller refusal has no committed callback/data mutation");
    const callback=await file(0).evaluate(el=>({invalid:el.getAttribute("aria-invalid"),description:el.getAttribute("aria-describedby")}));
    assert.equal(callback.invalid,null); assert.equal(callback.description,null,"Caller error remains form-level, not a read error");
    await file(0).setInputFiles(payload);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").calls===1);
    assert.equal(await region.getByRole("alert").count(),0);
    // Actual controlled read: replacing rows before completion must suppress it.
    await region.getByRole("button",{name:"Hold next owned file read",exact:true}).click();
    await file(0).setInputFiles({...payload,name:"late.txt"});
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").pending===true);
    await reset();
    await region.getByRole("button",{name:"Release owned file read",exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").pending===false);
    const stale=await snapshot();
    assert.equal(stale.calls,0); assert.deepEqual(stale.rows,initial.rows);
    assert.equal(await region.getByRole("alert").count(),0,"Stale row completion stays suppressed");
    // Actual public workspace pause closes work admission before file reading.
    await region.getByRole("button",{name:"Pause owned workspace work",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe-phase")==="paused");
    const beforeAdmission=await snapshot();
    await file(0).setInputFiles(payload);
    const scopeAlert=region.getByRole("alert").filter({hasText:"Workspace operations are stopping."});
    await scopeAlert.waitFor();
    assert.deepEqual(await snapshot(),beforeAdmission,"Work-admission refusal has no callback/data/byte mutation");
    const admission=await file(0).evaluate(el=>({invalid:el.getAttribute("aria-invalid"),description:el.getAttribute("aria-describedby")}));
    assert.equal(admission.invalid,null); assert.equal(admission.description,null,"Scope failure remains form-level");
    await region.getByRole("button",{name:"Resume owned workspace work",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe-phase")==="idle");
    await file(0).setInputFiles(payload);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").calls===1);
    assert.equal(await region.getByRole("alert").count(),0);
    await reset();
    // Destroying the actual editor disposes/cancels its real scoped work.
    await region.getByRole("button",{name:"Hold next owned file read",exact:true}).click();
    await file(0).setInputFiles({...payload,name:"disposed.txt"});
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").pending===true);
    await region.getByRole("button",{name:"Toggle owned multipart editor",exact:true}).click();
    assert.equal(await region.locator(".kv-editor").count(),0);
    await region.getByRole("button",{name:"Release owned file read",exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").pending===false);
    const disposed=await snapshot();
    assert.equal(disposed.calls,0); assert.deepEqual(disposed.rows,initial.rows);
    await region.getByRole("button",{name:"Toggle owned multipart editor",exact:true}).click();
    assert.equal(await region.getByRole("alert").count(),0);
    // Ordinary row clones retain a still-invalid file; external replacement drops it.
    await file(1).setInputFiles({name:"over-limit.bin",mimeType:"application/octet-stream",buffer:Buffer.alloc(20*1024*1024+1,65)});
    await region.getByRole("alert").filter({hasText:"Files larger than 20 MiB"}).waitFor();
    const ownedId=await file(1).getAttribute("id");
    await region.getByRole("textbox",{name:"Multipart file contract 2",exact:true}).fill("renamed invalid file");
    await region.getByRole("checkbox",{name:"Enable renamed invalid file",exact:true}).uncheck();
    assert.equal(await file(1).getAttribute("aria-invalid"),"true","Name/disabled row clones retain same-file error");
    assert.equal(await file(1).getAttribute("id"),ownedId);
    assert.equal(await file(1).getAttribute("aria-describedby"),ownedId+"-error");
    assert.equal(await region.getByRole("alert").count(),1);
    const cloned=await snapshot();
    assert.deepEqual(cloned.rows[1],{...initial.rows[1],name:"renamed invalid file",disabled:true});
    await reset();
    assert.equal(await region.getByRole("alert").count(),0,"External row replacement clears stale feedback");
    assert.equal(await file(1).getAttribute("aria-invalid"),null);
    assert.equal(await file(1).getAttribute("aria-describedby"),null);
    phaseRows.push({theme,width,readFailure,admission,callback,disposed,controlledRead:true,actualPublicAdmission:true,actualEditorDisposal:true});
    await region.getByRole("button",{name:"Remove Multipart file contract 2",exact:true}).focus();
    await page.keyboard.press("Enter");
    const removal=await page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,label:document.activeElement?.getAttribute("aria-label"),inRow:!!document.activeElement?.closest(".kv-row")}));
    const removed=await snapshot();
    assert.equal(removed.calls,1); assert.deepEqual(removed.rows,[initial.rows[0]]);
    if(removal.tag==="BODY") failures.push({kind:"focused-last-row-removal-loses-focus",theme,width,removal});
    assert.equal(await region.getByRole("button",{name:"Remove Multipart file contract 1",exact:true}).evaluate(el=>el===document.activeElement),true,"Last-row removal focuses previous survivor");
    await page.keyboard.press("Enter");
    assert.equal(await region.getByRole("button",{name:"Add multipart file contract",exact:true}).evaluate(el=>el===document.activeElement),true,"Empty editor focuses Add");
    assert.deepEqual((await snapshot()).rows,[]);
    await reset();
    await region.getByRole("button",{name:"Remove Multipart file contract 1",exact:true}).focus();
    await page.keyboard.press("Enter");
    assert.equal(await region.getByRole("button",{name:"Remove Multipart file contract 1",exact:true}).evaluate(el=>el===document.activeElement),true,"First-row removal focuses same-index survivor");
    assert.deepEqual((await snapshot()).rows,[initial.rows[1]]);
    rows.push({theme,width,geometry,errorGeometry,errorBounds,names,invalid,unrelatedAlerts,sameNames,accepted,stale,removal});
  }
  await reset();
  await Bun.write(output+"/multipart-file-measurements.json",JSON.stringify({native:false,controlledRead:true,rows,phaseRows,failures},null,2));
  if(!options.deferAggregate)assert.deepEqual(failures,[],"File read failures remain associated with their owned row and focused removal stays usable");
  return failures;
}
