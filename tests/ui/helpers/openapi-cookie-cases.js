/** Independent RFC6265/OAS cookie expectations, including incompatible form controls. */
export const openApiCookieCases = [
  { id: "form-blue", value: "blue", expected: "color=blue" },
  { id: "form-empty", value: "", expected: "color=" },
  { id: "form-false", value: false, expected: "color=false" },
  { id: "form-zero", value: 0, expected: "color=0" },
  { id: "form-null", value: null, expected: null },
  { id: "form-data", value: "a b/;%20", expected: "color=a%20b%2F%3B%2520" },
  {
    id: "plain-data",
    content: true,
    value: "a+/=:%20",
    expected: "color=a+/=:%20",
  },
  {
    id: "plain-quotes",
    content: true,
    value: '"yes"',
    expected: 'color="yes"',
  },
  {
    id: "plain-invalid",
    content: true,
    value: "a;b",
    refusal: "invalid cookie characters",
  },
  {
    id: "plain-single-quote",
    content: true,
    value: '"',
    refusal: "invalid cookie characters",
  },
  { id: "form-empty-array", value: [], expected: null },
  {
    id: "form-array",
    value: ["blue", "black"],
    refusal: "Review compound cookie",
  },
  {
    id: "cookie-array",
    version32: true,
    style: "cookie",
    value: ["blue", "black"],
    expected: "color=blue; color=black",
  },
  {
    id: "cookie-object",
    version32: true,
    style: "cookie",
    value: { R: 100, empty: "", gone: null },
    expected: "R=100; empty=",
  },
  {
    id: "cookie-null-array",
    version32: true,
    style: "cookie",
    type: "array",
    value: null,
    expected: null,
  },
  {
    id: "cookie-empty-object",
    version32: true,
    style: "cookie",
    value: {},
    expected: null,
  },
  {
    id: "cookie-array-members",
    version32: true,
    style: "cookie",
    value: [null, "", 0, false],
    expected: "color=; color=0; color=false",
  },
  {
    id: "cookie-percent",
    version32: true,
    style: "cookie",
    value: "a%20b",
    expected: "color=a%20b",
  },
  {
    id: "cookie-no-explode",
    version32: true,
    style: "cookie",
    explode: false,
    value: ["blue"],
    refusal: "requires explode=true",
  },
  {
    id: "cookie-nested",
    version32: true,
    style: "cookie",
    value: [{ x: 1 }],
    refusal: "requires flat scalar",
  },
  {
    id: "cookie-comma",
    version32: true,
    style: "cookie",
    value: "a,b",
    refusal: "invalid cookie characters",
  },
];

/** @param {string} server @param {string} version */
export function openApiCookieDocument(server, version) {
  const cases = openApiCookieCases.filter(
    (entry) => !entry.version32 || version.startsWith("3.2"),
  );
  return {
    openapi: version,
    info: { title: "Owned cookie parameters", version: "1" },
    servers: [{ url: server }],
    paths: Object.fromEntries(
      cases.map((entry) => {
        const type =
          entry.type ||
          (Array.isArray(entry.value)
            ? "array"
            : entry.value && typeof entry.value === "object"
              ? "object"
              : typeof entry.value === "number"
                ? "number"
                : typeof entry.value === "boolean"
                  ? "boolean"
                  : "string");
        const schema = {
          type: version.startsWith("3.0") ? type : [type, "null"],
          ...(version.startsWith("3.0") ? { nullable: true } : {}),
          ...(type === "array" ? { items: {} } : {}),
        };
        const parameter = {
          name: "color",
          in: "cookie",
          ...(entry.content
            ? { content: { "text/plain": { schema, example: entry.value } } }
            : {
                schema,
                example: entry.value,
                ...(entry.style ? { style: entry.style } : {}),
                ...(entry.explode !== undefined
                  ? { explode: entry.explode }
                  : {}),
              }),
        };
        return [
          "/" + entry.id,
          {
            get: {
              summary: entry.id,
              operationId: entry.id.replaceAll("-", "_"),
              parameters: [parameter],
              responses: { 200: { description: "OK" } },
            },
          },
        ];
      }),
    ),
  };
}
