import {id, newRequest} from "./model.js";

/** @param {unknown} value */
const tokens = (value) => typeof value === "string" ? value.replace(/<<(.+?)>>/g,"{{ _.$1 }}") : "";
/** @param {unknown} value @param {string} field @returns {Record<string,any>[]} */
function rows(value, field) {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row !== "object" || Array.isArray(row)))
    throw new Error("Hoppscotch " + field + " must be an array of objects.");
  return value;
}
/** @param {Record<string,any>} auth */
function authentication(auth) {
  const disabled = auth.authActive === false;
  switch (auth.authType) {
    case "basic": return {type:"basic",disabled,username:tokens(auth.username),password:tokens(auth.password)};
    case "bearer": return {type:"bearer",disabled,token:tokens(auth.token)};
    case "api-key": return {type:"apikey",disabled,key:tokens(auth.key),value:tokens(auth.value),addTo:auth.addTo === "Headers" ? "header" : "queryParams"};
    case "oauth-2": return {type:"oauth2",disabled,accessToken:tokens(auth.token),grantType:"authorization_code",
      accessTokenUrl:tokens(auth.accessTokenURL),authorizationUrl:tokens(auth.authURL),clientId:tokens(auth.clientID),scope:tokens(auth.scope)};
    case "none": return {disabled:true};
    default: throw new Error("Unsupported Hoppscotch authentication: " + auth.authType);
  }
}
/** @param {Record<string,any>} body @returns {Record<string,any>} */
function requestBody(body) {
  const mimeType = typeof body?.contentType === "string" ? body.contentType : "";
  const value = body?.body;
  if (Array.isArray(value)) {
    if (!["application/x-www-form-urlencoded","multipart/form-data"].includes(mimeType))
      throw new Error("Hoppscotch form fields require a form content type.");
    return {mimeType, params:rows(value,"body fields").map((field) => ({
    name:tokens(field.key),value:field.isFile ? "" : tokens(field.value),disabled:!field.active,
    ...(field.isFile ? {type:"file",fileName:typeof field.value === "string" ? field.value : ""} : {}),
    }))};
  }
  if (value != null && typeof value !== "string") throw new Error("Hoppscotch body must be text or form fields.");
  if (mimeType === "application/x-www-form-urlencoded") return {mimeType,params:String(value || "").split("\n").filter((line) => line.trim()).map((line) => {
    const match = /(^\w+?):[ "]*(.+?)[ "]*$/.exec(line);
    if (!match) throw new Error("Invalid Hoppscotch URL-encoded body line.");
    return {name:tokens(match[1]),value:tokens(match[2])};
  })};
  return {mimeType:mimeType || (value ? "text/plain" : ""),text:tokens(value)};
}
/** Import the archived v2 collection contract, with iterative folder traversal.
 * @param {Record<string,any>} source @returns {Record<string,any>[]} */
export function hoppscotchResources(source) {
  const resources = /** @type {Record<string,any>[]} */ ([]);
  const stack = [{folder:source,parentId:/** @type {string|null} */ (null),headers:/** @type {Record<string,any>[]} */ ([]),auth:{authType:"none",authActive:false}}];
  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    const {folder,parentId} = current;
    if (!folder || folder.v !== 2 || typeof folder.name !== "string" || !folder.auth || typeof folder.auth !== "object")
      throw new Error("Expected a Hoppscotch v2 folder with name and auth.");
    const localHeaders = rows(folder.headers,"headers");
    const headers = [...localHeaders,...current.headers.filter((parent) => !localHeaders.some((child) => child.key === parent.key))];
    const auth = folder.auth.authType === "inherit" ? {...current.auth,...(folder.auth.authActive === false ? {authActive:false} : {})} : folder.auth;
    const folderId = id(parentId ? "fld" : "wrk");
    const {requests,folders,...folderSource} = folder;
    resources.push({_id:folderId,_type:parentId ? "request_group" : "workspace",parentId,name:folder.name,
      ...(parentId ? {environment:{}} : {scope:"collection"}),_hoppscotchSource:structuredClone(folderSource)});
    for (const request of rows(requests,"requests")) {
      if (!request.auth || typeof request.auth !== "object") throw new Error("Hoppscotch requests require auth settings.");
      const ownHeaders = rows(request.headers,"request headers");
      const inherited = [...ownHeaders,...headers.filter((parent) => !ownHeaders.some((child) => child.key === parent.key))];
      const effectiveAuth = request.auth.authType === "inherit" ? {...auth,...(request.auth.authActive === false ? {authActive:false} : {})} : request.auth;
      const body = requestBody(request.body);
      // Raw Hoppscotch text is not an Insomnium file or GraphQL editor payload.
      // Keep its wire MIME in a header while selecting the ordinary text sender.
      const rawMime = typeof body.text === "string" &&
        ["application/octet-stream","application/graphql","multipart/form-data"].includes(body.mimeType.toLowerCase())
        ? body.mimeType : null;
      if (rawMime) body.mimeType = "text/plain";
      const importedHeaders = inherited.map((header) => ({name:tokens(header.key),value:tokens(header.value),disabled:!header.active}));
      if (rawMime && !importedHeaders.some((header) => !header.disabled && header.name.toLowerCase() === "content-type"))
        importedHeaders.push({name:"Content-Type",value:rawMime,disabled:false});
      const scripts = !!(request.preRequestScript || request.testScript);
      resources.push(newRequest(folderId,{name:request.name || "Imported request",method:request.method || "GET",url:tokens(request.endpoint),body,
        headers:importedHeaders,
        parameters:rows(request.params,"parameters").map((parameter) => ({name:tokens(parameter.key),value:tokens(parameter.value),disabled:!parameter.active})),
        authentication:authentication(effectiveAuth),_hoppscotchSource:structuredClone(request),
        _migrationIssues:[...(scripts ? ["Hoppscotch scripts are retained but are not executed."] : []),
          ...(Array.isArray(body.params) && body.params.some((field) => field.type === "file") ? ["Select imported Hoppscotch files again before sending."] : [])],
      }));
    }
    const children = rows(folders,"folders");
    for (let index = children.length - 1; index >= 0; index--) stack.push({folder:children[index],parentId:folderId,headers,auth});
  }
  return resources;
}
