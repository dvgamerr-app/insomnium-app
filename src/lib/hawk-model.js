/** @param {Record<string, any>} auth @param {Record<string, any>} body
 * @param {string[][]} headers @param {(value: unknown) => string} resolve */
export function prepareHawk(auth, body, headers, resolve) {
  if (
    auth.validatePayload != null &&
    ![true, false, "true", "false"].includes(auth.validatePayload)
  )
    throw new Error(
      "Choose the Hawk payload validation option explicitly in Auth.",
    );
  const config = Object.fromEntries(
    [
      "id",
      "key",
      "algorithm",
      "ext",
      "bodyMode",
      "nonce",
      "timestamp",
      "app",
      "dlg",
    ].map((key) => [key, resolve(auth[key])]),
  );
  config.bodyMode ||= "legacy";
  const validatePayload =
    auth.validatePayload === true || auth.validatePayload === "true";
  if (!["legacy", "standard", "postman"].includes(config.bodyMode))
    throw new Error("Choose a Hawk signing mode in Auth.");
  let legacyPayload = null;
  let legacyContentType = "";
  if (validatePayload && config.bodyMode === "legacy") {
    if (body.text != null) {
      if (typeof body.text !== "string")
        throw new Error("Legacy Hawk payload text must be a string.");
      legacyPayload = resolve(body.text);
    }
    legacyContentType = resolve(body.mimeType);
  }
  if (validatePayload && config.bodyMode === "postman") {
    const types = headers.filter(
      ([name]) => name.toLowerCase() === "content-type",
    );
    if (types.length > 1)
      throw new Error(
        "Postman Hawk payload signing requires one Content-Type header.",
      );
    legacyContentType = types[0]?.[1] || "";
  }
  return {
    ...config,
    validatePayload,
    legacyPayload,
    legacyContentType,
    postmanSkipPayload:
      config.bodyMode === "postman" && body.mimeType === "multipart/form-data",
  };
}
