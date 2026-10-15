import assert from "node:assert/strict";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parseLegacyFiles } from "../../../src/lib/legacy-import.js";
import { parseImport } from "../../../src/lib/import-export.js";
import { withNativeApp, poll, resourceCrudProbeIdentifier } from "./native-app.js";
import { withResourceProbePreserved, registerResourceProbeCollection, resourceSaved } from "./resource-manager-cases.js";
import { respondToOwnedOpenDialog } from "./windows-open-dialog.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
import { createLegacyProtoFixture, legacyProtoRecords } from "./legacy-proto-fixture.js";

/** Actual NeDB chooser, Rust compiler and owned cleartext HTTP2 unary exchange.
 * IPC tracing observes original requests/responses without altering them. */
export async function runLegacyProtoNativeCases() {
  assert.equal(process.platform, "win32");
  const markerPath = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(markerPath);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = { expectedIdentifier: resourceCrudProbeIdentifier, profileOwnershipPath: markerPath };
  /** @type {Awaited<ReturnType<typeof createLegacyProtoFixture>>|undefined} */ let fixture;
  let evidenceOutput = "";
  /** @type {Record<string,any>} */ let acceptance = { passed: false };
  /** @type {unknown[]} */ const failures = [];
  try {
    await withResourceProbePreserved(async capture => {
      await withNativeApp("legacy-proto-import-native", async ({ page, invoke, output, pid }) => {
        evidenceOutput = output;
        const marker = await Bun.file(markerPath).json();
        assert.equal(marker.identifier, resourceCrudProbeIdentifier);
        assert.equal(marker.launches.at(-1)?.pid, pid);
        assert.equal(marker.launches.at(-1)?.directoryAbsentAtBind, false);
        await resourceSaved(page);
        await capture();
        const original = await invoke("load_workspace");
        const transport = await createLegacyProtoFixture();
        fixture = transport;
        const owned = { ...transport, ...legacyProtoRecords(transport.address), wireRecords: transport.records };
        const database = join(output, "insomnia.legacy-proto.db");
        await Bun.write(database, owned.dbText);
        const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");
        const witness = async () => ({ size: await Bun.file(database).size, sha256: hash(await Bun.file(database).bytes()) });
        const beforeFile = await witness();
        const requestCount = owned.records.filter(row => row.type === "GrpcRequest").length;
        const pureReview = parseImport(JSON.stringify(parseLegacyFiles([{ name: "insomnia.legacy-proto.db", text: owned.dbText }])));
        assert.equal(pureReview.requests, requestCount, "Real legacy review counts gRPC requests");
        const layoutKeys = ["nocturne:split:workspace-left", "nocturne:split:request-response", "nocturne:split:design", "insomnium:split:workspace-left", "insomnium:split:request-response", "nocturne:split:grpc-response"];
        const layout = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), layoutKeys);
        /** @type {any[]} */ const chooserReceipts = [];
        /** @type {Record<string,any>[]} */ const rows = [];
        /** @type {Record<string,any>[]} */ const schemaTrace = [];
        /** @type {string[]} */ const traceErrors = [];
        /** @type {Map<import('playwright-core').Request,Record<string,any>>} */ const observedRequests = new Map();
        /** @type {Promise<void>[]} */ const tracePending = [];
        const schemaUrl = await page.evaluate(() => /** @type {any} */ (window).__TAURI_INTERNALS__.convertFileSrc("load_grpc_schema", "ipc"));
        const onRequest = (/** @type {import('playwright-core').Request} */ request) => {
          if (request.url() !== schemaUrl) return;
          try {
            const row = { args: request.postDataJSON(), fulfilled: false };
            schemaTrace.push(row);
            observedRequests.set(request, row);
          } catch (error) { traceErrors.push(String(error)); }
        };
        const onResponse = (/** @type {import('playwright-core').Response} */ response) => {
          const row = observedRequests.get(response.request());
          if (!row) return;
          tracePending.push((async () => {
            try { row.ok = (await response.headerValue("Tauri-Response")) === "ok"; row.value = await response.json(); row.fulfilled = true; }
            catch (error) { traceErrors.push(String(error)); }
          })());
        };
        page.on("request", onRequest); page.on("response", onResponse);
        const observed = (/** @type {Promise<any>} */ promise) => { void promise.catch(() => {}); return promise; };
        const importDialog = async () => {
          await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("button", { name: "Import collection", exact: true }).click();
          return page.getByRole("dialog", { name: "Import collection", exact: true });
        };
        const choose = async (/** @type {import('playwright-core').Locator} */ dialog, /** @type {string|null} */ path) => {
          const choosing = observed(respondToOwnedOpenDialog(pid, output, path, "file"));
          await dialog.getByRole("button", { name: "Choose collection file", exact: true }).click();
          chooserReceipts.push(await choosing);
          if (path === null)
            await poll(() => dialog.getByRole("button", { name: "Choose collection file", exact: true }).isEnabled(),
              "Cancelled native chooser settles before the next picker starts");
        };
        const reviewReady = async (/** @type {import('playwright-core').Locator} */ dialog) => {
          await dialog.getByText(`${requestCount} requests`, { exact: true }).waitFor();
          await dialog.getByRole("button", { name: "Import", exact: true }).waitFor();
        };
        const registerNew = (/** @type {any} */ data, /** @type {any[]} */ previous) => {
          const old = new Set(previous.map(row => row._id));
          for (const row of data.resources)
            if (row._type === "workspace" && !old.has(row._id)) registerResourceProbeCollection(row._id, row.name);
        };
        const lookup = (/** @type {any} */ data, /** @type {string} */ oldId, /** @type {Set<string>} */ excluded = new Set()) => {
          const row = data.resources.find((/** @type {any} */ item) => item._legacySource?.record?._id === oldId && !excluded.has(item._id));
          assert.ok(row, "Imported original identity " + oldId);
          return row;
        };
        const provenance = (/** @type {any} */ data, /** @type {Set<string>} */ excluded = new Set()) => {
          for (const source of owned.records) {
            const row = lookup(data, source._id, excluded);
            assert.notEqual(row._id, source._id);
            assert.deepEqual(row._legacySource, { fileName: "insomnia.legacy-proto.db", record: source });
            if (source.parentId) assert.equal(row.parentId, lookup(data, source.parentId, excluded)._id);
          }
          const request = lookup(data, owned.ids.request, excluded);
          assert.equal(request.protoFileId, lookup(data, owned.ids.selectedFile, excluded)._id);
          assert.equal(request.protoMethodName, owned.expectedMethods.selected);
          assert.deepEqual(request.literal, { protoFileId: owned.ids.selectedFile }, "Nested literal references remain original");
          for (const source of owned.records.filter(row => row.type === "ProtoFile"))
            assert.equal(lookup(data, source._id, excluded).protoText, source.protoText, "Active embedded sources retain exact text");
        };
        const select = async (/** @type {any} */ request) => {
          await page.getByLabel("Collection", { exact: true }).selectOption(request.parentId);
          await page.locator(".tree-request").filter({ hasText: request.name }).click();
          assert.equal(await page.getByRole("combobox", { name: "Proto source", exact: true }).inputValue(), request.protoFileId);
        };
        const load = async (/** @type {any} */ request, /** @type {string} */ expected, /** @type {boolean} */ selected) => {
          await select(request);
          const n = schemaTrace.length, sockets = owned.socketRecords.length;
          await page.getByRole("button", { name: "Load methods", exact: true }).click();
          const method = page.getByRole("combobox", { name: "gRPC method", exact: true });
          await method.locator(`option[value="${expected}"]`).waitFor({ state: "attached" });
          await page.getByRole("button", { name: "Load methods", exact: true }).waitFor();
          await poll(async () => schemaTrace.slice(n).some(row => row.fulfilled), "Actual Rust schema IPC finishes");
          await Promise.all(tracePending);
          const trace = schemaTrace.slice(n).find(row => row.fulfilled);
          assert.ok(trace?.ok, "Actual Rust compiler accepted imported sources");
          assert.equal(trace.args.request.proto.entry, "entry.proto");
          if (selected) assert.deepEqual(trace.args.request.proto.includePaths, owned.expectedIncludes);
          assert.equal(owned.socketRecords.length, sockets, "Embedded Rust discovery does not use reflection/network");
          assert.equal(await method.inputValue(), expected, "Saved method choice survives schema discovery");
          rows.push({ kind: "rust-schema", requestId: request._id, expected, includePaths: trace.args.request.proto.includePaths, noNetwork: true });
        };
        const send = async (/** @type {any} */ request, /** @type {string} */ expected) => {
          const before = await invoke("load_workspace"), historyIds = new Set(before.history.map((/** @type {any} */ row) => row._id));
          const wires = owned.wireRecords.length;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await page.locator(".grpc-response .status-badge").filter({ hasText: "0 OK" }).waitFor();
          await page.getByRole("button", { name: "Send", exact: true }).waitFor();
          /** @type {Record<string,any>|undefined} */ let entry;
          await poll(async () => {
            entry = (await invoke("load_workspace")).history.find((/** @type {any} */ row) => row.requestId === request._id && !historyIds.has(row._id) && row.connectionState === "closed");
            return !!entry;
          }, "Owned Echo history durably closes");
          assert.ok(entry); assert.equal(entry.method, expected); assert.equal(entry.error, undefined);
          assert.ok(entry.events.some((/** @type {any} */ event) => event.kind === "message" && JSON.parse(event.text).text === owned.expectedRequestText));
          assert.equal(owned.wireRecords.length, wires + 1);
          const wire = owned.wireRecords[wires];
          assert.equal(wire.path, expected);
          assert.equal(wire.requestText, owned.expectedRequestText);
          assert.equal(wire.incomingFrameBase64, wire.outgoingFrameBase64, "Independent owned HTTP2 fixture echoes exact protobuf frame");
          const after = await invoke("load_workspace");
          assert.deepEqual(after.resources, before.resources, "Unary send does not mutate imported source resources");
          for (const old of before.history) assert.deepEqual(after.history.find((/** @type {any} */ item) => item._id === old._id), old);
          rows.push({ kind: "unary-wire", requestId: request._id, method: expected, historyId: entry._id, wire });
        };
        try {
          let dialog = await importDialog();
          await choose(dialog, null);
          assert.deepEqual(await invoke("load_workspace"), original);
          await choose(dialog, database); await reviewReady(dialog);
          assert.deepEqual(await invoke("load_workspace"), original, "Review is detached");
          await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
          await dialog.waitFor({ state: "detached" });
          assert.deepEqual(await invoke("load_workspace"), original, "Review cancel is unchanged");
          dialog = await importDialog(); await choose(dialog, database); await reviewReady(dialog);
          await dialog.getByRole("button", { name: "Import", exact: true }).click();
          await dialog.waitFor({ state: "detached" });
          await poll(async () => (await invoke("load_workspace")).resources.some((/** @type {any} */ row) => row._legacySource?.record?._id === owned.ids.request), "Actual legacy proto import persists");
          let data = await invoke("load_workspace"); registerNew(data, original.resources); provenance(data);
          assert.deepEqual(data.history, original.history);
          for (const old of original.resources) assert.deepEqual(data.resources.find((/** @type {any} */ row) => row._id === old._id), old);
          const request = lookup(data, owned.ids.request);
          await load(request, owned.expectedMethods.selected, true); await send(request, owned.expectedMethods.selected);
          const other = lookup(data, owned.ids.otherRequest);
          await load(other, owned.expectedMethods.other, false); await send(other, owned.expectedMethods.other);
          const missing = lookup(data, owned.ids.missingRequest);
          await select(missing);
          const beforeMissing = await invoke("load_workspace"), count = owned.socketRecords.length, streams = owned.wireRecords.length, traceN = schemaTrace.length;
          await page.getByRole("button", { name: "Load methods", exact: true }).click();
          await page.locator(".inline-error").filter({ hasText: /absent\.proto/ }).waitFor();
          await page.getByRole("button", { name: "Load methods", exact: true }).waitFor();
          await poll(async () => schemaTrace.slice(traceN).some(row => row.fulfilled && !row.ok), "Missing import is actually refused by Rust");
          assert.equal(owned.socketRecords.length, count); assert.equal(owned.wireRecords.length, streams);
          assert.deepEqual(await invoke("load_workspace"), beforeMissing, "Missing-import discovery leaves durable source/history unchanged");
          rows.push({ kind: "rust-missing-import-refusal", noNetwork: true, unchanged: true });
          await page.reload(); await resourceSaved(page);
          data = await invoke("load_workspace"); provenance(data);
          await load(lookup(data, owned.ids.request), owned.expectedMethods.selected, true);
          await send(lookup(data, owned.ids.request), owned.expectedMethods.selected);
          const exportPath = join(output, "legacy-proto-export.json");
          const saving = observed(respondToOwnedSaveDialog(pid, output, exportPath));
          await page.getByRole("button", { name: "Export collections", exact: true }).click(); chooserReceipts.push(await saving);
          await poll(() => Bun.file(exportPath).exists(), "Actual proto export saved");
          const exported = await Bun.file(exportPath).text();
          const beforeRoundtrip = await invoke("load_workspace"), excluded = new Set(beforeRoundtrip.resources.map((/** @type {any} */ row) => String(row._id)));
          dialog = await importDialog();
          await dialog.getByLabel("Import collection or cURL commands", { exact: true }).fill(exported);
          await dialog.getByRole("button", { name: "Review import", exact: true }).click();
          const exportedReview = parseImport(exported);
          await dialog.getByText(`${exportedReview.requests} requests`, { exact: true }).waitFor();
          await dialog.getByRole("button", { name: "Import", exact: true }).click(); await dialog.waitFor({ state: "detached" });
          await poll(async () => (await invoke("load_workspace")).resources.some((/** @type {any} */ row) => row._legacySource?.record?._id === owned.ids.request && !excluded.has(row._id)), "Actual export reimport persists fresh IDs");
          data = await invoke("load_workspace"); registerNew(data, beforeRoundtrip.resources); provenance(data, excluded);
          assert.deepEqual(data.history, beforeRoundtrip.history);
          await load(lookup(data, owned.ids.request, excluded), owned.expectedMethods.selected, true);
          await send(lookup(data, owned.ids.request, excluded), owned.expectedMethods.selected);
          assert.deepEqual(await witness(), beforeFile, "Original NeDB bytes are never rewritten");
          assert.deepEqual(traceErrors, []);
          acceptance = { passed: true, native: true, renderingMode: "native-hidden", mockedIpc: false, actualChoosers: chooserReceipts, rows, originalFile: beforeFile, afterFile: await witness(), actualReviewRequestCount: requestCount, outerProfileRestorationRequired: true };
        } finally {
          await Promise.all(tracePending); page.off("request", onRequest); page.off("response", onResponse);
          await page.evaluate(values => { for (const [key, value] of Object.entries(values)) if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }, layout);
          await Bun.write(join(output, "legacy-proto-trace.json"), JSON.stringify({ rows, schemaTrace, traceErrors, chooserReceipts, originalFile: beforeFile, afterFile: await witness() }, null, 2));
        }
      }, options);
    }, { ...options, lazyCapture: true });
  } catch (error) { failures.push(error); }
  if (fixture) {
    try { acceptance.fixtureRetirement = await fixture.closeAfterHostExit(); acceptance.fixtureRetiredAfterHostExit = true; }
    catch (error) { failures.push(error); }
    if (evidenceOutput) await Bun.write(join(evidenceOutput, "legacy-proto-wire-after-host-exit.json"), JSON.stringify({ wireRecords: fixture.records, sessionRecords: fixture.sessionRecords, socketRecords: fixture.socketRecords, errorEvents: fixture.errorEvents, observedAfterOwnedHostExit: true }, null, 2));
  }
  if (evidenceOutput) await Bun.write(join(evidenceOutput, "legacy-proto-acceptance.json"), JSON.stringify({ ...acceptance, passed: acceptance.passed && failures.length === 0, errors: failures.map(String) }, null, 2));
  if (failures.length) throw new AggregateError(failures, "Legacy proto import acceptance failed; saved evidence retained");
}
