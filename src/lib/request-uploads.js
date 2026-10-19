import { checkTemplateValue, TemplateLimitError } from "./template-object.js";
import { isBinaryBody } from "./binary-body.js";
const MAX_BYTES = 20 * 1024 * 1024;
/** Keep known binary upload fields outside template text accounting/rendering.
 * Other strings (even fields named base64) retain the ordinary text limits.
 * @param {Record<string,any>} request */
export function separateRequestUploads(request) {
  const input = { ...request };
  /** @type {{path:(string|number)[],value:string}[]} */ const uploads =
    [];
  let total = 0;
  /** @param {Record<string,any>} owner @param {(string|number)[]} path */
  function separate(owner, path) {
    if (typeof owner.base64 !== "string") return owner;
    const value = owner.base64;
    if (value.length > Math.ceil(MAX_BYTES / 3) * 4)
      throw new Error("Request binary uploads exceed 20 MiB.");
    // Validate before exemption: base64 can never contain template expressions.
    if (value.length % 4 || /[^A-Za-z0-9+/=]/.test(value))
      throw new Error("Invalid base64 in request upload.");
    let bytes;
    try {
      const decoded = atob(value);
      // Match the native strict Base64 decoder before template execution.
      // atob alone also accepts nonzero unused padding bits (e.g. Zh==).
      if (btoa(decoded) !== value)
        throw new Error("Noncanonical base64 in request upload.");
      bytes = decoded.length;
    } catch {
      throw new Error("Invalid base64 in request upload.");
    }
    total += bytes;
    if (total > MAX_BYTES)
      throw new Error("Request binary uploads exceed 20 MiB.");
    uploads.push({ path: [...path, "base64"], value });
    return { ...owner, base64: "" };
  }
  if (
    request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
  ) {
    input.body = { ...request.body };
    if (isBinaryBody(input.body)) {
      input.body = separate(input.body, ["body"]);
      if (Array.isArray(input.body.curlSegments))
        input.body.curlSegments = input.body.curlSegments.map(
          /** @param {any} row @param {number} index */ (row, index) =>
            row?.type === "file" ? separate(row, ["body", "curlSegments", index]) : row,
        );
    } else if (
      input.body.mimeType === "multipart/form-data" &&
      Array.isArray(input.body.params)
    ) {
      let nodes = 0;
      const ancestors = new Set();
      /** @param {any[]} rows @param {(string|number)[]} path @returns {any[]} */
      function parts(rows, path) {
        if (path.length > 64 || ancestors.has(rows))
          throw new TemplateLimitError();
        ancestors.add(rows);
        const result = rows.map((row, index) => {
          if (++nodes > 10000) throw new TemplateLimitError();
          const location = [...path, index];
          if (row?.type === "file") return separate(row, location);
          if (row?.type === "multipart" && Array.isArray(row.params))
            return { ...row, params: parts(row.params, [...location, "params"]) };
          return row;
        });
        ancestors.delete(rows);
        return result;
      }
      input.body.params = parts(input.body.params, ["body", "params"]);
    }
  }
  // HAR provenance retains the original encoded request. When it is the exact
  // validated body payload, it is a second archival copy of binary data, not
  // template text or a second selected upload. Other provenance stays bounded.
  const archived = request._harSource?.request?.postData;
  if (isBinaryBody(input.body) && typeof request.body.base64 === "string" &&
      archived?._encoding === "base64" && archived.text === request.body.base64) {
    input._harSource = { ...request._harSource, request: {
      ...request._harSource.request, postData: { ...archived, text: "" },
    } };
    uploads.push({path:["_harSource", "request", "postData", "text"],value:archived.text});
  }
  if (input.body?.mimeType === "multipart/form-data" && Array.isArray(input.body.params) && Array.isArray(archived?.params)) {
    let copied = false;
    for (let index=0;index<input.body.params.length;index++) {
      const part=request.body.params[index],original=archived.params[index];
      if(part?.type !== "file" || typeof part.base64 !== "string" ||
          original?._encoding !== "base64" || original.value !== part.base64)continue;
      if(!copied){
        input._harSource={...input._harSource,request:{...input._harSource.request,
          postData:{...archived,params:[...archived.params]}}};
        copied=true;
      }
      input._harSource.request.postData.params[index]={...original,value:""};
      uploads.push({path:["_harSource","request","postData","params",index,"value"],value:original.value});
    }
  }
  checkTemplateValue(input);
  return {
    input: structuredClone(input),
    /** Restore before disabled-row filtering changes indices. @param {Record<string,any>} rendered */
    restore(rendered) {
      for (const { path, value } of uploads) {
        const target = path.slice(0,-1).reduce((owner, key) => owner?.[key], rendered);
        const key = path[path.length-1];
        if (!target || target[key] !== "")
          throw new Error("Request upload structure changed during rendering.");
        target[key] = value;
      }
    },
  };
}
