import { parseDocument, stringify } from "yaml";

/** Legacy NeDB model names are part of the on-disk Git format. */
export const gitResourceTypes = Object.freeze({
  workspace: "Workspace",
  environment: "Environment",
  request_group: "RequestGroup",
  request: "Request",
  api_spec: "ApiSpec",
  unit_test_suite: "UnitTestSuite",
  unit_test: "UnitTest",
  grpc_request: "GrpcRequest",
  proto_file: "ProtoFile",
  proto_directory: "ProtoDirectory",
  websocket_request: "WebSocketRequest",
  websocket_payload: "WebSocketPayload",
});
/** @type {Map<string, string>} */
const types = new Map(
  Object.entries(gitResourceTypes).map(([key, value]) => [value, key]),
);
export const gitLocalFields = Object.freeze([
  "_type",
  "_legacySource",
  "_postmanSource",
  "_harSource",
  "_curlSource",
  "_migrationIssues",
  "_openapiIssues",
  "_oauthImported",
]);
const localFields = new Set(gitLocalFields);
const maxBytes = 20 * 1024 * 1024;
const encoder = new TextEncoder();

/** @typedef {Record<string, any>} Resource */

/** @param {unknown} value */
function validId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value);
}

/** Require JSON-compatible data without silently losing unknown fields.
 * @param {unknown} value @param {number} [depth] @param {Set<object>} [seen]
 */
function checkValue(value, depth = 0, seen = new Set()) {
  if (depth > 100) throw new Error("Git resource nesting exceeds 100 levels.");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (!value || typeof value !== "object")
    throw new Error("Git resources must contain JSON-compatible values.");
  if (seen.has(value))
    throw new Error("Git resource contains a circular value.");
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw new Error("Git resource contains an unsupported object.");
  seen.add(value);
  for (const item of Object.values(value)) checkValue(item, depth + 1, seen);
  seen.delete(value);
}

/** Git paths use forward slashes, independent of the native platform.
 * Returns null for unrelated repository files; malformed managed paths fail explicitly.
 * @param {string} path
 */
export function parseGitResourcePath(path) {
  if (typeof path !== "string") throw new Error("Invalid Git resource path.");
  if (path !== ".insomnium" && !path.startsWith(".insomnium/")) return null;
  const match =
    /^\.insomnium\/([A-Za-z]+)\/([A-Za-z0-9_-]{1,200})\.(yml|json)$/.exec(path);
  if (!match || !types.has(match[1]))
    throw new Error("Unsupported or invalid resource path in .insomnium.");
  return {
    type: match[1],
    resourceType: /** @type {string} */ (types.get(match[1])),
    id: match[2],
  };
}

/** Encode one syncable resource; callers decide collection membership/staging.
 * Does not mutate the resource or restore stale _legacySource fields.
 * @param {Resource} resource
 * @returns {{path:string, content:string}}
 */
export function encodeGitResource(resource) {
  if (!resource || typeof resource !== "object" || Array.isArray(resource))
    throw new Error("Invalid Git resource.");
  const type =
    gitResourceTypes[
      /** @type {keyof typeof gitResourceTypes} */ (resource._type)
    ];
  if (!type || !Object.hasOwn(gitResourceTypes, resource._type))
    throw new Error(
      "This resource type is local-only or unsupported by Git sync.",
    );
  if (!validId(resource._id)) throw new Error("Invalid Git resource ID.");
  if (resource.isPrivate)
    throw new Error("Private resources cannot be written to Git.");
  if (resource.type != null && resource.type !== type)
    throw new Error("Git resource type conflicts with its legacy type.");
  /** @type {Resource} */
  const record = {};
  for (const [key, value] of Object.entries(resource)) {
    if (!localFields.has(key))
      Object.defineProperty(record, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
  }
  record.type = type;
  if (type === "Workspace") record.parentId = null;
  else if (!validId(record.parentId))
    throw new Error("Git resource must have a parent ID.");
  checkValue(record);
  // Native JSON persistence may reorder object keys. Keep Git bytes stable across reload.
  const content = stringify(record, { sortMapEntries: true });
  if (encoder.encode(content).byteLength > maxBytes)
    throw new Error("Git resource exceeds 20 MiB.");
  return { path: `.insomnium/${type}/${record._id}.yml`, content };
}

/** Decode an existing legacy Git file without changing IDs or applying it to app state.
 * Topology, collection ownership and transactional application are separate requirements.
 * @param {string} path @param {string} content
 * @param {{workspaceParentId?: string|null}} [options]
 * @returns {Resource|null}
 */
export function decodeGitResource(
  path,
  content,
  { workspaceParentId = null } = {},
) {
  const parsed = parseGitResourcePath(path);
  if (!parsed) return null;
  if (
    typeof content !== "string" ||
    encoder.encode(content).byteLength > maxBytes
  )
    throw new Error("Git resource must be text no larger than 20 MiB.");
  const document = parseDocument(content, {
    strict: true,
    uniqueKeys: true,
    stringKeys: true,
    prettyErrors: false,
  });
  if (document.errors.length || document.warnings.length)
    throw new Error("Invalid or unsupported Git resource YAML.");
  const record = document.toJS({ maxAliasCount: 100 });
  if (!record || typeof record !== "object" || Array.isArray(record))
    throw new Error("Git resource must be an object.");
  checkValue(record);
  if (record._id !== parsed.id || record.type !== parsed.type)
    throw new Error("Git resource ID/type does not match its path.");
  if (Object.hasOwn(record, "_type") && record._type !== parsed.resourceType)
    throw new Error("Git resource has conflicting type metadata.");
  // Imported provenance is local state, never accept remote copies as recovery data.
  for (const key of localFields) delete record[key];
  record._type = parsed.resourceType;
  if (parsed.type === "Workspace") {
    if (workspaceParentId !== null && !validId(workspaceParentId))
      throw new Error("Invalid local workspace parent ID.");
    record.parentId = workspaceParentId;
  } else if (!validId(record.parentId))
    throw new Error("Git resource must have a parent ID.");
  return record;
}
