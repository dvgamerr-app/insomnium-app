import { duplicateResource } from "./resources.js";
import { id, indexWorkspaces } from "./model.js";
import { checkTemplateValue } from "./template-object.js";

/** @param {string} path @param {string|number} key */
export function environmentOrderPath(path, key) {
  const segment = String(key);
  return path + "~|" + (path.startsWith("$v2") ? segment.replaceAll("~", "~0").replaceAll("|", "~1") : segment);
}

/** Stable imported ordering; Base remains first and absent sort keys retain input order.
 * @param {Record<string,any>[]} resources @param {string} workspaceId */
export function orderedEnvironments(resources, workspaceId) {
  return resources
    .map((resource, index) => ({ resource, index }))
    .sort(
      (a, b) =>
        Number(b.resource.parentId === workspaceId) -
          Number(a.resource.parentId === workspaceId) ||
        (Number.isFinite(a.resource.metaSortKey)
          ? a.resource.metaSortKey
          : a.index) -
          (Number.isFinite(b.resource.metaSortKey)
            ? b.resource.metaSortKey
            : b.index) ||
        a.index - b.index,
    )
    .map((row) => row.resource);
}
/** Preserve explicit order when presenting imported JSON, including numeric keys.
 * @param {Record<string,any>} data @param {Record<string,any>|null|undefined} order */
export function environmentEditorText(data, order) {
  checkTemplateValue(data);
  checkTemplateValue(order);
  const json = JSON.parse(JSON.stringify(data));
  /** @param {any} value @param {string} path @param {number} depth @returns {string} */
  function serialize(value, path, depth) {
    if (value === null || typeof value !== "object")
      return JSON.stringify(value);
    const indent = "  ".repeat(depth),
      childIndent = indent + "  ";
    if (Array.isArray(value))
      return value.length
        ? "[\n" +
            value
              .map(
                (item, index) =>
                  childIndent + serialize(item, environmentOrderPath(path, index), depth + 1),
              )
              .join(",\n") +
            "\n" +
            indent +
            "]"
        : "[]";
    const specified =
      order && Object.hasOwn(order, path) && Array.isArray(order[path])
        ? order[path]
        : [];
    const keys = [
      ...new Set([
        ...specified.filter(
          (/** @type {any} */ key) =>
            typeof key === "string" && Object.hasOwn(value, key),
        ),
        ...Object.keys(value),
      ]),
    ];
    return keys.length
      ? "{\n" +
          keys
            .map(
              (key) =>
                childIndent +
                JSON.stringify(key) +
                ": " +
                serialize(value[key], environmentOrderPath(path, key), depth + 1),
            )
            .join(",\n") +
          "\n" +
          indent +
          "}"
      : "{}";
  }
  return serialize(json, Array.isArray(order?.$v2) ? "$v2" : "$", 0);
}
/** Parse valid JSON once, retaining the actual textual order at every object path.
 * JSON.parse validates tokens; the scanner only records their existing positions.
 * @param {string} text @param {string} [objectError] */
