import assert from "node:assert/strict";
import {poll} from "./native-app.js";
import {exerciseRetainedNativeDialog} from "./plugin-dom-owner-native.js";
/** @typedef {{record:{url:string,method:string,events:any[]},socket?:Bun.ServerWebSocket<StreamPeer>,controller?:ReadableStreamDefaultController<Uint8Array>,ended:boolean}} StreamPeer */

/** Real local WebSocket/SSE peers; controls only the remote transport. */
export function createPluginDomStreamFixture(){
  const peers=/** @type {any[]} */([]),records=/** @type {any[]} */([]);
  const server=Bun.serve(/** @type {Bun.Serve.Options<StreamPeer>} */({hostname:"127.0.0.1",port:0,
    /** @param {Request} request @param {Bun.Server<StreamPeer>} server */
    fetch(request,server){
      const url=new URL(request.url),record={url:request.url,method:request.method,events:/** @type {any[]} */([])};
      const peer=/** @type {StreamPeer} */({record,ended:false});
      records.push(record);peers.push(peer);
      if(url.pathname==="/websocket")return server.upgrade(request,{data:peer})?undefined:new Response("Upgrade required",{status:400});
      if(url.pathname!=="/sse")return new Response("Not found",{status:404});
      return new Response(new ReadableStream({
        start(controller){peer.controller=controller;record.events.push({kind:"open"});controller.enqueue(new TextEncoder().encode("event: owned\ndata: native-stream-value\n\n"));},
        cancel(){peer.ended=true;record.events.push({kind:"cancelled"});},
      }),{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache"}});
    },
    websocket:{
      /** @param {Bun.ServerWebSocket<StreamPeer>} socket */
      open(socket){const peer=/** @type {any} */(socket.data);peer.socket=socket;peer.record.events.push({kind:"open"});socket.send("native-stream-value");},
      message(socket,message){/** @type {any} */(socket.data).record.events.push({kind:"message",value:String(message)});},
      close(socket,code,reason){const peer=/** @type {any} */(socket.data);peer.ended=true;peer.record.events.push({kind:"closed",code,reason});},
    },
  }));
  const finish=(/** @type {boolean} */ fail=false)=>{
    const peer=peers.at(-1);assert.ok(peer);peer.record.events.push({kind:fail?"server-error":"server-finish",alreadyEnded:peer.ended});
    if(peer.ended)return;
    if(peer.socket){if(fail)peer.socket.terminate();else peer.socket.close(1000,"Native fixture complete");}
    else if(peer.controller){if(fail)peer.controller.error(new Error("Native fixture stream failure"));else peer.controller.close();}
  };
  return {records,url:(/** @type {'websocket'|'sse'} */ protocol)=>`${protocol==="websocket"?"ws":"http"}://127.0.0.1:${server.port}/${protocol}`,finish,
    stop(){for(const peer of peers){if(peer.ended)continue;if(peer.socket)peer.socket.terminate();else try{peer.controller?.close();}catch{}peer.ended=true;}server.stop(true);},
  };
}

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string,wire:any[],fixture:ReturnType<typeof createPluginDomStreamFixture>,ids:Record<string,string>,rootId:string}} context */
export async function exercisePluginDomStreamOwnerNative({page,invoke,output,wire,fixture,ids,rootId}){
  const dialog=()=>page.getByRole("dialog",{name:"Native retained dialog",exact:true}),checks=[],observations=/** @type {any[]} */([]);
  const collection=page.getByRole("complementary",{name:"Collections"});
  const read=(/** @type {string} */ id)=>invoke("load_workspace").then(data=>data.resources.find((/** @type {any} */ row)=>row._id===id));
  const latest=(/** @type {string} */ id)=>invoke("load_workspace").then(data=>data.history.find((/** @type {any} */ row)=>row.requestId===id));
  for(const protocol of /** @type {const} */(["websocket","sse"])){
    const id=ids[protocol],label=protocol==="websocket"?"WS Dialog stream socket":"SSE Dialog event stream";
    await collection.getByRole("button",{name:label,exact:true}).click();
    const start=async(/** @type {string} */ kind)=>{
      const url=fixture.url(protocol)+`?case=${kind}&dialog={% ownednativedialog %}`;
      await page.getByRole("textbox",{name:"Request URL",exact:true}).fill(url);await poll(async()=>(await read(id)).url===url,"Native stream fixture URL persisted");
      const before=fixture.records.length,old=(await latest(id))?._id;
      await page.getByRole("button",{name:/^(Connect|Reconnect)$/}).click();
      await poll(async()=>fixture.records.length===before+1&&fixture.records.at(-1).events.some((/** @type {any} */ event)=>event.kind==="open"),"Actual native stream reaches owned server");
      assert.equal(new URL(fixture.records.at(-1).url).searchParams.get("dialog"),"native-dialog-value");
      await dialog().waitFor();return old;
    };
    const settled=async(/** @type {string|undefined} */ old,/** @type {string} */ state)=>{
      await page.getByRole("button",{name:"Reconnect",exact:true}).waitFor();
      await poll(async()=>{const response=await latest(id);return response?._id!==old&&response?.connectionState===state;},"Actual native stream history persisted");
      return latest(id);
    };
    let old=await start("complete");fixture.finish();const completed=await settled(old,"closed");
    assert.ok(completed.events.some((/** @type {any} */ event)=>event.kind==="closed"));
    assert.ok(completed.events.some((/** @type {any} */ event)=>event.kind===(protocol==="websocket"?"message":"sse")));
    const callbacks=await exerciseRetainedNativeDialog({page,wire});
    checks.push(protocol+": actual native remote completion/history retain genuine guest environment/model/native child-send callbacks after running entry removal");
    old=await start("source");fixture.finish();const source=await settled(old,"closed");await dialog().waitFor();
    const changed=(await read(id)).url+"&changed=1";
    await page.getByRole("textbox",{name:"Request URL",exact:true}).evaluate((element,value)=>{const input=/** @type {HTMLInputElement} */(element);input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));},changed);
    await poll(async()=>(await read(id)).url===changed,"Actual stream source edit persisted");await dialog().waitFor({state:"detached"});
    checks.push(protocol+": actual saved URL source change closes the completed native stream dialog while idle");
    old=await start("cancel");const beforeCancel=wire.length;
    await page.locator(".send-button").filter({hasText:"Disconnect"}).evaluate(element=>/** @type {HTMLButtonElement} */(element).click());
    await dialog().waitFor({state:"detached"});const cancelled=await settled(old,"closed");fixture.finish();await page.waitForTimeout(750);
    assert.equal(wire.length,beforeCancel);assert.equal(await dialog().count(),0);
    checks.push(protocol+": actual Disconnect handler revokes native stream dialog; remote late finish attempt stays suppressed750ms without another guest/helper send");
    old=await start("error");fixture.finish(true);await dialog().waitFor({state:"detached"});const failed=await settled(old,"error");
    assert.ok(failed.events.some((/** @type {any} */ event)=>event.kind==="error"));
    checks.push(protocol+": actual remote transport error revokes its native dialog and persists error history");
    observations.push({protocol,completed,source,cancelled,failed,callbacks,lateSuppression:{stableForMs:750,noAdditionalWire:true,noDialog:true}});
  }
  await collection.getByRole("button",{name:"POST Plugin render request",exact:true}).click();
  assert.equal((await read(rootId))._id,rootId);
  const evidence={status:"passed",checks,observations,wire:fixture.records,cancellationMethod:"Programmatic actual Disconnect handler while owned modal blocks pointer input",limits:"Real native WebSocket/SSE remote completion/source loss/Disconnect/transport error and retained child sends; terminal ordered onHide and pointer Disconnect remain separate gates."};
  await Bun.write(output+"/dom-stream-owner-acceptance.json",JSON.stringify(evidence,null,2));return evidence;
}
