import { createPluginRegistry } from "../../../src/lib/plugin-registry.js";
import { openPluginSession } from "../../../src/lib/plugin-session.js";

const name = "insomnia-plugin-cancel-recovery";
const source = `exports.templateTags=[
 {name:'echo',run(c,value){return value.value;}},
 {name:'hold',async run(){await new Promise(()=>{});}},
 {name:'fail',run(){throw Error('owned-guest-failure');}}
];`;
let owner = {};
let settings = {
  pluginDirectories: ["fixture"],
  pluginPathMigrationVersion: 1,
};
let reads = 0;
let opens = 0;
let diskSource = source;
let tamperMetadata = false;
/** @type {Promise<void>|undefined} */ let gate;
/** @type {(()=>void)|undefined} */ let release;
/** @type {AbortController|undefined} */ let controller;
/** @type {Promise<any>|undefined} */ let result;
/** @type {any[]} */ const workers = [];
/** @type {Record<string,any>} */ const argumentsById = {};
const registry = createPluginRegistry({
  getContext: () => ({ owner, ready: true, settings }),
  discover: async () => ({
    report: {
      complete: true,
      packages: [
        {
          name,
          version: "1.0.0",
          format: "commonjs",
          status: "execution-pending",
          directory: "fixture",
          entry: "fixture/index.js",
        },
      ],
    },
  }),
  readPackage: async () => {
    reads++;
    return {
      name,
      format: "commonjs",
      entry: "index.js",
      files: {
        "index.js": diskSource,
        "package.json": JSON.stringify({ name, version: "1.0.0" }),
      },
    };
  },
  openSession: async (snapshot, options) => {
    opens++;
    await gate;
    const session = await openPluginSession(snapshot, {
      ...options,
      createWorker() {
        const worker = new Worker(
          /** @type {any} */ (window).__pluginCancelWorkerUrl,
          { type: "module" },
        );
        const row = { terminated: false, sent: /** @type {any[]} */ ([]) };
        workers.push(row);
        const send = worker.postMessage.bind(worker);
        worker.postMessage = (message) => {
          row.sent.push(message);
          send(message);
        };
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          row.terminated = true;
          terminate();
        };
        return worker;
      },
    });
    if (tamperMetadata)
      session.metadata.contributions[0].items[0].definition.name = "changed";
    return session;
  },
});
/** @param {string} tag @param {any[]} args @param {AbortSignal} signal */
function invoke(tag, args, signal) {
  const definition = registry
    .captureTemplateTags()
    .find((item) => item.definition.name === tag);
  if (!definition) return Promise.reject(Error("Tag is unavailable"));
  return definition.invoke(args, {
    signal,
    isCurrent: () => true,
    context: {},
  });
}
/** @type {any} */ (window).__pluginCancelFixture = {
  prepare: () => registry.prepare(name),
  startHold() {
    controller = new AbortController();
    result = invoke("hold", [], controller.signal).then(
      (/** @type {any} */ value) => ({ value }),
      (/** @type {any} */ error) => ({
        error: String(error),
        name: error.name,
      }),
    );
  },
  cancel: () => controller?.abort(),
  result: () => result,
  state: () => ({ reads, opens, workers, plugin: registry.read()[name] }),
  gate() {
    gate = new Promise((resolve) => {
      release = resolve;
    });
  },
  release() {
    release?.();
    gate = undefined;
  },
  changeDisk() {
    diskSource = "throw Error('Changed disk source must not execute');";
  },
  restoreDisk() {
    diskSource = source;
  },
  tamperMetadata() {
    tamperMetadata = true;
  },
  /** @param {string} id @param {string} value */
  async echo(id, value) {
    const argument = { value };
    argumentsById[id] = argument;
    return invoke("echo", [argument], new AbortController().signal);
  },
  /** @param {string} id */ mutate(id) {
    argumentsById[id].value = "mutated";
  },
  fail: () =>
    invoke("fail", [], new AbortController().signal).catch(
      (/** @type {any} */ error) => String(error),
    ),
  changeOwner() {
    owner = {};
    registry.synchronize();
  },
  close() {
    controller?.abort();
    release?.();
    registry.dispose();
  },
};
