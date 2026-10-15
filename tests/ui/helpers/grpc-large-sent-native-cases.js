import assert from "node:assert/strict";
import {
  grpcLargeCase,
  grpcLargeModes,
  grpcLargeProto,
  grpcLargeAdditionalProtos,
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
export async function runGrpcLargeSentNativeCases({
  base64Only = false,
  numericOnly = false,
  longOnly = false,
  overflowOnly = false,
  oneofOnly = false,
  orderOnly = false,
  mapOnly = false,
  surrogateOnly = false,
  anyUrlOnly = false,
  anyTargetOnly = false,
  anyOrderOnly = false,
} = {}) {
  const variants = [
    {
      enabled: anyOrderOnly,
      tag: "legacy-anyorder-",
      scenario: "grpc-any-order-native",
    },
    {
      enabled: anyTargetOnly,
      tag: "legacy-anytarget-",
      scenario: "grpc-any-target-native",
    },
    {
      enabled: anyUrlOnly,
      tag: "legacy-anyurl-",
      scenario: "grpc-any-url-native",
    },
    {
      enabled: surrogateOnly,
      tag: "legacy-surrogate-",
      scenario: "grpc-surrogate-native",
    },
    { enabled: mapOnly, tag: "legacy-map-", scenario: "grpc-map-native" },
    {
      enabled: orderOnly,
      tag: "legacy-order-",
      scenario: "grpc-message-order-native",
    },
    { enabled: oneofOnly, tag: "legacy-oneof-", scenario: "grpc-oneof-native" },
    {
      enabled: overflowOnly,
      tag: "legacy-overflow-",
      scenario: "grpc-overflow-native",
    },
    { enabled: longOnly, tag: "legacy-long-", scenario: "grpc-long-native" },
    {
      enabled: numericOnly,
      tag: "legacy-numeric-",
      scenario: "grpc-numeric-native",
    },
    {
      enabled: base64Only,
      tag: "legacy-base64-",
      scenario: "grpc-base64-native",
    },
  ];
  assert.ok(variants.filter((variant) => variant.enabled).length <= 1);
  const selected = variants.find((variant) => variant.enabled);
  const scenario = selected?.scenario ?? "grpc-large-sent-native";
  const modes = grpcLargeModes.filter((mode) =>
    selected
      ? mode.startsWith(selected.tag)
      : !variants.some((variant) => mode.startsWith(variant.tag)),
  );
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
          scenario,
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
                  ...grpcLargeAdditionalProtos.map((file, index) => ({
                    _id: protoId + "_dependency_" + index,
                    _type: "proto_file",
                    parentId: workspaceId,
                    name: file.name,
                    protoText: file.text,
                  })),
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
              for (const mode of modes) {
                const spec = grpcLargeCase(mode),
                  body = spec.body,
                  bodySHA256 = createHash("sha256").update(body).digest("hex");
                const payloadSHA256 = createHash("sha256")
                  .update(spec.responseText)
                  .digest("hex");
                const unary = spec.unary;
                const receives = spec.receives;
                const startButton = unary ? "Send" : "Connect";
                const request = newRequest(workspaceId, {
                  _id: "greq_" + mode + "_" + suffix,
                  _type: "grpc_request",
                  name: "Owned large " + mode,
                  url: fixture.url,
                  protoFileId:
                    "protoEntry" in spec
                      ? protoId +
                        "_dependency_" +
                        grpcLargeAdditionalProtos.findIndex(
                          (file) => file.name === spec.protoEntry,
                        )
                      : protoId,
                  protoMethodName: spec.method,
                  grpcJsonMode: spec.jsonMode,
                  body: {
                    mimeType: "application/json",
                    text: spec.editor ? "{}" : body,
                  },
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
                if (spec.editor) {
                  const editorRegion = page.getByRole("region", {
                    name: "Body editor",
                    exact: true,
                  });
                  const codeMirror = editorRegion.locator(".CodeMirror");
                  await codeMirror.waitFor();
                  await poll(
                    () =>
                      codeMirror.evaluate(
                        (element) =>
                          !!(
                            /** @type {any} */ (
                              element
                            ).CodeMirror?.getInputField()?.isConnected
                          ),
                      ),
                    "Actual gRPC CodeMirror mounted",
                  );
                  await editorRegion
                    .getByRole("textbox", {
                      name: "gRPC JSON message",
                      exact: true,
                    })
                    .focus();
                  await poll(
                    () =>
                      codeMirror.evaluate((element) =>
                        /** @type {any} */ (element).CodeMirror.hasFocus(),
                      ),
                    "Actual gRPC CodeMirror has focus before keyboard input",
                  );
                  await page.keyboard.press("Control+A");
                  await page.keyboard.insertText(body);
                  const persistedBody = async () =>
                    (await invoke("load_workspace")).resources.find(
                      (/** @type {any} */ r) => r._id === request._id,
                    ).body.text;
                  await poll(
                    async () => (await persistedBody()) === body,
                    "Actual gRPC CodeMirror typing persisted",
                  );
                  await button("Format").click();
                  await poll(
                    async () => (await persistedBody()) === spec.formattedBody,
                    "Format preserves authored int64 lexeme",
                  );
                  await page
                    .getByRole("tab", { name: "Settings", exact: true })
                    .click();
                  const encoding = page.getByRole("combobox", {
                    name: "Message JSON format",
                    exact: true,
                  });
                  await encoding.selectOption(
                    spec.jsonMode === "legacy" ? "protoJson" : "legacy",
                  );
                  await resourceSaved(page);
                  assert.equal(await persistedBody(), spec.formattedBody);
                  await encoding.selectOption(spec.jsonMode);
                  await resourceSaved(page);
                  assert.equal(await persistedBody(), spec.formattedBody);
                  await page
                    .getByRole("tab", { name: "Body", exact: true })
                    .click();
                  assert.equal(
                    await editorRegion
                      .locator(".CodeMirror")
                      .evaluate((element) =>
                        /** @type {any} */ (element).CodeMirror.getValue(),
                      ),
                    spec.formattedBody,
                  );
                }
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
                let entry = saved.history.find(
                  (/** @type {any} */ r) => r.requestId === request._id,
                );
                assert.ok(entry);
                assert.equal(entry.protocol, "grpc");
                /** @type {any} */ let failureRecovery;
                if ("expectedError" in spec) {
                  const failed = structuredClone(entry);
                  assert.equal(failed.connectionState, "error");
                  const failures = failed.events.filter(
                    (/** @type {any} */ e) => e.kind === "error",
                  );
                  assert.equal(failures.length, 1);
                  assert.ok(
                    JSON.stringify(failures[0]).includes(
                      String(spec.expectedError),
                    ),
                  );
                  assert.equal(
                    failed.events.filter(
                      (/** @type {any} */ e) =>
                        e.kind === "sent" || e.kind === "message",
                    ).length,
                    0,
                  );
                  const counts = [
                    fixture.records.length,
                    fixture.sessionRecords.length,
                    fixture.socketRecords.length,
                  ];
                  const snapshot = join(
                    directory,
                    mode + "-error-history.json",
                  );
                  await Bun.write(snapshot, JSON.stringify(failed, null, 2));
                  await page.reload();
                  await resourceSaved(page);
                  const afterErrorReload = await invoke("load_workspace");
                  assert.deepEqual(
                    afterErrorReload.history.find(
                      (/** @type {any} */ r) => r._id === failed._id,
                    ),
                    failed,
                  );
                  assert.equal(
                    afterErrorReload.resources.find(
                      (/** @type {any} */ r) => r._id === request._id,
                    ).body.text,
                    spec.formattedBody,
                  );
                  assert.deepEqual(
                    [
                      fixture.records.length,
                      fixture.sessionRecords.length,
                      fixture.socketRecords.length,
                    ],
                    counts,
                  );
                  fixture.recoverMode(mode);
                  await button("Load methods").click();
                  await poll(
                    () => button("Send").isEnabled(),
                    "Method ready for explicit retry",
                  );
                  await button("Send").click();
                  await poll(
                    async () =>
                      (await button("Send").isVisible()) &&
                      (await button("Send").isEnabled()),
                    "Map recovery retires",
                    60000,
                  );
                  await resourceSaved(page);
                  const recovered = await invoke("load_workspace");
                  assert.deepEqual(
                    recovered.history.find(
                      (/** @type {any} */ r) => r._id === failed._id,
                    ),
                    failed,
                  );
                  entry = recovered.history.find(
                    (/** @type {any} */ r) =>
                      r.requestId === request._id && r._id !== failed._id,
                  );
                  assert.ok(entry);
                  assert.equal(
                    fixture.records.filter((r) => r.mode === mode).length,
                    2,
                  );
                  failureRecovery = {
                    failedHistory: failed,
                    snapshot,
                    zeroPayloadOnFailure: true,
                    exactErrorReload: true,
                    noImplicitRetry: true,
                    explicitPeerRepairAndUiRetry: true,
                  };
                }

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
                assert.equal(retained.text, spec.responseText);
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
                  const previewNotice = container
                    .getByRole("status")
                    .filter({ hasText: "Showing a preview" });
                  if (spec.showNotice) await previewNotice.waitFor();
                  else assert.equal(await previewNotice.count(), 0);
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
                    spec.responseText,
                  );
                  exports.push({
                    phase,
                    path,
                    bytes: Bun.file(path).size,
                    payloadSHA256,
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
                  spec.formattedBody,
                );
                if (failureRecovery)
                  assert.deepEqual(
                    reloaded.history.find(
                      (/** @type {any} */ r) =>
                        r._id === failureRecovery.failedHistory._id,
                    ),
                    failureRecovery.failedHistory,
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
                  payloadSHA256,
                  payloadBytes: Buffer.byteLength(spec.responseText),
                  editorFormatAndModeSwitch: spec.editor,
                  persistedBodySHA256: createHash("sha256")
                    .update(spec.formattedBody)
                    .digest("hex"),
                  failureRecovery,
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
          sessionRecords: fixture.sessionRecords,
          socketRecords: fixture.socketRecords,
          errorEvents: fixture.errorEvents,
          errors: errors.map(String),
          scope: anyOrderOnly
            ? "Ten pinned declaration-order/main-before-import Any cases through actual selectable proto entry, editor, wire, history, reload and Save. Service-first shadow refusal/repair is in JSON-refusal. Concurrent sibling import timing and source-info-free reflection remain separate open gates."
            : anyTargetOnly
              ? "Twenty pinned Any reflection lookup/WKT cases through actual editor, wire, history, reload and Save: relative/nested messages, unknown and hidden targets, raw wrapper context, WKT spelling and absent/explicit-empty payloads. Refusal/typed repair is in JSON-refusal. Ambiguous loader/declaration order and broader provider/platform gates remain open."
              : anyUrlOnly
                ? "Fourteen Any URL cases: normal/dotted/surrogate prefixes,39/40unit threshold after normalization, nested Any and unknown-type fallback through real editor/wire/history/reload/export. Native wrong-type refusal/typed repair is in JSON-refusal scenario. Broader Any/WKT/provider/platform gates remain open."
                : surrogateOnly
                  ? "Thirteen legacy surrogate cases: scalar/list/map,39/40UTF16unit boundaries, collisions/coercions/unknown fields and explicit empty strings through real editor/wire/history/reload/export. Standard refusal is covered by JSON-refusal scenario; broader provider/platform gates remain open."
                  : mapOnly
                    ? "Nine legacy map cases including missing-message-value durable refusal and explicit peer repair/retry; exact editor/wire/history/reload/export. Broader provider/platform gates remain open."
                    : orderOnly
                      ? "Eight exact legacy message-field ordering cases: defaults, normal/message fields, multiple repeated/map categories, oneof selectors and nested containers through real editor/wire/history/reload/export. Map entry-key and lone-surrogate order remain open."
                      : oneofOnly
                        ? "Six legacy oneof cases: conflicting/default/list/map members, reversed input and response wire, real editor/Format/mode switch/history/reload/export. JSON key-order and broader provider/platform compatibility remain open."
                        : overflowOnly
                          ? "Eight legacy JSON numeric overflow/underflow cases through actual editor/Format/mode switch and exact double/int32/int64/string wire/history/reload/export. Broader JSON/provider/platform gates remain open."
                          : longOnly
                            ? "Six legacy signed/unsigned64 whitespace/chunk/sign cases through actual editor/Format/mode switch and full wire/history/reload/export. Broader coercion/provider/platform gates remain open."
                            : numericOnly
                              ? "Four legacy numeric-whitespace cases through actual editor/Format/mode switch, exact int32/double frames, response/history/reload/export. Other coercion/provider/platform gates remain open."
                              : base64Only
                                ? "Six legacy Base64 byte/frame/history/reload/export cases. Other Base64, ProtoJSON and provider/platform gates remain open."
                                : "Actual native fourteen-case9MiB/compact-array/Unicode plus typed int64/bytes shared-editor Format/mode-switch/history/export in legacy/protoJson. No broad JSON/provider/platform claim.",
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
