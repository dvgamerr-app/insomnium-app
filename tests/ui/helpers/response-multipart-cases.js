import assert from 'node:assert/strict';
import {join} from 'node:path';
import {poll} from './native-app.js';
import {respondToOwnedSaveDialog} from './windows-save-dialog.js';
export const multipartJson='{"message":"ไทย","id":9007199254740993}';
const metadataPoints=Array.from(multipartJson),metadataBytes=Buffer.alloc(metadataPoints.length*4);
metadataPoints.forEach((char,index)=>metadataBytes.writeUInt32LE(char.codePointAt(0)||0,index*4));
export const quotedText='Quoted ไทย = _\r\nhard\t \r\nsoftline';
const quotedWire='Quoted=20=E0=B9=84=E0=B8=97=E0=B8=A2=20=3d=20_\r\nhard=09=20 \t\r\nsoft= \t\r\nline \t';
export const allPartBytes=Buffer.from(Array.from({length:256},(_,index)=>index));
/** @param {Buffer} bytes */
const quotePartBytes=bytes=>bytes.toString('hex').replace(/../g,'=$&').match(/.{1,72}/g)?.join('=\r\n')||'';
const nestedPartBytes=Buffer.from('--nested\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Disposition: attachment; filename="nested.txt"\r\n\r\nnested ไทย\r\n--nested--\r\n');
const audioBytes=Buffer.alloc(32044);audioBytes.write('RIFF',0);audioBytes.writeUInt32LE(32036,4);audioBytes.write('WAVEfmt ',8);audioBytes.writeUInt32LE(16,16);audioBytes.writeUInt16LE(1,20);audioBytes.writeUInt16LE(1,22);audioBytes.writeUInt32LE(8000,24);audioBytes.writeUInt32LE(16000,28);audioBytes.writeUInt16LE(2,32);audioBytes.writeUInt16LE(16,34);audioBytes.write('data',36);audioBytes.writeUInt32LE(32000,40);
export const multipartBytes=Buffer.concat([Buffer.from('preamble\r\n--owned+parts\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json; charset=utf-32le\r\nContent-Transfer-Encoding: 8bit\r\nX-Owned: first\r\n\r\n'),metadataBytes,Buffer.from('\r\n--owned+parts\r\nContent-Disposition: attachment; name="binary"; filename="owned.bin"\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: BASE64\r\n\r\n'),Buffer.from('AP8N\r\nCio='),
 Buffer.from('\r\n--owned+parts\r\nContent-Disposition: form-data; name="note"\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: Quoted-Printable\r\n\r\n'+quotedWire),
 Buffer.from('\r\n--owned+parts\r\nContent-Disposition: attachment; name="all-bytes"; filename="quoted.bin"\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n'+quotePartBytes(allPartBytes)),
 Buffer.from('\r\n--owned+parts\r\nContent-Disposition: attachment; name="base64-noise"; filename="noise.txt"\r\nContent-Type: text/plain\r\nContent-Transfer-Encoding: base64\r\n\r\n'),Buffer.from([81,193,85,73,61]),
 Buffer.from('\r\n--owned+parts\r\nContent-Disposition: form-data; name="nested"\r\nContent-Type: multipart/mixed; boundary=nested\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n'+quotePartBytes(nestedPartBytes)),
 Buffer.from('\r\n--owned+parts\r\nContent-Disposition: attachment; name="audio"; filename="audio.wav"\r\nContent-Type: audio/wav\r\nContent-Transfer-Encoding: base64\r\n\r\n'+audioBytes.toString('base64')+'\r\n--owned+parts--\r\nepilogue')]);

/** Shared browser/native multipart acceptance over the same authored bytes.
 * @param {{page:import('playwright-core').Page,output:string,loadHistory:()=>Promise<any[]>,pid?:number}} context */
