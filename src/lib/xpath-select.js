import xpath from "xpath";

/** Evaluate a read-only parsed XML document with constant-time tree ordering.
 * xmldom's native comparison scans siblings for every XPath tree comparison.
 * Nodes and attributes use an immutable tree index; synthetic namespace nodes
 * and foreign nodes retain the native comparison. Restore every
 * own descriptor in finally, including when XPath rejects the expression.
 * @param {string} path
 * @param {import('@xmldom/xmldom').Document} document */
export function selectXmlPath(path, document) {
  /** @typedef {import('@xmldom/xmldom').Node} XmlNode */
  const order = new Map();
  let next = 0;
  /** @type {{node:XmlNode,exit:boolean}[]} */
  const stack = [{ node: document, exit: false }];
  while (stack.length) {
    const frame = stack.pop();
    if (!frame) break;
    const node = frame.node;
    if (frame.exit) {
      order.get(node).end = next;
      continue;
    }
    const entry = {
      start: next++,
      end: 0,
      native: node.compareDocumentPosition,
      descriptor: Object.getOwnPropertyDescriptor(
        node,
        "compareDocumentPosition",
      ),
      owner: node,
      attribute: -1,
    };
    order.set(node, entry);
    if (node.nodeType === 1) {
      const attributes = /** @type {import('@xmldom/xmldom').Element} */ (node)
        .attributes;
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes.item(i);
        if (attr)
          order.set(attr, {
            start: entry.start,
            end: 0,
            native: attr.compareDocumentPosition,
            descriptor: Object.getOwnPropertyDescriptor(
              attr,
              "compareDocumentPosition",
            ),
            owner: node,
            attribute: i,
          });
      }
    }
    stack.push({ node, exit: true });
    for (let child = node.lastChild; child; child = child.previousSibling)
      stack.push({ node: child, exit: false });
  }
  /** @this {XmlNode} @param {XmlNode} other */
  function compare(other) {
    if (this === other) return 0;
    const a = order.get(this),
      b = order.get(other);
    if (!b || this.ownerDocument !== other.ownerDocument)
      return a.native.call(this, other);
    if (a.owner === b.owner) {
      if (a.attribute >= 0 && b.attribute >= 0)
        return 32 | (a.attribute < b.attribute ? 4 : 2);
      return a.attribute >= 0 ? 10 : 20;
    }
    const treeA = order.get(a.owner),
      treeB = order.get(b.owner);
    if (a.start < b.start)
      return a.attribute < 0 && b.start < treeA.end ? 20 : 4;
    return b.attribute < 0 && a.start < treeB.end ? 10 : 2;
  }
  try {
    for (const node of order.keys())
      Object.defineProperty(node, "compareDocumentPosition", {
        configurable: true,
        writable: true,
        value: compare,
      });
    return xpath.select(
      path,
      /** @type {Node} */ (/** @type {unknown} */ (document)),
    );
  } finally {
    for (const [node, entry] of order)
      if (entry.descriptor)
        Object.defineProperty(
          node,
          "compareDocumentPosition",
          entry.descriptor,
        );
      else delete (/** @type {any} */ (node).compareDocumentPosition);
  }
}
