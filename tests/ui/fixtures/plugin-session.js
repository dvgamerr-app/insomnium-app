import { openPluginSession } from "../../../src/lib/plugin-session.js";

const sessions = new Map(),
  records = /** @type {any[]} */ ([]);
let nextId = 0;
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
