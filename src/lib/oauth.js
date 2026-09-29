import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import {
  hasManualAuthorization,
  prepareRequest,
  prepareRenderedRequest,
} from "./transport.js";
import {
  resolveOAuth,
  currentOAuthToken,
  tokenExpired,
  tokenGrants,
  validateOAuthToken,
} from "./oauth-model.js";

/** Return null for an already usable/manual token.
 * @param {Record<string, any>} data @param {Record<string, any>} request @param {string} runId @param {"auto" | "fetch" | "refresh"} [action] @param {{resolved?:boolean}} [options] */
export function prepareOAuthExchange(
  data,
  request,
  runId,
  action = "auto",
  options = {},
) {
  if (
    request.authentication?.type !== "oauth2" ||
    request.authentication.disabled
  )
    return null;
  // Sending a manually authorized request must not open a login window or
  // fetch/refresh an unused token. Explicit Fetch/Refresh remains available.
  const manualAuthorization =
    action === "auto" &&
    (options.resolved
      ? (request.headers || []).some(
          (/** @type {Record<string,any>} */ header) =>
            !header.disabled &&
            String(header.name).toLowerCase() === "authorization",
        )
      : hasManualAuthorization(data, request));
  if (action === "auto" && manualAuthorization) return null;
  const config = resolveOAuth(data, request, options);
  if (config.accessToken) {
    if (action !== "auto")
      throw new Error(
        "Clear the manual access token override before fetching or refreshing.",
      );
    return null;
  }
  const previous = currentOAuthToken(data, request, options);
  if (previous && action === "auto") {
    validateOAuthToken(previous);
    const lifetime = Math.max(
      0,
      (previous.expiresAt || 0) - (previous.obtainedAt || 0),
    );
    const early = Math.min(30_000, lifetime * 0.1);
    if (!tokenExpired(previous, Date.now() + early)) return null;
  }
  const refreshToken = previous?.refreshToken || config.refreshToken || "";
  const refreshing =
    action === "refresh" ||
    config.grantType === "refresh_token" ||
    (action === "auto" && !!refreshToken);
  if (refreshing && !refreshToken)
    throw new Error("No refresh token is available. Fetch a new token.");
  if (!refreshing && !tokenGrants.includes(config.grantType))
    throw new Error(
      "This OAuth grant is not migrated yet. Existing tokens can be reviewed in Auth.",
    );
  if (!config.clientId) throw new Error("Enter the OAuth client ID.");
  const implicit = !refreshing && config.grantType === "implicit";
  // Implicit has no token HTTP exchange. The browser command uses this envelope
  // only for cancellation/settings; refresh still requires the token endpoint.
  const url = new URL(
    implicit ? config.authorizationUrl : config.accessTokenUrl,
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "Use an HTTP(S) OAuth endpoint URL without user information or a fragment.",
    );
  const prepared = (options.resolved ? prepareRenderedRequest : prepareRequest)(
    data,
    {
      ...request,
      _type: "request",
      responseMode: "http",
      method: "POST",
      url: url.toString(),
      authentication: {},
      parameters: [],
      pathParameters: [],
      headers: [],
      body: {},
      settingFollowRedirects: "off",
    },
    runId,
  );
  return {
    request: prepared,
    config: {
      ...config,
      grantType: refreshing ? "refresh_token" : config.grantType,
      refreshToken: refreshing ? refreshToken : "",
      ...(config.browserMode === "embedded" && !refreshing
        ? { browserSession: data.settings.oauthBrowserSession || "" }
        : {}),
    },
    previous: refreshing ? previous : null,
  };
}

/** @param {NonNullable<ReturnType<typeof prepareOAuthExchange>>} exchange @param {AbortSignal} signal @param {(event: Record<string, any>) => void} [onprogress] */
export async function fetchOAuthToken(exchange, signal, onprogress = () => {}) {
  if (!isTauri())
    throw new Error("OAuth token requests require the desktop app.");
  if (signal.aborted) throw new Error("OAuth token request cancelled.");
  const interactive = ["authorization_code", "implicit"].includes(
    exchange.config.grantType,
  );
  /** @type {Channel<Record<string, any>> | undefined} */
  let channel;
  if (interactive) {
    channel = new Channel();
    channel.onmessage = (event) => {
      if (signal.aborted) {
        void invoke("cancel_http", { id: exchange.request.id }).catch(() => {});
        return;
      }
      onprogress(event);
    };
  }
  const result = await invoke(
    interactive ? "authorize_oauth" : "fetch_oauth_token",
    {
      request: exchange.request,
      config: exchange.config,
      ...(interactive ? { onEvent: channel } : {}),
    },
  );
  if (signal.aborted) throw new Error("OAuth token request cancelled.");
  return /** @type {Record<string, any> | null} */ (result);
}

/** @param {string} id @param {string} url */
export function submitOAuthCallback(id, url) {
  return invoke("submit_oauth_callback", { id, url });
}
