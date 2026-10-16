/** Resolve modules using only the admitted text snapshot; never host filesystem.
 * @param {Record<string,string>} files @param {string} request @param {string} parent @param {'require'|'import'} [mode] @param {number} [resolutionDepth] */
export function resolvePluginModule(files, request, parent, mode='require',resolutionDepth=0) {
  if(resolutionDepth>32)throw Error('Package resolution nesting exceeds its limit');
  if(request==='buffer'||request==='node:buffer')return 'insomnium:buffer';
  if(request==='url'||request==='node:url')return 'insomnium:url';
  if(request==='events'||request==='node:events')return 'insomnium:events';
  if(request==='string_decoder'||request==='node:string_decoder')return 'insomnium:string_decoder';
  if(request==='stream'||request==='node:stream')return 'insomnium:stream';
  if(request==='stream/promises'||request==='node:stream/promises')return 'insomnium:stream/promises';
  const own = (/** @type {string} */ path) => Object.hasOwn(files, path);
  const normalize = (/** @type {string} */ path) => {
    const parts = [];
    for (const part of path.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!parts.length) throw Error("Module path escapes the package");
        parts.pop();
      } else parts.push(part);
    }
    return parts.join("/");
  };
  const file = (/** @type {string} */ path) =>
    [path, path + ".js", path + ".json", path + ".node"].find(own);
  const index = (/** @type {string} */ path) =>
    ["js", "json", "node"]
      .map((suffix) => (path ? path + "/" : "") + "index." + suffix)
      .find(own);
  const lookup = (/** @type {string} */ path) => {
    const direct = file(path);
    if (direct) return direct;
    const manifestPath = (path ? path + "/" : "") + "package.json";
    if (own(manifestPath)) {
      const manifest = JSON.parse(files[manifestPath]);
      if (manifest.main) {
        if (
          typeof manifest.main !== "string" ||
          /[:\\]|^\//.test(manifest.main)
        )
          throw Error("Invalid module main path");
        const main = normalize((path ? path + "/" : "") + manifest.main);
        const found = file(main) || index(main);
        if (found) return found;
      }
    }
    return index(path);
  };
  /** @param {string} root @param {any} exports @param {string} subpath @param {boolean} [internal] */
  const exported=(root,exports,subpath,internal=false)=>{
    let mapping=exports,pattern='';
    if(internal&&(!mapping||typeof mapping!=='object'||Array.isArray(mapping)))throw Error('Invalid package imports map');
    if(mapping&&typeof mapping==='object'&&!Array.isArray(mapping)){
      const keys=Object.keys(mapping),paths=keys.filter(key=>key.startsWith(internal?'#':'.'));
      if(paths.length&&paths.length!==keys.length)throw Error('Invalid mixed package exports');
      if(paths.length){
        if(Object.hasOwn(mapping,subpath))mapping=mapping[subpath];
        else{
          const key=paths.filter(key=>key.includes('*')&&key.indexOf('*')===key.lastIndexOf('*'))
            .sort((a,b)=>b.indexOf('*')-a.indexOf('*')||b.length-a.length)
            .find(key=>{const [prefix,suffix]=key.split('*');return subpath.startsWith(prefix)&&subpath.endsWith(suffix)&&subpath.length>=prefix.length+suffix.length;});
          if(!key)throw Error('Package subpath is not exported: '+request);
          const [prefix,suffix]=key.split('*');pattern=subpath.slice(prefix.length,subpath.length-suffix.length);mapping=mapping[key];
        }
      }else if(subpath!=='.')throw Error('Package subpath is not exported: '+request);
    }else if(subpath!=='.')throw Error('Package subpath is not exported: '+request);
    /** @param {any} value @param {number} depth @returns {string|null|undefined} */
    const select=(value,depth)=>{
      if(depth>32)throw Error('Package exports nesting exceeds its limit');
      if(value===null)return null;
      if(typeof value==='string'){
        const target=value.replaceAll('*',pattern);
        if(internal&&!target.startsWith('./')){
          if(target.startsWith('../')||target.startsWith('/'))throw Error('Invalid package import target');
          return resolvePluginModule(files,target,root?root+'/package.json':'package.json',mode,resolutionDepth+1);
        }
        if(!target.startsWith('./')||/[:\\?#]/.test(target))throw Error('Invalid package export target');
        const parts=target.slice(2).split('/').map(part=>decodeURIComponent(part));
        if(parts.some(part=>part==='.'||part==='..'||part.toLowerCase()==='node_modules'||/[\\/\0]/.test(part)))throw Error('Invalid package export target');
        return normalize(root+'/'+parts.join('/'));
      }
      if(Array.isArray(value)){
        let failure;
        for(const item of value){try{const result=select(item,depth+1);if(result!=null)return result;}catch(error){failure=error;}}
        if(failure)throw failure;
        return null;
      }
      if(value&&typeof value==='object'){
        for(const key of Object.keys(value)){
          if(key.startsWith('.')||/^(0|[1-9]\d*)$/.test(key))throw Error('Invalid package export condition');
          if(['node','node-addons','default',mode].includes(key)){
            const result=select(value[key],depth+1);if(result!==undefined)return result;
          }
        }
        return undefined;
      }
      throw Error('Invalid package export target');
    };
    const target=select(mapping,0);
    if(target==null)throw Error('Package subpath is not exported: '+request);
    if(!own(target)&&!(internal&&target.startsWith('insomnium:')))throw Error('Exported module is unavailable in the package snapshot: '+request);
    return target;
  };
  if (
    typeof request !== "string" ||
    !request ||
    request.length > 8192 ||
    /[:\\]|^\//.test(request)
  )
    throw Error("Unsupported module identifier");
  const directory = parent.split("/").slice(0, -1).join("/");
  let scope;
  const scopeParts=directory?directory.split('/'):[];
  for(;;){
    if(scopeParts.at(-1)==='node_modules')break;
    const root=scopeParts.join('/'),path=(root?root+'/':'')+'package.json';
    if(own(path)){scope={root,manifest:JSON.parse(files[path])};break;}
    if(!scopeParts.length)break;
    scopeParts.pop();
  }
  if(request.startsWith('#')){
    if(request==='#'||request.startsWith('#/'))throw Error('Invalid package import identifier');
    if(!scope?.manifest.imports)throw Error('Package import is not defined: '+request);
    return exported(scope.root,scope.manifest.imports,request,true);
  }
  if (request.startsWith(".")) {
    const found = lookup(
      normalize((directory ? directory + "/" : "") + request),
    );
    if (found) return found;
  } else {
    if (
      !/^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(
        request,
      )
    )
      throw Error("Unsupported dependency identifier");
    const parts = directory ? directory.split("/") : [];
    const segments=request.split('/'),count=request.startsWith('@')?2:1;
    const packageName=segments.slice(0,count).join('/'),subpath=segments.length===count?'.':'./'+segments.slice(count).join('/');
    if(scope?.manifest.name===packageName&&scope.manifest.exports!=null)return exported(scope.root,scope.manifest.exports,subpath);
    for (;;) {
      const root=(parts.length?parts.join('/')+'/':'')+'node_modules/'+packageName;
      if(own(root+'/package.json')){
        const manifest=JSON.parse(files[root+'/package.json']);
        if(manifest.exports!=null)return exported(root,manifest.exports,subpath);
      }
      const found = lookup(
        (parts.length ? parts.join("/") + "/" : "") + "node_modules/" + request,
      );
      if (found) return found;
      if (!parts.length) break;
      parts.pop();
    }
  }
  throw Error("Module is unavailable in the package snapshot: " + request);
}

/** @param {Record<string,string>} files @param {string} path */
export function pluginModuleFormat(files, path) {
  if (path.endsWith(".mjs")) return "module";
  if (path.endsWith(".cjs")) return "commonjs";
  if (path.endsWith(".json")) return "json";
  if (!path.endsWith(".js")) throw Error("Unsupported module source: " + path);
  const parts = path.split("/").slice(0, -1);
  for (;;) {
    if (parts.at(-1) === "node_modules") return "commonjs";
    const manifest =
      (parts.length ? parts.join("/") + "/" : "") + "package.json";
    if (Object.hasOwn(files, manifest))
      return JSON.parse(files[manifest]).type === "module"
        ? "module"
        : "commonjs";
    if (!parts.length) return "commonjs";
    parts.pop();
  }
}
