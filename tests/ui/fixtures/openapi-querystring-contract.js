import { prepareRenderedRequest } from "../../../src/lib/transport.js";
import { querystringOptions } from "../../../src/lib/openapi-querystring.js";
import { analyzeSpec } from "../../../src/lib/openapi.js";
import { openApiQuerystringCases } from "../helpers/openapi-querystring-cases.js";

const evidence = document.createElement("pre");
evidence.setAttribute("aria-label", "Whole query composer evidence");
document.body.append(evidence);
const checks = [];
for (const encoding of [false, true])
  for (const curl of [false, true])
    for (const entry of openApiQuerystringCases) {
      const request = {
        _id: "req_contract",
        _type: "request",
        parentId: "wrk_contract",
        method: "GET",
        url: "http://localhost/" + entry.id,
        settingEncodeUrl: encoding,
        _curlSource: curl,
        parameters: [
          {
            name: "label",
            sendEmptyName: true,
            value: entry.media.startsWith("text/plain")
              ? entry.value === null
                ? "null"
                : entry.value
              : JSON.stringify(entry.value),
            _openapiSerialization: {
              ...querystringOptions(
                {
                  schema: entry.schema,
                  ...("encoding" in entry ? { encoding: entry.encoding } : {}),
                },
                "3.2.1",
              ),
              mediaType: entry.media,
              kind: entry.media.startsWith("text/plain")
                ? entry.value === null
                  ? "scalar-json"
                  : "scalar"
                : "object",
              nullable: entry.value === null,
            },
          },
        ],
      };
      let actual = null,
        error = "";
      try {
        actual = prepareRenderedRequest(
          {
            resources: [
              { _id: "wrk_contract", _type: "workspace", parentId: null },
              request,
            ],
            settings: { timeout: 30000 },
          },
          request,
          "contract",
        ).url;
      } catch (cause) {
        error = String(cause);
      }
      const expected =
        entry.expected === null ? null : request.url + entry.expected;
      checks.push({
        id: entry.id,
        encoding,
        curl,
        actual,
        expected,
        error,
        passed: entry.expected === null ? !!error : actual === expected,
      });
    }
for (const [id, source, expected, after] of [
  [
    "empty-before-fragment",
    "http://localhost/probe#keep",
    "http://localhost/probe?#keep",
    false,
  ],
  [
    "empty-existing-bare",
    "http://localhost/probe?",
    "http://localhost/probe?",
    false,
  ],
  [
    "empty-existing-named",
    "http://localhost/probe?a=1#keep",
    "http://localhost/probe?a=1&#keep",
    false,
  ],
  [
    "empty-followed-row",
    "http://localhost/probe#keep",
    "http://localhost/probe?after=1#keep",
    true,
  ],
]) {
  const request = {
    _id: "req_boundary",
    _type: "request",
    parentId: "wrk_contract",
    method: "GET",
    url: source,
    parameters: [
      {
        name: "label",
        sendEmptyName: true,
        value: "",
        _openapiSerialization: {
          querystring: true,
          style: "content",
          kind: "scalar",
          mediaType: "text/plain",
        },
      },
      ...(after ? [{ name: "after", value: "1" }] : []),
    ],
  };
  const actual = prepareRenderedRequest(
    {
      resources: [
        { _id: "wrk_contract", _type: "workspace", parentId: null },
        request,
      ],
      settings: { timeout: 30000 },
    },
    request,
    "boundary",
  ).url;
  checks.push({
    id,
    encoding: true,
    curl: false,
    actual,
    expected,
    error: "",
    passed: actual === expected,
  });
}
const url = new URL("http://localhost/probe");
url.search = "?";
const validation = [];
for (const [id, parameter] of [
  ["null-parameter", null],
  ["boolean-parameter", false],
  ["string-parameter", "invalid"],
  ["missing-location", {}],
]) {
  const document = {
    openapi: "3.2.1",
    info: { title: "Invalid parameter controls", version: "1" },
    paths: {
      "/probe": {
        get: {
          summary: "probe",
          operationId: "probe",
          parameters: [parameter],
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
  try {
    const result = analyzeSpec({ contents: JSON.stringify(document) });
    validation.push({
      id,
      passed:
        result.valid === false &&
        result.diagnostics.some((d) => d.severity === "error"),
      valid: result.valid,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    validation.push({ id, passed: false, error: String(error) });
  }
}
evidence.textContent = JSON.stringify({
  passed: checks.every((c) => c.passed) && validation.every((v) => v.passed),
  checks,
  validation,
  emptyQueryProbe: {
    href: url.href,
    search: url.search,
    parsedHref: new URL("http://localhost/probe?").href,
  },
  scope:
    "Headless Chromium production composer with literal media fixtures; no native worker/IPC/wire acceptance.",
});
