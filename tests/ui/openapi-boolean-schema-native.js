import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { withResourceProbePreserved } from "./helpers/resource-manager-cases.js";
import {
  withNativeApp,
  poll,
  selectedNativeProbeIdentifier,
  integrationProbeIdentifier,
} from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import { referenceObjectDocument } from "./helpers/openapi-external-contract.js";
import {
  booleanSchemaDocument,
  booleanSchemaCases,
  legacySchemaCases,
  legacySchemaDocument,
} from "./helpers/openapi-boolean-schema-contract.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../src/lib/git-resources.js";
import { prepareRenderedRequest } from "../../src/lib/transport.js";

const ordinaryOnly = process.env.INSOMNIUM_OPENAPI_ORDINARY_SCHEMA === "1";
const dialectOnly = process.env.INSOMNIUM_OPENAPI_DIALECT_GUARD === "1";
const referenceOnly = process.env.INSOMNIUM_OPENAPI_REFERENCE_OBJECTS === "1";
const legacySiblingsOnly =
  process.env.INSOMNIUM_OPENAPI_LEGACY_SIBLINGS === "1";
const legacyOnly =
  process.env.INSOMNIUM_OPENAPI_LEGACY_SCHEMA === "1" || legacySiblingsOnly;
assert.ok(!(ordinaryOnly && legacyOnly));
assert.ok(!referenceOnly || (!ordinaryOnly && !legacyOnly));
assert.ok(!dialectOnly || (!ordinaryOnly && !legacyOnly && !referenceOnly));
if (ordinaryOnly || legacyOnly || referenceOnly || dialectOnly) {
  assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
}
const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.2.1";
const readOnlyOnly = process.env.INSOMNIUM_OPENAPI_CASE_SET === "readonly";
assert.ok(!process.env.INSOMNIUM_OPENAPI_CASE_SET || readOnlyOnly);
assert.ok(
  ["2.0", "3.0.3", "3.0.4", "3.1.0", "3.1.2", "3.2.0", "3.2.1"].includes(
    version,
  ),
);
const received = /** @type {Record<string,any>[]} */ ([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const bytes = new Uint8Array(await request.arrayBuffer());
    received.push({
      type: request.headers.get("content-type"),
      target: new URL(request.url).pathname + new URL(request.url).search,
      method: request.method,
      apiKey: request.headers.get("X-Owned"),
      base64: Buffer.from(bytes).toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    return Response.json({ ok: true });
  },
});
try {
  const run = () =>
    withNativeApp(
      dialectOnly
        ? "openapi-ordinary-dialect-" + version
        : referenceOnly
          ? "openapi-reference-objects-" + version
          : legacySiblingsOnly
            ? "openapi-legacy-siblings-" + version
            : legacyOnly
              ? "openapi-legacy-schema-" + version
              : ordinaryOnly
                ? "openapi-ordinary-schema-" + version
                : "openapi-boolean-schema",
      async ({ page, invoke, output }) => {
        if (dialectOnly) {
          assert.ok(["3.1.2", "3.2.0", "3.2.1"].includes(version));
          const valid = {
            openapi: version,
            info: { title: "Ordinary dialect", version: "1" },
            servers: [{ url: "http://127.0.0.1:" + server.port }],
            paths: {
              "/dialect": {
                post: {
                  operationId: "dialect",
                  requestBody: {
                    content: {
                      "application/json": {
                        schema: {
                          $schema:
                            "https://json-schema.org/draft/2020-12/schema",
                          type: "integer",
                          default: 6,
                        },
                      },
                    },
                  },
                  responses: { 200: { description: "OK" } },
                },
              },
            },
          };
          const checks = /** @type {Record<string,any>[]} */ ([]);
          const specId = await generateOwnedOpenApi(
            { page, invoke, output },
            valid,
            1,
            "Owned ordinary dialect",
            {
              preserveOwnedCollection: true,
              beforeCheck: async ({ design, specId }) => {
                const before = await invoke("load_workspace");
                const replace = async (/** @type {any} */ document) => {
                  const text = JSON.stringify(document, null, 2);
                  await design.locator(".CodeMirror").evaluate((el, value) => {
                    /** @type {any} */ (el).CodeMirror.setValue(value);
                  }, text);
                  await poll(
                    async () =>
                      (await invoke("load_workspace")).resources.find(
                        (/** @type {any} */ r) => r._id === specId,
                      )?.contents === text,
                    "Dialect source persisted",
                  );
                };
                for (const kind of [
                  "unknown",
                  "number",
                  "document",
                  "attached",
                ]) {
                  const document = /** @type {Record<string,any>} */ (
                    structuredClone(valid)
                  );
                  const media =
                    document.paths["/dialect"].post.requestBody.content[
                      "application/json"
                    ];
                  const declaration =
                    kind === "unknown"
                      ? "https://unknown.example.test/dialect"
                      : 7;
                  if (kind === "document") {
                    delete media.schema.$schema;
                    document.jsonSchemaDialect =
                      "https://unknown.example.test/dialect";
                  } else if (kind === "attached") {
                    media.schema = { $ref: "ordinary-schema.json" };
                    const raw = JSON.stringify(
                      { $schema: 7, type: "integer", default: 6 },
                      null,
                      2,
                    );
                    await design
                      .getByText("Attach $ref files", { exact: true })
                      .locator("input[type=file]")
                      .setInputFiles({
                        name: "ordinary-schema.json",
                        mimeType: "application/json",
                        buffer: Buffer.from(raw),
                      });
                    await poll(
                      async () =>
                        (await invoke("load_workspace")).resources.find(
                          (/** @type {any} */ r) => r._id === specId,
                        )?.files?.length === 1,
                      "Dialect reference file persisted",
                    );
                  } else media.schema.$schema = declaration;
                  await replace(document);
                  await design
                    .getByRole("button", {
                      name: "Validate & preview",
                      exact: true,
                    })
                    .click();
                  await poll(
                    async () =>
                      await design
                        .getByRole("button", {
                          name: "Validate & preview",
                          exact: true,
                        })
                        .isEnabled(),
                    "Dialect validation completed",
                  );
                  await design
                    .getByRole("tab", { name: /^Diagnostics/ })
                    .click();
                  const message =
                    kind === "number" || kind === "attached"
                      ? "Schema $schema must be an absolute URI string."
                      : "Schema resource dialect is not supported:";
                  const row = design
                    .locator(".diagnostic-row")
                    .filter({ hasText: message });
                  await row.waitFor();
                  assert.equal(await row.count(), 1);
                  await row.focus();
                  await row.press("Enter");
                  await poll(async () => {
                    const actual = await design
                      .locator(".CodeMirror")
                      .evaluate((el) => {
                        const cm = /** @type {any} */ (el).CodeMirror;
                        return {
                          selected: cm.getSelection(),
                          readOnly: cm.getOption("readOnly"),
                        };
                      });
                    try {
                      return kind === "document"
                        ? JSON.parse(actual.selected).type === "integer"
                        : JSON.parse(actual.selected) === declaration &&
                            !!actual.readOnly === (kind === "attached");
                    } catch {
                      return false;
                    }
                  }, "Dialect diagnostic selected exact source value");
                  const selected = await design
                    .locator(".CodeMirror")
                    .evaluate((el) => {
                      const cm = /** @type {any} */ (el).CodeMirror;
                      return {
                        text: cm.getValue(),
                        selected: cm.getSelection(),
                        readOnly: cm.getOption("readOnly"),
                      };
                    });
                  if (kind === "attached")
                    await design
                      .getByRole("button", {
                        name: "Back to OpenAPI",
                        exact: true,
                      })
                      .click();
                  await design
                    .getByRole("tab", { name: "Operations", exact: true })
                    .click();
                  assert.ok(
                    await design
                      .getByRole("button", {
                        name: "Generate 1 requests",
                        exact: true,
                      })
                      .isDisabled(),
                  );
                  const after = await invoke("load_workspace");
                  assert.equal(
                    after.resources.filter(
                      (/** @type {any} */ r) =>
                        r.sourceSpecId === specId && r._type === "request",
                    ).length,
                    0,
                  );
                  assert.deepEqual(
                    after.resources.filter(
                      (/** @type {any} */ r) => r._id !== specId,
                    ),
                    before.resources.filter(
                      (/** @type {any} */ r) => r._id !== specId,
                    ),
                  );
                  assert.deepEqual(after.history, before.history);
                  assert.equal(received.length, 0);
                  checks.push({
                    kind,
                    disabled: true,
                    exactSelection: selected,
                    zeroIO: true,
                    noRequests: true,
                  });
                }
                await design
                  .getByText("1 reference files", { exact: true })
                  .click();
                await design
                  .getByRole("button", {
                    name: "Remove reference",
                    exact: true,
                  })
                  .click();
                await poll(
                  async () =>
                    (await invoke("load_workspace")).resources.find(
                      (/** @type {any} */ r) => r._id === specId,
                    )?.files?.length === 0,
                  "Dialect file removed for repair",
                );
                await replace(valid);
              },
            },
          );
          await page
            .getByRole("complementary", { name: "Collections" })
            .getByRole("button", { name: "POST dialect", exact: true })
            .click();
          const before = await invoke("load_workspace");
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await poll(
            async () =>
              (await invoke("load_workspace")).history.length ===
              before.history.length + 1,
            "Repaired dialect response persisted",
          );
          assert.equal(received.length, 1);
          assert.equal(received[0].base64, Buffer.from("6").toString("base64"));
          assert.equal(received[0].target, "/dialect");
          assert.equal(received[0].type, "application/json");
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          await page.reload();
          await page
            .getByRole("button", { name: "Send", exact: true })
            .waitFor();
          assert.equal(received.length, 1);
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          await Bun.write(
            output + "/acceptance.json",
            JSON.stringify(
              {
                passed: true,
                version,
                specId,
                checks,
                received,
                repair: { generated: true, wire: true, reload: true },
                limits:
                  "Named native ordinary dialect guard/navigation/repair only; additional dialect support and full migration gates remain open",
              },
              null,
              2,
            ),
          );
          return;
        }
        if (referenceOnly) {
          const document = referenceObjectDocument(version);
          if (version === "2.0") document.host = "127.0.0.1:" + server.port;
          else document.servers = [{ url: "http://127.0.0.1:" + server.port }];
          const specId = await generateOwnedOpenApi(
            { page, invoke, output },
            document,
            2,
            "Owned reference roles",
            { preserveOwnedCollection: true },
          );
          const generated = await invoke("load_workspace");
          const owned = generated.resources.find(
            (/** @type {any} */ r) =>
              r.sourceSpecId === specId && r.name === "owned",
          );
          assert.ok(owned);
          if (version !== "2.0") {
            assert.equal(owned.authentication.type, "apikey");
            assert.equal(owned.authentication.key, "X-Owned");
            owned.authentication.value = "owned-key";
            await invoke("save_workspace", { data: generated });
          }
          await page.reload();
          const checks = [];
          for (const [name, method, target, text] of [
            [
              "owned",
              "POST",
              "/owned?owned=correct",
              version === "2.0"
                ? ""
                : JSON.stringify({ source: "owned" }, null, 2),
            ],
            ["detached", "GET", "/detached?nested=nestedvalue", ""],
          ]) {
            await page
              .getByRole("complementary", { name: "Collections" })
              .getByRole("button", { name: method + " " + name, exact: true })
              .click();
            const before = await invoke("load_workspace"),
              count = received.length;
            const request = before.resources.find(
              (/** @type {any} */ r) =>
                r.sourceSpecId === specId && r.name === name,
            );
            assert.ok(request);
            assert.deepEqual(request._openapiSchemaIssues || [], []);
            assert.deepEqual(request._openapiIssues || [], []);
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await poll(
              async () =>
                (await invoke("load_workspace")).history.length ===
                before.history.length + 1,
              "Reference role wire response persisted",
            );
            assert.equal(received.length, count + 1);
            assert.equal(received[count].target, target);
            assert.equal(received[count].method, method);
            assert.equal(
              received[count].base64,
              Buffer.from(text).toString("base64"),
            );
            assert.equal(
              received[count].apiKey,
              name === "owned" && version !== "2.0" ? "owned-key" : null,
            );
            assert.deepEqual(
              (await invoke("load_workspace")).resources,
              before.resources,
            );
            await page.reload();
            await page
              .getByRole("button", { name: "Send", exact: true })
              .waitFor();
            assert.equal(received.length, count + 1);
            assert.deepEqual(
              (await invoke("load_workspace")).resources,
              before.resources,
            );
            checks.push({
              name,
              method,
              target,
              wire: received[count],
              reload: true,
            });
          }
          await Bun.write(
            output + "/acceptance.json",
            JSON.stringify(
              {
                passed: true,
                version,
                checks,
                received,
                limits:
                  "Named Windows Reference Object generation/query/body/auth/nested hidden-target wire only; full role/provider/platform/OS-close coverage remains open",
              },
              null,
              2,
            ),
          );
          return;
        }
        if (legacyOnly) {
          const select = (/** @type {string} */ name) => {
            const entry = legacySchemaCases.find((e) => e.name === name);
            assert.ok(entry);
            return structuredClone(entry);
          };
          const entries = /** @type {Record<string,any>[]} */ ([
            { ...select("exclusive minimum accepts above"), id: "minimum" },
            { ...select("exclusive maximum accepts below"), id: "maximum" },
            { ...select("readOnly required"), id: "readonly" },
            { ...select("generated exclusive sample"), id: "sample" },
            {
              ...select("exclusive minimum accepts above"),
              id: "query",
              query: true,
            },
            { ...select("generated pattern requires review"), id: "review" },
          ]);
          if (legacySiblingsOnly)
            entries.splice(
              0,
              entries.length,
              {
                id: "ignored-type",
                schema: { type: "integer" },
                value: 6,
                referenceSiblings: { type: "string" },
              },
              {
                id: "ignored-nullable",
                schema: { type: "string" },
                value: "owned",
                referenceSiblings: { nullable: true },
              },
              {
                id: "detached",
                schema: { type: "integer", default: 7 },
                value: 7,
                detached: true,
              },
              {
                ...select("generated pattern requires review"),
                id: "review",
                referenceSiblings: { pattern: ".*" },
              },
            );
          if (version === "2.0" && !legacySiblingsOnly) {
            const entry = entries.find((e) => e.id === "readonly");
            assert.ok(entry);
            delete entry.value;
            entry.schema.properties.name.default = "owned";
            entry.generatedReadonly = true;
          }
          if (version !== "2.0" && !legacySiblingsOnly)
            entries.push(
              { ...select("nullable typed null"), id: "nullable" },
              { ...select("nested nullable"), id: "nested" },
              {
                ...select("exclusive minimum accepts above"),
                id: "external",
                external: true,
                raw: " 6e+00\n",
              },
              {
                ...select("exclusive minimum accepts above"),
                id: "external-invalid",
                external: true,
                raw: " 5 \n",
                refusal: true,
              },
            );
          const document = /** @type {Record<string,any>} */ (
            legacySchemaDocument(version, entries[0])
          );
          document.paths = {};
          if (version === "2.0") {
            document.host = "127.0.0.1:" + server.port;
            document.definitions = {};
          } else {
            document.servers = [{ url: "http://127.0.0.1:" + server.port }];
            document.components.schemas = {};
          }
          for (const [index, entry] of entries.entries()) {
            const part = /** @type {Record<string,any>} */ (
                legacySchemaDocument(version, entry)
              ),
              op = part.paths["/owned"].post,
              key = "Legacy" + index;
            op.operationId = entry.id;
            if (version === "2.0") {
              document.definitions[key] = part.definitions.Payload;
              if (op.parameters[0].schema)
                op.parameters[0].schema = { $ref: "#/definitions/" + key };
            } else {
              document.components.schemas[key] =
                part.components.schemas.Payload;
              if (entry.query)
                op.parameters[0].schema = {
                  $ref: "#/components/schemas/" + key,
                };
              else {
                const media = op.requestBody.content["application/json"];
                media.schema = { $ref: "#/components/schemas/" + key };
                if (entry.external)
                  media.examples.owned.externalValue = entry.id + ".json";
              }
            }
            if (legacySiblingsOnly) {
              const definitions =
                version === "2.0"
                  ? document.definitions
                  : document.components.schemas;
              const prefix =
                version === "2.0" ? "#/definitions/" : "#/components/schemas/";
              const schema =
                version === "2.0"
                  ? op.parameters[0].schema
                  : op.requestBody.content["application/json"].schema;
              Object.assign(schema, entry.referenceSiblings || {});
              if (entry.detached) {
                const target = definitions[key];
                definitions[key + "Plain"] = { type: "string" };
                definitions[key] = {
                  $ref: prefix + key + "Plain",
                  properties: { owned: target },
                };
                schema.$ref += "/properties/owned";
              }
            }
            document.paths["/" + entry.id] = { post: op };
          }
          const specId = await generateOwnedOpenApi(
            { page, invoke, output },
            document,
            entries.length,
            "Owned legacy schema",
            {
              preserveOwnedCollection: true,
              beforeCheck: async ({ design, specId }) => {
                const assets = entries
                  .filter((e) => e.external)
                  .map((e) => ({
                    name: e.id + ".json",
                    mimeType: "application/json",
                    buffer: Buffer.from(e.raw),
                  }));
                if (assets.length) {
                  await design
                    .getByText("Attach example files", { exact: true })
                    .locator("input[type=file]")
                    .setInputFiles(assets);
                  await poll(
                    async () =>
                      (await invoke("load_workspace")).resources.find(
                        (/** @type {any} */ r) => r._id === specId,
                      )?.exampleFiles?.length === assets.length,
                    "Legacy external assets persisted",
                  );
                }
              },
              afterCheck: async ({ design }) => {
                await design.getByRole("tab", { name: /^Diagnostics/ }).click();
                const diagnostics = await design
                  .locator(".design-diagnostics")
                  .innerText();
                await Bun.write(output + "/diagnostics.txt", diagnostics);
                await design
                  .getByRole("tab", { name: "Operations", exact: true })
                  .click();
                assert.ok(
                  await design
                    .getByRole("button", {
                      name: "Generate " + entries.length + " requests",
                      exact: true,
                    })
                    .isEnabled(),
                  diagnostics,
                );
              },
            },
          );
          const data = await invoke("load_workspace");
          for (const entry of entries.filter((e) => e.refusal)) {
            const r = data.resources.find(
              (/** @type {any} */ r) =>
                r.sourceSpecId === specId && r.name === entry.id,
            );
            assert.ok(
              r._openapiSchemaIssues.some((/** @type {string} */ i) =>
                i.includes("Example does not satisfy the schema:"),
              ),
            );
            r._openapiIssues = [];
          }
          await invoke("save_workspace", { data });
          await page.reload();
          const checks = [];
          const selectRequest = async (/** @type {string} */ name) => {
            await page
              .getByRole("complementary", { name: "Collections" })
              .getByRole("button", { name: "POST " + name, exact: true })
              .click();
            return (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ r) =>
                r.sourceSpecId === specId && r.name === name,
            );
          };
          for (const entry of entries) {
            const request = await selectRequest(entry.id),
              before = await invoke("load_workspace"),
              count = received.length;
            assert.ok(request);
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            if (entry.refusal) {
              await poll(
                async () =>
                  (await page.locator(".error-state").innerText()).includes(
                    "Example does not satisfy the schema:",
                  ),
                "Legacy schema-only refusal",
              );
              assert.equal(received.length, count);
              assert.deepEqual(
                (await invoke("load_workspace")).history,
                before.history,
              );
              assert.deepEqual(request._openapiIssues, []);
            } else {
              await poll(
                async () =>
                  (await invoke("load_workspace")).history.length ===
                  before.history.length + 1,
                "Legacy response persisted",
              );
              const wanted = entry.query
                ? ""
                : entry.external
                  ? entry.raw
                  : entry.generatedReadonly
                    ? JSON.stringify({ name: "owned" }, null, 2)
                    : entry.generated
                      ? "6"
                      : JSON.stringify(entry.value, null, 2);
              assert.equal(received.length, count + 1);
              assert.equal(
                received[count].base64,
                Buffer.from(wanted).toString("base64"),
              );
              assert.equal(
                received[count].target,
                entry.query ? "/query?n=6" : "/" + entry.id,
              );
              assert.equal(
                received[count].type,
                entry.query ? null : "application/json",
              );
            }
            assert.deepEqual(
              (await invoke("load_workspace")).resources,
              before.resources,
            );
            await page.reload();
            await page
              .getByRole("button", { name: "Send", exact: true })
              .waitFor();
            assert.equal(received.length, count + (entry.refusal ? 0 : 1));
            assert.deepEqual(
              (await invoke("load_workspace")).resources,
              before.resources,
            );
            checks.push({
              name: entry.id,
              refusal: !!entry.refusal,
              wire: entry.refusal ? null : received[count],
              reload: true,
            });
            await Bun.write(
              output + "/progress.json",
              JSON.stringify(
                {
                  version,
                  done: checks.length,
                  total: entries.length,
                  received,
                },
                null,
                2,
              ),
            );
          }
          const request = await selectRequest("review");
          await page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", { name: /^Body/ })
            .click();
          const body = page.getByRole("region", {
            name: "Body editor",
            exact: true,
          });
          await body
            .getByRole("combobox", { name: "Body type", exact: true })
            .selectOption("application/json");
          await body.locator(".CodeMirror").evaluate((el) => {
            /** @type {any} */ (el).CodeMirror.setValue('"owned"');
          });
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === request._id,
              )?.body.text === '"owned"',
            "Legacy repair persisted",
          );
          const blocked = await invoke("load_workspace"),
            count = received.length;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await poll(
            async () =>
              (await page.locator(".error-state").innerText()).includes(
                "Example does not satisfy the schema:",
              ),
            "Legacy body edit retains review",
          );
          assert.equal(received.length, count);
          assert.deepEqual(
            (await invoke("load_workspace")).history,
            blocked.history,
          );
          await page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", { name: "Settings", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: "I have corrected these request fields",
              exact: true,
            })
            .click();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === request._id,
              )?._openapiSchemaIssues?.length === 0,
            "Legacy review acknowledged",
          );
          const ready = await invoke("load_workspace");
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await poll(
            async () =>
              (await invoke("load_workspace")).history.length ===
              ready.history.length + 1,
            "Legacy repaired response persisted",
          );
          assert.equal(received.length, count + 1);
          assert.equal(
            received[count].base64,
            Buffer.from('"owned"').toString("base64"),
          );
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            ready.resources,
          );
          await page.reload();
          await page
            .getByRole("button", { name: "Send", exact: true })
            .waitFor();
          assert.equal(received.length, count + 1);
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            ready.resources,
          );
          await Bun.write(
            output + "/acceptance.json",
            JSON.stringify(
              {
                passed: true,
                version,
                checks,
                received,
                repair: {
                  bodyEditRefused: true,
                  zeroIO: true,
                  historyUnchanged: true,
                  acknowledged: true,
                  repaired: true,
                  reload: true,
                },
                limits:
                  "Named Windows legacy schema generation/wire/durable-review cases only; full legacy/vendor/provider/platform and all migration gates remain open.",
              },
              null,
              2,
            ),
          );
          return;
        }
        if (ordinaryOnly) {
          const raw = ' { "n": 9007199254740993 }\n',
            invalid = ' { "n": "bad" }\n',
            repair = ' { "n": 1e+02 }\n';
          const schema = {
              type: "object",
              required: ["n"],
              properties: { n: { type: "number" } },
            },
            media = (/** @type {Record<string,any>} */ example) => ({
              schema: { $ref: "#/components/schemas/Payload" },
              examples: { owned: example },
            });
          const cases = /** @type {Record<string,any>[]} */ ([
            {
              name: "inline",
              media: media({ value: { n: 2 } }),
              text: JSON.stringify({ n: 2 }, null, 2),
            },
            {
              name: "external",
              media: media({ externalValue: "valid.json" }),
              text: raw,
            },
            {
              name: "invalid",
              media: media({ externalValue: "invalid.json" }),
              refusal: true,
            },
            {
              name: "query",
              media: media({ value: { n: 2 } }),
              query: true,
              target: "/query?payload=%7B%22n%22%3A2%7D",
              text: "",
            },
            {
              name: "sample",
              media: {
                schema: {
                  type: "object",
                  required: ["n", "serverOnly"],
                  properties: {
                    n: { type: "integer", minimum: 5 },
                    serverOnly: { type: "string", readOnly: true },
                  },
                },
              },
              text: JSON.stringify({ n: 5 }, null, 2),
            },
          ]);
          if (version.startsWith("3.2."))
            cases.push({
              name: "serialized",
              media: media({ serializedValue: raw }),
              text: raw,
            });
          const document = {
            openapi: version,
            info: { title: "Owned ordinary schemas", version: "1" },
            servers: [{ url: "http://127.0.0.1:" + server.port }],
            components: { schemas: { Payload: schema } },
            paths: Object.fromEntries(
              cases.map((c) => [
                "/" + c.name,
                {
                  post: {
                    operationId: c.name,
                    ...(c.query
                      ? {
                          parameters: [
                            {
                              name: "payload",
                              in: "query",
                              content: { "application/json": c.media },
                            },
                          ],
                        }
                      : {
                          requestBody: {
                            content: { "application/json": c.media },
                          },
                        }),
                    responses: { 200: { description: "OK" } },
                  },
                },
              ]),
            ),
          };
          const specId = await generateOwnedOpenApi(
            { page, invoke, output },
            document,
            cases.length,
            "Owned ordinary schemas",
            {
              preserveOwnedCollection: true,
              beforeCheck: async ({ design, specId }) => {
                await design
                  .getByText("Attach example files", { exact: true })
                  .locator("input[type=file]")
                  .setInputFiles([
                    {
                      name: "valid.json",
                      mimeType: "application/json",
                      buffer: Buffer.from(raw),
                    },
                    {
                      name: "invalid.json",
                      mimeType: "application/json",
                      buffer: Buffer.from(invalid),
                    },
                  ]);
                await poll(
                  async () =>
                    (await invoke("load_workspace")).resources.find(
                      (/** @type {any} */ r) => r._id === specId,
                    )?.exampleFiles?.length === 2,
                  "Ordinary raw assets persisted",
                );
              },
              afterCheck: async ({ design }) => {
                await design.getByRole("tab", { name: /^Diagnostics/ }).click();
                const diagnostics = await design
                  .locator(".design-diagnostics")
                  .innerText();
                await Bun.write(output + "/diagnostics.txt", diagnostics);
                await design
                  .getByRole("tab", { name: "Operations", exact: true })
                  .click();
                assert.ok(
                  await design
                    .getByRole("button", {
                      name: "Generate " + cases.length + " requests",
                      exact: true,
                    })
                    .isEnabled(),
                  diagnostics,
                );
              },
            },
          );
          const checks = [];
          for (const entry of cases.filter((c) => !c.refusal)) {
            const request = (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ r) =>
                r.sourceSpecId === specId && r.name === entry.name,
            );
            assert.ok(request);
            assert.deepEqual(request._openapiIssues, []);
            await page
              .getByRole("complementary", { name: "Collections" })
              .getByRole("button", { name: "POST " + entry.name, exact: true })
              .click();
            const before = await invoke("load_workspace"),
              count = received.length;
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await poll(
              async () =>
                (await invoke("load_workspace")).history.length ===
                before.history.length + 1,
              "Ordinary response persisted",
            );
            assert.equal(received.length, count + 1);
            assert.equal(
              received[count].target,
              entry.target || "/" + entry.name,
            );
            assert.equal(
              received[count].base64,
              Buffer.from(entry.text).toString("base64"),
            );
            assert.equal(
              received[count].type,
              entry.query ? null : "application/json",
            );
            assert.deepEqual(
              (await invoke("load_workspace")).resources,
              before.resources,
            );
            await page.reload();
            await page
              .getByRole("button", { name: "Send", exact: true })
              .waitFor();
            assert.equal(received.length, count + 1);
            assert.deepEqual(
              (await invoke("load_workspace")).resources,
              before.resources,
            );
            checks.push({
              name: entry.name,
              wire: received[count],
              reload: true,
            });
          }
          let data = await invoke("load_workspace");
          const invalidRequest = data.resources.find(
            (/** @type {any} */ r) =>
              r.sourceSpecId === specId && r.name === "invalid",
          );
          assert.ok(
            invalidRequest._openapiSchemaIssues.some(
              (/** @type {string} */ i) =>
                i.includes("Example does not satisfy the schema:"),
            ),
          );
          // Isolate durable schema review exactly as the existing boolean scenario.
          invalidRequest._openapiIssues = [];
          await invoke("save_workspace", { data });
          await page.reload();
          await page
            .getByRole("complementary", { name: "Collections" })
            .getByRole("button", { name: "POST invalid", exact: true })
            .click();
          const refuse = async () => {
            const before = await invoke("load_workspace"),
              count = received.length;
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await page
              .getByText("Review this generated request", { exact: false })
              .first()
              .waitFor();
            assert.equal(received.length, count);
            assert.deepEqual(
              (await invoke("load_workspace")).history,
              before.history,
            );
            assert.deepEqual(
              (await invoke("load_workspace")).resources,
              before.resources,
            );
            return before;
          };
          await refuse();
          await page.reload();
          await page
            .getByRole("button", { name: "Send", exact: true })
            .waitFor();
          assert.equal(received.length, checks.length);
          const bodyTab = page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", { name: /^Body/ });
          await bodyTab.click();
          await page
            .getByRole("region", { name: "Body editor", exact: true })
            .getByRole("combobox", { name: "Body type", exact: true })
            .selectOption("application/json");
          await page
            .getByRole("region", { name: "Body editor", exact: true })
            .locator(".CodeMirror")
            .evaluate((el, text) => {
              /** @type {any} */ (el).CodeMirror.setValue(text);
            }, repair);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === invalidRequest._id,
              )?.body.text === repair,
            "Ordinary repair persisted",
          );
          await refuse();
          await page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", { name: "Settings", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: "I have corrected these request fields",
              exact: true,
            })
            .click();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === invalidRequest._id,
              )?._openapiSchemaIssues?.length === 0,
            "Explicit schema review acknowledged",
          );
          const before = await invoke("load_workspace"),
            count = received.length;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await poll(
            async () =>
              (await invoke("load_workspace")).history.length ===
              before.history.length + 1,
            "Reviewed repaired response persisted",
          );
          assert.equal(received.length, count + 1);
          assert.equal(
            received[count].base64,
            Buffer.from(repair).toString("base64"),
          );
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          await page.reload();
          await page
            .getByRole("button", { name: "Send", exact: true })
            .waitFor();
          assert.equal(received.length, count + 1);
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          await Bun.write(
            output + "/acceptance.json",
            JSON.stringify(
              {
                passed: true,
                version,
                checks,
                received,
                durableSchemaReview: {
                  refusals: 2,
                  zeroIO: true,
                  historyUnchanged: true,
                  reload: true,
                  bodyEditRetainsReview: true,
                  explicitAcknowledgment: true,
                  repaired: true,
                },
                limits:
                  "Windows ordinary modern schema generation/semantic validation, exact raw/query/sample wire and durable review/repair only; remaining dialect/precision/provider/platform/full migration gates open.",
              },
              null,
              2,
            ),
          );
          return;
        }
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);
        const document = /** @type {Record<string,any>} */ (
          booleanSchemaDocument(version, "http://127.0.0.1:" + server.port)
        );
        const extra = /** @type {Record<string,any>[]} */ ([
          {
            name: "attached true root",
            schema: { $ref: "allowed.json" },
            expected: null,
          },
          {
            name: "attached false root",
            schema: { $ref: "denied.json" },
            refusal: true,
          },
          {
            name: "dynamic pointer to false",
            schema: { $dynamicRef: "#/components/schemas/False" },
            refusal: true,
          },
          {
            name: "optional impossible body",
            schema: false,
            optional: true,
            empty: true,
          },
          {
            name: "optional false parameter",
            schema: { type: "string", default: "allowed" },
            parameter: { required: false },
            expected: "allowed",
          },
          {
            name: "required false parameter",
            schema: { type: "string", default: "allowed" },
            parameter: { required: true },
            refusal: true,
          },
        ]);
        const rawExamples = [
          {
            name: "raw-valid.json",
            contents: ' { "allowed":true }\n',
            valid: true,
          },
          {
            name: "raw-invalid.json",
            contents: ' { "forbidden":true }\n',
            valid: false,
          },
        ];
        for (const raw of rawExamples)
          for (const format of version.startsWith("3.2.")
            ? ["external", "serialized"]
            : ["external"])
            extra.push({
              name:
                format +
                " " +
                (raw.valid ? "valid" : "invalid") +
                " JSON bytes",
              raw: raw.contents,
              external: format === "external",
              refusal: !raw.valid,
              media: {
                schema: { type: "object", properties: { forbidden: false } },
                examples: {
                  owned:
                    format === "external"
                      ? { externalValue: raw.name }
                      : { serializedValue: raw.contents },
                },
              },
            });
        for (const [index, entry] of extra.entries())
          document.paths["/extra-" + index] = {
            post: {
              summary: entry.name,
              operationId: "extra_" + index,
              requestBody: {
                required: !entry.optional,
                content: {
                  "application/json": entry.media || { schema: entry.schema },
                },
              },
              ...(entry.parameter
                ? {
                    parameters: [
                      {
                        name: "forbidden",
                        in: "query",
                        schema: { $ref: "#/components/schemas/False" },
                        ...entry.parameter,
                      },
                    ],
                  }
                : {}),
              responses: { 200: { description: "OK" } },
            },
          };
        await Bun.write(
          output + "/fixture.json",
          JSON.stringify({ version, port: server.port, document }, null, 2),
        );
        const referenceFiles = [
          { name: "allowed.json", contents: "true" },
          { name: "denied.json", contents: "false" },
        ];
        const specId = await generateOwnedOpenApi(
          { page, invoke, output },
          document,
          booleanSchemaCases.length + extra.length,
          "Boolean schemas",
          {
            beforeCheck: async ({ design, specId }) => {
              await design
                .getByText("Attach $ref files", { exact: true })
                .locator("input[type=file]")
                .setInputFiles(
                  referenceFiles.map((file) => ({
                    name: file.name,
                    mimeType: "application/json",
                    buffer: Buffer.from(file.contents),
                  })),
                );
              await design
                .getByText("Attach example files", { exact: true })
                .locator("input[type=file]")
                .setInputFiles(
                  rawExamples.map((raw) => ({
                    name: raw.name,
                    mimeType: "application/json",
                    buffer: Buffer.from(raw.contents),
                  })),
                );
              await poll(
                async () =>
                  (await invoke("load_workspace")).resources.find(
                    (/** @type {any} */ r) => r._id === specId,
                  )?.exampleFiles?.length === 2,
                "Owned raw JSON examples persisted",
              );
            },
          },
        );
        const data = await invoke("load_workspace"),
          spec = data.resources.find(
            (/** @type {any} */ r) => r._id === specId,
          );
        assert.equal(spec.contents, JSON.stringify(document, null, 2));
        assert.deepEqual(
          spec.files.map((/** @type {any} */ f) => ({
            name: f.name,
            contents: f.contents,
          })),
          referenceFiles,
        );
        const requests = data.resources.filter(
          (/** @type {any} */ r) =>
            r._type === "request" && r.sourceSpecId === specId,
        );
        // Persist only durable review metadata on refused owned requests, then
        // reload the app. The headless contracts separately prove actual Git decode.
        await invoke("save_workspace", {
          data: {
            ...data,
            resources: data.resources.map((/** @type {any} */ r) =>
              r.sourceSpecId === specId && r._openapiSchemaIssues?.length
                ? { ...r, _openapiIssues: [] }
                : r,
            ),
          },
        });
        await page.reload();
        const durableData = await invoke("load_workspace");
        await Bun.write(
          output + "/generated.json",
          JSON.stringify({ sourceSpec: spec, requests, durableData }, null, 2),
        );
        await Bun.write(
          output + "/collections-aria.txt",
          await page
            .getByRole("complementary", { name: "Collections" })
            .ariaSnapshot(),
        );
        const cases = /** @type {Record<string,any>[]} */ ([
          ...booleanSchemaCases.map((entry, index) => ({
            ...entry,
            target: "/boolean-" + index,
          })),
          ...extra.map((entry, index) => ({
            ...entry,
            target: "/extra-" + index,
          })),
        ]);
        const checks = [];
        for (const entry of cases.filter(
          (entry) => !readOnlyOnly || entry.readOnlyContract,
        )) {
          const request = requests.find(
            (/** @type {any} */ r) => new URL(r.url).pathname === entry.target,
          );
          assert.ok(request);
          if (readOnlyOnly && entry.name === "readonly direct false branch") {
            await page.setViewportSize({ width: 760, height: 960 });
          }
          const encoded = encodeGitResource(request),
            restored = decodeGitResource(encoded.path, encoded.content);
          assert.ok(restored);
          await page
            .getByRole("complementary", { name: "Collections" })
            .locator("button.tree-request")
            .filter({ has: page.getByText(request.name, { exact: true }) })
            .click();
          const count = received.length,
            before = await invoke("load_workspace");
          if (entry.refusal) {
            const actual = before.resources.find(
              (/** @type {any} */ r) => r._id === request._id,
            );
            assert.deepEqual(actual._openapiIssues, []);
            assert.ok(actual._openapiSchemaIssues.length);
            assert.ok(
              request._openapiIssues.length &&
                restored._openapiSchemaIssues.length,
            );
            assert.throws(
              () =>
                prepareRenderedRequest(
                  { ...data, resources: [...data.resources, restored] },
                  restored,
                  "run_bool",
                ),
              /Review this generated request/,
            );
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await page
              .getByText("Review this generated request", { exact: false })
              .first()
              .waitFor();
            assert.equal(
              received.length,
              count,
              "Refused request must not reach owned server",
            );
            assert.deepEqual(
              (await invoke("load_workspace")).history,
              before.history,
            );
            await page
              .getByRole("tablist", { name: "Request editor", exact: true })
              .getByRole("tab", { name: "Settings", exact: true })
              .click();
            await page
              .getByText("This generated request needs manual corrections:", {
                exact: true,
              })
              .waitFor();
            if (entry.name === "false root") {
              await page.setViewportSize({ width: 760, height: 960 });
              await page.screenshot({
                path: output + "/durable-review-760.png",
              });
              await page
                .getByRole("button", {
                  name: "I have corrected these request fields",
                  exact: true,
                })
                .click();
              await poll(async () => {
                const r = (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ r) => r._id === request._id,
                );
                return (
                  r?._openapiIssues?.length === 0 &&
                  r?._openapiSchemaIssues?.length === 0
                );
              }, "Explicit durable review clears both metadata arrays");
              const reviewed = (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === request._id,
              );
              assert.deepEqual(reviewed.body, request.body);
              assert.equal(reviewed.url, request.url);
              await Bun.write(
                output + "/review.json",
                JSON.stringify(
                  { passed: true, before: request, after: reviewed },
                  null,
                  2,
                ),
              );
            }
          } else {
            assert.deepEqual(request._openapiIssues, []);
            const wanted = entry.empty
              ? ""
              : (entry.raw ?? JSON.stringify(entry.expected, null, 2));
            if (entry.external) {
              assert.equal(
                request.body.base64,
                Buffer.from(wanted).toString("base64"),
              );
              assert.equal(restored.body.base64, request.body.base64);
            } else {
              assert.equal(request.body.text, wanted);
              assert.equal(restored.body.text, wanted);
            }
            if (readOnlyOnly && entry.name === "readonly direct false branch") {
              await page
                .getByRole("tablist", { name: "Request editor", exact: true })
                .getByRole("tab", { name: "Body", exact: true })
                .click();
              await page.screenshot({
                path: output + "/readonly-body-760.png",
              });
            }
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await poll(
              async () => received.length === count + 1,
              "Allowed boolean sample received",
            );
            const bytes = Buffer.from(wanted),
              wire = received[count];
            assert.deepEqual(wire, {
              target: entry.target,
              method: "POST",
              base64: bytes.toString("base64"),
              sha256: createHash("sha256").update(bytes).digest("hex"),
            });
            await poll(
              async () =>
                (await invoke("load_workspace")).history.some(
                  (/** @type {any} */ row) =>
                    row.requestId === request._id &&
                    !before.history.some(
                      (/** @type {any} */ old) => old._id === row._id,
                    ),
                ),
              "Boolean send history settled",
            );
          }
          checks.push({
            name: entry.name,
            target: entry.target,
            refusal: !!entry.refusal,
            passed: true,
          });
          if (readOnlyOnly)
            await Bun.write(
              output + "/readonly-progress.json",
              JSON.stringify({ version, checks, received }, null, 2),
            );
        }
        const persisted = await invoke("load_workspace");
        await page.reload();
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          persisted.resources,
        );
        await Bun.write(
          output + "/acceptance.json",
          JSON.stringify(
            {
              passed: true,
              version,
              caseSet: readOnlyOnly ? "readonly" : "all",
              checks,
              received,
              sourceSpec: spec,
              requests,
              durableRequests: durableData.resources.filter(
                (/** @type {any} */ r) =>
                  r.sourceSpecId === specId && r._type === "request",
              ),
              referenceFiles,
              sourcePreserved: true,
            },
            null,
            2,
          ),
        );
      },
    );
  if (ordinaryOnly || legacyOnly || referenceOnly || dialectOnly)
    await preserveNativeProfile(() =>
      withResourceProbePreserved(run, {
        expectedIdentifier: integrationProbeIdentifier,
      }),
    );
  else await run();
} finally {
  server.stop(true);
}
