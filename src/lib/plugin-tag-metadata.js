/** Data-only tag definitions and explicitly requested guest metadata callbacks.
 * This factory is also embedded inside QuickJS; it has no host dependencies. */
export function createPluginTagMetadata() {
  const types = [
    "string",
    "number",
    "boolean",
    "variable",
    "expression",
    "enum",
    "file",
    "model",
  ];
  const fail = () => {
    throw TypeError("Invalid plugin template tag metadata");
  };
  /** @param {any} object @param {string} key */
  const get = (object, key) => {
    const property = Object.getOwnPropertyDescriptor(object, key);
    if (!property) return undefined;
    if (!Object.hasOwn(property, "value")) return fail();
    return property.value;
  };
  /** @param {any} value */
  const object = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail();
    return value;
  };
  /** @param {any} value @param {number} [limit] */
  const string = (value, limit = 8192) => {
    if (typeof value !== "string" || value.length > limit) fail();
    return value;
  };
  /** @param {any} value */
  const primitive = (value) => {
    if (
      !["string", "number", "boolean"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value)) ||
      (typeof value === "string" && value.length > 8192)
    )
      fail();
    return value;
  };
  /** @param {any} value @param {number} max */
  const array = (value, max) => {
    if (!Array.isArray(value) || value.length > max) fail();
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, String(i))) fail();
      get(value, String(i));
    }
    return value;
  };
  /** @param {any} source @param {any} result @param {string[]} fields */
  function texts(source, result, fields) {
    for (const key of fields) {
      const value = get(source, key);
      if (value !== undefined) result[key] = string(value);
    }
  }
  /** @param {any} source @param {any} result @param {string[]} fields */
  function callbacks(source, result, fields) {
    const names = [];
    for (const key of fields) {
      const value = get(source, key);
      if (typeof value === "function") names.push(key);
      else if (value !== undefined) {
        if (!["displayName", "help"].includes(key)) fail();
        result[key] = string(value);
      }
    }
    if (names.length) result.callbacks = names;
  }
  /** @param {any} source @param {number} index */
  function argument(source, index) {
    object(source);
    const type = get(source, "type");
    if (!types.includes(type)) fail();
    const result = /** @type {Record<string,any>} */ ({ index, type });
    texts(source, result, ["description", "placeholder", "model"]);
    callbacks(source, result, ["displayName", "help", "hide", "validate"]);
    for (const key of ["value", "defaultValue"]) {
      const value = get(source, key);
      if (value !== undefined) result[key] = primitive(value);
    }
    const forceVariable = get(source, "forceVariable");
    if (forceVariable !== undefined) {
      if (typeof forceVariable !== "boolean") fail();
      result.forceVariable = forceVariable;
    }
    for (const [key, allowed] of [
      ["encoding", ["base64"]],
      ["quotedBy", ["'", '"']],
    ]) {
      const value = get(source, /** @type {string} */ (key));
      if (value !== undefined) {
        if (!allowed.includes(value)) fail();
        result[/** @type {string} */ (key)] = value;
      }
    }
    for (const key of ["itemTypes", "extensions"]) {
      const value = get(source, key);
      if (value !== undefined)
        result[key] = array(value, 64).map((/** @type {any} */ entry) => {
          if (key === "itemTypes" && !["file", "directory"].includes(entry))
            fail();
          return string(entry, 256);
        });
    }
    const options = get(source, "options");
    if (options !== undefined)
      result.options = array(options, 256).map(
        (/** @type {any} */ entry, /** @type {number} */ optionIndex) => {
          object(entry);
          const option = /** @type {Record<string,any>} */ ({
            index: optionIndex,
            value: primitive(get(entry, "value")),
          });
          texts(entry, option, ["description", "placeholder"]);
          callbacks(entry, option, ["displayName"]);
          return option;
        },
      );
    return result;
  }
  /** @param {any} tag */
  function inspect(tag) {
    object(tag);
    const name = string(get(tag, "name"), 256);
    if (!name || typeof get(tag, "run") !== "function")
      throw Error("Template tag requires name and run");
    const result = /** @type {Record<string,any>} */ ({
      name,
      args: array(get(tag, "args") ?? [], 32).map(argument),
    });
    texts(tag, result, ["description", "label"]);
    callbacks(tag, result, [
      "displayName",
      "liveDisplayName",
      "disablePreview",
      "validate",
    ]);
    const deprecated = get(tag, "deprecated"),
      priority = get(tag, "priority");
    if (deprecated !== undefined) {
      if (typeof deprecated !== "boolean") fail();
      result.deprecated = deprecated;
    }
    if (priority !== undefined) {
      if (typeof priority !== "number" || !Number.isFinite(priority)) fail();
      result.priority = priority;
    }
    const actions = get(tag, "actions");
    if (actions !== undefined)
      result.actions = array(actions, 64).map(
        (/** @type {any} */ entry, /** @type {number} */ index) => {
          object(entry);
          if (typeof get(entry, "run") !== "function") fail();
          const action = /** @type {Record<string,any>} */ ({
            index,
            name: string(get(entry, "name"), 1024),
          });
          texts(entry, action, ["icon"]);
          return action;
        },
      );
    return result;
  }
  /** @param {any} source @param {any} result @param {any[]} args */
  function resolveCallbacks(source, result, args) {
    for (const key of result.callbacks ?? []) {
      if (key === "validate") continue;
      const value = get(source, key).call(source, args);
      if (["hide", "disablePreview"].includes(key)) {
        if (typeof value !== "boolean") fail();
      } else string(value);
      result[key] = value;
    }
  }
  /** @param {any} tag @param {any[]} args @param {string[]|undefined} [validationValues] @param {any} [value] */
  function resolve(tag, args, validationValues, value) {
    array(args, 32);
    for (const arg of args) {
      object(arg);
      if (!types.includes(get(arg, "type"))) fail();
      const value = get(arg, "value");
      if (value !== undefined) primitive(value);
    }
    const result = inspect(tag);
    if (validationValues !== undefined) {
      array(validationValues, 32);
      if (validationValues.length !== result.args.length) fail();
      validationValues.forEach((value) => string(value));
    }
    resolveCallbacks(tag, result, args);
    if (arguments.length >= 4 && result.callbacks?.includes("validate")) {
      const error = get(tag, "validate").call(tag, value);
      if (error !== undefined && error !== null) string(error);
      result.validationError = error ?? null;
    }
    result.args.forEach(
      (/** @type {any} */ arg, /** @type {number} */ index) => {
        const source = get(get(tag, "args"), String(index));
        resolveCallbacks(source, arg, args);
        arg.options?.forEach(
          (/** @type {any} */ option, /** @type {number} */ optionIndex) =>
            resolveCallbacks(
              get(get(source, "options"), String(optionIndex)),
              option,
              args,
            ),
        );
        if (
          validationValues !== undefined &&
          arg.callbacks?.includes("validate")
        ) {
          const error = get(source, "validate").call(
            source,
            validationValues[index],
          );
          if (error !== undefined && error !== null) string(error);
          arg.validationError = error ?? null;
        }
      },
    );
    return result;
  }
  return { inspect, resolve };
}
