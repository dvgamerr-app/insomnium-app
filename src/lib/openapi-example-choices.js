import { isOpenApiJsonMediaType } from "./openapi-content.js";
import { isJsonBodyMediaType } from "./media-type.js";

/** @typedef {{path:string,method:string,additional?:boolean,operation:Record<string,any>,item:Record<string,any>}} Operation */
/** @typedef {{name:string|null,level?:string,mediaType?:string}} ExampleChoice */

/** Keep operation overrides and header case folding identical in menus/generation.
 * @param {Operation} operation */
export function effectiveParameters(operation) {
  const parameters = new Map();
  for (const parameter of [
    ...(operation.item.parameters || []),
    ...(operation.operation.parameters || []),
  ])
    parameters.set(
      `${parameter.in}:${parameter.in === "header" ? String(parameter.name).toLowerCase() : parameter.name}`,
      parameter,
    );
  return [...parameters.values()];
}

/** @param {Operation} operation @param {string[]} location */
export function exampleChoiceKey(operation, ...location) {
  return JSON.stringify([
    operation.path,
    operation.method,
    !!operation.additional,
    ...location,
  ]);
}

/** @param {Record<string,any>} content */
export function preferredBodyMedia(content) {
  return Object.hasOwn(content, "application/json")
    ? "application/json"
    : Object.keys(content).find(isOpenApiJsonMediaType) ||
        Object.keys(content).find(isJsonBodyMediaType) ||
        Object.keys(content)[0];
}

/** @param {Record<string,any>|undefined} node */
function namedExamples(node) {
  return node?.examples &&
    !Array.isArray(node.examples) &&
    typeof node.examples === "object"
    ? Object.entries(node.examples).map(([name, value]) => ({
        name,
        summary: typeof value?.summary === "string" ? value.summary : "",
      }))
    : [];
}

/** UI/catalog identities follow effective request fields, never response/schema data.
 * @param {Operation} operation @param {Record<string,any>} schema */
export function operationExampleGroups(operation, schema) {
  if (schema.swagger === "2.0") return [];
  /** @type {{key:string,label:string,kind:string,options:{name:string,summary:string,level?:string,mediaType?:string}[],mediaTypes?:string[],defaultMediaType?:string}[]} */
  const groups = [];
  for (const parameter of effectiveParameters(operation)) {
    if (
      !["query", "querystring", "header", "path", "cookie"].includes(
        parameter.in,
      )
    )
      continue;
    if (
      parameter.in === "header" &&
      ["accept", "content-type", "authorization"].includes(
        String(parameter.name).toLowerCase(),
      )
    )
      continue;
    const media = Object.entries(parameter.content || {})[0];
    const options = [
      ...namedExamples(parameter).map((option) => ({
        ...option,
        level: "parameter",
      })),
      ...namedExamples(media?.[1]).map((option) => ({
        ...option,
        level: "media",
      })),
    ];
    if (options.length)
      groups.push({
        key: exampleChoiceKey(
          operation,
          "parameter",
          parameter.in,
          parameter.in === "header"
            ? String(parameter.name).toLowerCase()
            : parameter.name,
        ),
        label: `${parameter.in[0].toUpperCase()}${parameter.in.slice(1)} ${parameter.name} example`,
        kind: "parameter",
        options,
      });
  }
  const content = operation.operation.requestBody?.content || {};
  const mediaTypes = Object.keys(content);
  const options = mediaTypes.flatMap((mediaType) =>
    namedExamples(content[mediaType]).map((option) => ({
      ...option,
      mediaType,
    })),
  );
  if (mediaTypes.length > 1 || options.length)
    groups.push({
      key: exampleChoiceKey(operation, "body"),
      label: "Body example",
      kind: "body",
      options,
      mediaTypes,
      defaultMediaType: preferredBodyMedia(content),
    });
  return groups;
}

/** Refuse stale/foreign choices before constructing any request resources.
 * @param {{schema:Record<string,any>,operations:Operation[]}} analysis
 * @param {Record<string,ExampleChoice>} selections */
