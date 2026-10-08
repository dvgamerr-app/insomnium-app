/** Content examples retain nested JSON and distinguish JSON null from RFC undefined values. */
const jsonValues = [
  {
    id: "object",
    value: { nested: { items: [1, false, null, 'a b/%20?x=y&z="yes"'] } },
  },
  { id: "array", value: [null, { x: [false, 0, ""] }] },
  { id: "string", value: 'a b/%20?x=y&z="yes"' },
  { id: "unicode", value: "ไทย/🌙" },
  { id: "controls", value: "\r\n\t\u0000" },
  { id: "empty-string", value: "" },
  { id: "false", value: false },
  { id: "zero", value: 0 },
  { id: "null", value: null },
  { id: "empty-object", value: {} },
  { id: "empty-array", value: [] },
];
export const openApiContentCases = /** @type {Array<Record<string,any>>} */ ([
  ...["query", "header", "path", "cookie"].flatMap((location) =>
    [
      { id: "media-case", mediaType: "Application/JSON" },
      { id: "media-charset", mediaType: 'application/json; charset="UTF-8"' },
      { id: "media-quoted", mediaType: 'application/json; note="a,b;c"' },
    ].map((entry) => ({
      ...entry,
      location,
      id: location + "-" + entry.id,
      value: "blue",
    })),
  ),
  ...["query", "header", "path"].flatMap((location) =>
    jsonValues.map((entry) => ({
      ...entry,
      location,
      id: location + "-" + entry.id,
    })),
  ),
  ...[
    { id: "string", value: "blue" },
    { id: "empty-string", value: "" },
    { id: "false", value: false },
    { id: "zero", value: 0 },
    { id: "null", value: null },
    { id: "array-one", value: [1] },
    { id: "empty-array", value: [] },
    { id: "object", value: { x: 1 }, refusal: "invalid cookie characters" },
    { id: "array-many", value: [1, 2], refusal: "invalid cookie characters" },
    { id: "space", value: "a b", refusal: "invalid cookie characters" },
    { id: "unicode", value: "ไทย/🌙", refusal: "invalid cookie characters" },
    {
      id: "controls",
      value: "\r\n\t\u0000",
      refusal: "invalid cookie characters",
    },
  ].map((entry) => ({
    ...entry,
    location: "cookie",
    id: "cookie-" + entry.id,
  })),
  ...["query", "header", "path", "cookie"].map((location) => ({
    id: location + "-unsupported",
    location,
    mediaType: "application/xml",
    value: "<x>1</x>",
    refusal: "Review " + location + " content serialization",
  })),
  {
    id: "query-nonnullable",
    location: "query",
    nullable: false,
    value: "blue",
  },
  ...["query", "header", "path", "cookie"].map((location) => ({
    id: location + "-any",
    location,
    unrestricted: true,
    value: location === "cookie" ? 0 : { sample: true },
  })),
]);

/** @param {string} location */
export function contentParameterName(location) {
  return location === "header" ? "x-owned" : "color";
}

/** @param {string} server @param {string} version */
export function openApiContentDocument(server, version) {
  return {
    openapi: version,
    info: { title: "Owned JSON parameter content", version: "1" },
    servers: [{ url: server }],
    paths: Object.fromEntries(
      openApiContentCases.map((entry) => {
        const type = Array.isArray(entry.value)
          ? "array"
          : entry.value && typeof entry.value === "object"
            ? "object"
            : typeof entry.value === "number"
              ? "number"
              : typeof entry.value === "boolean"
                ? "boolean"
                : "string";
        const schema = entry.unrestricted
          ? {}
          : {
              type:
                version.startsWith("3.0") || entry.nullable === false
                  ? type
                  : [type, "null"],
              ...(version.startsWith("3.0") && entry.nullable !== false
                ? { nullable: true }
                : {}),
              ...(type === "array" ? { items: {} } : {}),
            };
        return [
          "/" +
            entry.id +
            (entry.location === "path" ? "/pre-{color}-{color}:tail" : ""),
          {
            get: {
              summary: entry.id,
              operationId: entry.id.replaceAll("-", "_"),
              parameters: [
                {
                  name: contentParameterName(entry.location),
                  in: entry.location,
                  ...(entry.location === "path" ? { required: true } : {}),
                  content: {
                    [entry.mediaType || "application/json"]: {
                      schema,
                      example: entry.value,
                    },
                  },
                },
              ],
              responses: { 200: { description: "OK" } },
            },
          },
        ];
      }),
    ),
  };
}

/** Independent URI encoding of the known JSON representation.
 * @param {string} text */
function uriData(text) {
  return encodeURIComponent(text).replace(
    /[!'()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/** @param {Record<string,any>} entry @param {any} [value] */
export function contentWireExpectation(entry, value = entry.value) {
  const json = JSON.stringify(value);
  return {
    target:
      "/" +
      entry.id +
      (entry.location === "query"
        ? "?color=" + uriData(json)
        : entry.location === "path"
          ? "/pre-" + uriData(json) + "-" + uriData(json) + ":tail"
          : ""),
    header: entry.location === "header" ? json : null,
    cookie: entry.location === "cookie" ? "color=" + json : null,
  };
}
