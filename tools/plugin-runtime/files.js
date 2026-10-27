import {installPluginFiles} from '../../scripts/plugin-file-runtime.js';
import {StringDecoder} from 'node:string_decoder';

const NativeBlob=Blob,NativeFile=File,NativeRequest=Request,NativeResponse=Response;
const blobDescriptors=Object.getOwnPropertyDescriptors(NativeBlob.prototype),fileDescriptors=Object.getOwnPropertyDescriptors(NativeFile.prototype);
const bodyDescriptors={Request:Object.getOwnPropertyDescriptors(NativeRequest.prototype),Response:Object.getOwnPropertyDescriptors(NativeResponse.prototype)};
const apply=Reflect.apply,construct=Reflect.construct,peek=Bun.peek,status=Bun.peek.status;
const headerGet=Headers.prototype.get;
const nativeSize=value=>apply(blobDescriptors.size.get,value,[]),nativeType=value=>apply(blobDescriptors.type.get,value,[]);
const isNativeBlob=value=>{try{nativeSize(value);return true;}catch{return false;}};
const isNativeFile=value=>isNativeBlob(value)&&value instanceof NativeFile;
const nativeReadSync=value=>{
 if(nativeSize(value)>128*1024*1024)throw Error('Plugin synchronous File read exceeds the 128 MiB limit');
 const promise=apply(blobDescriptors.arrayBuffer.value,value,[]);
 // shortcut: pending native file I/O cannot run during this synchronous wait; add a bounded reader before admitting it.
 if(status(promise)!=='fulfilled'){promise.catch(()=>{});throw Error('Native file-backed Blob requires an asynchronous read');}
 return peek(promise);
};

