import assert from "node:assert/strict";
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
import { grpcLargeCase, grpcLargeProto } from "./grpc-large-case-data.js";
import { createGrpcLargeSentFixture } from "./grpc-large-sent-fixture.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
const hash = (/** @type {string|Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** Real parse refusal, zero peer IO, durable error and explicit body repair. */
export async function runGrpcJsonRefusalNativeCases() {
  assert.ok(
    process.env.INSOMNIUM_UI_BUILD_STATE &&
      process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
  );
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
    allowParentTermination: true,
  };
  const fixture = await createGrpcLargeSentFixture();
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {unknown[]} */ const errors = [];
  /** @type {string|undefined} */ let output;
  const counts = () => ({
    streams: fixture.records.length,
    sessions: fixture.sessionRecords.length,
    sockets: fixture.socketRecords.length,
  });
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "grpc-json-refusal-native",
          async ({ page, invoke, output: directory, pid, terminateParent }) => {
            output = directory;
            page.setDefaultTimeout(60000);
            page.on("pageerror", (error) => errors.push(error));
            await resourceSaved(page);
            await capture();
            const original = await invoke("load_workspace");
            assert.ok(
              Buffer.byteLength(JSON.stringify(original.history)) <
                4 * 1024 * 1024,
            );
            const suffix = crypto.randomUUID().replaceAll("-", ""),
              workspaceId = "wrk_grpc_refusal_" + suffix,
              protoId = "pf_grpc_refusal_" + suffix,
              name = "Owned gRPC refusal " + suffix;
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
                    name: "refusal.proto",
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
            const button = (/** @type {string} */ label) =>
              page.getByRole("button", { name: label, exact: true });
            const load = () => invoke("load_workspace");
            const watchdog = setTimeout(() => {
              errors.push("Owned native refusal UI exceeded180seconds");
              void terminateParent().catch((error) => errors.push(error));
            }, 180000);
            try {
              for (const jsonMode of ["legacy", "protoJson"])
                for (const kind of [
                  "invalid-json",
                  "unknown-field",
                  "invalid-base64",
                  "excess-base64-padding",
                ]) {
                  const label = jsonMode + "-" + kind,
                    spec = grpcLargeCase(jsonMode + "-json-string");
                  const initial =
                    kind === "invalid-json"
                      ? '{"exact_value":'
                      : kind === "unknown-field"
                        ? spec.body.slice(0, -1) + ',"unrecognized":7}'
                        : spec.body.replace(
                            "AP+A",
                            kind === "invalid-base64" ? "@" : "Zg===",
                          );
                  const refuses =
                    kind !== "unknown-field" || jsonMode === "protoJson";
                  const request = newRequest(workspaceId, {
                    _id: "greq_refusal_" + label + "_" + suffix,
                    _type: "grpc_request",
                    name: "Owned refusal " + label,
                    url: fixture.url,
                    protoFileId: protoId,
                    protoMethodName: spec.method,
                    grpcJsonMode: jsonMode,
                    body: { mimeType: "application/json", text: initial },
                    metadata: [{ name: "owned-case", value: spec.mode }],
                  });
                  const before = await load();
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
                  const loadMethod = async () => {
                    await button("Load methods").click();
                    await poll(
                      async () => await button("Send").isEnabled(),
                      "Refusal schema method ready",
                    );
                  };
                  const send = async () => {
                    await button("Send").click();
                    await poll(
                      async () =>
                        (await button("Send").isVisible()) &&
                        (await button("Send").isEnabled()),
                      "Refusal call and persistence retire",
                      60000,
                    );
                    await resourceSaved(page);
                  };
                  await loadMethod();
                  const ioBefore = counts();
                  await send();
                  const first = (await load()).history.find(
                    (/** @type {any} */ h) => h.requestId === request._id,
                  );
                  /** @type {Record<string,any>|undefined} */ let refused;
                  let refusalError;
                  if (refuses) {
                    const frontend = kind === "invalid-json";
                    const pattern = frontend
                      ? /SyntaxError:.*JSON/i
                      : kind === "unknown-field"
                        ? /Invalid gRPC message: unrecognized field name 'unrecognized'/i
                        : jsonMode === "legacy"
                          ? /Invalid legacy base64 bytes\./
                          : /Invalid gRPC message: invalid base64:/i;
                    const feedback = page
                      .locator(".inline-error")
                      .filter({ hasText: pattern })
                      .first();
                    await feedback.waitFor();
                    refusalError = await feedback.textContent();
                    assert.match(String(refusalError), pattern);
                    if (frontend) {
                      assert.equal(
                        first,
                        undefined,
                        "Renderer parse refusal must not fabricate call history",
                      );
                      assert.equal(
                        (await load()).history.filter(
                          (/** @type {any} */ h) => h.requestId === request._id,
                        ).length,
                        0,
                      );
                    } else {
                      assert.ok(first);
                      refused = first;
                      assert.equal(first.connectionState, "error");
                      const failures = first.events.filter(
                        (/** @type {any} */ e) => e.kind === "error",
                      );
                      assert.equal(failures.length, 1);
                      assert.match(failures[0].message, pattern);
                      assert.equal(
                        first.events.filter((/** @type {any} */ e) =>
                          ["sent", "message"].includes(e.kind),
                        ).length,
                        0,
                      );
                    }
                    assert.deepEqual(
                      counts(),
                      ioBefore,
                      "Parse refusal must not create peer stream/session/socket",
                    );
                    await page.reload();
                    await resourceSaved(page);
                    const failedReload = await load();
                    const refusedId = refused?._id;
                    if (refused)
                      assert.deepEqual(
                        failedReload.history.find(
                          (/** @type {any} */ h) => h._id === refusedId,
                        ),
                        refused,
                      );
                    else
                      assert.equal(
                        failedReload.history.filter(
                          (/** @type {any} */ h) => h.requestId === request._id,
                        ).length,
                        0,
                      );
                    assert.equal(
                      failedReload.resources.find(
                        (/** @type {any} */ r) => r._id === request._id,
                      ).body.text,
                      initial,
                    );
                    assert.deepEqual(
                      counts(),
                      ioBefore,
                      "Reload must not dispatch refused history",
                    );
                    const region = page.getByRole("region", {
                        name: "Body editor",
                        exact: true,
                      }),
                      cm = region.locator(".CodeMirror");
                    await cm.waitFor();
                    await poll(
                      () =>
                        cm.evaluate(
                          (element) =>
                            !!(
                              /** @type {any} */ (
                                element
                              ).CodeMirror?.getInputField()?.isConnected
                            ),
                        ),
                      "Refusal repair editor mounted",
                    );
                    await region
                      .getByRole("textbox", {
                        name: "gRPC JSON message",
                        exact: true,
                      })
                      .focus();
                    await poll(
                      () =>
                        cm.evaluate((element) =>
                          /** @type {any} */ (element).CodeMirror.hasFocus(),
                        ),
                      "Refusal repair editor focused",
                    );
                    await page.keyboard.press("Control+A");
                    await page.keyboard.insertText(spec.body);
                    await poll(
                      async () =>
                        (await load()).resources.find(
                          (/** @type {any} */ r) => r._id === request._id,
                        ).body.text === spec.body,
                      "Actual repair typing persisted",
                    );
                    await loadMethod();
                    await send();
                  }
                  const saved = await load(),
                    success = saved.history.find(
                      (/** @type {any} */ h) => h.requestId === request._id,
                    );
                  assert.ok(success);
                  assert.equal(success.connectionState, "closed");
                  assert.equal(success.status, 0);
                  const historyCount = saved.history.filter(
                    (/** @type {any} */ h) => h.requestId === request._id,
                  ).length;
                  assert.equal(historyCount, refused ? 2 : 1);
                  assert.equal(
                    await page
                      .locator(".inline-error")
                      .filter({
                        hasText:
                          /SyntaxError:.*JSON|unrecognized field name 'unrecognized'/i,
                      })
                      .count(),
                    0,
                    "Successful repair must clear its prior diagnostic",
                  );
                  if (refused) assert.notEqual(success._id, refused._id);
                  const messages = success.events.filter(
                    (/** @type {any} */ e) => e.kind === "message",
                  );
                  assert.equal(messages.length, 1);
                  assert.equal(messages[0].text, spec.responseText);
                  assert.equal(fixture.records.length, ioBefore.streams + 1);
                  const record = fixture.records.at(-1);
                  assert.ok(record?.verified);
                  assert.equal(record.mode, spec.mode);
                  assert.equal(
                    record.wireSHA256,
                    "9e0cc9c83819dbf4a21cbe515dc4d10e0b03bafc1a9aaba3e96b52a19130fc08",
                  );
                  assert.equal(record.receivedBytes, 19);
                  /** @type {Record<string,any>[]} */ const exports = [];
                  const saveFull = async (/** @type {string} */ phase) => {
                    const path = join(directory, label + "-" + phase + ".json"),
                      saving = respondToOwnedSaveDialog(
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
                      "Refusal recovery full export",
                    );
                    const exported = await Bun.file(path).json();
                    assert.equal(
                      exported.events.find(
                        (/** @type {any} */ e) => e.kind === "message",
                      ).text,
                      spec.responseText,
                    );
                    exports.push({
                      phase,
                      path,
                      bytes: Bun.file(path).size,
                      payloadSHA256: hash(spec.responseText),
                    });
                  };
                  await saveFull("terminal");
                  await page.reload();
                  await resourceSaved(page);
                  const reloaded = await load();
                  assert.deepEqual(
                    reloaded.history.find(
                      (/** @type {any} */ h) => h._id === success._id,
                    ),
                    success,
                  );
                  if (refused)
                    assert.deepEqual(
                      reloaded.history.find(
                        (/** @type {any} */ h) => h._id === refused._id,
                      ),
                      refused,
                    );
                  const expectedBody = refuses ? spec.body : initial;
                  assert.equal(
                    reloaded.resources.find(
                      (/** @type {any} */ r) => r._id === request._id,
                    ).body.text,
                    expectedBody,
                  );
                  assert.deepEqual(
                    reloaded.history.filter(
                      (/** @type {any} */ h) => h.requestId !== request._id,
                    ),
                    original.history,
                  );
                  await saveFull("reloaded");
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
                  assert.deepEqual((await load()).history, original.history);
                  checks.push({
                    label,
                    jsonMode,
                    kind,
                    firstOutcome: refuses ? "refused" : "accepted",
                    refusalError,
                    refusedHistoryId: refused?._id,
                    refusalNoPeerIo: refuses,
                    refusalBoundary: refuses
                      ? kind === "invalid-json"
                        ? "renderer"
                        : "native"
                      : null,
                    noFabricatedHistory: kind === "invalid-json",
                    ioBefore,
                    successHistoryId: success._id,
                    repairTyped: refuses,
                    initialBodySHA256: hash(initial),
                    persistedBodySHA256: hash(expectedBody),
                    wireSHA256: record.wireSHA256,
                    payloadSHA256: hash(spec.responseText),
                    exports,
                    exactErrorReload: !!refused,
                    exactSuccessReload: true,
                    historyCount,
                    diagnosticCleared: true,
                    deletedWithoutResurrection: true,
                  });
                  await Bun.write(
                    join(directory, "grpc-json-refusal-progress.json"),
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
      join(output, "grpc-json-refusal-acceptance.json"),
      JSON.stringify(
        {
          passed: !errors.length,
          checks,
          retirement,
          records: fixture.records,
          errorEvents: fixture.errorEvents,
          errors: errors.map(String),
          scope:
            "Eight actual native UI cases: renderer JSON refusal, native unknown-field and malformed/excess-padding Base64 refusal with durable errors, legacy unknown-field acceptance, zero observed peer IO and typed repair/reload/export. No full JSON/provider/platform claim.",
        },
        null,
        2,
      ),
    );
  if (errors.length)
    throw new AggregateError(errors, "gRPC JSON refusal acceptance failed");
}
