import assert from "node:assert/strict";
import { join, resolve, sep } from "node:path";
import { realpath } from "node:fs/promises";
import { poll } from "./native-app.js";
import { tlsPreferences } from "./tls-preferences.js";

/** Real native stream failures retained across an actual Git workspace transition.
 * @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context
 * @param {Awaited<ReturnType<import('./git-fixture.js').gitCollection>>} fixture
 * @param {(verify:(phase:string)=>Promise<void>)=>Promise<void>} run */
export async function withGitStreamErrors(
  { page, invoke, output },
  fixture,
  run,
) {
  let original = (await invoke("load_workspace")).settings;
  const setTls = tlsPreferences(page, invoke);
  if (process.env.INSOMNIUM_GIT_HISTORY_TLS_RECOVERY) {
    const path = await realpath(process.env.INSOMNIUM_GIT_HISTORY_TLS_RECOVERY);
    assert.ok(
      path.startsWith((await realpath(resolve("artifacts/playwright"))) + sep),
      "Recovery settings must be a saved owned artifact",
    );
    original = (await Bun.file(path).json()).settings;
    for (const key of ["caPem", "identityHost", "identityPem"])
      assert.equal(typeof original[key], "string");
    assert.equal(typeof original.validateCertificates, "boolean");
    await setTls(
      original.caPem,
      original.identityHost,
      original.identityPem,
      original.validateCertificates,
    );
    await Bun.write(
      join(output, "tls-recovered.json"),
      JSON.stringify({ restored: true, path }),
    );
  }
  await Bun.write(
    join(output, "tls-original.json"),
    JSON.stringify({
      settings: Object.fromEntries(
        ["caPem", "identityHost", "identityPem", "validateCertificates"].map(
          (key) => [key, original[key]],
        ),
      ),
    }),
  );
  let connections = 0;
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open(socket) {
        connections++;
        socket.end();
      },
      data() {},
    },
  });
  const rows = /** @type {Array<Record<string,any>>} */ ([]);
  const checks = /** @type {string[]} */ ([]);
  try {
    await setTls(
      "-----BEGIN CERTIFICATE-----\n%%%\n-----END CERTIFICATE-----",
      "",
      "",
    );
    const data = await invoke("load_workspace");
    const source = data.resources.find(
      (/** @type {any} */ row) => row._id === fixture.requestId,
    );
    for (const protocol of ["sse", "websocket"]) {
      const id = "req_" + protocol + "_" + fixture.repositoryId;
      const request = {
        ...structuredClone(source),
        _id: id,
        _type: protocol === "websocket" ? "websocket_request" : "request",
        name: "Git retained " + protocol + " error",
        isPrivate: true,
        responseMode: protocol === "sse" ? "sse" : undefined,
        url: `${protocol === "websocket" ? "wss" : "https"}://127.0.0.1:${listener.port}/git-history`,
        headers:
          protocol === "sse"
            ? [{ name: "Accept", value: "text/event-stream" }]
            : [],
      };
      data.resources.push(request);
      rows.push({ protocol, request });
    }
    await invoke("save_workspace", { data });
    await page.reload();
    const select = async (/** @type {Record<string,any>} */ entry) => {
      const closeGit = page.getByRole("button", {
        name: "Close Source Control",
        exact: true,
      });
      if (await closeGit.isVisible()) await closeGit.click();
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name:
            (entry.protocol === "websocket" ? "WS " : "SSE ") +
            entry.request.name,
          exact: true,
        })
        .click();
    };
    for (const entry of rows) {
      await select(entry);
      const before = await invoke("load_workspace");
      await page.getByRole("button", { name: "Connect", exact: true }).click();
      await poll(
        async () =>
          (await invoke("load_workspace")).history.some(
            (/** @type {any} */ row) =>
              row.requestId === entry.request._id &&
              row.connectionState === "error",
          ),
        "Native " + entry.protocol + " error before Git checkout",
      );
      const saved = await invoke("load_workspace");
      const fresh = saved.history.filter(
        (/** @type {any} */ row) =>
          !before.history.some((/** @type {any} */ old) => old._id === row._id),
      );
      assert.equal(fresh.length, 1);
      entry.response = fresh[0];
      assert.equal(entry.response.protocol, entry.protocol);
      assert.ok(
        entry.response.events.some(
          (/** @type {any} */ event) => event.kind === "error",
        ),
      );
      assert.equal(
        entry.response.events.some((/** @type {any} */ event) =>
          ["sse", "message"].includes(event.kind),
        ),
        false,
      );
      await page.locator(".stream-pane .status-badge.failure").waitFor();
      assert.equal(connections, 0, "Malformed CA fails before native TCP");
      checks.push("native-" + entry.protocol + "-error-before-TCP");
    }
    fixture.data = await invoke("load_workspace");
    const history = structuredClone(fixture.data.history);
    const verify = async (/** @type {string} */ phase) => {
      for (const entry of rows) {
        await select(entry);
        const badge = page.locator(".stream-pane .status-badge.failure");
        await badge.waitFor();
        assert.equal(await badge.innerText(), "error");
        assert.equal(
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .isEnabled(),
          true,
        );
        assert.deepEqual((await invoke("load_workspace")).history, history);
        assert.equal(
          connections,
          0,
          "Git transition/reload never reconnects streams",
        );
        await page.screenshot({
          path: join(output, phase + "-" + entry.protocol + "-error.png"),
        });
        checks.push(
          phase +
            "-" +
            entry.protocol +
            "-exact-history-error-badge-no-reconnect",
        );
      }
    };
    await run(verify);
    await Bun.write(
      join(output, "stream-history-acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          checks,
          connections,
          rows,
          limits:
            "Actual Windows native SSE/WSS malformed-CA errors across mounted Git create-and-switch and reload. Other Git recovery/merge/fault/platform transitions remain separate.",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await Bun.write(
      join(output, "stream-history-failure.json"),
      JSON.stringify({ error: String(error), checks, connections }),
    );
    throw error;
  } finally {
    listener.stop(true);
    const branches = page.getByRole("dialog", {
      name: "Branches",
      exact: true,
    });
    if (await branches.isVisible()) {
      await branches
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await branches.waitFor({ state: "detached" });
    }
    await setTls(
      original.caPem || "",
      original.identityHost || "",
      original.identityPem || "",
      original.validateCertificates,
    );
    const restored = (await invoke("load_workspace")).settings;
    const keys = [
      "caPem",
      "identityHost",
      "identityPem",
      "validateCertificates",
    ];
    for (const key of keys)
      assert.equal(restored[key], original[key], "Restore " + key);
    await Bun.write(
      join(output, "settings-restored.json"),
      JSON.stringify({ restored: true, keys }),
    );
  }
}
