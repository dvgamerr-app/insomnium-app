import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dir,'..'),target='x86_64-pc-windows-msvc';
if(process.platform!=='win32'||process.arch!=='x64'||process.argv.length!==2)throw Error('Bun inspection currently requires native Windows x64');
const pkg=await Bun.file(resolve(root,'package.json')).json();
if(pkg.packageManager!=='bun@'+Bun.version)throw Error('Use the pinned Bun version');
const inputs=['scripts/build-plugin-runtime.mjs','tools/plugin-runtime/host.js','tools/plugin-runtime/session.js','tools/plugin-runtime/input.js','tools/plugin-runtime/dom.js','tools/plugin-runtime/files.js','scripts/plugin-file-runtime.js','src/lib/plugin-guest-dom.js','src/lib/plugin-call-context.js','src/lib/plugin-request-context.js','src/lib/plugin-response-context.js','src/lib/plugin-run-helpers.js','src/lib/plugin-app-async.js','src/lib/plugin-app-sync.js','src/lib/plugin-metadata.js','src/lib/plugin-tag-metadata.js','src/lib/plugin-values.js','package.json'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sources={};
for(const path of inputs)sources[path]=sha(await Bun.file(resolve(root,path)).bytes());
const output=resolve(root,'src-tauri/binaries/plugin-runtime-'+target+'.exe');
await mkdir(resolve(output,'..'),{recursive:true});
const child=Bun.spawn(['bun','build',resolve(root,'tools/plugin-runtime/host.js'),'--compile','--target=bun-windows-x64','--no-compile-autoload-dotenv','--no-compile-autoload-bunfig','--compile-exec-argv=--no-install','--outfile',output],{cwd:root,stdout:'inherit',stderr:'inherit',windowsHide:true});
if(await child.exited!==0)throw Error('Bun inspection build failed');
for(const path of inputs)if(sources[path]!==sha(await Bun.file(resolve(root,path)).bytes()))throw Error('Bun inspection inputs changed during compilation');
const bytes=await Bun.file(output).bytes();
await Bun.write(output+'.manifest.json',JSON.stringify({schema:1,target,bunVersion:Bun.version,bytes:bytes.length,sha256:sha(bytes),sources},null,2));
console.log('Bun inspection binary ready: '+output);
