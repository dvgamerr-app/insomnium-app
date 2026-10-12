import assert from "node:assert/strict";

/** Fixture composition only; original production KeyValue remains unchanged.
 * @param {import('playwright-core').Page} page @param {string} output */
export async function measureMultipartComposition(page,output){
  const region=page.getByRole("region",{name:"Multipart file ownership probe",exact:true});
  const rows=/** @type {Record<string,any>[]} */([]),failures=/** @type {Record<string,any>[]} */([]);
  const reset=()=>region.getByRole("button",{name:"Reset owned multipart files",exact:true}).click();
  const snapshot=async()=>JSON.parse(/** @type {string} */(await region.locator("output[data-file-probe]").getAttribute("data-file-probe")));
  const geometry=()=>region.locator(".kv-row").evaluateAll(elements=>elements.map(row=>{
    const box=(/** @type {Element} */el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor};};
    return {row:box(row),file:box(/** @type {Element} */(row.querySelector(".ui-file-picker"))),name:box(/** @type {Element} */(row.querySelector(':scope > .ui-input'))),type:box(/** @type {Element} */(row.querySelector(".ui-select"))),remove:box(/** @type {Element} */(row.querySelector(":scope > button")))};
  }));
  for(const theme of ["dark","light"])for(const width of [1440,900,760]){
    await page.setViewportSize({width,height:600});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await reset();await region.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
    const original=await geometry();
    await region.getByRole("button",{name:"Toggle owned file composition",exact:true}).click();
    await region.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
    const composed=await geometry();
    const normalize=(/** @type {Record<string,any>[]} */ values)=>values.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,{...value,x:value.x-row.row.x,y:value.y-row.row.y}])));
    const a=normalize(original),b=normalize(composed);
    if(JSON.stringify(a)!==JSON.stringify(b))failures.push({kind:"valid-composition-geometry",theme,width,original:a,composed:b});
    assert.equal(await region.locator("label label").count(),0,"No nested labels");
    for(let i=1;i<=2;i++)assert.equal(await region.getByRole("button",{name:"File value "+i,exact:true}).count(),1);
    const ids=await region.locator('input[type="file"]').evaluateAll(els=>els.map(el=>el.id));assert.notEqual(ids[0],ids[1]);
    const before=await snapshot(),file=region.getByLabel("File value 2",{exact:true});
    await file.setInputFiles({name:"limit.bin",mimeType:"application/octet-stream",buffer:Buffer.alloc(20*1024*1024+1,65)});
    await region.getByRole("alert").filter({hasText:"20 MiB"}).waitFor();
    assert.deepEqual(await snapshot(),before);
    assert.equal(await file.getAttribute("aria-invalid"),"true");assert.equal(await file.getAttribute("aria-describedby"),ids[1]+"-error");
    assert.equal(await region.locator(".kv-row").nth(1).getByRole("combobox",{name:"Field type",exact:true}).getAttribute("aria-invalid"),null,"Sibling type is outside error context");
    const error=await geometry();
    const feedback=await region.getByRole("alert").evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scroll:el.scrollWidth,client:el.clientWidth,text:el.textContent};});
    for(const key of /** @type {const} */(["file","type"])){if(error[1][key].width!==composed[1][key].width||error[1][key].height!==composed[1][key].height)failures.push({kind:"error-control-resize",theme,width,key,before:composed[1][key],after:error[1][key]});}
    if(feedback.x<error[1].row.x||feedback.x+feedback.width>error[1].row.x+error[1].row.width||feedback.scroll>feedback.client+1)failures.push({kind:"error-bounds",theme,width,feedback});
    const payload={name:"same.txt",mimeType:"text/plain",buffer:Buffer.from([0,65,255])};
    await region.getByLabel("File value 1",{exact:true}).setInputFiles(payload);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").calls===1);
    assert.equal(await file.getAttribute("aria-invalid"),"true","Experimental other-row success retains owned error");
    await file.setInputFiles(payload);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-file-probe]')?.getAttribute("data-file-probe")||"{}").calls===2);
    assert.equal(await region.getByRole("alert").count(),0);
    const accepted=await snapshot();assert.equal(accepted.rows[0].base64,"AEH/");assert.equal(accepted.rows[1].base64,"AEH/");
    assert.deepEqual(await region.locator(".ui-file-picker").evaluateAll(els=>els.map(el=>el.childNodes[0]?.textContent?.trim())),["same.txt","same.txt"],"Visible filenames unchanged");
    rows.push({theme,width,original,composed,error,feedback,ids,accepted});
    await region.getByRole("button",{name:"Toggle owned file composition",exact:true}).click();
  }
  await reset();await Bun.write(output+"/multipart-composition-measurements.json",JSON.stringify({native:false,experimentalOnly:true,rows,failures},null,2));
  return failures;
}
