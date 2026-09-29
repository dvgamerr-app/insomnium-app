import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { requestDataScope } from "./request-scope.js";
import {
  buildClientSchema,
  buildSchema,
  getIntrospectionQuery,
  getOperationAST,
  getVariableValues,
  parse,
  print,
  printSchema,
  validate,
  validateSchema,
} from "graphql";
import { prepareRequest, prepareRenderedRequest } from "./transport.js";
import { createRequestRenderSession } from "./template-session.js";
import { requestEnvironmentLayers } from "./template-environment.js";

export const schemaLimit = 20 * 1024 * 1024;

/** @param {string} text */
export function readGraphqlBody(text) {
  const value = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("GraphQL body must be a JSON object.");
  if (value.query != null && typeof value.query !== "string")
    throw new Error("GraphQL query must be text.");
  return value;
}

/** @param {string} query */
export function parseQuery(query) {
  return parse(query, { maxTokens: 10000 });
}

/** @param {string} query */
export function formatQuery(query) {
  return print(parseQuery(query));
}

/** Resolve only the GraphQL body using a noninteractive preview session.
 * No request dispatch, OAuth acquisition or prompt dialog is available here.
 * @param {ReturnType<import('./model.js').initialData>} data @param {Record<string, any>} request
 * @param {AbortSignal} signal */
export async function resolveQuery(data, request, signal) {
  signal.throwIfAborted();
  const scope = requestDataScope(data, request._id);
  const body = readGraphqlBody(request.body?.text || "{}");
  if (typeof body.query === "string")
    body.query = body.query.replace(/#}/g, "# }");
  const session = createRequestRenderSession(
    {},
    {
      purpose: "preview",
      requestId: request._id,
      workspaceId: scope.activeWorkspaceId,
      resources: scope.resources,
      history: scope.history || [],
      environmentId: scope.activeEnvironmentId || null,
      signal,
      environmentLayers:
        requestEnvironmentLayers(
          scope.resources,
          request._id,
          scope.activeEnvironmentId,
        ) || [],
    },
  );
  try {
    const text = JSON.stringify(body);
    const resolved = readGraphqlBody(
      request.settingDisableRenderRequestBody
        ? text
        : await session.render(text, "body.text"),
    );
    signal.throwIfAborted();
    return {
      body: JSON.stringify({
        query: resolved.query || "",
        operationName: resolved.operationName || "",
        variables:
          typeof resolved.variables === "string"
            ? JSON.parse(resolved.variables || "{}")
            : (resolved.variables ?? {}),
      }),
    };
  } finally {
    session.dispose();
  }
}

/** Build the schema request before rendering so the user's query is never evaluated.
 * @param {Record<string,any>} request */
export function introspectionRequest(request) {
  return {
    ...request,
    _type: "request",
    responseMode: "http",
    method: "POST",
    body: {
      mimeType: "application/graphql",
      text: JSON.stringify({
        query: getIntrospectionQuery(),
        operationName: "IntrospectionQuery",
      }),
    },
  };
}
/** Build a separate POST without changing the user's query, operation or variables.
 * @param {Record<string, any>} data @param {Record<string, any>} request @param {string} runId
 * @param {{resolved?:boolean,oauthAuthorization?:string}} [options] */
export function prepareIntrospection(data, request, runId, options = {}) {
  const prepared = options.resolved
    ? prepareRenderedRequest(
        data,
        introspectionRequest(request),
        runId,
        options,
      )
    : prepareRequest(data, introspectionRequest(request), runId);
  prepared.headers = prepared.headers.filter(
    ([name]) => !["accept", "content-length"].includes(name.toLowerCase()),
  );
  prepared.headers.push([
    "Accept",
    "application/graphql-response+json, application/json",
  ]);
  return prepared;
}
/** Source-only session cache identity: never rerun interactive templates to inspect cache.
 * Includes saved token changes, but excludes the user's operation body for this request.
 * @param {ReturnType<import('./model.js').initialData>} data @param {Record<string, any>} request */
export function schemaContext(data, request) {
  const scope = requestDataScope(data, request._id);
  const source = { ...introspectionRequest(request), modified: undefined };
  const value = JSON.stringify([
    scope.activeEnvironmentId,
    source,
    scope.settings,
    scope.resources.map((resource) =>
      resource._id === request._id ? source : resource,
    ),
  ]);
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

/** @param {string} text */
export function readSchema(text) {
  if (new TextEncoder().encode(text).byteLength > schemaLimit)
    throw new Error("Schema exceeds the 20 MiB limit.");
  const trimmed = text.trim();
  let schema;
  if (trimmed.startsWith("{")) {
    const response = JSON.parse(trimmed);
    if (response.errors?.length)
      throw new Error(
        response.errors
          .map((/** @type {any} */ error) => error.message || String(error))
          .join("\n"),
      );
    schema = buildClientSchema(response.data ?? response);
  } else {
    schema = buildSchema(trimmed, { maxTokens: 200000 });
  }
  const errors = validateSchema(schema);
  if (errors.length)
    throw new Error(errors.map((error) => error.message).join("\n"));
  return { schema, sdl: printSchema(schema) };
}

/** Validate the resolved request without sending it. Custom scalar server rules are unavailable.
 * @param {Record<string, any>} prepared @param {import('graphql').GraphQLSchema | null} schema */
export function validateQuery(prepared, schema) {
  const body = readGraphqlBody(prepared.body);
  const document = parseQuery(body.query || "");
  const operation = getOperationAST(document, body.operationName || undefined);
  if (!operation)
    throw new Error(
      "Select an existing operation name when a document contains multiple operations.",
    );
  if (
    body.variables == null ||
    typeof body.variables !== "object" ||
    Array.isArray(body.variables)
  )
    throw new Error("GraphQL variables must be a JSON object.");
  if (schema) {
    const errors = validate(schema, document, undefined, { maxErrors: 20 });
    if (errors.length)
      throw new Error(errors.map((error) => error.toString()).join("\n"));
    const values = getVariableValues(
      schema,
      operation.variableDefinitions || [],
      body.variables,
      { maxErrors: 20 },
    );
    if (values.errors?.length)
      throw new Error(
        values.errors.map((error) => error.toString()).join("\n"),
      );
  }
  return schema
    ? "Query and variables match the loaded schema. Server custom scalar rules are not checked."
    : "Query syntax and operation selection are valid. Load a schema to check fields and variable types.";
}
