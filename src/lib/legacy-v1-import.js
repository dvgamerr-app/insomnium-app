import {id} from "./model.js";

/** Archived insomnia-1.ts folder/request format; conversion performs no I/O.
 * @param {Record<string,any>} source @returns {Record<string,any>[]} */
export function legacyV1Resources(source) {
  if (!Array.isArray(source.items) || !source.items.length)
    throw new Error("Legacy export format 1 requires a nonempty items array.");
  const workspaceId = id("wrk");
  const resources = [{_id:workspaceId,_type:"workspace",parentId:null,name:"Imported Collection",scope:"collection"}];
  const formats = /** @type {Record<string,string>} */ ({form:"application/x-www-form-urlencoded",json:"application/json",text:"text/plain",xml:"application/xml"});
  /** @param {any} params */
  const invalidParameters = (params) => params != null && (!Array.isArray(params) || params.some(
    (/** @type {any} */ param) => !param || typeof param !== "object" || Array.isArray(param) ||
      typeof param.name !== "string" || (param.value != null && typeof param.value !== "string") ||
      (param.disabled != null && typeof param.disabled !== "boolean"),
  ));
  let requestCount = 0;
  for (const [index, item] of source.items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !Array.isArray(item.requests))
      throw new Error("Legacy export format 1 folders require a requests array.");
    if (item.name != null && typeof item.name !== "string")
      throw new Error("Legacy folder name must be text.");
    const environment = item.environments?.base ?? {};
    if (!environment || typeof environment !== "object" || Array.isArray(environment))
      throw new Error("Legacy export format 1 folder environment must be an object.");
    const folderId = id("fld");
    const {requests: _requests, ...folder} = item;
    resources.push({...folder,_id:folderId,_type:"request_group",parentId:workspaceId,
      name:item.name || `Imported Folder ${index + 1}`,environment,_legacyExportFormat:1});
    for (const request of item.requests) {
      if (!request || typeof request !== "object" || Array.isArray(request))
        throw new Error("Legacy export format 1 requests must be objects.");
      for (const field of ["name", "url", "method"])
        if (request[field] != null && typeof request[field] !== "string")
          throw new Error(`Legacy request ${field} must be text.`);
      const headers = structuredClone(request.headers ?? []);
      if (!Array.isArray(headers) || headers.some((header) => !header || typeof header.name !== "string" || typeof header.value !== "string" || (header.disabled != null && typeof header.disabled !== "boolean")))
        throw new Error("Legacy export format 1 headers must be named string values.");
      const contentTypeHeader = headers.find((header) => header.name.toLowerCase() === "content-type");
      let contentType = contentTypeHeader?.value || "";
      const format = request.__insomnia?.format;
      if (format && !Object.hasOwn(formats, format))
        throw new Error("Unsupported legacy request body format: " + format);
      if (!contentTypeHeader && format) {
        contentType = formats[format];
        headers.push({name:"Content-Type",value:contentType});
      }
      const mime = contentType.split(";")[0];
      const raw = request.body ?? "";
      if (typeof raw !== "string" && (!raw || typeof raw !== "object" || Array.isArray(raw)))
        throw new Error("Legacy request body must be text or a body object.");
      if (typeof raw === "object" && (["mimeType", "text"].some(key => raw[key] != null && typeof raw[key] !== "string") || invalidParameters(raw.params)))
        throw new Error("Legacy request body fields must be text and named parameters with boolean disabled flags.");
      const body = typeof raw === "string" ? {
        mimeType:["application/x-www-form-urlencoded","multipart/form-data","application/octet-stream","application/graphql"].includes(mime.toLowerCase())
          ? "text/plain" : mime || (raw ? "text/plain" : ""),text:raw,
      } : structuredClone(raw);
      if (request.authentication != null && (typeof request.authentication !== "object" || Array.isArray(request.authentication) ||
          (request.authentication.disabled != null && typeof request.authentication.disabled !== "boolean") ||
          ["username", "password"].some(key => request.authentication[key] != null && typeof request.authentication[key] !== "string")))
        throw new Error("Legacy request authentication must be an object with text credentials and a boolean disabled flag.");
      const authentication = {...request.authentication};
      if (authentication._type === "basic" || authentication.username != null || authentication.password != null)
        authentication.type = "basic";
      if (invalidParameters(request.params)) throw new Error("Legacy request parameters must be named text values with boolean disabled flags.");
      requestCount++;
      resources.push({...request,_id:id("req"),_type:"request",parentId:folderId,
        name:request.name || `Imported HAR ${requestCount}`,url:request.url || "",method:request.method || "GET",
        headers,body,authentication,parameters:request.params || [],_legacyExportFormat:1});
    }
  }
  return resources;
}
