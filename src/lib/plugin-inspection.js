import {createPluginValueCodec} from './plugin-values.js';

/** Child metadata is data, never evidence of callback or helper authority.
 * @param {any} reply */
export function decodePluginInspection(reply) {
  const fail=()=>{throw Error('Invalid Bun plugin inspection metadata');};
  if(!reply||typeof reply.wire!=='string'||reply.wire.length>256*1024||typeof reply.snapshot?.name!=='string')fail();
  const metadata=createPluginValueCodec().decode(reply.wire);
  const kinds=['templateTags','requestHooks','responseHooks','themes','requestGroupActions','requestActions','workspaceActions','documentActions'];
  const text=(/** @type {any} */ value,/** @type {number} */ max)=>typeof value==='string'&&value.length<=max;
  if(!metadata||metadata.name!==reply.snapshot.name||!Array.isArray(metadata.contributions)||metadata.contributions.length>8||!Array.isArray(metadata.unknownExports)||metadata.unknownExports.length>64||!metadata.unknownExports.every((/** @type {any} */ key)=>text(key,8192)))fail();
  const seen=new Set();
  for(const group of metadata.contributions){
    if(!kinds.includes(group?.kind)||seen.has(group.kind)||!Array.isArray(group.items)||group.items.length>64||group.count!==group.items.length)fail();
    seen.add(group.kind);
    group.items.forEach((/** @type {any} */ item,/** @type {number} */ index)=>{
      if(!item||item.index!==index)fail();
      if(group.kind.endsWith('Hooks'))return;
      if(!text(item.name,256)||!text(item.label,1024))fail();
      if(group.kind==='themes'&&(!item.name||item.definition?.name!==item.name||!item.definition.theme||typeof item.definition.theme!=='object'||Array.isArray(item.definition.theme)))fail();
      if(group.kind==='templateTags'&&(item.definition?.name!==item.name||!Array.isArray(item.definition.args)||item.definition.args.length>32))fail();
      if(group.kind==='documentActions'&&typeof item.hideAfterClick!=='boolean')fail();
    });
  }
  return {snapshot:reply.snapshot,metadata};
}

/** Explicit R0 inspector; the production registry still selects QuickJS.
 * @param {string} directory @param {{signal?:AbortSignal}} [options] */
export async function inspectBunPluginPackage(directory,options={}) {
  if(options.signal?.aborted)throw new DOMException('Plugin inspection cancelled','AbortError');
  const {openBunPluginSession}=await import('./plugin-bun-session.js');
  const session=await openBunPluginSession(directory,{isCurrent:()=>!options.signal?.aborted,signal:options.signal});
  try{return {snapshot:session.snapshot,metadata:session.metadata};}
  finally{await session.dispose();}
}
