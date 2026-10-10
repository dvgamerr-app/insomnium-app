import assert from "node:assert/strict";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import xpath from "xpath";
import { selectXmlPath } from "../src/lib/xpath-select.js";
import { filterXmlResponse } from "../src/lib/xml-response-filter.js";
import { filterTemplateResponse } from "../src/lib/template-response-filter.js";
const serializer = new XMLSerializer();
const fixtures = [
  '<r a="1" b="2"><x id="a">alpha</x><!--comment--><g><x id="b">β &amp; x</x><y/></g><x id="c"><![CDATA[cdata]]></x><?pi value?></r>',
  '<r xmlns="urn:root" xmlns:p="urn:part"><p:x a="1">A</p:x><g xmlns=""><x a="2">B</x></g></r>',
  "<!DOCTYPE r><r><x/><x/><x/></r>",
  ...Array.from(
    { length: 8 },
    (_, i) =>
      "<r>" +
      Array.from(
        { length: i + 1 },
        (_, j) => `<g id="${j}"><x a="${j}">${j}</x><y/><x>second</x></g>`,
      ).join("") +
      "</r>",
  ),
];
const paths = [
  "/",
  "/*",
  "//*",
  "//node()",
  "//text()",
  "//comment()",
  "//processing-instruction()",
  "//@*",
  "//namespace::*",
  "//@* | //*",
  "//x | //g",
  "//x[1]",
  "(//x)[1]",
  "//x[last()]",
  "//x[position() mod 2 = 1]",
  "//x/ancestor::*",
  "//x/preceding-sibling::*",
  "//x/following-sibling::*",
  "//x/preceding::*",
  "//x/following::*",
  '//*[local-name()="x"]',
  '//*[namespace-uri()="urn:part"]',
  "count(//x)",
  "string(//x)",
  "boolean(//missing)",
  "sum(//x)",
  "//missing",
];
let comparisons = 0;
let matchingRefusals = 0;
let positionComparisons = 0;
for (const source of fixtures) {
  const doc = new DOMParser().parseFromString(source, "text/xml");
  const nodes = /** @type {any[]} */ ([]),
    stack = /** @type {any[]} */ ([doc]);
  while (stack.length) {
    const n = stack.pop();
    nodes.push(n);
    if (n.attributes)
      for (const attr of Array.from(n.attributes)) nodes.push(attr);
    for (let c = n.lastChild; c; c = c.previousSibling) stack.push(c);
  }
  const before = nodes.map((n) => [
    n.compareDocumentPosition,
    Object.getOwnPropertyDescriptor(n, "compareDocumentPosition"),
  ]);
  const describe = /** @param {any} value */ (value) =>
    Array.isArray(value)
      ? value.map((n) =>
          n.isXPathNamespace
            ? {
                name: n.nodeName,
                value: n.nodeValue,
                owner: n.ownerElement?.nodeName,
              }
            : serializer.serializeToString(n),
        )
      : value;
  const nativeSelect = xpath.select;
  try {
    /** @type {any} */ (xpath).select = (
      /** @type {any} */ path,
      /** @type {any} */ context,
    ) => {
      for (let i = 0; i < nodes.length; i++)
        for (const other of nodes) {
          assert.equal(
            nodes[i].compareDocumentPosition(other),
            before[i][0].call(nodes[i], other),
          );
          positionComparisons++;
        }
      return nativeSelect(path, context);
    };
    selectXmlPath("/", doc);
  } finally {
    xpath.select = nativeSelect;
  }
  for (const path of paths) {
    let expected;
    try {
      expected = xpath.select(path, /** @type {any} */ (doc));
    } catch (error) {
      assert.throws(() => selectXmlPath(path, doc), {
        message: /** @type {Error} */ (error).message,
      });
      matchingRefusals++;
      continue;
    }
    assert.deepEqual(
      describe(selectXmlPath(path, doc)),
      describe(expected),
      source + " " + path,
    );
    comparisons++;
  }
  assert.throws(() => selectXmlPath("//x[", doc));
  nodes.forEach((n, i) => {
    assert.equal(n.compareDocumentPosition, before[i][0]);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(n, "compareDocumentPosition"),
      before[i][1],
    );
  });
  assert.equal(
    serializer.serializeToString(doc),
    serializer.serializeToString(
      new DOMParser().parseFromString(source, "text/xml"),
    ),
  );
}
const wide = "<root>" + "<item/>".repeat(10001) + "</root>",
  start = performance.now();
assert.throws(() => filterXmlResponse(wide, "//item"), /10000 matches/);
const elapsedMs = performance.now() - start;
assert.ok(
  elapsedMs < 2500,
  "Wide match refusal fits within native3s deadline: " + elapsedMs,
);
const body = '<r><x a="v">α &amp; β</x></r>';
const attrStart = performance.now();
assert.throws(
  () =>
    filterXmlResponse(
      "<root>" +
        Array.from({ length: 10001 }, (_, i) => `<item id="${i}"/>`).join("") +
        "</root>",
      "//item/@id",
    ),
  /10000 matches/,
);
const attributeElapsedMs = performance.now() - attrStart;
assert.ok(
  attributeElapsedMs < 2500,
  "Wide attribute refusal fits native deadline",
);
assert.equal(filterTemplateResponse(body, "//x"), "α &amp; β");
assert.equal(filterTemplateResponse(body, "//x/@a"), "v");
assert.equal(filterTemplateResponse(body, "count(//x)"), "1");
assert.throws(
  () => filterTemplateResponse("<r><x/><x/></r>", "//x"),
  /more than one/,
);
console.log(
  JSON.stringify({
    passed: true,
    comparisons,
    matchingRefusals,
    positionComparisons,
    attributeElapsedMs,
    restorationFixtures: fixtures.length,
    wideMatches: 10001,
    elapsedMs,
    templateChecks: 4,
  }),
);
