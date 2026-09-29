/** Limits apply even to disabled/blacklisted values before cloning. */
export class TemplateLimitError extends Error {
  constructor(message = "Template value exceeds render limits") {
    super(message);
    this.name = "TemplateLimitError";
  }
}

/** @param {unknown} input */
export function checkTemplateValue(input) {
  let nodes = 0;
  let characters = 0;
  const ancestors = new Set();
  /** @param {any} value @param {number} depth */
  function visit(value, depth) {
    if (++nodes > 10000 || depth > 64) throw new TemplateLimitError();
    if (typeof value === "string") characters += value.length;
    if (characters > 20 * 1024 * 1024) throw new TemplateLimitError();
    if (!value || typeof value !== "object") return;
    if (ancestors.has(value))
      throw new TemplateLimitError("Cyclic template data");
    ancestors.add(value);
    for (const key of Object.keys(value)) {
      characters += key.length;
      visit(value[key], depth + 1);
    }
    ancestors.delete(value);
  }
  visit(input, 0);
}

/** @param {unknown} error */
export function isRenderInterruption(error) {
  return (
    error instanceof TemplateLimitError ||
    (error instanceof Error &&
      ["AbortError", "TimeoutError"].includes(error.name))
  );
}

/** @param {unknown} error @param {string} path */
export function templateFieldError(error, path) {
  const message = error instanceof Error ? error.message : String(error);
  const match = /\[Line (\d+), Column (\d+)\]/i.exec(message);
  const detail = message
    .replace(/\(unknown path\)\s*/g, "")
    .replace(/\[Line \d+, Column \d+\]\s*/gi, "")
    .trim();
  return Object.assign(new Error((path ? path + ": " : "") + detail), {
    name: "TemplateRenderError",
    type: "render",
    path,
    reason: /undefined|null value/i.test(message) ? "undefined" : "error",
    location: match
      ? { line: Number(match[1]), column: Number(match[2]) }
      : null,
  });
}

/** Clone and render values sequentially, retaining legacy paths/disabled semantics.
 * @param {any} input
 * @param {(text:string,path:string)=>Promise<string>} render
 * @param {{signal:AbortSignal,path?:string,keepOnError?:boolean,blacklist?:RegExp|null}} options
 * @returns {Promise<any>}
 */
export async function renderTemplateValue(input, render, options) {
  options.signal.throwIfAborted();
  checkTemplateValue(input);
  const cloned = structuredClone(input);
  let characters = 0;
  /** @param {any} value @param {string} path @param {boolean} first @returns {Promise<any>} */
  async function next(value, path, first = false) {
    options.signal.throwIfAborted();
    if (options.blacklist) {
      options.blacklist.lastIndex = 0;
      if (options.blacklist.test(path)) return value;
    }
    if (typeof value === "string") {
      try {
        const containsTemplate = (/** @type {string} */ text) =>
          /{{[\s\S]*?}}|{%[\s\S]*?%}|{#[\s\S]*?#}/.test(text);
        if (containsTemplate(value)) value = await render(value, path);
        options.signal.throwIfAborted();
        if (value.includes("{%") && containsTemplate(value))
          value = await render(value, path);
        options.signal.throwIfAborted();
      } catch (error) {
        options.signal.throwIfAborted();
        if (isRenderInterruption(error)) throw error;
        if (!options.keepOnError) throw templateFieldError(error, path);
      }
      characters += value.length;
      if (characters > 20 * 1024 * 1024) throw new TemplateLimitError();
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++)
        value[i] = await next(value[i], path + "[" + i + "]");
    } else if (
      value &&
      Object.prototype.toString.call(value) === "[object Object]"
    ) {
      if (value.disabled) return value;
      for (const key of Object.keys(value)) {
        const childPath =
          first && key.startsWith("_") ? path : (path ? path + "." : "") + key;
        Object.defineProperty(value, key, {
          value: await next(value[key], childPath),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    return value;
  }
  const result = await next(cloned, options.path || "", true);
  options.signal.throwIfAborted();
  checkTemplateValue(result);
  return result;
}
