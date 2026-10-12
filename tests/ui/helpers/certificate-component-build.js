import {resolve,relative,isAbsolute,sep} from 'node:path';
import assert from 'node:assert/strict';
export const certificateAliasEvidence=/** @type {{importer:string,path:string}[]} */([]);
/** Redirect source to a frozen exact root tree, alias ONLY the certificate consumer.
 * @returns {import('bun').BunPlugin} */
export function certificateComponentAlias(){
 const own=resolve('src'),source=resolve(process.env.INSOMNIUM_CERTIFICATE_SOURCE_ROOT||'src'),consumer=resolve(source,'lib/components/ClientCertificates.svelte'),dialog=resolve('tests/ui/fixtures/certificate-component-dialog.js');
 assert(source===own||source.startsWith(resolve('artifacts')+sep),'Only owned source snapshot');
 return {name:'owned-certificate-component',setup(build){
  build.onResolve({filter:/^@tauri-apps\/(api\/core|plugin-dialog)$/},args=>{if(resolve(args.importer)!==consumer)return;certificateAliasEvidence.push({importer:consumer,path:args.path});return{path:dialog};});
  build.onResolve({filter:/^\$lib\//},args=>({path:resolve(source,'lib',args.path.slice(5))}));
  build.onResolve({filter:/^\./},args=>{const target=resolve(args.resolveDir,args.path),rel=relative(own,target);if(rel&&!rel.startsWith('..')&&!isAbsolute(rel))return{path:resolve(source,rel)};});
 }};
}
