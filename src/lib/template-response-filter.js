import { filterJsonResponse } from "./response-filter.js";
import { DOMParser, XMLSerializer, onErrorStopParsing } from "@xmldom/xmldom";
import xpath from "xpath";

/** Legacy response-tag values differ from the response panel's result wrapper.
 * Execute only in a disposable worker.
 * @param {string} body @param {string} path
 */
export function filterTemplateResponse(body, path) {
  if (body.length > 20 * 1024 * 1024)
    throw new Error("Response exceeds 20 Mi characters");
  path = path.trim();
  if (!path || path.length > 4096)
    throw new Error("Response filter must contain 1–4096 characters");
  let value;
  if (path.startsWith("$")) {
    const results = JSON.parse(filterJsonResponse(body, path));
    if (!results.length) throw new Error("Returned no results: " + path);
    value =
      results.length > 1
        ? JSON.stringify(results)
        : typeof results[0] === "string"
          ? results[0]
          : JSON.stringify(results[0]);
  } else {
    const document = new DOMParser({
      onError: onErrorStopParsing,
    }).parseFromString(body, "text/xml");
    const selected = xpath.select(
      path,
      /** @type {Node} */ (/** @type {unknown} */ (document)),
    );
    if (!Array.isArray(selected)) {
      // XPath scalar functions return their textual value.
      value = String(selected);
    } else {
      if (selected.length > 10000)
        throw new Error("XPath result exceeds 10000 matches");
      const nodes = selected.filter((node) =>
        [1, 2, 3].includes(node.nodeType),
      );
      if (!nodes.length) throw new Error("Returned no results: " + path);
      if (nodes.length > 1)
        throw new Error("Returned more than one result: " + path);
      const node = nodes[0];
      const serializer = new XMLSerializer();
      if (node.nodeType === 2) value = node.nodeValue || "";
      else if (node.nodeType === 3)
        value = serializer.serializeToString(/** @type {any} */ (node)).trim();
      else {
        value = "";
        for (let child = node.firstChild; child; child = child.nextSibling) {
          value += serializer.serializeToString(/** @type {any} */ (child));
          if (value.length > 20 * 1024 * 1024)
            throw new Error("Response filter output exceeds 20 Mi characters");
        }
      }
    }
  }
  if (value.length > 20 * 1024 * 1024)
    throw new Error("Response filter output exceeds 20 Mi characters");
  return value;
}
