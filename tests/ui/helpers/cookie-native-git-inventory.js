import assert from "node:assert/strict";
import { readFile, lstat, realpath, open, opendir } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { createHash } from "node:crypto";

export const cookieGitMetadataSha256 = "fdcb53ab7bc5511fbc73bba59adccc80c6729370621530e2efca6ae77a2c2b43";
const canonical=(/** @type {string} */ path)=>resolve(path).toLowerCase();
const hash=(/** @type {Uint8Array} */ bytes)=>createHash("sha256").update(bytes).digest("hex");
const verifiedPins=new WeakSet();
/** @param {string} path */
function relativePath(path){assert.equal(typeof path,"string");assert.ok(path&&!path.includes("\\")&&!path.includes(":"));assert.ok(path.split("/").every(part=>part&&part!=="."&&part!==".."));return path;}

/** Exact owner-reviewed baseline, no wildcard/prefix/file filtering.
 * @param {string} root @param {string} pinPath @param {string} expectedSha256 */
export async function readCookieGitMetadata(root,pinPath,expectedSha256){
  assert.equal(expectedSha256,cookieGitMetadataSha256,"Explicit reviewed metadata SHA required");
  const path=resolve(pinPath);assert.ok(path.startsWith(resolve("artifacts")+sep));
  const info=await lstat(path);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=16*1024*1024);
  assert.equal(canonical(await realpath(path)),canonical(path));
  const bytes=await readFile(path);assert.equal(hash(bytes),cookieGitMetadataSha256,"Reject unreviewed Git baseline");
  const pin=JSON.parse(bytes.toString());assert.equal(pin.identifier,"app.insomnium.probe.checkout20260929");
  assert.equal(pin.metadataOnly,true);assert.equal(canonical(pin.root),canonical(root));
  assert.equal(pin.fileCount,13783);assert.equal(pin.files.length,13783);assert.equal(pin.directories.length,15865);
  assert.equal(pin.bytes,8504236);assert.equal(pin.maximum,2164811);
  const files=new Map();let total=0,maximum=0;
  for(const file of pin.files){relativePath(file.path);assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0);assert.ok(!files.has(file.path));files.set(file.path,file.bytes);total+=file.bytes;maximum=Math.max(maximum,file.bytes);}
  assert.equal(total,pin.bytes);assert.equal(maximum,pin.maximum);
  assert.equal(new Set(pin.directories).size,pin.directories.length);assert.equal(pin.directories[0],"");
  for(const directory of pin.directories.slice(1))relativePath(directory);
  pin.files.forEach(Object.freeze);Object.freeze(pin.files);Object.freeze(pin.directories);Object.freeze(pin);verifiedPins.add(pin);return pin;
}

/** One64KiB buffer and file descriptor; no whole-file allocation.
 * @param {string} path @param {number} expectedBytes */
export async function streamCookieGitFile(path,expectedBytes){
  const before=await lstat(path);assert.ok(before.isFile()&&!before.isSymbolicLink());
  assert.equal(before.size,expectedBytes);assert.equal(canonical(await realpath(path)),canonical(path));
  const file=await open(path,"r"),digest=createHash("sha256"),buffer=Buffer.alloc(65536);let bytes=0;
  const stable=(/** @type {import('node:fs').Stats} */ actual)=>{
    for(const key of /** @type {const} */(["size","mtimeMs","ctimeMs","ino","dev"]))assert.equal(actual[key],before[key],"File changed during streamed inventory: "+path);
    assert.ok(actual.isFile());
  };
  try{
    stable(await file.stat());
    while(bytes<expectedBytes){const result=await file.read(buffer,0,Math.min(buffer.length,expectedBytes-bytes),bytes);assert.ok(result.bytesRead>0);digest.update(buffer.subarray(0,result.bytesRead));bytes+=result.bytesRead;}
    const tail=await file.read(buffer,0,1,bytes);assert.equal(tail.bytesRead,0);stable(await file.stat());
    const after=await lstat(path);assert.ok(!after.isSymbolicLink());stable(after);assert.equal(canonical(await realpath(path)),canonical(path));
    assert.equal(bytes,expectedBytes);return digest.digest("hex");
  }finally{await file.close();}
}

/** Validate complete metadata BEFORE reading content. Unknown/missing paths fail.
 * @param {string} root @param {any} pin */
export async function inventoryCookieGit(root,pin){
  assert.ok(verifiedPins.has(pin),"Only verified detached pinned metadata may authorize Git reads");
  assert.equal(canonical(pin.root),canonical(root));
  const allowedFiles=new Map(pin.files.map((/** @type {any} */ file)=>[file.path,file.bytes])),allowedDirectories=new Set(pin.directories);
  const seenFiles=new Set(),seenDirectories=new Set();let total=0;
  const walk=async(/** @type {string} */ path,/** @type {string} */ prefix)=>{
    assert.ok(allowedDirectories.has(prefix),"Unknown Git directory: "+prefix);assert.ok(!seenDirectories.has(prefix));seenDirectories.add(prefix);
    const info=await lstat(path);assert.ok(info.isDirectory()&&!info.isSymbolicLink());assert.equal(canonical(await realpath(path)),canonical(path));
    const directory=await opendir(path);
    for await(const entry of directory){
      const name=prefix?prefix+"/"+entry.name:entry.name,child=join(path,entry.name),stat=await lstat(child);assert.ok(!stat.isSymbolicLink());
      if(stat.isDirectory())await walk(child,name);
      else{assert.ok(stat.isFile());assert.ok(allowedFiles.has(name),"Unknown Git file: "+name);assert.ok(!seenFiles.has(name));assert.equal(stat.size,allowedFiles.get(name));seenFiles.add(name);total+=stat.size;assert.ok(total<=pin.bytes);}
    }
  };
  await walk(root,"");assert.equal(seenFiles.size,pin.fileCount);assert.equal(seenDirectories.size,pin.directories.length);assert.equal(total,pin.bytes);
  const result=/** @type {Record<string,string>} */ ({});
  for(const file of pin.files)result[file.path]=await streamCookieGitFile(join(root,...file.path.split("/")),file.bytes);
  seenFiles.clear();seenDirectories.clear();total=0;await walk(root,"");assert.equal(seenFiles.size,pin.fileCount);assert.equal(seenDirectories.size,pin.directories.length);assert.equal(total,pin.bytes);
  return result;
}
