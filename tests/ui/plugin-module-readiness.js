import assert from 'node:assert/strict';
import {withPreview} from './helpers/preview-app.js';
import {installPluginSessionFixture} from './helpers/plugin-session.js';
const positives=[
 {name:'tla-resolved',format:'module',entry:'entry.mjs',files:{'entry.mjs':`await Promise.resolve();export const templateTags=[{name:'ready',run(){return 'resolved';}}];`},expected:'resolved'},
 {name:'tla-dependency',format:'module',entry:'entry.mjs',files:{'entry.mjs':`import {value} from './dep.mjs';export const templateTags=[{name:'ready',run(){return value;}}];`,'dep.mjs':`await Promise.resolve().then(()=>Promise.resolve());export const value='dependency';`},expected:'dependency'},
 {name:'tla-init-chain',format:'module',entry:'entry.mjs',files:{'entry.mjs':`let value='initial';await Promise.resolve();Promise.resolve().then(()=>Promise.resolve().then(()=>value='queue-idle'));export const templateTags=[{name:'ready',run(){return value;}}];`},expected:'queue-idle'},
 {name:'esm-interop',format:'module',entry:'entry.mjs',files:{'entry.mjs':`import data from './data.json';import dep from './dep.cjs';await Promise.resolve();export const templateTags=[{name:data.name,run(){return dep.value;}}];`,'data.json':'{"name":"ready"}','dep.cjs':`exports.value='interop';`},expected:'interop'},
 {name:'cjs-original',format:'commonjs',entry:'entry.cjs',files:{'entry.cjs':`exports.initialized=true;exports.templateTags=[{name:'ready',run(){return require('./peer').value;}}];require('./peer');`,'peer.js':`if(!require('./entry.cjs').initialized)throw Error('Cycle failed');exports.value='cycle';`},expected:'cycle'},
 {name:'esm-init-privacy',format:'module',entry:'entry.mjs',files:{'entry.mjs':`const failures=[];await Promise.resolve();for(const run of [()=>document.createElement('div'),()=>__pluginContext.app.getInfo(),()=>__pluginStoreCall('x')]){try{run();throw Error('LEAK');}catch(e){failures.push(e.message);}}export const templateTags=[{name:'ready',run(){return {failures,host:[typeof fetch,typeof process,typeof __TAURI_INTERNALS__]};}}];`},privacy:true},
];
/** @type {[string,string,RegExp][]} */ const negatives=[
 ['tla-rejected',`await Promise.reject(Error('TLA fixture rejection'));export const templateTags=[];`,/TLA fixture rejection/],
 ['tla-no-ready-job',`await new Promise(()=>{});export const templateTags=[];`,/pending without executable guest jobs/],
 ['tla-cpu',`await Promise.resolve();while(true){};export const templateTags=[];`,/interrupted/],
 ['tla-job-chain-cpu',`const loop=()=>Promise.resolve().then(loop);await loop();export const templateTags=[];`,/interrupted/],
 ['esm-missing',`import 'absent';export const templateTags=[];`,/Unsupported module source/],
 ['esm-outside',`import '../outside.mjs';export const templateTags=[];`,/Unsupported module source/],
 ['esm-builtin',`import 'fs';export const templateTags=[];`,/Unsupported module source/],
 ['esm-syntax',`export const templateTags=[`,/unexpected|expect|token/i],
];
await withPreview('plugin-module-readiness',async(page,output)=>{
 const url=await installPluginSessionFixture(page,output),worker=await page.evaluate(()=>/** @type {any} */(window).__pluginSessionWorkerAsset.sha256),rows=/** @type {any[]} */([]),serviceMessages=/** @type {any[]} */([]),failures=/** @type {any[]} */([]);
 const retired=()=>page.waitForFunction(()=>/** @type {any} */(window).__pluginSessionFixture.records.every((/** @type {any} */ record)=>record.terminated),undefined,{timeout:10000});
 /** @param {string} method @param {any[]} args */
 const call=async(method,args)=>{
  const value=await page.evaluate(({method,args})=>/** @type {any} */(window).__pluginSessionFixture[method](...args),{method,args});
  if(method==="close"||method==="closeAll")await retired();
  return value;
 };
 /** @param {string} method @param {any[]} args */
 async function attempt(method,args){
  const result=await page.evaluate(async({method,args})=>{
   try{return {value:await /** @type {any} */(window).__pluginSessionFixture[method](...args)};}
   catch(error){
    const failure=/** @type {any} */(error);
    return {error:String(error),primaryError:error instanceof Error?error.message:String(error),cleanupError:typeof failure?.cleanupError==="string"?failure.cleanupError.slice(0,8192):undefined};
   }
  },{method,args});
  if(typeof result.error==="string")await retired();
  return result;
 }
 try{
  for(const snapshot of positives){const {expected,privacy,...source}=snapshot,inspection=await call('inspectSnapshot',[source,url]);assert.equal(inspection.contributions.find((/** @type {any} */ x)=>x.kind==='templateTags').count,1);const opened=await call('open',[source,url]);assert.deepEqual(opened.metadata,inspection);const value=await call('invoke',[opened.id,'templateTags',0,[]]);if(privacy){assert.equal(value.failures.length,3);assert.ok(value.failures.every((/** @type {string} */ x)=>!x.includes('LEAK')));assert.deepEqual(value.host,['undefined','undefined','undefined']);}else assert.equal(value,expected);await call('close',[opened.id]);rows.push({name:source.name,inspection,retained:value});}
  for(const [name,source,expected] of negatives){const snapshot={name,format:'module',entry:'entry.mjs',files:{'entry.mjs':source}};for(const method of ['inspectSnapshot','open']){const result=await attempt(method,[snapshot,url]);try{assert.match(result.error??'LEAK',expected);}catch(error){failures.push({name,method,error:String(error),result});}rows.push({name,method,result});await Bun.write(output+'/progress.json',JSON.stringify({rows,failures},null,2));}}
  const busy={name:'retire-module-init',format:'module',entry:'entry.mjs',files:{'entry.mjs':'await Promise.resolve();while(true){};export const templateTags=[];'}};
  for(const [method,mode] of [['inspectSnapshot','abort-init'],['open','abort-init'],['open','replace-init']]){const result=await attempt(method,[busy,url,mode]);assert.match(result.error??'LEAK',/AbortError|cancelled|no longer current/);rows.push({name:mode,method,result});}
  const replacement={...positives[0],name:'fresh-source-after-retirement',files:{'entry.mjs':`await Promise.resolve();export const templateTags=[{name:'ready',run(){return 'fresh-generation';}}];`}};const opened=await call('open',[replacement,url]);assert.equal(await call('invoke',[opened.id,'templateTags',0,[]]),'fresh-generation');await call('close',[opened.id]);rows.push({name:replacement.name,retained:'fresh-generation'});
  await page.waitForFunction(()=>/** @type {any} */(window).__pluginSessionFixture.records.every((/** @type {any} */ x)=>x.terminated));const records=await page.evaluate(()=>/** @type {any} */(window).__pluginSessionFixture.records);for(const record of records)for(const message of record.messages)if(['store','helper','sync','dom-retain'].includes(message.type))serviceMessages.push(message);assert.deepEqual(serviceMessages,[]);
  await Bun.write(output+'/observed.json',JSON.stringify({status:failures.length?'failed':'passed',headless:true,stockEngine:true,checks:rows.length,rows,failures,records,serviceMessages,worker,fullFIFOAccepted:false},null,2));assert.deepEqual(failures,[]);await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:rows.length,worker},null,2));
 }finally{await call('closeAll',[]);}
});
