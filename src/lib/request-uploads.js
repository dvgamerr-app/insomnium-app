import { checkTemplateValue } from "./template-object.js";
const MAX_BYTES = 20 * 1024 * 1024;
/** Keep known binary upload fields outside template text accounting/rendering.
 * Other strings (even fields named base64) retain the ordinary text limits.
 * @param {Record<string,any>} request */
export function separateRequestUploads(request) {
  const input = { ...request };
  /** @type {{collection:string|null,index:number|null,value:string}[]} */ const uploads =
    [];
  let total = 0;
  /** @param {Record<string,any>} owner @param {string|null} collection @param {number|null} index */
  function separate(owner, collection, index) {
    if (typeof owner.base64 !== "string") return owner;
    const value = owner.base64;
    if (value.length > Math.ceil(MAX_BYTES / 3) * 4)
      throw new Error("Request binary uploads exceed 20 MiB.");
    // Validate before exemption: base64 can never contain template expressions.
    if (value.length % 4 || /[^A-Za-z0-9+/=]/.test(value))
      throw new Error("Invalid base64 in request upload.");
    let bytes;
    try {
      bytes = atob(value).length;
    } catch {
      throw new Error("Invalid base64 in request upload.");
    }
    total += bytes;
    if (total > MAX_BYTES)
      throw new Error("Request binary uploads exceed 20 MiB.");
    uploads.push({ collection, index, value });
    return { ...owner, base64: "" };
  }
  if (
    request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
  ) {
    input.body = { ...request.body };
    if (input.body.mimeType === "application/octet-stream") {
      input.body = separate(input.body, null, null);
      if (Array.isArray(input.body.curlSegments))
        input.body.curlSegments = input.body.curlSegments.map(
          /** @param {any} row @param {number} index */ (row, index) =>
            row?.type === "file" ? separate(row, "curlSegments", index) : row,
        );
    } else if (
      input.body.mimeType === "multipart/form-data" &&
      Array.isArray(input.body.params)
    ) {
      input.body.params = input.body.params.map(
        /** @param {any} row @param {number} index */ (row, index) =>
          row?.type === "file" ? separate(row, "params", index) : row,
      );
    }
  }
  checkTemplateValue(input);
  return {
    input: structuredClone(input),
    /** Restore before disabled-row filtering changes indices. @param {Record<string,any>} rendered */
    restore(rendered) {
      for (const { collection, index, value } of uploads) {
        const target =
          collection === null
            ? rendered.body
            : rendered.body?.[collection]?.[/** @type {number} */ (index)];
        if (!target || target.base64 !== "")
          throw new Error("Request upload structure changed during rendering.");
        target.base64 = value;
      }
    },
  };
}
