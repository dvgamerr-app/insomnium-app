import {readSync,writeSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectPluginMetadata} from '../../src/lib/plugin-metadata.js';
import {createPluginTagMetadata} from '../../src/lib/plugin-tag-metadata.js';
import {createPluginValueCodec} from '../../src/lib/plugin-values.js';
import {runPluginSession} from './session.js';
import './dom.js';

const send=process.stdout.write.bind(process.stdout),exit=process.exit.bind(process),stringify=JSON.stringify.bind(JSON),codec=createPluginValueCodec(),tags=createPluginTagMetadata();
let jobId='';
try{
 const bytes=[],byte=Buffer.alloc(1);while(readSync(0,byte,0,1,null)&&byte[0]!==10){if(bytes.length>=16384)throw Error('Plugin inspection envelope exceeds its limit');bytes.push(byte[0]);}const input=JSON.parse(Buffer.from(bytes).toString('utf8'));
 if(input?.protocol!==1||typeof input.jobId!=='string'||input.jobId.length>64||typeof input.name!=='string'||input.name.length>256||typeof input.entry!=='string'||!['commonjs','module'].includes(input.format)||!input.entry.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[\\:]/.test(part)))throw Error('Invalid plugin inspection envelope');
 jobId=input.jobId;
 const log=process.stderr.write.bind(process.stderr);for(const key of ['log','info','warn','error','debug'])console[key]=(...values)=>log(values.map(String).join(' ').slice(0,8192)+'\n');
 const path=resolve('package',input.entry),exports=input.format==='commonjs'?require(path):await import(pathToFileURL(path).href);
 const wire=codec.encode({name:input.name,...inspectPluginMetadata(exports,tags)});if(wire.length>256*1024)throw Error('Plugin metadata exceeds the 256 KiB limit');
 if(input.mode==='session'){
  const packet=value=>{const bytes=Buffer.from(stringify(value)+'\n');let offset=0;while(offset<bytes.length){const written=writeSync(1,bytes,offset,bytes.length-offset);if(!written)throw Error('Bun output closed');offset+=written;}};
  runPluginSession(exports,packet,exit,input.syncHandle);
  packet({type:'metadata',protocol:1,jobId,wire});
 }else send(stringify({type:'metadata',protocol:1,jobId,wire}),()=>exit(0));
}catch(error){send(stringify({type:'error',protocol:1,jobId,error:String(error).slice(0,8192)}),()=>exit(1));}
