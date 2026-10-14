import assert from 'node:assert/strict';
import {dlopen,ptr} from 'bun:ffi';
const user=dlopen('user32.dll',{OpenClipboard:{args:['u64'],returns:'i32'},CloseClipboard:{args:[],returns:'i32'},EnumClipboardFormats:{args:['u32'],returns:'u32'},GetClipboardData:{args:['u32'],returns:'u64'},GetClipboardFormatNameW:{args:['u32','ptr','i32'],returns:'i32'},GetClipboardSequenceNumber:{args:[],returns:'u32'}}),kernel=dlopen('kernel32.dll',{GlobalSize:{args:['u64'],returns:'u64'},GetLastError:{args:[],returns:'u32'},SetLastError:{args:['u32'],returns:'void'}});
const nonGlobal=new Set([2,3,9,14,0x80,0x82,0x83,0x8e]);
let before,after;const formats=/** @type {{id:number,name:string|null,kind:string,bytes:number}[]} */([]);
try{before=user.symbols.GetClipboardSequenceNumber();assert.ok(user.symbols.OpenClipboard(0n),'Clipboard read-only lock required');
try{
 let previous=0;while(true){kernel.symbols.SetLastError(0);const format=user.symbols.EnumClipboardFormats(previous);if(!format){assert.equal(kernel.symbols.GetLastError(),0,'Enumerate every format');break;}assert.ok(formats.length<4096);assert.ok(!formats.some(row=>row.id===format));previous=format;
  const name=new Uint16Array(256),length=user.symbols.GetClipboardFormatNameW(format,ptr(name),name.length),handle=user.symbols.GetClipboardData(format),bytes=handle&&!nonGlobal.has(format)?kernel.symbols.GlobalSize(handle):0n;
  formats.push({id:format,name:length?String.fromCharCode(...name.subarray(0,length)):null,kind:nonGlobal.has(format)?'non-hglobal':bytes>0n?'hglobal':'unavailable-or-opaque',bytes:Number(bytes)});
 }
}finally{assert.ok(user.symbols.CloseClipboard(),'Release read-only lock');}
after=user.symbols.GetClipboardSequenceNumber();}finally{try{user.close();}finally{kernel.close();}}
console.log(JSON.stringify({formats,defaultSequenceBefore:before,defaultSequenceAfter:after,clipboardMutationRequested:false,dataBytesCaptured:false,completePreservationProven:false,allHglobal:formats.every(row=>row.kind==='hglobal')}));
