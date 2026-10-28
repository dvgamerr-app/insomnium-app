import assert from "node:assert/strict";
import { open, symlink, rename } from "node:fs/promises";
import { join, basename } from "node:path";
import { prepareRenderedRequest } from "../../../src/lib/transport.js";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
  selectedNativeProbeIdentifier,
  integrationProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { clientCertificateFixture } from "./client-certificate.js";
import { respondToOwnedOpenDialog } from "./windows-open-dialog.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
import {
  legacyCertificateFixture,
  certificateDigest,
  assertCertificateCache,
} from "./legacy-certificate-fixture.js";

/** Genuine imported certificate bytes through real pickers and owned mTLS. */
export async function runLegacyCertificateNativeCases() {
  assert.equal(process.platform, "win32");
  const integration=selectedNativeProbeIdentifier()===integrationProbeIdentifier;
  const markerPath = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  if(!integration)assert.ok(markerPath);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: integration?integrationProbeIdentifier:resourceCrudProbeIdentifier,
    profileOwnershipPath: markerPath,
  };
  /** @type {Awaited<ReturnType<typeof clientCertificateFixture>>|undefined} */ let fixture;
  let evidenceOutput = "";
  /** @type {Record<string,any>} */ let acceptance = { passed: false };
  /** @type {unknown[]} */ const failures = [];
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "legacy-certificate-import-native",
          async ({ page, invoke, output, pid }) => {
            evidenceOutput = output;
            if(!integration){
              const marker = await Bun.file(/** @type {string} */(markerPath)).json();
              assert.equal(marker.identifier, resourceCrudProbeIdentifier);
              assert.equal(marker.launches.at(-1)?.pid, pid);
              assert.equal(marker.launches.at(-1)?.directoryAbsentAtBind, false);
            }
            await resourceSaved(page);
            if(!integration)await capture();
            const original = await invoke("load_workspace");
            const layoutKeys = [
              "nocturne:split:workspace-left",
              "nocturne:split:request-response",
              "nocturne:split:design",
              "insomnium:split:workspace-left",
              "insomnium:split:request-response",
            ];
            const layout = await page.evaluate(
              (keys) =>
                Object.fromEntries(
                  keys.map((key) => [key, localStorage.getItem(key)]),
                ),
              layoutKeys,
            );
            const tls = await clientCertificateFixture(output, {
              fileIdentities: true,
              grpc: true,
            });
            fixture = tls;
            await tls.verifyFixture();
            const root = tls.caFiles.directory;
            /** @type {Record<string,{path:string,bytes:Uint8Array}>} */ const materials =
              {};
            for (const [name, path] of Object.entries({
              ca: tls.caFiles.trusted,
              cert: tls.identityFiles.cert,
              key: tls.identityFiles.key,
              encrypted: tls.identityFiles.encryptedKey,
              pfx: tls.identityFiles.pfx,
            }))
              /** @type {Record<string,any>} */ (materials)[name] = {
                path,
                bytes: await Bun.file(path).bytes(),
              };
            /** @type {Record<string,any>} */ (materials).missing = {
              path: join(root, "missing-import.pem"),
              bytes: new Uint8Array(),
            };
            const source = legacyCertificateFixture(
              materials,
              {
                http: tls.primary.url,
                sse: tls.primary.url + "/sse",
                wss: tls.primary.url.replace("https:", "wss:") + "/ws",
                grpc: tls.grpc.url.replace("https:", "grpcs:"),
              },
              { password: tls.identityFiles.password },
            );
            const oversized = join(root, "import-oversized.pem");
            const large = await open(oversized, "wx");
            try {
              await large.truncate(1024 * 1024 + 1);
            } finally {
              await large.close();
            }
            const outside = join(output, "outside-import-ca.pem");
            await Bun.write(outside, tls.ca);
            const badPaths = [
              { token: "missing", path: join(root, "missing-import.pem") },
              { token: "outside", path: outside },
              { token: "oversized", path: oversized },
            ];
            let junctionCreated = false;
            try {
              const redirect = join(root, "import-redirect");
              await symlink(output, redirect, "junction");
              junctionCreated = true;
              badPaths.push({
                token: "junction",
                path: join(redirect, "outside-import-ca.pem"),
              });
            } catch (error) {
              await Bun.write(
                join(output, "certificate-junction-unavailable.json"),
                JSON.stringify({ verified: false, error: String(error) }),
              );
            }
            const badRecords = badPaths.flatMap((entry) => [
              {
                _id: "wrk_certificate_refused_" + entry.token,
                type: "Workspace",
                parentId: null,
                name: "Legacy TLS refused " + entry.token,
                scope: "collection",
              },
              {
                _id: "ca_certificate_refused_" + entry.token,
                type: "CaCertificate",
                parentId: "wrk_certificate_refused_" + entry.token,
                path: entry.path,
                disabled: false,
                isPrivate: false,
              },
              {
                _id: "req_certificate_refused_" + entry.token,
                type: "Request",
                parentId: "wrk_certificate_refused_" + entry.token,
                name: "Imported TLS refused " + entry.token,
                method: "POST",
                url: tls.primary.url + "/refused-" + entry.token,
                headers: [],
                parameters: [],
                authentication: {},
                body: {
                  mimeType: "text/plain",
                  text: "owned refused certificate request",
                },
                settingSendCookies: false,
                settingStoreCookies: false,
              },
            ]);
            const database = join(root, "certificates.db");
            await Bun.write(
              database,
              [...source.records, ...badRecords]
                .map((record) => JSON.stringify(record))
                .join("\n") + "\n",
            );
            const inputs = [
              ...Object.values(/** @type {Record<string,any>} */ (materials))
                .filter((entry) => entry.bytes.length > 0)
                .map((entry) => entry.path),
              outside,
              oversized,
              database,
            ];
            const witness = async () =>
              Object.fromEntries(
                await Promise.all(
                  inputs.map(async (path) => {
                    const bytes = await Bun.file(path).bytes();
                    return [
                      path,
                      { bytes: bytes.length, sha256: certificateDigest(bytes) },
                    ];
                  }),
                ),
              );
            const beforeFiles = await witness();
            /** @type {{source:string,unavailable:string}[]} */ const moved =
              [];
            /** @type {{source:string,unavailable:string}[]} */ const sourceUnavailability =
              [];
            const restoreSources = async () => {
              while (moved.length) {
                const entry = moved[moved.length - 1];
                await rename(entry.unavailable, entry.source);
                moved.pop();
              }
            };
            await Bun.write(
              join(output, "certificate-source-before.json"),
              JSON.stringify(beforeFiles, null, 2),
            );
            /** @type {any[]} */ const chooserReceipts = [];
            const observed = (/** @type {Promise<any>} */ promise) => {
              void promise.catch(() => {});
              return promise;
            };
            const start = async () => {
              await page
                .getByRole("navigation", {
                  name: "Main navigation",
                  exact: true,
                })
                .getByRole("button", { name: "Import collection", exact: true })
                .click();
              const dialog = page.getByRole("dialog", {
                name: "Import collection",
                exact: true,
              });
              const selecting = observed(
                respondToOwnedOpenDialog(pid, output, database, "file"),
              );
              await dialog
                .getByRole("button", {
                  name: "Choose collection file",
                  exact: true,
                })
                .click();
              chooserReceipts.push(await selecting);
              await dialog
                .getByRole("button", {
                  name: "Load legacy certificate files",
                  exact: true,
                })
                .waitFor();
              return dialog;
            };
            const folder = async (
              /** @type {import('playwright-core').Locator} */ dialog,
              /** @type {string|null} */ path,
            ) => {
              const selecting = observed(
                respondToOwnedOpenDialog(pid, output, path, "folder"),
              );
              await dialog
                .getByRole("button", {
                  name: "Load legacy certificate files",
                  exact: true,
                })
                .click();
              chooserReceipts.push(await selecting);
              await poll(
                () =>
                  dialog
                    .getByRole("button", {
                      name: "Load legacy certificate files",
                      exact: true,
                    })
                    .isEnabled(),
                "Certificate folder read settles",
              );
            };
            const registerNew = (
              /** @type {any} */ data,
              /** @type {any[]} */ previous,
            ) => {
              const old = new Set(previous.map((row) => row._id));
              for (const collection of data.resources.filter(
                (/** @type {any} */ row) =>
                  row._type === "workspace" && !old.has(row._id),
              ))
                registerResourceProbeCollection(
                  collection._id,
                  collection.name,
                );
            };
            try {
              let dialog = await start();
              await folder(dialog, null);
              assert.deepEqual(await invoke("load_workspace"), original);
              await folder(dialog, root);
              await dialog.getByText(/certificate files.*portable/).waitFor();
              assert.deepEqual(await invoke("load_workspace"), original);
              await dialog
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
              await dialog.waitFor({ state: "detached" });
              dialog = await start();
              await folder(dialog, root);
              await dialog
                .getByRole("button", { name: "Import", exact: true })
                .click();
              await dialog.waitFor({ state: "detached" });
              await poll(
                async () =>
                  (await invoke("load_workspace")).resources.some(
                    (/** @type {any} */ row) => row.name === "Legacy TLS pem",
                  ),
                "Native legacy certificate import saved",
              );
              const loaded = await invoke("load_workspace");
              registerNew(loaded, original.resources);
              for (const resource of original.resources)
                assert.deepEqual(
                  loaded.resources.find(
                    (/** @type {any} */ row) => row._id === resource._id,
                  ),
                  resource,
                );
              assert.deepEqual(loaded.history, original.history);
              for (const resource of loaded.resources.filter(
                (/** @type {any} */ row) =>
                  ["ca_certificate", "client_certificate"].includes(
                    row._type,
                  ) && row._legacySource,
              )) {
                const raw = [...source.records, ...badRecords].find(
                  (row) => row._id === resource._legacySource.record._id,
                );
                assert.ok(raw);
                assert.deepEqual(resource._legacySource.record, raw);
                for (const field of [
                  "path",
                  "cert",
                  "key",
                  "pfx",
                  "passphrase",
                  "host",
                  "disabled",
                ])
                  if (Object.hasOwn(raw, field))
                    assert.equal(
                      resource[field],
                      /** @type {any} */ (raw)[field],
                    );
                assertCertificateCache(resource);
              }
              for (const bad of badPaths) {
                const resource = loaded.resources.find(
                  (/** @type {any} */ row) =>
                    row._legacySource?.record?._id ===
                    "ca_certificate_refused_" + bad.token,
                );
                assert.equal(
                  resource._legacyCertificateAssets?.fields.path,
                  undefined,
                );
              }
              // All successful TLS paths must consume the reviewed portable bytes:
              // temporarily make the owned source material unavailable, then restore
              // its exact paths/bytes before the final source witness.
              for (const material of Object.values(
                /** @type {Record<string,any>} */ (materials),
              ).filter((entry) => entry.bytes.length > 0)) {
                const unavailable = join(
                  root,
                  "unavailable-" + basename(material.path),
                );
                assert.equal(await Bun.file(unavailable).exists(), false);
                await rename(material.path, unavailable);
                const entry = { source: material.path, unavailable };
                moved.push(entry);
                sourceUnavailability.push(entry);
                assert.equal(await Bun.file(material.path).exists(), false);
              }
              /** @type {Record<string,any>[]} */ const rows = [];
              const select = async (/** @type {any} */ request) => {
                await page
                  .getByLabel("Collection", { exact: true })
                  .selectOption(request.parentId);
                await page
                  .locator(".tree-request")
                  .filter({ hasText: request.name })
                  .click();
                await poll(async()=>{
                  const saved=await invoke('load_workspace');
                  return saved.activeRequestId===request._id && saved.resources.some((/** @type {any} */row)=>['request_meta','grpc_request_meta'].includes(row._type)&&row.parentId===request._id);
                },'Selected HTTP request metadata persisted');
              };
              const execute = async (
                /** @type {typeof source.definitions[number]} */ definition,
                /** @type {any} */ request,
              ) => {
                await select(request);
                if (definition.protocol === "grpc") {
                  await page
                    .getByRole("button", { name: "Load methods", exact: true })
                    .click();
                  const method = page.getByRole("combobox", {
                    name: "gRPC method",
                    exact: true,
                  });
                  await poll(
                    async () =>
                      (await method.locator("option").allTextContents()).some(
                        (name) => name.includes("/Echo"),
                      ),
                    "Imported certificate authorizes actual gRPC reflection",
                  );
                  const chosen = await method
                    .locator("option")
                    .evaluateAll((options) =>
                      options
                        .find((option) => option.textContent?.includes("/Echo"))
                        ?.getAttribute("value"),
                    );
                  assert.ok(chosen);
                  await method.selectOption(chosen);
                }
                const before = await invoke("load_workspace");
                const beforeIds = new Set(
                  before.history.map((/** @type {any} */ row) => row._id),
                );
                const observedCount = tls.requests.length,
                  grpcCount = tls.grpcRequests.length,
                  tcp = tls.connections.primary;
                await page
                  .getByRole("button", {
                    name: ["sse", "wss"].includes(definition.protocol)
                      ? "Connect"
                      : "Send",
                    exact: true,
                  })
                  .click();
                /** @type {Record<string,any>|undefined} */ let entry;
                await poll(
                  async () => {
                    entry = (await invoke("load_workspace")).history.find(
                      (/** @type {any} */ row) =>
                        row.requestId === request._id &&
                        !beforeIds.has(row._id) &&
                        (definition.protocol === "http" ||
                          ["closed", "error"].includes(row.connectionState)),
                    );
                    return !!entry;
                  },
                  "Actual imported TLS exchange settles: " + definition.token,
                  60000,
                );
                assert.ok(entry);
                if (definition.success) {
                  assert.equal(entry.connectionState === "error", false);
                  if (definition.protocol === "grpc") {
                    assert.equal(entry.protocol, "grpc");
                    assert.equal(entry.status, 0);
                    const message = entry.events.find(
                      (/** @type {any} */ event) => event.kind === "message",
                    );
                    assert.ok(message);
                    assert.deepEqual(JSON.parse(message.text), {
                      name: "owned mutual TLS gRPC response",
                    });
                  }
                  if (definition.protocol === "http") {
                    assert.equal(entry.status, 200);
                    assert.equal(entry.body, "owned mTLS response");
                  }
                  if (definition.protocol === "sse")
                    assert.ok(
                      entry.events.some(
                        (/** @type {any} */ event) =>
                          event.event === "authenticated" &&
                          event.data === "owned mutual TLS SSE event",
                      ),
                    );
                  if (definition.protocol === "wss")
                    assert.ok(
                      entry.events.some(
                        (/** @type {any} */ event) =>
                          event.kind === "message" &&
                          event.data === "owned mutual TLS WSS message",
                      ),
                    );
                  await poll(
                    async () =>
                      definition.protocol === "grpc"
                        ? tls.grpcRequests.length > grpcCount
                        : tls.requests.length > observedCount,
                    "Owned fixture authenticated observation arrives",
                  );
                  const reached =
                    definition.protocol === "grpc"
                      ? tls.grpcRequests.slice(grpcCount)
                      : tls.requests.slice(observedCount);
                  assert.ok(
                    reached.length > 0,
                    "Actual owned server observed authenticated client traffic",
                  );
                  for (const wire of reached) {
                    assert.equal(wire.authorized, true);
                    assert.equal(wire.cn, tls.clientName);
                    assert.equal(wire.fingerprint, tls.client.fingerprint);
                  }
                } else {
                  assert.equal(entry.status, 0);
                  assert.ok(entry.error);
                  assert.equal(tls.requests.length, observedCount);
                  assert.equal(
                    tls.connections.primary,
                    tcp,
                    "Wrong encrypted-key passphrase fails before TCP",
                  );
                }
                const after = await invoke("load_workspace");
                for (const old of before.history)
                  assert.deepEqual(
                    after.history.find(
                      (/** @type {any} */ row) => row._id === old._id,
                    ),
                    old,
                  );
                rows.push({
                  token: definition.token,
                  protocol: definition.protocol,
                  success: definition.success,
                  actualOwnedTls: definition.success,
                  pinnedClientFingerprint: definition.success
                    ? tls.client.fingerprint
                    : null,
                  wrongPasswordPreTcp: !definition.success,
                });
              };
              for (const definition of source.definitions) {
                const request = (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ row) =>
                    row.name === "Imported TLS " + definition.token,
                );
                await execute(definition, request);
                await page.reload();
                await resourceSaved(page);
                assert.deepEqual(
                  (await invoke("load_workspace")).resources.filter(
                    (/** @type {any} */ row) =>
                      ["ca_certificate", "client_certificate"].includes(
                        row._type,
                      ),
                  ),
                  loaded.resources.filter((/** @type {any} */ row) =>
                    ["ca_certificate", "client_certificate"].includes(
                      row._type,
                    ),
                  ),
                );
              }
              /** @type {Record<string,any>[]} */ const refusalRows = [];
              for (const bad of badPaths) {
                const request = (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ row) =>
                    row.name === "Imported TLS refused " + bad.token,
                );
                assert.ok(request);
                await select(request);
                const before = await invoke("load_workspace");
                const previousIds = new Set(
                  before.history.map((/** @type {any} */ row) => row._id),
                );
                const tcpBefore = tls.connections.primary,
                  requestsBefore = tls.requests.length;
                await page
                  .getByRole("button", { name: "Send", exact: true })
                  .click();
                /** @type {Record<string,any>|undefined} */ let failed;
                await poll(async () => {
                  failed = (await invoke("load_workspace")).history.find(
                    (/** @type {any} */ row) =>
                      row.requestId === request._id &&
                      !previousIds.has(row._id),
                  );
                  return !!failed;
                }, "Actual pending imported CA Send records failure: " + bad.token);
                assert.ok(failed);
                assert.equal(failed.status, 0);
                assert.match(
                  failed.error,
                  /certificate|CA|asset|loaded|scope|limit/i,
                );
                assert.equal(tls.connections.primary, tcpBefore);
                assert.equal(tls.requests.length, requestsBefore);
                const after = await invoke("load_workspace");
                assert.equal(
                  after.history.filter(
                    (/** @type {any} */ row) => !previousIds.has(row._id),
                  ).length,
                  1,
                );
                assert.deepEqual(
                  after.history.filter((/** @type {any} */ row) =>
                    previousIds.has(row._id),
                  ),
                  before.history,
                );
                assert.deepEqual(after.resources, before.resources);
                refusalRows.push({
                  token: bad.token,
                  actualUiSend: true,
                  status: 0,
                  addedFailureHistory: 1,
                  noTcpOrAuthorizedRequest: true,
                  originalResourcesUnchanged: true,
                });
              }
              // Native IPC independently verifies SHA: the original valid path
              // is unavailable, and a deliberately mismatched digest cannot
              // fall back to it. This is direct IPC, not an extra UI Send.
              const beforeSha = await invoke("load_workspace");
              const pem = beforeSha.resources.find(
                (/** @type {any} */ row) => row.name === "Imported TLS pem",
              );
              assert.ok(pem);
              const poisoned = structuredClone(
                prepareRenderedRequest(
                  beforeSha,
                  pem,
                  "run_certificate_sha_" + crypto.randomUUID(),
                ),
              );
              assert.ok(poisoned.caAsset);
              poisoned.caAsset.sha256 = "0".repeat(64);
              const shaTcpBefore = tls.connections.primary,
                shaRequestsBefore = tls.requests.length;
              // Catch the raw IPC rejection inside the page: Playwright wraps
              // thrown non-Error objects as "evaluate: Object" across CDP.
              const shaReply = await page.evaluate(async (request) => {
                try {
                  await /** @type {any} */ (window).__TAURI_INTERNALS__.invoke(
                    "send_http",
                    { request },
                  );
                  return { rejected: false, error: "" };
                } catch (error) {
                  return {
                    rejected: true,
                    error:
                      typeof error === "string"
                        ? error
                        : String(JSON.stringify(error)),
                  };
                }
              }, poisoned);
              await Bun.write(
                join(output, "native-sha-mismatch.json"),
                JSON.stringify(shaReply, null, 2),
              );
              assert.equal(shaReply.rejected, true);
              assert.match(shaReply.error, /sha|digest|hash/i);
              assert.equal(tls.connections.primary, shaTcpBefore);
              assert.equal(tls.requests.length, shaRequestsBefore);
              assert.deepEqual(
                await invoke("load_workspace"),
                beforeSha,
                "Direct rejected SHA probe does not alter persisted workspace/history",
              );
              const exportPath = join(output, "legacy-certificate-export.json");
              const saving = observed(
                respondToOwnedSaveDialog(pid, output, exportPath),
              );
              await page
                .getByRole("button", {
                  name: "Export collections",
                  exact: true,
                })
                .click();
              chooserReceipts.push(await saving);
              await poll(
                () => Bun.file(exportPath).exists(),
                "Actual imported certificate export saved",
              );
              const exported = await Bun.file(exportPath).text();
              const beforeRoundtrip = await invoke("load_workspace");
              // Switching to the imported collection remembers the outgoing
              // collection's environment, creating its local meta if absent.
              const remembersOutgoing = !beforeRoundtrip.resources.some(
                (/** @type {any} */ row) =>
                  row._type === "workspace_meta" &&
                  row.parentId === beforeRoundtrip.activeWorkspaceId,
              );
              await page
                .getByRole("navigation", {
                  name: "Main navigation",
                  exact: true,
                })
                .getByRole("button", { name: "Import collection", exact: true })
                .click();
              dialog = page.getByRole("dialog", {
                name: "Import collection",
                exact: true,
              });
              await dialog
                .getByLabel("Import collection or cURL commands", {
                  exact: true,
                })
                .fill(exported);
              await dialog
                .getByRole("button", { name: "Review import", exact: true })
                .click();
              await dialog.getByText(/certificate files.*portable/).waitFor();
              await dialog
                .getByRole("button", { name: "Import", exact: true })
                .click();
              await dialog.waitFor({ state: "detached" });
              const exportedCount = JSON.parse(exported).resources.length;
              await poll(
                async () =>
                  (await invoke("load_workspace")).resources.length ===
                  beforeRoundtrip.resources.length +
                    exportedCount +
                    Number(remembersOutgoing),
                "Actual portable certificate reimport persists",
              );
              const roundtrip = await invoke("load_workspace");
              registerNew(roundtrip, beforeRoundtrip.resources);
              assert.deepEqual(roundtrip.history, beforeRoundtrip.history);
              for (const old of beforeRoundtrip.resources) {
                const current=roundtrip.resources.find((/** @type {any} */ row)=>row._id===old._id);
                if(old._type==='workspace_meta'&&old.parentId===beforeRoundtrip.activeWorkspaceId){
                  assert.ok(current);
                  assert.equal(current.activeEnvironmentId,beforeRoundtrip.activeEnvironmentId);
                  assert.ok(current.modified>=old.modified);
                  const {activeEnvironmentId:_environment,modified:_modified,...rest}=current;
                  const {activeEnvironmentId:_oldEnvironment,modified:_oldModified,...oldRest}=old;
                  assert.deepEqual(rest,oldRest);
                }else assert.deepEqual(current,old);
              }
              if (remembersOutgoing) {
                const oldIds = new Set(
                  beforeRoundtrip.resources.map(
                    (/** @type {any} */ row) => row._id,
                  ),
                );
                const outgoingMeta = roundtrip.resources.filter(
                  (/** @type {any} */ row) =>
                    !oldIds.has(row._id) &&
                    row._type === "workspace_meta" &&
                    row.parentId === beforeRoundtrip.activeWorkspaceId,
                );
                assert.equal(outgoingMeta.length, 1);
                assert.equal(
                  outgoingMeta[0].activeEnvironmentId,
                  beforeRoundtrip.activeEnvironmentId,
                );
              }
              const oldIds = new Set(
                beforeRoundtrip.resources.map(
                  (/** @type {any} */ row) => row._id,
                ),
              );
              const reimported = roundtrip.resources.find(
                (/** @type {any} */ row) =>
                  row.name === "Imported TLS pem" && !oldIds.has(row._id),
              );
              await execute(
                { ...source.definitions[0], token: "pem-reimported" },
                reimported,
              );
              await restoreSources();
              const afterFiles = await witness();
              assert.deepEqual(afterFiles, beforeFiles);
              await Bun.write(
                join(output, "certificate-source-after.json"),
                JSON.stringify(afterFiles, null, 2),
              );
              acceptance = {
                passed: true,
                native: true,
                renderingMode: "native-hidden",
                rows,
                refusalRows,
                nativeShaMismatch: {
                  directIpc: true,
                  uiSend: false,
                  rejectedBeforeTcp: true,
                  persistedWorkspaceUnchanged: true,
                },
                actualDatabaseFolderCancelApplyReloadExportReimport: true,
                readerRefusals: badPaths.map((row) => row.token),
                junctionCreated,
                chooserReceipts,
                sourceFilesExact: true,
                cachedTlsWithSourcesUnavailable: true,
                portableReimportRemembersOutgoingEnvironment: remembersOutgoing,
                sourceUnavailability,
                tls59OriginalScenarioUnchanged: true,
              };
            } catch (error) {
              await Bun.write(
                join(output, "legacy-certificate-failure.json"),
                JSON.stringify(
                  {
                    error: String(error),
                    workspace: await invoke("load_workspace"),
                    chooserReceipts,
                    requests: tls.requests,
                    grpcRequests: tls.grpcRequests,
                  },
                  null,
                  2,
                ),
              );
              throw error;
            } finally {
              await restoreSources();
              await page.evaluate((values) => {
                for (const [key, value] of Object.entries(values))
                  if (value === null) localStorage.removeItem(key);
                  else localStorage.setItem(key, value);
              }, layout);
              assert.deepEqual(await witness(), beforeFiles);
            }
          },
          options,
        );
      },
      { ...options, lazyCapture: !integration },
    );
  } catch (error) {
    failures.push(error);
  }
  if (fixture) {
    if (evidenceOutput)
      await Bun.write(
        join(evidenceOutput, "certificate-fixture-after-host-exit.json"),
        JSON.stringify(
          {
            requests: fixture.requests,
            socketEvents: fixture.socketEvents,
            grpcEvents: fixture.grpcEvents,
            grpcRequests: fixture.grpcRequests,
            sseEvents: fixture.sseEvents,
            observedAfterOwnedAppExit: true,
          },
          null,
          2,
        ),
      );
    try {
      await fixture.close();
      acceptance.fixtureClosePassedExit0 = true;
    } catch (error) {
      failures.push(error);
    }
  }
  if (evidenceOutput)
    await Bun.write(
      join(evidenceOutput, "legacy-certificate-acceptance.json"),
      JSON.stringify(
        { ...acceptance, passed: acceptance.passed && failures.length === 0 },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Legacy certificate import failures retained",
    );
}
