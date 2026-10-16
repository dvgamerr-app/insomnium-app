import {pluginJarCookies} from './plugin-cookie-jar.js';
/** @param {any[]} headers */
const rows=headers=>headers.map(row=>({name:Array.isArray(row)?row[0]:row.name,value:Array.isArray(row)?row[1]:row.value})).filter(row=>row.name);
/** @param {any} snapshot @param {string} target */
function requestCookies(snapshot,target){
  if(!snapshot)return [];
  const url=new URL(target),path=url.pathname||'/';
  return pluginJarCookies(snapshot).filter(cookie=>{
    const domain=cookie.domain.replace(/^\./,'').toLowerCase(),host=url.hostname.toLowerCase();
    return (cookie.hostOnly?host===domain:host===domain||host.endsWith('.'+domain))&&
      (!cookie.secure||url.protocol==='https:')&&
      (path===cookie.path||path.startsWith(cookie.path)&&(cookie.path.endsWith('/')||path[cookie.path.length]==='/'))&&
      (cookie.expires==='Infinity'||Date.parse(cookie.expires)>Date.now());
  }).map(cookie=>({name:cookie.key,value:cookie.value,domain:cookie.domain,path:cookie.path,
    ...(cookie.expires!=='Infinity'?{expires:cookie.expires}:{}),...(cookie.secure?{secure:true}:{}),...(cookie.httpOnly?{httpOnly:true}:{})}));
}
/** @param {Record<string,any>} rendered @param {Record<string,any>} prepared @param {Record<string,any>|undefined} response @param {string} startedDateTime */
export function pluginHarEntry(rendered,prepared,response,startedDateTime){
  for(const kind of ['digest','oauth1','aws','hawk','asap','ntlm','netrc'])if(prepared[kind])throw Error('HAR export for '+kind+' authentication requires its native auth adapter');
  const headers=rows(prepared.headers??[]),responseHeaders=rows(response?.headers??[]);
  const contentType=(/** @type {{name:string,value:string}[]} */values)=>values.find(row=>row.name.toLowerCase()==='content-type')?.value||'';
  const postData={mimeType:contentType(headers)||rendered.body?.mimeType||'',text:prepared.bodyBase64??prepared.body??'',params:[]};
  if(prepared.multipart)postData.params=prepared.multipart.map((/** @type {any} */part)=>({name:part.name,...(part.fileName!==null&&part.fileName!==undefined?{fileName:part.fileName}:{value:part.value})}));
  else if(rendered.body?.mimeType==='application/x-www-form-urlencoded')postData.params=(rendered.body.params??[]).map((/** @type {any} */part)=>({name:part.name,value:part.value}));
  const bytes=response?typeof response.bodyBase64==='string'?Uint8Array.from(atob(response.bodyBase64),c=>c.charCodeAt(0)):new TextEncoder().encode(response.body??''):null;
  const cookies=responseHeaders.filter(row=>row.name.toLowerCase()==='set-cookie').map(row=>{
    const parts=row.value.split(';'),pair=parts.shift()??'',split=pair.indexOf('=');
    if(split<1)return null;
    /** @type {Record<string,any>} */const cookie={name:pair.slice(0,split).trim(),value:pair.slice(split+1).trim()};
    for(const part of parts){const at=part.indexOf('='),key=(at<0?part:part.slice(0,at)).trim().toLowerCase(),value=at<0?'':part.slice(at+1).trim();
      if(key==='domain'||key==='path')cookie[key]=value;
      else if(key==='secure')cookie.secure=true;
      else if(key==='httponly')cookie.httpOnly=true;
      else if(key==='expires'&&Number.isFinite(Date.parse(value)))cookie.expires=new Date(value).toISOString();
    }
    return cookie;
  }).filter(Boolean);
  const time=response?.elapsedMs??0;
  return {startedDateTime,time,comment:rendered.name,cache:{},
    request:{method:prepared.method,url:prepared.url,httpVersion:'HTTP/1.1',headers,cookies:requestCookies(rendered.cookieSnapshot,prepared.url),queryString:[...new URL(prepared.url).searchParams].map(([name,value])=>({name,value})),postData,headersSize:-1,bodySize:-1,settingEncodeUrl:rendered.settingEncodeUrl},
    response:{status:response?.status??0,statusText:response?.statusText??'',httpVersion:'HTTP/1.1',cookies,headers:responseHeaders,
      content:{size:bytes?.length??0,mimeType:contentType(responseHeaders),...(bytes?{text:new TextDecoder('utf-8',{ignoreBOM:true}).decode(bytes)}:{})},redirectURL:'',headersSize:-1,bodySize:-1},
    timings:{blocked:-1,dns:-1,connect:-1,send:0,wait:time,receive:0,ssl:-1}};
}

/** Private selected environments are excluded by default, like legacy HAR export.
 * @param {Record<string,any>[]} resources @param {string} environmentId @param {boolean} [includePrivate] */
export function harEnvironmentId(resources,environmentId,includePrivate=false){
  const environment=resources.find(r=>r._id===environmentId&&r._type==='environment');
  return environment&&(!environment.isPrivate||includePrivate)?environmentId:'';
}

/** Select by model timestamp, independent of saved array ordering.
 * @param {Record<string,any>[]} history @param {string} requestId @param {string|null} environmentId @param {boolean} filterByEnvironment */
export function latestHarResponse(history,requestId,environmentId,filterByEnvironment){
  return history.filter(entry=>entry.requestId===requestId&&(!entry.protocol||entry.protocol==='http')&&
    (!filterByEnvironment||(entry.environmentId||null)===(environmentId||null))).sort((a,b)=>(b.modified??b.created??0)-(a.modified??a.created??0))[0];
}
