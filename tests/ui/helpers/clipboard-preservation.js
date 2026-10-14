import assert from 'node:assert/strict';
import {dlopen,ptr,toArrayBuffer} from 'bun:ffi';
// These three serialized HGLOBAL contracts are documented by Windows/Chromium;
// registered numeric IDs are session-local and must never be pinned here.
// https://learn.microsoft.com/en-us/windows/win32/dataxchg/html-clipboard-format
// https://chromium.googlesource.com/chromium/src/+/refs/heads/main/ui/base/clipboard/clipboard_win.cc
// https://chromium.googlesource.com/chromium/src.git/+/refs/heads/main/content/public/browser/clipboard_types.cc
const registeredHglobalNames=new Set(['HTML Format','Chromium internal source RFH token','Chromium internal source URL']);
export function supportsPreservedClipboardFormat(/** @type {number} */ id,/** @type {string|null} */ name=null){return Number.isInteger(id)&&([1,7,13,16].includes(id)||(id>=0xc000&&id<=0xffff&&registeredHglobalNames.has(name??'')));}
/** Current-format preservation is fail-closed. Unsupported formats, unavailable
 * data or an incomplete clone must refuse testing before any clipboard write.
 * Bytes live only in this owner process and are never returned as evidence. */
export function createClipboardPreserver(){
 const user=dlopen('user32.dll',{
  CreateWindowExW:{args:['u32','ptr','ptr','u32','i32','i32','i32','i32','u64','u64','u64','ptr'],returns:'u64'},DestroyWindow:{args:['u64'],returns:'i32'},
  OpenClipboard:{args:['u64'],returns:'i32'},CloseClipboard:{args:[],returns:'i32'},EnumClipboardFormats:{args:['u32'],returns:'u32'},GetClipboardData:{args:['u32'],returns:'u64'},GetClipboardFormatNameW:{args:['u32','ptr','i32'],returns:'i32'},
  EmptyClipboard:{args:[],returns:'i32'},SetClipboardData:{args:['u32','u64'],returns:'u64'},GetClipboardSequenceNumber:{args:[],returns:'u32'},
  GetClipboardOwner:{args:[],returns:'u64'},GetWindowThreadProcessId:{args:['u64','ptr'],returns:'u32'},
 }),kernel=dlopen('kernel32.dll',{
  GlobalSize:{args:['u64'],returns:'u64'},GlobalAlloc:{args:['u32','u64'],returns:'u64'},GlobalFree:{args:['u64'],returns:'u64'},GlobalLock:{args:['u64'],returns:'ptr'},GlobalUnlock:{args:['u64'],returns:'i32'},
  GetLastError:{args:[],returns:'u32'},SetLastError:{args:['u32'],returns:'void'},
 });
 const wide=(/** @type {string} */ text)=>Uint16Array.from(text.split('').map(char=>char.charCodeAt(0)).concat(0)),klass=wide('STATIC'),title=wide('Owned clipboard preservation');
 const hwnd=user.symbols.CreateWindowExW(0,ptr(klass),ptr(title),0,0,0,1,1,BigInt.asUintN(64,-3n),0n,0n,null);if(hwnd===0n){user.close();kernel.close();throw Error('Owned message-only window required');}
 const rows=/** @type {{id:number,name:string|null,bytes:Uint8Array,handle:bigint}[]} */([]);let captured=false,disposed=false,total=0,sequence=0,mutations=0;
 const formatName=(/** @type {number} */ id)=>{if(id<0xc000)return null;const buffer=new Uint16Array(256),length=user.symbols.GetClipboardFormatNameW(id,ptr(buffer),buffer.length);assert.ok(length>0&&length<buffer.length-1,'Require complete registered format name');return String.fromCharCode(...buffer.subarray(0,length));};
 const unlock=(/** @type {bigint} */ handle)=>{kernel.symbols.SetLastError(0);const result=kernel.symbols.GlobalUnlock(handle);if(!result)assert.equal(kernel.symbols.GetLastError(),0,'Unlock owned memory');};
 const read=(/** @type {bigint} */ handle)=>{const size=Number(kernel.symbols.GlobalSize(handle));assert.ok(size>0&&size<=8*1024*1024,'Every original format must be bounded HGLOBAL');const address=kernel.symbols.GlobalLock(handle);assert.ok(address);try{return new Uint8Array(toArrayBuffer(address,0,size)).slice();}finally{unlock(handle);}};
 const ids=()=>{const result=/** @type {number[]} */([]);let previous=0;while(true){kernel.symbols.SetLastError(0);const id=user.symbols.EnumClipboardFormats(previous);if(!id){assert.equal(kernel.symbols.GetLastError(),0);return result;}assert.ok(result.length<4096&&!result.includes(id));result.push(id);previous=id;}};
 const locked=(/** @type {()=>void} */ run)=>{assert.ok(user.symbols.OpenClipboard(hwnd),'Acquire clipboard lock');try{return run();}finally{assert.ok(user.symbols.CloseClipboard(),'Release clipboard lock');}};
 const dispose=()=>{if(disposed)return;disposed=true;const errors=[];for(const row of rows){try{if(row.handle!==0n){assert.equal(kernel.symbols.GlobalFree(row.handle),0n);row.handle=0n;}}catch(error){errors.push(error);}finally{row.bytes.fill(0);}}try{assert.ok(user.symbols.DestroyWindow(hwnd));}catch(error){errors.push(error);}finally{try{user.close();}finally{kernel.close();}}if(errors.length)throw new AggregateError(errors,'Clipboard resource cleanup failed');};
 const publishOriginal=()=>{assert.ok(rows.every(row=>row.handle!==0n),'All original clones must remain available before restoration');assert.ok(user.symbols.EmptyClipboard(),'Empty owned restoration destination');for(const row of rows){const stored=user.symbols.SetClipboardData(row.id,row.handle);assert.notEqual(stored,0n,'Publish original format');row.handle=0n;}assert.deepEqual(ids(),rows.map(row=>row.id),'Restore exact full original format order');for(const row of rows){assert.equal(formatName(row.id),row.name,'Restore same registered format identity');const bytes=read(user.symbols.GetClipboardData(row.id));try{assert.deepEqual(bytes,row.bytes,'Restore every original byte');}finally{bytes.fill(0);}}};
 return Object.freeze({
  sequence(){assert.ok(captured&&!disposed);return sequence;},
  adoptOwnedReceipt(/** @type {{sequence:number,owner:string,mutations:number,currentSequence?:number,unchanged?:boolean}} */ receipt,/** @type {number} */ ownerProcessId){assert.ok(captured&&!disposed);assert.ok(Number.isInteger(receipt.sequence)&&receipt.sequence>=0&&receipt.sequence<=0xffffffff);assert.ok(Number.isInteger(receipt.mutations)&&receipt.mutations>=0);assert.ok(Number.isInteger(ownerProcessId)&&ownerProcessId>0);locked(()=>{
   const current=user.symbols.GetClipboardSequenceNumber();assert.equal(current,receipt.sequence,'Restore only the exact native guarded receipt sequence');if(receipt.currentSequence!==undefined)assert.equal(receipt.currentSequence,receipt.sequence);if(receipt.unchanged!==undefined)assert.equal(receipt.unchanged,true);
   if(receipt.mutations===0){assert.equal(receipt.sequence,sequence,'Unmutated guard must retain original snapshot');return;}
   assert.match(receipt.owner,/^[1-9][0-9]*$/);const owner=user.symbols.GetClipboardOwner(),pid=new Uint32Array(1);assert.equal(owner,BigInt(receipt.owner),'Guard receipt must identify the current exact owner');assert.ok(user.symbols.GetWindowThreadProcessId(owner,ptr(pid)));assert.equal(pid[0],ownerProcessId,'Guard receipt must belong to authenticated native child');sequence=receipt.sequence;mutations=receipt.mutations;
  });return sequence;},
  assertUnchanged(){assert.ok(captured&&!disposed);locked(()=>{assert.equal(user.symbols.GetClipboardSequenceNumber(),sequence,'Refuse test after a concurrent clipboard update');});},
  emergencyRestoreOwnedProbe(/** @type {{token:string,owner:string,mutations:number,error:string|null}} */ receipt,/** @type {{token:string,ownerProcessId:number,seed:string,fixtureText:string}} */ expected){assert.ok(captured&&!disposed);assert.ok(expected.token&&receipt.token===expected.token,'Require current native lease receipt');assert.ok(Number.isInteger(receipt.mutations)&&receipt.mutations>=1&&receipt.mutations<=3);assert.ok(Number.isInteger(expected.ownerProcessId)&&expected.ownerProcessId>0);assert.match(receipt.owner,/^[1-9][0-9]*$/);locked(()=>{
   const owner=user.symbols.GetClipboardOwner(),pid=new Uint32Array(1);assert.equal(owner,BigInt(receipt.owner),'Emergency restoration refuses a foreign owner');assert.ok(user.symbols.GetWindowThreadProcessId(owner,ptr(pid)));assert.equal(pid[0],expected.ownerProcessId,'Emergency restoration requires authenticated native child');const formats=ids();
   if(receipt.mutations===3||(receipt.error!==null&&formats.length===0)){assert.deepEqual(formats,[],'Owned clear/failed publish must remain empty');}else{assert.ok(formats.includes(13)&&formats.every(id=>[1,7,13,16].includes(id)),'Emergency restore refuses unknown payload formats');const text=receipt.mutations===1?expected.seed:expected.fixtureText;assert.ok(text);const bytes=read(user.symbols.GetClipboardData(13));try{assert.equal(new TextDecoder('utf-16le').decode(bytes).replace(/\0+$/,''),text,'Emergency restore requires exact known probe payload');}finally{bytes.fill(0);}}
   publishOriginal();
  });return{restored:true,emergencyOnly:true,acceptance:false,formats:rows.length,bytesVerified:true,clipboardMutated:true};},
  capture(){assert.ok(!captured&&!disposed);try{const before=user.symbols.GetClipboardSequenceNumber();locked(()=>{
   const formats=ids(),names=new Map(formats.map(id=>[id,formatName(id)]));
   const unsupported=formats.filter(id=>!supportsPreservedClipboardFormat(id,names.get(id))).map(id=>({id,name:names.get(id)}));
   assert.equal(unsupported.length,0,'Refuse unsupported original format before mutation: '+JSON.stringify(unsupported));
   for(const id of formats){const bytes=read(user.symbols.GetClipboardData(id));total+=bytes.length;if(total>8*1024*1024){bytes.fill(0);throw Error("Bound all original data");}const copy=kernel.symbols.GlobalAlloc(2,BigInt(bytes.length));if(copy===0n){bytes.fill(0);throw Error("Preallocate restoration memory before mutation");}rows.push({id,name:names.get(id)??null,bytes,handle:copy});const address=kernel.symbols.GlobalLock(copy);assert.ok(address);try{new Uint8Array(toArrayBuffer(address,0,bytes.length)).set(bytes);}finally{unlock(copy);}assert.deepEqual(read(copy),bytes,'Verify every owned clone byte');}
   assert.deepEqual(ids(),formats,'Original format set must remain complete');
  });assert.equal(user.symbols.GetClipboardSequenceNumber(),before,'Original snapshot must remain current');sequence=before;captured=true;return{formats:rows.map(row=>({id:row.id,name:row.name,bytes:row.bytes.length})),totalBytes:total,allClonesVerified:true,sequence:before,clipboardMutated:false};}catch(error){try{dispose();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Clipboard capture and cleanup failed');}throw error;}},
  restore(){assert.ok(captured&&!disposed);locked(()=>{
   assert.equal(user.symbols.GetClipboardSequenceNumber(),sequence,'Do not overwrite a concurrent clipboard update, even when text or emptiness matches');
   if(mutations===0){assert.deepEqual(ids(),rows.map(row=>row.id),'Original full format order must remain unchanged');for(const row of rows){assert.equal(formatName(row.id),row.name);const bytes=read(user.symbols.GetClipboardData(row.id));try{assert.deepEqual(bytes,row.bytes,'Original clipboard bytes must remain unchanged');}finally{bytes.fill(0);}}return;}
   publishOriginal();
  });return{restored:true,formats:rows.length,bytesVerified:true,clipboardMutated:mutations>0,sequenceAfter:user.symbols.GetClipboardSequenceNumber()};},
  dispose,
 });
}
