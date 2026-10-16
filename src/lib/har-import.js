import {id,newRequest} from "./model.js";

/** @param {unknown} value @param {string} field @returns {Record<string,any>[]} */
function rows(value,field) {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row !== "object" || Array.isArray(row) || typeof row.name !== "string"))
    throw new Error("HAR " + field + " must be an array of named objects.");
  if (value.some((row) => row.value != null && typeof row.value !== "string"))
    throw new Error("HAR " + field + " values must be strings.");
  return value;
}
/** Archived HAR1.2 request conversion with detached source preservation.
 * @param {Record<string,any>} source @returns {Record<string,any>[]} */
export function harResources(source) {
  const entries = source.log ? source.log.entries : [{request:source}];
  if (!Array.isArray(entries)) throw new Error("HAR log requires an entries array.");
  const workspaceId = id("wrk");
  const resources = /** @type {Record<string,any>[]} */ ([{_id:workspaceId,_type:"workspace",parentId:null,name:"HAR Import",scope:"collection"}]);
  for (const [index,entry] of entries.entries()) {
    const request = entry?.request;
    if (!request || typeof request !== "object" || typeof request.url !== "string" || typeof request.method !== "string")
      throw new Error("HAR entries require a request URL and method.");
    const headers = rows(request.headers ?? [],"headers").map(({comment:_comment,...header}) => ({...header}));
    const cookie = rows(request.cookies ?? [],"cookies").map((item) => `${item.name}=${item.value ?? ""}`).join("; ");
    const existingCookie = headers.find((header) => !header.disabled && header.name.toLowerCase() === "cookie");
    if (cookie && existingCookie) existingCookie.value = `${existingCookie.value ?? ""}; ${cookie}`;
    else if (cookie) headers.push({name:"Cookie",value:cookie});
    const post = request.postData;
    if (post != null && (typeof post !== "object" || Array.isArray(post))) throw new Error("HAR postData must be an object.");
    if (post?.text != null && typeof post.text !== "string") throw new Error("HAR postData text must be a string.");
    const parameters = rows(post?.params ?? [],"body parameters");
    if (parameters.some((parameter) => parameter.fileName != null && typeof parameter.fileName !== "string"))
      throw new Error("HAR file names must be strings.");
    const mime = typeof post?.mimeType === "string" ? post.mimeType : "";
    const baseMime = mime.split(";")[0].trim().toLowerCase();
    const text = post?.text ?? "";
    const file = parameters.some((parameter) => parameter.fileName);
    let body = /** @type {Record<string,any>} */ ({});
    if (parameters.length) {
      if (baseMime && !["application/x-www-form-urlencoded","multipart/form-data"].includes(baseMime))
        throw new Error("HAR body parameters require a form MIME type.");
      body = {mimeType:baseMime || "application/x-www-form-urlencoded",params:parameters.map((parameter) => ({
        name:parameter.name,value:parameter.fileName ? "" : parameter.value ?? "",
        ...(typeof parameter.contentType === "string" ? {contentType:parameter.contentType} : {}),
        ...(parameter.fileName ? {type:"file",fileName:parameter.fileName} : {}),
      }))};
    } else if (post) {
      body = {mimeType:["application/x-www-form-urlencoded","multipart/form-data","application/octet-stream","application/graphql"].includes(baseMime)
        ? "text/plain" : baseMime || (text ? "text/plain" : ""),text};
    }
    if (mime && !headers.some((header) => !header.disabled && header.name.toLowerCase() === "content-type"))
      headers.push({name:"Content-Type",value:mime});
    if (parameters.length) {
      // The sender generates a new form body. Captured framing describes
      // the old body and cannot accompany the reconstructed form fields.
      for (let i = headers.length - 1; i >= 0; i--) {
        const header = headers[i];
        if (header.disabled) continue;
        const name = header.name.toLowerCase();
        if (['content-length', 'content-encoding', 'transfer-encoding', 'trailer'].includes(name)) headers.splice(i, 1);
        else if (body.mimeType === 'multipart/form-data' && name === 'content-type' && typeof header.value === 'string') {
          const parts = header.value.match(/(?:[^;"]|"(?:\\.|[^"\\])*")+/g) || [];
          if (parts[0]?.trim().toLowerCase() === 'multipart/form-data')
            header.value = parts.filter((part, index) => index === 0 || !/^\s*boundary\s*=/i.test(part)).map(part => part.trim()).join('; ');
        }
      }
    }
    // HAR url is the full target; queryString is its decomposition. Preserve raw
    // query spelling/order and do not append that decomposition a second time.
    const query = rows(request.queryString ?? [],"query parameters");
    const hasQuery = request.url.split("#")[0].includes("?");
    resources.push(newRequest(workspaceId,{
      name:request.comment || entry.comment || request.url || `HAR Import ${index + 1}`,
      method:request.method.toUpperCase(),url:request.url,headers,body,
      parameters:hasQuery ? [] : query.map(({comment:_comment,...parameter}) => ({...parameter})),
      _harSource:structuredClone(entry),
      _migrationIssues:file ? ["Select imported HAR files again before sending."] : [],
    }));
  }
  return resources;
}
