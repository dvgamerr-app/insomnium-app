const fields = [
  "consumerKey",
  "consumerSecret",
  "tokenKey",
  "tokenSecret",
  "signatureMethod",
  "privateKey",
  "callback",
  "version",
  "timestamp",
  "realm",
  "nonce",
  "verifier",
  "bodyMode",
];

/** @param {Record<string, any>} auth @param {Record<string, any>} body @param {(value: unknown) => string} resolve */
export function prepareOAuth1(auth, body, resolve) {
  const includeBodyHash =
    auth.includeBodyHash === true || auth.includeBodyHash === "true";
  const config = Object.fromEntries(
    fields.map((key) => [key, resolve(auth[key])]),
  );
  config.bodyMode ||= "legacy";
  if (!config.signatureMethod)
    throw new Error("Choose an OAuth1 signature method in Auth.");
  if (!["standard", "legacy"].includes(config.bodyMode))
    throw new Error("Choose an OAuth1 body signing mode in Auth.");
  if (auth.addParamsToHeader === false || auth.addParamsToHeader === "false")
    throw new Error(
      "OAuth1 parameters in the URL/body are not migrated. Select Authorization header explicitly in Auth.",
    );
  for (const key of ["addEmptyParamsToSign", "disableHeaderEncoding"])
    if (auth[key] === true || auth[key] === "true")
      throw new Error(
        `Imported OAuth1 option ${key} is not migrated. Disable it explicitly in Auth before sending.`,
      );
  for (const key of [
    "includeBodyHash",
    "addParamsToHeader",
    "addEmptyParamsToSign",
    "disableHeaderEncoding",
  ])
    if (
      auth[key] != null &&
      ![true, false, "true", "false"].includes(auth[key])
    )
      throw new Error(
        `OAuth1 ${key} must be an explicit boolean option in Auth.`,
      );
  /** @type {Record<string, string> | null} */
  let data = null;
  if (
    config.bodyMode === "legacy" &&
    includeBodyHash &&
    body.mimeType === "application/x-www-form-urlencoded"
  ) {
    const legacyData = /** @type {Record<string, string>} */ (
      Object.create(null)
    );
    for (const key of ["callback", "nonce", "timestamp", "verifier"])
      if (config[key]) legacyData[`oauth_${key}`] = config[key];
    // Preserve the original adapter's JSON order/last-value and disabled-field semantics
    // for the legacy hash, without prototype setters. This is separate from wire body bytes.
    for (const item of body.params || []) {
      const name = resolve(item.name);
      if (name === "__proto__")
        throw new Error(
          "This form uses a legacy OAuth1 object-property edge case. Review it and choose RFC 5849 explicitly in Auth.",
        );
      legacyData[name] = resolve(item.value);
    }
    data = legacyData;
  }
  return {
    ...config,
    includeBodyHash,
    legacyBodyJson: data ? JSON.stringify(data) : null,
  };
}
