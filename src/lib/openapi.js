import { dereference } from "@scalar/openapi-parser";
import { validatePathParameters } from "@scalar/openapi-validator";
import { validateApiDocument } from "./openapi-validation.js";
import { sample } from "openapi-sampler";
import { id, newRequest } from "./model.js";
import { serializeOpenApiQuery } from "./openapi-query.js";
import { serializeOpenApiHeader } from "./openapi-header.js";
import { serializeOpenApiPath } from "./openapi-path.js";

import { parseSpec, methods } from "./openapi-document.js";

/** @param {Record<string, any>} spec */
export function analyzeSpec(spec) {
  const parsed = parseSpec(spec.contents || "");
  /** @type {{ severity: string, message: string, path: string, line: number, column: number }[]} */
  const diagnostics = [];
  const add = (
    /** @type {string} */ severity,
    /** @type {string} */ message,
    /** @type {(string | number)[]} */ path = [],
  ) => {
    const node = parsed.document.getIn(path, true);
    const offset =
      node && typeof node === "object" && "range" in node
        ? Array.isArray(node.range)
          ? node.range[0]
          : 0
        : 0;
    const position = parsed.lines.linePos(offset);
    diagnostics.push({
      severity,
      message,
      path: path.join("/"),
      line: position.line,
      column: position.col,
    });
  };
  const strict = validateApiDocument(structuredClone(parsed.value));
  for (const error of strict.errors || [])
    add(
      "error",
      error.message || "Invalid specification",
      String(error.path || "")
        .split("/")
        .slice(1)
        .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~")),
    );
  const rootName = new URL(spec.fileName || "openapi.yaml", "memory:///").href;
  const files = [
    { name: rootName, value: parsed.value },
    ...(spec.files || []).map((/** @type {any} */ file) => ({
      name: new URL(file.name, rootName).href,
      value: parseSpec(file.contents).value,
    })),
  ];
  if (files.length > 33) throw new Error("Attach at most 32 reference files.");
  if (new Set(files.map((file) => file.name)).size !== files.length)
    throw new Error(
      "Reference file names must be unique and differ from the main file.",
    );
  if (
    new TextEncoder().encode(JSON.stringify(files)).byteLength >
    8 * 1024 * 1024
  )
    throw new Error("Combined specification files exceed 8 MiB.");
  const filesystem = files.map((file, index) => {
    const value = structuredClone(file.value);
    const stack = [{ value, depth: 0 }];
    let count = 0;
    while (stack.length) {
      const current = stack.pop();
      if (!current || !current.value || typeof current.value !== "object")
        continue;
      if (++count > 200000 || current.depth > 100)
        throw new Error(
          "Specification structure exceeds the processing limit.",
        );
      if (
        typeof current.value.$ref === "string" &&
        !current.value.$ref.startsWith("#")
      )
        current.value.$ref = new URL(current.value.$ref, file.name).href;
      for (const child of Object.values(current.value))
        if (child && typeof child === "object")
          stack.push({ value: child, depth: current.depth + 1 });
    }
    return {
      isEntrypoint: index === 0,
      filename: file.name,
      dir: "./",
      specification: value,
      references: [],
    };
  });
  const resolved = dereference(filesystem);
  for (const error of resolved.errors || [])
    add("error", error.message || "Unresolved reference");
  const schema = /** @type {Record<string, any>} */ (resolved.schema);
  if (strict.valid && !(resolved.errors || []).length)
    for (const error of validatePathParameters(schema))
      add("error", error.message || "Invalid path parameter");
  const operations = [];
  const identifiers = new Set();
  for (const [path, item] of Object.entries(schema?.paths || {})) {
    if (!item || typeof item !== "object") continue;
    if (item.query || item.additionalOperations)
      add(
        "error",
        "OpenAPI 3.2 QUERY/additionalOperations generation is not supported yet.",
        ["paths", path],
      );
    for (const method of methods)
      if (item[method] && typeof item[method] === "object") {
        const operation = item[method];
        const location = ["paths", path, method];
        if (!operation.summary)
          add("warning", "Operation has no summary.", location);
        if (!operation.operationId)
          add("warning", "Operation has no operationId.", location);
        else if (identifiers.has(operation.operationId))
          add("error", `Duplicate operationId: ${operation.operationId}`, [
            ...location,
            "operationId",
          ]);
        else identifiers.add(operation.operationId);
        operations.push({
          path,
          method,
          summary: operation.summary || operation.operationId || path,
          operation,
          item,
        });
      }
  }
  return {
    schema,
    original: parsed.value,
    diagnostics: diagnostics.slice(0, 500),
    diagnosticCount: diagnostics.length,
    operations,
    valid: !diagnostics.some((item) => item.severity === "error"),
  };
}

