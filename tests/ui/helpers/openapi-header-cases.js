/** Independent expected simple-style header values from OAS examples. */
export const openApiHeaderCases =
  /** @type {Array<{id:string,value:any,explode?:boolean,expected:string|null}>} */ ([
    {
      id: "default-array",
      value: ["blue", "black", "brown"],
      expected: "blue,black,brown",
    },
    {
      id: "exploded-array",
      value: ["blue", "black", "brown"],
      explode: true,
      expected: "blue,black,brown",
    },
    {
      id: "default-object",
      value: { R: 100, G: 200, B: 150 },
      expected: "R,100,G,200,B,150",
    },
    {
      id: "exploded-object",
      value: { R: 100, G: 200, B: 150 },
      explode: true,
      expected: "R=100,G=200,B=150",
    },
    {
      id: "scalar-data",
      value: 'a b/%20?x=y&z="yes"',
      expected: 'a b/%20?x=y&z="yes"',
    },
    {
      id: "array-data",
      value: ["a b", "100%", "x/y?z=1"],
      expected: "a b,100%,x/y?z=1",
    },
    {
      id: "object-data",
      value: { "a b": "100%", "x/y": "z=1" },
      explode: true,
      expected: "a b=100%,x/y=z=1",
    },
    { id: "scalar-false", value: false, expected: "false" },
    { id: "scalar-zero", value: 0, expected: "0" },
    { id: "scalar-empty", value: "", expected: "" },
    { id: "empty-array", value: [], expected: null },
    { id: "empty-object", value: {}, explode: true, expected: null },
  ]);

/** @param {string} server */
export function openApiHeaderDocument(server) {
  return {
    openapi: "3.0.3",
    info: { title: "Owned header serialization", version: "1" },
    servers: [{ url: server }],
    paths: Object.fromEntries(
      openApiHeaderCases.map((entry) => [
        "/" + entry.id,
        {
          // Differently cased operation-level name must replace this declaration.
          parameters: [
            {
              name: "x-owned",
              in: "header",
              schema: { type: "string" },
              example: "stale inherited value",
            },
          ],
          get: {
            summary: entry.id,
            operationId: entry.id.replaceAll("-", "_"),
            parameters: [
              {
                name: "X-Owned",
                in: "header",
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
                          typeof entry.value === "number"
                            ? "number"
                            : typeof entry.value === "boolean"
                              ? "boolean"
                              : "string",
                      },
                example: entry.value,
              },
              ...["Accept", "Content-Type", "Authorization"].map((name) => ({
                name,
                in: "header",
                schema: { type: "string" },
                example: "ignored-declaration",
              })),
            ],
            responses: { 200: { description: "Owned response" } },
          },
        },
      ]),
    ),
  };
}