export function parseEnvironmentEditor(text, objectError = "Environment must be a JSON object") {
  const data = JSON.parse(text);
  if (!data || Array.isArray(data) || typeof data !== "object")
    throw new Error(objectError);
  checkTemplateValue(data);
  /** @type {Record<string,string[]>} */
  const dataPropertyOrder = Object.create(null);
  const pending = [data];
  let escaped = false;
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, child] of Object.entries(current)) {
      if (key.includes("~|")) escaped = true;
      if (child && typeof child === "object") pending.push(child);
    }
  }
  let at = 0;
  const whitespace = () => {
    while (/\s/.test(text[at] || "") && at < text.length) at++;
  };
  const string = () => {
    const start = at++;
    while (at < text.length) {
      if (text[at] === "\\") {
        at += 2;
        continue;
      }
      if (text[at++] === '"') break;
    }
    return JSON.parse(text.slice(start, at));
  };
  /** @param {string} path */
  function value(path) {
    whitespace();
    if (text[at] === "{") {
      at++;
      whitespace();
      const keys = /** @type {string[]} */ ([]);
      while (text[at] !== "}") {
        const key = string();
        if (!keys.includes(key)) keys.push(key);
        whitespace();
        at++;
        value(environmentOrderPath(path, key));
        whitespace();
        if (text[at] !== ",") break;
        at++;
        whitespace();
      }
      at++;
      Object.defineProperty(dataPropertyOrder, path, {
        value: keys,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else if (text[at] === "[") {
      at++;
      whitespace();
      let index = 0;
      while (text[at] !== "]") {
        value(environmentOrderPath(path, index++));
        whitespace();
        if (text[at] !== ",") break;
        at++;
        whitespace();
      }
      at++;
    } else if (text[at] === '"') string();
    else while (at < text.length && !/[\s,}\]]/.test(text[at])) at++;
  }
  value(escaped ? "$v2" : "$");
  return { data, dataPropertyOrder };
}
/** @param {Record<string,any>[]} environments @param {string} parentId @param {string} name @param {boolean} isPrivate */
export function newEnvironment(
  environments,
  parentId,
  name,
  isPrivate = false,
) {
  if (!name.trim()) throw new Error("Enter an environment name");
  let maximum = 0;
  for (const row of environments)
    if (Number.isFinite(row.metaSortKey)) maximum = Math.max(maximum, row.metaSortKey);
  return {
    _id: id("env"),
    _type: "environment",
    parentId,
    name: name.trim(),
    data: {},
    dataPropertyOrder: null,
    color: null,
    isPrivate: isPrivate === true,
    metaSortKey: maximum + 100,
    created: Date.now(),
    modified: Date.now(),
  };
}
/** @param {Record<string,any>[]} resources @param {string} environmentId @param {string} baseId */
export function duplicateEnvironment(resources, environmentId, baseId) {
  const original = resources.find(
    (row) => row._id === environmentId && row._type === "environment",
  );
  if (!original || environmentId === baseId)
    throw new Error("Choose a sub-environment to duplicate");
  const copyId = duplicateResource(resources, environmentId);
  const copy = resources.find((row) => row._id === copyId);
  if (!copy) throw new Error("Environment copy was not created");
  // Legacy duplicate preserves ancestry and places the sibling after its source.
  const key = Number.isFinite(original.metaSortKey)
    ? original.metaSortKey
    : resources.indexOf(original);
  let next = Infinity;
  for (const row of resources)
    if (row._type === "environment" && row._id !== copyId && row.parentId === original.parentId && Number.isFinite(row.metaSortKey) && row.metaSortKey > key)
      next = Math.min(next, row.metaSortKey);
  const candidate = Number.isFinite(next) ? key / 2 + next / 2 : key + 100;
  if (!Number.isFinite(candidate) || candidate <= key || candidate >= next) {
    const owners = indexWorkspaces(resources), owner = owners.get(environmentId);
    const rows = orderedEnvironments(resources.filter(row => row._type === "environment" && row._id !== baseId && row._id !== copyId &&
      (owner ? owners.get(row._id) === owner : row.parentId === original.parentId)), owner || "");
    rows.splice(rows.indexOf(original) + 1, 0, copy);
    rows.forEach((row, index) => { row.metaSortKey = (index + 1) * 100; row.modified = Date.now(); });
  } else copy.metaSortKey = candidate;
  return copyId;
}
/** Change only the selected sub-environment's sort/time; never mutate Base/unrelated owners.
 * @param {Record<string,any>[]} environments @param {string} environmentId @param {string} workspaceId @param {number} direction */
export function reorderEnvironment(
  environments,
  environmentId,
  workspaceId,
  direction,
) {
  const rows = orderedEnvironments(environments, workspaceId).filter(
      (row) => row.parentId !== workspaceId,
    ),
    index = rows.findIndex((row) => row._id === environmentId),
    target = index + Math.sign(direction);
  if (index < 0 || target < 0 || target >= rows.length) return;
  // Imported ties/missing keys need a strict numeric sequence before inserting.
  // Only this collection's sub-environments normalize; Base remains untouched.
  if (
    rows.some(
      (row, index) =>
        !Number.isFinite(row.metaSortKey) ||
        (index > 0 && row.metaSortKey <= rows[index - 1].metaSortKey),
    )
  )
    rows.forEach((row, index) => {
      row.metaSortKey = (index + 1) * 100;
      row.modified = Date.now();
    });
  const before = rows.map((row, index) => ({
      row,
      key: Number.isFinite(row.metaSortKey) ? row.metaSortKey : index,
    })),
    moving = before.splice(index, 1)[0];
  const previous = before[target - 1]?.key,
    next = before[target]?.key;
  const key =
    previous === undefined
      ? next - 100
      : next === undefined
        ? previous + 100
        : previous / 2 + next / 2;
  if (!Number.isFinite(key) || (previous !== undefined && key <= previous) || (next !== undefined && key >= next)) {
    before.splice(target, 0, moving);
    before.forEach(({row}, index) => { row.metaSortKey = (index + 1) * 100; row.modified = Date.now(); });
    return;
  }
  moving.row.metaSortKey = key;
  moving.row.modified = Date.now();
}