/** Keep native byte stores; only WebView-selected parts require the owned bridge. */
export function installBunPluginFiles(readSelected){
 const native={
  isBlob:isNativeBlob,isFile:isNativeFile,
  blob(value){if(!isNativeBlob(value))return;return {size:nativeSize(value),type:nativeType(value),parts:[{native:value,offset:0,size:nativeSize(value),read:async(_id,offset,length)=>apply(blobDescriptors.arrayBuffer.value,apply(blobDescriptors.slice.value,value,[offset,offset+length]),[])}]};},
  file(value){if(isNativeFile(value))return {name:apply(fileDescriptors.name.get,value,[]),lastModified:apply(fileDescriptors.lastModified.get,value,[]),relativePath:''};},
  readSync:nativeReadSync,
  slice:(value,...args)=>apply(blobDescriptors.slice.value,value,args),
  arrayBuffer:value=>apply(blobDescriptors.arrayBuffer.value,value,[]),
  text:value=>apply(blobDescriptors.text.value,value,[]),
  // shortcut: Bun1.4.2's lowercase MIME fast path adds charset; remove when it preserves the supplied type.
  create(parts,settings,file,newTarget){
   const bits=parts.map(part=>part.bytes??apply(blobDescriptors.slice.value,part.native,[part.offset,part.offset+part.size])),type=settings.type.toUpperCase();
   // shortcut: Bun1.4.2 retains File branding for one File part; remove when Blob construction clears it.
   if(!file&&bits.length===1&&isNativeFile(bits[0]))bits.push(new Uint8Array(0));
   return file?construct(NativeFile,[bits,file.name,{type,lastModified:file.lastModified}],newTarget):construct(NativeBlob,[bits,{type}],newTarget);
  },
  async read(value,from=0,to=nativeSize(value)){const slice=apply(blobDescriptors.slice.value,value,[from,to]);return new Uint8Array(await apply(blobDescriptors.arrayBuffer.value,slice,[]));},
 };
 const privateFiles=installPluginFiles(Buffer,StringDecoder,{ReadableStream,TransformStream},process.platform==='win32'?'\r\n':'\n',0x7fffffff,readSelected,native);
 const files=globalThis.__pluginFileModule;
 const materialize=value=>{
  if(!files.isOwned(value))return value;
  const bytes=files.readSync(value),info=files.info(value);
  if(files.isFile(value)){const file=files.describe(value);return new NativeFile([bytes],file.name,{type:info.type.toUpperCase(),lastModified:file.lastModified});}
  return new NativeBlob([bytes],{type:info.type.toUpperCase()});
 };
 Object.setPrototypeOf(privateFiles.Blob.prototype,NativeBlob.prototype);
 for(const [name,Native,Private]of [['Blob',NativeBlob,privateFiles.Blob],['File',NativeFile,privateFiles.File]]){
  const Target=function(){};Object.defineProperty(Target,'name',{value:name});Object.defineProperty(Target,'length',{value:Native.length});Object.defineProperty(Target,'prototype',{value:Private.prototype,writable:false});
  let Public;
  Public=new Proxy(Target,{
   apply(_target,receiver,args){return apply(Native,receiver,args);},
   construct(target,args,newTarget){
    return construct(Private,args,newTarget===Public?Private:newTarget);
   },
   get(target,key,receiver){return key===Symbol.hasInstance?(name==='File'?files.isFile:files.isBlob):Reflect.get(target,key,receiver);},
  });
  Object.defineProperty(Private.prototype,'constructor',{value:Public,writable:true,configurable:true});
  if(name==='Blob')Object.defineProperty(Native.prototype,'constructor',{...Object.getOwnPropertyDescriptor(Native.prototype,'constructor'),value:Public});
  Object.defineProperty(globalThis,name,{value:Public,writable:false,configurable:false});
 }
 const bufferModule=require('node:buffer');bufferModule.Blob=globalThis.Blob;bufferModule.File=globalThis.File;
 Bun.plugin({name:'insomnium-owned-file-buffer',setup(build){
  build.onResolve({filter:/^buffer$/,namespace:'node'},()=>({path:'buffer',namespace:'insomnium-buffer'}));
  build.onLoad({filter:/^buffer$/,namespace:'insomnium-buffer'},()=>({loader:'object',exports:{...bufferModule,default:bufferModule}}));
 }});
 for(const [name,Target]of [['Response',NativeResponse],['Request',NativeRequest]]){
  let Public;Public=new Proxy(Target,{construct(target,args,newTarget){
   if(name==='Response'&&args.length)args[0]=materialize(args[0]);
   if(name==='Request'&&args[1]!==null&&(typeof args[1]==='object'||typeof args[1]==='function')){
    let read=false,body;args[1]=new Proxy(args[1],{get(value,key){if(key!=='body')return Reflect.get(value,key,value);if(!read){body=materialize(Reflect.get(value,key,value));read=true;}return body;}});
   }
   const value=construct(target,args,newTarget===Public?target:newTarget);
   // Bun drops an uninitialized multipart Content-Type after consuming its body.
   apply(headerGet,apply(bodyDescriptors[name].headers.get,value,[]),['content-type']);return value;
  }});Object.defineProperty(globalThis,name,{value:Public,writable:false,configurable:false});
  const descriptor=bodyDescriptors[name].blob;
  Object.defineProperty(Target.prototype,'blob',{...descriptor,value:async function blob(...args){
   const value=await apply(descriptor.value,this,args);if(!isNativeFile(value))return value;
   const headers=apply(bodyDescriptors[name].headers.get,this,[]),type=apply(headerGet,headers,['content-type']);
   const response=new NativeResponse(new NativeBlob([value,new Uint8Array(0)]),{headers:type===null?{}:{'content-type':type}});
   return apply(bodyDescriptors.Response.blob.value,response,[]);
  }});
 }
 const formHas=FormData.prototype.has;
 for(const name of ['append','set']){
  const descriptor=Object.getOwnPropertyDescriptor(FormData.prototype,name),method=descriptor.value;
  const wrapper=({[name](...args){
   if(args.length<2||!files.isOwned(args[1]))return apply(method,this,args);
   apply(formHas,this,['']);
   if(typeof args[0]==='symbol')throw TypeError('Invalid FormData name');args[0]=String(args[0]).toWellFormed();
   if(args.length>2&&args[2]!==undefined){if(typeof args[2]==='symbol')throw TypeError('Invalid FormData filename');args[2]=String(args[2]).toWellFormed();}
   args[1]=materialize(args[1]);return apply(method,this,args);
  }})[name];Object.defineProperty(wrapper,'length',{value:method.length});Object.defineProperty(FormData.prototype,name,{...descriptor,value:wrapper});
 }
}
