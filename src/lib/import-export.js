import { curlResources, isCurlImport } from "./curl-import.js";
import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { id, initialData, newRequest } from "./model.js";
import { parseLegacyFiles } from "./legacy-import.js";
import { referenceKeys, validateTopology } from "./resources.js";
import { parseSpec } from "./openapi-document.js";
import {
  postmanUrl,
  postmanBody,
  postmanVariables,
  postmanHeaders,
} from "./postman-import.js";

/** Native repository IDs identify app-data on this machine, not portable resources.
 * Keep repository settings, but never reactivate a local binding through import.
 * @param {Record<string, any>} resource @param {boolean} [forExport] */
function portableGitResource(resource, forExport = false) {
  if (resource._type !== "git_repository") return resource;
  const copy = { ...resource };
  delete copy.nativeRepositoryId;
  delete copy.nativeBindingVersion;
  delete copy.nativeCreateIntent;
  if (forExport) delete copy.credentials;
  return copy;
}

/** @param {string} text */
export function parseImport(text) {
  let source;
  if (isCurlImport(text)) source = { resources: curlResources(text) };
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
  if (source.openapi || source.swagger) {
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
  else if (source.info && Array.isArray(source.item)) {
    const workspaceId = id("wrk");
    resources.push({
      _id: workspaceId,
      _type: "workspace",
      parentId: null,
      name: source.info.name || "Postman Collection",
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
      for (const item of items) {
        if (Array.isArray(item.item)) {
          const folderId = id("fld");
          resources.push({
            _id: folderId,
            _type: "request_group",
            parentId,
            name: item.name,
            environment: postmanVariables(item.variable),
          });
          visit(
            item.item,
            folderId,
            item.auth || inheritedAuth,
            inheritedScripts || !!item.event?.length,
          );
        } else if (item.request) {
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
              description:
                typeof req.description === "string"
                  ? req.description
                  : req.description?.content || "",
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
        }
      }
    };
    visit(source.item, workspaceId);
  } else if (source.log?.entries) {
    const workspaceId = id("wrk");
    resources.push({
      _id: workspaceId,
      _type: "workspace",
      parentId: null,
      name: "HAR Import",
      scope: "collection",
    });
    for (const entry of source.log.entries)
      resources.push(
        newRequest(workspaceId, {
          name: entry.request.url,
          method: entry.request.method,
          url: entry.request.url,
          headers: entry.request.headers || [],
          body: {
            mimeType: entry.request.postData?.mimeType || "",
            text: entry.request.postData?.text || "",
            params: entry.request.postData?.params || [],
          },
          _harSource: entry,
        }),
      );
  } else
    throw new Error(
      "Unsupported file. Use Insomnia JSON, Insomnium JSON, Postman collection v2, HAR, OpenAPI JSON/YAML, or cURL commands.",
    );
  if (!resources.length) throw new Error("The import contains no resources");
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
      (Object.hasOwn(r, "nativeRepositoryId") ||
        Object.hasOwn(r, "nativeBindingVersion")),
  ).length;
  // Imports are additive: remap all IDs and references to avoid replacing existing user data.
  const mapping = new Map(
    resources.map((r) => [r._id, id(r._id.split("_")[0])]),
  );
  resources = resources.map((resource) => {
    const copy = portableGitResource(structuredClone(resource));
    for (const key of referenceKeys)
      if (mapping.has(copy[key])) copy[key] = mapping.get(copy[key]);
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
  const knownTypes = new Set([
    "workspace",
    "request",
    "request_group",
    "environment",
    "websocket_request",
    "websocket_payload",
  ]);
  return {
    resources,
    warnings: [
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
    apiSpecs: resources.filter((r) => r._type === "api_spec").length,
    requests: resources.filter((r) =>
      ["request", "websocket_request"].includes(r._type),
    ).length,
    preserved: resources.filter((r) => !knownTypes.has(r._type)).length,
  };
}
export async function pickImport() {
  if (!isTauri()) return null;
  const path = await open({
    multiple: true,
    filters: [
      {
        name: "API collections / legacy databases",
        extensions: ["json", "yaml", "yml", "har", "db", "curl", "txt"],
      },
    ],
  });
  if (!path) return null;
  if (path.every((p) => p.toLowerCase().endsWith(".db"))) {
    const files = await Promise.all(
      path.map(async (p) => ({
        name: p.split(/[\\/]/).at(-1) || p,
        text: await readTextFile(p),
      })),
    );
    return parseImport(JSON.stringify(parseLegacyFiles(files)));
  }
  if (path.length !== 1)
    throw new Error(
      "Select one collection file, or select legacy .db files together.",
    );
  return parseImport(await readTextFile(path[0]));
}
/** @param {ReturnType<typeof initialData>} data */
export async function exportData(data) {
  const text = JSON.stringify(
    {
      _type: "export",
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: "insomnium.tauri:0.1.0",
      resources: data.resources.map((resource) =>
        portableGitResource(resource, true),
      ),
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
