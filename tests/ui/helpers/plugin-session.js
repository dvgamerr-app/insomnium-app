import assert from "node:assert/strict";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { withIpcAudit } from "./ipc-audit.js";

export const sessionName = "insomnia-plugin-session-primary";
const primary = `let counter=0;
exports.templateTags=[{name:'store',async run(c,value){counter++;const previous=await c.store.getItem('value');const voidResult=typeof await c.store.setItem('value',value);await c.store.setItem('temporary',null);await c.store.removeItem('temporary');return {counter,previous,value:await c.store.getItem('value'),has:await c.store.hasItem('value'),removed:await c.store.hasItem('temporary'),missing:await c.store.getItem('missing'),voidResult,keys:(await c.store.all()).map(x=>x.key),context:Object.keys(c),host:[typeof fetch,typeof process,typeof __TAURI_INTERNALS__]};}}];
exports.requestHooks=[async c=>{await c.store.setItem('requestHook','yes');}];
exports.responseHooks=[async c=>{await c.store.setItem('responseHook','yes');return 'response';}];
exports.requestGroupActions=[{label:'group',async action(c,models){await c.store.setItem('groupAction','yes');return models.requestGroup._id;}}];
exports.requestActions=[{label:'request',async action(c,models){await c.store.setItem('requestAction','yes');return models.request._id;}}];
exports.workspaceActions=[{label:'workspace',async action(c,models){const result=await c.store.clear();await c.store.setItem('workspaceAction','yes');return {model:models.workspace._id,voidResult:typeof result};}}];
exports.documentActions=[{label:'document',async action(c,documents){await c.store.setItem('documentAction','yes');return documents.title;}}];
exports.themes=[{name:'metadata-only'}];`;

/** @param {import('playwright-core').Page} page @param {string} output */
export async function installPluginSessionFixture(page, output) {
  const bundle = await Bun.build({
    entrypoints: ["tests/ui/fixtures/plugin-session.js"],
    target: "browser",
    format: "iife",
    // The fixture injects the genuine production worker factory. Replace the
    // unused default URL base so the client bundle is valid in page.evaluate.
    define: { "import.meta.url": JSON.stringify(page.url()) },
    minify: true,
    outdir: join(output, "adapter"),
  });
  assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const workers = (await readdir("build/_app/immutable/workers")).filter(
    (name) => /^plugin\.worker-.*\.js$/.test(name),
  );
  assert.equal(workers.length, 1);
  const url = new URL("/_app/immutable/workers/" + workers[0], page.url()).href;
  const path = join("build/_app/immutable/workers", workers[0]);
  const embedded = await page.evaluate(
    async (url) => (await fetch(url)).text(),
    url,
  );
  const sha256 = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  assert.equal(
    createHash("sha256").update(embedded).digest("hex"),
    sha256,
    "Native embedded worker must match this production build",
  );
  await page.evaluate(
    (asset) => {
      /** @type {any} */ (window).__pluginSessionWorkerAsset = asset;
    },
    { url, path, sha256 },
  );
  return url;
}

/** @param {import('playwright-core').Page} page @param {any} snapshot @param {string} url @param {string} [mode] */
export function openSession(page, snapshot, url, mode = "normal") {
  return page.evaluate(
    ({ snapshot, url, mode }) =>
      /** @type {any} */ (window).__pluginSessionFixture.open(
        snapshot,
        url,
        mode,
      ),
    { snapshot, url, mode },
  );
}
/** @param {import('playwright-core').Page} page @param {number} id @param {string} kind @param {number} [index] @param {any[]} [args] */
export function invokeSession(page, id, kind, index = 0, args = []) {
  return page.evaluate(
    ({ id, kind, index, args }) =>
      /** @type {any} */ (window).__pluginSessionFixture.invoke(
        id,
        kind,
        index,
        args,
      ),
    { id, kind, index, args },
  );
}
/** @param {import('playwright-core').Page} page @param {number} id */
export function closeSession(page, id) {
  return page.evaluate(
    (id) => /** @type {any} */ (window).__pluginSessionFixture.close(id),
    id,
  );
}

