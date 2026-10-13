import assert from "node:assert/strict";

/** Actual pending inputs and model refusal; no validation shim.
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
  async function refuse(/** @type {string} */ message,count=1){await panel.getByRole("button",{name:"Import 2 files",exact:true}).click();await alert().first().waitFor();assert.deepEqual(await alert().allTextContents(),Array(count).fill(message));}
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
  before=await preview();await field(1).fill("same.proto");await field(2).fill("same.proto");await refuse("Error: Invalid or duplicate proto filename: same.proto",2);await unchanged(before);
  const duplicates=[await association(1),await association(2)];need(duplicates.every((/** @type {any} */ row)=>!!row.id&&row.invalid==="true"&&!!row.description)&&duplicates[0].id!==duplicates[1].id,"duplicate-path-associations",duplicates);
  assert.notEqual(duplicates[0].description,duplicates[1].description);
  for(const row of duplicates){assert.equal(row.description,row.id+"-error");assert.equal(row.descriptionText,"Error: Invalid or duplicate proto filename: same.proto");}
  await field(2).fill("different.proto");const duplicateNotice=await alert().allTextContents();need(duplicateNotice.length===0,"resolved-duplicate-stale-feedback",{duplicateNotice,current:[await association(1),await association(2)]});await unchanged(before);
  await record({theme,width,kind:"pending-duplicate-owner-correction",duplicates,duplicateNotice,noSave:true});
  // A real context refusal must remain global even when valid names are edited.
  await preview();await page.evaluate(async()=>{await /** @type {any} */(window).__protoMeasurement.replaceData();});before=await snap();await refuse("Error: Workspace or request changed. Select the proto files again.");
  await field(1).fill("valid-context-edit.proto");assert.equal(await alert().innerText(),"Error: Workspace or request changed. Select the proto files again.");
  const context=[await association(1),await association(2)];assert.ok(context.every((/** @type {any} */ row)=>row.invalid===null&&row.description===null));await unchanged(before);
  await record({theme,width,kind:"pending-context-global-not-field",context,message:await alert().innerText(),noSave:true});
  before=await preview();await field(2).fill("../later.proto");await refuse("Error: Invalid or duplicate proto filename: ../later.proto");
  await field(1).fill("../earlier.proto");assert.equal(await alert().count(),0,"Earlier changed authority retires old owner without publishing an unsubmitted error");assert.equal((await association(1)).invalid,null);assert.equal((await association(2)).invalid,null);await unchanged(before);
  await record({theme,width,kind:"pending-earlier-failure-retires-owner",noAutoPublish:true,noSave:true});
  before=await preview();await field(1).fill("../bad.proto");await refuse("Error: Invalid or duplicate proto filename: ../bad.proto");
  const filename=panel.getByRole("textbox",{name:"Proto filename",exact:true});await filename.fill("invalid/name.proto");await filename.press("Tab");
  assert.equal(await alert().count(),2);const globalMessage="Error: Enter a .proto filename without directory separators.";assert.ok((await alert().allTextContents()).includes(globalMessage));
  await field(1).fill("corrected.proto");assert.deepEqual(await alert().allTextContents(),[globalMessage]);assert.equal((await association(1)).invalid,null);await unchanged(before);
  await record({theme,width,kind:"pending-correction-preserves-unrelated-global",globalMessage,noSave:true});
  for(const retirement of ["data","request","tab","selection"]){
    before=await preview();await field(1).fill("../retired.proto");await refuse("Error: Invalid or duplicate proto filename: ../retired.proto");
    await page.evaluate(async (/** @type {string} */ retirement)=>{const host=/** @type {any} */(window);if(retirement==="data")await host.__protoMeasurement.replaceData();else if(retirement==="request"){await host.__protoMeasurement.select("req_proto_measure_b");await host.__protoMeasurement.switchTab(true);}else if(retirement==="tab"){await host.__protoMeasurement.switchTab(false);await host.__protoMeasurement.switchTab(true);}},retirement);
    if(retirement==="selection"){await picker().setInputFiles({name:"fresh.proto",mimeType:"text/plain",buffer:Buffer.from(source)});await field(1).waitFor();assert.equal(await field(1).inputValue(),"fresh.proto");}
    assert.equal(await alert().count(),0);if(retirement==="data"||retirement==="selection")assert.equal((await association(1)).invalid,null);
    const after=await snap();assert.deepEqual(after.data.resources,before.data.resources);assert.deepEqual(after.data.history,before.data.history);
    await record({theme,width,kind:"pending-owner-retired",retirement,resourcesUnchanged:true});
  }
  before=await preview();const longName="../"+"a".repeat(900)+".proto";await field(1).fill(longName);await refuse("Error: Invalid or duplicate proto filename: "+longName);await unchanged(before);
  const bounds=await alert().evaluate((/** @type {HTMLElement} */ el)=>{const r=el.getBoundingClientRect(),parent=el.closest(".preview"),p=parent?.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height,scroll:el.scrollWidth,client:el.clientWidth,parent:p&&{x:p.x,right:p.right,width:p.width},wrap:getComputedStyle(el).overflowWrap};});
  await record({theme,width,kind:"pending-long-error-bounds",bounds,noSave:true});
  assert.ok(bounds.parent&&bounds.x>=bounds.parent.x&&bounds.right<=bounds.parent.right,"Long inline filename error fits its preview");assert.ok(bounds.scroll<=bounds.width,"Long error text does not overflow horizontally");
}
