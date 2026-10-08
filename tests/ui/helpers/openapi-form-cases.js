/** Explicit Encoding Object style expectations, independent of the serializer. */
export const openApiFormCases = /** @type {Array<Record<string,any>>} */ ([
  {
    id: "array-exploded",
    value: ["blue", "black"],
    style: "form",
    explode: true,
    expected: "color=blue&color=black",
  },
  {
    id: "array-list",
    value: ["blue", "black"],
    style: "form",
    explode: false,
    expected: "color=blue,black",
  },
  {
    id: "object-exploded",
    value: { R: 100, G: 200 },
    style: "form",
    explode: true,
    expected: "R=100&G=200",
  },
  {
    id: "object-list",
    value: { R: 100, G: 200 },
    style: "form",
    explode: false,
    expected: "color=R,100,G,200",
  },
  {
    id: "space-array",
    value: ["blue", "black"],
    style: "spaceDelimited",
    expected: "color=blue%20black",
  },
  {
    id: "pipe-array",
    value: ["blue", "black"],
    style: "pipeDelimited",
    expected: "color=blue%7Cblack",
  },
  {
    id: "deep-object",
    value: { R: 100, G: 200 },
    style: "deepObject",
    explode: true,
    expected: "color%5BR%5D=100&color%5BG%5D=200",
  },
  {
    id: "reserved-scalar",
    value: "x/y?z#[]&=+%2f %GG😃",
    style: "form",
    allowReserved: true,
    expected: "color=x/y?z#[]%26%3D%2B%2f%20%25GG%F0%9F%98%83",
  },
  {
    id: "nullable-null",
    value: null,
    nullable: true,
    style: "form",
    expected: "",
  },
  { id: "empty-array", value: [], style: "form", expected: "" },
  {
    id: "object-null-false-zero",
    value: { a: null, b: false, c: 0, d: "" },
    style: "form",
    expected: "b=false&c=0&d=",
  },
  {
    id: "scalar-delimiters",
    value: "a + &= ไทย",
    style: "form",
    expected: "color=a%20%2B%20%26%3D%20%E0%B9%84%E0%B8%97%E0%B8%A2",
  },
  { id: "empty-string", value: "", style: "form", expected: "color=" },
  {
    id: "nullable-empty",
    value: "",
    nullable: true,
    style: "form",
    expected: "color=",
  },
  {
    id: "encoded-name",
    name: "c+[&]",
    value: "value",
    style: "form",
    allowReserved: true,
    expected: "c%2B%5B%26%5D=value",
  },
]);

/** @param {string} version @param {string} base */
export function openApiFormDocument(version, base) {
  return {
    openapi: version,
    info: { title: "Owned form style bodies", version: "1" },
    servers: [{ url: base }],
    paths: Object.fromEntries(
      openApiFormCases.map((entry) => {
        const name = entry.name || "color";
        const property = Array.isArray(entry.value)
          ? { type: "array", items: { type: "string" } }
          : entry.value && typeof entry.value === "object"
            ? { type: "object", additionalProperties: {} }
            : {
                type:
                  entry.nullable && !version.startsWith("3.0.")
                    ? ["string", "null"]
                    : "string",
                ...(entry.nullable && version.startsWith("3.0.")
                  ? { nullable: true }
                  : {}),
              };
        return [
          "/" + entry.id,
          {
            post: {
              summary: entry.id,
              operationId: entry.id,
              requestBody: {
                content: {
                  "application/x-www-form-urlencoded": {
                    schema: {
                      type: "object",
                      properties: { [name]: property },
                    },
                    example: { [name]: entry.value },
                    encoding: {
                      [name]: {
                        style: entry.style,
                        ...(entry.explode === undefined
                          ? {}
                          : { explode: entry.explode }),
                        ...(entry.allowReserved ? { allowReserved: true } : {}),
                        // RFC6570 fields supersede this otherwise unsupported media type.
                        contentType: "application/xml",
                      },
                    },
                  },
                },
              },
              responses: { 200: { description: "OK" } },
            },
          },
        ];
      }),
    ),
  };
}
