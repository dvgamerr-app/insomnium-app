import assert from "node:assert/strict";

/** Actual saved preview application; owns only the scenario's browser storage.
 * @param {import('playwright-core').Page} page @param {string} output
 * @param {{saved?:()=>Promise<any>,until?:(read:()=>Promise<boolean>,label:string)=>Promise<any>,setTheme?:(theme:string)=>Promise<void>,native?:boolean}} [options] */
export async function measureEnvironmentName(page, output, options = {}) {
  const rows = /** @type {Record<string,any>[]} */ ([]);
  const failures = /** @type {Record<string,any>[]} */ ([]);
  const jsonRows = /** @type {Record<string,any>[]} */ ([]);
  const saved = options.saved ?? (async () => JSON.parse(/** @type {string} */ (
    await page.evaluate(() => localStorage.getItem("insomnium-tauri-preview-v1")))));
  const open = async () => {
    await page.getByRole("button", {name:"Edit environment",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"Manage environments",exact:true});
    await dialog.waitFor();
    return dialog;
  };
  const existing=page.getByRole("dialog",{name:"Manage environments",exact:true});
  if(await existing.count()) await existing.getByRole("button",{name:"Cancel",exact:true}).click();
  // The ordinary selection action normalizes startup workspace_meta before the
  // read-only baseline; subsequent saved rename must not create foreign data.
  const selection=page.getByRole("combobox",{name:"Active environment",exact:true});
  await selection.selectOption(await selection.inputValue());
  if (options.until) await options.until(async()=>{
    const data=await saved();
    return data.resources?.some(/** @param {any} resource */resource=>resource._type==="workspace_meta"&&resource.parentId===data.activeWorkspaceId&&resource.activeEnvironmentId===data.activeEnvironmentId);
  },"Durable environment selection metadata");
  else await page.waitForFunction(()=>{
    const data=JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1")||"{}");
    return data.resources?.some(/** @param {any} resource */resource=>resource._type==="workspace_meta"&&resource.parentId===data.activeWorkspaceId&&resource.activeEnvironmentId===data.activeEnvironmentId);
  });
  for(const theme of ["dark","light"]) for(const width of [1440,900,760]) {
    await page.setViewportSize({width,height:600});
    if(options.setTheme) await options.setTheme(theme);
    else await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.waitForFunction(()=>document.querySelector(".status-save")?.textContent?.includes("Local workspace"));
    const before=await saved();
    let dialog=await open();
    const name=dialog.getByRole("textbox",{name:"Name",exact:true});
    await name.waitFor();
    const id=await name.getAttribute("id");
    assert.ok(id);
    const environmentId=await dialog.getByRole("combobox",{name:"Environment to edit",exact:true}).inputValue();
    const originalName=await name.inputValue();
    const geometry=await name.evaluate(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el),label=/** @type {HTMLInputElement} */(el).labels?.[0],parent=el.closest("dialog"),b=parent?.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,font:s.font,
        label:label&&{text:label.textContent?.trim(),gap:getComputedStyle(label.closest(".ui-field")||label).gap,font:getComputedStyle(label).font,color:getComputedStyle(label).color},
        dialog:b&&{x:b.x,y:b.y,width:b.width,height:b.height,scroll:parent?.scrollWidth,client:parent?.clientWidth}};
    });
    assert.ok(geometry.width>=24&&geometry.height>=24);
    assert.ok(geometry.dialog&&geometry.dialog.x>=0&&geometry.dialog.x+geometry.dialog.width<=width);
    assert.ok(geometry.x>=0&&geometry.x+geometry.width<=width);
    await dialog.locator(".environment-name").click({position:{x:2,y:2}});
    assert.equal(await name.evaluate(el=>el===document.activeElement),true,"Original implicit Name label focuses input");
    const validAria=await name.ariaSnapshot();
    await name.fill("   ");
    const submit=dialog.getByRole("button",{name:"Save environment",exact:true});
    await submit.focus(); await submit.press("Enter");
    await dialog.getByRole("alert").filter({hasText:"Enter an environment name"}).waitFor();
    assert.deepEqual(await saved(),before,"Blank name refuses without any saved workspace mutation");
    assert.equal(await dialog.getByRole("textbox",{name:"Name",exact:true}).count(),1,"Exact invalid accessible Name remains stable");
    const state=await name.evaluate(el=>({id:el.id,invalid:el.getAttribute("aria-invalid"),refs:el.getAttribute("aria-describedby"),focus:document.activeElement?.textContent?.trim()}));
    const invalidAria=await name.ariaSnapshot();
    if(state.invalid === "true") {
      assert.equal(state.refs,id+"-error");
      const feedback=dialog.locator('[id="'+id+'-error"]');
      assert.equal(await feedback.getAttribute("role"),"alert");
      assert.equal(await feedback.innerText(),"Error: Enter an environment name","Original visible message retained exactly");
      assert.equal(await dialog.getByRole("alert").count(),1,"Local Name has no duplicate form alert");
      assert.equal(state.focus,"Save environment");
      await name.fill(" \t ");
      assert.equal(await name.getAttribute("aria-invalid"),"true","Still-blank input keeps its owned Name error");
      const editor=dialog.locator(".shared-code-editor").filter({has:page.locator('textarea[aria-label="Environment JSON"]')}).locator(".CodeMirror");
      const originalJson=await editor.evaluate(el=>/** @type {any} */(el).CodeMirror.getValue());
      for(const invalidJson of ["{","[]"]) {
        await editor.evaluate((el,text)=>/** @type {any} */(el).CodeMirror.setValue(text),invalidJson);
        await submit.press("Enter");
        const feedback=dialog.getByRole("alert");
        await feedback.waitFor();
        const message=await feedback.innerText();
        assert.match(message,invalidJson==="[]"?/Environment must be a JSON object/:/SyntaxError/);
        assert.equal(await feedback.getAttribute("id"),null,"JSON/parser failures remain original form-level feedback");
        assert.equal(await name.getAttribute("aria-invalid"),null,"JSON-first refusal does not misattribute to Name");
        assert.equal(await name.getAttribute("aria-describedby"),null);
        assert.deepEqual(await saved(),before);
        await name.fill("Valid Name leaves JSON feedback alone");
        assert.equal(await feedback.innerText(),message,"Name correction cannot clear unrelated JSON error");
        await name.fill("   ");
        jsonRows.push({theme,width,invalidJson,message,noSave:true,nameUnmarked:true});
      }
      await editor.evaluate((el,text)=>/** @type {any} */(el).CodeMirror.setValue(text),originalJson);
      await submit.press("Enter");
      assert.equal(await name.getAttribute("aria-invalid"),"true");
      assert.equal(await dialog.getByRole("alert").count(),1);
    }
    const correctedName="Corrected environment "+theme+" "+width;
    await name.fill(" "+correctedName+" ");
    assert.deepEqual(await saved(),before,"Correction alone does not save");
    const corrected={invalid:await name.getAttribute("aria-invalid"),refs:await name.getAttribute("aria-describedby"),alerts:await dialog.getByRole("alert").count()};
    if(state.invalid === "true") {
      assert.equal(corrected.invalid,null);
      assert.equal(corrected.refs,null);
      await name.fill("   ");
      await submit.press("Enter");
      assert.equal(await name.getAttribute("aria-invalid"),"true");
    }
    await dialog.press("Escape");
    await dialog.waitFor({state:"detached"});
    assert.deepEqual(await saved(),before,"Escape discards unsaved name correction");
    assert.equal(await page.getByRole("button",{name:"Edit environment",exact:true}).evaluate(el=>el===document.activeElement),true,"Escape restores environment trigger focus");
    dialog=await open();
    assert.equal(await dialog.getByRole("textbox",{name:"Name",exact:true}).inputValue(),originalName);
    assert.equal(await dialog.getByRole("textbox",{name:"Name",exact:true}).getAttribute("aria-invalid"),null,"Uncorrected error reset on modal reopen");
    assert.equal(await dialog.getByRole("alert").count(),0);
    await dialog.getByRole("textbox",{name:"Name",exact:true}).fill(" "+correctedName+" ");
    await dialog.getByRole("button",{name:"Save environment",exact:true}).press("Enter");
    await dialog.waitFor({state:"detached"});
    if(options.until) await options.until(async()=>{
      const data=await saved();
      return data.resources?.find(/** @param {any} resource */resource=>resource._id===environmentId)?.name===correctedName;
    },"Durable corrected environment name");
    else await page.waitForFunction(({environmentId,correctedName})=>{
      const data=JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1")||"{}");
      return data.resources?.find(/** @param {any} resource */resource=>resource._id===environmentId)?.name===correctedName;
    },{environmentId,correctedName});
    const after=await saved(),prior=before.resources.find(/** @param {any} resource */resource=>resource._id===environmentId),next=after.resources.find(/** @param {any} resource */resource=>resource._id===environmentId);
    assert.equal(next.name,correctedName);
    assert.deepEqual(next.data,prior.data,"Accepted rename preserves authored environment data");
    assert.deepEqual(after.resources.filter(/** @param {any} resource */resource=>resource._id!==environmentId),before.resources.filter(/** @param {any} resource */resource=>resource._id!==environmentId));
    assert.deepEqual(after.history,before.history);
    const row={theme,width,environmentId,geometry,validAria,invalidAria,state,corrected,accepted:next};
    rows.push(row);
    if(state.invalid!=="true"||state.refs!==id+"-error") failures.push({...row,kind:"missing-name-association"});
    if(corrected.alerts!==0) failures.push({...row,kind:"stale-local-name-error-after-correction"});
  }
  await Bun.write(output+"/environment-name-measurements.json",JSON.stringify({native:options.native??false,rows,jsonRows,failures},null,2));
  assert.deepEqual(failures,[],"Authoritative blank environment Name feedback belongs to that field and clears on correction");
  return {rows,jsonRows,failures};
}
