import {generateFrontend,validateFrontendFS} from './frontend-notice-fs.mjs';
import {resolve} from 'node:path';
import {spectralPaths,recordSpectralBuild,validateSpectralArtifact} from './spectral-artifact.mjs';
import {generateSpectralNotices} from './generate-spectral-notices.mjs';
import {generateNativeNotices,buildRecipe} from './generate-native-notices.mjs';
import {validateNativeNotices} from './native-notice-artifact.mjs';
const root=resolve(import.meta.dir,'..');
async function command(argv){const child=Bun.spawn(argv,{cwd:root,stdin:'inherit',stdout:'inherit',stderr:'inherit'}),interrupt=()=>child.kill('SIGINT'),terminate=()=>child.kill('SIGTERM');process.once('SIGINT',interrupt);process.once('SIGTERM',terminate);try{const code=await child.exited;if(code!==0)throw Error('Tauri build hook child failed ('+code+')');}finally{process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);}}
export async function runHook(mode,target=process.env.TAURI_ENV_TARGET_TRIPLE,services={command,record:recordSpectralBuild,validate:validateSpectralArtifact,generate:generateSpectralNotices,nativeGenerate:generateNativeNotices,nativeValidate:validateNativeNotices,frontendGenerate:generateFrontend,frontendValidate:validateFrontendFS}){
 if(!['build','dev','bundle'].includes(mode))throw Error('Expected Tauri hook mode build, dev or bundle');spectralPaths(target);
 if(mode==='bundle'){await services.validate(target);await (services.nativeValidate??validateNativeNotices)(target);await (services.frontendValidate??validateFrontendFS)(root);return;}
 await services.command([process.execPath,'scripts/build-spectral-linter.mjs',target]);
 await (services.generate??generateSpectralNotices)();
 await (services.nativeGenerate??generateNativeNotices)(target,{mode});
 await (services.frontendGenerate??generateFrontend)(root);
 await services.record(target);await services.validate(target);
 await (services.nativeValidate??validateNativeNotices)(target,{expectedRecipe:buildRecipe(mode)});
 await (services.frontendValidate??validateFrontendFS)(root);
 await services.command([process.execPath,'run',mode==='dev'?'dev':'build']);
}
if(import.meta.main){if(Bun.argv.length!==3)throw Error('Expected one Tauri hook mode');await runHook(Bun.argv[2]);}
