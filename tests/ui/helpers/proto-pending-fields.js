import assert from "node:assert/strict";

/** Measurement only: actual pending inputs, actual model refusal, no validation shim.
 * @param {any} options */
export async function measureProtoPendingFields({page,panel,picker,reset,snap,record,failures,source,theme,width}) {
  const field=(/** @type {number} */ n)=>panel.getByRole("textbox",{name:`Proto path ${n}`,exact:true});
  const alert=()=>panel.getByRole("alert");
  async function preview(){await reset();await picker().setInputFiles([
    {name:"first.proto",mimeType:"text/plain",buffer:Buffer.from(source)},
    {name:"second.proto",mimeType:"text/plain",buffer:Buffer.from(source)},
  ]);await field(2).waitFor();return snap();}
  async function association(/** @type {number} */ n){return field(n).evaluate((/** @type {HTMLInputElement} */ el)=>{const id=el.id,description=el.getAttribute("aria-describedby"),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {id,name:el.getAttribute("aria-label"),invalid:el.getAttribute("aria-invalid"),description,descriptionText:description?.split(/\s+/).map(value=>document.getElementById(value)?.textContent).join(" ")??null,value:el.value,geometry:{x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor}};});}
  async function unchanged(/** @type {any} */ before){const after=await snap();assert.deepEqual(after.data.resources,before.data.resources);assert.deepEqual(after.data.history,before.data.history);assert.equal(after.persisted,before.persisted);}
  function need(/** @type {boolean} */ accepted,/** @type {string} */ kind,/** @type {any} */ evidence){if(!accepted)failures.push({theme,width,kind,evidence});}
  async function refuse(/** @type {string} */ message){await panel.getByRole("button",{name:"Import 2 files",exact:true}).click();await alert().waitFor();assert.equal(await alert().innerText(),message);}
  let before=await preview();const valid=[await association(1),await association(2)];
  await field(1).fill("../bad-first.proto");await refuse("Error: Invalid or duplicate proto filename: ../bad-first.proto");await unchanged(before);
  const invalid=await association(1),other=await association(2);
  need(!!invalid.id&&invalid.invalid==="true"&&!!invalid.description&&invalid.descriptionText?.includes("../bad-first.proto"),"current-invalid-path-association",invalid);
  assert.equal(other.invalid,null);assert.equal(other.description,null);
  await record({theme,width,kind:"pending-first-invalid-owner",valid,invalid,other,noSave:true});
  await field(2).fill("unrelated-correction.proto");assert.equal(await alert().innerText(),"Error: Invalid or duplicate proto filename: ../bad-first.proto");await unchanged(before);
  await record({theme,width,kind:"pending-unrelated-edit-retains-owner",owner:await association(1),other:await association(2),message:await alert().innerText(),noSave:true});
  await field(1).fill("corrected-first.proto");const remaining=await alert().allTextContents();need(remaining.length===0,"corrected-path-stale-feedback",{remaining,current:await association(1)});await unchanged(before);
  await record({theme,width,kind:"pending-corrected-owner",remaining,current:await association(1),noSave:true});
  // The second failing filename is authoritative only after actual ordered validation.
  before=await preview();await field(2).fill("../bad-second.proto");await refuse("Error: Invalid or duplicate proto filename: ../bad-second.proto");await unchanged(before);
  const second=await association(2);need(!!second.id&&second.invalid==="true"&&!!second.description&&second.descriptionText?.includes("../bad-second.proto"),"second-invalid-path-association",second);
  assert.equal((await association(1)).invalid,null);await record({theme,width,kind:"pending-second-invalid-owner",first:await association(1),second,noSave:true});
  before=await preview();await field(1).fill("same.proto");await field(2).fill("same.proto");await refuse("Error: Invalid or duplicate proto filename: same.proto");await unchanged(before);
  const duplicates=[await association(1),await association(2)];need(duplicates.every((/** @type {any} */ row)=>!!row.id&&row.invalid==="true"&&!!row.description)&&duplicates[0].id!==duplicates[1].id,"duplicate-path-associations",duplicates);
  await field(2).fill("different.proto");const duplicateNotice=await alert().allTextContents();need(duplicateNotice.length===0,"resolved-duplicate-stale-feedback",{duplicateNotice,current:[await association(1),await association(2)]});await unchanged(before);
  await record({theme,width,kind:"pending-duplicate-owner-correction",duplicates,duplicateNotice,noSave:true});
  // A real context refusal must remain global even when valid names are edited.
  await preview();await page.evaluate(async()=>{await /** @type {any} */(window).__protoMeasurement.replaceData();});before=await snap();await refuse("Error: Workspace or request changed. Select the proto files again.");
  await field(1).fill("valid-context-edit.proto");assert.equal(await alert().innerText(),"Error: Workspace or request changed. Select the proto files again.");
  const context=[await association(1),await association(2)];assert.ok(context.every((/** @type {any} */ row)=>row.invalid===null&&row.description===null));await unchanged(before);
  await record({theme,width,kind:"pending-context-global-not-field",context,message:await alert().innerText(),noSave:true});
}
