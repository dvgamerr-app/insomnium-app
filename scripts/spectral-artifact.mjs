import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spectralNoticeIdentity} from './generate-spectral-notices.mjs';
const root=resolve(import.meta.dir,'..');
const targets={
 'x86_64-pc-windows-msvc':'bun-windows-x64',
 'x86_64-unknown-linux-gnu':'bun-linux-x64-baseline',
 'aarch64-unknown-linux-gnu':'bun-linux-arm64',
 'x86_64-apple-darwin':'bun-darwin-x64',
 'aarch64-apple-darwin':'bun-darwin-arm64',
};
const inputs=['scripts/build-spectral-linter.mjs','tools/spectral-linter/build.mjs','tools/spectral-linter/host.js','tools/spectral-linter/openapi-examples.js','tools/spectral-linter/exact-examples.js','src/lib/openapi-numeric-domain.js','src/lib/openapi-structural-numbers.js','src/lib/openapi-counts.js','src/lib/openapi-value.js','src/lib/openapi-literal.js','src/lib/openapi-document.js','package.json','bun.lock','src/lib/media-type.js','src/lib/openapi-references.js','src/lib/openapi-validation.js','src/lib/generated/openapi-2.0.js','src/lib/generated/openapi-3.0.js','src/lib/generated/openapi-3.1.js','src/lib/generated/openapi-3.2.js','tools/spectral-linter/protocol.js','tools/spectral-linter/read-receipts.js','tools/spectral-linter/patches/@stoplight%2Fjson-ref-resolver@3.1.6.patch','tools/spectral-linter/package.json','tools/spectral-linter/bun.lock'];
export function spectralPaths(target,projectRoot=root){
 if(typeof target!=='string'||!Object.hasOwn(targets,target))throw Error('Unsupported or missing TAURI_ENV_TARGET_TRIPLE for Spectral packaging');
 const filename='spectral-linter-'+target+(target.includes('windows')?'.exe':'');
 const binary=resolve(projectRoot,'src-tauri/binaries',filename);
 return {target,bunTarget:targets[target],binary,manifest:binary+'.manifest.json',provenance:binary+'.packaging.json'};
}
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function sourceIdentity(projectRoot){const rows=[];for(const path of inputs)rows.push({path,sha256:sha256(await Bun.file(resolve(projectRoot,path)).bytes())});return rows;}
async function producerArtifact(target,projectRoot){const paths=spectralPaths(target,projectRoot),manifest=await Bun.file(paths.manifest).json(),bytes=await Bun.file(paths.binary).bytes(),lock=await Bun.file(resolve(projectRoot,'tools/spectral-linter/bun.lock')).bytes();
 if(manifest.target!==target||manifest.bunTarget!==paths.bunTarget||manifest.bunVersion!==Bun.version||manifest.bytes!==bytes.length||manifest.sha256!==sha256(bytes)||manifest.lockSHA256!==sha256(lock))throw Error('Spectral producer artifact/provenance mismatch');
 return {paths,manifest};
}
export async function recordSpectralBuild(target,projectRoot=root){const {paths,manifest}=await producerArtifact(target,projectRoot);await Bun.write(paths.provenance,JSON.stringify({target,binarySHA256:manifest.sha256,producerInputs:await sourceIdentity(projectRoot),notices:await spectralNoticeIdentity(projectRoot)},null,2));}
export async function validateSpectralArtifact(target,projectRoot=root){const {paths,manifest}=await producerArtifact(target,projectRoot),stamp=await Bun.file(paths.provenance).json();if(stamp.target!==target||stamp.binarySHA256!==manifest.sha256||JSON.stringify(stamp.producerInputs)!==JSON.stringify(await sourceIdentity(projectRoot))||JSON.stringify(stamp.notices)!==JSON.stringify(await spectralNoticeIdentity(projectRoot)))throw Error('Spectral artifact is stale; run the target-specific Tauri build hook before bundling');return paths;}
