import {id,newRequest} from "./model.js";
import {separateRequestUploads} from "./request-uploads.js";
import {multipartHeaders,multipartEncodings} from "./multipart-headers.js";

/** @param {string} text */
function encodedText(text) {
  const bytes=new TextEncoder().encode(text);let value='';
  for(let offset=0;offset<bytes.length;offset+=8192)value+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return btoa(value);
}

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
    // cookies describes the captured Cookie header; it is not a second set
    // of cookies to append. An explicit (even empty) active header wins.
    if (cookie && !existingCookie) headers.push({name:"Cookie",value:cookie});
    const post = request.postData;
    if (post != null && (typeof post !== "object" || Array.isArray(post))) throw new Error("HAR postData must be an object.");
    if (post?.text != null && typeof post.text !== "string") throw new Error("HAR postData text must be a string.");
    if(post?._multipartContentType != null && typeof post._multipartContentType !== "string")throw new Error("HAR multipart Content-Type must be text.");
    const multipart=post?._multipart===true,suppressContentType=post?._suppressContentType===true;
    if(suppressContentType){
      if(headers.some(header=>!header.disabled&&header.name.toLowerCase()==='content-type'))throw new Error("HAR suppressed Content-Type conflicts with an active header.");
      headers.push({name:"Content-Type",value:"",disabled:true,_curlSuppressDefault:true});
    }
    const parameters = rows(post?.params ?? [],"body parameters");
    if (parameters.some((parameter) => parameter.fileName != null && typeof parameter.fileName !== "string"))
      throw new Error("HAR file names must be strings.");
    const mime = typeof post?.mimeType === "string" ? post.mimeType : "";
    const baseMime = mime.split(";")[0].trim().toLowerCase();
    const text = post?.text ?? "";
    const file = parameters.some((parameter) => typeof parameter.fileName === "string" || parameter._encoding === "base64");
    let body = /** @type {Record<string,any>} */ ({});
    if (post?._encoding != null && post._encoding !== "base64")
      throw new Error("Unsupported HAR request body encoding.");
    if (post?._encoding === "base64") {
      if (parameters.length) throw new Error("Encoded HAR request bodies cannot also contain form parameters.");
      body = {mimeType:mime || "application/octet-stream",binary:true,base64:text,fileName:"har-body.bin"};
      // Reuse canonical Base64 and decoded upload-budget validation before
      // importing; never interpret encoded bytes as template text or form rows.
      separateRequestUploads({body});
    } else if (parameters.length || multipart) {
      if (!multipart && baseMime && !["application/x-www-form-urlencoded","multipart/form-data"].includes(baseMime))
        throw new Error("HAR body parameters require a form MIME type.");
      if(!multipart && file && baseMime === "application/x-www-form-urlencoded")
        throw new Error("HAR file parameters require multipart/form-data.");
      body = {mimeType:multipart?"multipart/form-data":baseMime || (file ? "multipart/form-data" : "application/x-www-form-urlencoded"),params:parameters.map((parameter) => {
        if(parameter._encoding != null && parameter._encoding !== "base64")throw new Error("Unsupported HAR parameter encoding.");
        if(parameter._transferEncoding != null && !multipartEncodings.includes(parameter._transferEncoding))throw new Error("Unsupported HAR parameter transfer encoding.");
        if(parameter._headers != null)multipartHeaders(parameter._headers);
        const binary=parameter._encoding === "base64",filePart=binary||typeof parameter.fileName === "string";
        return {
          name:parameter.name,value:filePart ? "" : parameter.value ?? "",
          ...(parameter.name === "" ? {_harExplicitPart:true} : {}),
          ...(typeof parameter.contentType === "string" ? {contentTypeOverride:parameter.contentType} : {}),
          ...(filePart ? {type:"file",fileName:parameter.fileName || "har-part.bin",
            ...(typeof parameter.fileName === "string" ? {fileNameOverride:parameter.fileName} : {}),
            ...(binary ? {base64:parameter.value ?? ""} : typeof parameter.value === "string" ? {base64:encodedText(parameter.value)} : {}),
            ...(parameter._fileContent === true ? {fileContent:true} : {}),
          } : {}),
          ...(parameter._transferEncoding != null ? {transferEncoding:parameter._transferEncoding} : {}),
          ...(parameter._headers != null ? {partHeaders:parameter._headers} : {}),
        };
      })};
      separateRequestUploads({body});
    } else if (post) {
      body = {mimeType:["application/x-www-form-urlencoded","multipart/form-data","application/octet-stream","application/graphql"].includes(baseMime)
        ? "text/plain" : baseMime || (text ? "text/plain" : ""),text};
    }
    const selectedType=multipart && typeof post._multipartContentType === "string" ? post._multipartContentType : mime;
    if (!suppressContentType && (selectedType || multipart && post._multipartContentType === "") && !headers.some((header) => !header.disabled && header.name.toLowerCase() === "content-type"))
      headers.push({name:"Content-Type",value:selectedType});
    if (parameters.length || multipart) {
      // The sender generates a new form body. Captured framing describes
      // the old body and cannot accompany the reconstructed form fields.
      for (let i = headers.length - 1; i >= 0; i--) {
        const header = headers[i];
        if (header.disabled) continue;
        const name = header.name.toLowerCase();
        if (['content-length', 'content-encoding', 'transfer-encoding', 'trailer'].includes(name)) headers.splice(i, 1);
        else if (body.mimeType === 'multipart/form-data' && name === 'content-type' && typeof header.value === 'string') {
          const parts = header.value.match(/(?:[^;"]|"(?:\\.|[^"\\])*")+/g) || [];
          if (post._multipartContentType == null && (multipart || parts[0]?.trim().toLowerCase() === 'multipart/form-data'))
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
      // HAR stores the already prepared target. Re-encoding would turn + into
      // %2B, collapse empty values and alter authored percent-escape spelling.
      settingEncodeUrl:false,
      parameters:hasQuery ? [] : query.map(({comment:_comment,...parameter}) => ({...parameter,sendEmptyName:true})),
      _harSource:structuredClone(entry),
      _migrationIssues:body.params?.some((/** @type {any} */ part)=>part.type === "file" && typeof part.base64 !== "string") ? ["Select imported HAR files again before sending."] : [],
    }));
  }
  return resources;
}
