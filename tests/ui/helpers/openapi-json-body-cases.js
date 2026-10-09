/** Independent literal body goldens and media selection policy.
 * @param {string} version */
export function openApiJsonBodyCases(version) {
  const string = { type: "string" };
  /** @param {string} id @param {string} mime @param {unknown} value
   * @param {string} expected @param {Record<string,any>} [schema] @param {boolean} [json] */
  const make = (id, mime, value, expected, schema = string, json = true) => ({
    id,
    mime,
    expected,
    json,
    content: { [mime]: { schema, example: value } },
  });
  return [
    ...[
      ["canonical", "application/json"],
      ["case", "Application/JSON"],
      ["charset", 'application/json; charset="UTF-8"'],
      ["quoted", 'application/json; note="a,b;c"'],
      ["suffix", "application/problem+json"],
      ["suffix-case", "Application/Vnd.Owned+JSON; charset=UTF-8"],
      ["legacy-text", "text/json"],
    ].map(([id, mime]) => make(id, mime, "a +", '"a +"')),
    make("prefix-trap", "application/jsonp", "a +", "a +", string, false),
    make(
      "parameter-trap",
      "text/plain; note=json",
      "a +",
      "a +",
      string,
      false,
    ),
    make("object", "application/json", { ok: true }, '{\n  "ok": true\n}', {
      type: "object",
      properties: { ok: { type: "boolean" } },
    }),
    make(
      "array",
      "application/json",
      [0, false, null],
      "[\n  0,\n  false,\n  null\n]",
      { type: "array", items: {} },
    ),
    make("zero", "Application/JSON", 0, "0", { type: "integer" }),
    make("false", "Application/JSON", false, "false", { type: "boolean" }),
    make("empty", "Application/JSON", "", '""'),
    make(
      "null",
      "Application/JSON",
      null,
      "null",
      version.startsWith("3.0.")
        ? { type: "string", nullable: true }
        : { type: ["string", "null"] },
    ),
    make("unicode", "Application/JSON", "ไทย/🌙", '"ไทย/🌙"'),
    {
      id: "schema-free",
      mime: 'Application/JSON ; charset="UTF-8"',
      expected: '{\n  "ok": true\n}',
      json: true,
      content: {
        'Application/JSON ; charset="UTF-8"': { example: { ok: true } },
      },
    },
    ...[
      ["prefer-json", "Application/JSON"],
      ["prefer-suffix", "application/problem+json"],
    ].map(([id, mime]) => ({
      ...make(id, mime, "json", '"json"'),
      content: {
        "text/plain": { schema: string, example: "plain" },
        [mime]: { schema: string, example: "json" },
      },
    })),
    {
      ...make(
        "prefer-canonical",
        "application/json",
        "canonical",
        '"canonical"',
      ),
      content: {
        "Application/JSON": { schema: string, example: "variant" },
        "application/json": { schema: string, example: "canonical" },
      },
    },
  ];
}

/** @param {string} version @param {string} base */
export function openApiJsonBodyDocument(version, base) {
  return {
    openapi: version,
    info: { title: "Owned JSON body media", version: "1" },
    servers: [{ url: base }],
    paths: Object.fromEntries(
      openApiJsonBodyCases(version).map(({ id, content }) => [
        "/" + id,
        {
          post: {
            summary: id,
            operationId: id,
            requestBody: { required: true, content },
            responses: { 200: { description: "OK" } },
          },
        },
      ]),
    ),
  };
}
