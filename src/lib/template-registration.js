export const nativeTemplateNames = [
  "os",
  "file",
  "cookie",
  "prompt",
  "response",
  "request",
];
export const builtinTemplateNames = [
  "base64",
  "now",
  "uuid",
  "hash",
  "jsonpath",
  ...nativeTemplateNames,
];

/** Declared registration names remain data. Nunjucks decides which names are
 * usable symbol tokens; an unparseable declaration must not break other tags.
 * Compiler extension keys are generated separately from public names.
 * @param {any} value */
export function isTemplateTagName(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}
