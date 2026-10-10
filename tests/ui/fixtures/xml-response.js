export const source =
  '<root><item id="a">alpha</item><item id="b">β &amp; x</item></root>';
export const pretty =
  '<root>\n  <item id="a">alpha</item>\n  <item id="b">β &amp; x</item>\n</root>';
export const selections = [
  [
    "//item",
    '<result>\n  <item id="a">alpha</item>\n  <item id="b">β &amp; x</item>\n</result>',
  ],
  ["//item/@id", '<result>\nid="a"\nid="b"\n</result>'],
  ["//item/text()", "<result>\nalpha\nβ &amp; x\n</result>"],
  ["count(//item)", "<result>\n2\n</result>"],
  ["boolean(//missing)", "<result>\nfalse\n</result>"],
  ["string(//item[2])", "<result>\nβ &amp; x\n</result>"],
  ["//missing", "<result/>"],
];
export const mixed = "<p>Hello <b>β</b> world</p>";
export const namespaced =
  '<r xmlns="urn:fixture"><item id="n">namespaced</item></r>';
export const documents = {
  "/mapped": {
    body: '<r xmlns="urn:one" xmlns:p="urn:two"><item id="a">one</item><p:item p:id="b">two</p:item><item xmlns="urn:two">other</item></r>',
    type: "application/xml",
  },
  "/document": { body: source, type: "application/xml; charset=utf-8" },
  "/text": { body: source, type: "text/xml; charset=utf-8" },
  "/suffix": { body: source, type: "application/soap+xml; charset=utf-8" },
  "/declaration": {
    body: '<?xml version="1.0"?>' + source,
    type: "application/octet-stream",
  },
  "/plain": { body: source, type: "text/plain" },
  "/mixed": { body: mixed, type: "application/xml" },
  "/namespace": { body: namespaced, type: "application/xml" },
  "/invalid": { body: "<root><item></root>", type: "application/xml" },
  "/many": {
    body:
      "<root>" +
      Array.from(
        { length: 101 },
        (_, index) =>
          "<group>" + "<item/>".repeat(index === 100 ? 1 : 100) + "</group>",
      ).join("") +
      "</root>",
    type: "application/xml",
  },
  "/wide": {
    body: "<root>" + "<item/>".repeat(10001) + "</root>",
    type: "application/xml",
  },
  "/wide-ok": {
    body:
      "<root>" +
      Array.from(
        { length: 4000 },
        (_, i) => `<item id="${i}">v${i}</item>`,
      ).join("") +
      "</root>",
    type: "application/xml",
  },
};
