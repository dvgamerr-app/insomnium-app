import RequestBodyGit from "./request-body-git.svelte";
import { externalContractEvidence } from "../helpers/openapi-external-contract.js";
import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import { mount } from "svelte";
import KeyValueEditor from "../../../src/lib/components/KeyValueEditor.svelte";
import "../../../src/lib/styles.css";
import { prepareRenderedRequest } from "../../../src/lib/transport.js";
import { serializeOpenApiSerialized } from "../../../src/lib/openapi-serialized-example.js";
import {
  serializedExampleCases,
  serializedExampleDocument,
} from "../helpers/openapi-serialized-example-cases.js";

const checks = [];
for (const version of ["3.2.0", "3.2.1"]) {
  const analysis = analyzeSpec({
    contents: JSON.stringify(
      serializedExampleDocument("http://localhost", version),
    ),
  });
  if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
  const resources = generateRequests(analysis, "wrk_owned", "spc_owned");
  for (const encoding of [false, true])
    for (const curl of [false, true])
      for (const c of serializedExampleCases) {
        const original = resources.find(
          (r) => r._type === "request" && r.name === c.id,
        );
        if (!original) throw Error("Missing owned request " + c.id);
        // JSON round trip also verifies that saved metadata drives the composer.
        const request = JSON.parse(
          JSON.stringify({
            ...original,
            settingEncodeUrl: encoding,
            _curlSource: curl,
          }),
        );
        const p = prepareRenderedRequest(
          { resources, settings: { timeout: 30000 } },
          request,
          "run_owned",
        );
        const actual =
          c.location === "body"
            ? p.body
            : c.location === "header"
              ? p.headers.find(
                  (h) => h[0].toLowerCase() === c.name.toLowerCase(),
                )?.[1]
              : c.location === "cookie"
                ? p.headers.find((h) => h[0].toLowerCase() === "cookie")?.[1]
                : c.location === "path"
                  ? new URL(p.url).pathname
                  : p.url.slice(p.url.indexOf("/" + c.id) + c.id.length + 1);
        checks.push({
          id: c.id,
          version,
          encoding,
          curl,
          actual,
          expected: c.expected,
          passed: actual === c.expected,
        });
      }
}
const invalid = [
  { location: "query", text: "x=%q0" },
  { location: "query", text: "x=two words" },
  { location: "query", text: "x=a#fragment" },
  { location: "path", text: "x?query" },
  { location: "header", text: "value\r\nInjected: yes" },
  { location: "cookie", text: "owned=two words" },
  { location: "cookie", text: "owned=value\r\n" },
  { location: "body", text: "{invalid}", mediaType: "application/json" },
  { location: "body", text: "é", mediaType: "text/plain; charset=us-ascii" },
  { location: "body", text: "é", mediaType: "text/plain; charset=iso-8859-1" },
  {
    location: "body",
    text: "x",
    mediaType: "text/plain; charset=utf-8; charset=utf-8",
  },
];
const controls = invalid.map((c) => {
  let refused = false;
  try {
    serializeOpenApiSerialized(
      "owned",
      c.text,
      {
        serializedLevel: c.mediaType ? "media" : "parameter",
        mediaType: c.mediaType,
      },
      c.location,
    );
  } catch {
    refused = true;
  }
  let runtimeRefused = false;
  const row = {
    name: "owned",
    value: c.text,
    _openapiSerialization: {
      style: "serialized",
      kind: "scalar",
      explode: false,
      serializedLevel: c.mediaType ? "media" : "parameter",
      mediaType: c.mediaType,
    },
  };
  const request = {
    _id: "req_invalid",
    _type: "request",
    parentId: "wrk_owned",
    method: "POST",
    url: "http://localhost/control" + (c.location === "path" ? "/{owned}" : ""),
    _openapiIssues: [],
    ...(c.location === "body"
      ? {
          body: {
            text: c.text,
            mimeType: c.mediaType,
            _openapiSerialization: row._openapiSerialization,
          },
        }
      : {
          [c.location === "query"
            ? "parameters"
            : c.location === "path"
              ? "pathParameters"
              : c.location === "cookie"
                ? "cookieParameters"
                : "headers"]: [row],
        }),
  };
  try {
    prepareRenderedRequest(
      { resources: [request], settings: { timeout: 30000 } },
      request,
      "run_invalid",
    );
  } catch {
    runtimeRefused = true;
  }
  return { ...c, refused, runtimeRefused };
});
const element = document.createElement("pre");
const signingControls = [];
for (const mime of [
  "application/x-www-form-urlencoded",
  "Application/X-Www-Form-Urlencoded; charset=utf-8",
])
  for (const bodyMode of ["legacy", "standard"])
    for (const includeBodyHash of [false, true]) {
      const request = {
        _id: "req_signing",
        _type: "request",
        parentId: "wrk_owned",
        method: "POST",
        url: "http://localhost/signing",
        authentication: {
          type: "oauth1",
          signatureMethod: "HMAC-SHA1",
          bodyMode,
          includeBodyHash,
        },
        body: {
          mimeType: mime,
          text: "x=a%20b&x=%2f",
          _openapiSerialization: {
            style: "serialized",
            serializedLevel: "media",
            mediaType: mime,
          },
        },
      };
      let refused = false,
        body = null;
      try {
        body = prepareRenderedRequest(
          { resources: [request], settings: { timeout: 30000 } },
          request,
          "run_signing",
        ).body;
      } catch (error) {
        if (!String(error).includes("Choose RFC 5849")) throw error;
        refused = true;
      }
      const expectedRefusal = bodyMode === "legacy" && includeBodyHash;
      signingControls.push({
        mime,
        bodyMode,
        includeBodyHash,
        refused,
        body,
        passed:
          refused === expectedRefusal &&
          (refused || body === request.body.text),
      });
    }
element.setAttribute("aria-label", "Serialized example composer evidence");
element.textContent = JSON.stringify({
  passed:
    signingControls.every((c) => c.passed) &&
    checks.every((c) => c.passed) &&
    controls.every((c) => c.refused && c.runtimeRefused),
  checks,
  controls,
  signingControls,
});
document.body.append(element);
const editor = document.createElement("section");
editor.setAttribute("aria-label", "Serialized rows editor");
document.body.append(editor);
const rows = [
  {
    name: "label",
    value: "x=a%20b",
    _openapiSerialization: {
      style: "serialized",
      kind: "scalar",
      explode: false,
      serializedLevel: "parameter",
      serializedLocation: "query",
    },
  },
  {
    name: "payload",
    value: '{ "n":1 }',
    _openapiSerialization: {
      style: "serialized",
      kind: "scalar",
      explode: false,
      serializedLevel: "media",
      serializedLocation: "query",
      mediaType: "application/json",
    },
  },
];
const edits = document.createElement("pre");
edits.setAttribute("aria-label", "Serialized row edit evidence");
document.body.append(edits);
mount(KeyValueEditor, {
  target: editor,
  props: {
    rows,
    label: "Parameter",
    onchange: (updated) => {
      edits.textContent = JSON.stringify(updated);
    },
  },
});

const bodyHost = document.createElement("section");
document.body.append(bodyHost);
mount(RequestBodyGit, { target: bodyHost });
const external = document.createElement("pre");
external.setAttribute("aria-label", "External example contract evidence");
external.textContent = JSON.stringify(externalContractEvidence());
document.body.append(external);
