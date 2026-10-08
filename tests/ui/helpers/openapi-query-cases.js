/** Independent wire expectations from style examples with RFC3986/OAS Appendix E
 * delimiter encoding, plus literal/pre-encoded data and parameter-name controls. */
export const openApiQueryCases =
  /** @type {Array<{id:string,name?:string,style?:string,explode?:boolean,allowReserved?:boolean,nullable?:boolean,value:any,expected:string,serialized?:string}>} */ ([
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
    {
      id: "reserved-scalar",
      allowReserved: true,
      value: ":/?#[]@!$&'()*+,;=",
      serialized: "color=:/?%23%5B%5D@!$&'()*+,;=",
      expected: "color=:/?%23%5B%5D@!$&%27()*+,;=",
    },
    {
      id: "reserved-pre-encoded",
      allowReserved: true,
      value: "%2f%2F%23%5b%5D%26%3d%2B%27%25%252F",
      expected: "color=%2f%2F%23%5b%5D%26%3d%2B%27%25%252F",
    },
    {
      id: "reserved-malformed-percent",
      allowReserved: true,
      value: "% %2 %GG %2f สี\\|^\r\n\t\0",
      expected:
        "color=%25%20%252%20%25GG%20%2f%20%E0%B8%AA%E0%B8%B5%5C%7C%5E%0D%0A%09%00",
    },
    {
      id: "reserved-array",
      allowReserved: true,
      explode: false,
      value: ["a/b", "x%26y", "x&y", "a,b", ""],
      expected: "color=a/b,x%26y,x&y,a,b,",
    },
    {
      id: "reserved-exploded-array",
      allowReserved: true,
      value: ["a/b", "a%2Bb", "x=y", ""],
      expected: "color=a/b&color=a%2Bb&color=x=y&color=",
    },
    {
      id: "reserved-object",
      allowReserved: true,
      explode: false,
      value: { "a/b": "x/y", "a%26b": "x%2By", "a[b]": "x#y" },
      expected: "color=a/b,x/y,a%26b,x%2By,a%5Bb%5D,x%23y",
    },
    {
      id: "reserved-exploded-object",
      allowReserved: true,
      value: { "a/b": "x/y", "a%26b": "x%2By", "a[b]": "x#y" },
      expected: "a/b=x/y&a%26b=x%2By&a%5Bb%5D=x%23y",
    },
    {
      id: "reserved-space-array",
      allowReserved: true,
      style: "spaceDelimited",
      value: ["a/b", "x%2By", "a b"],
      expected: "color=a/b%20x%2By%20a%20b",
    },
    {
      id: "reserved-pipe-object",
      allowReserved: true,
      style: "pipeDelimited",
      value: { "a/b": "x/y", "a|b": "x%7Cy" },
      expected: "color=a/b%7Cx/y%7Ca%7Cb%7Cx%7Cy",
    },
    {
      id: "reserved-deep-object",
      allowReserved: true,
      style: "deepObject",
      explode: true,
      value: { "a/b": "x/y", "a[b]": "x#y", "a%5Bb%5D": "x%23y" },
      expected:
        "color%5Ba/b%5D=x/y&color%5Ba%5Bb%5D%5D=x%23y&color%5Ba%5Bb%5D%5D=x%23y",
    },
    {
      id: "reserved-parameter-name",
      name: "a/b%2F&=",
      allowReserved: true,
      value: "x/y%2F",
      expected: "a%2Fb%252F%26%3D=x/y%2F",
    },
    {
      id: "reserved-empty",
      allowReserved: true,
      value: "",
      expected: "color=",
    },
    {
      id: "reserved-explicit-false",
      allowReserved: false,
      value: "a/b%2F",
      expected: "color=a%2Fb%252F",
    },
    {
      id: "reserved-nullable-empty",
      allowReserved: true,
      nullable: true,
      value: "",
      expected: "color=",
    },
    {
      id: "reserved-nullable-null",
      allowReserved: true,
      nullable: true,
      value: null,
      expected: "",
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
                ...(entry.allowReserved !== undefined
                  ? { allowReserved: entry.allowReserved }
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
                          entry.nullable && !version.startsWith("3.0.")
                            ? ["string", "null"]
                            : typeof entry.value === "boolean"
                              ? "boolean"
                              : typeof entry.value === "number"
                                ? "number"
                                : "string",
                        ...(entry.nullable && version.startsWith("3.0.")
                          ? { nullable: true }
                          : {}),
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
