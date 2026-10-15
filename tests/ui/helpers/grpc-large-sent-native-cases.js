import assert from "node:assert/strict";
import {
  grpcLargeCase,
  grpcLargeModes,
  grpcLargeProto,
} from "./grpc-large-case-data.js";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  resourceSaved,
  registerResourceProbeCollection,
  manageResource,
} from "./resource-manager-cases.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
import { createGrpcLargeSentFixture } from "./grpc-large-sent-fixture.js";
/** Real native bidi send/half-close/metadata/status/history, without injecting app callbacks. */
export async function runGrpcLargeSentNativeCases() {
  const marker = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(marker && process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: marker,
    allowParentTermination: true,
  };
  const fixture = await createGrpcLargeSentFixture();
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {unknown[]} */ const errors = [];
  /** @type {string|undefined} */ let output;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "grpc-large-sent-native",
          async ({ page, invoke, output: directory, terminateParent, pid }) => {
            output = directory;
            page.setDefaultTimeout(60000);
            await resourceSaved(page);
            await capture();
            const original = await invoke("load_workspace");
            assert.ok(
              Buffer.byteLength(JSON.stringify(original.history)) <
                4 * 1024 * 1024,
            );
            const suffix = crypto.randomUUID().replaceAll("-", ""),
              workspaceId = "wrk_grpc_large_" + suffix,
              name = "Owned gRPC large " + suffix,
              protoId = "pf_grpc_large_" + suffix;
            await invoke("save_workspace", {
              data: {
                ...original,
                resources: [
                  ...original.resources,
                  {
                    _id: workspaceId,
                    _type: "workspace",
                    parentId: null,
                    name,
                    scope: "collection",
                  },
                  {
                    _id: "env_" + suffix,
                    _type: "environment",
                    parentId: workspaceId,
                    name: "Base Environment",
                    data: {},
                  },
                  {
                    _id: protoId,
                    _type: "proto_file",
                    parentId: workspaceId,
                    name: "large.proto",
                    protoText: grpcLargeProto,
                  },
                ],
                activeWorkspaceId: workspaceId,
                activeEnvironmentId: null,
                settings: {
                  ...original.settings,
                  proxy: "",
                  timeout: 120000,
                  maxHistory: 40,
                },
              },
            });
            registerResourceProbeCollection(workspaceId, name);
            const button = (/** @type {string} */ name) =>
              page.getByRole("button", { name, exact: true });
            const watchdog = setTimeout(() => {
              errors.push("Owned native UI exceeded600seconds");
              void terminateParent().catch((error) => errors.push(error));
            }, 600000);
            try {
              for (const mode of grpcLargeModes) {
                const spec = grpcLargeCase(mode),
                  body = spec.body,
                  bodySHA256 = createHash("sha256").update(body).digest("hex");
                const unary = spec.unary;
                const receives = spec.receives;
                const startButton = unary ? "Send" : "Connect";
                const request = newRequest(workspaceId, {
                  _id: "greq_" + mode + "_" + suffix,
                  _type: "grpc_request",
                  name: "Owned large " + mode,
                  url: fixture.url,
                  protoFileId: protoId,
                  protoMethodName: spec.method,
                  grpcJsonMode: spec.jsonMode,
                  body: { mimeType: "application/json", text: body },
                  metadata: [{ name: "owned-case", value: mode }],
                });
                const before = await invoke("load_workspace");
                await invoke("save_workspace", {
                  data: {
                    ...before,
                    resources: [...before.resources, request],
                    activeRequestId: request._id,
                    openTabs: [...before.openTabs, request._id],
                  },
                });
                await page.reload();
                await resourceSaved(page);
                await button("Load methods").click();
                await poll(
                  async () => await button(startButton).isEnabled(),
                  "Native schema method ready",
                );
                assert.equal(
                  await page
                    .getByRole("combobox", { name: "gRPC method", exact: true })
                    .inputValue(),
                  request.protoMethodName,
                );
                await button(startButton).click();
                if (!unary) {
                  await poll(
                    async () => await button("Send message").isEnabled(),
                    "Bidi sender open",
                  );
                  await button("Send message").click();
                  await poll(
                    () =>
                      Promise.resolve(
                        fixture.records.some(
                          (r) =>
                            r.mode === mode &&
                            r.receivedBytes === 9 * 1024 * 1024 + 10,
                        ),
                      ),
                    "Full protobuf reaches peer",
                    60000,
                  );
                  await poll(
                    async () => await button("Commit").isEnabled(),
                    "Send operation settles",
                  );
                  await page
                    .getByRole("tab", { name: "Stream 1", exact: true })
                    .click();
                  assert.equal(
                    await page
                      .locator(".request-compose pre.grpc-message")
                      .textContent(),
                    spec.preview,
                  );
                  await page
                    .locator(".request-compose")
                    .getByRole("status")
                    .filter({ hasText: "Showing a preview" })
                    .waitFor();
                  await button("Commit").click();
                }
                await poll(
                  async () =>
                    (await button(startButton).isVisible()) &&
                    (await button(startButton).isEnabled()),
                  "Native call/terminal persistence retires",
                  60000,
                );
                await resourceSaved(page);
                const saved = await invoke("load_workspace");
                const entry = saved.history.find(
                  (/** @type {any} */ r) => r.requestId === request._id,
                );
                assert.ok(entry);
                assert.equal(entry.protocol, "grpc");
                assert.equal(entry.connectionState, "closed");
                assert.equal(entry.status, 0);
                const sent = entry.events.filter(
                  (/** @type {any} */ e) => e.kind === "sent",
                );
                assert.equal(sent.length, receives ? 0 : 1);
                const messages = entry.events.filter(
                  (/** @type {any} */ e) => e.kind === "message",
                );
                assert.equal(messages.length, receives ? 1 : 0);
                const retained = receives ? messages[0] : sent[0];
                assert.equal(retained.text, body);
                assert.ok(
                  entry.events.some(
                    (/** @type {any} */ e) =>
                      e.kind === "status" && e.code === 0,
                  ),
                );
                const verifyPreview = async () => {
                  if (!receives)
                    await page
                      .getByRole("tab", { name: "Stream 1", exact: true })
                      .click();
                  if (!receives) {
                    const pane = page.locator(".grpc-response");
                    await pane
                      .getByRole("tab", { name: "Sent", exact: true })
                      .click();
                    assert.equal(
                      await pane.locator("pre.grpc-message").textContent(),
                      spec.preview,
                    );
                    await pane
                      .getByRole("status")
                      .filter({ hasText: "Showing a preview" })
                      .waitFor();
                    await pane
                      .getByRole("tab", { name: "Response", exact: true })
                      .click();
                  }
                  const container = page.locator(
                    receives ? ".grpc-response" : ".request-compose",
                  );
                  assert.equal(
                    await container.locator("pre.grpc-message").textContent(),
                    spec.preview,
                  );
                  await container
                    .getByRole("status")
                    .filter({ hasText: "Showing a preview" })
                    .waitFor();
                };
                /** @type {Record<string,any>[]} */ const exports = [];
                const exportFull = async (/** @type {string} */ phase) => {
                  const path = join(directory, mode + "-" + phase + ".json");
                  const saving = respondToOwnedSaveDialog(
                    pid,
                    directory,
                    path,
                    ".json",
                  );
                  void saving.catch(() => {});
                  try {
                    await button("Save response").click();
                  } finally {
                    await saving;
                  }
                  await poll(
                    () => Bun.file(path).exists(),
                    "Full gRPC response export",
                  );
                  const saved = await Bun.file(path).json();
                  assert.equal(
                    saved.events.find(
                      (/** @type {any} */ e) =>
                        e.kind === (receives ? "message" : "sent"),
                    ).text,
                    body,
                  );
                  exports.push({
                    phase,
                    path,
                    bytes: Bun.file(path).size,
                    payloadSHA256: bodySHA256,
                  });
                };
                await verifyPreview();
                await exportFull("terminal");
                await page.reload();
                await resourceSaved(page);
                const reloaded = await invoke("load_workspace");
                assert.deepEqual(
                  reloaded.history.find(
                    (/** @type {any} */ r) => r._id === entry._id,
                  ),
                  entry,
                );
                assert.equal(
                  reloaded.resources.find(
                    (/** @type {any} */ r) => r._id === request._id,
                  ).body.text,
                  body,
                );
                await verifyPreview();
                await exportFull("reloaded");
                assert.deepEqual(
                  reloaded.history.filter(
                    (/** @type {any} */ r) => r.requestId !== request._id,
                  ),
                  original.history,
                );
                const record = fixture.records.find((r) => r.mode === mode);
                assert.ok(record?.verified);
                const dialog = await manageResource(page, request.name);
                await dialog
                  .getByRole("button", { name: "Delete…", exact: true })
                  .click();
                await dialog
                  .getByRole("button", { name: "Delete", exact: true })
                  .click();
                await resourceSaved(page);
                await page.reload();
                await resourceSaved(page);
                assert.deepEqual(
                  (await invoke("load_workspace")).history,
                  original.history,
                );
                checks.push({
                  mode,
                  unary,
                  bodyBytes: Buffer.byteLength(body),
                  bodySHA256,
                  historyId: entry._id,
                  sent: sent.length,
                  received: messages.length,
                  previewCharacters: spec.preview.length,
                  exports,
                  status: entry.status,
                  wireSHA256: record.wireSHA256,
                  exactReload: true,
                  streamTabRestored: !receives,
                  deletedWithoutResurrection: true,
                });
                await Bun.write(
                  join(directory, "grpc-large-sent-progress.json"),
                  JSON.stringify({ checks }, null, 2),
                );
              }
            } finally {
              clearTimeout(watchdog);
            }
          },
          options,
        );
      },
      { ...options, lazyCapture: true },
    );
  } catch (error) {
    errors.push(error);
  }
  let retirement;
  try {
    retirement = await fixture.closeAfterHostExit();
  } catch (error) {
    errors.push(error);
  }
  if (output)
    await Bun.write(
      join(output, "grpc-large-sent-acceptance.json"),
      JSON.stringify(
        {
          passed: !errors.length,
          renderingMode: "native-hidden",
          checks,
          retirement,
          records: fixture.records,
          errorEvents: fixture.errorEvents,
          errors: errors.map(String),
          scope:
            "Actual native ten-case9MiB/compact-array/Unicode preview, full history/reload/JSON export in legacy/protoJson bidi/unary. No broad JSON/provider/platform claim.",
        },
        null,
        2,
      ),
    );
  if (errors.length)
    throw new AggregateError(
      errors,
      "Large gRPC sent native acceptance failed",
    );
}
