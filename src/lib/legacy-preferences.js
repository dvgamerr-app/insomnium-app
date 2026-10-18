/** Compatible, explicitly reviewed preferences. Source records remain portable.
 * @param {Record<string,any>[]} resources */
export function legacyPreferenceCandidate(resources) {
  const records = resources.filter((row) => row._type === "settings");
  /** @type {Record<string,any>} */ const patch = {};
  /** @type {{key:string,label:string,value:string|number|boolean}[]} */ const fields =
    [];
  /** @type {string[]} */ const warnings = [];
  if (records.length !== 1)
    return {
      patch,
      fields,
      warnings:
        records.length > 1
          ? [
              "Multiple legacy settings records are preserved. Import one settings record to review compatible preferences.",
            ]
          : warnings,
      count: records.length,
      canApply: false,
    };
  const record = records[0];
  /** @type {[string,string,string,number,number][]} */
  const numbers = [
    ["timeout", "timeout", "Request timeout (ms)", 1, 3600000],
    ["maxRedirects", "maxRedirects", "Maximum redirects", 1, 2147483647],
    ["maxHistoryResponses", "maxHistory", "Response history limit", 1, 100],
    [
      "autocompleteDelay",
      "autocompleteDelay",
      "Autocomplete delay (ms)",
      0,
      2000,
    ],
    ["editorIndentSize", "editorIndentSize", "Editor indent width", 1, 16],
  ];
  for (const [source, key, label, min, max] of numbers) {
    if (!Object.hasOwn(record, source)) continue;
    const value = record[source];
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max
    ) {
      patch[key] = value;
      fields.push({ key, label, value });
    } else
      warnings.push(
        label + " is preserved without applying an incompatible value.",
      );
  }
  /** @type {[string,string][]} */
  const booleans = [
    ["editorIndentWithTabs", "Indent with tabs"],
    ["editorLineWrapping", "Editor line wrapping"],
    ["followRedirects", "Follow redirects"],
    ["filterResponsesByEnv", "Filter response history by environment"],
  ];
  for (const [key, label] of booleans) {
    if (!Object.hasOwn(record, key)) continue;
    const value = record[key];
    if (typeof value === "boolean") {
      patch[key] = value;
      fields.push({ key, label, value });
    } else
      warnings.push(
        label + " is preserved without applying an incompatible value.",
      );
  }
  if (Object.hasOwn(record, "editorKeyMap")) {
    const value = record.editorKeyMap;
    if (["default", "vim", "emacs", "sublime"].includes(value)) {
      patch.editorKeyMap = value;
      fields.push({ key: "editorKeyMap", label: "Editor keymap", value });
    } else
      warnings.push(
        "Editor keymap is preserved without applying an unsupported value.",
      );
  }
  return { patch, fields, warnings, count: 1, canApply: fields.length > 0 };
}
