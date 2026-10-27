import assert from 'node:assert/strict';
import {withNativeApp,poll,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {withResourceProbePreserved,registerResourceProbeCollection,resourceSaved} from './helpers/resource-manager-cases.js';
import {newRequest,id} from '../../src/lib/model.js';

assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Explicit current native build required');
const proto = `syntax = "proto3";
import "extensions.proto";
package savedexample;
message Child { bytes payload = 1; float amount = 2; }
enum Choice { ZERO = 0; ONE = 1; }
message Input {
  string title = 1;
  bytes payload = 2;
  map<string,int32> labels = 3;
  repeated bytes chunks = 4;
  Child child = 5;
  map<string,Child> children = 6;
  map<int64,int32> longLabels = 7;
  ExtensionValues extensionValues = 8;
  float amount = 9;
  int64 wide = 10;
  Choice choice = 11;
  repeated float amounts = 12;
  map<string,float> rates = 13;
}
service Examples { rpc Call(Input) returns (Input); }`;
const extensions = `syntax = "proto2";
package savedexample;
message ExtensionValues { optional string note = 1; extensions 100 to 199; }
message ExtensionChild { optional bytes payload = 1; }
extend ExtensionValues {
  optional bytes extension_payload = 100 [default = "AB"];
  repeated ExtensionChild extension_children = 101;
  optional int64 extension_count = 102;
}`;

await preserveNativeProfile(()=>withResourceProbePreserved(async()=>{
  await withNativeApp('grpc-saved-examples',async({page,invoke,output})=>{
    const original=await invoke('load_workspace');
    const workspaceId=id('wrk'),protoId=id('pf'),extensionProtoId=id('pf'),name='Owned saved proto examples';
    registerResourceProbeCollection(workspaceId,name);
    const checks=[];
    if(process.env.INSOMNIUM_GRPC_SCHEMA_CACHE_NATIVE==='1'){
      const requests=['A','B','C','D'].map(letter=>newRequest(workspaceId,{_type:'grpc_request',name:'Schema cache '+letter,
        url:'grpc://127.0.0.1:1',protoFileId:protoId,protoMethodName:'/savedexample.Examples/Call',
        metadata:[],body:{text:'{}'}}));
      const data=structuredClone(original);
      data.resources.push({_id:workspaceId,_type:'workspace',parentId:null,name,scope:'collection'},
        {_id:protoId,_type:'proto_file',parentId:workspaceId,name:'example.proto',protoText:proto},
        {_id:extensionProtoId,_type:'proto_file',parentId:workspaceId,name:'extensions.proto',protoText:extensions},...requests);
      Object.assign(data,{activeWorkspaceId:workspaceId,activeRequestId:requests[0]._id,activeEnvironmentId:'',openTabs:requests.map(request=>request._id)});
      await invoke('save_workspace',{data});
      const commands=/** @type {string[]} */([]);
      page.on('request',request=>{const url=new URL(request.url());if(url.hostname==='ipc.localhost')commands.push(decodeURIComponent(url.pathname.slice(1)));});
      const select=async(/** @type {string} */letter)=>{
        await page.locator('.tree-request').filter({hasText:'Schema cache '+letter}).click();
        return page.getByLabel('gRPC method',{exact:true});
      };
      const base=Date.parse('2026-10-26T00:00:00Z');
      for(const test of [
        {name:'same-time reload refreshes age',loads:['A','B','C','A','D'],times:[0,0,0,0,0],kept:['A','C','D']},
        {name:'backward clock preserves load order',loads:['A','B','C','D'],times:[4000,3000,2000,1000],kept:['B','C','D']},
      ]){
        await page.reload();
        await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();
        for(const letter of ['A','B','C','D'])assert.equal(await(await select(letter)).isEnabled(),false,'Reload leaves schemas unloaded');
        for(const [index,letter]of test.loads.entries()){
          await page.clock.setFixedTime(new Date(base+test.times[index]));
          const method=await select(letter),count=commands.filter(command=>command==='load_grpc_schema').length;
          await resourceSaved(page);
          const beforeLoad=await invoke('load_workspace');
          await page.getByRole('button',{name:'Load methods',exact:true}).click();
          await poll(async()=>commands.filter(command=>command==='load_grpc_schema').length===count+1,'Actual native proto compilation admitted');
          await poll(()=>page.getByRole('button',{name:'Load methods',exact:true}).isEnabled(),'Actual method load retires');
          assert.equal(await method.isEnabled(),true);
          assert.equal(await page.getByRole('button',{name:'Use example',exact:true}).isEnabled(),true);
          await resourceSaved(page);
          const afterLoad=await invoke('load_workspace');
          assert.deepEqual(afterLoad.resources,beforeLoad.resources,'Loading methods never changes resources, including current navigation metadata');
          assert.deepEqual(afterLoad.history,beforeLoad.history);
        }
        for(const letter of ['A','B','C','D'])assert.equal(await(await select(letter)).isEnabled(),test.kept.includes(letter),test.name+': '+letter);
        const saved=await invoke('load_workspace');
        for(const resource of data.resources)assert.deepEqual(saved.resources.find((/** @type {any} */ row)=>row._id===resource._id),resource);
        assert.deepEqual(saved.history,original.history);
        checks.push({name:test.name,kept:test.kept,loads:test.loads.length,authoredResourcesAndHistoryUnchanged:true,fullResourcesUnchangedAcrossEachLoad:true});
      }
      assert.equal(commands.filter(command=>command==='load_grpc_schema').length,9);
      assert.equal(commands.filter(command=>command==='connect_grpc').length,0);
      await Bun.write(output+'/acceptance.json',JSON.stringify({status:'passed',renderingMode:'native-hidden',
        scope:'Actual native local proto schema compilation/cache UI, controlled WebView Date; no RPC/reflection-provider or OS-clock claim',checks,commands},null,2));
      return;
    }
    for(const mode of ['legacy','protoJson']){
      const request=newRequest(workspaceId,{_type:'grpc_request',name:'Saved example '+mode,
        url:'grpc://127.0.0.1:1',protoFileId:protoId,protoMethodName:'/savedexample.Examples/Call',
        grpcJsonMode:mode,metadata:[],body:{text:'{}'}});
      const data=structuredClone(original);
      data.resources.push({_id:workspaceId,_type:'workspace',parentId:null,name,scope:'collection'},
        {_id:protoId,_type:'proto_file',parentId:workspaceId,name:'example.proto',protoText:proto},
        {_id:extensionProtoId,_type:'proto_file',parentId:workspaceId,name:'extensions.proto',protoText:extensions},request);
      Object.assign(data,{activeWorkspaceId:workspaceId,activeRequestId:request._id,
        activeEnvironmentId:'',openTabs:[request._id]});
      data.settings.useCookies=false;
      await invoke('save_workspace',{data});
      await page.reload();
      const persisted=async()=>(await invoke('load_workspace')).resources.find(
        (/** @type {any} */ resource)=>resource._id===request._id).body.text;
      await page.getByRole('button',{name:'Load methods',exact:true}).click();
      const use=page.getByRole('button',{name:'Use example',exact:true});
      await poll(()=>use.isEnabled(),'Saved proto example ready');
      assert.equal(await persisted(),'{}','Loading methods must preserve authored body');
      await use.click();
      await poll(async()=>await persisted()!=='{}','Example persisted');
      const bytes=mode==='legacy'?[161,178,195]:'obLD';
      const expected={title:'Hello',payload:bytes,labels:{Hello:10},chunks:[bytes],
        child:{payload:bytes,amount:1.1},children:{Hello:{payload:bytes,amount:1.1}},longLabels:{20:10},
        amount:1.1,wide:mode==='legacy'?20:'20',choice:mode==='legacy'?0:'ZERO',amounts:[1.1],rates:{Hello:1.1},
        extensionValues:{note:'Hello',
          [mode==='legacy'?'.savedexample.extension_payload':'[savedexample.extension_payload]']:bytes,
          [mode==='legacy'?'.savedexample.extension_children':'[savedexample.extension_children]']:[{payload:bytes}],
          [mode==='legacy'?'.savedexample.extension_count':'[savedexample.extension_count]']:mode==='legacy'?20:'20'}};
      assert.deepEqual(JSON.parse(await persisted()),expected);
      await page.reload();
      await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();
      assert.deepEqual(JSON.parse(await persisted()),expected);
      checks.push({mode,explicitBodyReplacement:true,nestedAndRepeatedAndMapBytes:true,proto2ExtensionExamples:true,authoredNumericExamples:true,reload:true});
    }
    await Bun.write(output+'/acceptance.json',JSON.stringify({status:'passed',
      scope:'Actual saved proto compilation, Use example and persistence; no Send or wire claim',checks},null,2));
  });
},{expectedIdentifier:integrationProbeIdentifier}));
