import assert from 'node:assert/strict';
import {withNativeApp,poll,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {createWebSocketFrameFixture} from './helpers/websocket-frame-fixture.js';

assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
const fixture=createWebSocketFrameFixture();
try {
  await preserveNativeProfile(()=>withNativeApp('websocket-pong-ack',async({page,invoke,output})=>{
    const built=await Bun.build({entrypoints:['tests/ui/fixtures/sse-ack-native-probe.js'],target:'browser',format:'iife'});
    assert.equal(built.success,true,String(built.logs));
    await page.evaluate(await built.outputs[0].text());
    const checks=[];
    for(const end of ['release','cancel']){
      const id='pong_'+crypto.randomUUID().replaceAll('-','');
      const request={id,workspaceId:'owned-pong-ack',method:'GET',url:fixture.target(id),headers:[],
        body:null,bodyBase64:null,multipart:null,timeoutMs:15000,followRedirects:true,
        validateCertificates:true,useCookies:false,sendCookies:false,storeCookies:false,proxy:null};
      const status=()=>page.evaluate(id=>/** @type {any} */(window).__ownedSseAckProbe.status(id),id);
      const record=()=>fixture.records.find(row=>row.token===id);
      try {
        await page.evaluate(request=>/** @type {any} */(window).__ownedSseAckProbe.start(request,true,'websocket'),request);
        await poll(async()=>!!record()?.ready,'Peer upgraded');
        const payload=Buffer.alloc(125,0xa5);
        fixture.send(id,9,payload);
        await poll(async()=>(await status()).packets.some((/** @type {any} */p)=>p.event.format==='ping'),'Ping delivered');
        await poll(async()=>record()?.frames.some(frame=>frame.opcode===10)===true,'Pong before renderer ACK',2000);
        const held=await status();
        assert.equal(held.held,true);assert.deepEqual(held.manualAcks,[]);assert.equal(held.done,false);
        assert.equal(record()?.frames.filter(frame=>frame.opcode===10).length,1);
        assert.equal(record()?.frames.find(frame=>frame.opcode===10)?.base64,payload.toString('base64'));
        if(end==='release'){
          await page.evaluate(id=>/** @type {any} */(window).__ownedSseAckProbe.release(id),id);
          fixture.send(id,8,Buffer.from([3,232]));
        }else {
          await invoke('cancel_http',{id});
          await poll(async()=>record()?.closed===true,'Cancelled peer retires before final ACK');
          await page.evaluate(id=>/** @type {any} */(window).__ownedSseAckProbe.release(id),id);
        }
        await poll(async()=>(await status()).done,'Invocation retires');
        await poll(async()=>record()?.closed===true,'Peer retires');
        assert.deepEqual((await status()).ackErrors,[]);
        checks.push({end,pongBeforeAck:true,exact125Bytes:true,singlePong:true});
      }finally{
        if(!(await status()).done){
          await invoke('cancel_http',{id});
          await page.evaluate(id=>/** @type {any} */(window).__ownedSseAckProbe.release(id),id);
          await poll(async()=>(await status()).done,'Cleanup invocation');
        }
      }
    }
    await Bun.write(output+'/acceptance.json',JSON.stringify({status:'passed',checks,records:fixture.records},null,2));
  }));
}finally{fixture.closeAfterHostExit();}