/** @param {string} root */
async function packages(root) {
  await mkdir(root, { recursive: true });
  const definitions = [
    { id: "primary", name: sessionName, source: primary },
    {
      id: "other",
      name: "@fixture/session-other",
      source: `exports.templateTags=[{name:'other',async run(c){const previous=await c.store.getItem('value');await c.store.setItem('value','other');return previous;}}];`,
    },
    {
      id: "esm",
      name: "insomnia-plugin-session-esm",
      module: true,
      source: `import data from './data.json';import helper from './helper.cjs';export const templateTags=[{name:'esm',async run(c){await c.store.setItem('label',helper(data.label));return await c.store.getItem('label');}}];`,
    },
    {
      id: "throw",
      name: "insomnia-plugin-session-throw",
      source: `exports.requestHooks=[()=>{throw Error('callback failure');}];`,
    },
    {
      id: "loop",
      name: "insomnia-plugin-session-loop",
      source: `exports.requestHooks=[()=>{for(;;){}}];`,
    },
    {
      id: "never",
      name: "insomnia-plugin-session-never",
      source: `exports.requestHooks=[()=>new Promise(()=>{})];`,
    },
    {
      id: "forged",
      name: "insomnia-plugin-session-forged",
      source: `exports.requestHooks=[async()=>{const errors=[];for(const op of [{method:'invoke',args:['save_workspace']},{method:'setItem',args:['value','evil'],plugin:'${sessionName}'}])try{await __pluginStoreCall(JSON.stringify(op));}catch(e){errors.push(e.message);}return errors;}];`,
    },
    {
      id: "before",
      name: "insomnia-plugin-session-before",
      source: `exports.requestHooks=[c=>c.store.setItem('blocked','never')];`,
    },
    {
      id: "late",
      name: "insomnia-plugin-session-late",
      source: `exports.requestHooks=[c=>c.store.setItem('committed','yes')];`,
    },
    {
      id: "abort",
      name: "insomnia-plugin-session-abort",
      source: `exports.requestHooks=[()=>new Promise(()=>{})];`,
    },
    {
      id: "flood",
      name: "insomnia-plugin-session-flood",
      source: `exports.requestHooks=[c=>Promise.all(Array.from({length:65},()=>c.store.getItem('x')))];`,
    },
    {
      id: "invalid",
      name: "insomnia-plugin-session-invalid",
      source: `exports.templateTags=[{name:'invalid'}];`,
    },
  ];
  const files = [];
  for (const d of definitions) {
    const dir = join(root, d.id);
    await mkdir(dir, { recursive: true });
    for (const [file, text] of Object.entries({
      "package.json": JSON.stringify({
        name: d.name,
        insomnia: {},
        version: "1.0.0",
        main: d.module ? "index.mjs" : "index.js",
      }),
      [d.module ? "index.mjs" : "index.js"]: d.source,
      ...(d.module
        ? {
            "data.json": '{"label":"ES module"}',
            "helper.cjs": 'module.exports = value => value + " stored";',
          }
        : {}),
    })) {
      const path = join(dir, file);
      await Bun.write(path, text);
      files.push(path);
    }
  }
  return { definitions, files };
}

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function pluginSessionScenario({ page, invoke, output }) {
  const fixture = await packages(join(output, "packages")),
    url = await installPluginSessionFixture(page, output);
  const workspace = await invoke("load_workspace");
  const snapshots = /** @type {Record<string,any>} */ ({});
  const before = await Promise.all(
    fixture.files.map((p) => readFile(p, "utf8")),
  );
  for (const d of fixture.definitions) {
    snapshots[d.id] = await invoke("read_plugin_package", {
      directory: join(output, "packages", d.id),
    });
    await invoke("plugin_store", {
      plugin: d.name,
      operation: { action: "clear" },
    });
  }
  const checks = [],
    results = /** @type {any[]} */ ([]);
  const main = await openSession(page, snapshots.primary, url);
  assert.equal(main.metadata.contributions.length, 8);
  for (const [value, count, previous] of [
    ["first", 1, null],
    ["second", 2, "first"],
  ]) {
    const result = await invokeSession(page, main.id, "templateTags", 0, [
      value,
    ]);
    assert.deepEqual(result, {
      counter: count,
      previous,
      value,
      has: true,
      removed: false,
      missing: null,
      voidResult: "undefined",
      keys: ["value"],
      context: ["store"],
      host: ["undefined", "undefined", "undefined"],
    });
    results.push(result);
  }
  const queued = await page.evaluate(async (id) => {
    const f = /** @type {any} */ (window).__pluginSessionFixture,
      args = ["queued-first"];
    const first = f.invoke(id, "templateTags", 0, args);
    args[0] = "changed";
    return Promise.all([
      first,
      f.invoke(id, "templateTags", 0, ["queued-second"]),
    ]);
  }, main.id);
  assert.deepEqual(
    queued.map((x) => [x.counter, x.previous, x.value]),
    [
      [3, "second", "queued-first"],
      [4, "queued-first", "queued-second"],
    ],
  );
  results.push({ queued });
  const kinds = [
    "requestHooks",
    "responseHooks",
    "requestGroupActions",
    "requestActions",
    "workspaceActions",
    "documentActions",
  ];
  const args = [
    [],
    [],
    [{ requestGroup: { _id: "group" } }],
    [{ request: { _id: "request" } }],
    [{ workspace: { _id: "workspace" } }],
    [{ title: "document" }],
  ];
  const expected = [
    undefined,
    "response",
    "group",
    "request",
    { model: "workspace", voidResult: "undefined" },
    "document",
  ];
  for (let i = 0; i < kinds.length; i++) {
    const result = await invokeSession(page, main.id, kinds[i], 0, args[i]);
    assert.deepEqual(result, expected[i]);
    results.push({ kind: kinds[i], result, type: typeof result });
  }
  await invokeSession(page, main.id, "templateTags", 0, ["retained"]);
  await closeSession(page, main.id);
  await assert.rejects(
    invokeSession(page, main.id, "templateTags"),
    /no longer current/,
  );
  const reopened = await openSession(page, snapshots.primary, url),
    reset = await invokeSession(page, reopened.id, "templateTags", 0, [
      "reopened",
    ]);
  assert.equal(reset.counter, 1);
  assert.equal(reset.previous, "retained");
  await closeSession(page, reopened.id);
  results.push({ reset });
  checks.push(
    "retained state, serialized detached args, seven callback kinds, six store methods, close/reload",
  );
  const other = await openSession(page, snapshots.other, url);
  assert.equal(await invokeSession(page, other.id, "templateTags"), null);
  await closeSession(page, other.id);
  assert.equal(
    await invoke("plugin_store", {
      plugin: sessionName,
      operation: { action: "getItem", key: "value" },
    }),
    "reopened",
  );
  const esm = await openSession(page, snapshots.esm, url);
  assert.equal(
    await invokeSession(page, esm.id, "templateTags"),
    "ES module stored",
  );
  await closeSession(page, esm.id);
  checks.push(
    "native namespace isolation and async ES module JSON/CJS imports",
  );
  for (const [id, pattern] of /** @type {[string,RegExp][]} */ ([
    ["throw", /callback failure/],
    ["loop", /interrupted/],
    ["never", /exceeded 5 seconds/],
    ["flood", /call limit/],
  ])) {
    const s = await openSession(page, snapshots[id], url),
      started = Date.now();
    let error = "";
    try {
      await invokeSession(page, s.id, "requestHooks");
    } catch (cause) {
      error = String(cause);
    }
    assert.match(error, pattern);
    assert.ok(Date.now() - started < 8000);
    results.push({ id, error, elapsed: Date.now() - started });
    await closeSession(page, s.id);
  }
  await assert.rejects(
    openSession(page, snapshots.invalid, url),
    /requires name and run/,
  );
  checks.push(
    "throw, CPU interruption, unresolved promise, RPC flood and metadata failure terminate",
  );
  const forged = await openSession(page, snapshots.forged, url);
  const forgedAudit = await withIpcAudit(page, "plugin_store", () =>
    invokeSession(page, forged.id, "requestHooks"),
  );
  assert.deepEqual(forgedAudit.value, [
    "Unsupported plugin store operation",
    "Unsupported plugin store operation",
  ]);
  assert.equal(forgedAudit.calls, 0);
  await closeSession(page, forged.id);
  const blocked = await openSession(
    page,
    snapshots.before,
    url,
    "before-store",
  );
  const blockedAudit = await withIpcAudit(page, "plugin_store", async () => {
    await assert.rejects(
      invokeSession(page, blocked.id, "requestHooks"),
      /no longer current/,
    );
  });
  assert.equal(blockedAudit.calls, 0);
  assert.equal(
    await invoke("plugin_store", {
      plugin: snapshots.before.name,
      operation: { action: "getItem", key: "blocked" },
    }),
    null,
  );
  checks.push(
    "forged invoke/foreign namespace and stale pre-dispatch guard perform no native store IPC",
  );
  const late = await openSession(page, snapshots.late, url);
  await page.evaluate(
    ({ id }) => {
      const w = /** @type {any} */ (window),
        original = window.fetch;
      w.__lateSessionFetch = original;
      w.fetch = async (
        /** @type {RequestInfo|URL} */ input,
        /** @type {RequestInit|undefined} */ init,
      ) => {
        const response = await original.call(window, input, init);
        if (
          String(input) ===
            w.__TAURI_INTERNALS__.convertFileSrc("plugin_store", "ipc") &&
          response.headers.get("Tauri-Response") === "ok"
        )
          w.__pluginSessionFixture.invalidate(id);
        return response;
      };
    },
    { id: late.id },
  );
  try {
    await assert.rejects(
      invokeSession(page, late.id, "requestHooks"),
      /no longer current/,
    );
  } finally {
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      window.fetch = w.__lateSessionFetch;
      delete w.__lateSessionFetch;
    });
  }
  assert.equal(
    await invoke("plugin_store", {
      plugin: snapshots.late.name,
      operation: { action: "getItem", key: "committed" },
    }),
    "yes",
  );
  checks.push(
    "post-dispatch mutation is durable while obsolete callback response is rejected",
  );
  const aborted = await openSession(page, snapshots.abort, url);
  const cancelled = await page.evaluate(async (id) => {
    const f = /** @type {any} */ (window).__pluginSessionFixture;
    const a = f.invoke(id, "requestHooks", 0, []),
      b = f.invoke(id, "requestHooks", 0, []);
    setTimeout(() => f.abort(id), 20);
    return (await Promise.allSettled([a, b])).map((x) => x.status);
  }, aborted.id);
  assert.deepEqual(cancelled, ["rejected", "rejected"]);
  assert.equal(
    await page.evaluate(
      ({ snapshot, url }) =>
        /** @type {any} */ (window).__pluginSessionFixture.preAbort(
          snapshot,
          url,
        ),
      { snapshot: snapshots.primary, url },
    ),
    true,
  );
  assert.equal(
    await page.evaluate(
      (snapshot) =>
        /** @type {any} */ (window).__pluginSessionFixture.missingGuard(
          snapshot,
        ),
      snapshots.primary,
    ),
    true,
  );
  checks.push(
    "AbortSignal cancels active/queued callbacks; pre-abort and missing guard refuse before worker construction",
  );
  await page.evaluate(() =>
    /** @type {any} */ (window).__pluginSessionFixture.closeAll(),
  );
  const records = await page.evaluate(() =>
    structuredClone(/** @type {any} */ (window).__pluginSessionFixture.records),
  );
  assert.equal(records.length, 13);
  assert.ok(records.every((/** @type {any} */ r) => r.terminated));
  assert.deepEqual(
    await Promise.all(fixture.files.map((p) => readFile(p, "utf8"))),
    before,
  );
  assert.deepEqual(await invoke("load_workspace"), workspace);
  const retained = await invoke("plugin_store", {
    plugin: sessionName,
    operation: { action: "all" },
  });
  await Bun.write(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        passed: true,
        checks,
        results,
        records,
        retained,
        files: fixture.files.map((path, i) => ({ path, before: before[i] })),
        workspacePreserved: true,
        guards: {
          forgedCalls: forgedAudit.calls,
          forgedErrors: forgedAudit.value,
          blockedCalls: blockedAudit.calls,
          cancelled,
        },
        workerAsset: await page.evaluate(
          () => /** @type {any} */ (window).__pluginSessionWorkerAsset,
        ),
      },
      null,
      2,
    ),
  );
  return {
    snapshot: snapshots.primary,
    retained,
    workspace,
    parentOutput: output,
  };
}
