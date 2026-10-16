import { curlResources, isCurlImport } from "./curl-import.js";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, writeFile, stat } from "@tauri-apps/plugin-fs";
import { id, initialData, newRequest, protocolFor } from "./model.js";
import { parseLegacyFiles } from "./legacy-import.js";
import { legacyV1Resources } from "./legacy-v1-import.js";
import { hoppscotchResources } from "./hoppscotch-import.js";
import { wsdlResources } from './wsdl-import.js';
import {selectWsdlRoot} from './wsdl-documents.js';
import {harResources} from "./har-import.js";
import { legacyResponseAssetRequests, convertLegacyResponseHistory } from "./legacy-response-history.js";
import { legacyWebSocketAssetRequests, convertLegacyWebSocketHistory } from "./legacy-websocket-history.js";
import { legacySseAssetRequests, convertLegacySseHistory } from "./legacy-sse-history.js";
import { legacyRequestAssetRequests, convertLegacyRequestFiles } from "./legacy-request-files.js";
import { legacyCertificateAssetRequests, convertLegacyCertificateFiles } from "./legacy-certificate-files.js";
import { referenceKeys, validateTopology } from "./resources.js";
import { parseSpec } from "./openapi-document.js";
import {
  postmanUrl,
  postmanBody,
  postmanVariables,
  postmanHeaders,
  postmanDescription,
} from "./postman-import.js";

const localGitFields = [
  "nativeRepositoryId",
  "nativeBindingVersion",
  "nativeCreateIntent",
  "nativeFetchIntent",
  "nativePushIntent",
  "nativeRemoteCheckoutIntent",
  "nativeCloneOperationId",
  "nativeRemoteBranches",
];

/** Native repository IDs and operation receipts identify app-data on this machine, not portable resources.
 * Keep repository settings, but never reactivate a local binding through import.
 * @param {Record<string, any>} resource @param {boolean} [forExport] */
function portableResource(resource, forExport = false) {
  if (resource._type === "cookie_jar") {
    const copy = { ...resource };
    delete copy._nativeCookieJarView;
    delete copy._activeTemplateCookieSource;
    return copy;
  }
  if (resource._type !== "git_repository") return resource;
  const copy = { ...resource };
  for (const key of localGitFields) delete copy[key];
  if (forExport) {
    delete copy.credentials;
    const record = resource._legacySource?.record;
    if (record && typeof record === "object" && !Array.isArray(record)) {
      // NeDB imports archive an original copy of the same Git resource. Apply
      // the export policy there too, without mutating the live provenance.
      const portableRecord = {...record};
      for (const key of localGitFields) delete portableRecord[key];
      delete portableRecord.credentials;
      copy._legacySource = {...resource._legacySource,record:portableRecord};
    }
  }
  return copy;
}

/** HTTP, SSE and WebSocket assets share one activation budget, including portable imports.
 * @param {Record<string,any>[]} resources @param {{entries?:(import('./legacy-response-history.js').LegacyResponseAsset & Record<string,any>)[]}} [assets] */
