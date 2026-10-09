import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import { schemaResourceDocument } from "./helpers/openapi-schema-resource-contract.js";
import { dynamicSchemaDocument } from "./helpers/openapi-dynamic-schema-contract.js";
import {
  apiDesignLayoutMetrics,
  assertApiDesignLayout,
  assertApiDesignAttachmentFocus,
} from "./helpers/api-design-layout.js";

const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.2.1";
assert.ok(["3.0.3", "3.1.0", "3.2.0", "3.2.1"].includes(version));
const binary = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
const json = Buffer.from(' { "number":9007199254740993, "empty":"" }\n');
const query = Buffer.from("owned=hello%20world");
let slowStarted = false;
/** @type {((response:Response)=>void)|undefined} */
let releaseSlow;
const loadingControls = /** @type {{name:string,passed:boolean}[]} */ ([]);
const received =
  /** @type {{target:string,method:string,base64:string,sha256:string}[]} */ ([]);
const fixture = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 120,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/failed-example")
      return new Response("Unavailable", { status: 503 });
    if (url.pathname === "/slow-example") {
      slowStarted = true;
      return new Promise((resolve) => {
        releaseSlow = resolve;
      });
    }
    if (url.pathname === "/example.json")
      return new Response(json, {
        headers: { "Content-Type": "application/json" },
      });
    const bytes = new Uint8Array(await request.arrayBuffer());
    received.push({
      target: url.pathname + url.search,
      method: request.method,
      base64: Buffer.from(bytes).toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    return new Response("OK");
  },
});
const base = "http://127.0.0.1:" + fixture.port;
try {
  await withNativeApp(
    "openapi-external-example",
    async ({ page, invoke, output }) => {
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);
      await Bun.write(
        output + "/fixture.json",
        JSON.stringify({ base, port: fixture.port, version }),
      );
      const example = (/** @type {string} */ externalValue) => ({
        examples: { owned: { externalValue } },
      });
      const response = { 200: { description: "OK" } };
      const literalPayload = /** @type {Record<string,any>} */ ({
        examples: { owned: { externalValue: "literal.txt" } },
      });
      let referenceDocument = /** @type {Record<string,any>} */ ({
        value: {
          content: { "application/octet-stream": example("local.bin") },
        },
        parameter: {
          name: "owned",
          in: "query",
          schema: { type: "string" },
          ...example("query.txt"),
        },
      });
      const document = /** @type {Record<string,any>} */ ({
        openapi: version,
        info: { title: "Owned external examples", version: "1" },
        servers: [{ url: base }],
        paths: {
          "/binary": {
            post: {
              requestBody: {
                content: { "application/octet-stream": example("local.bin") },
              },
              responses: response,
            },
          },
          "/json": {
            post: {
              requestBody: {
                content: {
                  "application/json": example(base + "/example.json"),
                },
              },
              responses: response,
            },
          },
          "/query": {
            get: {
              parameters: [
                {
                  name: "owned",
                  in: "query",
                  schema: { type: "string" },
                  ...example("query.txt"),
                },
              ],
              responses: response,
            },
          },
        },
      });
      document.paths["/binary"].post.requestBody = {
        $ref: "objects.json#/value",
      };
      document.paths["/query"].get.parameters = [
        { $ref: "objects.json#/parameter" },
      ];
      if (version.startsWith("3.2.")) {
        document.$self = base + "/shared/api.yaml";
        referenceDocument.value.content["application/octet-stream"] = example(
          "../shared/local.bin",
        );
        referenceDocument.parameter.examples = example(
          "../shared/query.txt",
        ).examples;
        referenceDocument = {
          openapi: version,
          $self: "../components/objects.json",
          info: { title: "Declared component base", version: "1" },
          components: {
            requestBodies: { Value: referenceDocument.value },
            parameters: { Owned: referenceDocument.parameter },
          },
        };
        document.paths["/binary"].post.requestBody = {
          $ref:
            base + "/components/objects.json#/components/requestBodies/Value",
        };
        document.paths["/query"].get.parameters = [
          {
            $ref:
              base + "/components/objects.json#/components/parameters/Owned",
          },
        ];
      }
      const literalReference = Object.fromEntries([
        ["10", "numeric"],
        ["before", 1],
        ["$ref", "unattached.json#/payload"],
        ["after", { $ref: "#/components/schemas/Absent", falseValue: false }],
        ["__proto__", { $ref: 44 }],
        ["__insomnium_literal_ref__", "authored marker name"],
      ]);
      literalPayload.$ref = "unattached.json#/extension";
      document.paths["/literal"] = {
        post: {
          requestBody: {
            content: {
              "application/json": {
                examples: {
                  owned: version.startsWith("3.2.")
                    ? { dataValue: literalReference }
                    : { value: literalReference },
                },
              },
            },
          },
          responses: response,
        },
      };
      document.paths["/query"].get.operationId = "ownedQuery";
      document.paths["/json"].post.requestBody.content[
        "application/json"
      ].examples = { owned: { $ref: "examples.json#/value" } };
      document.paths["/json"].post.responses = {
        200: {
          description: "OK",
          links: {
            owned: { operationId: "ownedQuery", requestBody: literalPayload },
          },
          "x-literal": literalPayload,
        },
      };
      document.components = { "x-literal": { nested: literalPayload } };
      document.paths["x-literal"] = literalPayload;
      const schemaResources = /^3\.[12]\./.test(version);
      if (schemaResources) {
        const authored = schemaResourceDocument(version, base);
        document.jsonSchemaDialect = authored.jsonSchemaDialect;
        const attached = {
          $id: "https://schemas.example.test/attached/root",
          type: "object",
          properties: { external: { $ref: "#owned" } },
          $defs: {
            Value: { $anchor: "owned", type: "string", default: "attached" },
          },
        };
        const pointer = version.startsWith("3.2.")
          ? base + "/components/objects.json#/components/schemas/Attached"
          : "objects.json#/schemaResource";
        if (version.startsWith("3.2."))
          referenceDocument.components.schemas = { Attached: attached };
        else referenceDocument.schemaResource = attached;
        document.components.schemas = {
          ...authored.components.schemas,
          Attached: { $ref: pointer },
        };
        document.paths["/schema"] = authored.paths["/schema"];
        document.paths["/schema-attached"] = {
          post: {
            requestBody: {
              content: {
                "application/json": { schema: { $ref: attached.$id } },
              },
            },
            responses: response,
          },
        };
      }
      if (schemaResources) {
        const dynamic = dynamicSchemaDocument(version);
        Object.assign(document.components.schemas, dynamic.components.schemas);
        Object.assign(document.paths, dynamic.paths);
      }
      const specId = await generateOwnedOpenApi(
        { page, invoke, output },
        document,
        schemaResources ? 12 : 4,
        "External examples",
        {
          beforeCheck: async ({ design, specId }) => {
            await design
              .getByText("Attach $ref files", { exact: true })
              .locator("input[type=file]")
              .setInputFiles([
                {
                  name: "objects.json",
                  mimeType: "application/json",
                  buffer: Buffer.from(JSON.stringify(referenceDocument)),
                },
                {
                  name: "examples.json",
                  mimeType: "application/json",
                  buffer: Buffer.from(
                    JSON.stringify({
                      value: { externalValue: base + "/example.json" },
                    }),
                  ),
                },
              ]);
            await poll(
              async () =>
                (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ r) => r._id === specId,
                )?.files?.length === 2,
              "Typed reference documents attached and persisted",
              60000,
            );
            const download = design.getByLabel("Example download URL", {
              exact: true,
            });
            const load = design.getByRole("button", {
              name: "Load example URL",
              exact: true,
            });
            const assets = async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === specId,
              )?.exampleFiles || [];
            await download.fill(base + "/failed-example");
            await load.click();
            await design
              .getByText("Error: Example download returned HTTP 503.", {
                exact: true,
              })
              .waitFor();
            assert.equal((await assets()).length, 0);
            loadingControls.push({
              name: "HTTP failure preserves assets",
              passed: true,
            });
            await download.fill(base + "/slow-example");
            await load.click();
            await poll(
              async () => slowStarted,
              "Owned slow example request started",
            );
            await design
              .getByRole("button", { name: "Cancel example load", exact: true })
              .click();
            await design
              .getByText("Example loading cancelled.", { exact: true })
              .waitFor();
            releaseSlow?.(new Response("cancelled example must not persist"));
            assert.equal((await assets()).length, 0);
            loadingControls.push({
              name: "Cancel pending download preserves assets",
              passed: true,
            });
            await Bun.write(
              output + "/loading-progress.json",
              JSON.stringify({ controls: loadingControls }, null, 2),
            );
            const documentsBefore = new Set(
              (await invoke("load_workspace")).resources
                .filter((/** @type {any} */ r) => r._type === "api_spec")
                .map((/** @type {any} */ r) => r._id),
            );
            let creationTimedOut = false;
            try {
              await design
                .getByRole("button", { name: "New document", exact: true })
                .click();
            } catch (cause) {
              if (!String(cause).includes("Timeout")) throw cause;
              creationTimedOut = true;
            }
            let switchedId = "";
            await poll(
              async () => {
                const created = (
                  await invoke("load_workspace")
                ).resources.filter(
                  (/** @type {any} */ r) =>
                    r._type === "api_spec" && !documentsBefore.has(r._id),
                );
                assert.ok(
                  created.length <= 1,
                  "One document-switch click must create at most one document",
                );
                if (created.length !== 1) return false;
                switchedId = created[0]._id;
                return (
                  (await design
                    .getByLabel("API document", { exact: true })
                    .inputValue()) === switchedId
                );
              },
              "New owned document persisted and selected before download",
              60000,
            );
            await design
              .getByLabel("API document", { exact: true })
              .selectOption(specId);
            slowStarted = false;
            await download.fill(base + "/slow-example");
            await load.click();
            await poll(
              async () => slowStarted,
              "Owned document-switch download started",
            );
            await design
              .getByLabel("API document", { exact: true })
              .selectOption(switchedId);
            releaseSlow?.(
              new Response("changed document must not receive bytes"),
            );
            await design
              .getByText(
                "Error: Document or collection changed while loading examples. Load them again.",
                { exact: true },
              )
              .waitFor();
            assert.equal((await assets()).length, 0);
            assert.equal(
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === switchedId,
              )?.exampleFiles?.length || 0,
              0,
            );
            await design
              .getByLabel("API document", { exact: true })
              .selectOption(specId);
            loadingControls.push({
              name:
                "Document switch refuses stale bytes" +
                (creationTimedOut
                  ? " (verified click acknowledgement recovery; no repeat)"
                  : ""),
              passed: true,
            });
            await design
              .getByText("Attach example files", { exact: true })
              .locator("input[type=file]")
              .setInputFiles({
                name: "oversize.bin",
                mimeType: "application/octet-stream",
                buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
              });
            await design
              .getByText("Error: oversize.bin exceeds 2 MiB.", { exact: true })
              .waitFor();
            assert.equal((await assets()).length, 0);
            loadingControls.push({
              name: "Oversize local file preserves assets",
              passed: true,
            });
            await Bun.write(
              output + "/loading-controls.json",
              JSON.stringify(
                { passed: true, controls: loadingControls },
                null,
                2,
              ),
            );
            await design
              .getByText("Attach example files", { exact: true })
              .locator("input[type=file]")
              .setInputFiles([
                {
                  name: "local.bin",
                  mimeType: "application/octet-stream",
                  buffer: binary,
                },
                { name: "query.txt", mimeType: "text/plain", buffer: query },
              ]);
            await poll(
              async () =>
                (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ r) => r._id === specId,
                )?.exampleFiles?.length === 2,
              "Owned example files persisted",
              60000,
            );
            await design
              .getByLabel("Example download URL", { exact: true })
              .fill(base + "/example.json");
            await design
              .getByRole("button", { name: "Load example URL", exact: true })
              .click();
            await poll(
              async () =>
                (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ r) => r._id === specId,
                )?.exampleFiles?.length === 3,
              "HTTP byte example persisted",
              60000,
            );
            await design.getByText("3 example files", { exact: true }).click();
            const localName = design.getByLabel("Example file 1 name", {
              exact: true,
            });
            await localName.fill("./local.bin");
            await poll(
              async () =>
                (await assets()).some(
                  (/** @type {any} */ file) =>
                    file.name === "./local.bin" &&
                    file.base64 === binary.toString("base64"),
                ),
              "Renamed byte asset persisted without changing bytes",
              60000,
            );
            await localName.fill("local.bin");
            await poll(
              async () =>
                (await assets()).some(
                  (/** @type {any} */ file) =>
                    file.name === "local.bin" &&
                    file.base64 === binary.toString("base64"),
                ),
              "Original byte asset URI restored",
              60000,
            );
            assert.equal(
              await design
                .getByLabel("Example file 2 name", { exact: true })
                .inputValue(),
              "query.txt",
            );
            await design
              .getByRole("button", { name: "Remove example", exact: true })
              .nth(1)
              .click();
            await poll(
              async () => {
                const files = await assets();
                return (
                  files.length === 2 &&
                  !files.some(
                    (/** @type {any} */ file) => file.name === "query.txt",
                  )
                );
              },
              "Removed example persisted",
              60000,
            );
            await design
              .getByText("Attach example files", { exact: true })
              .locator("input[type=file]")
              .setInputFiles({
                name: "query.txt",
                mimeType: "text/plain",
                buffer: query,
              });
            await poll(
              async () => {
                const files = await assets();
                return (
                  files.length === 3 &&
                  files.some(
                    (/** @type {any} */ file) =>
                      file.name === "query.txt" &&
                      file.base64 === query.toString("base64"),
                  )
                );
              },
              "Removed example reattached with original bytes",
              60000,
            );
            await Bun.write(
              output + "/asset-management.json",
              JSON.stringify(
                {
                  passed: true,
                  renamed: true,
                  restored: true,
                  removed: true,
                  reattached: true,
                },
                null,
                2,
              ),
            );
            const layouts = [];
            for (const theme of ["dark", "light"]) {
              if (
                (await page.locator("html").getAttribute("data-theme")) !==
                theme
              )
                await page
                  .getByRole("button", { name: "Toggle theme", exact: true })
                  .click();
              for (const width of [1440, 900, 760]) {
                for (const height of [960, 600]) {
                  await page.setViewportSize({ width, height });
                  for (const details of await design
                    .locator(".design-references")
                    .all()) {
                    if ((await details.getAttribute("open")) === null)
                      await details.locator("summary").click();
                  }
                  await page.waitForTimeout(150);
                  const metrics = await apiDesignLayoutMetrics(design);
                  await Bun.write(
                    output + "/latest-layout.json",
                    JSON.stringify(
                      { theme, width, height, ...metrics },
                      null,
                      2,
                    ),
                  );
                  assertApiDesignLayout(metrics);
                  await assertApiDesignAttachmentFocus(design, 3, 2);
                  await design
                    .locator(".design-preview h2")
                    .scrollIntoViewIfNeeded();
                  layouts.push({
                    theme,
                    width,
                    height,
                    ...metrics,
                    finalInputsAccessible: true,
                  });
                  assert.equal(
                    await design
                      .getByLabel("Example file 1 name", { exact: true })
                      .isVisible(),
                    true,
                  );
                  await page.screenshot({
                    path:
                      output +
                      "/" +
                      theme +
                      "-assets-" +
                      width +
                      "-" +
                      height +
                      ".png",
                  });
                }
              }
            }
            await Bun.write(
              output + "/layout-acceptance.json",
              JSON.stringify({ passed: true, layouts }, null, 2),
            );
            await page.setViewportSize({ width: 1440, height: 960 });
          },
          afterCheck: async ({ design }) => {
            await design
              .getByLabel("API operations", { exact: true })
              .selectOption("1");
            await design
              .getByRole("heading", { name: "POST /json", exact: true })
              .waitFor();
            await design
              .locator(".operation-docs")
              .getByText("responses", { exact: true })
              .click();
            const responseDetails = design
              .locator(".operation-docs details")
              .filter({
                has: page.locator("summary").filter({ hasText: /^responses$/ }),
              });
            const preview = JSON.parse(
              await responseDetails.locator("pre").innerText(),
            );
            assert.deepEqual(
              preview[200].links.owned.requestBody,
              literalPayload,
            );
            assert.deepEqual(preview[200]["x-literal"], literalPayload);
            await Bun.write(
              output + "/worker-literal.json",
              JSON.stringify(
                {
                  passed: true,
                  link: preview[200].links.owned.requestBody,
                  responseExtension: preview[200]["x-literal"],
                },
                null,
                2,
              ),
            );
          },
        },
      );
      const data = await invoke("load_workspace");
      const spec = data.resources.find(
        (/** @type {any} */ r) => r._id === specId,
      );
      assert.equal(
        spec.contents,
        JSON.stringify(document, null, 2),
        "Worker analysis must preserve authored source text",
      );
      assert.equal(spec.files.length, 2);
      assert.deepEqual(
        JSON.parse(
          spec.files.find((/** @type {any} */ f) => f.name === "objects.json")
            .contents,
        ),
        referenceDocument,
      );
      assert.deepEqual(
        JSON.parse(
          spec.files.find((/** @type {any} */ f) => f.name === "examples.json")
            .contents,
        ),
        { value: { externalValue: base + "/example.json" } },
      );
      assert.equal(
        spec.exampleFiles.find(
          (/** @type {any} */ f) => f.name === base + "/example.json",
        ).base64,
        json.toString("base64"),
      );
      const requests = data.resources.filter(
        (/** @type {any} */ r) =>
          r._type === "request" && r.sourceSpecId === specId,
      );
      const cases = /** @type {[string,Buffer][]} */ ([
        ["/binary", binary],
        ["/json", json],
        ["/query", Buffer.alloc(0)],
        ["/literal", Buffer.from(JSON.stringify(literalReference, null, 2))],
      ]);
      if (schemaResources)
        cases.push(
          [
            "/schema",
            Buffer.from(
              JSON.stringify(
                {
                  owned: "resolved",
                  child: "nested",
                  escaped: "escaped",
                  named: "named property",
                  $ref: "named property",
                },
                null,
                2,
              ),
            ),
          ],
          [
            "/schema-attached",
            Buffer.from(JSON.stringify({ external: "attached" }, null, 2)),
          ],
        );
      if (schemaResources) {
        const reader = (/** @type {string} */ owned) => ({
          owned,
          static: "static",
          pointer: "pointer",
          root: "base",
        });
        const expected = [
          reader("A"),
          reader("B"),
          reader("base"),
          reader("outer"),
          { a: reader("A"), b: reader("B"), plain: reader("base") },
          { $dynamicRef: "missing.json#literal", $ref: "literal" },
        ];
        for (const [index, value] of expected.entries())
          cases.push([
            "/case-" + index,
            Buffer.from(JSON.stringify(value, null, 2)),
          ]);
      }
      for (const [path, bytes] of cases) {
        const request = requests.find(
          (/** @type {any} */ r) => new URL(r.url).pathname === path,
        );
        assert.ok(request);
        assert.deepEqual(request._openapiIssues || [], []);
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", {
            name: request.method + " " + request.name,
            exact: true,
          })
          .click();
        const count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => received.length === count + 1,
          "Owned generated request received",
          60000,
        );
        const actual = received.at(-1);
        assert.ok(actual);
        assert.equal(
          actual.target,
          path === "/query" ? "/query?owned=hello%20world" : path,
        );
        assert.equal(actual.base64, bytes.toString("base64"));
        assert.equal(
          actual.sha256,
          createHash("sha256").update(bytes).digest("hex"),
        );
        await poll(
          async () =>
            !(await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()),
          "External example send settled",
          60000,
        );
      }
      await page.reload();
      assert.deepEqual(
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ r) => r._id === specId,
        ).exampleFiles,
        spec.exampleFiles,
      );
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            version,
            specId,
            received,
            exampleFiles: spec.exampleFiles,
            referenceFiles: spec.files,
            sourceUnchanged: true,
            literalReference,
            literalPayload,
            sourceSpec: spec,
            sourceContents: JSON.stringify(document, null, 2),
            requests,
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  releaseSlow?.(new Response("Fixture closed"));
  fixture.stop(true);
}
