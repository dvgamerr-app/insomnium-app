import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  writeFile,
  unlink,
  realpath,
  lstat,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { newRequest } from "../../src/lib/model.js";
import { builtinTemplateNames } from "../../src/lib/template-registration.js";
import { withNativeApp, poll, probeIdentifier } from "./helpers/native-app.js";
import {
  installPluginWorkerProbe,
  pluginWorkerRecords,
  restorePluginWorkerProbe,
} from "./helpers/plugin-worker-probe.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";

const readyText =
  "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.";
const names = ["insomnia-plugin-render-a", "insomnia-plugin-render-b"];
const publicNames = [
  "UnicodeTag",
  "ไทย",
  "$owned",
  "_owned",
  "1custom",
  "__proto__",
  "constructor",
  'a"b',
  "a\\b",
];
assert.ok(process.env.APPDATA);
const storeRoot = resolve(process.env.APPDATA, probeIdentifier);
assert.equal(
  (await realpath(storeRoot)).toLowerCase(),
  storeRoot.toLowerCase(),
);
const storePath = join(storeRoot, "plugin-data-v1.json");
let originalStore;
try {
  const stat = await lstat(storePath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(
    (await realpath(storePath)).toLowerCase(),
    storePath.toLowerCase(),
  );
  originalStore = await readFile(storePath);
} catch (error) {
  if (/** @type {any} */ (error).code !== "ENOENT") throw error;
}
const wire = /** @type {any[]} */ ([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    wire.push({
      url: request.url,
      method: request.method,
      body: await request.text(),
      headers: Object.fromEntries(request.headers),
    });
    return new Response("plugin-render-accepted", {
      headers: { "Content-Type": "text/plain" },
    });
  },
});
try {
  await withNativeApp(
    "plugin-template-tags",
    async ({ page, invoke, output }) => {
      const original = await invoke("load_workspace"),
        collection = "wrk_plugin_render_" + Date.now(),
        requestId = "req_plugin_render_" + Date.now(),
        root = join(output, "packages"),
        files = /** @type {{path:string,text:string}[]} */ ([]),
        checks = /** @type {string[]} */ ([]),
        observations = /** @type {any[]} */ ([]),
        records = /** @type {any[]} */ ([]),
        directories = [];
      const sourceA = `exports.templateTags=[
      {name:'dup',priority:-100,run(){return 'A-first';}},
      {name:'dup',priority:100,run(){return 'A-last';}},
      {name:'internal',run(){return 'internal-first';}},
      {name:'internal',run(){return 'internal-last';}},
      {name:'context',run(c,...args){return JSON.stringify({args,scope:c.context.scope,alias:c.context._.scope,derived:c.context.derived,meta:c.meta,purpose:c.renderPurpose});}},
      {name:'args',run(c,zero,nan,infinity,missing){return JSON.stringify({negativeZero:Object.is(zero,-0),nan:Number.isNaN(nan),infinity:infinity===Infinity,undefined:missing===undefined});}},
      {name:'value',run(c,kind){switch(kind){case 'false':return false;case 'zero':return 0;case 'null':return null;case 'undefined':return undefined;case 'bigint':return 12345678901234567890n;case 'nan':return NaN;case 'infinity':return Infinity;case 'array':return ['a',null,'b'];case 'object':return {a:1};case 'regex':return /owned/gi;case 'map':return new Map([['a',1]]);case 'set':return new Set([1]);case 'bytes':return new Uint8Array([1,2,255]);}}},
      ...${JSON.stringify(builtinTemplateNames)}.map(name=>({name,run(){throw Error('built-in collision callback must not run');}}))
    ];`;
      const sourceB = `exports.templateTags=[
      {name:'dup',priority:-999,run(){return 'B';}},
      ...${JSON.stringify(publicNames)}.map(name=>({name,run(){return name;}})),
      {name:'not callable',run(){throw Error('unparseable declaration must not break other tags');}},
      {name:'persist',async run(c){await c.store.setItem('value','stored');return await c.store.getItem('value');}},
      {name:'hold',async run(c){await c.store.getItem('gate');await c.store.setItem('forbidden','leaked');return 'held';}},
      {name:'throwing',run(){throw Error('owned plugin failure');}}
    ];`;
      for (const [index, source] of [sourceA, sourceB].entries()) {
        const directory = join(root, index === 0 ? "a" : "b");
        await mkdir(directory, { recursive: true });
        directories.push(directory);
        for (const [file, text] of Object.entries({
          "package.json": JSON.stringify({
            name: names[index],
            version: "1.0.0",
            insomnia: {},
            main: "index.js",
          }),
          "index.js": source,
        })) {
          const path = join(directory, file);
          await Bun.write(path, text);
          files.push({ path, text });
        }
      }
      const seed = structuredClone(original);
      seed.resources.push(
        {
          _id: collection,
          _type: "workspace",
          parentId: null,
          name: "Plugin render fixture",
          scope: "collection",
        },
        {
          _id: "env_" + collection,
          _type: "environment",
          parentId: collection,
          name: "Base Environment",
          data: { scope: "base", derived: "{% dup %}" },
        },
        newRequest(collection, {
          _id: requestId,
          name: "Plugin render request",
          method: "POST",
          url: `http://127.0.0.1:${server.port}/render`,
          body: { mimeType: "text/plain", text: "" },
          settingSendCookies: false,
          settingStoreCookies: false,
        }),
      );
      seed.activeWorkspaceId = collection;
      seed.activeRequestId = requestId;
      seed.activeEnvironmentId = "";
      seed.openTabs = [requestId];
      seed.settings.pluginDirectories = directories;
      seed.settings.pluginPathMigrationVersion = 1;
      seed.settings.pluginConfig = {
        ...seed.settings.pluginConfig,
        [names[0]]: { disabled: false },
        [names[1]]: { disabled: false },
      };
      const preferences = async () => {
        await page
          .getByRole("button", { name: "Preferences", exact: true })
          .first()
          .click();
        await page.getByRole("tab", { name: "Plugins", exact: true }).click();
        await page.waitForFunction(
          () =>
            document
              .querySelector(".plugins-panel")
              ?.getAttribute("aria-busy") === "false",
        );
      };
      const card = (/** @type {string} */ name) =>
        page
          .locator(".plugin-card")
          .filter({ has: page.getByRole("heading", { name, exact: true }) });
      const closePreferences = () =>
        page
          .getByRole("button", { name: "Close Preferences", exact: true })
          .click();
      const load = async (/** @type {string} */ name) => {
        await card(name)
          .getByRole("button", { name: "Load plugin", exact: true })
          .click();
        await card(name).getByText(readyText, { exact: true }).waitFor();
      };
      const body = async (/** @type {string} */ text) => {
        await page.getByRole("tab", { name: "Body", exact: true }).click();
        await page
          .locator(".request-editor .CodeMirror")
          .first()
          .evaluate(
            (el, text) => /** @type {any} */ (el).CodeMirror.setValue(text),
            text,
          );
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ r) => r._id === requestId,
            ).body.text === text,
          "Saved body edit",
        );
      };
      const settled = () =>
        poll(
          async () =>
            (await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()) === 0,
          "Plugin template Send settles",
          60000,
        );
      const send = async (/** @type {string|null} */ expected) => {
        const before = wire.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (expected !== null)
          await poll(
            () => Promise.resolve(wire.length > before),
            "Actual native plugin-render wire",
            60000,
          );
        else await page.getByText("Request failed", { exact: true }).waitFor();
        await settled();
        if (expected === null) assert.equal(wire.length, before);
        else {
          assert.equal(wire.length, before + 1);
          assert.equal(wire.at(-1).body, expected);
          assert.equal(wire.at(-1).method, "POST");
        }
        observations.push({
          source: (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === requestId,
          ).body.text,
          expected,
          wireCount: wire.length,
        });
      };
      try {
        await invoke("save_workspace", { data: seed });
        await page.reload();
        await page.locator(".app-shell").waitFor();
        await installPluginWorkerProbe(page);
        await preferences();
        await load(names[1]);
        await load(names[0]);
        await closePreferences();
        await body(
          ["dup", "internal", ...publicNames]
            .map((name) => "{% " + name + " %}")
            .join("|"),
        );
        await send(["B", "internal-last", ...publicNames].join("|"));
        checks.push(
          "discovery order wins over reversed Load and priority; internal duplicate and Unicode/symbol names",
        );
        await body('{% context false, 0, "", _.scope %}');
        await send(
          JSON.stringify({
            args: [false, 0, "", "base"],
            scope: "base",
            alias: "base",
            derived: "B",
            meta: { requestId, workspaceId: collection },
            purpose: "send",
          }),
        );
        checks.push(
          "actual inherited environment and legacy helper context/meta/purpose",
        );
        await body("{% args -0, 0/0, 1/0, missing %}");
        await send(
          '{"negativeZero":true,"nan":true,"infinity":true,"undefined":true}',
        );
        checks.push(
          "bounded argument codec preserves signed zero, nonfinite and undefined through both real workers",
        );
        await body(
          [
            "false",
            "zero",
            "null",
            "undefined",
            "bigint",
            "nan",
            "infinity",
            "array",
            "object",
            "regex",
            "map",
            "set",
            "bytes",
          ]
            .map((kind) => `{% value "${kind}" %}`)
            .join("|"),
        );
        await send(
          "false|0|||12345678901234567890|NaN|Infinity|a,,b|[object Object]|/owned/gi|[object Map]|[object Set]|1,2,255",
        );
        checks.push(
          "Nunjucks output coercion preserves non-JSON callback values",
        );
        await body(
          '{% base64 "encode", "normal", "hello" %}|{% request "name" %}|{% persist %}',
        );
        await send("aGVsbG8=|Plugin render request|stored");
        checks.push(
          "built-in local/native collisions protected and real durable store bridge",
        );
        await preferences();
        await card(names[1])
          .getByRole("button", { name: "Unload plugin", exact: true })
          .click();
        await closePreferences();
        await body("{% dup %}");
        await send("A-last");
        checks.push(
          "Unload removes winner and uses remaining loaded definition",
        );
        await preferences();
        await card(names[0])
          .getByRole("button", { name: "Disable plugin", exact: true })
          .click();
        await closePreferences();
        await send(null);
        checks.push("Disabled/unloaded definitions cannot dispatch or send");
        await preferences();
        await card(names[0])
          .getByRole("button", { name: "Enable plugin", exact: true })
          .click();
        await load(names[0]);
        await load(names[1]);
        await closePreferences();
        for (const mode of ["cancel", "request-edit", "unload", "disable"]) {
          await body("{% hold %}");
          const before = wire.length;
          const boundary = await withIpcSuccessHook(
            page,
            "plugin_store",
            async () => {
              if (mode === "cancel")
                await page
                  .getByRole("button", { name: "Cancel", exact: true })
                  .click();
              else if (mode === "request-edit")
                await page
                  .getByLabel("Request URL", { exact: true })
                  .fill(`http://127.0.0.1:${server.port}/edited`);
              else {
                await preferences();
                await card(names[1])
                  .getByRole("button", {
                    name:
                      mode === "unload" ? "Unload plugin" : "Disable plugin",
                    exact: true,
                  })
                  .click();
                await closePreferences();
              }
            },
            async () => {
              await send(null);
            },
          );
          assert.equal(boundary.calls, 1);
          assert.equal(boundary.hooks, 1);
          assert.equal(wire.length, before);
          const forbidden = await invoke("plugin_store", {
            plugin: names[1],
            operation: { action: "hasItem", key: "forbidden" },
          });
          assert.equal(forbidden, false);
          observations.at(-1).boundary = {
            mode,
            calls: boundary.calls,
            hooks: boundary.hooks,
            forbidden,
          };
          checks.push(
            "held native reply " +
              mode +
              " prevents result/network and subsequent write",
          );
          await preferences();
          if (mode === "disable")
            await card(names[1])
              .getByRole("button", { name: "Enable plugin", exact: true })
              .click();
          await load(names[1]);
          await closePreferences();
        }
        await body("{% throwing %}");
        await send(null);
        await preferences();
        await card(names[1])
          .getByText("owned plugin failure", { exact: true })
          .waitFor();
        await load(names[1]);
        await closePreferences();
        await body("{% dup %}");
        await send("B");
        checks.push(
          "Guest callback error marks closed registry session and explicit Reload recovers",
        );
        await preferences();
        for (const name of names)
          await card(name)
            .getByRole("button", { name: "Unload plugin", exact: true })
            .click();
        await closePreferences();
        records.push(...(await pluginWorkerRecords(page)));
        assert.ok(records.every((record) => record.terminated));
        const workers = [];
        for (const prefix of ["plugin.worker-", "template.worker-"]) {
          const { readdir } = await import("node:fs/promises");
          const name = (await readdir("build/_app/immutable/workers")).find(
            (name) => name.startsWith(prefix),
          );
          assert.ok(name);
          const path = join("build/_app/immutable/workers", name),
            url = new URL("/_app/immutable/workers/" + name, page.url()).href;
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
          );
          workers.push({ path, url, sha256 });
        }
        const actual = await invoke("load_workspace");
        assert.equal(
          actual.resources.find((/** @type {any} */ r) => r._id === requestId)
            .body.text,
          "{% dup %}",
        );
        assert.equal(
          actual.resources.find(
            (/** @type {any} */ r) => r._id === "env_" + collection,
          ).data.derived,
          "{% dup %}",
        );
        for (const file of files)
          assert.equal(await readFile(file.path, "utf8"), file.text);
        await invoke("save_workspace", { data: original });
        const restored = await invoke("load_workspace");
        assert.deepEqual(restored, original);
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              passed: true,
              checks,
              observations,
              wire,
              records,
              workers,
              files,
              original,
              restored,
              actual,
              requestId,
              collection,
            },
            null,
            2,
          ),
        );
      } finally {
        await restorePluginWorkerProbe(page);
        await invoke("save_workspace", { data: original });
        assert.deepEqual(await invoke("load_workspace"), original);
      }
    },
  );
} finally {
  server.stop(true);
  if (originalStore) {
    await writeFile(storePath, originalStore);
    assert.deepEqual(await readFile(storePath), originalStore);
  } else {
    await unlink(storePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    assert.equal(await Bun.file(storePath).exists(), false);
  }
}