function importedResponseHistory(resources, assets = {}) {
  const index = new Map(resources.map((resource) => [resource._id, resource]));
  const time = (/** @type {Record<string,any>} */ response) =>
    Number.isFinite(response.modified) && response.modified >= 0
      ? response.modified
      : response.created || 0;
  const candidates = resources
    .filter((resource) =>
      ["response", "websocket_response"].includes(resource._type),
    )
    .sort((a, b) => time(b) - time(a) || (b.created || 0) - (a.created || 0));
  /** @type {Record<string,any>[]} */ const history = [];
  /** @type {{id:string,code:string,message:string,asset?:string}[]} */ const warnings =
    [];
  let used = 0;
  for (const response of candidates) {
    if (history.length === 100) {
      warnings.push({
        id: response._id,
        code: "history-candidate-limit",
        message:
          "Only the newest 100 combined HTTP/SSE/WebSocket histories can be activated per preview; original records and portable assets are retained.",
      });
      continue;
    }
    const request = index.get(response.parentId);
    const context = request ? [request, response] : [response];
    const isSse = response._type === "response" && request && protocolFor(request) === "sse";
    const selectedAssets = {
      entries: assets.entries?.filter((asset) => asset.id === response._id),
    };
    const converted =
      response._type === "websocket_response"
        ? convertLegacyWebSocketHistory(
            context,
            selectedAssets,
            32 * 1024 * 1024 - used,
          )
        : isSse
          ? convertLegacySseHistory(context, selectedAssets, 32 * 1024 * 1024 - used)
          : convertLegacyResponseHistory(context, selectedAssets);
    warnings.push(...converted.warnings);
    const entry = converted.history[0];
    if (!entry) continue;
    const source =
      selectedAssets.entries?.find((asset) =>
        response._type === "websocket_response"
          ? typeof asset.eventLogBase64 === "string"
          : typeof asset.bodyBase64 === "string",
      ) ||
      (response._type === "websocket_response"
        ? response._legacyWebSocketAssets
        : response._legacyResponseAssets);
    const timelineBytes = entry.legacyTimelineByteSize ?? 0;
    const bytes =
      (response._type === "websocket_response"
        ? source?.eventLogSize
        : (entry.legacyRawByteSize ?? entry.size)) + timelineBytes;
    if (!Number.isFinite(bytes) || used + bytes > 32 * 1024 * 1024) {
      warnings.push({
        id: response._id,
        code: "aggregate-asset-limit",
        message:
          "Legacy response activation exceeds the shared 32 MiB decoded response/log/timeline budget; original records and portable assets are retained.",
      });
      continue;
    }
    history.push(entry);
    used += bytes;
  }
  return { history, warnings };
}

