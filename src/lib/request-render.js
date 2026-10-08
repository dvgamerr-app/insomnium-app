import { separateRequestUploads } from "./request-uploads.js";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { createRequestRenderSession } from "./template-session.js";
import { requestEnvironmentLayers } from "./template-environment.js";
import { workspaceFor } from "./model.js";
import { setDefaultProtocol } from "./template-url.js";
import { checkTemplateValue } from "./template-object.js";

/** @param {Record<string,any>} data @param {Record<string,any>} request */
async function requestCookieSnapshot(data, request) {
  return isTauri() &&
    data.settings?.useCookies &&
    (request.settingSendCookies !== false ||
      request.settingStoreCookies !== false)
    ? await invoke("snapshot_request_cookies", {
        workspaceId: workspaceFor(data.resources, request._id),
      })
    : null;
}

/** Render a complete request/cookie snapshot with one already-owned session.
 * The caller registers cancellation before calling and disposes the session afterwards.
 * @param {ReturnType<import('./template-session.js').createRequestRenderSession>} session
 * @param {Record<string,any>} request
 * @param {{cookieJar?:Record<string,any>|null,skipBody?:boolean}} [options]
 */
export async function renderRequestSnapshot(session, request, options = {}) {
  session.signal.throwIfAborted();
  const uploads = separateRequestUploads(request);
  checkTemplateValue(options.cookieJar);
  const input = uploads.input;
  const cookieJar = structuredClone(options.cookieJar ?? null);
  // Preserve the original GraphQL comment workaround before any body rendering.
  if (input.body?.mimeType === "application/graphql" && input.body.text) {
    try {
      const body = JSON.parse(input.body.text);
      if (typeof body?.query === "string") {
        body.query = body.query.replace(/#}/g, "# }");
        input.body.text = JSON.stringify(body);
      }
    } catch {
      // Transport reports invalid GraphQL JSON; rendering must not rewrite it.
    }
  }
  const description = input.description;
  input.description = "";
  const result = await session.renderValue(
    { _request: input, _cookieJar: cookieJar },
    {
      blacklist:
        options.skipBody || input.settingDisableRenderRequestBody
          ? /^body.*/
          : null,
    },
  );
  const rendered = result._request;
  uploads.restore(rendered);
  rendered.description = await session.renderValue(description, {
    path: "description",
    keepOnError: true,
  });
  // Disabled User-Agent suppresses the implicit agent, even though the row is removed.
  rendered.suppressUserAgent = (input.headers || []).some(
    (/** @type {Record<string,any>} */ header) =>
      String(header.name).toLowerCase() === "user-agent" &&
      header.disabled === true,
  );
  for (const key of ["headers", "parameters", "cookieParameters"]) {
    if (rendered[key] == null) rendered[key] = [];
    else if (Array.isArray(rendered[key]))
      rendered[key] = rendered[key].filter(
        (/** @type {Record<string,any>} */ row) => !row.disabled,
      );
    else throw new Error("Request " + key + " must be an array");
  }
  if (Array.isArray(rendered.body?.params))
    rendered.body.params = rendered.body.params.filter(
      (/** @type {Record<string,any>} */ row) => !row.disabled,
    );
  if (rendered.authentication?.disabled) rendered.authentication = {};
  // gRPC targets use their own scheme/default handling in grpc-model.js.
  if (rendered._type !== "grpc_request")
    rendered.url = setDefaultProtocol(
      String(rendered.url || ""),
      rendered._type === "websocket_request" ? "ws:" : "http:",
    );
  session.signal.throwIfAborted();
  return {
    request: rendered,
    cookieJar: result._cookieJar,
    context: await session.getContext(),
  };
}

/** Own the renderer only while preparing one Send snapshot; network cancellation remains caller-owned.
 * @param {Record<string,any>} data @param {Record<string,any>} request @param {AbortSignal} signal
 * @param {{skipBody?:boolean,responseResolver?:(args:any[],signal:AbortSignal)=>any|Promise<any>}} [options]
 */
export async function renderSendRequest(data, request, signal, options = {}) {
  signal.throwIfAborted();
  const cookieJar = await requestCookieSnapshot(data, request);
  signal.throwIfAborted();
  const session = createRequestRenderSession(
    {},
    {
      purpose: "send",
      responseResolver: options.responseResolver,
      requestId: request._id,
      workspaceId: workspaceFor(data.resources, request._id),
      resources: data.resources,
      history: data.history || [],
      environmentId: data.activeEnvironmentId || null,
      signal,
      environmentLayers:
        requestEnvironmentLayers(
          data.resources,
          request._id,
          data.activeEnvironmentId,
        ) || [],
    },
  );
  try {
    const result = await renderRequestSnapshot(session, request, {
      ...options,
      cookieJar,
    });
    // Generation is native ownership metadata, not a template field.
    result.request.cookieSnapshot = cookieJar
      ? { ...result.cookieJar, generation: cookieJar.generation }
      : null;
    return result;
  } finally {
    session.dispose();
  }
}

/** Resolve explicit OAuth actions without evaluating unrelated request bodies/headers.
 * @param {Record<string,any>} data @param {Record<string,any>} request @param {AbortSignal} signal
 * @param {{purpose?:"send"|"preview",includeCookies?:boolean,responseResolver?:(args:any[],signal:AbortSignal)=>any|Promise<any>}} [options]
 */
export async function renderOAuthRequest(data, request, signal, options = {}) {
  signal.throwIfAborted();
  const cookieJar =
    options.includeCookies && options.purpose !== "preview"
      ? await requestCookieSnapshot(data, request)
      : null;
  signal.throwIfAborted();
  const session = createRequestRenderSession(
    {},
    {
      purpose: options.purpose || "send",
      requestId: request._id,
      workspaceId: workspaceFor(data.resources, request._id),
      resources: data.resources,
      history: data.history || [],
      environmentId: data.activeEnvironmentId || null,
      signal,
      responseResolver: options.responseResolver,
      environmentLayers:
        requestEnvironmentLayers(
          data.resources,
          request._id,
          data.activeEnvironmentId,
        ) || [],
    },
  );
  try {
    const resolved = await session.renderValue({
      url: request.url,
      authentication: request.authentication,
      cookieSnapshot: cookieJar,
    });
    signal.throwIfAborted();
    return {
      ...request,
      ...resolved,
      cookieSnapshot: cookieJar
        ? { ...resolved.cookieSnapshot, generation: cookieJar.generation }
        : null,
      url: setDefaultProtocol(
        String(resolved.url || ""),
        request._type === "websocket_request" ? "ws:" : "http:",
      ),
    };
  } finally {
    session.dispose();
  }
}

/** Render one message with the connection owner's cancellation signal.
 * @param {Record<string,any>} data @param {Record<string,any>} request @param {string} value @param {AbortSignal} signal
 * @param {(args:any[],signal:AbortSignal)=>any|Promise<any>} responseResolver */
export async function renderMessageValue(
  data,
  request,
  value,
  signal,
  responseResolver,
) {
  const session = createRequestRenderSession(
    {},
    {
      purpose: "send",
      requestId: request._id,
      workspaceId: workspaceFor(data.resources, request._id),
      resources: data.resources,
      history: data.history || [],
      environmentId: data.activeEnvironmentId || null,
      signal,
      responseResolver,
      environmentLayers:
        requestEnvironmentLayers(
          data.resources,
          request._id,
          data.activeEnvironmentId,
        ) || [],
    },
  );
  try {
    return await session.render(value, "payload.value");
  } finally {
    session.dispose();
  }
}

/** Render gRPC connection fields; messages are rendered only when sent.
 * @param {Record<string,any>} data @param {Record<string,any>} request @param {AbortSignal} signal
 * @param {(args:any[],signal:AbortSignal)=>any|Promise<any>} responseResolver */
export async function renderGrpcRequest(
  data,
  request,
  signal,
  responseResolver,
) {
  const session = createRequestRenderSession(
    {},
    {
      purpose: "send",
      requestId: request._id,
      workspaceId: workspaceFor(data.resources, request._id),
      resources: data.resources,
      history: data.history || [],
      environmentId: data.activeEnvironmentId || null,
      signal,
      responseResolver,
      environmentLayers:
        requestEnvironmentLayers(
          data.resources,
          request._id,
          data.activeEnvironmentId,
        ) || [],
    },
  );
  try {
    return {
      ...request,
      ...(await session.renderValue({
        url: request.url,
        metadata: request.metadata || [],
      })),
    };
  } finally {
    session.dispose();
  }
}
