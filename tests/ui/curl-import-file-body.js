import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  withNativeApp,
  poll,
  selectedNativeProbeIdentifier,
  integrationProbeIdentifier,
} from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
} from "./helpers/resource-manager-cases.js";
if (process.argv.includes("--curl-component")) {
  assert.deepEqual(process.argv.slice(2), ["--curl-component"]);
  const { runCurlFileComponent } =
    await import("./helpers/curl-file-component.js");
  await runCurlFileComponent();
  process.exit(0);
}
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-file-content-fix-ui-probe/build-state.json";
const uploadMode = process.env.INSOMNIUM_CURL_UPLOAD_FILE === "1";
if (uploadMode) {
  assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
  assert.notEqual(
    process.env.INSOMNIUM_UI_BUILD_STATE,
    "artifacts/native-curl-file-content-fix-ui-probe/build-state.json",
    "Current explicit upload build required",
  );
}
/** @type {{body:Buffer,type:string|null,accept:string|null,method:string,path:string}[]} */ const received =
  [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(r) {
    received.push({
      body: Buffer.from(await r.arrayBuffer()),
      type: r.headers.get("content-type"),
      accept: r.headers.get("accept"),
      method: r.method,
      path: new URL(r.url).pathname,
    });
    return Response.json({ ok: true });
  },
});
try {
  const run = async () =>
    withResourceProbePreserved(
      async () => {
        await withNativeApp(
          uploadMode ? "curl-import-upload-file" : "curl-import-file-body",
          async ({ page, invoke, output }) => {
            const modes = uploadMode
              ? ["upload-file"]
              : ["data", "data-ascii", "data-binary", "json", "data-urlencode"];
            const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
            const path = join(
              output,
              uploadMode ? "selected.bin" : "source.bin",
            );
            await writeFile(path, bytes);
            const base = "http://127.0.0.1:" + server.port;
            const before = await invoke("load_workspace");
            const oldIds = new Set(
              before.resources.map(/** @param {any} r */ (r) => r._id),
            );
            await page
              .getByRole("button", { name: "Import collection", exact: true })
              .click();
            const dialog = page.getByRole("dialog");
            await dialog
              .getByLabel("Import collection or cURL commands")
              .fill(
                modes
                  .map(
                    (mode) =>
                      "curl '" +
                      base +
                      "/" +
                      (uploadMode ? "" : mode) +
                      "' --" +
                      mode +
                      " '" +
                      (mode === "upload-file"
                        ? ""
                        : mode === "data-urlencode"
                          ? "field@"
                          : "@") +
                      "missing.bin'",
                  )
                  .join("\n"),
              );
            await dialog
              .getByRole("button", { name: "Review import", exact: true })
              .click();
            await dialog
              .getByRole("button", { name: "Import", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            /** @type {any[]} */ let added = [];
            const registered = new Set();
            await poll(async () => {
              const d = await invoke("load_workspace");
              for (const row of d.resources)
                if (
                  row._type === "workspace" &&
                  !oldIds.has(row._id) &&
                  !registered.has(row._id)
                ) {
                  registerResourceProbeCollection(row._id, row.name);
                  registered.add(row._id);
                }
              added = d.resources.filter(
                /** @param {any} r */ (r) =>
                  !oldIds.has(r._id) && r._type === "request",
              );
              return added.length === modes.length;
            }, "File body imports saved");
            assert.equal(received.length, 0);
            for (let i = 0; i < modes.length; i++) {
              const mode = modes[i],
                request = added[i],
                url = base + "/" + (uploadMode ? "" : mode),
                label = (uploadMode ? "PUT " : "POST ") + url;
              await page
                .getByRole("complementary", { name: "Collections" })
                .getByRole("button", { name: label, exact: true })
                .click();
              await page
                .getByRole("button", { name: "Send", exact: true })
                .click();
              await page
                .getByText("Error: Select a binary file before sending", {
                  exact: true,
                })
                .waitFor();
              assert.equal(
                received.length,
                i * 2,
                "Missing file must not reach peer",
              );
              /** @type {number} */ const count = received.length;
              await page
                .locator(".binary-picker input[type=file]")
                .setInputFiles({
                  name: "selected.bin",
                  mimeType: "application/octet-stream",
                  buffer: bytes,
                });
              /** @type {any} */ let saved;
              await poll(async () => {
                const d = await invoke("load_workspace");
                saved = d.resources.find(
                  /** @param {any} r */ (r) => r._id === request._id,
                );
                return typeof saved.body.base64 === "string";
              }, "Converted bytes persisted");
              const encoded = saved.body.base64;
              await page.reload();
              await page
                .getByRole("complementary", { name: "Collections" })
                .getByRole("button", { name: label, exact: true })
                .click();
              await page
                .getByRole("button", { name: "Send", exact: true })
                .click();
              await poll(
                async () => received.length === count + 1,
                "Native file body received",
              );
              await poll(
                async () =>
                  !(await page
                    .getByRole("button", { name: "Cancel", exact: true })
                    .count()),
                "Native send settled",
              );
              const actual = received.at(-1);
              const p = Bun.spawn(
                [
                  "curl.exe",
                  "-q",
                  "-sS",
                  "--noproxy",
                  "*",
                  "--" + mode,
                  (mode === "upload-file"
                    ? ""
                    : mode === "data-urlencode"
                      ? "field@"
                      : "@") + path,
                  url,
                ],
                { stdout: "pipe", stderr: "pipe", windowsHide: true },
              );
              const [out, err, code] = await Promise.all([
                new Response(p.stdout).text(),
                new Response(p.stderr).text(),
                p.exited,
              ]);
              assert.equal(code, 0, err);
              assert.equal(received.length, count + 2);
              const reference = received.at(-1);
              assert.deepEqual(actual?.body, reference?.body, mode + " bytes");
              assert.equal(
                actual?.type,
                reference?.type,
                mode + " Content-Type",
              );
              assert.equal(actual?.method, reference?.method, mode + " method");
              assert.equal(actual?.path, reference?.path, mode + " target");
              if (uploadMode) {
                assert.equal(actual?.method, "PUT");
                assert.equal(actual?.path, "/selected.bin");
                assert.equal(actual?.type, null);
              }
              if (mode === "json")
                assert.equal(actual?.accept, reference?.accept);
              const persisted = (await invoke("load_workspace")).resources.find(
                /** @param {any} r */ (r) => r._id === request._id,
              );
              assert.equal(
                persisted.body.base64,
                encoded,
                "Reload/Send must not transform stored bytes again",
              );
            }
            await writeFile(
              join(output, "acceptance.json"),
              JSON.stringify(
                {
                  status: "passed",
                  modes,
                  nativeMode: "native-hidden",
                  uploadMode,
                  transfers: received.map((row) => ({
                    method: row.method,
                    path: row.path,
                    contentType: row.type,
                    bodyBase64: row.body.toString("base64"),
                  })),
                  checks: [
                    "Imported file paths not read; missing selection blocks Send",
                    "Actual mounted file input performs mode conversion",
                    "Reload/native Send matches curl bytes and Content-Type for all256 byte values",
                    uploadMode
                      ? "PUT/directory basename/no Content-Type match curl; persisted bytes not transformed again"
                      : "JSON Accept matches curl; persisted conversion not reapplied",
                  ],
                },
                null,
                2,
              ),
            );
          },
          { expectedIdentifier: selectedNativeProbeIdentifier() },
        );
      },
      { expectedIdentifier: selectedNativeProbeIdentifier() },
    );
  if (selectedNativeProbeIdentifier() === integrationProbeIdentifier)
    await preserveNativeProfile(run);
  else await run();
} finally {
  server.stop(true);
}
