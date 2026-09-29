import { workspaceFor } from "./model.js";
import {
  checkTemplateValue,
  renderTemplateValue,
  TemplateLimitError,
} from "./template-object.js";

/** @param {any} value */
const plain = (value) =>
  value !== null && Object.prototype.toString.call(value) === "[object Object]";
/** @param {Record<string,any>} value */
const keysFor = (value) =>
  Object.keys(value).sort(
    (a, b) =>
      Number(typeof value[a] === "string" && /{{|{%/.test(value[a])) -
      Number(typeof value[b] === "string" && /{{|{%/.test(value[b])),
  );
/** @param {Record<string,any>} object @param {string} key @param {any} value */
const put = (object, key, value) =>
  Object.defineProperty(object, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });

/** Preserve every own key even when a saved property map is stale/incomplete.
 * @param {Record<string,any>} data @param {Record<string,any>|null|undefined} order
 */
export function orderEnvironment(data, order) {
  checkTemplateValue(data);
  checkTemplateValue(order);
  /** @param {any} value @param {string} path @returns {any} */
  function visit(value, path) {
    if (Array.isArray(value))
      return value.map((item, i) => visit(item, path + "~|" + i));
    if (!plain(value)) return value;
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
    return Object.fromEntries(
      keys.map((key) => [key, visit(value[key], path + "~|" + key)]),
    );
  }
  return visit(structuredClone(data), "$");
}

/** Base, selected ancestry, then outer-to-inner folder layers. null means no resource context.
 * @param {Record<string,any>[]} resources @param {string} requestId @param {string|null|undefined} environmentId
 * @returns {{data:Record<string,any>,order?:Record<string,any>|null}[]|null}
 */
export function requestEnvironmentLayers(resources, requestId, environmentId) {
  const workspaceId = workspaceFor(resources, requestId);
  if (!workspaceId) return null;
  const base = resources.find(
    (r) => r._type === "environment" && r.parentId === workspaceId,
  );
  const environments = [];
  const seen = new Set();
  let selected = resources.find((r) => r._id === environmentId);
  if (selected && workspaceFor(resources, selected._id) !== workspaceId)
    selected = undefined;
  while (selected?._type === "environment") {
    if (seen.has(selected._id))
      throw new TemplateLimitError("Cyclic environment ancestry");
    seen.add(selected._id);
    environments.unshift(selected);
    selected = resources.find((r) => r._id === selected?.parentId);
  }
  if (base && !seen.has(base._id)) environments.unshift(base);
  const layers = environments.map((r) => ({
    data: plain(r.data) ? r.data : {},
    order: r.dataPropertyOrder,
  }));
  const groups = [];
  let current = resources.find((r) => r._id === requestId);
  seen.clear();
  while (current && current._type !== "workspace") {
    if (seen.has(current._id))
      throw new TemplateLimitError("Cyclic folder ancestry");
    seen.add(current._id);
    current = resources.find((r) => r._id === current?.parentId);
    if (current?._type === "request_group") groups.unshift(current);
  }
  for (const group of groups)
    if (plain(group.environment))
      layers.push({
        data: group.environment,
        order: group.environmentPropertyOrder,
      });
  if (layers.length > 128)
    throw new TemplateLimitError("Too many environment layers");
  return layers;
}

/** Legacy merge followed by three bounded, sequential self-render passes.
 * @param {{data:Record<string,any>,order?:Record<string,any>|null}[]} layers
 * @param {(text:string,context:Record<string,any>,path:string)=>Promise<string>} render
 * @param {AbortSignal} signal
 * @returns {Promise<Record<string,any>>}
 */
export async function buildTemplateEnvironment(layers, render, signal) {
  signal.throwIfAborted();
  if (layers.length > 128)
    throw new TemplateLimitError("Too many environment layers");
  checkTemplateValue(layers);
  /** @type {Record<string,any>} */
  const context = {};
  /** @param {any} value @param {Record<string,any>} current @param {string} path */
  const renderValue = (value, current, path) =>
    renderTemplateValue(value, (text, field) => render(text, current, field), {
      signal,
      path,
      keepOnError: true,
    });
  /** @param {Record<string,any>} incoming @param {Record<string,any>} current @param {string} path */
  async function merge(incoming, current, path) {
    for (const key of keysFor(incoming)) {
      signal.throwIfAborted();
      let value = incoming[key];
      const field = path + "." + key;
      if (typeof value === "string") {
        const escaped = key.replace(/[.*+?^$()|{}[\]\\]/g, "\\$&");
        if (new RegExp("{{ ?" + escaped + "[ |][^}]*}}").test(value))
          value = await renderValue(value, current, field);
      } else if (
        plain(value) &&
        Object.hasOwn(current, key) &&
        plain(current[key])
      ) {
        await merge(value, current[key], field);
        continue;
      }
      put(current, key, value);
    }
  }
  for (const layer of layers) {
    if (!plain(layer.data))
      throw new Error("Environment data must be an object");
    await merge(
      orderEnvironment(layer.data, layer.order),
      context,
      "Environment",
    );
  }
  const keys = keysFor(context);
  const unchanged = new Set();
  for (let pass = 0; pass < 3; pass++) {
    for (const key of keys) {
      if (unchanged.has(key)) continue;
      const result = await renderValue(
        context[key],
        context,
        "Environment." + key,
      );
      if (result === context[key]) unchanged.add(key);
      else put(context, key, result);
    }
    checkTemplateValue(context);
  }
  signal.throwIfAborted();
  return context;
}