/** @param {Record<string, any>} node @param {Record<string, any>} schema */
function example(node, schema) {
  if (Object.hasOwn(node, "example")) return node.example;
  const first = Object.values(node.examples || {})[0];
  if (first && typeof first === "object" && Object.hasOwn(first, "value"))
    return first.value;
  return sample(
    node.schema || node,
    { skipReadOnly: true, quiet: true },
    schema,
  );
}

/** @param {ReturnType<typeof analyzeSpec>} analysis @param {string} workspaceId @param {string} specId @param {string} [serverOverride] */
export function generateRequests(
  analysis,
  workspaceId,
  specId,
  serverOverride = "",
) {
  if (!analysis.valid)
    throw new Error("Resolve specification errors before generating requests.");
  const { schema } = analysis;
  const groupId = id("fld");
  /** @type {Record<string, any>[]} */
  const resources = [
    {
      _id: groupId,
      _type: "request_group",
      parentId: workspaceId,
      name: `${schema.info?.title || "OpenAPI"} · generated`,
      created: Date.now(),
      modified: Date.now(),
    },
  ];
  for (const { path, method, operation, item } of analysis.operations) {
    /** @type {string[]} */
    const issues = [];
    let server = serverOverride;
    if (!server) {
      if (schema.swagger === "2.0") {
        server = `${(operation.schemes || schema.schemes || ["https"])[0]}://${schema.host || ""}${schema.basePath || ""}`;
        if (!schema.host)
          issues.push(
            "Swagger host is missing. Set an absolute server override.",
          );
      } else {
        const selected = (operation.servers ||
          item.servers ||
          schema.servers || [{ url: "/" }])[0];
        server = String(selected?.url || "").replace(
          /\{([^{}]+)\}/g,
          (_, name) => selected.variables?.[name]?.default ?? `{${name}}`,
        );
      }
    }
    try {
      const url = new URL(server);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname)
        throw new Error();
    } catch {
      issues.push("Set an absolute HTTP(S) server URL before sending.");
    }
    const request = newRequest(groupId, {
      name:
        operation.summary ||
        operation.operationId ||
        `${method.toUpperCase()} ${path}`,
      method: method.toUpperCase(),
      url: `${server.replace(/\/$/, "")}${path}`,
      description: operation.description || "",
      sourceSpecId: specId,
      sourceOperation: { path, method },
      pathParameters: [],
    });
    const parameters = new Map();
    for (const parameter of [
      ...(item.parameters || []),
      ...(operation.parameters || []),
    ])
      parameters.set(
        `${parameter.in}:${parameter.in === "header" ? String(parameter.name).toLowerCase() : parameter.name}`,
        parameter,
      );
    for (const parameter of parameters.values()) {
      if (
        schema.swagger !== "2.0" &&
        parameter.in === "header" &&
        ["accept", "content-type", "authorization"].includes(
          String(parameter.name).toLowerCase(),
        )
      )
        continue;
      let value;
      try {
        value = example(parameter, schema);
      } catch (error) {
        issues.push(`Parameter ${parameter.name}: ${error}`);
        value = "";
      }
      const compound = value != null && typeof value === "object";
      const row = /** @type {Record<string,any>} */ ({
        name: parameter.name,
        value: compound ? JSON.stringify(value) : String(value ?? ""),
        disabled: false,
      });
      if (parameter.in === "query" || parameter.in === "header") {
        if (
          (parameter.in === "query" || parameter.in === "header") &&
          schema.swagger !== "2.0" &&
          !parameter.content &&
          !parameter.allowReserved
        ) {
          const style =
            parameter.style || (parameter.in === "query" ? "form" : "simple");
          const serialization = {
            style,
            explode: parameter.explode ?? style === "form",
            kind: compound
              ? Array.isArray(value)
                ? "array"
                : "object"
              : "scalar",
          };
          try {
            (parameter.in === "query"
              ? serializeOpenApiQuery
              : serializeOpenApiHeader)(row.name, row.value, serialization);
            row._openapiSerialization = serialization;
          } catch (error) {
            issues.push(`Parameter ${parameter.name}: ${error}`);
          }
        } else if (
          compound ||
          parameter.content ||
          parameter.allowReserved ||
          (parameter.style &&
            parameter.style !== (parameter.in === "query" ? "form" : "simple"))
        )
          issues.push(
            `Review serialization for ${parameter.in} parameter ${parameter.name}.`,
          );
        (parameter.in === "query" ? request.parameters : request.headers).push(
          row,
        );
      } else if (parameter.in === "path") {
        if (schema.swagger !== "2.0" && !parameter.content) {
          request._openapiPath = true;
          const serialization = {
            style: parameter.style || "simple",
            explode: parameter.explode ?? false,
            kind: compound
              ? Array.isArray(value)
                ? "array"
                : "object"
              : "scalar",
          };
          try {
            serializeOpenApiPath(row.name, row.value, serialization);
            row._openapiSerialization = serialization;
          } catch (error) {
            issues.push(`Parameter ${parameter.name}: ${error}`);
          }
          request.pathParameters.push(row);
          continue;
        }
        if (parameter.content)
          issues.push(
            `Review content serialization for path parameter ${parameter.name}.`,
          );
        if (compound || (parameter.style && parameter.style !== "simple"))
          issues.push(
            `Review serialization for path parameter ${parameter.name}.`,
          );
        const placeholder = `{${parameter.name}}`;
        const segments = request.url.split("/");
        if (!segments.includes(placeholder))
          issues.push(
            `Embedded path parameter ${parameter.name} needs manual URL mapping.`,
          );
        request.url = segments
          .map((/** @type {string} */ segment) =>
            segment === placeholder ? `:${parameter.name}` : segment,
          )
          .join("/");
        request.pathParameters.push(row);
      } else if (parameter.in === "body") {
        request.body = {
          mimeType: (operation.consumes ||
            schema.consumes || ["application/json"])[0],
          text: JSON.stringify(value, null, 2),
        };
        if (!request.body.mimeType.includes("json"))
          issues.push("Review the non-JSON body serialization before sending.");
      } else if (parameter.in === "formData") {
        request.body.mimeType = (operation.consumes ||
          schema.consumes || ["application/x-www-form-urlencoded"])[0];
        request.body.params.push({
          ...row,
          ...(parameter.type === "file" ? { type: "file" } : {}),
        });
      } else issues.push(`Review ${parameter.in} parameter ${parameter.name}.`);
    }
    if (operation.requestBody) {
      const content = operation.requestBody.content || {};
      const mime = Object.hasOwn(content, "application/json")
        ? "application/json"
        : Object.keys(content)[0];
      try {
        const media = content[mime];
        const value = example(media, schema);
        if (
          mime === "multipart/form-data" ||
          mime === "application/x-www-form-urlencoded"
        ) {
          request.body = {
            mimeType: mime,
            params: Object.entries(value || {}).map(([name, value]) => ({
              name,
              value:
                typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value),
              ...(media.schema?.properties?.[name]?.format === "binary"
                ? { type: "file" }
                : {}),
            })),
          };
          if (
            media.encoding ||
            Object.values(value || {}).some(
              (value) => value && typeof value === "object",
            )
          )
            issues.push("Review form field encoding before sending.");
        } else if (media.schema?.format === "binary")
          request.body = { mimeType: "application/octet-stream" };
        else
          request.body = {
            mimeType: mime || "application/json",
            text:
              typeof value === "string" && !mime?.includes("json")
                ? value
                : JSON.stringify(value, null, 2),
          };
        if (
          !mime?.includes("json") &&
          ![
            "multipart/form-data",
            "application/x-www-form-urlencoded",
          ].includes(mime) &&
          typeof value !== "string" &&
          media.schema?.format !== "binary"
        )
          issues.push("Review the non-JSON body serialization before sending.");
      } catch (error) {
        issues.push(`Request body needs an example: ${error}`);
      }
    }
    const security = operation.security ?? schema.security ?? [];
    if (
      security.length &&
      !security.some(
        (/** @type {any} */ choice) => Object.keys(choice).length === 0,
      )
    ) {
      const choice = security[0];
      const names = Object.keys(choice);
      if (names.length !== 1)
        issues.push(
          "Multiple authentication schemes must be configured together.",
        );
      const scheme = (schema.components?.securitySchemes ||
        schema.securityDefinitions ||
        {})[names[0]];
      if (
        scheme?.type === "basic" ||
        (scheme?.type === "http" && scheme.scheme === "basic")
      )
        request.authentication = {
          type: "basic",
          username: "{{ _.username }}",
          password: "{{ _.password }}",
        };
      else if (scheme?.type === "http" && scheme.scheme === "bearer")
        request.authentication = {
          type: "bearer",
          token: "{{ _.access_token }}",
        };
      else if (
        scheme?.type === "apiKey" &&
        ["header", "query", "cookie"].includes(scheme.in)
      )
        request.authentication = {
          type: "apikey",
          key: scheme.name,
          value: "{{ _.api_key }}",
          addTo: scheme.in === "query" ? "queryParams" : scheme.in,
        };
      else
        issues.push(
          `Configure the ${scheme?.type || "unknown"} authentication scheme before sending.`,
        );
    }
    request._openapiIssues = issues;
    resources.push(request);
  }
  return resources;
}
