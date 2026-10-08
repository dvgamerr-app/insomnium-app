/** Independent wire expectations: RFC6570 undefined values vs defined empty values. */
export const nullableCases = [
  { id: "null", value: null, query: "", path: "", header: null },
  { id: "empty", value: "", query: "?color=", path: ";color", header: "" },
  {
    id: "literal-null",
    value: "null",
    query: "?color=null",
    path: ";color=null",
    header: "null",
  },
  {
    id: "false",
    value: false,
    query: "?color=false",
    path: ";color=false",
    header: "false",
  },
  { id: "zero", value: 0, query: "?color=0", path: ";color=0", header: "0" },
  {
    id: "data",
    value: "a/b%",
    query: "?color=a%2Fb%25",
    path: ";color=a%2Fb%25",
    header: "a/b%",
  },
  {
    id: "null-array",
    type: "array",
    value: null,
    query: "",
    path: "",
    header: null,
  },
  {
    id: "null-object",
    type: "object",
    value: null,
    query: "",
    path: "",
    header: null,
  },
  {
    id: "empty-array",
    type: "array",
    value: [],
    query: "",
    path: "",
    header: null,
  },
  {
    id: "empty-object",
    type: "object",
    value: {},
    query: "",
    path: "",
    header: null,
  },
  {
    id: "null-members",
    type: "array",
    value: [null, "", false, 0],
    query: "?color=&color=false&color=0",
    path: ";color;color=false;color=0",
    header: ",false,0",
  },
  {
    id: "object-members",
    type: "object",
    value: { gone: null, empty: "", n: 0 },
    query: "?empty=&n=0",
    path: ";empty;n=0",
    header: "empty,n=0",
  },
];

/** @param {string} server @param {string} version */
export function nullableDocument(server, version) {
  return {
    openapi: version,
    info: { title: "Owned nullable values", version: "1" },
    servers: [{ url: server }],
    paths: Object.fromEntries(
      nullableCases.map((entry) => {
        const type =
          entry.type ||
          (typeof entry.value === "number"
            ? "number"
            : typeof entry.value === "boolean"
              ? "boolean"
              : "string");
        const schema = {
          type: version.startsWith("3.1") ? [type, "null"] : type,
          ...(version.startsWith("3.0") ? { nullable: true } : {}),
          ...(type === "array" ? { items: {} } : {}),
        };
        return [
          "/" + entry.id + "/p{color}/tail",
          {
            get: {
              summary: entry.id,
              operationId: entry.id.replaceAll("-", "_"),
              parameters: ["query", "header", "path"].map((location) => ({
                name: location === "header" ? "X-Owned" : "color",
                in: location,
                ...(location === "path" ? { required: true } : {}),
                style:
                  location === "path"
                    ? "matrix"
                    : location === "header"
                      ? "simple"
                      : "form",
                explode: true,
                schema,
                example: entry.value,
              })),
              responses: { 200: { description: "OK" } },
            },
          },
        ];
      }),
    ),
  };
}
