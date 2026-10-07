import { exerciseSplit } from "./helpers/split-pane.js";
import assert from "node:assert/strict";
import { createServer } from "node:http2";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-nocturne-controls-probe/build-state.json";
let fail = false;
let heldCalls = 0;
let cancelledCalls = 0;
const gate = { release: /** @type {null|(()=>void)} */ (null) };
const server = createServer();
server.on(
  "stream",
  (/** @type {import('node:http2').ServerHttp2Stream} */ stream, headers) => {
    stream.on("error", () => {});
    if (headers[":path"] === "/theme.Sample/Hold") {
      heldCalls++;
      stream.once("close", () => cancelledCalls++);
      return;
    }
    let received = Buffer.alloc(0);
    let responded = false;
    stream.on("data", (chunk) => {
      received = Buffer.concat([
        received,
        typeof chunk === "string" ? Buffer.from(chunk) : chunk,
      ]);
      if (
        responded ||
        received.length < 5 ||
        received.length < 5 + received.readUInt32BE(1)
      )
        return;
      responded = true;
      const respond = () => {
        stream.respond(
          {
            ":status": 200,
            "content-type": "application/grpc",
            "theme-metadata": "sample",
          },
          { waitForTrailers: true },
        );
        stream.on("wantTrailers", () =>
          stream.sendTrailers({
            "grpc-status": fail ? "13" : "0",
            "theme-trailer": "complete",
            ...(fail ? { "grpc-message": "Theme fixture error" } : {}),
          }),
        );
        const text = Buffer.from("Theme response");
        const payload = Buffer.concat([Buffer.from([10, text.length]), text]);
        const frame = Buffer.alloc(5);
        frame.writeUInt32BE(payload.length, 1);
        const message = Buffer.concat([frame, payload]);
        stream.end(
          fail
            ? undefined
            : headers[":path"] === "/theme.Sample/Watch"
              ? Buffer.concat([message, message])
              : message,
        );
      };
      if (headers[":path"] === "/theme.Sample/Gate") gate.release = respond;
      else respond();
    });
  },
);
await new Promise((resolve) =>
  server.listen(0, "127.0.0.1", () => resolve(null)),
);
const address = server.address();
assert.ok(address && typeof address === "object");
try {
  await withNativeApp(
    "nocturne-grpc-theme",
    async ({ page, invoke, output }) => {
      const errors = /** @type {string[]} */ ([]);
      page.on("pageerror", (error) => errors.push(error.message));
      await gitCollection({ page, invoke });
      await page.locator(".new-request-menu summary").click();
      await page
        .getByRole("button", { name: "gRPC Request", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "gRPC server URL", exact: true })
        .fill(`grpc://127.0.0.1:${address.port}`);
      await page.getByRole("tab", { name: "Proto Files", exact: true }).click();
      await page.getByLabel("Import files", { exact: true }).setInputFiles({
        name: "theme-response.proto",
        mimeType: "text/plain",
        buffer: Buffer.from(
          'syntax = "proto3"; package theme; message Input { string name = 1; } service Sample { rpc Echo (Input) returns (Input); rpc Watch (Input) returns (stream Input); rpc Collect (stream Input) returns (Input); rpc Chat (stream Input) returns (stream Input); rpc Hold (Input) returns (stream Input); rpc Gate (stream Input) returns (stream Input); }',
        ),
      });
      await page
        .getByRole("button", { name: "Import 1 files", exact: true })
        .click();
      await page
        .getByRole("button", { name: "theme-response.proto", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Load methods", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "gRPC method", exact: true })
        .selectOption({ label: "/Sample/Echo · Unary" });
      await page.getByRole("tab", { name: "Body", exact: true }).click();
      for (const theme of ["dark", "light"]) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await page
            .getByRole("button", { name: "Toggle theme", exact: true })
            .click();
        fail = false;
        // Existing schema cache includes settings; reload after switching theme.
        await page
          .getByRole("button", { name: "Load methods", exact: true })
          .click();
        await page
          .getByRole("combobox", { name: "gRPC method", exact: true })
          .selectOption({ label: "/Sample/Echo · Unary" });
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .locator(".grpc-response .status-badge")
          .filter({ hasText: "0 OK" })
          .waitFor();
        await page
          .getByRole("tablist", { name: "gRPC response tabs", exact: true })
          .getByRole("tab", { name: "Response", exact: true })
          .click();
        await page
          .locator(".grpc-message")
          .filter({ hasText: "Theme response" })
          .waitFor();
        // Wait for native invoke completion, not just the terminal Channel event.
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
        assert.equal(await page.locator(".inline-error").count(), 0);
        assert.equal(
          await page.locator(".grpc-response .status-badge").innerText(),
          "0 OK",
        );
        const message = page.locator(".grpc-message").first();
        assert.equal(
          await message.evaluate((el) => getComputedStyle(el).fontSize),
          "12px",
        );
        await page.evaluate(() =>
          document.documentElement.style.setProperty("--font-size-12", "14px"),
        );
        try {
          assert.equal(
            await message.evaluate((el) => getComputedStyle(el).fontSize),
            "14px",
            "gRPC message typography must follow the shared font scale",
          );
        } finally {
          await page.evaluate(() =>
            document.documentElement.style.removeProperty("--font-size-12"),
          );
        }
        await page.setViewportSize({ width: 1440, height: 960 });
        await exerciseSplit(page, "gRPC request and response size");
        for (const width of [1440, 900, 760]) {
          await page.setViewportSize({ width, height: 960 });
          assert.equal(
            await page
              .locator(".workspace-main")
              .evaluate((el) => el.scrollWidth <= el.clientWidth),
            true,
          );
          await page.screenshot({
            path: `${output}/${theme}-grpc-response-${width}.png`,
          });
        }
        for (const tab of ["Sent", "Metadata", "Trailers"]) {
          await page
            .getByRole("tablist", { name: "gRPC response tabs", exact: true })
            .getByRole("tab", { name: tab, exact: true })
            .click();
          await page.screenshot({
            path: `${output}/${theme}-grpc-${tab.toLowerCase()}.png`,
          });
        }
        fail = true;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page.locator(".grpc-response .status-badge.failure").waitFor();
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
        assert.equal(await page.locator(".inline-error").count(), 0);
        assert.ok(
          (
            await page.locator(".grpc-response .status-badge").innerText()
          ).startsWith("13 "),
        );
        await page.screenshot({ path: `${output}/${theme}-grpc-error.png` });
        fail = false;
        for (const [name, mode, clientStreaming] of [
          ["Watch", "Server streaming", false],
          ["Collect", "Client streaming", true],
          ["Chat", "Bidirectional", true],
        ]) {
          await page
            .getByRole("combobox", { name: "gRPC method", exact: true })
            .selectOption({ label: `/Sample/${name} · ${mode}` });
          await page
            .getByRole("tablist", { name: "gRPC request editor", exact: true })
            .getByRole("tab", { name: "Body", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: clientStreaming ? "Connect" : "Send",
              exact: true,
            })
            .click();
          if (clientStreaming) {
            await page
              .getByRole("button", { name: "Send message", exact: true })
              .waitFor({ state: "visible" });
            await page
              .getByRole("button", { name: "Send message", exact: true })
              .click();
          }
          await page
            .locator(".grpc-response .status-badge")
            .filter({ hasText: "0 OK" })
            .waitFor();
          await page
            .getByRole("button", {
              name: clientStreaming ? "Connect" : "Send",
              exact: true,
            })
            .waitFor();
          assert.equal(
            await page.locator(".inline-error").count(),
            0,
            `${mode} has no spurious cancellation`,
          );
          await page
            .getByRole("tablist", { name: "gRPC response tabs", exact: true })
            .getByRole("tab", { name: "Response", exact: true })
            .click();
          assert.equal(
            await page.locator(".grpc-message").count(),
            name === "Watch" ? 2 : 1,
          );
        }
        gate.release = null;
        await page
          .getByRole("combobox", { name: "gRPC method", exact: true })
          .selectOption({ label: "/Sample/Gate · Bidirectional" });
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Send message", exact: true })
          .click();
        await poll(
          async () => gate.release !== null,
          "first Gate message received",
        );
        await page
          .locator(".CodeMirror")
          .first()
          .evaluate((el) => {
            /** @type {any} */ (el).CodeMirror.setValue(
              "{\"name\":\"{% prompt 'Pending gRPC sender', 'Value', 'queued' %}\"}",
            );
          });
        await page
          .getByRole("button", { name: "Send message", exact: true })
          .click();
        const pending = page.getByRole("dialog", {
          name: "Pending gRPC sender",
          exact: true,
        });
        await pending.waitFor();
        const release = /** @type {null|(()=>void)} */ (gate.release);
        assert.ok(release);
        release();
        await pending.waitFor({ state: "hidden" });
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .waitFor();
        assert.equal(
          await page.locator(".grpc-response .status-badge").innerText(),
          "0 OK",
        );
        assert.equal(
          await page.locator(".inline-error").count(),
          0,
          "completed call cancels pending prompt without an error",
        );
        await page
          .locator(".CodeMirror")
          .first()
          .evaluate((el) => {
            /** @type {any} */ (el).CodeMirror.setValue("{}");
          });
        const before = heldCalls;
        const closedBefore = cancelledCalls;
        await page
          .getByRole("combobox", { name: "gRPC method", exact: true })
          .selectOption({ label: "/Sample/Hold · Server streaming" });
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(async () => heldCalls > before, "held gRPC reached server");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
        await poll(
          async () => cancelledCalls > closedBefore,
          "gRPC cancellation closes transport",
        );
        assert.ok(
          (await page.locator(".inline-error").allTextContents())
            .join(" ")
            .includes("cancelled"),
        );
      }
      assert.deepEqual(errors, []);
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            themes: ["dark", "light"],
            widths: [1440, 900, 760],
            states: [
              "response",
              "sent",
              "metadata",
              "trailers",
              "error",
              "server-streaming",
              "client-streaming",
              "bidirectional",
              "cancel",
            ],
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  server.close();
}
