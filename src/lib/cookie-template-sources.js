const marker = '_activeTemplateCookieSource';
const hasTemplate = (/** @type {string} */ value) => /{{|{%/.test(value);

/** Explicitly activated sources, never ordinary imported restore records.
 * @param {Record<string,any>[]} resources @param {string} workspaceId */
export function cookieTemplateSources(resources, workspaceId) {
  return resources.filter(r=>r._type==='cookie_jar' && r.parentId===workspaceId && r[marker]===true)
    .flatMap(r=>Array.isArray(r.cookies)?JSON.parse(JSON.stringify(r.cookies)):[]);
}

/** Validate source structure without evaluating templates.
 * @param {unknown} input @returns {Record<string,any>[]} */
export function normalizeCookieTemplateSources(input) {
  if(!Array.isArray(input) || input.length>10000) throw Error('Use an array of at most 10,000 cookie sources.');
  if(new TextEncoder().encode(JSON.stringify(input)).length>8*1024*1024) throw Error('Cookie sources exceed 8 MiB.');
  return input.map((source,index)=>{
    const fail=(/** @type {string} */ reason)=>{throw Error(`Cookie source #${index+1}: ${reason}`);};
    if(!source || typeof source!=='object' || Array.isArray(source)) return fail('expected an object.');
    for(const field of ['key','value','domain','path'])
      if(typeof source[field]!=='string') return fail(`${field} must be text.`);
    if(!source.key || !source.domain || !source.path) return fail('key, domain and path are required.');
    for(const field of ['hostOnly','secure','httpOnly','pathIsDefault'])
      if(source[field]!=null && typeof source[field]!=='boolean') return fail(`${field} must be boolean.`);
    if(source.maxAge!=null) return fail('use an absolute expires date; Max-Age cannot restart on each Send.');
    if(source.partitioned || source.partitionKey || source.extensions?.length)
      return fail('partitioned cookies and custom extensions require manual migration.');
    const expires=source.expires??'Infinity';
    if(typeof expires!=='string') return fail('expires must be text or "Infinity".');
    if(expires!=='Infinity' && !hasTemplate(expires) && !Number.isFinite(Date.parse(expires)))
      return fail('invalid expiry date.');
    if(source.sameSite!=null && !['strict','lax','none'].includes(source.sameSite)) return fail('invalid sameSite.');
    return {key:source.key,value:source.value,domain:source.domain,path:source.path,
      expires,hostOnly:source.hostOnly===true,secure:source.secure===true,httpOnly:source.httpOnly===true,
      pathIsDefault:source.pathIsDefault===true,...(source.sameSite?{sameSite:source.sameSite}:{})};
  });
}

/** @param {Record<string,any>[]} resources @param {string} workspaceId
 * @param {Record<string,any>[]} cookies */
export function replaceCookieTemplateSources(resources, workspaceId, cookies) {
  const existing=resources.find(r=>r._type==='cookie_jar'&&r.parentId===workspaceId&&r[marker]===true);
  const result=resources.filter(r=>!(r._type==='cookie_jar'&&r.parentId===workspaceId&&r[marker]===true));
  if(cookies.length) result.push({...existing,_id:existing?._id??'jar_'+crypto.randomUUID().replaceAll('-',''),
    _type:'cookie_jar',parentId:workspaceId,name:'Active template cookie sources',
    created:existing?.created??Date.now(),modified:Date.now(),[marker]:true,cookies:structuredClone(cookies)});
  return result;
}

/** Merge only activated sources into the private per-request snapshot. Sources
 * override matching native cookies after rendering, without entering live storage.
 * @param {{generation:number,cookies:Record<string,any>[]}} snapshot
 * @param {Record<string,any>[]} resources @param {string} workspaceId */
export function withCookieTemplateSources(snapshot,resources,workspaceId) {
  const sources=normalizeCookieTemplateSources(cookieTemplateSources(resources,workspaceId));
  return {...snapshot,cookies:[...snapshot.cookies,...sources.map(source=>({
    key:source.key,value:source.value,domain:source.hostOnly?{HostOnly:source.domain}:{Suffix:source.domain},
    path:[source.path,!source.pathIsDefault],
    expires:source.expires==='Infinity'?'SessionEnd':{AtUtc:source.expires},
    secure:source.secure,httpOnly:source.httpOnly,...(source.sameSite?{sameSite:source.sameSite}:{})}))]};
}

/** Canonicalize rendered source scopes before native deserialization. Native
 * entries use the same representation and retain generation metadata.
 * @param {Record<string,any>|null} snapshot */
export function normalizeRenderedCookieSnapshot(snapshot) {
  if(!snapshot)return null;
  return {...snapshot,cookies:snapshot.cookies.map((/** @type {Record<string,any>} */ cookie)=>{
    const hostOnly=typeof cookie.domain?.HostOnly==='string';
    let domain=hostOnly?cookie.domain.HostOnly:cookie.domain?.Suffix;
    if(typeof domain!=='string'||!domain||/[\s/\\?#@;%]/.test(domain)) throw Error('Invalid rendered cookie domain.');
    domain=domain.replace(/^\./,'');
    const host=domain.includes(':')&&!domain.startsWith('[')?`[${domain}]`:domain;
    const url=new URL(`https://${host}/`);
    if(url.port||url.pathname!=='/'||!url.hostname)throw Error('Invalid rendered cookie domain.');
    if(!Array.isArray(cookie.path)||typeof cookie.path[0]!=='string'||!cookie.path[0].startsWith('/')||/[\x00-\x1f\x7f;]/.test(cookie.path[0]))
      throw Error('Invalid rendered cookie path.');
    let expires=cookie.expires;
    if(expires!=='SessionEnd'){
      const date=new Date(expires?.AtUtc);
      if(!Number.isFinite(date.getTime())||date.getUTCFullYear()>9999)throw Error('Invalid rendered cookie expiry.');
      expires={AtUtc:date.toISOString()};
    }
    return {...cookie,domain:hostOnly?{HostOnly:url.hostname}:{Suffix:url.hostname},expires};
  })};
}
