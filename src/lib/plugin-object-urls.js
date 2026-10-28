/** One VM's WebView Blob URLs. Lazy files retain their DOM owner's release hook. */
export function createPluginObjectURLs(){
 const urls=new Map(/** @type {[string,{bytes:number,release?:()=>void}][]} */([]));
 const uploads=new Map(/** @type {[number,{size:number,type:string,received:number,parts:ArrayBuffer[]}][]} */([]));
 let bytes=0,nextUpload=0;
 const assertCapacity=(/** @type {number} */size=0)=>{if(urls.size+uploads.size>=2048)throw Error('Plugin object URL handle limit exceeded');if(!Number.isSafeInteger(size)||size<0||size>128*1024*1024-bytes)throw Error('Plugin object URL byte limit exceeded');};
 const release=(/** @type {string} */value,notify=true)=>{let url;try{url=new URL(value).href;}catch{return;}const entry=urls.get(url);if(!entry)return;urls.delete(url);bytes-=entry.bytes;URL.revokeObjectURL(url);if(notify)entry.release?.();};
 return Object.freeze({
  assertCapacity,release,
  /** @param {string} url @param {number} size @param {()=>void} onRelease */
  adopt(url,size,onRelease){assertCapacity(size);if(typeof url!=='string'||!url.startsWith('blob:')||urls.has(url))throw Error('Invalid owned Bun Blob URL');urls.set(url,{bytes:size,release:onRelease});bytes+=size;},
  /** @param {string} method @param {any[]} args */
  call(method,args){
   if(!Array.isArray(args))throw Error('Invalid Bun object URL arguments');
   if(method==='begin'){
    if(args.length!==2||typeof args[1]!=='string')throw Error('Invalid Bun Blob URL');assertCapacity(args[0]);if(!Number.isSafeInteger(++nextUpload))throw Error('Bun Blob upload limit exceeded');
    uploads.set(nextUpload,{size:args[0],type:args[1],received:0,parts:[]});bytes+=args[0];return nextUpload;
   }
   if(method==='revoke'){if(args.length!==1||typeof args[0]!=='string')throw Error('Invalid Bun object URL revoke');release(args[0]);return;}
   const upload=uploads.get(args[0]);if(!upload)throw Error('Bun Blob upload is unavailable');
   if(method==='chunk'){
    const part=args[1];if(args.length!==2||!(part instanceof ArrayBuffer)||!part.byteLength||part.byteLength>262144||part.byteLength>upload.size-upload.received)throw Error('Invalid Bun Blob chunk');upload.parts.push(part);upload.received+=part.byteLength;
   }else if(method==='commit'){
    if(args.length!==1||upload.received!==upload.size)throw Error('Incomplete Bun Blob upload');const url=URL.createObjectURL(new Blob(upload.parts,{type:upload.type}));uploads.delete(args[0]);urls.set(url,{bytes:upload.size});return url;
   }else if(method==='abort'){
    if(args.length!==1)throw Error('Invalid Bun Blob abort');uploads.delete(args[0]);bytes-=upload.size;
   }else throw Error('Unsupported Bun object URL operation');
  },
  dispose(){for(const url of urls.keys())release(url);uploads.clear();bytes=0;},
 });
}
