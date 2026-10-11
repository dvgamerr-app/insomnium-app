import assert from "node:assert/strict";

/** @param {string} helper */
export function pluginDomOwnerNativeSource(helper) {
  return `let ownedDialogState={hides:0};exports.templateTags.push({name:'ownednativedialog',run(c){
    const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');let clicks=0;
    button.textContent='Native retained helper';status.setAttribute('role','status');status.textContent='waiting';body.appendChild(button);body.appendChild(status);
    button.addEventListener('click',async function(event){
      const scope=await c.util.render('{{ scope }}');const saved=await c.util.models.request.getById(${JSON.stringify(helper)});
      const response=await c.network.sendRequest(saved,[{name:'payload',value:'from-extra'}]);
      status.textContent=[scope,c.util.models.response.getBodyBuffer(response).toString(),this===button,event.target===button,++clicks].join('|');
    });
    c.app.dialog('Native retained dialog',body,{onHide(){ownedDialogState={hides:ownedDialogState.hides+1,detached:!body.isConnected};}});
    return 'native-dialog-value';
  }},{name:'ownednativedialogstate',run(){return JSON.stringify(ownedDialogState);}},{name:'ownednativedialoghides',run(){return ownedDialogState.hides+':'+ownedDialogState.detached;}});`;
}

/** Same acceptance for the actual HTTP and gRPC Send controllers.
 * @param {{page:import('playwright-core').Page,wire:any[]}} context */
export async function exerciseRetainedNativeDialog({page,wire}) {
  const dialog=page.getByRole("dialog",{name:"Native retained dialog",exact:true});
  await dialog.waitFor();const start=wire.length;
  for(const index of [1,2]) {
    await dialog.getByRole("button",{name:"Native retained helper",exact:true}).click();
    await dialog.getByRole("status").filter({hasText:`base|plugin-render-accepted|true|true|${index}`}).waitFor();
    assert.equal(wire.length,start+index,"Each retained event performs one actual saved-ID HTTP send");
    assert.equal(new URL(wire.at(-1).url).pathname,"/helper");assert.equal(wire.at(-1).body,"from-extra");assert.equal(wire.at(-1).method,"POST");
  }
  await dialog.getByRole("button",{name:"Close plugin dialog",exact:true}).click();await dialog.waitFor({state:"detached"});
  return {callbackRequests:wire.slice(start).map(row=>({url:row.url,method:row.method,body:row.body})),callbacks:2};
}

/** @param {{page:import('playwright-core').Page,wire:any[],output:string,body:(text:string)=>Promise<void>,send:(expected:string|null)=>Promise<void>}} context */
export async function exercisePluginDomOwnerHttpNative({body,send,page,wire,output}) {
  const checks=[];
  await body("{% ownednativedialogstate %}");await send(JSON.stringify({hides:0}));
  const initialHides=JSON.parse(wire.at(-1).body).hides;
  await body("{% ownednativedialog %}");await send("native-dialog-value");const first=await exerciseRetainedNativeDialog({page,wire});
  checks.push("Actual native HTTP Send completes; retained guest callbacks still render the captured environment and perform two native saved-ID child sends");
  await body("{% ownednativedialogstate %}");await send(JSON.stringify({hides:initialHides+1,detached:true}));
  checks.push("Actual native Close detaches the original node and completes guest onHide exactly once before another tag reads its state");
  await body("{% ownednativedialog %}");await send("native-dialog-value");const second=await exerciseRetainedNativeDialog({page,wire});
  await body("{% ownednativedialogstate %}");await send(JSON.stringify({hides:initialHides+2,detached:true}));
  checks.push("Another real native Send opens a fresh usable dialog without Load and closes with one additional guest onHide");
  const evidence={status:"passed",checks,initialHides,first,second,limits:"HTTP tests use the fresh VM after OAuth cancellation recovery; terminal ordered onHide, nested response-tag and stream lifetimes remain separate gates."};
  await Bun.write(output+"/dom-owner-http-acceptance.json",JSON.stringify(evidence,null,2));return evidence;
}
