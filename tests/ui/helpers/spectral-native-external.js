import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {join,sep} from 'node:path';

/** Explicit filesystem names derive from memory:///design/openapi.yaml + ../ refs,
 * and memory:///openapi.yaml + ./many refs. No URL basename flattening. */
export const spectralExternalPaths=Object.freeze(['a/shared.yaml','b/shared.yaml','nested/value.yaml',...Array.from({length:40},(_,i)=>`many/schema-${i}.yaml`)]);
export const spectralFixturePaths=Object.freeze(['other/.spectral.yaml','other/functions/pause.js',...spectralExternalPaths]);
export const spectralFixtureDirectories=Object.freeze(['a','b','nested','many']);
/** @param {string} path */
export function assertSpectralFixturePath(path){assert.ok(spectralFixturePaths.includes(path),'Closed exact native fixture path required');}
/** @param {string} revision @returns {Record<string,string>} */
export function spectralReferenceFiles(revision){assert.ok(['one','two'].includes(revision),'Closed owned revisions');return{
 'a/shared.yaml':'\uFEFFtype: object\r\nproperties:\r\n  label:\r\n    $ref: \'../nested/value.yaml\'\r\n',
 'b/shared.yaml':'type: integer\r\nenum: [11]\r\n',
 'nested/value.yaml':`type: string\r\nenum: ['${revision}😀']\r\n`,
 ...Object.fromEntries(Array.from({length:40},(_,i)=>[`many/schema-${i}.yaml`,`type: object\nproperties:\n  label:\n    type: string\n    enum: ['many-${i}']\n`])),
};}
const hash=(/** @type {Uint8Array} */ bytes)=>createHash('sha256').update(bytes).digest('hex');
/** Owned HTTP transport only; never supplies IPC, jobs, results or workspace data.
 * @param {string} output */
export async function createSpectralReferenceServer(output){
 let revision='one';
 /** @type {any[]} */const events=[];
 const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){
  const url=new URL(request.url),names=['a/shared.yaml','b/shared.yaml','nested/value.yaml'];
  const name=url.pathname.slice('/references/'.length);
  if(request.method!=='GET'||url.search||!url.pathname.startsWith('/references/')||!names.includes(name))return new Response('Closed owned reference route',{status:404});
  const contents=spectralReferenceFiles(revision)[/** @type {'a/shared.yaml'|'b/shared.yaml'|'nested/value.yaml'} */(name)];
  events.push({type:'reference-http',name,revision,sha256:hash(new TextEncoder().encode(contents)),bytes:new TextEncoder().encode(contents).length,at:Date.now()});
  return new Response(contents,{headers:{'Content-Type':'application/yaml','Cache-Control':'no-store'}});
 }});
 return{origin:`http://127.0.0.1:${server.port}`,events,
  /** @param {string} value */setRevision(value){assert.ok(['one','two'].includes(value));revision=value;},
  async close(){await server.stop(true);await Bun.write(join(output,'spectral-owned-http.json'),JSON.stringify({closed:true,loopback:true,referenceOnly:true,events},null,2));},
 };
}
/** Pure cleanup allowlist check usable before any native host launch.
 * @param {string} relativePath */
export function assertSpectralCleanupPath(relativePath){assertSpectralFixturePath(relativePath.split(sep).join('/'));}
