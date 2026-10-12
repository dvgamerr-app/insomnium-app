import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {spectralExternalPaths,spectralFixturePaths,assertSpectralFixturePath,assertSpectralCleanupPath,spectralReferenceFiles,createSpectralReferenceServer} from './helpers/spectral-native-external.js';
const output=join('artifacts/native-external-current-preparation','guards-'+Date.now());await mkdir(output,{recursive:true});
const rows=[];
const guard=(/** @type {string} */name,/** @type {()=>void} */operation)=>{operation();rows.push(name);};
guard('43 exact references/45 total closed paths',()=>{assert.equal(spectralExternalPaths.length,43);assert.equal(spectralFixturePaths.length,45);assert.equal(new Set(spectralFixturePaths).size,45);});
for(const path of spectralFixturePaths)guard('accept '+path,()=>assertSpectralFixturePath(path));
for(const path of ['../a/shared.yaml','a/../b/shared.yaml','a/shared.yaml/extra','A/shared.yaml','design/a/shared.yaml','many/schema-40.yaml','many/schema--1.yaml','.git/config','other/missing-owned-rules.yaml','a\\shared.yaml','/a/shared.yaml','http://127.0.0.1/a/shared.yaml'])guard('refuse '+path,()=>assert.throws(()=>assertSpectralFixturePath(path)));
guard('cleanup traversal refusal',()=>assert.throws(()=>assertSpectralCleanupPath('..\\a\\shared.yaml')));
guard('declared design identity yields actual root names',()=>{assert.equal(new URL('../a/shared.yaml','memory:///design/openapi.yaml').pathname,'/a/shared.yaml');assert.equal(new URL('../nested/value.yaml','memory:///a/shared.yaml').pathname,'/nested/value.yaml');assert.equal(new URL('./many/schema-39.yaml','memory:///openapi.yaml').pathname,'/many/schema-39.yaml');});
guard('fresh byte revisions differ only exact nested file',()=>{const one=spectralReferenceFiles('one'),two=spectralReferenceFiles('two');assert.equal(Object.keys(one).length,43);assert.deepEqual(Object.keys(one).filter(key=>one[key]!==two[key]),['nested/value.yaml']);assert.match(two['nested/value.yaml'],/two😀/);assert.throws(()=>spectralReferenceFiles('foreign'));});
const server=await createSpectralReferenceServer(output);
try{
 for(const name of ['a/shared.yaml','b/shared.yaml','nested/value.yaml']){const response=await fetch(server.origin+'/references/'+name);assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new TextEncoder().encode(spectralReferenceFiles('one')[name]));rows.push('actual owned HTTP '+name);}
 server.setRevision('two');assert.match(await(await fetch(server.origin+'/references/nested/value.yaml')).text(),/two😀/);rows.push('actual fresh HTTP revision');
 for(const path of ['/__case','/__state','/references/many/schema-0.yaml','/references/nested/value.yaml?revision=one']){assert.equal((await fetch(server.origin+path)).status,404);rows.push('HTTP refusal '+path);}
 assert.equal((await fetch(server.origin+'/references/a/shared.yaml',{method:'POST'})).status,404);rows.push('HTTP method refusal');
 assert.equal(server.events.length,4);assert.equal(server.events.at(-1).revision,'two');assert.equal(server.events.at(-1).sha256,createHash('sha256').update(spectralReferenceFiles('two')['nested/value.yaml']).digest('hex'));
}finally{await server.close();}
const baseline=await Bun.file('artifacts/native-external-current-preparation/baseline/tests/ui/helpers/spectral-api-design.js').bytes(),actual=await Bun.file('tests/ui/helpers/spectral-api-design.js').bytes();
assert.deepEqual(actual,baseline,'Root current reviewed merged helper stays byte-exact');
const assertionCalls=(new TextDecoder().decode(actual).match(/assert\.\w+\(/g)||[]).length;assert.equal(assertionCalls,73);rows.push('root current oracle byte-exact / '+assertionCalls+' assertion calls');
await Bun.write(join(output,'result.json'),JSON.stringify({passed:true,rows,assertionCalls,nativeAppLaunched:false,profileTouched:false,repoWrites:false,httpClosed:true},null,2));console.log(JSON.stringify({output,guards:rows.length,assertionCalls,passed:true}));
