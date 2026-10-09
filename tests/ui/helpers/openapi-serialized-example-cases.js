/** Literal authored wire examples, deliberately different from schema defaults. */
export const serializedExampleCases = /** @type {Record<string,any>[]} */ ([
  {
    id: "query",
    data: false,
    location: "query",
    name: "flag",
    text: "flag=0",
    expected: "?flag=0",
  },
  {
    id: "query-repeat",
    location: "query",
    name: "item",
    text: "item=a%20b&item=%2f",
    expected: "?item=a%20b&item=%2f",
  },
  {
    id: "header",
    location: "header",
    name: "X-Owned-Serialized",
    text: "1 , 2",
    expected: "1 , 2",
  },
  {
    id: "path",
    location: "path",
    name: "id",
    text: ";id=a%2fb",
    expected: "/path/;id=a%2fb",
  },
  {
    id: "cookie",
    location: "cookie",
    name: "owned",
    text: "owned=a%20b; second=%2f",
    expected: "owned=a%20b; second=%2f",
  },
  {
    id: "media-query",
    location: "query",
    name: "payload",
    media: "application/json",
    level: "media",
    text: '{ "n": 9007199254740993, "e": 1e+02 }',
    expected:
      "?payload=%7B%20%22n%22%3A%209007199254740993%2C%20%22e%22%3A%201e%2B02%20%7D",
  },
  {
    id: "whole-query",
    location: "querystring",
    name: "label",
    media: "application/json",
    text: "%7B%20%22n%22%3A1%20%7D",
    expected: "?%7B%20%22n%22%3A1%20%7D",
  },
  {
    id: "whole-media",
    location: "querystring",
    name: "label",
    media: "application/json",
    level: "media",
    text: '{ "n":1 }',
    expected: "?%7B%20%22n%22%3A1%20%7D",
  },
  {
    id: "whole-form",
    location: "querystring",
    name: "label",
    media: "application/x-www-form-urlencoded",
    level: "media",
    text: "x=a+%2B+b&x=%2f",
    expected: "?x=a+%2B+b&x=%2f",
  },
  {
    id: "whole-empty",
    location: "querystring",
    name: "label",
    media: "text/plain",
    text: "",
    expected: "?",
  },
  {
    id: "body-json",
    location: "body",
    media: "application/json",
    text: '{ "n": 9007199254740993, "e": 1e+02 }',
    expected: '{ "n": 9007199254740993, "e": 1e+02 }',
  },
  {
    id: "body-form",
    location: "body",
    media: "application/x-www-form-urlencoded",
    text: "x=a%20b&x=%2f",
    expected: "x=a%20b&x=%2f",
  },
  {
    id: "body-graphql",
    location: "body",
    media: "application/graphql",
    text: "query { viewer { id } }",
    expected: "query { viewer { id } }",
  },
  {
    id: "body-empty",
    location: "body",
    media: "text/plain",
    text: "",
    expected: "",
  },
  {
    id: "media-path",
    location: "path",
    name: "id",
    media: "text/plain",
    level: "media",
    text: "a/b é",
    expected: "/media-path/a%2Fb%20%C3%A9",
  },
  {
    id: "media-header",
    location: "header",
    name: "X-Owned-Serialized",
    media: "application/json",
    level: "media",
    text: '{ "n":1e+02 }',
    expected: '{ "n":1e+02 }',
  },
  {
    id: "media-cookie",
    location: "cookie",
    name: "owned",
    media: "text/plain",
    level: "media",
    text: "a%20b",
    expected: "owned=a%20b",
  },
  {
    id: "whole-text",
    location: "querystring",
    name: "label",
    media: "text/plain",
    level: "media",
    text: "x=two words&x=%2f",
    expected: "?x=two%20words&x=%2f",
  },
  {
    id: "body-unicode",
    location: "body",
    media: "text/plain; charset=utf-8",
    text: "é\nไทย",
    expected: "é\nไทย",
  },
  {
    id: "body-multipart",
    location: "body",
    media: "multipart/form-data; boundary=owned",
    text: '--owned\r\nContent-Disposition: form-data; name="x"\r\n\r\na%20b\r\n--owned--\r\n',
    expected:
      '--owned\r\nContent-Disposition: form-data; name="x"\r\n\r\na%20b\r\n--owned--\r\n',
  },
  {
    id: "unknown-media-query",
    location: "query",
    name: "expr",
    media: "application/jsonpath",
    text: "expr=%24.a.b%5B1%3A1%5D",
    expected: "?expr=%24.a.b%5B1%3A1%5D",
  },
]);

/** @param {string} base @param {string} version */
export function serializedExampleDocument(base, version) {
  return {
    openapi: version,
    info: { title: "Owned serialized examples", version: "1" },
    servers: [{ url: base }],
    paths: Object.fromEntries(
      serializedExampleCases.map((c) => {
        const example = {
          serializedValue: c.text,
          ...(Object.hasOwn(c, "data") ? { dataValue: c.data } : {}),
        };
        const media = {
          schema: { type: "string", default: "fallback" },
          ...(c.level === "media" || c.location === "body"
            ? { examples: { authored: example } }
            : {}),
        };
        const parameter = {
          name: c.name,
          in: c.location,
          ...(c.location === "path" ? { required: true } : {}),
          ...(c.media
            ? { content: { [c.media]: media } }
            : { schema: { type: "string", default: "fallback" } }),
          ...(c.level !== "media" ? { examples: { authored: example } } : {}),
        };
        return [
          c.location === "path" ? "/" + c.id + "/{id}" : "/" + c.id,
          {
            post: {
              operationId: c.id,
              ...(c.location === "body"
                ? { requestBody: { content: { [c.media]: media } } }
                : { parameters: [parameter] }),
              responses: { 200: { description: "OK" } },
            },
          },
        ];
      }),
    ),
  };
}
