export const openApiMethodCases = [
  {
    id: "fixed-get",
    method: "GET",
    key: "get",
    query: "inherited",
    body: "",
  },
  {
    id: "fixed-query",
    method: "QUERY",
    key: "query",
    query: "inherited",
    body: '{\n  "kind": "fixed-query"\n}',
  },
  {
    id: "custom-copy",
    method: "COPY",
    key: "COPY",
    query: "inherited",
    body: '{\n  "kind": "custom-copy"\n}',
  },
  {
    id: "custom-case",
    method: "custom-METHOD",
    key: "custom-METHOD",
    query: "override",
    body: '{\n  "kind": "custom-case"\n}',
  },
  {
    id: "custom-lower-get",
    method: "get",
    key: "get",
    query: "inherited",
    body: '{\n  "kind": "custom-lower-get"\n}',
  },
  {
    id: "custom-token",
    method: "M!x",
    key: "M!x",
    query: "inherited",
    body: '{\n  "kind": "custom-token"\n}',
  },
];
/** @param {string} base @param {string} [version] @param {boolean} [namedExamples] */
export function openApiMethodDocument(
  base,
  version = "3.2.1",
  namedExamples = false,
) {
  const item = /** @type {Record<string,any>} */ ({
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string" },
        ...(namedExamples
          ? {
              examples: {
                first: { dataValue: "first" },
                second: { dataValue: "row +" },
              },
            }
          : { example: "row +" }),
      },
      {
        in: "query",
        name: "scope",
        schema: { type: "string" },
        ...(namedExamples
          ? {
              examples: {
                first: { dataValue: "first" },
                second: { dataValue: "inherited" },
              },
            }
          : { example: "inherited" }),
      },
    ],
    additionalOperations: {},
  });
  for (const entry of openApiMethodCases) {
    const operation = /** @type {Record<string,any>} */ ({
      summary: entry.id,
      operationId: entry.id,
      responses: { 200: { description: "OK" } },
    });
    if (entry.body)
      operation.requestBody = {
        content: {
          "application/json": {
            schema: { type: "object" },
            ...(namedExamples
              ? {
                  examples: {
                    first: { dataValue: { kind: "wrong" } },
                    second: { dataValue: { kind: entry.id } },
                  },
                }
              : { example: { kind: entry.id } }),
          },
        },
      };
    if (entry.query === "override")
      operation.parameters = [
        {
          in: "query",
          name: "scope",
          schema: { type: "string" },
          ...(namedExamples
            ? {
                examples: {
                  first: { dataValue: "first" },
                  second: { dataValue: "override" },
                },
              }
            : { example: "override" }),
        },
      ];
    if (entry.id.startsWith("fixed-")) item[entry.key] = operation;
    else item.additionalOperations[entry.key] = operation;
  }
  return {
    openapi: version,
    info: { title: "Owned method casing", version: "1" },
    servers: [{ url: base }],
    paths: { "/method/{id}": item },
  };
}
