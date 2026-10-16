/** Legacy request namespace over guest-owned data only. This function is embedded
 * into QuickJS and must not capture imports or host capabilities.
 * @param {Record<string,any>} request @param {Record<string,any>} environment @param {boolean} [readOnly] */
export function createPluginRequestContext(request,environment,readOnly=false) {
  if(!request||typeof request!=='object'||Array.isArray(request))throw Error('Request context requires a request snapshot');
  /** @param {any} rows @param {any} name @param {boolean} insensitive */
  const matches=(rows,name,insensitive)=>!Array.isArray(rows)||!name||typeof name!=='string'?[]:rows.filter(row=>row&&typeof row.name==='string'&&(insensitive?row.name.toLowerCase()===name.toLowerCase():row.name===name));
  /** @type {Record<string,any>} */
  const api={
    getId:()=>request._id,getName:()=>request.name,getUrl:()=>request.url,getMethod:()=>request.method,
    getEnvironmentVariable:(/** @type {string} */name)=>environment[name],getEnvironment:()=>environment,
    getHeader:(/** @type {string} */name)=>{const rows=matches(request.headers,name,true);return rows.length?rows[rows.length-1].value||'':null;},
    getHeaders:()=>request.headers.map((/** @type {any} */row)=>({name:row.name,value:row.value})),
    getParameter:(/** @type {string} */name)=>{const rows=matches(request.parameters,name,false);return rows.length?rows[rows.length-1].value||'':null;},
    getParameters:()=>request.parameters.map((/** @type {any} */row)=>({name:row.name,value:row.value})),
    getAuthentication:()=>request.authentication,getBody:()=>request.body,
    getBodyText:()=>request.body.text||'',
  };
  api.hasHeader=(/** @type {string} */name)=>api.getHeader(name)!==null;
  api.hasParameter=(/** @type {string} */name)=>api.getParameter(name)!==null;
  if(!readOnly)Object.assign(api,{
    setMethod:(/** @type {string} */method)=>{request.method=method;},setUrl:(/** @type {string} */url)=>{request.url=url;},
    setCookie:(/** @type {string} */name,/** @type {string} */value)=>{const row=request.cookies.find((/** @type {any} */cookie)=>cookie.name===name);if(row)row.value=value;else request.cookies.push({name,value});},
    settingSendCookies:(/** @type {boolean} */value)=>{request.settingSendCookies=value;},
    settingStoreCookies:(/** @type {boolean} */value)=>{request.settingStoreCookies=value;},
    settingEncodeUrl:(/** @type {boolean} */value)=>{request.settingEncodeUrl=value;},
    settingDisableRenderRequestBody:(/** @type {boolean} */value)=>{request.settingDisableRenderRequestBody=value;},
    settingFollowRedirects:(/** @type {string} */value)=>{request.settingFollowRedirects=value;},
    removeHeader:(/** @type {string} */name)=>{const rows=matches(request.headers,name,true);request.headers=request.headers.filter((/** @type {any} */row)=>!rows.includes(row));},
    setHeader:(/** @type {string} */name,/** @type {string} */value)=>{const row=matches(request.headers,name,true)[0];if(row)row.value=value;else api.addHeader(name,value);},
    addHeader:(/** @type {string} */name,/** @type {string} */value)=>{if(!matches(request.headers,name,true).length)request.headers.push({name,value});},
    removeParameter:(/** @type {string} */name)=>{const rows=matches(request.parameters,name,false);request.parameters=request.parameters.filter((/** @type {any} */row)=>!rows.includes(row));},
    setParameter:(/** @type {string} */name,/** @type {string} */value)=>{const row=matches(request.parameters,name,false)[0];if(row)row.value=value;else api.addParameter(name,value);},
    addParameter:(/** @type {string} */name,/** @type {string} */value)=>{if(!matches(request.parameters,name,false).length)request.parameters.push({name,value});},
    setAuthenticationParameter:(/** @type {string} */name,/** @type {any} */value)=>{Object.assign(request.authentication,{[name]:value});},
    setBody:(/** @type {Record<string,any>} */body)=>{request.body=body;},
    setBodyText:(/** @type {string} */text)=>{request.body.text=text;},
  });
  return api;
}
