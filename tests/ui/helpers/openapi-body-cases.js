/** Raw binary media examples follow OAS 3.0 format/binary and OAS 3.1+ no-schema bodies.
 * @param {string} version */
export function openApiBinaryBodyCases(version) {
  const media = [
    "image/png",
    "application/pdf",
    "application/octet-stream",
    "application/x-owned-file",
  ];
  if (version.startsWith("3.0."))
    media.push("text/plain", "application/json", "application/xml");
  return media.map((mime, index) => ({
    id: `binary-${index}`,
    mime,
    media: version.startsWith("3.0.")
      ? { schema: { type: "string", format: "binary" } }
      : {},
  }));
}

/** @param {string} version @param {string} base */
export function openApiBinaryBodyDocument(version, base) {
  return {
    openapi: version,
    info: { title: "Owned binary request bodies", version: "1" },
    servers: [{ url: base }],
    paths: Object.fromEntries(
      openApiBinaryBodyCases(version).map(({ id, mime, media }) => [
        "/" + id,
        {
          post: {
            summary: id,
            operationId: id,
            requestBody: { required: true, content: { [mime]: media } },
            responses: { 200: { description: "OK" } },
          },
        },
      ]),
    ),
  };
}
