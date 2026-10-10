const xmlNamespace = "http://www.w3.org/XML/1998/namespace";
const xmlnsNamespace = "http://www.w3.org/2000/xmlns/";
// XML 1.0 Fifth Edition NameStartChar/NameChar, excluding colon (NCName).
const prefixName =
  /^[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}][A-Z_a-z0-9.\-\u00B7\u0300-\u036F\u203F-\u2040\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*$/u;

/** Validate user/imported expression mappings without inherited property lookup.
 * @param {unknown} value @returns {Record<string,string>} */
export function xpathNamespaces(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("XPath namespaces must be a prefix-to-URI object");
  const entries = Object.entries(value);
  if (entries.length > 32)
    throw Error("XPath supports at most 32 namespace mappings");
  const result = /** @type {Record<string,string>} */ (Object.create(null));
  for (const [prefix, uri] of entries) {
    if (prefix.length > 128 || !prefixName.test(prefix))
      throw Error(
        "Namespace prefix must be an XML name without a colon (1–128 characters)",
      );
    if (
      typeof uri !== "string" ||
      !uri ||
      uri.length > 4096 ||
      /\s|[\u0000-\u001f\u007f]/u.test(uri)
    )
      throw Error(
        "Namespace URI must contain 1–4096 characters without whitespace",
      );
    if (
      prefix === "xmlns" ||
      uri === xmlnsNamespace ||
      (prefix === "xml" && uri !== xmlNamespace) ||
      (prefix !== "xml" && uri === xmlNamespace)
    )
      throw Error("The xml and xmlns namespace bindings are reserved");
    result[prefix] = uri;
  }
  return result;
}

/** @param {{prefix:string,uri:string}[]} rows */
export function namespaceRows(rows) {
  const entries = rows.filter((row) => row.prefix.trim() || row.uri.trim());
  const result = /** @type {Record<string,string>} */ (Object.create(null));
  for (const row of entries) {
    const prefix = row.prefix.trim();
    if (Object.hasOwn(result, prefix))
      throw Error("Namespace prefixes must be unique");
    result[prefix] = row.uri.trim();
  }
  return xpathNamespaces(result);
}

/** @param {unknown} value */
export function xpathNamespaceResolver(value) {
  const mappings = xpathNamespaces(value);
  mappings.xml = xmlNamespace;
  return mappings;
}
