/** Independent OAS3.1.2/RFC6570 style table targets. */
export const openApiPathCases =
  /** @type {Array<{id:string,style?:string,explode?:boolean,value:any,slot?:string,expected:string}>} */ ([]);
for (const [style, values] of Object.entries({
  simple: [
    "blue",
    "blue",
    "blue,black,brown",
    "blue,black,brown",
    "R,100,G,200,B,150",
    "R=100,G=200,B=150",
  ],
  label: [
    ".blue",
    ".blue",
    ".blue,black,brown",
    ".blue.black.brown",
    ".R,100,G,200,B,150",
    ".R=100.G=200.B=150",
  ],
  matrix: [
    ";color=blue",
    ";color=blue",
    ";color=blue,black,brown",
    ";color=blue;color=black;color=brown",
    ";color=R,100,G,200,B,150",
    ";R=100;G=200;B=150",
  ],
})) {
  for (let index = 0; index < values.length; index++) {
    const id = style + "-" + index;
    openApiPathCases.push({
      id,
      style,
      explode: index % 2 === 1,
      value:
        index < 2
          ? "blue"
          : index < 4
            ? ["blue", "black", "brown"]
            : { R: 100, G: 200, B: 150 },
      expected: `/${id}/${values[index]}/tail`,
    });
  }
}
openApiPathCases.push(
  {
    id: "default-array",
    value: ["blue", "black", "brown"],
    expected: "/default-array/blue,black,brown/tail",
  },
  {
    id: "encoded-data",
    value: ["a,b", "x/y", "100%", "a?b#c", "สี"],
    expected:
      "/encoded-data/a%2Cb,x%2Fy,100%25,a%3Fb%23c,%E0%B8%AA%E0%B8%B5/tail",
  },
  {
    id: "encoded-label",
    style: "label",
    explode: true,
    value: ["a/b", "x,y"],
    expected: "/encoded-label/.a%2Fb.x%2Cy/tail",
  },
  {
    id: "encoded-matrix",
    style: "matrix",
    explode: true,
    value: { "a;b": "x=y", "x/y": "100%" },
    expected: "/encoded-matrix/;a%3Bb=x%3Dy;x%2Fy=100%25/tail",
  },
  {
    id: "embedded",
    value: "a/b",
    slot: "prefix-{color}.json",
    expected: "/embedded/prefix-a%2Fb.json/tail",
  },
  {
    id: "repeated",
    style: "label",
    value: "blue",
    slot: "{color}-{color}",
    expected: "/repeated/.blue-.blue/tail",
  },
  {
    id: "static-colon",
    value: "blue",
    slot: "literal:part-{color}",
    expected: "/static-colon/literal:part-blue/tail",
  },
  { id: "scalar-false", value: false, expected: "/scalar-false/false/tail" },
  { id: "scalar-zero", value: 0, expected: "/scalar-zero/0/tail" },
  { id: "scalar-empty", value: "", expected: "/scalar-empty//tail" },
  {
    id: "matrix-empty",
    style: "matrix",
    value: "",
    expected: "/matrix-empty/;color/tail",
  },
  {
    id: "matrix-empty-items",
    style: "matrix",
    explode: true,
    value: ["", "blue"],
    expected: "/matrix-empty-items/;color;color=blue/tail",
  },
  {
    id: "matrix-empty-property",
    style: "matrix",
    explode: true,
    value: { R: "", G: "blue" },
    expected: "/matrix-empty-property/;R;G=blue/tail",
  },
);
for (const style of ["simple", "label", "matrix"])
  for (const [kind, value] of [
    ["array", []],
    ["object", {}],
  ]) {
    const id = `empty-${style}-${kind}`;
    openApiPathCases.push({ id, style, value, expected: `/${id}//tail` });
  }
openApiPathCases.push(
  {
    id: "simple-empty-property",
    style: "simple",
    explode: true,
    value: { R: "", G: "blue" },
    expected: "/simple-empty-property/R,G=blue/tail",
  },
  {
    id: "label-empty-property",
    style: "label",
    explode: true,
    value: { R: "", G: "blue" },
    expected: "/label-empty-property/.R.G=blue/tail",
  },
  {
    id: "null-array-members",
    value: ["blue", null, "brown"],
    expected: "/null-array-members/blue,brown/tail",
  },
  {
    id: "null-object-members",
    style: "label",
    explode: true,
    value: { R: null, G: "blue" },
    expected: "/null-object-members/.G=blue/tail",
  },
  {
    id: "undefined-object",
    style: "matrix",
    explode: true,
    value: { R: null },
    expected: "/undefined-object//tail",
  },
);

/** @param {string} server */
export function openApiPathDocument(server) {
  return {
    openapi: "3.0.3",
    info: { title: "Owned path serialization", version: "1" },
    servers: [{ url: server }],
    paths: Object.fromEntries(
      openApiPathCases.map((entry) => [
        `/${entry.id}/${entry.slot || "{color}"}/tail`,
        {
          get: {
            summary: entry.id,
            operationId: entry.id.replaceAll("-", "_"),
            parameters: [
              {
                name: "color",
                in: "path",
                required: true,
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