export async function exerciseMultipartResponse({page,output,loadHistory,pid}) {
 const originalHistory=await loadHistory();
 const selector=page.getByRole('combobox',{name:'Response part',exact:true});await selector.waitFor();
 assert.equal(await selector.locator('option').count(),7);
 const editor=page.locator('textarea[aria-label="Response part body"]').first();
 await page.waitForFunction(()=>/** @type {HTMLTextAreaElement|null} */(document.querySelector('textarea[aria-label="Response part body"]'))?.value.includes('ไทย'));
 assert.match(await editor.inputValue(),/9007199254740993/);
 await page.getByRole('button',{name:'Part headers',exact:true}).click();
 assert.match(await page.getByLabel('Part headers',{exact:true}).textContent()||'',/X-Ownedfirst/);
 const files=/** @type {{name:string,bytes:number}[]} */([]);
 /** @param {string} name @param {Buffer} expected @param {boolean} [nested] @param {boolean} [original] */
 const save=async(name,expected,nested=false,original=false)=>{
  const button=page.getByRole('button',{name:original?'Save response':'Save part',exact:true});
  const control=nested?button.last():button;
  if(pid){
   const destination=join(output,name.endsWith('.bin')?name:name+'.bin');
   const dialog=respondToOwnedSaveDialog(pid,output,destination,'.bin');void dialog.catch(()=>{});
   const results=await Promise.allSettled([control.click(),dialog]);for(const result of results)if(result.status==='rejected')throw result.reason;
   await poll(()=>Bun.file(destination).exists(),'Native multipart Save destination');
   await poll(()=>control.isEnabled(),'Native multipart Save write finished');
   assert.deepEqual(Buffer.from(await Bun.file(destination).bytes()),expected);
   files.push({name:destination,bytes:expected.length});
  }else{
   const downloading=page.waitForEvent('download');await control.click();const saved=await downloading;
   if(!original)assert.equal(saved.suggestedFilename(),name);const path=await saved.path();assert.ok(path);
   assert.deepEqual(Buffer.from(await Bun.file(path).bytes()),expected);await saved.saveAs(join(output,name));files.push({name,bytes:expected.length});
  }
 };
 await selector.selectOption('1');await save('owned.bin',Buffer.from([0,255,13,10,42]));
 await selector.selectOption('2');
 await page.waitForFunction(expected=>/** @type {HTMLTextAreaElement|null} */(document.querySelector('textarea[aria-label="Response part body"]'))?.value===expected.replace(/\r\n?/g,'\n'),quotedText);
 await page.getByRole('button',{name:'Part headers',exact:true}).click();
 assert.match(await page.getByLabel('Part headers',{exact:true}).textContent()||'',/Quoted-Printable/);
 if(pid){
  const cancel=respondToOwnedSaveDialog(pid,output,null,'.bin');void cancel.catch(()=>{});
  const results=await Promise.allSettled([page.getByRole('button',{name:'Save part',exact:true}).click(),cancel]);for(const result of results)if(result.status==='rejected')throw result.reason;
  await poll(()=>page.getByRole('button',{name:'Save part',exact:true}).isEnabled(),'Cancelled multipart Save retired');assert.deepEqual(await loadHistory(),originalHistory);
 }
 for(const [index,filename,expected] of /** @type {[string,string,Buffer][]} */([
  ['2','note.bin',Buffer.from(quotedText)],['3','quoted.bin',allPartBytes],['4','noise.txt',Buffer.from('AB')],
 ])){await selector.selectOption(index);await save(filename,expected);}
 await selector.selectOption('5');assert.equal(await page.getByRole('combobox',{name:'Response part',exact:true}).count(),2);
 await page.waitForFunction(()=>/** @type {HTMLTextAreaElement|null} */(document.querySelector('textarea[aria-label="Response part body"]'))?.value==='nested ไทย');
 await save('nested.txt',Buffer.from('nested ไทย'),true);
 await selector.first().selectOption('6');const audio=page.frameLocator('iframe[title="Audio response preview"]').getByLabel('Response audio',{exact:true});
 await poll(async()=>await audio.evaluate(el=>/** @type {HTMLAudioElement} */(el).readyState>=1),'Multipart audio metadata loaded',10000);
 assert.deepEqual(await audio.evaluate(el=>{const player=/** @type {HTMLAudioElement} */(el);return {duration:player.duration,paused:player.paused,autoplay:player.autoplay};}),{duration:2,paused:true,autoplay:false});
 const box=await audio.boundingBox();assert.ok(box);await audio.click({position:{x:25,y:box.height/2}});
 await poll(async()=>await audio.evaluate(el=>!/** @type {HTMLAudioElement} */(el).paused),'Multipart audio playback started',10000);
 await selector.first().selectOption('0');await page.locator('iframe[title="Audio response preview"]').waitFor({state:'detached'});
 await selector.first().selectOption('6');await poll(async()=>await audio.evaluate(el=>/** @type {HTMLAudioElement} */(el).readyState>=1),'Multipart audio metadata reloaded',10000);
 assert.deepEqual(await audio.evaluate(el=>{const player=/** @type {HTMLAudioElement} */(el);return {paused:player.paused,currentTime:player.currentTime};}),{paused:true,currentTime:0});
 assert.equal(await audio.getAttribute('src'),'data:audio/wav;base64,'+audioBytes.toString('base64'));await save('audio.wav',audioBytes);await save('original-multipart.bin',multipartBytes,false,true);
 await page.screenshot({path:join(output,'multipart-preview.png')});
 await page.getByRole('group',{name:'Response formatting',exact:true}).getByRole('button',{name:'Raw',exact:true}).click();await page.reload();
 await page.waitForFunction(expected=>/** @type {HTMLTextAreaElement|null} */(document.querySelector('textarea[aria-label="Response body"]'))?.value===expected.replace(/\r\n?/g,'\n'),multipartBytes.toString('utf8'));
 assert.deepEqual(await loadHistory(),originalHistory);
 return {passed:true,parts:7,jsonUnicodeAndLargeInteger:true,utf32Part:true,transferBase64:true,base64ForeignOctet:true,quotedPrintableText:true,quotedPrintableAllBytes:true,nestedQuotedPrintable:true,audioPreview:true,audioPlaybackAndSwitch:true,audioSaveExact:true,headers:true,exactBinaryDownload:true,rawReload:true,originalBytes:true,originalDownload:true,historyUnchanged:true,nativeCancel:!!pid,files};
}
