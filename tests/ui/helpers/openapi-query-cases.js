/** Independent wire expectations from style examples with RFC3986/OAS Appendix E
 * delimiter encoding, plus literal/pre-encoded data and parameter-name controls. */
export const openApiQueryCases =
  /** @type {Array<{id:string,name?:string,style?:string,explode?:boolean,value:any,expected:string}>} */ ([
    {
      id: "form-default-array",
      value: ["blue", "black", "brown"],
      expected: "color=blue&color=black&color=brown",
    },
    {
      id: "form-array",
      style: "form",
      explode: false,
      value: ["blue", "black", "brown"],
      expected: "color=blue,black,brown",
    },
    {
      id: "form-object",
      style: "form",
      explode: false,
      value: { R: 100, G: 200, B: 150 },
      expected: "color=R,100,G,200,B,150",
    },
    {
      id: "form-exploded-object",
      style: "form",
      explode: true,
      value: { R: 100, G: 200, B: 150 },
      expected: "R=100&G=200&B=150",
    },
    {
      id: "space-array",
      style: "spaceDelimited",
      value: ["blue", "black", "brown"],
      expected: "color=blue%20black%20brown",
    },
    {
      id: "space-object",
      style: "spaceDelimited",
      value: { R: 100, G: 200, B: 150 },
      expected: "color=R%20100%20G%20200%20B%20150",
    },
    {
      id: "pipe-array",
      style: "pipeDelimited",
      value: ["blue", "black", "brown"],
      expected: "color=blue%7Cblack%7Cbrown",
    },
    {
      id: "pipe-object",
      style: "pipeDelimited",
      value: { R: 100, G: 200, B: 150 },
      expected: "color=R%7C100%7CG%7C200%7CB%7C150",
    },
    {
      id: "deep-object",
      style: "deepObject",
      explode: true,
      value: { R: 100, G: 200, B: 150 },
      expected: "color%5BR%5D=100&color%5BG%5D=200&color%5BB%5D=150",
    },
    {
      id: "encoded-array-data",
      style: "form",
      explode: false,
      value: ["a,b", "x&y", "100%", "สี"],
      expected: "color=a%2Cb,x%26y,100%25,%E0%B8%AA%E0%B8%B5",
    },
    {
      id: "encoded-exploded-data",
      value: ["a/b?x=y", "a b", "!()*'"],
      expected: "color=a%2Fb%3Fx%3Dy&color=a%20b&color=%21%28%29%2A%27",
    },
    {
      id: "encoded-deep-data",
      style: "deepObject",
      explode: true,
      value: { "a]&b": "x=y#z" },
      expected: "color%5Ba%5D%26b%5D=x%3Dy%23z",
    },
    { id: "scalar-false", value: false, expected: "color=false" },
    { id: "scalar-zero", value: 0, expected: "color=0" },
    { id: "scalar-empty", value: "", expected: "color=" },
    {
      id: "pipe-literal-and-escaped-data",
      style: "pipeDelimited",
      value: ["a|b", "a%7Cb", "", "%", "สี"],
      expected: "color=a%7Cb%7Ca%257Cb%7C%7C%25%7C%E0%B8%AA%E0%B8%B5",
    },
    {
      id: "deep-literal-and-escaped-data",
      style: "deepObject",
      explode: true,
      value: { "a[b]": "x[y]", "pre%5Bencoded%5D": "100%" },
      expected:
        "color%5Ba%5Bb%5D%5D=x%5By%5D&color%5Bpre%255Bencoded%255D%5D=100%25",
    },
    {
      id: "deep-encoded-parameter-name",
      name: "a[b]|%5B",
      style: "deepObject",
      explode: true,
      value: { key: "v" },
      expected: "a%5Bb%5D%7C%255B%5Bkey%5D=v",
    },
  ]);

/** @param {string} server @param {string} [version] */
export function openApiQueryDocument(server, version = "3.0.3") {
  return {
    openapi: version,
    info: { title: "Owned query serialization", version: "1" },
    servers: [{ url: server }],
    paths: Object.fromEntries(
      openApiQueryCases.map((entry) => [
        "/" + entry.id,
        {
          get: {
            summary: entry.id,
            operationId: entry.id.replaceAll("-", "_"),
            parameters: [
              {
                name: entry.name ?? "color",
                in: "query",
                ...(entry.style ? { style: entry.style } : {}),
                ...(entry.explode !== undefined
                  ? { explode: entry.explode }
                  : {}),
                schema: Array.isArray(entry.value)
                  ? { type: "array", items: { type: "string" } }
                  : entry.value && typeof entry.value === "object"
                    ? {
                        type: "object",
                        additionalProperties: { type: "string" },
                      }
                    : {
                        type:
                          typeof entry.value === "boolean"
                            ? "boolean"
                            : typeof entry.value === "number"
                              ? "number"
                              : "string",
                      },
                example: entry.value,
              },
            ],
            responses: { 200: { description: "Owned response" } },
          },
        },
      ]),
    ),
  };
}
