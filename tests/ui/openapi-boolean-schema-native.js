import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  booleanSchemaDocument,
  booleanSchemaCases,
} from "./helpers/openapi-boolean-schema-contract.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../src/lib/git-resources.js";
import { prepareRenderedRequest } from "../../src/lib/transport.js";

const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.2.1";
assert.ok(["3.1.0", "3.2.0", "3.2.1"].includes(version));
const received = /** @type {Record<string,any>[]} */ ([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const bytes = new Uint8Array(await request.arrayBuffer());
    received.push({
      target: new URL(request.url).pathname + new URL(request.url).search,
      method: request.method,
      base64: Buffer.from(bytes).toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp(
    "openapi-boolean-schema",
    async ({ page, invoke, output }) => {
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
              format + " " + (raw.valid ? "valid" : "invalid") + " JSON bytes",
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
        spec = data.resources.find((/** @type {any} */ r) => r._id === specId);
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
      for (const entry of cases) {
        const request = requests.find(
          (/** @type {any} */ r) => new URL(r.url).pathname === entry.target,
        );
        assert.ok(request);
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
          await page.getByRole("button", { name: "Send", exact: true }).click();
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
            await page.screenshot({ path: output + "/durable-review-760.png" });
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
          await page.getByRole("button", { name: "Send", exact: true }).click();
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
} finally {
  server.stop(true);
}
