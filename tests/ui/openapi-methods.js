import assert from "node:assert/strict";
import { createServer } from "node:net";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../src/lib/git-resources.js";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  openApiMethodCases,
  openApiMethodDocument,
} from "./helpers/openapi-method-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.2.1";
assert.ok(["3.2.0", "3.2.1"].includes(version));
const received =
  /** @type {{method:string,target:string,body:string,type:string|null}[]} */ ([]);
// Raw TCP preserves method capitalization, including lowercase get and token punctuation.
const server = createServer((socket) => {
  let buffer = Buffer.alloc(0),
    handled = false;
  socket.on("data", (chunk) => {
    if (handled) return;
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    const end = buffer.indexOf("\r\n\r\n");
    if (end < 0) return;
    const head = buffer.subarray(0, end).toString("latin1");
    const length = Number(
      head.match(/^content-length:\s*(\d+)\s*$/im)?.[1] || 0,
    );
    if (buffer.length < end + 4 + length) return;
    handled = true;
    const [method, target] = head.split("\r\n")[0].split(" ");
    received.push({
      method,
      target,
      body: buffer.subarray(end + 4, end + 4 + length).toString("utf8"),
      type: head.match(/^content-type:\s*([^\r\n]+)$/im)?.[1] || null,
    });
    socket.end(
      "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK",
    );
  });
});
await new Promise((resolve) =>
  server.listen(0, "127.0.0.1", () => resolve(null)),
);
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
try {
  await withNativeApp("openapi-methods", async ({ page, invoke, output }) => {
    const document = openApiMethodDocument(base, version, true);
    const sourceContents = JSON.stringify(document, null, 2);
    const selectedChoices = /** @type {Record<string,any>} */ ({});
    await Bun.write(
      output + "/fixture.json",
      JSON.stringify({ version, base, port: address.port }, null, 2),
    );
    const sourceSpecId = await generateOwnedOpenApi(
      { page, invoke, output },
      document,
      openApiMethodCases.length,
      "Owned OpenAPI methods",
      {
        afterCheck: async ({ design }) => {
          const operations = design.getByLabel("API operations", {
            exact: true,
          });
          const labels = (
            await operations.locator("option").allTextContents()
          ).map((label) => label.replace(/\s+/g, " ").trim());
          for (const entry of openApiMethodCases) {
            const index = labels.indexOf(
              entry.method + " /method/{id} · " + entry.id,
            );
            assert.ok(index >= 0);
            await operations.selectOption(String(index));
            const additional = entry.id.startsWith("custom-");
            const name = entry.id === "custom-lower-get" ? "first" : "second";
            for (const [location, field, label] of [
              ["path", "id", "Path id example"],
              ["query", "scope", "Query scope example"],
            ]) {
              await design
                .getByLabel(label, { exact: true })
                .selectOption(JSON.stringify(["parameter", name]));
              selectedChoices[
                JSON.stringify([
                  "/method/{id}",
                  entry.key,
                  additional,
                  "parameter",
                  location,
                  field,
                ])
              ] = { level: "parameter", name };
            }
            if (entry.body) {
              await design
                .getByLabel("Body example", { exact: true })
                .selectOption(JSON.stringify("second"));
              selectedChoices[
                JSON.stringify(["/method/{id}", entry.key, additional, "body"])
              ] = { mediaType: "application/json", name: "second" };
            }
          }
        },
      },
    );
    const initialData = await invoke("load_workspace");
    const sourceSpec = initialData.resources.find(
      (/** @type {any} */ r) => r._id === sourceSpecId,
    );
    assert.equal(sourceSpec.contents, sourceContents);
    assert.equal(Object.keys(selectedChoices).length, 17);
    assert.deepEqual(sourceSpec.exampleSelections, selectedChoices);
    const specFile = encodeGitResource(sourceSpec);
    const specGit = decodeGitResource(specFile.path, specFile.content);
    assert.deepEqual(specGit, { ...sourceSpec, type: "ApiSpec" });
    const generatedRequests = initialData.resources.filter(
      (/** @type {any} */ r) =>
        r._type === "request" && r.sourceSpecId === sourceSpecId,
    );
    const cases = [];
    await page.getByRole("button", { name: "API Design", exact: true }).click();
    const design = page.getByRole("region", {
      name: "API Design",
      exact: true,
    });
    const options = design
      .getByRole("listbox", { name: "API operations", exact: true })
      .getByRole("option");
    // Collections unmounts API Design; validate the owned persisted source again.
    await design
      .getByRole("button", { name: "Validate & preview", exact: true })
      .click();
    await options.first().waitFor({ timeout: 60000 });
    assert.equal(await options.count(), 6);
    const rawLabels = await options.allTextContents();
    const labels = rawLabels.map((label) => label.replace(/\s+/g, " ").trim());
    await Bun.write(
      output + "/preview-labels.json",
      JSON.stringify({ rawLabels, labels }, null, 2),
    );
    for (const entry of openApiMethodCases)
      assert.ok(
        labels.includes(entry.method + " /method/{id} · " + entry.id),
        "Preview preserves exact method " + entry.id,
      );
    const customIndex = labels.findIndex((label) =>
      label.includes("custom-case"),
    );
    assert.ok(customIndex >= 0);
    await design
      .getByRole("listbox", { name: "API operations", exact: true })
      .selectOption(String(customIndex));
    await design
      .getByRole("heading", { name: "custom-METHOD /method/{id}", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 760, height: 960 });
    await page.screenshot({ path: output + "/methods-preview-760.png" });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page
      .getByRole("button", { name: "Collections", exact: true })
      .click();
    for (const entry of openApiMethodCases) {
      const data = await invoke("load_workspace");
      const requests = data.resources.filter(
        (/** @type {any} */ r) =>
          r._type === "request" &&
          r.sourceSpecId === sourceSpecId &&
          r.name === entry.id,
      );
      assert.equal(requests.length, 1);
      const request = requests[0];
      assert.equal(request.method, entry.method);
      assert.deepEqual(request._openapiIssues, []);
      assert.equal(request.sourceOperation.method, entry.key);
      assert.equal(
        request.sourceOperation.additional === true,
        entry.id.startsWith("custom-"),
      );
      const button = page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button")
        .filter({ has: page.getByText(entry.id, { exact: true }) });
      assert.equal(await button.count(), 1);
      if (data.activeRequestId !== request._id)
        await button.click({ timeout: 60000 });
      await poll(
        async () =>
          (await invoke("load_workspace")).activeRequestId === request._id &&
          /(?:^|\s)active(?:\s|$)/.test(
            (await button.getAttribute("class")) || "",
          ),
        "Owned exact method selection",
        60000,
      );
      assert.equal(
        await page.getByLabel("HTTP method", { exact: true }).inputValue(),
        entry.method,
      );
      const before = await invoke("load_workspace"),
        count = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () =>
          (await invoke("load_workspace")).history.some(
            (/** @type {any} */ row) =>
              row.requestId === request._id &&
              !before.history.some(
                (/** @type {any} */ old) => old._id === row._id,
              ),
          ),
        "Native method Send persisted",
        60000,
      );
      const expected = {
        method: entry.method,
        target:
          entry.id === "custom-lower-get"
            ? "/method/first?scope=first"
            : "/method/row%20%2B?scope=" + entry.query,
        body: entry.body,
        type: entry.body ? "application/json" : null,
      };
      assert.deepEqual(received.slice(count), [expected]);
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
      await page.reload();
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
      assert.equal(received.length, count + 1, "Reload cannot resend");
      cases.push({
        id: entry.id,
        sourceOperation: request.sourceOperation,
        sourceExampleChoices: request.sourceExampleChoices,
        ...received[count],
        resourcesPreserved: true,
        reloadWithoutResend: true,
      });
      await Bun.write(
        output + "/progress.json",
        JSON.stringify(
          { verifiedCases: cases.length, lastCase: entry.id, base },
          null,
          2,
        ),
      );
    }
    assert.equal(cases.length, 6);
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify(
        {
          passed: true,
          version,
          sourceContents,
          sourceSpec,
          specGit,
          selectedChoices,
          generatedRequests,
          count: cases.length,
          cases,
          previewLabels: labels,
          base,
          limits:
            "Actual owned Windows native worker generation, exact method dropdown and raw TCP method/target/JSON body, inherited/overridden parameters and reload persistence. No proxy/provider/auth-signature/HTTP2 or full OpenAPI parity claim.",
        },
        null,
        2,
      ),
    );
  });
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve(null))),
  );
}
