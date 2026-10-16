import {
  grpcObjectPrimitiveRefusals,
  grpcObjectPrimitiveSmokeRefusals,
} from "./grpc-object-primitive-case-data.js";
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
import {
  grpcLargeCase,
  grpcLargeProto,
  grpcLargeAdditionalProtos,
} from "./grpc-large-case-data.js";
import { createGrpcLargeSentFixture } from "./grpc-large-sent-fixture.js";
import { handleGrpcProfileReflection } from "./grpc-reflection-profile-wire.js";
import { grpcBytesArraylikeRefusals } from "./grpc-bytes-arraylike-case-data.js";
import { grpcAnyTargetRefusals as targetRefusals } from "./grpc-any-target-case-data.js";
import {
  grpcAnyOrderRefusals,
  grpcAnyOrderRefusalEntry,
} from "./grpc-any-order-case-data.js";
const grpcAnyTargetRefusals = { ...targetRefusals, ...grpcAnyOrderRefusals };
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
const hash = (/** @type {string|Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** Real parse refusal, zero peer IO, durable error and explicit body repair. */
export async function runGrpcJsonRefusalNativeCases({
  reflectionOnly = false,
  objectPrimitiveOnly = false,
  bytesArraylikeOnly = false,
} = {}) {
  assert.ok(
    [reflectionOnly, bytesArraylikeOnly, objectPrimitiveOnly].filter(Boolean)
      .length <= 1,
  );
  const authoredOnly = bytesArraylikeOnly || objectPrimitiveOnly;
  const authoredRefusals = objectPrimitiveOnly
    ? process.env.INSOMNIUM_GRPC_OBJECT_PRIMITIVE_MATRIX === "1"
      ? grpcObjectPrimitiveRefusals
      : grpcObjectPrimitiveSmokeRefusals
    : grpcBytesArraylikeRefusals;
  assert.ok(
    process.env.INSOMNIUM_UI_BUILD_STATE &&
      process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
  );
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
    allowParentTermination: true,
  };
  const fixture = await createGrpcLargeSentFixture({
    handleDiscovery:
      reflectionOnly || authoredOnly ? handleGrpcProfileReflection : null,
  });
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
          objectPrimitiveOnly
            ? "grpc-object-primitive-refusal-native"
            : bytesArraylikeOnly
              ? "grpc-bytes-arraylike-refusal-native"
              : reflectionOnly
                ? "grpc-reflection-refusal-native"
                : "grpc-json-refusal-native",
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
            const button = (/** @type {string} */ label) =>
              page.getByRole("button", { name: label, exact: true });
            const load = () => invoke("load_workspace");
            const watchdog = setTimeout(() => {
              errors.push("Owned native refusal UI exceeded300seconds");
              void terminateParent().catch((error) => errors.push(error));
            }, 300000);
            try {
              for (const jsonMode of reflectionOnly || authoredOnly
                ? ["legacy"]
                : ["legacy", "protoJson"])
                for (const kind of authoredOnly
                  ? Object.keys(authoredRefusals)
                  : reflectionOnly
                    ? ["reflection-map-object", "any-reflection-field"]
                    : [
                        "invalid-json",
                        "unknown-field",
                        "invalid-base64",
                        "excess-base64-padding",
                        ...(jsonMode === "protoJson"
                          ? ["unpaired-surrogate"]
                          : []),
                        ...(jsonMode === "legacy"
                          ? [
                              "any-number",
                              "any-array",
                              "any-object",
                              "any-enum",
                              ...Object.keys(grpcAnyTargetRefusals),
                            ]
                          : []),
                      ]) {
                  const label = jsonMode + "-" + kind,
                    spec = grpcLargeCase(
                      authoredOnly
                        ? authoredRefusals[kind].mode
                        : reflectionOnly
                          ? kind === "reflection-map-object"
                            ? "legacy-profile-entry-array-key-value-reflection"
                            : "legacy-profile-any-input-reflection"
                          : kind.startsWith("any-")
                            ? "legacy-anyurl-plain"
                            : jsonMode + "-json-string",
                    );
                  const initial = authoredOnly
                    ? authoredRefusals[kind].body
                    : kind === "reflection-map-object"
                      ? '{"labels":{"owned":0}}'
                      : kind === "any-reflection-field"
                        ? '{"@type":"types/google.protobuf.Any.value"}'
                        : kind === "invalid-json"
                          ? '{"exact_value":'
                          : kind.startsWith("any-")
                            ? JSON.stringify({
                                ...JSON.parse(spec.body),
                                "@type":
                                  kind === "any-number"
                                    ? 7
                                    : kind === "any-array"
                                      ? ["ownedlarge.AnyText"]
                                      : kind === "any-object"
                                        ? { owned: true }
                                        : (grpcAnyTargetRefusals[
                                            /** @type {keyof typeof grpcAnyTargetRefusals} */ (
                                              kind
                                            )
                                          ] ?? "types/ownedlarge.AnyFlag"),
                              })
                            : kind === "unpaired-surrogate"
                              ? spec.body.replace("9007199254740993", "\\ud800")
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
                    protoFileId: authoredOnly
                      ? kind.endsWith("-reflection")
                        ? null
                        : protoId +
                          "_dependency_" +
                          grpcLargeAdditionalProtos.findIndex(
                            (file) =>
                              file.name ===
                              (objectPrimitiveOnly
                                ? "primitive.proto"
                                : "arraylike.proto"),
                          )
                      : reflectionOnly
                        ? null
                        : kind.startsWith("any-order-")
                          ? protoId +
                            "_dependency_" +
                            grpcLargeAdditionalProtos.findIndex(
                              (file) => file.name === grpcAnyOrderRefusalEntry,
                            )
                          : protoId,
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
                    const pattern = objectPrimitiveOnly
                      ? /Cannot convert object to primitive value\./
                      : bytesArraylikeOnly
                        ? authoredRefusals[kind].kind === "leading"
                          ? /Legacy repeated bytes contain an unwritten array element\./
                          : /gRPC bytes exceed 20 MiB\./
                        : kind === "reflection-map-object"
                          ? /ownedreflection\.Input\.labels: array expected/
                          : kind === "any-reflection-field"
                            ? /Legacy Any @type does not name a message\./
                            : frontend
                              ? /SyntaxError:.*JSON/i
                              : kind.startsWith("any-")
                                ? kind === "any-enum" ||
                                  Object.hasOwn(grpcAnyTargetRefusals, kind)
                                  ? /Legacy Any @type does not name a message\./
                                  : /Legacy Any @type requires a string\./
                                : kind === "unpaired-surrogate"
                                  ? /Invalid gRPC message:.*(?:surrogate|hex escape)/i
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
                  if (authoredOnly)
                    assert.equal(
                      await page
                        .locator(".inline-error")
                        .filter({
                          hasText:
                            /Cannot convert object to primitive value|Legacy repeated bytes|gRPC bytes exceed/,
                        })
                        .count(),
                      0,
                      "Repair clears the byte conversion diagnostic",
                    );
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
                    reflectionOnly || authoredOnly || kind.startsWith("any-")
                      ? hash(spec.wire)
                      : "9e0cc9c83819dbf4a21cbe515dc4d10e0b03bafc1a9aaba3e96b52a19130fc08",
                  );
                  assert.equal(
                    record.receivedBytes,
                    reflectionOnly || authoredOnly || kind.startsWith("any-")
                      ? spec.wire.length
                      : 19,
                  );
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
                    /** @type {any} */ let exported;
                    const expectedBytes = Buffer.byteLength(
                      JSON.stringify(success, null, 2),
                    );
                    await poll(async () => {
                      try {
                        const bytes = await Bun.file(path).bytes();
                        assert.ok(
                          bytes.length <= expectedBytes,
                          "Export exceeds the complete history snapshot",
                        );
                        if (bytes.length < expectedBytes) return false;
                        exported = JSON.parse(Buffer.from(bytes).toString());
                        return true;
                      } catch (error) {
                        const code = /** @type {NodeJS.ErrnoException} */ (
                          error
                        ).code;
                        if (code === "EBUSY" || code === "ENOENT") return false;
                        throw error;
                      }
                    }, "Refusal recovery complete export");
                    assert.deepEqual(exported, success);
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
          discoveryRecords: fixture.discoveryRecords,
          sessionRecords: fixture.sessionRecords,
          socketRecords: fixture.socketRecords,
          errorEvents: fixture.errorEvents,
          errors: errors.map(String),
          scope: objectPrimitiveOnly
            ? "Representative JSON-only own toString refusals: twelve cases by default, full thirty-four-case matrix only with INSOMNIUM_GRPC_OBJECT_PRIMITIVE_MATRIX=1. Zero additional peer IO, durable error/reload, typed repair and Save. Exhaustive values remain in the Rust oracle."
            : bytesArraylikeOnly
              ? "Four native legacy bytes refusals across saved files/reflection: sparse leading hole and oversized nonzero-wrapped length, zero additional peer IO, durable error/reload, explicit typed repair, exact history/Save and original-profile restoration."
              : reflectionOnly
                ? "Two real reflection legacy parse refusals: map object and known non-message Any target, with zero additional peer IO after schema discovery, durable error/reload, actual typed repair, history and Save. Discovery and business telemetry remain distinct; no broader alias/provider/platform claim."
                : "Twenty-three actual native UI cases including legacy Any wrong-type and reflection non-message/WKT-alias/declaration-order-service-shadow refusals/typed repairs, plus strict ProtoJSON unpaired-surrogate refusal/typed repair: renderer JSON refusal, native unknown-field and malformed/excess-padding Base64 refusal with durable errors, legacy unknown-field acceptance, zero observed peer IO and typed repair/reload/export. No full JSON/provider/platform claim.",
        },
        null,
        2,
      ),
    );
  if (errors.length)
    throw new AggregateError(errors, "gRPC JSON refusal acceptance failed");
}
