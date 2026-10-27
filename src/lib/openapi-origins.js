/** Preserve lexical source identity across Scalar's documented structured clone
 * and merge callback. Private IDs exist only while dereferencing; they are never
 * returned to validators, sampling, workers or callers.
 * @param {{filename:string,specification:any}[]} files
 * @param {string[]} [internalKeys] */
export function prepareApiOrigins(files, internalKeys = []) {
  /** @type {{node:Record<string,any>,source:string,path:(string|number)[],ambiguous:boolean}[]} */
  const nodes = [];
  const keys = new Set();
  /** @type {WeakMap<object,(typeof nodes)[number]>} */ const seen =
    new WeakMap();
  for (const file of files) {
    const pending = [
      { node: file.specification, path: /** @type {(string|number)[]} */ ([]) },
    ];
    while (pending.length) {
      const item = pending.pop();
      if (!item || !item.node || typeof item.node !== "object") continue;
      const previous = seen.get(item.node);
      if (previous) {
        previous.ambiguous = true;
        continue;
      }
      const record = { ...item, source: file.filename, ambiguous: false };
      seen.set(item.node, record);
      nodes.push(record);
      for (const [key, value] of Object.entries(item.node)) {
        keys.add(key);
        if (value && typeof value === "object")
          pending.push({
            node: value,
            path: internalKeys.includes(key) ? item.path : [...item.path, key],
          });
      }
    }
  }
  // If a post-protection object has multiple lexical paths, its descendants
  // cannot acquire a unique path merely because the second walk was skipped.
  const ambiguousNodes = nodes
      .filter((item) => item.ambiguous)
      .map((item) => item.node),
    ambiguousSeen = new WeakSet();
  while (ambiguousNodes.length) {
    const node = ambiguousNodes.pop();
    if (!node || ambiguousSeen.has(node)) continue;
    ambiguousSeen.add(node);
    for (const child of Object.values(node)) {
      if (!child || typeof child !== "object") continue;
      const record = seen.get(child);
      if (record) record.ambiguous = true;
      ambiguousNodes.push(child);
    }
  }
  let marker = "__insomnium_source_origin__";
  while (keys.has(marker)) marker += "_";
  const locations = new Map(
    nodes.map((item, index) => [
      String(index),
      {
        source: item.source,
        path: item.path,
        ambiguous: item.ambiguous,
        keys: new Set(
          Object.keys(item.node).filter((key) => !internalKeys.includes(key)),
        ),
      },
    ]),
  );
  nodes.forEach((item, index) => {
    item.node[marker] = String(index);
  });
  /** @typedef {{source:string,path:(string|number)[]}} Location */
  /** @type {WeakMap<object,Map<string,Location|null>>} */ const inherited =
    new WeakMap();
  /** @type {WeakMap<object,Location|null>} */ const whole = new WeakMap();
  /** @type {WeakMap<object,{source:string,path:(string|number)[],keys:Set<string>,ambiguous:boolean}>} */ const retired =
    new WeakMap();
  /** Before boolean restoration replaces a resolved object with a primitive,
   * retain its proven value origin on the parent property. */
  /** @type {WeakMap<object,Map<string,Location|null>>} */ const children =
    new WeakMap();
  const lexical = (/** @type {any} */ node) =>
    node && typeof node === "object"
      ? (retired.get(node) ?? locations.get(node[marker]))
      : undefined;
  const object = (/** @type {any} */ node) => {
    if (whole.has(node)) return whole.get(node) ?? null;
    const original = lexical(node);
    return original && !original.ambiguous
      ? { source: original.source, path: original.path }
      : null;
  };
  const property = (/** @type {any} */ node, /** @type {string} */ key) => {
    const fields = inherited.get(node);
    if (fields?.has(key)) return fields.get(key) ?? null;
    const original = lexical(node);
    return original && !original.ambiguous && original.keys.has(key)
      ? { source: original.source, path: [...original.path, key] }
      : null;
  };
  return {
    marker,
    /** @param {{schema:any,resolved:any}} event */
    onDereference({ schema, resolved }) {
      const own = lexical(schema),
        fields = inherited.get(schema) ?? new Map();
      for (const key of Object.keys(resolved)) {
        if (
          key === marker ||
          internalKeys.includes(key) ||
          own?.keys.has(key) ||
          fields.has(key)
        )
          continue;
        fields.set(key, property(resolved, key));
      }
      inherited.set(schema, fields);
      const realKeys = [...(own?.keys ?? [])].filter((key) => key !== "$ref");
      // An entire reference replaces a lexical wrapper. Mixed sibling containers
      // have multiple owners; missing-key diagnostics must not choose one.
      whole.set(schema, realKeys.length === 0 ? object(resolved) : null);
    },
    /** @param {any} root @param {(string|number)[]} path */
    locate(root, path) {
      let node = root;
      for (let index = 0; index < path.length; index++) {
        const key = String(path[index]);
        if (!node || typeof node !== "object") return null;
        if (!Object.hasOwn(node, key)) return object(node);
        const location = property(node, key);
        if (lexical(node)?.ambiguous && !location) return null;
        if (index === path.length - 1)
          return node[key] && typeof node[key] === "object"
            ? object(node[key])
            : children.get(node)?.has(key)
              ? (children.get(node)?.get(key) ?? null)
              : location;
        node = node[key];
      }
      return object(node);
    },
    /** Strip only our collision-proof key, including arrays/cycles, before ANY
     * validator or restoration observes the final schema. @param {any} root */
    strip(root) {
      const pending = [root],
        seen = new WeakSet();
      while (pending.length) {
        const node = pending.pop();
        if (!node || typeof node !== "object" || seen.has(node)) continue;
        seen.add(node);
        const location = lexical(node);
        if (location) retired.set(node, location);
        const values = new Map();
        for (const [key, value] of Object.entries(node))
          if (value && typeof value === "object")
            values.set(key, object(value));
        children.set(node, values);
        delete node[marker];
        for (const value of Object.values(node))
          if (value && typeof value === "object") pending.push(value);
      }
    },
  };
}
