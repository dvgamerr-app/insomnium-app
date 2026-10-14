import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const output=resolve('artifacts/playwright/clipboard-format-preflight-'+Date.now()),child=Bun.spawn(['bun',resolve('tests/ui/helpers/clipboard-format-preflight.js')],{stdout:'pipe',stderr:'pipe',windowsHide:true});
const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);await Bun.write(output+'/stdout.log',stdout);await Bun.write(output+'/stderr.log',stderr);
if(code!==0){await Bun.write(output+'/result.json',JSON.stringify({status:'failed',code,clipboardMutationRequested:false,stderr},null,2));throw Error('Clipboard format preflight failed: '+stderr);}
const result=JSON.parse(stdout.trim());assert.equal(result.clipboardMutationRequested,false);assert.equal(result.dataBytesCaptured,false);assert.equal(result.completePreservationProven,false);
await Bun.write(output+'/result.json',JSON.stringify({status:'inspected-read-only',...result},null,2));console.log(JSON.stringify({output,formats:result.formats.length,allHglobal:result.allHglobal,sequenceUnchanged:result.defaultSequenceBefore===result.defaultSequenceAfter,completePreservationProven:false}));
