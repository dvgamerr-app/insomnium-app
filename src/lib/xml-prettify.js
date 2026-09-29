import { DOMParser, XMLSerializer, onErrorStopParsing } from "@xmldom/xmldom";

/** Port of vkbeautify 0.99.3 xml() so output stays byte-identical to the
 * archived formatter. vkBeautify (c) 2012 Vadim Kiryukhin, MIT licensed.
 * Out-of-range depths intentionally yield "undefined" like the original; the
 * content comparison below then rejects the result.
 * @param {string} text @param {string} step */
function vkbeautifyXml(text, step) {
  const shift = ["\n"];
  for (let i = 0; i < 100; i++) shift.push(shift[i] + step);
  const ar = text
    .replace(/>\s{0,}</g, "><")
    .replace(/</g, "~::~<")
    .replace(/\s*xmlns\:/g, "~::~xmlns:")
    .replace(/\s*xmlns\=/g, "~::~xmlns=")
    .split("~::~");
  let inComment = false;
  let deep = 0;
  let str = "";
  for (let ix = 0; ix < ar.length; ix++) {
    const part = ar[ix];
    const open = /^<[\w:\-\.\,]+/.exec(ar[ix - 1]);
    const close = /^<\/[\w:\-\.\,]+/.exec(part);
    if (part.search(/<!/) > -1) {
      // start comment, <![CDATA[...]]> or <!DOCTYPE
      str += shift[deep] + part;
      inComment = true;
      if (
        part.search(/-->/) > -1 ||
        part.search(/\]>/) > -1 ||
        part.search(/!DOCTYPE/) > -1
      )
        inComment = false;
    } else if (part.search(/-->/) > -1 || part.search(/\]>/) > -1) {
      // end comment or <![CDATA[...]]>
      str += part;
      inComment = false;
    } else if (
      /^<\w/.exec(ar[ix - 1]) &&
      close &&
      // Loose equality compares the RegExp match array with a string.
      /** @type {any} */ (open) == close[0].replace("/", "")
    ) {
      // <elm></elm>
      str += part;
      if (!inComment) deep--;
    } else if (
      part.search(/<\w/) > -1 &&
      part.search(/<\//) == -1 &&
      part.search(/\/>/) == -1
    ) {
      // <elm>
      str += !inComment ? shift[deep++] + part : part;
    } else if (part.search(/<\w/) > -1 && part.search(/<\//) > -1) {
      // <elm>...</elm>
      str += !inComment ? shift[deep] + part : part;
    } else if (part.search(/<\//) > -1) {
      // </elm>
      str += !inComment ? shift[--deep] + part : part;
    } else if (part.search(/\/>/) > -1) {
      // <elm/>
      str += !inComment ? shift[deep] + part : part;
    } else if (part.search(/<\?/) > -1) {
      // <?xml ... ?>
      str += shift[deep] + part;
    } else if (part.search(/xmlns\:/) > -1 || part.search(/xmlns\=/) > -1) {
      str += shift[deep] + part;
    } else {
      str += part;
    }
  }
  return str[0] == "\n" ? str.slice(1) : str;
}

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
  const formatted = vkbeautifyXml(source, indent);
  if (formatted.length > 20 * 1024 * 1024)
    throw new Error("Formatted XML exceeds 20 Mi characters");
  if (content(parser.parseFromString(formatted, "text/xml")) !== before)
    throw new Error(
      "Formatting would change XML text or attributes; original content retained",
    );
  return formatted;
}
