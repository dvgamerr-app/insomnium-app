import {dirname,resolve} from 'node:path';
import {realpath} from 'node:fs/promises';
import {elfAbi} from './linux-elf-inputs.mjs';
async function command(argv){const child=Bun.spawn(argv,{stdout:'pipe',stderr:'pipe'}),[stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);if(code!==0)throw Error('ELF dependency inspection failed: '+argv[0]+' '+stderr.trim());return stdout;}
export function parseDynamic(text){return {needed:[...text.matchAll(/\(NEEDED\).*Shared library: \[([^\]]+)\]/g)].map(x=>x[1]),search:[...text.matchAll(/\((?:RUNPATH|RPATH)\).*\[([^\]]*)\]/g)].flatMap(x=>x[1].split(':').filter(Boolean))};}
export async function inspectElfClosure(binaries,services={command,which:Bun.which,abi:elfAbi,realpath,exists:path=>Bun.file(path).exists()}){
 const readelf=services.which('readelf');if(!readelf)throw Error('Install binutils before Linux sidecar dependency inspection');const cache=await services.command([services.which('ldconfig')??'/sbin/ldconfig','-p']),libraries=new Map();
 for(const line of cache.split(/\r?\n/)){const match=line.match(/^\s*(\S+)\s+\([^)]*\)\s+=>\s+(\/.*)$/);if(match){const paths=libraries.get(match[1])??[];paths.push(match[2]);libraries.set(match[1],paths);}}
 const abi=await services.abi(binaries[0]),queue=[...binaries],seen=new Set(),rows=[];
 while(queue.length){const path=queue.shift(),canonical=await services.realpath(path);if(seen.has(canonical))continue;seen.add(canonical);if(await services.abi(path)!==abi)throw Error('ELF dependency architecture differs: '+path);const dynamic=parseDynamic(await services.command([readelf,'--dynamic','--wide',path])),dependencies=[];
  for(const name of dynamic.needed){if(name.includes('/')||!name)throw Error('Unsupported ELF dependency name: '+name);const candidates=[...dynamic.search.map(dir=>resolve(dir.replaceAll('${ORIGIN}',dirname(path)).replaceAll('$ORIGIN',dirname(path)),name)),...(libraries.get(name)??[])];let library;for(const candidate of candidates){if(await services.exists(candidate)&&await services.abi(candidate)===abi){library=candidate;break;}}if(!library)throw Error('Unresolved ELF dependency '+name+' required by '+path);dependencies.push({name,path:library});queue.push(library);}
  rows.push({path,canonical,dependencies});
 }
 return {binaries,abi,rows};
}
