import { DOMParser, XMLSerializer, onErrorStopParsing } from "@xmldom/xmldom";
import xpath from "xpath";

/** XPath 1.0 response preview, following the legacy element/attribute/text selection.
 * @param {string} body @param {string} path */
export function filterXmlResponse(body, path) {
  if (body.length > 20 * 1024 * 1024)
    throw new Error("XML response exceeds 20 Mi characters");
  if (!path.trim() || path.length > 4096)
    throw new Error("XPath must contain 1–4096 characters");
  const document = new DOMParser({
    onError: onErrorStopParsing,
  }).parseFromString(body, "text/xml");
  const selected = xpath.select(
    path,
    /** @type {Node} */ (/** @type {unknown} */ (document)),
  );
  const serializer = new XMLSerializer();
  /** @type {string[]} */ const fragments = [];
  let size = 19;
  const append = (/** @type {string} */ text) => {
    size += text.length + 1;
    if (size > 20 * 1024 * 1024)
      throw new Error("XPath result exceeds 20 Mi characters");
    fragments.push(text);
  };
  if (Array.isArray(selected)) {
    if (selected.length > 10000)
      throw new Error("XPath result exceeds 10000 matches");
    for (const node of selected) {
      if ([1, 2, 3].includes(node.nodeType))
        append(serializer.serializeToString(/** @type {any} */ (node)).trim());
    }
  } else if (selected !== null) {
    append(
      serializer.serializeToString(document.createTextNode(String(selected))),
    );
  }
  return fragments.length
    ? `<result>\n${fragments.join("\n")}\n</result>`
    : "<result/>";
}