/** @param {string} text @param {{name?:string,documents?:import('./wsdl-documents.js').WsdlDocument[]}} [options] */
export function parseImport(text,options = {}) {
  if (new TextEncoder().encode(text).byteLength > 64 * 1024 * 1024)
    throw new Error("Collection import exceeds 64 MiB. The source was not changed.");
  let source;
  if (isCurlImport(text)) source = { resources: curlResources(text) };
  else if (text.trimStart().startsWith('<')) source = {resources:wsdlResources(text,options)};
  else {
    try {
      source = JSON.parse(text);
    } catch {
      source = parseSpec(text).value;
    }
  }
  if (!source || typeof source !== "object")
    throw new Error("Expected a collection object");
  /** @type {Record<string, any>[]} */
  let resources = [];
  if (source.__export_format === 1) resources = legacyV1Resources(source);
  else if (source.v === 2 && "requests" in source && "folders" in source) resources = hoppscotchResources(source);
  else if (source.openapi || source.swagger) {
    const workspaceId = id("wrk");
    resources = [
      {
        _id: workspaceId,
        _type: "workspace",
        parentId: null,
        name: source.info?.title || "Imported API",
        scope: "design",
      },
      {
        _id: id("spc"),
        _type: "api_spec",
        parentId: workspaceId,
        fileName: text.trim().startsWith("{") ? "openapi.json" : "openapi.yaml",
        contentType: text.trim().startsWith("{") ? "json" : "yaml",
        contents: text,
      },
    ];
  } else if (Array.isArray(source.resources)) resources = source.resources;
  else if (source._postman_variable_scope === "environment") {
    if (!Array.isArray(source.values) || source.values.some(
      (/** @type {any} */ value) => !value || typeof value !== "object" ||
        Array.isArray(value) || typeof value.key !== "string",
    )) throw new Error("Postman environment values must be an array of named variables.");
    const workspaceId = id("wrk");
    const name = typeof source.name === "string" && source.name.trim()
      ? source.name : "Postman Environment";
    resources = [
      {_id:workspaceId, _type:"workspace", parentId:null, name, scope:"collection"},
      {_id:id("env"), _type:"environment", parentId:workspaceId, name,
        data:Object.fromEntries(source.values.filter((/** @type {any} */ value) => value.enabled)
          .map((/** @type {any} */ value) => [value.key, value.value ?? ""])),
        _postmanSource:source},
    ];
  }
  else if (source.info && Array.isArray(source.item)) {
    const workspaceId = id("wrk");
    resources.push({
      _id: workspaceId,
      _type: "workspace",
      parentId: null,
      name: source.info.name || "Postman Collection",
      description: postmanDescription(source.info.description),
      scope: "collection",
      _postmanSource: source,
    });
    resources.push({
      _id: id("env"),
      _type: "environment",
      parentId: workspaceId,
      name: "Base Environment",
      data: postmanVariables(source.variable),
    });
    const visit = (
      /** @type {any[]} */ items,
      /** @type {string} */ parentId,
      /** @type {any} */ inheritedAuth = source.auth,
      /** @type {boolean} */ inheritedScripts = !!source.event?.length,
    ) => {
      const frames = [{items, index:0, parentId, inheritedAuth, inheritedScripts}];
      while (frames.length) {
        const frame = frames.at(-1);
        if (!frame) break;
        if (frame.index >= frame.items.length) { frames.pop(); continue; }
        const {parentId, inheritedAuth, inheritedScripts} = frame;
        const item = frame.items[frame.index++];
        if (!item || typeof item !== 'object' || Array.isArray(item))
          throw new Error('Postman items must be objects.');
        if (Object.hasOwn(item, 'item') && !Array.isArray(item.item))
          throw new Error('Postman folder items must be an array.');
        if (Array.isArray(item.item)) {
          const folderId = id("fld");
          // Descendants have their own resources; archive only this folder's
          // metadata so nested imports do not duplicate every child subtree.
          const { item: _children, ...folderSource } = item;
          resources.push({
            _id: folderId,
            _type: "request_group",
            parentId,
            name: item.name,
            description: postmanDescription(item.description),
            environment: postmanVariables(item.variable),
            _postmanSource: structuredClone(folderSource),
          });
          frames.push({items:item.item, index:0, parentId:folderId,
            inheritedAuth:item.auth || inheritedAuth,
            inheritedScripts:inheritedScripts || !!item.event?.length});
        } else if (Object.hasOwn(item, 'request')) {
          if (typeof item.request !== 'string' &&
              (!item.request || typeof item.request !== 'object' || Array.isArray(item.request)))
            throw new Error('Postman requests must be URL strings or request objects.');
          const req =
            typeof item.request === "string"
              ? { url: item.request }
              : item.request;
          /** @type {Record<string, any>} */
          let authentication = {};
          const selectedAuth = req.auth || inheritedAuth;
          if (selectedAuth?.type && selectedAuth.type !== "noauth")
            authentication = {
              type: selectedAuth.type,
              ...Object.fromEntries(
                (selectedAuth[selectedAuth.type] || []).map(
                  (/** @type {any} */ a) => [a.key, a.value],
                ),
              ),
            };
          if (authentication.type === "apikey")
            authentication.addTo =
              authentication.in === "query" ? "queryParams" : "header";
          if (authentication.type === "awsv4") {
            authentication.type = "iam";
            authentication.accessKeyId = authentication.accessKey ?? "";
            authentication.secretAccessKey = authentication.secretKey ?? "";
            authentication.service ||= "execute-api";
            authentication.region ||= "us-east-1";
          }
          if (authentication.type === "hawk") {
            authentication.id = authentication.authId ?? "";
            authentication.key = authentication.authKey ?? "";
            authentication.ext = authentication.extraData ?? "";
            authentication.dlg = authentication.delegation ?? "";
            authentication.validatePayload =
              authentication.includePayloadHash ?? false;
            authentication.bodyMode = "postman";
          }
          if (authentication.type === "asap") {
            authentication.issuer = authentication.iss ?? "";
            authentication.subject = authentication.sub ?? "";
            authentication.audience = authentication.aud ?? "";
            authentication.keyId = authentication.kid ?? "";
            authentication.algorithm = authentication.alg || "RS256";
            authentication.additionalClaims = authentication.claims ?? {};
            authentication.expirySeconds = String(authentication.exp || "3600");
            authentication.claimsMode = "postman";
          }
          if (authentication.type === "oauth1") {
            authentication.tokenKey = authentication.token ?? "";
            authentication.bodyMode = "standard";
            // Postman uses URL/form placement when this option is absent/false.
            authentication.addParamsToHeader ??= false;
            for (const key of [
              "includeBodyHash",
              "addParamsToHeader",
              "addEmptyParamsToSign",
              "disableHeaderEncoding",
            ])
              if (["true", "false"].includes(authentication[key]))
                authentication[key] = authentication[key] === "true";
            // Postman never applies its body-hash extension to form parameters.
            if (req.body?.mode === "urlencoded")
              authentication.includeBodyHash = false;
          }
          resources.push(
            newRequest(parentId, {
              name: item.name,
              method: req.method || "GET",
              ...postmanUrl(req.url),
              authentication,
              headers: postmanHeaders(req.header),
              description: postmanDescription(req.description),
              body: postmanBody(req.body),
              _postmanSource: item,
              _migrationIssues:
                inheritedScripts || item.event?.length
                  ? [
                      "This request inherits Postman scripts. Script execution is not migrated yet.",
                    ]
                  : [],
            }),
          );
        } else throw new Error('Postman items require a request or folder items array.');
      }
    };
    visit(source.item, workspaceId);
  } else if (source.log?.entries || (source.httpVersion && source.method && source.url))
    resources = harResources(source);
  else
    throw new Error(
      "Unsupported file. Use Insomnia JSON, Insomnium JSON, Postman collection v2 or environment JSON, Hoppscotch v2, HAR, OpenAPI JSON/YAML, or cURL commands.",
    );
  if (!resources.length) throw new Error("The import contains no resources");
  if (source.__export_format === 2) resources = resources.map((resource) => {
    if (resource?._type !== "request") return resource;
    if (resource.body != null && typeof resource.body !== "string")
      throw new Error("Legacy export format 2 request bodies must be strings.");
    const contentType = Array.isArray(resource.headers)
      ? resource.headers.find((/** @type {any} */ header) => typeof header?.name === "string" && header.name.toLowerCase() === "content-type")?.value
      : "";
    const mimeType = typeof contentType === "string" ? contentType.split(";")[0] : "";
    return {...resource,
      _legacyExportFormat:2,
      body:{
        // Preserve already encoded form bytes through the raw-text sender.
        // The original Content-Type header remains authoritative.
        mimeType:["application/x-www-form-urlencoded", "application/octet-stream", "multipart/form-data", "application/graphql"].includes(mimeType.toLowerCase()) ? "text/plain" : mimeType || (resource.body ? "text/plain" : ""),
        text:resource.body ?? "",
      },
    };
  });
  const ids = new Set();
  for (const r of resources) {
    if (
      !r ||
      typeof r._id !== "string" ||
      typeof r._type !== "string" ||
      ids.has(r._id)
    )
      throw new Error("The import contains invalid or duplicate resource IDs");
    ids.add(r._id);
  }
  const detachedGitBindings = resources.filter(
    (r) =>
      r._type === "git_repository" &&
      localGitFields.some((key) => Object.hasOwn(r, key)),
  ).length;
  // Imports are additive: remap all IDs and references to avoid replacing existing user data.
  const mapping = new Map(
    resources.map((r) => [r._id, id(r._id.split("_")[0])]),
  );
  resources = resources.map((resource) => {
    const copy = portableResource(structuredClone(resource));
    if (copy._type === "request") {
      const aliases = Array.isArray(copy._importRequestIds)
        ? copy._importRequestIds.filter((value) => typeof value === "string" && value)
        : [];
      copy._importRequestIds = [...new Set([...aliases, resource._id])];
    }
    if (copy._type === "websocket_response" && copy._legacyWebSocketAssets?.version === 1)
      copy._legacyWebSocketAssets.sourceRequestId ??= resource.parentId;
    if (copy._type === "response" && copy._legacyResponseAssets?.bodyFormat === "sse-ndjson")
      copy._legacyResponseAssets.sourceRequestId ??= resource.parentId;
    for (const key of referenceKeys)
      if (mapping.has(copy[key])) copy[key] = mapping.get(copy[key]);
    // Legacy RequestMeta owns the saved response choice. Nested literal payloads
    // remain untouched, as does the shared duplication reference policy.
    if (copy._type === "request_meta" && mapping.has(copy.activeResponseId))
      copy.activeResponseId = mapping.get(copy.activeResponseId);
    if (copy._type === "oauth2_token") copy._oauthImported = true;
    return copy;
  });
  if (!resources.some((r) => r._type === "workspace")) {
    const workspaceId = id("wrk");
    resources.push({
      _id: workspaceId,
      _type: "workspace",
      parentId: null,
      name: "Imported Collection",
      scope: "collection",
    });
    const known = new Set(resources.map((r) => r._id));
    for (const r of resources)
      if (r._id !== workspaceId && !known.has(r.parentId))
        r.parentId = workspaceId;
  }
  validateTopology(resources);
  for (const r of resources)
    if (r._type === "request") {
      Object.assign(r, {
        ...newRequest(r.parentId),
        ...r,
        headers: r.headers || [],
        parameters: r.parameters || [],
        body: { mimeType: "", text: "", params: [], ...r.body },
        authentication: r.authentication || {},
      });
    }
  const requestFiles = convertLegacyRequestFiles(resources);
  resources = requestFiles.resources;
  const certificateFiles = convertLegacyCertificateFiles(resources);
  resources = certificateFiles.resources;
  const knownTypes = new Set([
    "workspace",
    "request",
    "request_group",
    "environment",
    "websocket_request",
    "grpc_request",
    "proto_file",
    "proto_directory",
    "websocket_payload",
    "client_certificate",
    "ca_certificate",
  ]);
  const legacyHistory = importedResponseHistory(resources);
  return {
    resources,
    history: legacyHistory.history,
    legacyResponses: resources.filter((r) => ["response","websocket_response"].includes(r._type)).length,
    legacyHistoryWarnings: legacyHistory.warnings,
    legacyRequestFiles: requestFiles.pending,
    legacyRequestFilesLoaded: requestFiles.loaded + requestFiles.portableLoaded,
    legacyRequestFileWarnings: requestFiles.warnings,
    legacyCertificateFiles: certificateFiles.pending,
    legacyCertificateFilesLoaded: certificateFiles.loaded,
    legacyCertificateFileWarnings: certificateFiles.warnings,
    warnings: [
      ...(resources.some(resource=>resource._type==='plugin_data')
        ? ['Legacy plugin data is preserved without activating plugins or changing their local stores. After applying this import, open Preferences → Plugins → Import legacy plugin data to add missing store keys.']
        : []),
      ...(detachedGitBindings
        ? [
            "Imported Git settings are disconnected from local repositories. Set up Git for the imported collection before syncing.",
          ]
        : []),
      ...(resources.some((r) => r._curlSource)
        ? [
            "cURL commands use literal Bash quoting. Shell variables, config files and unsupported options are rejected.",
            "Raw data stays in the text editor with its Content-Type header to preserve encoding. Referenced body and multipart files must be selected before sending.",
          ]
        : []),
    ],
    cookieJars: resources.filter((r) => r._type === "cookie_jar").length,
    environments: resources.filter((r) => r._type === "environment").length,
    apiSpecs: resources.filter((r) => r._type === "api_spec").length,
    requests: resources.filter((r) =>
      ["request", "websocket_request", "grpc_request"].includes(r._type),
    ).length,
    preserved: resources.filter((r) => !knownTypes.has(r._type)).length,
  };
}
/** Attach independently completed native reads without discarding an earlier
 * portable component after a failed reread. No history/body is fabricated.
 * @param {Record<string,any>[]} resources
 * @param {(import('./legacy-response-history.js').LegacyResponseAsset & Record<string,any>)[]} entries */
