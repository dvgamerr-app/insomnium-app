export const fontPreferencesEvent = "insomnium:font-preferences-changed";

/** Font names are CSS values, never stylesheet markup or downloadable font URLs.
 * Empty/null resets to the existing application/theme font.
 * @param {unknown} value @returns {string|null} */
export function checkedFontFamily(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 1024 || /[\x00-\x1f\x7f-\x9f]/.test(value))
    throw new Error("Enter a font family list of at most 1024 characters.");
  const family = value.trim();
  if (!family) return null;
  if (typeof CSS !== "undefined" && !CSS.supports("font-family",family))
    throw new Error("Enter a valid comma-separated CSS font family list.");
  return family;
}

/** @param {unknown} value */
export function interfaceFontSize(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 8 && value <= 24 ? value : 12;
}

/** Resolve damaged persisted preferences without changing the default appearance.
 * @param {Record<string,any>} settings */
export function fontPreferenceVariables(settings) {
  /** @type {Record<string,string>} */ const variables = {};
  for (const [key,variable] of [["fontInterface","--font-sans"],["fontMonospace","--font-mono"]]) {
    try { variables[variable] = checkedFontFamily(settings[key]) || ""; }
    catch { variables[variable] = ""; }
  }
  variables["--font-ligatures"] = settings.fontVariantLigatures === false ? "none" : "";
  const size = interfaceFontSize(settings.fontSize);
  for (const base of [9,10,11,12,13,15,16,18])
    variables["--font-size-" + base] = size === 12 ? "" : (base * size / 12) + "px";
  return variables;
}

/** Apply through CSSOM so a family string cannot create another declaration.
 * Restore only the properties owned by this effect on replacement/unmount.
 * @param {CSSStyleDeclaration} style @param {Record<string,any>} settings */
export function applyFontPreferences(style,settings) {
  const variables = fontPreferenceVariables(settings);
  const previous = Object.keys(variables).map(key => ({key,value:style.getPropertyValue(key),priority:style.getPropertyPriority(key)}));
  for (const [key,value] of Object.entries(variables)) {
    if (value) style.setProperty(key,value); else style.removeProperty(key);
  }
  return () => {
    for (const {key,value,priority} of previous) {
      if (value) style.setProperty(key,value,priority); else style.removeProperty(key);
    }
  };
}
