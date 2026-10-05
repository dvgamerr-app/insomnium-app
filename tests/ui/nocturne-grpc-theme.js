import { exerciseSplit } from "./helpers/split-pane.js";
import assert from "node:assert/strict";
import { createServer } from "node:http2";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-nocturne-controls-probe/build-state.json";
let fail = false;
const server = createServer();
server.on(
  "stream",
  (/** @type {import('node:http2').ServerHttp2Stream} */ stream) => {
    stream.on("error", () => {});
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
      stream.end(fail ? undefined : Buffer.concat([frame, payload]));
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
          'syntax = "proto3"; package theme; message Input { string name = 1; } service Sample { rpc Echo (Input) returns (Input); }',
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
        await page.screenshot({ path: `${output}/${theme}-grpc-error.png` });
      }
      assert.deepEqual(errors, []);
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            themes: ["dark", "light"],
            widths: [1440, 900, 760],
            states: ["response", "sent", "metadata", "trailers", "error"],
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