export function attachLegacyResponseAssets(resources, entries) {
  const loaded = new Map(entries.map((entry) => [entry.id, entry]));
  const byId = new Map(resources.map((resource) => [resource._id, resource]));
  return resources.map((resource) => {
    const asset = loaded.get(resource._id);
    if (!asset || !["response", "websocket_response"].includes(resource._type))
      return resource;
    const websocket = resource._type === "websocket_response";
    const hasPayload =
      typeof (websocket ? asset.eventLogBase64 : asset.bodyBase64) === "string";
    const hasTimeline = typeof asset.timelineBase64 === "string";
    if (!hasPayload && !hasTimeline) return resource;
    const key = websocket ? "_legacyWebSocketAssets" : "_legacyResponseAssets";
    const previous = resource[key];
    const cached = previous?.version === 1 ? { ...previous } : {};
    // A newly read malformed timeline intentionally has raw bytes but no parsed
    // rows. Do not pair those bytes with semantic rows from an older cache.
    if (hasTimeline) delete cached.timeline;
    const { id: _assetId, ...portable } = asset;
    const request = byId.get(resource.parentId);
    const sse = !websocket && request && protocolFor(request) === "sse";
    return {
      ...resource,
      [key]: {
        ...cached,
        version: 1,
        ...portable,
        ...(sse ? { bodyFormat: "sse-ndjson" } : {}),
        ...(websocket || sse
          ? {
              sourceRequestId:
                request?._legacySource?.record?._id ||
                cached.sourceRequestId ||
                request?._id,
            }
          : {}),
      },
    };
  });
}
/** Choose an explicitly authorized legacy folder and read response files only.
 * Successful bytes stay on preserved resources so collection export/reimport
 * survives later history retention. The original NeDB provenance is untouched.
 * @param {ReturnType<typeof parseImport>} review */
