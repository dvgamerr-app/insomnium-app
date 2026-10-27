import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { manualMultipartParts } from "./http-manual-fixture.js";

export const requestFileDigest = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export const requestFileBinary = Buffer.from([
  0, 255, 13, 10, 128, 195, 40, 0, 65,
]);
export const requestFileGzip = Buffer.from(
  Bun.gzipSync(Buffer.from("Raw legacy gzip is not decompressed")),
);

/** Shared literal source and independent actual-wire expectations.
 * @param {(token:string)=>string} target @param {Record<string,string>} paths
 * @param {{portable?:boolean,native?:boolean,sse?:boolean}} [options] */
export function legacyRequestFixture(target, paths, options = {}) {
  const sourceName = "Owned legacy request files";
  const workspaceId = "wrk_legacy_request_files";
  const definitions = [
    { token: "raw", mime: "", bytes: requestFileBinary, path: paths.binary },
    {
      token: "empty",
      mime: "application/octet-stream",
      bytes: Buffer.alloc(0),
      path: paths.empty,
    },
    {
      token: "gzip",
      mime: "application/gzip",
      bytes: requestFileGzip,
      path: paths.gzip,
    },
    {
      token: "graphql-file",
      mime: "application/graphql",
      bytes: requestFileBinary,
      path: paths.binary,
    },
    {
      token: "form-file",
      mime: "application/x-www-form-urlencoded",
      bytes: requestFileBinary,
      path: paths.binary,
    },
    {
      token: "multipart",
      mime: "multipart/form-data",
      bytes: Buffer.alloc(0),
      path: "",
    },
  ].filter(definition => !options.sse || ["raw", "multipart"].includes(definition.token));
  const asset = (/** @type {string} */ path, /** @type {Buffer} */ bytes) => ({
    fileName: path.split(/[\\/]/).at(-1),
    _legacyFilePath: path,
    base64: bytes.toString("base64"),
    _legacyFileAsset: {
      version: 1,
      path,
      size: bytes.length,
      sha256: requestFileDigest(bytes),
    },
  });
  const source = definitions.map((definition) => {
    const body =
      definition.token === "multipart"
        ? {
            mimeType: definition.mime,
            params: [
              { name: "dup", value: "first β", type: "text" },
              { name: "dup", value: "", type: "file", fileName: paths.binary },
              { name: "", value: "", type: "file", fileName: paths.binary },
              { name: "empty", value: "", type: "text" },
              {
                name: "fallback",
                value: "legacy no-filename text",
                type: "file",
                fileName: "",
              },
              {
                name: "empty-file",
                value: "",
                type: "file",
                fileName: paths.empty,
              },
              {
                name: "disabled",
                value: "must-not-send",
                type: "file",
                fileName: paths.missing,
                disabled: true,
              },
              ...(options.native
                ? [
                    {
                      name: "typed",
                      value: "folded MIME text",
                      type: "text",
                      contentType: "text/plain;\r\n charset=utf-8",
                    },
                  ]
                : []),
            ],
          }
        : {
            mimeType: definition.mime,
            fileName: definition.path,
            text: "ignored source text",
            params: [{ name: "ignored", value: "must-not-send" }],
          };
    return {
      _id: "req_legacy_" + definition.token,
      type: "Request",
      parentId: workspaceId,
      name: "Legacy file " + definition.token,
      method: "POST",
      url: target(definition.token),
      body,
      headers: options.sse && definition.token === "raw" ? [{ name: "Accept", value: "text/event-stream" }] : [],
      ...(options.sse && definition.token === "multipart" ? { isEventStreamRequest: true } : {}),
      parameters: [],
      authentication: {},
      settingSendCookies: false,
      settingStoreCookies: false,
      literal: {
        requestId: "req_legacy_raw",
        nested: { fileName: paths.binary },
      },
    };
  });
  const records = [
    {
      _id: workspaceId,
      type: "Workspace",
      parentId: null,
      name: sourceName,
      scope: "collection",
    },
    {
      _id: "env_legacy_request_base",
      type: "Environment",
      parentId: workspaceId,
      name: "Base Environment",
      data: {},
    },
    ...source,
  ];
  const resources = records.map((record) => {
    const { type, ...fields } = structuredClone(record);
    const resource = {
      ...fields,
      _type: type.toLowerCase(),
      _legacySource: {
        fileName: "requests.db",
        record: structuredClone(record),
      },
    };
    if (options.portable && resource._type === "request") {
      const request = /** @type {any} */ (resource);
      if (request.body.mimeType === "multipart/form-data")
        for (const index of [1, 2, 5])
          Object.assign(
            request.body.params[index],
            asset(
              request.body.params[index].fileName,
              index === 5 ? Buffer.alloc(0) : requestFileBinary,
            ),
          );
      else {
        const definition = definitions.find(
          (definition) => request.name === "Legacy file " + definition.token,
        );
        assert.ok(definition);
        Object.assign(request.body, asset(definition.path, definition.bytes));
      }
    }
    return resource;
  });
  return { sourceName, workspaceId, definitions, records, source, resources };
}

/** @param {Record<string,any>|undefined} wire @param {string} token @param {{native?:boolean}} [options] */
export function assertLegacyRequestWire(wire, token, options = {}) {
  assert.ok(wire, "Actual captured wire record required");
  const bytes = Buffer.from(wire.bodyBase64, "base64");
  assert.equal(wire.method, "POST");
  if (token !== "multipart") {
    const expected =
      token === "empty"
        ? Buffer.alloc(0)
        : token === "gzip"
          ? requestFileGzip
          : requestFileBinary;
    assert.deepEqual(bytes, expected);
    assert.equal(requestFileDigest(bytes), requestFileDigest(expected));
    const mime =
      token === "raw"
        ? undefined
        : token === "empty"
          ? "application/octet-stream"
          : token === "gzip"
            ? "application/gzip"
            : token === "graphql-file"
              ? "application/graphql"
              : "application/x-www-form-urlencoded";
    assert.equal(
      wire.headers["content-type"],
      mime,
      "Legacy body filename wins and absent MIME is not fabricated",
    );
    return;
  }
  const parts = manualMultipartParts(bytes, wire.headers["content-type"]);
  const names = [
    "dup",
    "dup",
    "",
    "empty",
    "fallback",
    "empty-file",
    ...(options.native ? ["typed"] : []),
  ];
  const values = [
    Buffer.from("first β"),
    requestFileBinary,
    requestFileBinary,
    Buffer.alloc(0),
    Buffer.from("legacy no-filename text"),
    Buffer.alloc(0),
    ...(options.native ? [Buffer.from("folded MIME text")] : []),
  ];
  assert.equal(parts.length, names.length);
  for (let index = 0; index < parts.length; index++) {
    assert.ok(parts[index].headers.includes('name="' + names[index] + '"'));
    assert.deepEqual(parts[index].body, values[index]);
  }
  assert.match(parts[1].headers, /filename="blob\.bin"/);
  assert.match(parts[2].headers, /filename="blob\.bin"/);
  assert.match(parts[5].headers, /filename="empty\.bin"/);
  assert.equal(parts[4].headers.includes("filename="), false);
  assert.equal(bytes.includes(Buffer.from("must-not-send")), false);
  if (options.native)
    assert.ok(parts[6].headers.includes("text/plain; charset=utf-8"));
}
