import { exerciseSplit } from "./helpers/split-pane.js";
import assert from "node:assert/strict";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-nocturne-controls-probe/build-state.json";
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 60,
  fetch(request, server) {
    const path = new URL(request.url).pathname;
    if (path === "/ws" && server.upgrade(request)) return;
    if (path === "/sse")
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'id: theme-1\nevent: update\ndata: {"message":"Theme stream event"}\n\n',
              ),
            );
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        },
      );
    return new Response("Theme connection refused", { status: 503 });
  },
  websocket: {
    open(socket) {
      socket.send('{"message":"Theme stream event"}');
    },
    message(socket, message) {
      socket.send(message);
    },
  },
});
try {
  await withNativeApp(
    "nocturne-stream-theme",
    async ({ page, invoke, output }) => {
      await gitCollection({ page, invoke });
      const captures = [];
      for (const theme of ["dark", "light"]) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await page
            .getByRole("button", { name: "Toggle theme", exact: true })
            .click();
        for (const [label, protocol, scheme] of [
          ["WebSocket Request", "ws", "ws"],
          ["Event Stream (SSE)", "sse", "http"],
        ]) {
          await page.locator(".new-request-menu summary").click();
          await page.getByRole("button", { name: label, exact: true }).click();
          await page
            .getByRole("textbox", { name: "Request URL", exact: true })
            .fill(`${scheme}://127.0.0.1:${server.port}/${protocol}`);
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .click();
          await page.getByRole("tab", { name: "Events", exact: true }).click();
          await page
            .locator(".stream-event-detail")
            .getByText(/Theme stream event/)
            .waitFor();
          assert.equal(
            await page.locator(".stream-pane .status-badge").innerText(),
            "open",
          );
          await page.setViewportSize({ width: 1440, height: 960 });
          await exerciseSplit(page, "Stream events and detail size");
          for (const width of [1440, 900, 760]) {
            await page.setViewportSize({ width, height: 960 });
            assert.equal(
              await page
                .locator(".workspace-main")
                .evaluate((el) => el.scrollWidth <= el.clientWidth),
              true,
              protocol + " pane overflow",
            );
            await page.screenshot({
              path: `${output}/${theme}-${protocol}-open-${width}.png`,
            });
          }
          await page
            .getByRole("tab", { name: "Headers", exact: true })
            .last()
            .click();
          await page.screenshot({
            path: `${output}/${theme}-${protocol}-headers.png`,
          });
          await page
            .getByRole("button", { name: "Disconnect", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .waitFor();
          await page
            .getByRole("textbox", { name: "Request URL", exact: true })
            .fill(`${scheme}://127.0.0.1:${server.port}/failure`);
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .click();
          await page.locator(".stream-pane .status-badge.failure").waitFor();
          await page.screenshot({
            path: `${output}/${theme}-${protocol}-error.png`,
          });
          captures.push(`${theme} ${protocol} open/headers/disconnect/error`);
        }
      }
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify({ passed: true, captures }, null, 2),
      );
    },
  );
} finally {
  server.stop(true);
}
