import {parse} from 'yaml';
import {descendants} from './model.js';
/** @param {string} type */
export function pluginActionKind(type){
  if(['request','websocket_request','grpc_request'].includes(type))return 'requestActions';
  if(type==='request_group')return 'requestGroupActions';
  if(type==='workspace')return 'workspaceActions';
  if(type==='api_spec')return 'documentActions';
  throw Error('This resource does not support plugin actions');
}
/** Match the archived action argument shapes without exposing host resources.
 * The callback codec detaches the result before guest execution.
 * @param {Record<string,any>[]} resources @param {string} resourceId */
export function pluginActionInput(resources,resourceId){
  const resource=resources.find(item=>item._id===resourceId);
  if(!resource)throw Error('Plugin action resource no longer exists');
  if(['request','websocket_request','grpc_request'].includes(resource._type))return {kind:'requestActions',args:{request:resource}};
  if(resource._type==='request_group')return {kind:'requestGroupActions',args:{requestGroup:resource,
    requests:resources.filter(item=>item._type==='request'&&item.parentId===resourceId).sort((a,b)=>a.metaSortKey-b.metaSortKey)}};
  if(resource._type==='workspace'){
    const ids=descendants(resources,resourceId),docs=resources.filter(item=>ids.has(item._id));
    return {kind:'workspaceActions',args:{workspace:resource,requests:docs.filter(item=>item._type==='request'&&!item.isPrivate),requestGroups:docs.filter(item=>item._type==='request_group')}};
  }
  if(resource._type==='api_spec'){
    const rawContents=resource.contents||'';
    let contents;
    try{contents=parse(rawContents);}catch{throw Error('Failed to parse API spec');}
    return {kind:'documentActions',args:{contents,rawContents,
      format:contents?.openapi?'openapi':contents?.swagger?'swagger':null,
      formatVersion:contents?.openapi||contents?.swagger||null}};
  }
  throw Error('This resource does not support plugin actions');
}

/** Fingerprint raw document text without reparsing it or serializing YAML cycles.
 * @param {Record<string,any>[]} resources @param {string} resourceId */
export function pluginActionSourceKey(resources,resourceId){
  const resource=resources.find(item=>item._id===resourceId);
  return JSON.stringify(resource?._type==='api_spec'?resource:pluginActionInput(resources,resourceId).args);
}
