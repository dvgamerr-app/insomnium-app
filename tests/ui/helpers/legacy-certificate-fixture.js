import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const certificateDigest = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** @param {Record<string,{path:string,bytes:Uint8Array}>} materials
 * @param {{http:string,sse:string,wss:string,grpc:string}} urls
 * @param {{portable?:boolean,password:string}} options */
export function legacyCertificateFixture(materials, urls, options) {
  const definitions = [
    { token: "pem", protocol: "http", identity: "pem", success: true },
    {
      token: "encrypted",
      protocol: "http",
      identity: "encrypted",
      success: true,
    },
    { token: "pfx", protocol: "http", identity: "pfx", success: true },
    { token: "selection", protocol: "http", identity: "pfx", success: true },
    {
      token: "wrong-password",
      protocol: "http",
      identity: "encrypted",
      success: false,
    },
    { token: "sse", protocol: "sse", identity: "pem", success: true },
    { token: "wss", protocol: "wss", identity: "pfx", success: true },
    { token: "grpc", protocol: "grpc", identity: "pem", success: true },
  ];
  /** @type {Record<string,any>[]} */ const records = [];
  for (const definition of definitions) {
    const workspaceId = "wrk_import_certificate_" + definition.token;
    records.push({
      _id: workspaceId,
      type: "Workspace",
      parentId: null,
      name: "Legacy TLS " + definition.token,
      scope: "collection",
    });
    records.push({
      _id: "env_import_certificate_" + definition.token,
      type: "Environment",
      parentId: workspaceId,
      name: "Base Environment",
      data: {},
    });
    records.push({
      _id: "ca_import_" + definition.token,
      type: "CaCertificate",
      parentId: workspaceId,
      path: materials.ca.path,
      disabled: false,
      isPrivate: false,
    });
    if (definition.token === "selection") {
      records.push({
        _id: "crt_disabled",
        type: "ClientCertificate",
        parentId: workspaceId,
        host: "127.0.0.1:*",
        cert: materials.missing.path,
        key: materials.missing.path,
        disabled: true,
        isPrivate: true,
      });
      records.push({
        _id: "crt_mismatched",
        type: "ClientCertificate",
        parentId: workspaceId,
        host: "mismatch.invalid:*",
        cert: materials.missing.path,
        key: materials.missing.path,
        disabled: false,
        isPrivate: true,
      });
    }
    const identity =
      definition.identity === "pfx"
        ? {
            pfx: materials.pfx.path,
            cert:
              definition.token === "selection" ? materials.missing.path : null,
            key:
              definition.token === "selection" ? materials.missing.path : null,
            passphrase: options.password,
          }
        : {
            cert: materials.cert.path,
            key:
              definition.identity === "encrypted"
                ? materials.encrypted.path
                : materials.key.path,
            pfx: null,
            passphrase:
              definition.token === "wrong-password"
                ? "explicit-wrong-owned-password"
                : definition.identity === "encrypted"
                  ? options.password
                  : null,
          };
    records.push({
      _id: "crt_import_" + definition.token,
      type: "ClientCertificate",
      parentId: workspaceId,
      host: "127.0.0.1:*",
      disabled: false,
      isPrivate: true,
      ...identity,
      literal: { key: materials.key.path, parentId: workspaceId },
    });
    const protocol = definition.protocol;
    records.push({
      _id: "req_import_tls_" + definition.token,
      type:
        protocol === "wss"
          ? "WebSocketRequest"
          : protocol === "grpc"
            ? "GrpcRequest"
            : "Request",
      parentId: workspaceId,
      name: "Imported TLS " + definition.token,
      method: protocol === "http" ? "POST" : "GET",
      url:
        protocol === "http"
          ? urls.http + "/legacy-" + definition.token
          : urls[/** @type {"sse"|"wss"|"grpc"} */ (protocol)],
      ...(protocol === "sse" ? { responseMode: "sse" } : {}),
      ...(protocol === "grpc"
        ? { protoFileId: "", protoMethodName: "", grpcJsonMode: "legacy" }
        : {}),
      headers:
        protocol === "sse"
          ? [{ name: "Accept", value: "text/event-stream" }]
          : [],
      parameters: [],
      body: {
        mimeType: protocol === "http" ? "text/plain" : "",
        text:
          protocol === "http"
            ? "owned imported certificate payload " + definition.token
            : "{}",
      },
      settingSendCookies: false,
      settingStoreCookies: false,
    });
  }
  const kinds = {
    Workspace: "workspace",
    Environment: "environment",
    CaCertificate: "ca_certificate",
    ClientCertificate: "client_certificate",
    Request: "request",
    WebSocketRequest: "websocket_request",
    GrpcRequest: "grpc_request",
  };
  /** @type {Record<string,any>[]} */ const resources = records.map((raw) => {
    const { type, ...rest } = structuredClone(raw);
    /** @type {Record<string,any>} */ const resource = {
      ...rest,
      _type: /** @type {Record<string,string>} */ (kinds)[type],
      _legacySource: {
        fileName: "certificates.db",
        record: structuredClone(raw),
      },
    };
    if (
      options.portable &&
      ["ca_certificate", "client_certificate"].includes(resource._type) &&
      !resource.disabled
    ) {
      const fields = {};
      for (const field of resource._type === "ca_certificate"
        ? ["path"]
        : ["cert", "key", "pfx"]) {
        const material = Object.values(materials).find(
          (entry) => entry.path === resource[field] && entry.bytes.length > 0,
        );
        if (material)
          /** @type {Record<string,any>} */ (fields)[field] = {
            path: material.path,
            base64: Buffer.from(material.bytes).toString("base64"),
            size: material.bytes.length,
            sha256: certificateDigest(material.bytes),
          };
      }
      resource._legacyCertificateAssets = { version: 1, fields };
    }
    return resource;
  });
  return { definitions, records, resources };
}

/** @param {Record<string,any>} resource */
export function assertCertificateCache(resource) {
  for (const [field, asset] of Object.entries(
    resource._legacyCertificateAssets?.fields || {},
  )) {
    assert.equal(asset.path, resource[field]);
    const bytes = Buffer.from(asset.base64, "base64");
    assert.equal(bytes.length, asset.size);
    assert.equal(certificateDigest(bytes), asset.sha256);
  }
}
