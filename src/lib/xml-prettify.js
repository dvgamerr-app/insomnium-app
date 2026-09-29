import vkbeautify from "vkbeautify";
import { DOMParser, XMLSerializer, onErrorStopParsing } from "@xmldom/xmldom";

/** Compare XML content while allowing indentation in element-only containers.
 * Mixed text, CDATA and xml:space=preserve must remain exact.
 * @param {import('@xmldom/xmldom').Node} root */
function content(root) {
  let count = 0;
  /** @param {import('@xmldom/xmldom').Node} node @param {number} depth @param {boolean} preserve @returns {any} */
  function visit(node, depth, preserve) {
    if (++count > 100000 || depth > 96)
      throw new Error(
        "XML formatting exceeds 100000 nodes or 96 nesting levels",
      );
    const element =
      node.nodeType === 1
        ? /** @type {import('@xmldom/xmldom').Element} */ (node)
        : null;
    const space = element?.getAttribute("xml:space");
    if (space === "preserve") preserve = true;
    else if (space === "default") preserve = false;
    const children = Array.from(node.childNodes || []);
    const mixed = children.some(
      (child) =>
        child.nodeType === 4 ||
        (child.nodeType === 3 && !!child.nodeValue?.trim()),
    );
    return [
      node.nodeType,
      node.nodeName,
      node.nodeType === 10
        ? new XMLSerializer().serializeToString(node)
        : node.nodeValue,
      element
        ? Array.from(element.attributes).map((a) => [a.name, a.value])
        : null,
      children
        .filter(
          (child) =>
            preserve ||
            mixed ||
            child.nodeType !== 3 ||
            !!child.nodeValue?.trim(),
        )
        .map((child) => visit(child, depth + 1, preserve)),
    ];
  }
  return JSON.stringify(visit(root, 0, false));
}

/** Use the archived formatter, refusing transformations that change XML content.
 * @param {string} source @param {string} [indent] */
export function xmlPrettify(source, indent = "  ") {
  if (source.length > 20 * 1024 * 1024)
    throw new Error("XML formatting input exceeds 20 Mi characters");
  if (!/^[ \t]{1,16}$/.test(indent)) throw new Error("Invalid XML indentation");
  const parser = new DOMParser({ onError: onErrorStopParsing });
  const before = content(parser.parseFromString(source, "text/xml"));
  const formatted = vkbeautify.xml(source, indent);
  if (formatted.length > 20 * 1024 * 1024)
    throw new Error("Formatted XML exceeds 20 Mi characters");
  if (content(parser.parseFromString(formatted, "text/xml")) !== before)
    throw new Error(
      "Formatting would change XML text or attributes; original content retained",
    );
  return formatted;
}
