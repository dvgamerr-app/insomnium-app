import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  namedExampleDocument,
  namedBodyText,
} from "./helpers/openapi-named-examples.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../src/lib/git-resources.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";

const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.2.1";
assert.ok(["3.0.3", "3.1.0", "3.2.0", "3.2.1"].includes(version));
/** @type {Record<string,any>[]} */
const received = [];
const fixture = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url),
      bytes = new Uint8Array(await request.arrayBuffer());
    received.push({
      method: request.method,
      target: url.pathname + url.search,
      base64: Buffer.from(bytes).toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      headers: Object.fromEntries(request.headers),
    });
    return new Response("OK");
  },
});
const base = "http://127.0.0.1:" + fixture.port;
const modern = version.startsWith("3.2.");
const serializedText = '{ "n":9007199254740993, "e":1e+02 }';
const document = /** @type {Record<string,any>} */ (
  namedExampleDocument(version, base)
);
if (modern) {
  document.paths["/serialized"] = {
    post: {
      requestBody: {
        content: {
          "application/json": {
            examples: {
              first: { serializedValue: '"first"' },
              second: { serializedValue: serializedText },
            },
          },
        },
      },
      responses: { 200: { description: "OK" } },
    },
  };
  document.paths["/whole"] = {
    get: {
      parameters: [
        {
          name: "label",
          in: "querystring",
          content: {
            "text/plain": {
              schema: { type: "string" },
              examples: {
                first: { serializedValue: "first=1" },
                second: { serializedValue: "chosen=a%20b&chosen=%2f" },
              },
            },
          },
        },
      ],
      responses: { 200: { description: "OK" } },
    },
  };
  document.paths["/root-level"] = {
    get: {
      parameters: [
        {
          name: "j",
          in: "query",
          examples: {
            first: { dataValue: false },
            second: { dataValue: false },
          },
          content: {
            "application/json": {
              schema: { type: "boolean" },
              examples: {
                first: { serializedValue: "true" },
                second: { serializedValue: "true" },
              },
            },
          },
        },
      ],
      responses: { 200: { description: "OK" } },
    },
  };
}
try {
  await withNativeApp(
    "openapi-named-example",
    async ({ page, invoke, output }) => {
      page.setDefaultTimeout(60000);
      await Bun.write(
        output + "/fixture.json",
        JSON.stringify({ version, base, port: fixture.port }),
      );
      const profiles = /** @type {Record<string,any>[]} */ ([]);
      const specId = await generateOwnedOpenApi(
        { page, invoke, output },
        document,
        modern ? 7 : 4,
        "Named examples",
        {
          beforeCheck: async ({ design, specId }) => {
            await design
              .getByText("Attach example files", { exact: true })
              .locator("input[type=file]")
              .setInputFiles({
                name: "body.json",
                mimeType: "application/json",
                buffer: Buffer.from(namedBodyText),
              });
            await poll(
              async () =>
                (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ r) => r._id === specId,
                )?.exampleFiles?.[0]?.base64 ===
                Buffer.from(namedBodyText).toString("base64"),
              "Named example bytes persisted",
            );
          },
          afterCheck: async ({ design, specId }) => {
            const operations = design.getByLabel("API operations", {
              exact: true,
            });
            await operations.selectOption("0");
            for (const label of [
              "Path slug example",
              "Query q example",
              "Header X-Mode example",
              "Cookie c example",
            ])
              await design
                .getByLabel(label, { exact: true })
                .selectOption(JSON.stringify(["parameter", "second"]));
            await operations.selectOption("3");
            if (modern)
              await design
                .getByLabel("Query j example", { exact: true })
                .selectOption(JSON.stringify(["parameter", "second"]));
            await design
              .getByLabel("Query j example", { exact: true })
              .selectOption(JSON.stringify(["media", "second"]));
            if (modern) {
              await operations.selectOption("6");
              await design
                .getByLabel("Query j example", { exact: true })
                .selectOption(JSON.stringify(["parameter", "second"]));
              await operations.selectOption("4");
              await design
                .getByLabel("Body example", { exact: true })
                .selectOption(JSON.stringify("second"));
              await operations.selectOption("5");
              await design
                .getByLabel("Querystring label example", { exact: true })
                .selectOption(JSON.stringify(["media", "second"]));
            }
            await operations.selectOption("2");
            const media = design.getByLabel("Request body media type", {
              exact: true,
            });
            const body = design.getByLabel("Body example", { exact: true });
            await media.selectOption("text/plain");
            await body.selectOption(JSON.stringify(""));
            await poll(
              async () =>
                (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ r) => r._id === specId,
                )?.exampleSelections?.[
                  JSON.stringify(["/body", "post", false, "body"])
                ]?.name === "",
              "Empty-named choice persisted distinctly from default",
            );
            await media.selectOption("application/json");
            await body.selectOption(JSON.stringify("second"));
            for (const theme of ["dark", "light"]) {
              await page.evaluate(
                (theme) => (document.documentElement.dataset.theme = theme),
                theme,
              );
              for (const width of [1440, 900, 760]) {
                await page.setViewportSize({ width, height: 960 });
                const geometry = await design
                  .locator(".operation-docs select")
                  .evaluateAll((elements) =>
                    elements.map((el) => {
                      const r = el.getBoundingClientRect();
                      return { left: r.left, right: r.right, width: r.width };
                    }),
                  );
                assert.equal(geometry.length, 2);
                for (const r of geometry)
                  assert.ok(
                    r.left >= 0 && r.right <= width && r.width >= 40,
                    JSON.stringify(r),
                  );
                await body.scrollIntoViewIfNeeded();
                await page.screenshot({
                  path: `${output}/${theme}-${width}.png`,
                });
                profiles.push({ theme, width, geometry, passed: true });
              }
            }
            await page.setViewportSize({ width: 1440, height: 960 });
          },
        },
      );
      const data = await invoke("load_workspace");
      const spec = data.resources.find(
        (/** @type {any} */ r) => r._id === specId,
      );
      assert.equal(spec.contents, JSON.stringify(document, null, 2));
      assert.equal(Object.keys(spec.exampleSelections).length, modern ? 9 : 6);
      const specFile = encodeGitResource(spec),
        specRoundtrip = decodeGitResource(specFile.path, specFile.content);
      assert.deepEqual(
        specRoundtrip?.exampleSelections,
        spec.exampleSelections,
      );
      const requests = data.resources.filter(
        (/** @type {any} */ r) =>
          r._type === "request" && r.sourceSpecId === specId,
      );
      const cases = [
        {
          path: "/choice/{slug}",
          method: "GET",
          target: "/choice/picked?q=selected",
          text: "",
        },
        {
          path: "/isolate",
          method: "GET",
          target: "/isolate?q=first",
          text: "",
        },
        { path: "/body", method: "POST", target: "/body", text: namedBodyText },
        {
          path: "/content",
          method: "GET",
          target: "/content?j=true",
          text: "",
        },
        ...(modern
          ? [
              {
                path: "/serialized",
                method: "POST",
                target: "/serialized",
                text: serializedText,
              },
              {
                path: "/whole",
                method: "GET",
                target: "/whole?chosen=a%20b&chosen=%2f",
                text: "",
              },
              {
                path: "/root-level",
                method: "GET",
                target: "/root-level?j=false",
                text: "",
              },
            ]
          : []),
      ];
      for (const expected of cases) {
        const request = requests.find(
          (/** @type {any} */ r) => r.sourceOperation.path === expected.path,
        );
        assert.ok(request);
        assert.deepEqual(request._openapiIssues || [], []);
        const encoded = encodeGitResource(request),
          restored = decodeGitResource(encoded.path, encoded.content);
        assert.deepEqual(
          restored?.sourceExampleChoices,
          request.sourceExampleChoices,
        );
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
          "Selected example sent through native transport",
          60000,
        );
        const actual = received.at(-1);
        assert.ok(actual);
        assert.equal(actual.method, expected.method);
        assert.equal(actual.target, expected.target);
        const bytes = Buffer.from(expected.text);
        assert.equal(actual.base64, bytes.toString("base64"));
        assert.equal(
          actual.sha256,
          createHash("sha256").update(bytes).digest("hex"),
        );
        if (expected.path === "/choice/{slug}") {
          assert.equal(actual.headers["x-mode"], "picked header");
          assert.equal(actual.headers.cookie, "c=kept");
        }
        await poll(
          async () =>
            !(await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()),
          "Named example send settled",
          60000,
        );
      }
      await page.reload();
      await page.locator(".app-shell").waitFor();
      assert.deepEqual(
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ r) => r._id === specId,
        ),
        spec,
      );
      await page
        .getByRole("button", { name: "API Design", exact: true })
        .click();
      const design = page.getByRole("region", {
        name: "API Design",
        exact: true,
      });
      await design
        .getByLabel("API document", { exact: true })
        .selectOption(specId);
      await design
        .getByRole("button", { name: "Validate & preview", exact: true })
        .click();
      await design
        .getByLabel("API operations", { exact: true })
        .selectOption("2");
      assert.equal(
        await design.getByLabel("Body example", { exact: true }).inputValue(),
        JSON.stringify("second"),
      );
      assert.equal(
        await design
          .getByLabel("Request body media type", { exact: true })
          .inputValue(),
        "application/json",
      );
      const editedDocument = structuredClone(document);
      delete editedDocument.paths["/body"].post.requestBody.content[
        "application/json"
      ].examples.second;
      const editedContents = JSON.stringify(editedDocument, null, 2);
      await design
        .locator(".CodeMirror")
        .first()
        .evaluate(
          (el, value) => /** @type {any} */ (el).CodeMirror.setValue(value),
          editedContents,
        );
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === specId,
          )?.contents === editedContents,
        "Author source edit persisted",
      );
      assert.equal(
        await design
          .getByRole("button", { name: /^Generate\s+requests$/ })
          .isDisabled(),
        true,
      );
      await design
        .getByRole("button", { name: "Validate & preview", exact: true })
        .click();
      const generate = design.getByRole("button", {
        name: `Generate ${cases.length} requests`,
        exact: true,
      });
      await generate.waitFor();
      await design
        .getByLabel("API operations", { exact: true })
        .selectOption("2");
      const bodyChoice = design.getByLabel("Body example", { exact: true });
      assert.equal(await bodyChoice.getAttribute("aria-invalid"), "true");
      await design
        .getByText(
          "Saved choice is unavailable. Choose another example or reset choices.",
          { exact: true },
        )
        .waitFor();
      const beforeRefusal = (await invoke("load_workspace")).resources;
      await generate.click();
      await design
        .getByText(
          "Error: Body example: Saved choice is unavailable. Choose another example or reset choices.",
          { exact: true },
        )
        .waitFor();
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        beforeRefusal,
        "Refused worker generation must not write resources",
      );
      await bodyChoice.selectOption(JSON.stringify("first"));
      assert.notEqual(await bodyChoice.getAttribute("aria-invalid"), "true");
      await generate.click();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.filter(
            (/** @type {any} */ r) =>
              r._type === "request" && r.sourceSpecId === specId,
          ).length ===
          cases.length * 2,
        "Corrected choice generated one additional set",
        60000,
      );
      const regeneratedData = await invoke("load_workspace");
      const originalIds = new Set(
        requests.map((/** @type {any} */ r) => r._id),
      );
      assert.deepEqual(
        regeneratedData.resources.filter((/** @type {any} */ r) =>
          originalIds.has(r._id),
        ),
        beforeRefusal.filter((/** @type {any} */ r) => originalIds.has(r._id)),
      );
      const regenerated = regeneratedData.resources.filter(
        (/** @type {any} */ r) =>
          r._type === "request" &&
          r.sourceSpecId === specId &&
          !originalIds.has(r._id),
      );
      const regeneratedBody = regenerated.find(
        (/** @type {any} */ r) => r.sourceOperation.path === "/body",
      );
      assert.ok(regeneratedBody);
      assert.equal(regeneratedBody.body.text, '"first"');
      const editedSpec = regeneratedData.resources.find(
        (/** @type {any} */ r) => r._id === specId,
      );
      assert.equal(editedSpec.contents, editedContents);
      const editedFile = encodeGitResource(editedSpec),
        editedGit = decodeGitResource(editedFile.path, editedFile.content);
      assert.deepEqual(editedGit, { ...editedSpec, type: "ApiSpec" });
      await page
        .getByRole("button", { name: "Collections", exact: true })
        .click();
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name: regeneratedBody.method + " " + regeneratedBody.name,
          exact: true,
        })
        .last()
        .click();
      await poll(
        async () =>
          (await invoke("load_workspace")).activeRequestId ===
          regeneratedBody._id,
        "Actual corrected request selected",
      );
      const beforeSend = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => received.length === beforeSend + 1,
        "Corrected first example received",
        60000,
      );
      const correctedReceived = received.at(-1);
      assert.ok(correctedReceived);
      assert.equal(correctedReceived.target, "/body");
      assert.equal(correctedReceived.method, "POST");
      assert.equal(
        correctedReceived.base64,
        Buffer.from('"first"').toString("base64"),
      );
      assert.equal(
        correctedReceived.sha256,
        createHash("sha256").update('"first"').digest("hex"),
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Corrected send settled",
        60000,
      );
      await page
        .getByRole("button", { name: "API Design", exact: true })
        .click();
      await design
        .getByLabel("API document", { exact: true })
        .selectOption(specId);
      await design
        .getByRole("button", { name: "Validate & preview", exact: true })
        .click();
      await design
        .getByLabel("API operations", { exact: true })
        .selectOption("2");
      assert.equal(
        await design.getByLabel("Body example", { exact: true }).inputValue(),
        JSON.stringify("first"),
      );
      await design
        .getByRole("button", { name: "Reset example choices", exact: true })
        .click();
      await poll(
        async () =>
          Object.keys(
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ r) => r._id === specId,
            )?.exampleSelections || {},
          ).length === 0,
        "Reset choices persisted",
      );
      assert.equal(
        await design.getByLabel("Body example", { exact: true }).inputValue(),
        "",
      );
      assert.equal(
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ r) => r._id === specId,
        ).contents,
        editedContents,
      );
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            version,
            specId,
            received,
            expected: cases,
            profiles,
            sourceUnchanged: true,
            persistedChoices: spec.exampleSelections,
            exampleFiles: spec.exampleFiles,
            specGitRoundtrip: specRoundtrip,
            requests,
            resetPersisted: true,
            staleRecovery: {
              refusedWithoutWrites: true,
              originalIds: [...originalIds],
              originalResourcesUnchanged: true,
              correctedReceived,
              regenerated,
              editedSpec,
              editedGit,
              editedContents,
              originalContents: spec.contents,
            },
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  fixture.stop(true);
}
