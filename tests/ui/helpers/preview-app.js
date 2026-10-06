import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";

/** @param {string} name @param {(page: import('playwright-core').Page, output: string) => Promise<void>} run */
export async function withPreview(name, run) {
  const root = resolve("build");
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname);
      const target = resolve(root, "." + (path === "/" ? "/index.html" : path));
      if (!target.startsWith(root + sep))
        return new Response("Not found", { status: 404 });
      const file = Bun.file(target);
      return new Response(
        (await file.exists()) ? file : Bun.file(resolve(root, "index.html")),
      );
    },
  });
  const output = resolve("artifacts/playwright", name);
  await mkdir(output, { recursive: true });
  const browser = await launchUiBrowser();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      reducedMotion: "reduce",
    });
    const startupErrors = /** @type {string[]} */ ([]);
    page.on("pageerror", (error) =>
      startupErrors.push(error.stack || error.message),
    );
    page.on("console", (message) => {
      if (message.type() === "error") startupErrors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${server.port}`);
    await Bun.write(
      output + "/result.json",
      JSON.stringify({ status: "running" }),
    );
    try {
      await page.waitForTimeout(300);
      if (startupErrors.length) throw new Error(startupErrors.join("\n"));
      await run(page, output);
    } catch (error) {
      await page.screenshot({ path: output + "/failure.png" }).catch(() => {});
      await Bun.write(
        output + "/result.json",
        JSON.stringify({
          status: "failed",
          error: String(error),
          startupErrors,
        }),
      );
      throw error;
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
}

export function launchUiBrowser() {
  return chromium.launch({
    executablePath:
      process.env.INSOMNIUM_EDGE_PATH ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
}
