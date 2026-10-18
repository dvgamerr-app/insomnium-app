/** Compatible, explicitly reviewed preferences. Source records remain portable.
 * @param {Record<string,any>[]} resources @param {string} [sourceId] */
export function legacyPreferenceCandidate(resources, sourceId) {
  const records = resources.filter((row) => row._type === "settings");
  /** @type {Record<string,any>} */ const patch = {};
  /** @type {{key:string,label:string,value:string|number|boolean}[]} */ const fields =
    [];
  /** @type {string[]} */ const warnings = [];
  const sources = records.filter(row => typeof row._id === "string" && row._id).map(row => ({id:String(row._id),label:typeof row.name === "string" && row.name ? row.name + " (" + row._id + ")" : String(row._id)}));
  const selected = sourceId ? records.filter(row => row._id === sourceId) : records.length === 1 ? records : [];
  if (selected.length !== 1)
    return {patch,fields,warnings:sourceId
      ? ["The selected settings record is missing or ambiguous. Choose a settings record again."]
      : records.length > 1 ? ["Choose a settings record to review compatible preferences. All source records will be preserved."] : warnings,
      count:records.length,sources,selectedId:null,canApply:false};
  const record = selected[0];
  const selectedId = typeof record._id === "string" ? record._id : null;
  /** @type {[string,string,string,number,number][]} */
  const numbers = [
    ["timeout", "timeout", "Request timeout (ms)", 0, 3600000],
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
    ["editorFontSize", "editorFontSize", "Editor font size (px)", 8, 24],
  ];
  for (const [source, key, label, min, max] of numbers) {
    if (!Object.hasOwn(record, source)) continue;
    const original = record[source];
    // The archived libcurl adapter disables the timeout for every finite <= 0 value.
    const unlimitedTimeout = source === "timeout" && typeof original === "number" &&
      Number.isFinite(original) && original < 0;
    const value = unlimitedTimeout ? 0 : original;
    if (unlimitedTimeout)
      warnings.push("Legacy negative request timeout means unlimited and will apply as 0 ms. The original setting is preserved.");
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
    ["forceVerticalLayout", "Stack request and response vertically"],
    ["proxyEnabled", "Enable app proxy settings"],
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
  for (const [key,label] of [["httpProxy","HTTP proxy URL"],["httpsProxy","HTTPS proxy URL"],["noProxy","Proxy bypass list"]]) {
    if (!Object.hasOwn(record,key)) continue;
    const value = record[key];
    if (typeof value === "string" && value.length <= 8192 && !/[\x00-\x1f\x7f]/.test(value) && (key === "noProxy" || !/\s/.test(value))) {
      patch[key] = value;
      fields.push({key,label,value});
    } else warnings.push(label + " is preserved without applying an incompatible value.");
  }
  if (Object.hasOwn(record, "preferredHttpVersion")) {
    const versions = {default:"default",V1_0:"1.0",V1_1:"1.1",V2PriorKnowledge:"2-prior-knowledge"};
    const value = record.preferredHttpVersion;
    if (typeof value === "string" && Object.hasOwn(versions, value)) {
      patch.httpVersion = versions[/** @type {keyof typeof versions} */ (value)];
      fields.push({key:"httpVersion",label:"HTTP version",value:patch.httpVersion});
    } else warnings.push("Preferred HTTP version is preserved without applying an unsupported value.");
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
  return { patch, fields, warnings, count: records.length, sources, selectedId, canApply: fields.length > 0 };
}