export async function pickLegacyResponseHistory(review) {
  if (!isTauri()) throw new Error("External legacy response files require the desktop application.");
  const root = await open({ directory: true, multiple: false, title: "Choose the original legacy data folder" });
  if (!root) return null;
  if (typeof root !== "string") throw new Error("Choose one legacy data folder.");
  const httpPlan = legacyResponseAssetRequests(review.resources);
  const streamPlan = legacyWebSocketAssetRequests(review.resources);
  const ssePlan = legacySseAssetRequests(review.resources);
  const plan = {entries:[...httpPlan.entries,...ssePlan.entries,...streamPlan.entries]};
  const byId = new Map(review.resources.map((r) => [r._id, r]));
  const ordered = plan.entries.map((entry, index) => ({ entry, index })).sort((a, b) => {
    const time = (/** @type {string} */ id) => {
      const resource = byId.get(id);
      if (!resource) return 0;
      return Number.isFinite(resource.modified) ? resource.modified : Number.isFinite(resource.created) ? resource.created : 0;
    };
    return time(b.entry.id) - time(a.entry.id) || a.index - b.index;
  }).map(({ entry }) => entry);
  /** @type {{entries:(import('./legacy-response-history.js').LegacyResponseAsset & Record<string,any>)[]}} */
  const assets = await invoke("read_legacy_response_assets", { root, entries: ordered.slice(0, 100) });
  const resources = attachLegacyResponseAssets(review.resources, assets.entries);
  const attached = new Map(resources.map((resource) => [resource._id, resource]));
  const converted = importedResponseHistory(resources, {
    entries: assets.entries.map((entry) => {
      const resource = attached.get(entry.id);
      const cache = resource?.[
        resource._type === "websocket_response"
          ? "_legacyWebSocketAssets"
          : "_legacyResponseAssets"
      ];
      return cache?.version === 1
        ? { ...cache, ...entry, id: entry.id }
        : entry;
    }),
  });
  return {
    ...review,
    resources,
    history: converted.history,
    legacyHistoryWarnings: [
      ...converted.warnings,
      ...(ordered.length > 100 ? [{ id: "", code: "preview-entry-limit", message: `${ordered.length - 100} older responses were not read in this preview. Their original records and asset paths remain preserved; at most 100 responses are read per preview.` }] : []),
    ],
  };
}
/** Explicitly select the original folder; never expand imported file paths.
 * @param {ReturnType<typeof parseImport>} review */
