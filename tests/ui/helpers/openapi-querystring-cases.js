const object = { type: "object" };
const nullableObject = { type: ["object", "null"] };
const formSchema = {
  type: "object",
  properties: {
    foo: { type: "string" },
    bar: { type: "boolean" },
    zero: { type: "integer" },
    empty: { type: "string" },
    n: { type: "integer" },
    e: { type: "number" },
    items: { type: "array", items: { type: "string" } },
    object,
  },
};
export const openApiQuerystringCases = [
  {
    id: "whole-json",
    media: "application/json",
    schema: object,
    value: { n: [1, 2], flag: null },
    expected: "?%7B%22n%22%3A%5B1%2C2%5D%2C%22flag%22%3Anull%7D",
  },
  {
    id: "whole-text",
    media: "text/plain; charset=UTF-8",
    schema: { type: "string" },
    value: "a=1&a=2",
    expected: "?a=1&a=2",
  },
  {
    id: "whole-form",
    media: "application/x-www-form-urlencoded",
    schema: formSchema,
    value: { foo: "a + b", bar: false, zero: 0, empty: "" },
    expected: "?foo=a+%2B+b&bar=false&zero=0&empty=",
  },
  {
    id: "whole-empty-text",
    media: "text/plain",
    schema: { type: "string" },
    value: "",
    expected: "?",
  },
  {
    id: "whole-null-text",
    media: "text/plain",
    schema: { type: ["string", "null"] },
    value: null,
    expected: "",
  },
  {
    id: "whole-null-json",
    media: "application/json",
    schema: nullableObject,
    value: null,
    expected: "?null",
  },
  {
    id: "whole-empty-form",
    media: "application/x-www-form-urlencoded",
    schema: object,
    value: {},
    expected: "?",
  },
  {
    id: "whole-null-form",
    media: "application/x-www-form-urlencoded",
    schema: nullableObject,
    value: null,
    expected: "",
  },
  {
    id: "whole-form-compound",
    media: "application/x-www-form-urlencoded",
    schema: formSchema,
    value: { items: ["a +", "b&="], object: { n: 1 } },
    expected: "?items=a+%2B&items=b%26%3D&object=%7B%22n%22%3A1%7D",
  },
  {
    id: "whole-form-style",
    media: "application/x-www-form-urlencoded",
    schema: formSchema,
    encoding: { items: { style: "form", explode: false } },
    value: { items: ["a +", "b&="] },
    expected: "?items=a%20%2B&items=b%26%3D",
  },
  {
    id: "whole-text-syntax",
    media: "text/plain",
    schema: { type: "string" },
    value: "color[]=a%2f+b&percent=%ZZ#fragment",
    expected: "?color%5B%5D=a%2f+b&percent=%25ZZ%23fragment",
  },
  {
    id: "whole-text-unicode",
    media: "text/plain",
    schema: { type: "string" },
    value: "q=ไทย 😀",
    expected: "?q=%E0%B9%84%E0%B8%97%E0%B8%A2%20%F0%9F%98%80",
  },
  {
    id: "whole-unknown-media",
    media: "application/octet-stream",
    schema: { type: "string" },
    value: "a=1",
    expected: null,
    refusal: "Review whole query media encoding",
  },
  {
    id: "whole-nonutf8",
    media: "text/plain; charset=iso-8859-1",
    schema: { type: "string" },
    value: "a=1",
    expected: null,
    refusal: "Review whole query media encoding",
  },
];

/** @param {string} base @param {string} version */
export function openApiQuerystringDocument(base, version) {
  return {
    openapi: version,
    info: { title: "Owned whole query media", version: "1" },
    servers: [{ url: base }],
    paths: Object.fromEntries(
      openApiQuerystringCases.map((entry) => [
        "/" + entry.id,
        {
          get: {
            summary: entry.id,
            operationId: entry.id,
            parameters: [
              {
                in: "querystring",
                name: "label",
                content: {
                  [entry.media]: {
                    schema: entry.schema,
                    example: entry.value,
                    ...("encoding" in entry
                      ? { encoding: entry.encoding }
                      : {}),
                  },
                },
              },
            ],
            responses: { 200: { description: "OK" } },
          },
        },
      ]),
    ),
  };
}
