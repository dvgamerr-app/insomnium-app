import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { environmentFor, render, workspaceFor, id } from "./model.js";

export const tokenGrants = [
  "authorization_code",
  "implicit",
  "client_credentials",
  "password",
  "refresh_token",
];
const textFields = [
  "grantType",
  "accessTokenUrl",
  "authorizationUrl",
  "clientId",
  "clientSecret",
  "scope",
  "audience",
  "resource",
  "username",
  "password",
  "redirectUrl",
  "state",
  "pkceMethod",
  "responseType",
  "origin",
  "accessToken",
  "refreshToken",
  "tokenPrefix",
  "addTokenTo",
  "tokenType",
  "callbackMode",
  "issuer",
  "browserMode",
];

/** @param {Record<string, any>} data @param {Record<string, any>} request @param {{resolved?:boolean}} [options] */
export function resolveOAuth(data, request, options = {}) {
  const environment = environmentFor(
    data.resources,
    request,
    data.activeEnvironmentId,
  );
  const resolve = (/** @type {unknown} */ value) =>
    options.resolved ? String(value ?? "") : render(value, environment);
  const auth = request.authentication || {};
  /** @type {Record<string, any>} */
  const config = Object.fromEntries(
    textFields.map((key) => [key, resolve(auth[key])]),
  );
  if (config.addTokenTo && config.addTokenTo !== "header")
    throw new Error(
      "OAuth query-token authentication has not been migrated. Select Header explicitly in Auth to change it.",
    );
  if (config.tokenType && config.tokenType.toLowerCase() !== "bearer")
    throw new Error(
      "Only Bearer OAuth tokens are supported. Review the imported token type in Auth.",
    );
  if (auth.tokenPrefix == null && auth.headerPrefix != null)
    config.tokenPrefix = resolve(auth.headerPrefix);
  if (auth.headerPrefix === "" && !config.tokenPrefix)
    throw new Error(
      "This Postman token has an empty header prefix. Set a token prefix explicitly in Auth.",
    );
  config.credentialsInBody = auth.credentialsInBody === true;
  config.usePkce = auth.usePkce !== false;
  if (auth.useIdentityToken === true) config.useIdentityToken = true;
  // Preserve existing non-interactive token fingerprints when optional new fields are absent.
  if (!config.callbackMode) delete config.callbackMode;
  if (!config.issuer) delete config.issuer;
  if (!config.browserMode || config.browserMode === "system")
    delete config.browserMode;
  return config;
}

/** A digest binds a saved token to resolved credentials/environment and recipient origin.
 * Never persist the unhashed input (it contains secrets).
 * @param {Record<string, any>} data @param {Record<string, any>} request @param {{resolved?:boolean}} [options] */
export function oauthContext(data, request, options = {}) {
  const config = resolveOAuth(data, request, options);
  const environment = environmentFor(
    data.resources,
    request,
    data.activeEnvironmentId,
  );
  const url = new URL(
    options.resolved
      ? String(request.url ?? "")
      : render(request.url, environment),
  );
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol))
    throw new Error("Enter the request URL before configuring OAuth.");
  const settings = data.settings;
  const value = JSON.stringify([
    1,
    request._id,
    workspaceFor(data.resources, request._id),
    data.activeEnvironmentId,
    url.origin,
    request.authentication?.type,
    config,
    request.authentication?.disabled === true,
    settings.proxy,
    settings.validateCertificates,
    settings.caPem,
    settings.identityHost,
    settings.identityPem,
    settings.useCookies,
    request.settingSendCookies,
    request.settingStoreCookies,
  ]);
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

/** @param {Record<string, any>} data @param {string} requestId @returns {Record<string, any>[]} */
export function savedOAuthTokens(data, requestId) {
  return data.resources
    .filter(
      (/** @type {any} */ r) =>
        r._type === "oauth2_token" && r.parentId === requestId,
    )
    .sort(
      (/** @type {any} */ a, /** @type {any} */ b) =>
        (b.obtainedAt || b.modified || 0) - (a.obtainedAt || a.modified || 0),
    );
}

/** @param {Record<string, any>} token @param {number} [now] */
export function tokenExpired(token, now = Date.now()) {
  return (
    token.expiresAt != null &&
    (!Number.isFinite(token.expiresAt) || token.expiresAt <= now)
  );
}

