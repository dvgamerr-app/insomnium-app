import assert from "node:assert/strict";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { createWebSocketRuntimeFixture } from "./websocket-runtime-fixture.js";

/** Actual mounted native WebSocket controls and independently observed loopback wire. */
export async function runWebSocketRuntimeNativeCases() {
  assert.equal(process.platform, "win32");
  const markerPath = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(markerPath);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: markerPath,
  };
  const fixture = await createWebSocketRuntimeFixture();
  /** @type {unknown[]} */ const failures = [];
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {string|undefined} */ let evidence;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "websocket-runtime-native",
          async ({ page, invoke, output }) => {
            evidence = output;
            await resourceSaved(page);
            await capture();
            const original = await invoke("load_workspace");
            const suffix = crypto.randomUUID().replaceAll("-", "");
            const workspaceId = "wrk_ws_runtime_" + suffix;
            const envBase = "env_ws_base_" + suffix,
              envA = "env_ws_a_" + suffix,
              envB = "env_ws_b_" + suffix;
            const request = newRequest(workspaceId, {
              _id: "req_ws_runtime_" + suffix,
              _type: "websocket_request",
              name: "Owned runtime " + suffix,
              url:
                fixture.target("initial-" + suffix) +
                "&environment={{ _.wire }}",
              headers: [
                { name: "X-Owned-Environment", value: "{{ _.wire }}" },
                { name: "Sec-WebSocket-Protocol", value: "owned.runtime" },
              ],
            });
            const jsonText =
              '{"message":"สวัสดี β {{ _.wire }}","special":"{{ _.special }}","exact":9007199254740993}';
            const special = 'quote" slash\\ newline\nไทย';
            const expectedJson = (/** @type {string} */ wire) => jsonText
              .replace("{{ _.wire }}", wire)
              .replace("{{ _.special }}", JSON.stringify(special).slice(1,-1));
            const text = "Exact text β\r\nไทย";
            const binary = new Uint8Array([0, 255, 128, 13, 10, 42]);
            const ping = "ping β";
            const payloads = [
              { name: "Owned JSON", mode: "application/json", value: jsonText },
              { name: "Owned text", mode: "text/plain", value: text },
              {
                name: "Owned binary",
                mode: "binary",
                value: Buffer.from(binary).toString("base64"),
              },
              { name: "Owned ping", mode: "ping", value: ping },
            ].map((row, index) => ({
              ...row,
              _id: "wsp_" + index + suffix,
              _type: "websocket_payload",
              parentId: request._id,
            }));
            request.activePayloadId = payloads[0]._id;
            const collectionName = "Owned WS runtime " + suffix;
            const data = {
              ...original,
              resources: [
                ...original.resources,
                {
                  _id: workspaceId,
                  _type: "workspace",
                  parentId: null,
                  scope: "collection",
                  name: collectionName,
                },
                {
                  _id: envBase,
                  _type: "environment",
                  parentId: workspaceId,
                  name: "Base Environment",
                  data: {},
                },
                {
                  _id: envA,
                  _type: "environment",
                  parentId: envBase,
                  name: "Runtime A",
                  data: { wire: "owned-A", special },
                },
                {
                  _id: envB,
                  _type: "environment",
                  parentId: envBase,
                  name: "Runtime B",
                  data: { wire: "owned-B", special },
                },
                request,
                ...payloads,
              ],
              activeWorkspaceId: workspaceId,
              activeRequestId: request._id,
              activeEnvironmentId: envA,
              openTabs: [...original.openTabs, request._id],
              settings: {
                ...original.settings,
                proxy: "",
                timeout: 15000,
                filterResponsesByEnv: true,
                maxHistory: 20,
              },
            };
            await invoke("save_workspace", { data });
            const load = () => invoke("load_workspace");
            const inserted = (await load()).resources.find(
              (/** @type {any} */ row) => row._id === workspaceId,
            );
            assert.equal(inserted?.name, collectionName);
            registerResourceProbeCollection(inserted._id, inserted.name);
            await page.reload();
            await resourceSaved(page);
            const button = (/** @type {string} */ name) =>
              page.getByRole("button", { name, exact: true });
            const stream = page.getByRole("region", {
              name: "Stream response",
              exact: true,
            });
            const history = () =>
              stream.getByLabel("Connection history", { exact: true });
            const state = async (/** @type {string} */ value) =>
              poll(
                async () =>
                  (await stream.locator(".status-badge").innerText()) === value,
                "WS state " + value,
              );
            const rows = async () =>
              (await load()).history.filter(
                (/** @type {any} */ row) => row.requestId === request._id,
              );
            const savedTerminal = async (/** @type {number} */ count) => {
              await poll(async () => {
                const entries = await rows();
                return (
                  entries.length === count &&
                  entries.every((/** @type {any} */ row) =>
                    ["closed", "error"].includes(row.connectionState),
                  )
                );
              }, "Durable terminal WS histories " + count);
              return rows();
            };
            const record = (/** @type {string} */ token) =>
              fixture.records.find((row) => row.token === token);
            const wire = async (/** @type {string} */ token) => {
              await poll(
                () => Promise.resolve(!!record(token)?.opened),
                "WS upgraded " + token,
              );
              return record(token);
            };
            const closed = async (/** @type {string} */ token) =>
              poll(
                () => Promise.resolve(!!record(token)?.closed),
                "WS peer retired " + token,
              );
            const setUrl = async (
              /** @type {string} */ token,
              /** @type {'echo'|'held'|'reject'} */ mode = "echo",
            ) => {
              const value =
                fixture.target(token, mode) + "&environment={{ _.wire }}";
              await page.getByLabel("Request URL", { exact: true }).fill(value);
              await page
                .getByLabel("Request URL", { exact: true })
                .press("Tab");
              await poll(
                async () =>
                  (await load()).resources.find(
                    (/** @type {any} */ row) => row._id === request._id,
                  )?.url === value,
                "WS URL persisted",
              );
            };
            const selectPayload = async (/** @type {number} */ index) => {
              await page
                .getByLabel("Saved WebSocket payload", { exact: true })
                .selectOption(payloads[index]._id);
              await poll(
                async () =>
                  (await load()).resources.find(
                    (/** @type {any} */ row) => row._id === request._id,
                  )?.activePayloadId === payloads[index]._id,
                "WS saved payload selection",
              );
            };
            const editPayload = async (/** @type {string} */ value) => {
              await page
                .locator(".shared-code-editor")
                .filter({has:page.getByLabel("WebSocket message", {exact:true})})
                .locator(".CodeMirror")
                .evaluate((el, value) => /** @type {any} */ (el).CodeMirror.setValue(value), value);
              await poll(
                async () =>
                  (await load()).resources.find(
                    (/** @type {any} */ row) => row._id === payloads[0]._id,
                  )?.value === value,
                "WS payload edit persisted",
              );
            };
            await page
              .getByRole("tab", { name: "Message", exact: true })
              .click();
            await editPayload("{invalid");
            await button("Connect and send").click();
            await page
              .getByRole("region", { name: "Stream response", exact: true })
              .getByRole("alert")
              .filter({ hasText: /JSON/ })
              .waitFor();
            assert.equal(
              fixture.records.length,
              0,
              "Invalid JSON is refused before upgrade",
            );
            await editPayload(jsonText);
            const initial = "initial-" + suffix;
            await page.getByLabel("Request URL", {exact:true}).focus();
            await page.keyboard.press("Control+Enter");
            await state("open");
            await wire(initial);
            await poll(
              () => Promise.resolve(record(initial)?.incoming.length === 1),
              "Exactly one initial JSON send",
            );
            const first = record(initial);
            assert.ok(first);
            assert.equal(
              first.incoming[0].text,
              expectedJson("owned-A"),
            );
            assert.equal(first.headers["x-owned-environment"], "owned-A");
            assert.equal(
              new URL(first.url, "http://localhost").searchParams.get(
                "environment",
              ),
              "owned-A",
            );
            assert.equal(first.subprotocol, "owned.runtime");
            assert.equal(
              fixture.records.length,
              1,
              "Connect and send uses one upgrade",
            );
            for (const index of [1, 2, 3]) {
              await selectPayload(index);
              await button("Send message").click();
            }
            await poll(
              () =>
                Promise.resolve(
                  first.incoming.length === 3 && first.pings.length === 1,
                ),
              "Exact text/binary/ping wire",
            );
            assert.equal(first.incoming[1].text, text);
            assert.equal(
              first.incoming[2].base64,
              Buffer.from(binary).toString("base64"),
            );
            assert.equal(first.incoming[2].kind, "binary");
            assert.equal(
              first.pings[0].base64,
              Buffer.from(ping).toString("base64"),
            );
            await selectPayload(2);
            await page
              .getByLabel("WebSocket message", { exact: true })
              .fill("%%%invalid%%%");
            await button("Send message").click();
            await page
              .getByRole("alert")
              .filter({ hasText: /Invalid symbol 37/ })
              .waitFor();
            await selectPayload(3);
            await page
              .getByLabel("WebSocket message", { exact: true })
              .fill("x".repeat(126));
            await button("Send message").click();
            await page
              .getByRole("alert")
              .filter({ hasText: /125|ping/i })
              .waitFor();
            await state("open");
            await selectPayload(0);
            await page.getByLabel("Request URL", {exact:true}).focus();
            await page.keyboard.press("Meta+Enter");
            await poll(
              () => Promise.resolve(first.incoming.length === 4),
              "Connection usable after payload refusals",
            );
            assert.equal(first.incoming[3].text, expectedJson("owned-A"));
            await page.getByRole("tab", {name:"Settings",exact:true}).click();
            await page.getByRole("checkbox", {name:"Skip rendering of request body",exact:true}).check();
            await poll(async () => (await load()).resources.find((/** @type {any} */ r) => r._id === request._id)?.settingDisableRenderRequestBody === true,"WS literal-body setting persisted");
            await page.getByRole("tab", {name:"Message",exact:true}).click();
            await button("Send message").click();
            await poll(() => Promise.resolve(first.incoming.length === 5),"Literal JSON payload delivered");
            assert.equal(first.incoming[4].text,jsonText,"Disabled rendering preserves template source on actual wire");
            await page.getByRole("tab", {name:"Settings",exact:true}).click();
            await page.getByRole("checkbox", {name:"Skip rendering of request body",exact:true}).uncheck();
            await poll(async () => (await load()).resources.find((/** @type {any} */ r) => r._id === request._id)?.settingDisableRenderRequestBody === false,"WS rendering restored");
            await page.getByRole("tab", {name:"Message",exact:true}).click();
            assert.equal(first.pings.length, 1);
            fixture.peerSend(initial, "Peer exact ไทย");
            fixture.peerSend(initial, binary);
            fixture.peerClose(initial, 4001, "owned peer close β");
            await state("closed");
            await closed(initial);
            let entries = await savedTerminal(1);
            const firstHistory = entries[0];
            assert.equal(firstHistory.environmentId, envA);
            assert.ok(
              firstHistory.events.some(
                (/** @type {any} */ event) =>
                  event.direction === "received" &&
                  event.data === "Peer exact ไทย",
              ),
            );
            assert.ok(
              firstHistory.events.some(
                (/** @type {any} */ event) =>
                  event.direction === "received" &&
                  event.format === "binary" &&
                  event.data === Buffer.from(binary).toString("base64"),
              ),
            );
            assert.ok(
              firstHistory.events.some(
                (/** @type {any} */ event) =>
                  event.format === "pong" &&
                  event.data === Buffer.from(ping).toString("base64"),
              ),
            );
            assert.ok(
              firstHistory.events.some(
                (/** @type {any} */ event) =>
                  event.code === 4001 && event.reason === "owned peer close β",
              ),
            );
            await page.screenshot({
              path: join(output, "events.png"),
              fullPage: true,
            });
            await stream
              .getByRole("tab", { name: "Headers", exact: true })
              .click();
            await stream.getByText("owned.runtime", { exact: true }).waitFor();
            await page.screenshot({
              path: join(output, "headers.png"),
              fullPage: true,
            });
            await page.reload();
            await resourceSaved(page);
            await state("closed");
            assert.equal(
              fixture.records.length,
              1,
              "Reload does not reconnect",
            );
            assert.deepEqual(await rows(), entries);
            checks.push({
              kind: "initial-json-text-binary-ping-peer-close-reload",
              oneUpgrade: true,
              exactWire: true,
              preflightRefusals: 3,
            });

            const rejected = "rejected-" + suffix;
            await setUrl(rejected, "reject");
            await button("Connect").click();
            await state("error");
            entries = await savedTerminal(2);
            assert.ok(
              entries[0].events.some(
                (/** @type {any} */ event) =>
                  event.kind === "error" &&
                  /403/.test(event.data || event.message || ""),
              ),
              "Durable handshake error contains HTTP 403",
            );
            await page.screenshot({
              path: join(output, "handshake-error.png"),
              fullPage: true,
            });
            await page.reload();
            await resourceSaved(page);
            await state("error");
            assert.equal(fixture.records.length, 2);
            const retry = "retry-" + suffix;
            await setUrl(retry);
            await button("Connect").click();
            await state("open");
            await wire(retry);
            await button("Disconnect").click();
            await state("closed");
            await closed(retry);
            await savedTerminal(3);
            checks.push({ kind: "durable-403-and-fresh-retry" });

            const held = "held-" + suffix;
            await setUrl(held, "held");
            await page
              .getByRole("tab", { name: "Message", exact: true })
              .click();
            await selectPayload(1);
            await button("Connect and send").click();
            await poll(
              () => Promise.resolve(!!record(held)),
              "Held handshake received",
            );
            await button("Disconnect").click();
            await poll(
              () => Promise.resolve(!!record(held)?.settled),
              "Held handshake cancelled",
            );
            assert.throws(
              () => fixture.releaseHandshake(held),
              /No held handshake/,
              "Cancelled handshake cannot be released into a late connection",
            );
            await savedTerminal(4);
            assert.equal(record(held)?.opened, false);
            assert.equal(record(held)?.incoming.length, 0);
            checks.push({ kind: "held-handshake-cancel-no-late-send" });

            // Completion must select the active environment, even if its history is empty.
            for (const action of ["peer", "cancel"]) {
              const token = action + "-environment-" + suffix;
              await setUrl(token);
              await button("Connect").click();
              await state("open");
              await wire(token);
              await page
                .getByLabel("Active environment", { exact: true })
                .selectOption(envB);
              await poll(
                async () => (await load()).activeEnvironmentId === envB,
                "Environment B active during A connection",
              );
              if (action === "peer")
                fixture.peerClose(token, 4002, "environment switch complete");
              else await button("Disconnect").click();
              await closed(token);
              await savedTerminal(action === "peer" ? 5 : 6);
              await poll(
                async () =>
                  (await stream.locator(".status-badge").innerText()) ===
                  "Disconnected",
                "B remains empty after A completion",
              );
              assert.equal(await history().count(), 0);
              assert.equal(
                record(token)?.headers["x-owned-environment"],
                "owned-A",
              );
              assert.equal(
                new URL(
                  record(token)?.url || "",
                  "http://localhost",
                ).searchParams.get("environment"),
                "owned-A",
              );
              await page
                .getByLabel("Active environment", { exact: true })
                .selectOption(envA);
              await state("closed");
              await poll(
                async () =>
                  (await history().locator("option").count()) ===
                  (action === "peer" ? 5 : 6),
                "A history restored",
              );
            }
            checks.push({
              kind: "environment-switch-peer-close-and-cancel",
              capturesOriginalEnvironment: true,
              emptyB: true,
            });

            await history().selectOption(firstHistory._id);
            await poll(
              async () =>
                Object.values((await load()).responseSelections).includes(
                  firstHistory._id,
                ),
              "Nonlatest WS history selection persisted",
            );
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history().inputValue(), firstHistory._id);
            const countBefore = fixture.records.length;
            await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("button", { name: "Preferences", exact: true }).click();
            await page
              .getByRole("tab", { name: "Requests", exact: true })
              .click();
            await page
              .getByLabel("Filter response history by environment", {
                exact: true,
              })
              .uncheck();
            await poll(
              async () =>
                (await load()).settings.filterResponsesByEnv === false,
              "History filter disabled",
            );
            await button("Close Preferences").click();
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption(envB);
            assert.equal(await history().locator("option").count(), 6);
            await history().selectOption(firstHistory._id);
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history().inputValue(), firstHistory._id);
            assert.equal(fixture.records.length, countBefore);
            checks.push({
              kind: "nonlatest-selection-reload-filter-off-cross-environment",
            });

            const deleted = "deleted-" + suffix;
            await setUrl(deleted);
            await button("Connect").click();
            await state("open");
            await wire(deleted);
            await button("Delete request").click();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Delete request", exact: true })
              .click();
            await closed(deleted);
            await poll(
              async () =>
                !(await load()).resources.some(
                  (/** @type {any} */ row) => row._id === request._id,
                ),
              "Live request deleted durably",
            );
            await page.reload();
            await resourceSaved(page);
            const after = await load();
            assert.equal(
              after.resources.some(
                (/** @type {any} */ row) =>
                  row._id === request._id || row.parentId === request._id,
              ),
              false,
            );
            assert.equal(
              after.history.some(
                (/** @type {any} */ row) => row.requestId === request._id,
              ),
              false,
              "Deleted history cannot resurrect",
            );
            assert.equal(fixture.records.length, countBefore + 1);
            assert.deepEqual(
              after.history,
              original.history,
              "Original history remains unchanged",
            );
            checks.push({
              kind: "delete-live-request-peer-close-no-resurrection",
            });
          },
          options,
        );
      },
      { ...options, lazyCapture: true },
    );
  } catch (error) {
    failures.push(error);
  }
  let retirement;
  try {
    retirement = await fixture.closeAfterHostExit();
  } catch (error) {
    retirement = /** @type {any} */ (error)?.retirement;
    failures.push(error);
  }
  if (evidence)
    await Bun.write(
      join(evidence, "websocket-runtime-acceptance.json"),
      JSON.stringify(
        {
          passed: !failures.length,
          renderingMode: "native-hidden",
          mockedIpc: false,
          checks,
          records: fixture.records,
          fixtureErrors: fixture.errors,
          retirement,
          errors: failures.map(String),
          outerProfileRestorationRequired: true,
        },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Native WebSocket runtime acceptance failed",
    );
}
