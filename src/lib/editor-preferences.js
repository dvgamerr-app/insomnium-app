/** Preserve the existing appearance for absent or damaged preferences.
 * @param {unknown} value */
export function editorFontSize(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 8 && value <= 24 ? value : 12;
}
