import assert from "node:assert/strict";
import {validateProtoFiles,protoFilenameIssue,protoFileLimit} from "../../../src/lib/grpc-model.js";

/** Saved pure authority/ordering checks, using the actual application validator. */
export function assertProtoFilenameGuards(){
  const rows=[];const file=(name="valid.proto",text="")=>({name,text});
  /** @param {string} name @param {{name:string,text:string}[]} files @param {string} message @param {any} issue */
  function refusal(name,files,message,issue){let caught;try{validateProtoFiles(files);}catch(error){caught=error;}assert.ok(caught instanceof Error);assert.equal(String(caught),"Error: "+message);assert.deepEqual(protoFilenameIssue(caught),issue);rows.push({name,message,issue});return caught;}
  for(const error of [null,undefined,"Invalid or duplicate proto filename: x",new Error("Invalid or duplicate proto filename: x"),{kind:"invalid-name",rows:[0]},Object.assign(new Error("lookalike"),{protoFilename:{kind:"invalid-name",rows:[0]}})]){assert.equal(protoFilenameIssue(error),null);rows.push({name:"unbranded-lookup",accepted:false});}
  refusal("empty-count",[],"Select between 1 and 256 proto files.",null);
  refusal("count-before-invalid",Array.from({length:257},()=>file("../bad.proto")),"Select between 1 and 256 proto files.",null);
  refusal("size-before-later-duplicate",[file("same.proto","x".repeat(protoFileLimit+1)),file("same.proto")],"Proto sources exceed 2 MiB per file or 8 MiB combined.",null);
  refusal("aggregate-before-later-duplicate",[...Array.from({length:4},(_,i)=>file(i+".proto","x".repeat(protoFileLimit))),file("extra.proto","x"),file("extra.proto")],"Proto sources exceed 2 MiB per file or 8 MiB combined.",null);
  const invalid=refusal("invalid-before-size",[file("../bad.proto","x".repeat(protoFileLimit+1))],"Invalid or duplicate proto filename: ../bad.proto",{kind:"invalid-name",name:"../bad.proto",rows:[0]});
  const duplicate=refusal("exact-duplicate-pair",[file("other.proto"),file("same.proto"),file("same.proto")],"Invalid or duplicate proto filename: same.proto",{kind:"duplicate-name",name:"same.proto",rows:[1,2]});
  const issue=protoFilenameIssue(duplicate);assert.ok(issue&&Object.isFrozen(issue)&&Object.isFrozen(issue.rows));assert.equal(Reflect.set(issue.rows,"2",3),false);assert.equal(Reflect.set(issue,"name","changed"),false);assert.equal(protoFilenameIssue(new Error(invalid.message)),null);rows.push({name:"immutable-identity-brand",pass:true});
  refusal("collision-stays-global",[file("same.proto"),file("same.proto/nested.proto")],"File/directory collision: same.proto/nested.proto",null);
  validateProtoFiles([file("utf8.proto","é".repeat(protoFileLimit/2))]);rows.push({name:"utf8-exact-limit",pass:true});
  refusal("utf8-byte-over-limit",[file("utf8.proto","é".repeat(protoFileLimit/2)+"x")],"Proto sources exceed 2 MiB per file or 8 MiB combined.",null);
  return rows;
}
