import assert from "node:assert/strict";
import {poll} from "./native-app.js";
import {exerciseRetainedNativeDialog} from "./plugin-dom-owner-native.js";

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string,body:(text:string)=>Promise<void>,send:(expected:string|null)=>Promise<void>,wire:any[],requestId:string,childId:string,baseUrl:string,releaseHeld:()=>void}} context */
export async function exercisePluginDomNestedOwnerNative({page,invoke,output,body,send,wire,requestId,childId,baseUrl,releaseHeld}) {
  const checks=[],observations=/** @type {any[]} */([]),dialog=()=>page.getByRole("dialog",{name:"Native retained dialog",exact:true});
  const response=`{% response 'url', '${childId}', '', 'always', 0 %}`;
  const saved=(/** @type {string} */ id)=>invoke("load_workspace").then(data=>data.resources.find((/** @type {any} */ row)=>row._id===id));
  const edit=(/** @type {string} */ text,/** @type {string} */ id)=>page.locator(".request-editor .CodeMirror").first().evaluate((element,text)=>/** @type {any} */(element).CodeMirror.setValue(text),text)
    .then(()=>poll(async()=>(await saved(id)).body.text===text,"Actual saved native body edit"));
  // Earlier owner-loss acceptance intentionally leaves the root URL edited.
  await page.getByRole("textbox",{name:"Request URL",exact:true}).fill(baseUrl+"/render");
  await poll(async()=>(await saved(requestId)).url===baseUrl+"/render","Nested fixture root URL initialized");
  const start=async(/** @type {boolean} */ hold=false)=>{
    await body(response);
    if(hold){await page.getByRole("textbox",{name:"Request URL",exact:true}).fill(baseUrl+"/dom-owner-held");await poll(async()=>(await saved(requestId)).url===baseUrl+"/dom-owner-held","Held native root URL saved");}
    const before=wire.length;await page.getByRole("button",{name:"Send",exact:true}).click();
    await poll(async()=>wire.length===before+2,"Actual response dependency and root native HTTP requests");
    assert.equal(new URL(wire[before].url).pathname,"/dialog-child");assert.equal(wire[before].body,"native-dialog-value");
    assert.equal(wire[before+1].body,baseUrl+"/dialog-child");
    assert.equal(new URL(wire[before+1].url).pathname,hold?"/dom-owner-held":"/render");
    if(!hold)await page.getByRole("button",{name:"Send",exact:true}).waitFor();
    await dialog().waitFor();observations.push({hold,requests:wire.slice(before).map(row=>({url:row.url,body:row.body,method:row.method}))});
  };
  await start();const callbacks=await exerciseRetainedNativeDialog({page,wire});
  await body("{% ownednativedialogstate %}");await send(JSON.stringify({hides:3,detached:true}));
  checks.push("Actual native builtin response sends a dependent request; completed root/child render and HTTP retain usable guest environment/model/native child-send callbacks and one normal detached onHide");
  await start();await edit("root source changed",requestId);await dialog().waitFor({state:"detached"});
  checks.push("Actual native root body edit revokes the completed dependent dialog while idle, without another guest callback");
  await start();
  await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"POST Dialog dependent request",exact:true}).evaluate(element=>/** @type {HTMLButtonElement} */(element).click());
  await dialog().waitFor();
  await page.getByRole("tab",{name:"Body",exact:true}).evaluate(element=>/** @type {HTMLButtonElement} */(element).click());
  await dialog().waitFor();
  await edit("dependent source changed",childId);await dialog().waitFor({state:"detached"});
  await edit("{% ownednativedialog %}",childId);
  await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"POST Plugin render request",exact:true}).click();
  checks.push("Actual native dependent request body edit revokes its idle dialog independently of the root source; saved UI edits restore the child fixture");
  await start(true);const beforeCancel=wire.length;
  await page.locator(".send-button").filter({hasText:"Cancel"}).evaluate(element=>/** @type {HTMLButtonElement} */(element).click());
  await dialog().waitFor({state:"detached"});await page.getByRole("button",{name:"Send",exact:true}).waitFor();
  await page.getByText("Request failed",{exact:true}).waitFor();releaseHeld();await page.waitForTimeout(750);
  assert.equal(wire.length,beforeCancel);assert.equal(await dialog().count(),0);await page.getByText("Request failed",{exact:true}).waitFor();
  checks.push("Programmatic actual native root Cancel revokes completed response-dependency dialog descendants; a deliberately released late server response stays suppressed for750ms with no guest/helper wire");
  await page.getByRole("textbox",{name:"Request URL",exact:true}).fill(baseUrl+"/render");await poll(async()=>(await saved(requestId)).url===baseUrl+"/render","Original root fixture URL restored");
  const evidence={status:"passed",checks,observations,callbacks,lateSuppression:{stableForMs:750,noAdditionalWire:true,noDialog:true},cancellationMethod:"Programmatic real Cancel handler because owned dialog blocks pointer input",limits:"HTTP builtin response dependency with actual native Send/persistence/Cancel and normal onHide; terminal ordered onHide and stream lifetimes remain open."};
  await Bun.write(output+"/dom-nested-owner-acceptance.json",JSON.stringify(evidence,null,2));return evidence;
}
