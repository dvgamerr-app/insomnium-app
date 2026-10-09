/** Literal goldens for dataValue selection; schema defaults deliberately differ. */
export const openApiDataValueCases = /** @type {Record<string,any>[]} */ ([
  {
    id: "query-false",
    parameter: {
      in: "query",
      name: "flag",
      schema: { type: "boolean", default: true },
    },
    data: false,
    target: "?flag=false",
    selected: { path: ["parameters", 0, "value"], value: "false" },
  },
  {
    id: "query-array",
    parameter: {
      in: "query",
      name: "item",
      schema: { type: "array", items: { type: "integer" }, default: [9] },
    },
    data: [2, 3],
    target: "?item=2&item=3",
    selected: { path: ["parameters", 0, "value"], value: "[2,3]" },
  },
  {
    id: "header-array",
    parameter: {
      in: "header",
      name: "X-Owned-Data",
      schema: { type: "array", items: { type: "integer" }, default: [9] },
    },
    data: [7, 0],
    target: "",
    headers: { "x-owned-data": "7,0" },
    selected: { path: ["headers", 0, "value"], value: "[7,0]" },
  },
  {
    id: "path-string",
    path: "/path-string/{id}",
    parameter: {
      in: "path",
      name: "id",
      required: true,
      schema: { type: "string", default: "fallback" },
    },
    data: "chosen space",
    expectedTarget: "/path-string/chosen%20space",
    selected: { path: ["pathParameters", 0, "value"], value: "chosen space" },
  },
  {
    id: "cookie-string",
    parameter: {
      in: "cookie",
      name: "owned-data-token",
      schema: { type: "string", default: "fallback" },
    },
    data: "a b",
    target: "",
    headers: { cookie: "owned-data-token=a%20b" },
    selected: { path: ["cookieParameters", 0, "value"], value: "a b" },
  },
  {
    id: "query-json",
    parameter: { in: "query", name: "payload" },
    media: "application/json",
    schema: {
      type: "object",
      properties: { chosen: { type: "boolean" } },
      default: { chosen: false },
    },
    data: { chosen: true },
    target: "?payload=%7B%22chosen%22%3Atrue%7D",
    selected: { path: ["parameters", 0, "value"], value: '{"chosen":true}' },
  },
  {
    id: "whole-json",
    parameter: { in: "querystring", name: "label" },
    media: "application/json",
    schema: {
      type: "object",
      properties: { chosen: { type: "boolean" } },
      default: { chosen: false },
    },
    data: { chosen: true },
    target: "?%7B%22chosen%22%3Atrue%7D",
    selected: { path: ["parameters", 0, "value"], value: '{"chosen":true}' },
  },
  {
    id: "whole-empty-text",
    parameter: { in: "querystring", name: "label" },
    media: "text/plain; charset=UTF-8",
    schema: { type: "string", default: "fallback=1" },
    data: "",
    target: "?",
    selected: { path: ["parameters", 0, "value"], value: "" },
  },
  {
    id: "whole-form",
    parameter: { in: "querystring", name: "label" },
    media: "application/x-www-form-urlencoded",
    schema: {
      type: "object",
      properties: {
        foo: { type: "string" },
        bar: { type: "boolean" },
        zero: { type: "integer" },
      },
      default: { foo: "fallback", bar: true, zero: 7 },
    },
    data: { foo: "a + b", bar: false, zero: 0 },
    target: "?foo=a+%2B+b&bar=false&zero=0",
    selected: {
      path: ["parameters", 0, "value"],
      value: '{"foo":"a + b","bar":false,"zero":0}',
    },
  },
  {
    id: "body-false",
    media: "application/json",
    schema: { type: "boolean", default: true },
    data: false,
    body: "false",
  },
  {
    id: "body-zero",
    media: "application/json",
    schema: { type: "integer", default: 7 },
    data: 0,
    body: "0",
  },
  {
    id: "body-empty",
    media: "application/json",
    schema: { type: "string", default: "fallback" },
    data: "",
    body: '""',
  },
  {
    id: "body-null",
    media: "application/json",
    schema: { type: ["string", "null"], default: "fallback" },
    data: null,
    body: "null",
  },
  {
    id: "body-array",
    media: "application/json",
    schema: { type: "array", items: { type: "integer" }, default: [9] },
    data: [2, 3],
    body: "[\n  2,\n  3\n]",
  },
  {
    id: "body-object",
    media: "application/json",
    schema: {
      type: "object",
      properties: { key: { type: "string" } },
      default: { key: "fallback" },
    },
    data: { key: "chosen" },
    body: '{\n  "key": "chosen"\n}',
  },
  {
    id: "body-text",
    media: "text/plain; charset=UTF-8",
    schema: { type: "string", default: "fallback" },
    data: "ทดสอบ + 😀",
    body: "ทดสอบ + 😀",
  },
  {
    id: "body-form",
    media: "application/x-www-form-urlencoded",
    schema: {
      type: "object",
      properties: {
        foo: { type: "string" },
        bar: { type: "boolean" },
        zero: { type: "integer" },
      },
      default: { foo: "fallback", bar: true, zero: 7 },
    },
    data: { foo: "a + b", bar: false, zero: 0 },
    body: "foo=a+%2B+b&bar=false&zero=0",
    selected: { path: ["body", "params", 0, "value"], value: "a + b" },
  },
  {
    id: "query-json-parameter-level",
    parameter: { in: "query", name: "payload" },
    exampleAt: "parameter",
    media: "application/json",
    schema: {
      type: "object",
      properties: { chosen: { type: "string" } },
      default: { chosen: "fallback" },
    },
    data: { chosen: "parameter" },
    target: "?payload=%7B%22chosen%22%3A%22parameter%22%7D",
    selected: {
      path: ["parameters", 0, "value"],
      value: '{"chosen":"parameter"}',
    },
  },
  {
    id: "whole-json-parameter-level",
    parameter: { in: "querystring", name: "label" },
    exampleAt: "parameter",
    media: "application/json",
    schema: {
      type: "object",
      properties: { chosen: { type: "string" } },
      default: { chosen: "fallback" },
    },
    data: { chosen: "parameter" },
    target: "?%7B%22chosen%22%3A%22parameter%22%7D",
    selected: {
      path: ["parameters", 0, "value"],
      value: '{"chosen":"parameter"}',
    },
  },
  {
    id: "query-json-media-precedence",
    parameter: {
      in: "query",
      name: "payload",
      examples: { chosen: { dataValue: { chosen: "parameter" } } },
    },
    media: "application/json",
    schema: {
      type: "object",
      properties: { chosen: { type: "string" } },
      default: { chosen: "fallback" },
    },
    data: { chosen: "media" },
    target: "?payload=%7B%22chosen%22%3A%22media%22%7D",
    selected: { path: ["parameters", 0, "value"], value: '{"chosen":"media"}' },
  },
]);
/** @param {string} base @param {string} version */
export function openApiDataValueDocument(base, version) {
  return {
    openapi: version,
    info: { title: "Owned Example data values", version: "1" },
    servers: [{ url: base }],
    paths: Object.fromEntries(
      openApiDataValueCases.map((c) => {
        const media = {
          schema: c.schema,
          ...(c.exampleAt === "parameter"
            ? {}
            : { examples: { chosen: { dataValue: c.data } } }),
        };
        const parameter = c.parameter
          ? {
              ...c.parameter,
              ...(c.media
                ? {
                    content: { [c.media]: media },
                    ...(c.exampleAt === "parameter"
                      ? { examples: { chosen: { dataValue: c.data } } }
                      : {}),
                  }
                : { examples: { chosen: { dataValue: c.data } } }),
            }
          : null;
        return [
          c.path || "/" + c.id,
          {
            post: {
              summary: c.id,
              operationId: c.id,
              ...(parameter
                ? { parameters: [parameter] }
                : { requestBody: { content: { [c.media]: media } } }),
              responses: { 200: { description: "ok" } },
            },
          },
        ];
      }),
    ),
  };
}
