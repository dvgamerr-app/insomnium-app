import { mount, unmount, tick } from "svelte";
import PluginDomDialogHost from "../../../src/lib/components/PluginDomDialogHost.svelte";
import { createPluginDomDialogEndpoint, closePluginDomDialog, pluginDomDialog } from "../../../src/lib/plugin-dom-dialog.js";
import { get } from "svelte/store";
import "../../../src/lib/styles.css";
const target=document.body.appendChild(document.createElement("div"));
let host=mount(PluginDomDialogHost,{target});
const rows=/** @type {Record<string,any>} */({});
const events=/** @type {any[]} */([]),errors=/** @type {string[]} */([]);
/** @param {string} name @param {any} options @param {'preview'|'send'|'action'} purpose */
function show(name,options={},purpose="send") {
  const controller=new AbortController(),body=document.createElement("div");
  const row=/** @type {any} */({controller,body,current:true,hides:0,clicks:0,inputs:0});
  rows[name]=row;
  const button=body.appendChild(document.createElement("button"));button.textContent="Owned DOM event";
  button.addEventListener("click",()=>{row.clicks++;});
  const input=body.appendChild(document.createElement("input"));input.setAttribute("aria-label","Owned DOM text");
  input.addEventListener("input",()=>{row.inputs++;});
  const endpoint=createPluginDomDialogEndpoint({purpose,signal:controller.signal,current:()=>{
    if(row.throwCurrent)throw Error("owned mount owner failure");
    return row.current;
  },onError:error=>errors.push(String(error))});
  row.endpoint=endpoint;
  const returned=endpoint.dialog(name,body,{tall:!!options.tall,skinny:!!options.skinny,wide:!!options.wide,onHide:()=>{
    row.hides++;events.push({name,detached:!body.isConnected,hides:row.hides});
    if(options.reenter)show("reentrant");
    if(options.throwOnHide)throw Error("owned onHide failure");
  }});
  row.throwCurrent=!!options.mountFailure;
  return {returnsVoid:returned===undefined,connected:body.isConnected};
}
/** @type {any} */(window).__pluginDomDialog={
  show,events,errors,
  snapshot(/** @type {string} */ name){const row=rows[name];return {connected:row.body.isConnected,clicks:row.clicks,inputs:row.inputs,hides:row.hides,sameNode:get(pluginDomDialog)?.body===row.body,id:get(pluginDomDialog)?.id};},
  mutate(/** @type {string} */ name){const element=rows[name].body.appendChild(document.createElement("span"));element.textContent="Owned live mutation";},
  abort(/** @type {string} */ name){rows[name].controller.abort();},
  ownerLoss(/** @type {string} */ name){rows[name].current=false;},
  close:closePluginDomDialog,
  reuse(/** @type {string} */ name){rows[name].endpoint.dialog("reused",rows[name].body,{onHide:()=>{rows[name].hides++;events.push({name:"reused",detached:!rows[name].body.isConnected});}});},
  invalid(/** @type {string} */ name){const endpoint=rows[name].endpoint;const denied=[];for(const call of [()=>endpoint.dialog("wrong", "html"),()=>endpoint.dialog("wrong",document.createElement("div"),{wide:"yes"}),()=>endpoint.dialog("wrong",document.createElement("div"),{onHide:42})]){try{call();denied.push("leaked");}catch(error){denied.push(String(error));}}return denied;},
  async destroy(){await unmount(host);await tick();},
};