export function validateExampleChoices(analysis, selections) {
  if (
    !selections ||
    typeof selections !== "object" ||
    Array.isArray(selections)
  )
    throw Error("Example choices require an object.");
  if (
    Object.keys(selections).length > 10000 ||
    new TextEncoder().encode(JSON.stringify(selections)).byteLength >
      1024 * 1024
  )
    throw Error("Example choices exceed 10000 entries or 1 MiB.");
  if (!Object.keys(selections).length) return;
  const groups = new Map(
    analysis.operations
      .flatMap((operation) =>
        operationExampleGroups(operation, analysis.schema),
      )
      .map((group) => [group.key, group]),
  );
  for (const [key, choice] of Object.entries(selections)) {
    const group = groups.get(key);
    if (!group)
      throw Error(
        "A saved example choice no longer matches this document. Reset example choices.",
      );
    const error = exampleChoiceError(group, choice);
    if (error) throw Error(`${group.label}: ${error}`);
  }
}

/** @param {ReturnType<typeof operationExampleGroups>[number]} group
 * @param {ExampleChoice|undefined} choice */
export function exampleChoiceError(group, choice) {
  if (choice === undefined) return "";
  const body = group.kind === "body";
  if (
    !choice ||
    typeof choice !== "object" ||
    Array.isArray(choice) ||
    Object.keys(choice).some(
      (field) => !["name", body ? "mediaType" : "level"].includes(field),
    ) ||
    (body
      ? !group.mediaTypes?.includes(choice.mediaType || "")
      : !["parameter", "media"].includes(choice.level || "")) ||
    (choice.name !== null && typeof choice.name !== "string") ||
    (!body && choice.name === null) ||
    (choice.name !== null &&
      !group.options.some(
        (option) =>
          option.name === choice.name &&
          (body
            ? option.mediaType === choice.mediaType
            : option.level === choice.level),
      ))
  ) {
    return "Saved choice is unavailable. Choose another example or reset choices.";
  }
  return "";
}

/** Shallow selection keeps shared refs/source objects and bytes untouched.
 * @param {Record<string,any>} node @param {string} name */
function chooseNamed(node, name) {
  if (!Object.hasOwn(node.examples || {}, name))
    throw Error(`Named example ${name} is unavailable.`);
  return {
    ...node,
    examples: Object.fromEntries([[name, node.examples[name]]]),
  };
}

/** @param {Record<string,any>} node */
function withoutExamples(node) {
  const { example, examples, ...rest } = node;
  return rest;
}

/** @param {Operation} operation @param {Record<string,any>} parameter
 * @param {Record<string,ExampleChoice>} selections */
export function selectedParameterExamples(operation, parameter, selections) {
  const key = exampleChoiceKey(
    operation,
    "parameter",
    parameter.in,
    parameter.in === "header"
      ? String(parameter.name).toLowerCase()
      : parameter.name,
  );
  const choice = selections[key];
  if (!choice) return parameter;
  const [mediaType, media] = Object.entries(parameter.content || {})[0] || [];
  if (choice.level === "parameter")
    return {
      ...chooseNamed(parameter, String(choice.name)),
      ...(media
        ? {
            content: {
              ...parameter.content,
              [mediaType]: withoutExamples(media),
            },
          }
        : {}),
    };
  return {
    ...withoutExamples(parameter),
    content: {
      ...parameter.content,
      [mediaType]: chooseNamed(media, String(choice.name)),
    },
  };
}

/** @param {Operation} operation @param {Record<string,ExampleChoice>} selections */
export function selectedBodyExample(operation, selections) {
  const content = operation.operation.requestBody?.content || {};
  const choice = selections[exampleChoiceKey(operation, "body")];
  const mime = choice?.mediaType || preferredBodyMedia(content);
  return {
    mime,
    media:
      choice?.name != null
        ? chooseNamed(content[mime], choice.name)
        : content[mime],
  };
}
