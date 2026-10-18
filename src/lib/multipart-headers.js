export const multipartEncodings = [
  "binary",
  "8bit",
  "7bit",
  "quoted-printable",
  "base64",
];
/** Parse editable per-part headers; MIME framing remains transport-owned.
 * @param {string} text @returns {[string,string][]} */
export function multipartHeaders(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > 65536)
    throw new Error("Multipart headers exceed 64 KiB or are not text.");
  /** @type {[string,string][]} */
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const colon = line.indexOf(":");
    const name = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^[ \t]+|[ \t]+$/g, "");
    if (
      colon < 1 ||
      !/^[!#$%&'*+\-.^_\x60|~\da-zA-Z]+$/.test(name) ||
      /[\x00-\x08\x0a-\x1f\x7f]/.test(value)
    )
      throw new Error(
        "Invalid multipart header. Use one Name: value per line.",
      );
    if (
      [
        "content-disposition",
        "content-type",
        "content-transfer-encoding",
        "content-length",
      ].includes(name.toLowerCase())
    )
      throw new Error(
        "Multipart " +
          name +
          " requires the matching part option; raw overrides are not supported.",
      );
    rows.push([name, value]);
    if (rows.length > 128)
      throw new Error("Multipart headers exceed 128 rows.");
  }
  return rows;
}
