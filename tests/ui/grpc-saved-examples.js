import assert from 'node:assert/strict';
import {withNativeApp,poll,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {newRequest,id} from '../../src/lib/model.js';

assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Explicit current native build required');
const proto = `syntax = "proto3";
import "extensions.proto";
package savedexample;
message Child { bytes payload = 1; }
message Input {
  string title = 1;
  bytes payload = 2;
  map<string,int32> labels = 3;
  repeated bytes chunks = 4;
  Child child = 5;
  map<string,Child> children = 6;
  map<int64,int32> longLabels = 7;
  ExtensionValues extensionValues = 8;
}
service Examples { rpc Call(Input) returns (Input); }`;
const extensions = `syntax = "proto2";
package savedexample;
message ExtensionValues { optional string note = 1; extensions 100 to 199; }
message ExtensionChild { optional bytes payload = 1; }
extend ExtensionValues {
  optional bytes extension_payload = 100 [default = "AB"];
  repeated ExtensionChild extension_children = 101;
}`;

await preserveNativeProfile(()=>withResourceProbePreserved(async()=>{
  await withNativeApp('grpc-saved-examples',async({page,invoke,output})=>{
    const original=await invoke('load_workspace');
    const workspaceId=id('wrk'),protoId=id('pf'),extensionProtoId=id('pf'),name='Owned saved proto examples';
    registerResourceProbeCollection(workspaceId,name);
    const checks=[];
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
        child:{payload:bytes},children:{Hello:{payload:bytes}},longLabels:{20:10},
        extensionValues:{note:'Hello',
          [mode==='legacy'?'.savedexample.extension_payload':'[savedexample.extension_payload]']:bytes,
          [mode==='legacy'?'.savedexample.extension_children':'[savedexample.extension_children]']:[{payload:bytes}]}};
      assert.deepEqual(JSON.parse(await persisted()),expected);
      await page.reload();
      await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();
      assert.deepEqual(JSON.parse(await persisted()),expected);
      checks.push({mode,explicitBodyReplacement:true,nestedAndRepeatedAndMapBytes:true,proto2ExtensionExamples:true,reload:true});
    }
    await Bun.write(output+'/acceptance.json',JSON.stringify({status:'passed',
      scope:'Actual saved proto compilation, Use example and persistence; no Send or wire claim',checks},null,2));
  });
},{expectedIdentifier:integrationProbeIdentifier}));
