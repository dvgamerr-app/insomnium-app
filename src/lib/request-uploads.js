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
    uploads.push({ path, value });
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
  checkTemplateValue(input);
  return {
    input: structuredClone(input),
    /** Restore before disabled-row filtering changes indices. @param {Record<string,any>} rendered */
    restore(rendered) {
      for (const { path, value } of uploads) {
        const target = path.reduce((owner, key) => owner?.[key], rendered);
        if (!target || target.base64 !== "")
          throw new Error("Request upload structure changed during rendering.");
        target.base64 = value;
      }
    },
  };
}
