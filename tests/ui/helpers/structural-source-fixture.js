export const structuralFiles = Object.freeze({
  "a/shared.yaml": "\uFEFFget:\r\n  $ref: '../nested/value.yaml'\r\n",
  "b/shared.yaml":
    "get:\r\n  summary: Other😀\r\n  operationId: other\r\n  responses: { '200': {description: OK} }\r\n",
  "nested/value.yaml":
    "\uFEFFoperationId: owned😀\r\nresponses:\r\n  '200':\r\n    description: OK\r\n",
});
/** @param {string} [base] */
export function structuralSource(base = "../") {
  return (
    "\uFEFFopenapi: 3.2.0\r\n$self: memory:///design/openapi.yaml\r\ninfo: {title: Structural😀, version: '1'}\r\npaths:\r\n  /main:\r\n    get:\r\n      operationId: main\r\n      responses: { '200': {description: OK} }\r\n  /a:\r\n    $ref: '" +
    base +
    "a/shared.yaml'\r\n  /b:\r\n    $ref: '" +
    base +
    "b/shared.yaml'\r\n"
  );
}
