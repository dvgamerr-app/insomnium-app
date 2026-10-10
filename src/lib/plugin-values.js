/** Data-only graph transport shared verbatim with the isolated VM.
 * No getters/toJSON or arbitrary constructors are invoked by the codec.
 * The wire format is internal, bounded and never used for workspace storage. */
export function createPluginValueCodec() {
  const limit = 1024 * 1024,
    maxItems = 10000,
    maxDepth = 64;
  const views = [
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array",
    "DataView",
  ];
  /** @returns {never} */
  const fail = () => {
    throw TypeError("Unsupported or invalid plugin value");
  };
  /** @param {any} prototype @param {string} key @param {any} value */
  const getter = (prototype, key, value) =>
    Object.getOwnPropertyDescriptor(prototype, key)?.get?.call(value);
  /** @param {string} text */
  function byteSize(text) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      bytes += c < 128 ? 1 : c < 2048 ? 2 : 3;
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
        const next = text.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          bytes++;
          i++;
        }
      }
      if (bytes > limit)
        throw RangeError("Plugin value exceeds the 1 MiB wire limit");
    }
    return bytes;
  }
  /** @param {string} text */
  const bounded = (text) => {
    byteSize(text);
    return text;
  };
  /** @param {any} input */
  function encode(input) {
    const seen = new Map(),
      nodes = /** @type {any[]} */ ([]);
    let items = 0,
      slots = 0,
      payloadBytes = 0;
    /** @param {string} text */
    function charge(text) {
      bounded(text);
      payloadBytes += byteSize(JSON.stringify(text));
      if (payloadBytes > limit)
        throw RangeError("Plugin value exceeds the 1 MiB wire limit");
      return text;
    }
    /** @param {any} value @param {number} depth @returns {any} */
    function visit(value, depth) {
      if (++items > maxItems || depth > maxDepth)
        throw RangeError("Plugin value graph limit exceeded");
      if (value === null) return ["null"];
      switch (typeof value) {
        case "undefined":
          return ["undefined"];
        case "boolean":
          return ["boolean", value];
        case "string":
          return ["string", charge(value)];
        case "number":
          return [
            "number",
            Number.isNaN(value)
              ? "NaN"
              : value === Infinity
                ? "+Infinity"
                : value === -Infinity
                  ? "-Infinity"
                  : Object.is(value, -0)
                    ? "-0"
                    : value,
          ];
        case "bigint":
          return ["bigint", charge(String(value))];
        case "object":
          break;
        default:
          return fail();
      }
      if (seen.has(value)) return ["ref", seen.get(value)];
      const id = nodes.length;
      seen.set(value, id);
      nodes.push(null);
      const proto = Object.getPrototypeOf(value);
      if (Object.getOwnPropertySymbols(value).length) fail();
      const keys = Object.keys(value);
      /** @returns {any[]} */
      const properties = () =>
        keys.map((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !Object.hasOwn(descriptor, "value")) fail();
          charge(key);
          return [key, visit(descriptor.value, depth + 1)];
        });
      if (Array.isArray(value)) {
        if (proto !== Array.prototype) fail();
        slots += value.length;
        if (slots > maxItems)
          throw RangeError("Plugin value array limit exceeded");
        nodes[id] = ["array", value.length, properties()];
      } else if (proto === Object.prototype || proto === null) {
        nodes[id] = ["object", proto === null, properties()];
      } else if (proto === Date.prototype) {
        if (keys.length) fail();
        nodes[id] = [
          "date",
          visit(Date.prototype.getTime.call(value), depth + 1),
        ];
      } else if (proto === Map.prototype) {
        if (keys.length) fail();
        nodes[id] = [
          "map",
          Array.from(Map.prototype.entries.call(value), ([key, item]) => [
            visit(key, depth + 1),
            visit(item, depth + 1),
          ]),
        ];
      } else if (proto === Set.prototype) {
        if (keys.length) fail();
        nodes[id] = [
          "set",
          Array.from(Set.prototype.values.call(value), (item) =>
            visit(item, depth + 1),
          ),
        ];
      } else if (proto === ArrayBuffer.prototype) {
        if (
          keys.length ||
          getter(ArrayBuffer.prototype, "byteLength", value) > limit / 2
        )
          fail();
        nodes[id] = [
          "buffer",
          charge(
            Array.from(new Uint8Array(value), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join(""),
          ),
        ];
      } else if (ArrayBuffer.isView(value)) {
        const name = views.find(
          (name) =>
            typeof (/** @type {any} */ (globalThis)[name]) === "function" &&
            proto === /** @type {any} */ (globalThis)[name].prototype,
        );
        if (!name || keys.some((key) => !/^(0|[1-9]\d*)$/.test(key))) fail();
        if (name === "DataView" && keys.length) fail();
        const viewProto =
          name === "DataView"
            ? DataView.prototype
            : Object.getPrototypeOf(Uint8Array.prototype);
        nodes[id] = [
          "view",
          name,
          visit(getter(viewProto, "buffer", value), depth + 1),
          getter(viewProto, "byteOffset", value),
          getter(
            viewProto,
            name === "DataView" ? "byteLength" : "length",
            value,
          ),
        ];
      } else if (proto === RegExp.prototype) {
        if (keys.length) fail();
        const flags = [
          ["hasIndices", "d"],
          ["global", "g"],
          ["ignoreCase", "i"],
          ["multiline", "m"],
          ["dotAll", "s"],
          ["unicode", "u"],
          ["unicodeSets", "v"],
          ["sticky", "y"],
        ]
          .filter(([key]) => getter(RegExp.prototype, key, value))
          .map(([, flag]) => flag)
          .join("");
        nodes[id] = [
          "regexp",
          charge(getter(RegExp.prototype, "source", value)),
          flags,
          visit(
            Object.getOwnPropertyDescriptor(value, "lastIndex")?.value,
            depth + 1,
          ),
        ];
      } else fail();
      return ["ref", id];
    }
    const root = visit(input, 0);
    return bounded(JSON.stringify([1, root, nodes]));
  }
  /** @param {string} wire @returns {any} */
  function decode(wire) {
    if (typeof wire !== "string") fail();
    bounded(wire);
    const graph = JSON.parse(wire);
    if (
      !Array.isArray(graph) ||
      graph.length !== 3 ||
      graph[0] !== 1 ||
      !Array.isArray(graph[2]) ||
      graph[2].length > maxItems
    )
      fail();
    const nodes = graph[2],
      values = /** @type {any[]} */ ([]),
      states = /** @type {number[]} */ ([]);
    let items = 0,
      slots = 0;
    /** @param {any} token @param {number} depth @returns {any} */
    function read(token, depth) {
      if (++items > maxItems || depth > maxDepth)
        throw RangeError("Plugin value graph limit exceeded");
      if (!Array.isArray(token)) return fail();
      const [type, value] = token;
      if (type === "null" && token.length === 1) return null;
      if (type === "undefined" && token.length === 1) return undefined;
      if (token.length !== 2) return fail();
      if (type === "boolean" && typeof value === "boolean") return value;
      if (type === "string" && typeof value === "string") return value;
      if (type === "number") {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (value === "NaN") return NaN;
        if (value === "+Infinity") return Infinity;
        if (value === "-Infinity") return -Infinity;
        if (value === "-0") return -0;
      }
      if (
        type === "bigint" &&
        typeof value === "string" &&
        /^-?(0|[1-9]\d*)$/.test(value)
      )
        return BigInt(value);
      if (
        type !== "ref" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value >= nodes.length
      )
        return fail();
      return node(value, depth + 1);
    }
    /** @param {number} id @param {number} depth @returns {any} */
    function node(id, depth) {
      if (states[id] === 2) return values[id];
      if (states[id] === 1) {
        if (values[id] === undefined) fail();
        return values[id];
      }
      const n = nodes[id];
      if (!Array.isArray(n)) return fail();
      const type = n[0];
      states[id] = 1;
      /** @param {any} target @param {any} entries */
      function properties(target, entries) {
        if (!Array.isArray(entries)) fail();
        const names = new Set();
        for (const pair of entries) {
          if (
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            typeof pair[0] !== "string" ||
            names.has(pair[0]) ||
            (type === "array" &&
              (pair[0] === "length" ||
                (/^(0|[1-9]\d*)$/.test(pair[0]) &&
                  Number(pair[0]) < 4294967295 &&
                  Number(pair[0]) >= n[1])))
          )
            fail();
          names.add(pair[0]);
          Object.defineProperty(target, pair[0], {
            value: read(pair[1], depth),
            enumerable: true,
            writable: true,
            configurable: true,
          });
        }
      }
      if (
        type === "array" &&
        n.length === 3 &&
        Number.isInteger(n[1]) &&
        n[1] >= 0 &&
        n[1] <= maxItems
      ) {
        slots += n[1];
        if (slots > maxItems)
          throw RangeError("Plugin value array limit exceeded");
        values[id] = new Array(n[1]);
        properties(values[id], n[2]);
      } else if (
        type === "object" &&
        n.length === 3 &&
        typeof n[1] === "boolean"
      ) {
        values[id] = n[1] ? Object.create(null) : {};
        properties(values[id], n[2]);
      } else if (type === "map" && n.length === 2 && Array.isArray(n[1])) {
        values[id] = new Map();
        for (const pair of n[1]) {
          if (!Array.isArray(pair) || pair.length !== 2) fail();
          values[id].set(read(pair[0], depth), read(pair[1], depth));
        }
      } else if (type === "set" && n.length === 2 && Array.isArray(n[1])) {
        values[id] = new Set();
        for (const item of n[1]) values[id].add(read(item, depth));
      } else if (type === "date" && n.length === 2) {
        const time = read(n[1], depth);
        if (typeof time !== "number") fail();
        values[id] = new Date(time);
      } else if (
        type === "buffer" &&
        n.length === 2 &&
        typeof n[1] === "string" &&
        /^(?:[0-9a-f]{2})*$/.test(n[1])
      ) {
        const bytes = new Uint8Array(n[1].length / 2);
        for (let i = 0; i < bytes.length; i++)
          bytes[i] = parseInt(n[1].slice(i * 2, i * 2 + 2), 16);
        values[id] = bytes.buffer;
      } else if (
        type === "view" &&
        n.length === 5 &&
        views.includes(n[1]) &&
        typeof (/** @type {any} */ (globalThis)[n[1]]) === "function" &&
        Number.isInteger(n[3]) &&
        n[3] >= 0 &&
        Number.isInteger(n[4]) &&
        n[4] >= 0
      ) {
        const buffer = read(n[2], depth);
        if (!(buffer instanceof ArrayBuffer)) fail();
        values[id] = new /** @type {any} */ (globalThis)[n[1]](
          buffer,
          n[3],
          n[4],
        );
      } else if (
        type === "regexp" &&
        n.length === 4 &&
        typeof n[1] === "string" &&
        typeof n[2] === "string"
      ) {
        values[id] = new RegExp(n[1], n[2]);
        values[id].lastIndex = read(n[3], depth);
      } else return fail();
      states[id] = 2;
      return values[id];
    }
    const result = read(graph[1], 0);
    if (states.filter((state) => state === 2).length !== nodes.length) fail();
    return result;
  }
  return Object.freeze({ encode, decode });
}
