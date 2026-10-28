// Shared capability-backed Blob/File implementation for isolated guest runtimes.
export function installPluginFiles(Buffer,StringDecoder,webStreams,nativeEndings,kMaxLength,readFileSync=undefined,nativeFiles=undefined){
const blobData=new WeakMap(),fileData=new WeakMap();
const domString=value=>{if(typeof value==='symbol')throw new TypeError('Invalid DOM string');return String(value);};
const longLong=value=>{const n=+value;if(!Number.isFinite(n)||n===0)return 0;const modulus=2**64,result=Math.trunc(n)%modulus;return (result>=2**63?result-modulus:result<-(2**63)?result+modulus:result)||0;};
const sliceOffset=value=>{const n=+value;if(Number.isNaN(n))return 0;const clamped=Math.max(-(2**63),Math.min(2**63-1,n)),floor=Math.floor(clamped);return clamped-floor===0.5?floor%2===0?floor:floor+1:Math.round(clamped);};
const blobState=value=>{const data=blobData.get(value)??nativeFiles?.blob(value);if(!data)throw new TypeError('Illegal invocation');return data;};
const fileState=value=>{const data=fileData.get(value)??nativeFiles?.file(value);if(!data)throw new TypeError('Illegal invocation');return data;};
const isBlob=value=>blobData.has(value)||nativeFiles?.isBlob(value)===true;
const isFile=value=>fileData.has(value)||nativeFiles?.isFile(value)===true;
const bufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const bufferResizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get;
const sharedLength=typeof SharedArrayBuffer==='function'?Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype,'byteLength').get:null;
const sharedBuffer=value=>{if(!sharedLength)return false;try{sharedLength.call(value);return true;}catch{return false;}};
const viewGetters=[Object.getPrototypeOf(Uint8Array.prototype),DataView.prototype].map(proto=>Object.fromEntries(['buffer','byteOffset','byteLength'].map(key=>[key,Object.getOwnPropertyDescriptor(proto,key).get])));
const bytesOf=value=>{
  if(!ArrayBuffer.isView(value)){const size=bufferLength.call(value);if(bufferResizable?.call(value))throw new TypeError('Resizable buffers are not Blob parts');return size?new Uint8Array(value,0,size):new Uint8Array();}
  let getters=viewGetters[0],buffer;try{buffer=getters.buffer.call(value);}catch{getters=viewGetters[1];buffer=getters.buffer.call(value);}
  const size=bufferLength.call(buffer);if(bufferResizable?.call(buffer))throw new TypeError('Resizable buffers are not Blob parts');return size?new Uint8Array(buffer,getters.byteOffset.call(value),getters.byteLength.call(value)):new Uint8Array();
};
const blobFrames=[],fileFrames=new WeakMap();
// Blob argument conversion retains backing data even when an options getter transfers its buffer.
const captureTransfer=buffer=>{
  const size=bufferLength.call(buffer);try{new Uint8Array(buffer);}catch{return {size,entries:[]};}
  const entries=[];
  for(const frame of blobFrames)for(const part of frame.parts){const source=frame.copies.get(part)??part;let owner=source;if(ArrayBuffer.isView(source)){try{owner=viewGetters[0].buffer.call(source);}catch{owner=viewGetters[1].buffer.call(source);}}if(owner===buffer){const view=bytesOf(source);entries.push({frame,part,offset:view.byteOffset,length:view.byteLength,copy:view.slice()});}}
  return {size,entries};
};
for(const name of ['transfer','transferToFixedLength']){
  const descriptor=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,name);if(!descriptor)continue;const native=descriptor.value;
  const wrapper=({[name](...args){
    if(!blobFrames.length)return Reflect.apply(native,this,args);
    let captured;
    if(args[0]===undefined)captured=captureTransfer(this);else{const argument=args[0],buffer=this;args[0]={valueOf(){const value=+argument;captured=captureTransfer(buffer);return value;}};}
    const result=Reflect.apply(native,this,args);
    for(const entry of captured.entries)entry.frame.copies.set(entry.part,result.byteLength===captured.size?new Uint8Array(result,entry.offset,entry.length):entry.copy);
    return result;
  }})[name];Object.defineProperty(wrapper,'length',{value:native.length});Object.defineProperty(ArrayBuffer.prototype,name,{...descriptor,value:wrapper});
}
const blobParts=(value,parts=[])=>{
  if(value===null||typeof value!=='object'&&typeof value!=='function')throw new TypeError('Blob parts must be a sequence');
  const iterator=value[Symbol.iterator]();if(iterator===null||typeof iterator!=='object'&&typeof iterator!=='function')throw new TypeError('Invalid iterator');const next=iterator.next;
  while(true){const step=Reflect.apply(next,iterator,[]);if(step===null||typeof step!=='object'&&typeof step!=='function')throw new TypeError('Invalid iterator result');if(step.done)return parts;const raw=step.value;if(sharedBuffer(raw))throw new TypeError('Shared buffers are not Blob parts');if(ArrayBuffer.isView(raw)||raw instanceof ArrayBuffer){bytesOf(raw);parts.push(raw);}else parts.push(isBlob(raw)?raw:domString(raw).toWellFormed());}
};
const blobOptions=(value,file=false)=>{
  if(value!==null&&typeof value!=='object'&&typeof value!=='function')throw new TypeError('Blob options must be a dictionary');
  const rawEndings=value?.endings,endings=rawEndings===undefined?'transparent':domString(rawEndings);if(!['transparent','native'].includes(endings))throw new TypeError('Invalid line endings');
  const rawModified=file?value?.lastModified:undefined,lastModified=rawModified===undefined?undefined:longLong(rawModified),rawType=value?.type,type=rawType===undefined?'':domString(rawType);
  return {endings,lastModified,type:/^[\x20-\x7e]*$/.test(type)?type.toLowerCase():''};
};
const sliceParts=(data,from,to)=>{
  const parts=[];let offset=0;
  for(const part of data.parts){const size=part.bytes?.length??part.size,start=Math.max(0,from-offset),end=Math.min(size,to-offset);if(end>start)parts.push(part.bytes?{bytes:part.bytes.subarray(start,end)}:{...part,offset:part.offset+start,size:end-start});offset+=size;if(offset>=to)break;}
  return parts;
};
const readParts=async(data,from=0,to=data.size)=>{
  if(to-from>kMaxLength)throw new RangeError('Blob exceeds the buffer limit');
  const bytes=new Uint8Array(to-from);let offset=0;
  for(const part of sliceParts(data,from,to)){
    if(part.bytes){bytes.set(part.bytes,offset);offset+=part.bytes.length;continue;}
    for(let start=0;start<part.size;start+=65536){const size=Math.min(65536,part.size-start),buffer=await part.read(part.id,part.offset+start,size);if(bufferLength.call(buffer)!==size)throw new Error('Invalid owned File chunk');const chunk=new Uint8Array(buffer);bytes.set(chunk,offset);offset+=size;}
  }
  return bytes;
};
const packetParts=data=>data.parts.map(part=>part.native?{bytes:nativeFiles.readSync(nativeFiles.slice(part.native,part.offset,part.offset+part.size))}:part.bytes?{bytes:Uint8Array.from(part.bytes).buffer}:{id:part.id,offset:part.offset,size:part.size});
class Blob {
  constructor(parts=[],options={}){
    const inherited=fileFrames.get(parts),frame=inherited??{parts:[],copies:new WeakMap()};if(inherited)fileFrames.delete(parts);else blobFrames.push(frame);
    try{
      const converted=inherited?frame.parts:blobParts(parts,frame.parts),settings=blobOptions(options),chunks=[];let size=0;
      for(const part of converted){const source=frame.copies.get(part)??part,data=blobData.get(source)??nativeFiles?.blob(source);if(data){size+=data.size;chunks.push(...data.parts);}else{const bytes=typeof source==='string'?Buffer.from(settings.endings==='native'?source.replace(/\r\n|\r|\n/g,nativeEndings):source,'utf8'):bytesOf(source).slice();size+=bytes.length;if(bytes.length)chunks.push({bytes});}if(size>kMaxLength)throw new RangeError('Blob exceeds the buffer limit');}
      if(nativeFiles&&chunks.every(part=>part.bytes||part.native))return nativeFiles.create(chunks,settings,inherited?.file,new.target);
      blobData.set(this,{parts:chunks,size,type:settings.type});
    }finally{if(!inherited)blobFrames.pop();}
  }
  get size(){return blobState(this).size;}
  get type(){return blobState(this).type;}
  slice(start=0,end=undefined,type=''){
    const data=blobState(this),size=data.size,first=sliceOffset(start),last=end===undefined?size:sliceOffset(end),contentType=domString(type),from=first<0?Math.max(size+first,0):Math.min(first,size),to=last<0?Math.max(size+last,0):Math.min(last,size),value=new Blob([],{type:contentType});
    const parts=sliceParts(data,from,Math.max(from,to)),settings={type:blobState(value).type};
    if(nativeFiles&&parts.every(part=>part.bytes||part.native))return nativeFiles.create(parts,settings,undefined,Blob);
    const result=nativeFiles?Object.create(Blob.prototype):value;blobData.set(result,{parts,size:Math.max(0,to-from),type:settings.type});return result;
  }
  async arrayBuffer(){return nativeFiles?.isBlob(this)?nativeFiles.arrayBuffer(this):(await readParts(blobState(this))).buffer;}
  async bytes(){return nativeFiles?.isBlob(this)?nativeFiles.read(this):readParts(blobState(this));}
  async text(){return nativeFiles?.isBlob(this)?nativeFiles.text(this):Buffer.from(await readParts(blobState(this))).toString('utf8').replace(/^\uFEFF/,'');}
  stream(){
    const data=blobState(this);let offset=0,cancelled=false;
    return new webStreams.ReadableStream({type:'bytes',async pull(controller){if(offset===data.size){controller.close();controller.byobRequest?.respond(0);return;}const end=Math.min(offset+65536,data.size),bytes=await readParts(data,offset,end);if(cancelled)return;controller.enqueue(bytes);offset=end;if(offset===data.size)controller.close();},cancel(){cancelled=true;}});
  }
  textStream(){
    const stream=Blob.prototype.stream.call(this),decoder=new StringDecoder('utf8');let first=true;
    const emit=(text,controller)=>{if(!text)return;if(first){text=text.replace(/^\uFEFF/,'');first=false;}if(text)controller.enqueue(text);};
    return stream.pipeThrough(new webStreams.TransformStream({transform(chunk,controller){emit(decoder.write(Buffer.from(chunk)),controller);},flush(controller){emit(decoder.end(),controller);}}));
  }
}
class File extends Blob {
  constructor(bits,name,options={}){
    if(arguments.length<2)throw new TypeError('File requires two arguments');const frame={parts:[],copies:new WeakMap()};blobFrames.push(frame);
    try{const parts=blobParts(bits,frame.parts),filename=domString(name).toWellFormed(),settings=blobOptions(options,true);frame.file={name:filename,lastModified:settings.lastModified===undefined?Date.now():settings.lastModified};fileFrames.set(parts,frame);super(parts,settings);fileData.set(this,frame.file);}finally{blobFrames.pop();}
  }
  get name(){return fileState(this).name;}
  get lastModified(){return fileState(this).lastModified;}
  get webkitRelativePath(){return fileState(this).relativePath??'';}
}
const ownedFiles=new Map(),nativeFileIds=new WeakMap(),fileTokens=new WeakMap();let fileSequence=0;
Object.defineProperty(globalThis,'__pluginFileModule',{value:Object.freeze({
  ...(readFileSync?{readSync(value){
    if(nativeFiles?.isBlob(value))return nativeFiles.readSync(value);
    const data=blobState(value);if(data.size>128*1024*1024)throw Error('Plugin synchronous File read exceeds the 128 MiB limit');
    const bytes=new Uint8Array(data.size);let offset=0;
    for(const part of data.parts){
      if(part.bytes){bytes.set(part.bytes,offset);offset+=part.bytes.length;continue;}
      if(part.native){const buffer=nativeFiles.readSync(nativeFiles.slice(part.native,part.offset,part.offset+part.size));bytes.set(new Uint8Array(buffer),offset);offset+=buffer.byteLength;continue;}
      for(let start=0;start<part.size;start+=65536){const length=Math.min(65536,part.size-start),buffer=readFileSync(part.id,part.offset+start,length);if(bufferLength.call(buffer)!==length)throw Error('Invalid owned File chunk');bytes.set(new Uint8Array(buffer),offset);offset+=length;}
    }
    return bytes.buffer;
  }}:{}),
  objectURLPacket(value){const data=blobState(value);if(nativeFiles?.isBlob(value))return {bytes:nativeFiles.readSync(value),type:data.type};if(data.parts.every(part=>part.bytes)){const bytes=new Uint8Array(data.size);let offset=0;for(const part of data.parts){bytes.set(part.bytes,offset);offset+=part.bytes.length;}return {bytes:bytes.buffer,type:data.type};}return {type:data.type,parts:packetParts(data)};},
  isOwned:value=>blobData.has(value),
  isBlob,
  read:(value,from,to)=>nativeFiles?.isBlob(value)?nativeFiles.read(value,from,to):readParts(blobState(value),from,to),
  info:value=>{const data=blobState(value);return {size:data.size,type:data.type};},
  binary:bytes=>Buffer.from(bytes).toString('latin1'),
  dataURL:(bytes,type)=>'data:'+(type||'application/octet-stream')+';base64,'+Buffer.from(bytes).toString('base64'),
  isFile,
  describe(value){const file=fileState(value),blob=blobState(value);return {name:file.name,type:blob.type,size:blob.size,lastModified:file.lastModified};},
  serialize(value){const file=fileState(value),blob=blobState(value);if(nativeFileIds.has(value))return {reference:nativeFileIds.get(value)};if(!fileTokens.has(value))fileTokens.set(value,++fileSequence);return {token:fileTokens.get(value),name:file.name,type:blob.type,lastModified:file.lastModified,parts:packetParts(blob)};},
  bind(id,value){fileState(value);if(!Number.isSafeInteger(id)||id<=0)throw new TypeError('Invalid owned File handle');if(!ownedFiles.has(id))ownedFiles.set(id,value);},
  adopt(packet,read){
    if(!packet||Object.keys(packet).sort().join(',')!=='id,lastModified,name,relativePath,size,type'||!Number.isSafeInteger(packet.id)||packet.id<=0||!Number.isSafeInteger(packet.size)||packet.size<0||!Number.isFinite(packet.lastModified)||!['name','type','relativePath'].every(key=>typeof packet[key]==='string')||typeof read!=='function')throw new TypeError('Invalid owned File');
    if(ownedFiles.has(packet.id))return ownedFiles.get(packet.id);
    const file=Object.create(File.prototype);blobData.set(file,{parts:packet.size?[{id:packet.id,offset:0,size:packet.size,read}]:[],size:packet.size,type:packet.type});fileData.set(file,{name:packet.name,lastModified:packet.lastModified,relativePath:packet.relativePath});ownedFiles.set(packet.id,file);nativeFileIds.set(file,packet.id);return file;
  },
})});
for(const [name,ctor,length]of [['Blob',Blob,0],['File',File,2]]){
  Object.defineProperty(ctor,'name',{value:name});Object.defineProperty(ctor,'length',{value:length});Object.defineProperty(ctor.prototype,Symbol.toStringTag,{value:name,configurable:true});
  for(const key of Object.getOwnPropertyNames(ctor.prototype))if(key!=='constructor')Object.defineProperty(ctor.prototype,key,{...Object.getOwnPropertyDescriptor(ctor.prototype,key),enumerable:true});
  if(!nativeFiles)Object.defineProperty(globalThis,name,{value:ctor,writable:false,configurable:false});
}

return {Blob,File};
}
