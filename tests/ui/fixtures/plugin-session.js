import { openPluginSession } from "../../../src/lib/plugin-session.js";
import { createPluginValueCodec } from "../../../src/lib/plugin-values.js";

const sessions = new Map(),
  operations = new Map(),
  records = /** @type {any[]} */ ([]);
let nextId = 0;
let nextOperation = 0;
/** @type {any} */ (window).__pluginSessionFixture = {
  records,
  /** @param {any} snapshot @param {string} url @param {string} [mode] */
  async open(snapshot, url, mode = "normal") {
    const id = ++nextId,
      owner = { alive: true },
      controller = new AbortController();
    const session = await openPluginSession(snapshot, {
      isCurrent: () => owner.alive,
      signal: controller.signal,
      createWorker: () => {
        const worker = new Worker(url, { type: "module" }),
          record = {
            id,
            url,
            terminated: false,
            messages: /** @type {any[]} */ ([]),
          };
        records.push(record);
        worker.addEventListener("message", (event) => {
          record.messages.push(event.data);
          if (mode === "before-store" && event.data?.type === "store")
            owner.alive = false;
        });
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          record.terminated = true;
          terminate();
        };
        return worker;
      },
    });
    sessions.set(id, { session, owner, controller });
    return { id, metadata: session.metadata };
  },
  /** @param {number} id @param {string} kind @param {number} index @param {any[]} [args] */
  invoke: (id, kind, index, args = []) =>
    sessions.get(id).session.invoke(kind, index, args),
  /** @param {number} id @param {string} kind @param {number} index @param {any[]} args @param {any} [context] */
  startOperation(id, kind, index, args, context) {
    const owner = { alive: true },
      controller = new AbortController(),
      options = {
        isCurrent: () => owner.alive,
        signal: controller.signal,
        context,
      },
      operation = ++nextOperation;
    const promise = sessions
      .get(id)
      .session.invoke(kind, index, args, options)
      .then(
        (/** @type {any} */ value) => ({ value }),
        (/** @type {any} */ error) => ({
          error: String(error),
          name: error.name,
        }),
      );
    operations.set(operation, { owner, controller, context, options, promise });
    return operation;
  },
  /** @param {number} id */
  operationResult: (id) => operations.get(id).promise,
  /** Preflight refusals must not enter the guest or close its live session.
   * @param {number} id */
  async operationControls(id) {
    const session = sessions.get(id).session;
    let getters = 0;
    const accessor = Object.defineProperty({}, "meta", {
      enumerable: true,
      get() {
        getters++;
        return {};
      },
    });
    const aborted = new AbortController();
    aborted.abort();
    const cases = [
      ["missing owner", { context: { meta: {} } }, "operation guard"],
      [
        "store injection",
        { isCurrent: () => true, context: { store: {} } },
        "callback context",
      ],
      [
        "app injection",
        { isCurrent: () => true, context: { app: {} } },
        "callback context",
      ],
      [
        "array meta",
        { isCurrent: () => true, context: { meta: [] } },
        "callback context",
      ],
      [
        "array context",
        { isCurrent: () => true, context: { context: [] } },
        "callback context",
      ],
      [
        "unknown purpose",
        { isCurrent: () => true, context: { renderPurpose: "preview" } },
        "render purpose",
      ],
      [
        "accessor",
        { isCurrent: () => true, context: accessor },
        "Unsupported or invalid plugin value",
      ],
      [
        "function",
        { isCurrent: () => true, context: { meta: { callback() {} } } },
        "Unsupported or invalid plugin value",
      ],
      ["invalid signal", { signal: { aborted: false } }, "operation signal"],
      ["invalid guard", { isCurrent: true }, "operation guard"],
      ["undefined owner result", { isCurrent: () => undefined }, "AbortError"],
      [
        "throwing owner",
        {
          isCurrent() {
            throw Error("stale");
          },
        },
        "AbortError",
      ],
      ["preaborted", { signal: aborted.signal }, "AbortError"],
    ];
    const checks = [];
    for (const [name, options, expected] of cases) {
      let error;
      try {
        await session.invoke("templateTags", 0, [], options);
      } catch (cause) {
        error = String(cause);
      }
      if (!error?.toLowerCase().includes(String(expected).toLowerCase()))
        throw Error("Missing preflight refusal: " + name + ":" + error);
      checks.push(name);
    }
    let metadataError;
    try {
      await session.invoke("templateTagMetadata", 0, [[]], {
        isCurrent: () => true,
        context: { meta: {} },
      });
    } catch (cause) {
      metadataError = String(cause);
    }
    if (!metadataError?.includes("Metadata queries do not accept"))
      throw Error("Metadata context must refuse");
    checks.push("metadata context");
    if (getters !== 0) throw Error("Preflight invoked accessor");
    if ((await session.invoke("templateTags", 1)) !== 0)
      throw Error("Preflight dispatched a refused guest callback");
    return { checks, getters };
  },
  /** @param {number} id @param {string} mode */
  changeOperation(id, mode) {
    const op = operations.get(id);
    if (mode === "abort") op.controller.abort();
    else if (mode === "stale") op.owner.alive = false;
    else if (mode === "replace-guard") {
      op.options.isCurrent = () => true;
      op.owner.alive = false;
    } else if (mode === "mutate-context") {
      op.context.meta.requestId = "changed";
      op.context.context.shared.value = "changed";
    }
  },
  /** @param {number} id */
  close: (id) => sessions.get(id).session.close(),
  /** @param {number} id */
  abort: (id) => sessions.get(id).controller.abort(),
  /** @param {number} id */
  invalidate: (id) => {
    sessions.get(id).owner.alive = false;
  },
  closeAll: () => {
    for (const { session } of sessions.values()) session.close();
  },
  /** Actual worker/guest round trips; construct values here to avoid Playwright's
   * own serialization changing the values before they reach our client.
   * @param {number} id */
  async valueControls(id) {
    const session = sessions.get(id).session,
      checks = /** @type {string[]} */ ([]);
    const check = (/** @type {boolean} */ ok, /** @type {string} */ name) => {
      if (!ok) throw Error(name);
      checks.push(name);
    };
    const codec = createPluginValueCodec();
    const malformed = [
      "[]",
      "[2,[],[]]",
      '[1,["ref",1],[]]',
      '[1,["number","bad"],[]]',
      '[1,["null"],[["object",false,[]]]]',
      '[1,["ref",0],[["object",false,[["x",["null"]],["x",["null"]]]]]]',
      '[1,["ref",0],[["view","Function",["null"],0,0]]]',
      '[1,["ref",0],[["buffer","0z"]]]',
      '[1,["ref",0],[["array",10001,[]]]]',
      '[1,["ref",0],[["object",false,[["next",["ref",1]]]], ["array",10000,[["0",["ref",2]]]],["array",10000,[]]]]',
    ];
    for (const wire of malformed) {
      let rejected = false;
      try {
        codec.decode(wire);
      } catch {
        rejected = true;
      }
      check(rejected, "malformed wire " + checks.length);
    }
    const exact = "a".repeat(1024 * 1024 - codec.encode("").length);
    const wire = codec.encode(exact);
    check(
      new TextEncoder().encode(wire).length === 1024 * 1024 &&
        codec.decode(wire) === exact,
      "exact UTF-8 wire boundary",
    );
    let oversized = false;
    try {
      codec.encode(exact + "a");
    } catch {
      oversized = true;
    }
    check(oversized, "one byte beyond wire boundary refused");
    for (const value of [
      undefined,
      null,
      true,
      false,
      NaN,
      Infinity,
      -Infinity,
      -0,
      1e300,
      123456789012345678901234567890n,
      "ไทย😀\ud800",
    ]) {
      const result = await session.invoke("templateTags", 0, [value]);
      check(
        Object.is(value, result),
        "literal " + typeof value + ":" + String(value),
      );
    }
    const buffer = new Uint8Array([0, 255, 128, 13, 10, 0, 42, 90]).buffer;
    const sparse = new Array(3);
    sparse[1] = undefined;
    /** @type {any} */ (sparse)["4294967295"] = "named property";
    const empty = Object.create(null);
    empty.__proto__ = "literal";
    const shared = { missing: undefined, null: null };
    const graph = /** @type {any} */ ({
      shared,
      again: shared,
      sparse,
      empty,
      buffer,
      bytes: new Uint8Array(buffer, 2, 4),
      view: new DataView(buffer, 1, 5),
      numbers: new Float64Array([NaN, Infinity, -0]),
      big: new BigInt64Array([-123456789012345n, 9223372036854775807n]),
      date: new Date("2026-10-10T00:00:00Z"),
      invalidDate: new Date(NaN),
      regex: /ไทย😀/giu,
    });
    graph.self = graph;
    graph.map = new Map([[graph, shared]]);
    graph.set = new Set([graph, shared]);
    graph.regex.lastIndex = 4;
    Object.defineProperty(graph, "__proto__", {
      value: shared,
      enumerable: true,
    });
    const first = session.invoke("templateTags", 0, [graph]);
    new Uint8Array(buffer)[2] = 7;
    shared.null = /** @type {any} */ ("mutated");
    const result = await first;
    check(
      result.self === result && result.again === result.shared,
      "cycles and shared references",
    );
    check(
      Object.hasOwn(result.shared, "missing") &&
        result.shared.missing === undefined &&
        result.shared.null === null,
      "undefined own property and detached queue input",
    );
    check(
      result.sparse.length === 3 &&
        !(0 in result.sparse) &&
        1 in result.sparse &&
        result.sparse[1] === undefined &&
        !(2 in result.sparse),
      "sparse holes distinguish undefined",
    );
    check(
      Object.getPrototypeOf(result.empty) === null &&
        result.empty.__proto__ === "literal" &&
        Object.getPrototypeOf(result) === Object.prototype &&
        Object.getOwnPropertyDescriptor(result, "__proto__")?.value ===
          result.shared,
      "null prototypes and literal prototype keys",
    );
    check(
      result.buffer instanceof ArrayBuffer &&
        result.bytes instanceof Uint8Array &&
        result.bytes.buffer === result.buffer &&
        result.bytes.byteOffset === 2 &&
        result.bytes.length === 4 &&
        result.bytes[0] === 128,
      "byte view offsets and shared detached buffer",
    );
    check(
      result.view instanceof DataView &&
        result.view.buffer === result.buffer &&
        result.view.byteOffset === 1 &&
        result.view.byteLength === 5 &&
        result.view.getUint8(0) === 255,
      "DataView bytes and alias",
    );
    check(
      result.numbers instanceof Float64Array &&
        Number.isNaN(result.numbers[0]) &&
        result.numbers[1] === Infinity &&
        Object.is(result.numbers[2], -0),
      "typed numeric special values",
    );
    check(
      result.big instanceof BigInt64Array &&
        result.big[0] === -123456789012345n &&
        result.big[1] === 9223372036854775807n,
      "typed bigint literals",
    );
    check(
      result.date instanceof Date &&
        result.date.toISOString() === "2026-10-10T00:00:00.000Z" &&
        Number.isNaN(result.invalidDate.getTime()),
      "valid and invalid dates",
    );
    check(
      result.regex instanceof RegExp &&
        result.regex.source === "ไทย😀" &&
        result.regex.flags === "giu" &&
        result.regex.lastIndex === 4,
      "regexp source flags and cursor",
    );
    check(
      result.map instanceof Map &&
        result.map.get(result) === result.shared &&
        result.set instanceof Set &&
        result.set.has(result) &&
        result.set.has(result.shared),
      "Map and Set identity",
    );
    let getters = 0;
    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        getters++;
        return 1;
      },
    });
    const symbolKey = { [Symbol("private")]: 1 };
    const depth = /** @type {any} */ ({});
    let cursor = depth;
    for (let i = 0; i < 70; i++) {
      cursor.next = {};
      cursor = cursor.next;
    }
    const refused = [
      new (class CustomArray extends Array {})(),
      Object.assign(new DataView(new ArrayBuffer(1)), { 0: "extra" }),
      () => 1,
      Symbol("value"),
      new (class Custom {})(),
      accessor,
      symbolKey,
      {
        toJSON() {
          getters++;
          return "lost";
        },
      },
      new WeakMap(),
      "😀".repeat(300000),
      new Array(10001),
      depth,
    ];
    const before = await session.invoke("templateTags", 1);
    check(
      result.sparse["4294967295"] === "named property" &&
        result.sparse.length === 3,
      "large numeric array property remains a named property",
    );
    for (const value of refused) {
      let error = "";
      try {
        await session.invoke("templateTags", 0, [value]);
      } catch (cause) {
        error = String(cause);
      }
      check(/Unsupported|limit/.test(error), "refusal " + checks.length);
    }
    const after = await session.invoke("templateTags", 1);
    check(
      getters === 0 && before === after && after === 12,
      "refusals execute no guest callback/getter/toJSON and leave session usable",
    );
    return {
      checks,
      roundTrips: 12,
      refusals: refused.length,
      getters,
      callbackCount: after,
    };
  },
  /** @param {any} snapshot @param {string} url */
  async preAbort(snapshot, url) {
    const controller = new AbortController();
    controller.abort();
    try {
      await openPluginSession(snapshot, {
        isCurrent: () => true,
        signal: controller.signal,
        createWorker: () => new Worker(url),
      });
      return false;
    } catch (error) {
      return error instanceof DOMException && error.name === "AbortError";
    }
  },
  /** @param {any} snapshot */
  async missingGuard(snapshot) {
    try {
      await openPluginSession(snapshot, /** @type {any} */ ({}));
      return false;
    } catch (error) {
      return String(error).includes("live-owner guard");
    }
  },
};
