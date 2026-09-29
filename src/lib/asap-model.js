/** @param {Record<string, any>} auth @param {(value: unknown) => string} resolve */
export function prepareAsap(auth, resolve) {
  const config = Object.fromEntries(
    [
      "issuer",
      "subject",
      "keyId",
      "privateKey",
      "claimsMode",
      "algorithm",
      "expirySeconds",
    ].map((key) => [key, resolve(auth[key])]),
  );
  config.claimsMode ||= "legacy";
  config.algorithm ||= "RS256";
  let audience = Array.isArray(auth.audience)
    ? auth.audience.map(resolve)
    : resolve(auth.audience);
  if (typeof audience === "string" && audience.trim().startsWith("[")) {
    try {
      audience = JSON.parse(audience);
    } catch {
      throw new Error("ASAP audience array must be valid JSON.");
    }
    if (!Array.isArray(audience) || audience.some((v) => typeof v !== "string"))
      throw new Error("ASAP audience must be a string or an array of strings.");
  }
  return {
    ...config,
    audience,
    additionalClaims: resolve(
      typeof auth.additionalClaims === "string"
        ? auth.additionalClaims
        : JSON.stringify(auth.additionalClaims ?? {}),
    ),
  };
}