export async function pickLegacyRequestFiles(review) {
  if (!isTauri()) throw new Error("External request files require the desktop application.");
  const root = await open({ directory: true, multiple: false, title: "Choose the original request files folder" });
  if (!root) return null;
  if (typeof root !== "string") throw new Error("Choose one request files folder.");
  const plan = legacyRequestAssetRequests(review.resources);
  const assets = await invoke("read_legacy_request_assets", {
    root, entries: plan.entries.map(({ id, path }) => ({ id, path })),
  });
  const converted = convertLegacyRequestFiles(review.resources, assets);
  return { ...review, resources: converted.resources,
    legacyRequestFiles: converted.pending,
    legacyRequestFilesLoaded: converted.loaded + converted.portableLoaded,
    legacyRequestFileWarnings: [...plan.warnings, ...converted.warnings] };
}
/** Load only explicitly granted original certificate files into the reviewed copy.
 * @param {ReturnType<typeof parseImport>} review */
export async function pickLegacyCertificateFiles(review) {
  if (!isTauri()) throw new Error("External certificate files require the desktop application.");
  const root = await open({ directory: true, multiple: false, title: "Choose the original certificate files folder" });
  if (!root) return null;
  if (typeof root !== "string") throw new Error("Choose one certificate files folder.");
  const plan = legacyCertificateAssetRequests(review.resources);
  const assets = await invoke("read_legacy_certificate_assets", { root, entries: plan.entries });
  const converted = convertLegacyCertificateFiles(review.resources, assets);
  return { ...review, resources: converted.resources,
    legacyCertificateFiles: converted.pending, legacyCertificateFilesLoaded: converted.loaded,
    legacyCertificateFileWarnings: [...plan.warnings, ...converted.warnings] };
}
export async function pickImport() {
  if (!isTauri()) return null;
  const path = await open({
    multiple: true,
    filters: [
      {
        name: "API collections / legacy databases",
        extensions: ["json", "yaml", "yml", "har", "db", "curl", "txt", "wsdl", "xml", "xsd"],
      },
    ],
  });
  if (!path) return null;
  let sourceBytes = 0;
  for (const selected of path) {
    const metadata = await stat(selected);
    if (!metadata.isFile || metadata.size > 64 * 1024 * 1024 || sourceBytes + metadata.size > 64 * 1024 * 1024)
      throw new Error("Selected collection files exceed the 64 MiB import limit or are not ordinary files. The source was not changed.");
    sourceBytes += metadata.size;
  }
  if (path.every((p) => p.toLowerCase().endsWith(".db"))) {
    const files = await Promise.all(
      path.map(async (p) => ({
        name: p.split(/[\\/]/).at(-1) || p,
        text: await readTextFile(p),
      })),
    );
    return parseImport(JSON.stringify(parseLegacyFiles(files)));
  }
  if (path.length > 1 && path.every(p=>/\.(wsdl|xsd|xml)$/i.test(p))) {
    const normalized = path.map(p=>p.replaceAll('\\','/'));
    let directory = normalized[0].slice(0,normalized[0].lastIndexOf('/'));
    while (directory && !normalized.every(p=>p.startsWith(directory+'/')))
      directory = directory.slice(0,directory.lastIndexOf('/'));
    if (!directory) throw new Error('Select WSDL dependencies from a common local directory tree.');
    const files = await Promise.all(path.map(async (p,index)=>({name:normalized[index].slice(directory.length+1),text:await readTextFile(p)})));
    const selected = selectWsdlRoot(files);
    return parseImport(selected.text,selected);
  }
  if (path.length !== 1)
    throw new Error(
      "Select one collection file, legacy .db files together, or a WSDL root with its WSDL/XSD dependencies.",
    );
  return parseImport(await readTextFile(path[0]));
}
/** @param {ReturnType<typeof initialData>} data */
export async function exportData(data) {
  const selectedPortableResponses = new Map(Object.entries(data.responseSelections || {}).filter(([requestId, responseId]) =>
    data.history.some((entry) => entry._id === responseId && entry.requestId === requestId) &&
    data.resources.some((resource) => resource._id === responseId && ((resource._type === "response" && resource._legacyResponseAssets?.version === 1) || (resource._type === "websocket_response" && resource._legacyWebSocketAssets?.version === 1)))));
  const resources = data.resources.map((resource) => {
    const portable = portableResource(resource, true);
    const selected = resource._type === "request_meta" ? selectedPortableResponses.get(resource.parentId) : undefined;
    return selected ? { ...portable, activeResponseId: selected } : portable;
  });
  for (const [requestId, responseId] of selectedPortableResponses)
    if (!resources.some((resource) => resource._type === "request_meta" && resource.parentId === requestId))
      resources.push({ _id: id("reqm"), _type: "request_meta", parentId: requestId, activeResponseId: responseId });
  const text = JSON.stringify(
    {
      _type: "export",
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: "insomnium.tauri:0.1.0",
      resources,
    },
    null,
    2,
  );
  if (isTauri()) {
    const path = await save({
      defaultPath: "insomnium-export.json",
      filters: [{ name: "Insomnium JSON", extensions: ["json"] }],
    });
    if (path) await writeTextFile(path, text);
  } else await download(text, "insomnium-export.json", "application/json");
}
/** @param {BlobPart} data @param {string} name @param {string} [type] */
export async function download(data, name, type = "text/plain") {
  if (isTauri()) {
    const path = await save({ defaultPath: name });
    if (path)
      await writeFile(
        path,
        new Uint8Array(await new Blob([data], { type }).arrayBuffer()),
      );
    return;
  }
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
