import {stringify} from 'yaml';
import {descendants,workspaceFor} from './model.js';
const requestTypes=['request','grpc_request','websocket_request'];
const extras=['cookie_jar','environment','api_spec','unit_test_suite','unit_test','proto_file','proto_directory','websocket_payload'];
/** Legacy plugin export returns text; it never opens a file dialog or mutates data.
 * @param {{resources:Record<string,any>[]}} data @param {any[]} args */
export function exportPluginInsomnia(data,args){
  if(args.length>1)throw Error('Invalid plugin export arguments');
  const options=args[0]===undefined?{}:args[0];
  if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Invalid plugin export options');
  const format=options.format||'json',includePrivate=Boolean(options.includePrivate);
  if(typeof format!=='string'||!['json','yaml'].includes(format.toLowerCase()))throw Error('Invalid export format. Must be "json" or "yaml"');
  const resources=data.resources;
  const selected=options.workspace;
  if(selected!==undefined&&(!selected||typeof selected._id!=='string'||!resources.some(r=>r._id===selected._id&&r._type==='workspace')))throw Error('Plugin export workspace no longer exists');
  const workspaces=new Set(resources.filter(r=>r._type==='workspace'&&(!selected||r._id===selected._id)).map(r=>r._id));
  const docs=/** @type {Record<string,any>[]} */([]),seen=new Set(),usedWorkspaces=new Set();
  /** @param {Record<string,any>} resource */
  const add=resource=>{if(!seen.has(resource._id)){seen.add(resource._id);docs.push(resource);if(resource._type==='workspace')usedWorkspaces.add(resource._id);}};
  for(const request of resources.filter(r=>requestTypes.includes(r._type)&&(!r.isPrivate||includePrivate)&&workspaces.has(workspaceFor(resources,r._id)))){
    const visited=new Set();let current=/** @type {Record<string,any>|undefined} */(request);
    while(current&&!visited.has(current._id)){
      visited.add(current._id);add(current);
      const parentId=current.parentId;
      current=resources.find(r=>r._id===parentId);
    }
  }
  for(const workspaceId of usedWorkspaces){
    const ids=descendants(resources,workspaceId);
    resources.filter(r=>ids.has(r._id)&&extras.includes(r._type)).forEach(add);
  }
  const exported=docs.filter(r=>(requestTypes.includes(r._type)||['workspace','request_group',...extras].includes(r._type))&&(!r.isPrivate||includePrivate)).map(resource=>{
    const copy=structuredClone(resource);delete copy.type;
    if(copy._type==='workspace')copy.parentId=null;
    return copy;
  });
  const output={_type:'export',__export_format:4,__export_date:new Date().toISOString(),__export_source:'insomnium.tauri:0.1.0',resources:exported};
  return format.toLowerCase()==='yaml'?stringify(output):JSON.stringify(output);
}