/** @param {Record<string, any>} token */
export function validateOAuthToken(token) {
  if (
    token.credentialKind &&
    !["access_token", "id_token"].includes(token.credentialKind)
  )
    throw new Error("Unknown saved OAuth credential kind.");
  for (const key of ["refreshToken", "identityToken"])
    if (token[key] != null && typeof token[key] !== "string")
      throw new Error(`The saved OAuth ${key} must be text.`);
  if (
    typeof token.accessToken !== "string" ||
    !/^[\x21-\x7e]+$/.test(token.accessToken)
  )
    throw new Error(
      "The saved OAuth access token is empty or has invalid header characters.",
    );
  if (token.tokenType && String(token.tokenType).toLowerCase() !== "bearer")
    throw new Error("Only Bearer OAuth tokens are supported.");
  if (
    token.expiresAt != null &&
    (!Number.isFinite(token.expiresAt) ||
      token.expiresAt < 0 ||
      token.expiresAt > 8.64e15)
  )
    throw new Error("The saved OAuth token has an invalid expiry.");
  if (token.xError || token.error)
    throw new Error(
      "The saved OAuth token contains an error. Fetch a new token.",
    );
}

/** @param {Record<string, any>} data @param {Record<string, any>} request @param {{resolved?:boolean}} [options] */
export function currentOAuthToken(data, request, options = {}) {
  const context = oauthContext(data, request, options);
  return (
    savedOAuthTokens(data, request._id).find(
      (/** @type {any} */ token) =>
        !token._oauthImported && token._oauthContext === context,
    ) || null
  );
}

/** @param {Record<string, any>} data @param {Record<string, any>} request @param {{resolved?:boolean}} [options] */
export function oauthHeader(data, request, options = {}) {
  const config = resolveOAuth(data, request, options);
  const token = config.accessToken
    ? { accessToken: config.accessToken }
    : currentOAuthToken(data, request, options);
  if (!token)
    throw new Error(
      "Fetch an OAuth token in Auth, or review and use a saved token first.",
    );
  validateOAuthToken(token);
  if (token.credentialKind === "id_token" && !config.useIdentityToken)
    throw new Error(
      "Select Use ID token as API credential in Auth before sending this saved ID token.",
    );
  if (tokenExpired(token))
    throw new Error("OAuth token has expired. Refresh it in Auth.");
  const prefix = config.tokenPrefix || "Bearer";
  if (prefix === "NO_PREFIX") return token.accessToken;
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(prefix))
    throw new Error(
      "OAuth token prefix must be a valid authentication scheme.",
    );
  return `${prefix} ${token.accessToken}`;
}

/** Pure token record construction; a missing rotated refresh token retains the previous one.
 * @param {Record<string, any>} request @param {string} context @param {Record<string, any>} response @param {Record<string, any> | null} [previous] */
export function oauthTokenRecord(request, context, response, previous = null) {
  validateOAuthToken(response);
  const now = Date.now();
  return {
    _id: previous?._oauthVersion === 1 ? previous._id : id("oa2"),
    _type: "oauth2_token",
    parentId: request._id,
    _oauthVersion: 1,
    _oauthContext: context,
    created: previous?._oauthVersion === 1 ? previous.created : now,
    modified: now,
    accessToken: response.accessToken,
    credentialKind: response.credentialKind || "access_token",
    refreshToken: response.refreshToken ?? previous?.refreshToken ?? "",
    identityToken: response.identityToken ?? "",
    tokenType: response.tokenType || "Bearer",
    scope: response.scope ?? previous?.scope ?? "",
    expiresAt: response.expiresAt ?? null,
    obtainedAt: response.obtainedAt || now,
  };
}

/** Conservative source guard for an asynchronous rendered OAuth exchange.
 * Hash raw inputs without executing prompts/tags a second time. Token updates do not invalidate it.
 * @param {Record<string,any>} data @param {Record<string,any>} request */
export function oauthSourceContext(data, request) {
  const value = JSON.stringify([
    request,
    data.activeEnvironmentId,
    data.settings,
    data.resources.filter(
      (/** @type {Record<string,any>} */ resource) =>
        resource._type !== "oauth2_token",
    ),
  ]);
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}
