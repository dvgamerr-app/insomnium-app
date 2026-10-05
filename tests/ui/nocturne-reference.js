import { mkdir } from "node:fs/promises";
import { launchUiBrowser } from "./helpers/preview-app.js";

// Read-only visual reference, isolated anonymous context; no requests are sent.
const output = "artifacts/playwright/nocturne-reference";
await mkdir(output, { recursive: true });
const browser = await launchUiBrowser();
try {
  for (const colorScheme of /** @type {const} */ (["dark", "light"])) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      colorScheme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("https://hoppscotch.io/", {
      waitUntil: "domcontentloaded",
    });
    await page.locator("header").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
      let el = document.getElementById("send");
      if (!el) return false;
      while (el) {
        if (Number(getComputedStyle(el).opacity) < 1) return false;
        el = el.parentElement;
      }
      return !document.querySelector(
        ".fade-enter-active,.fade-enter-from,.fade-enter-to",
      );
    });
    await page.screenshot({
      animations: "disabled",
      path: `${output}/${colorScheme}-1440.png`,
    });
    await Bun.write(
      `${output}/${colorScheme}.json`,
      JSON.stringify(
        await page.evaluate(() => ({
          title: document.title,
          text: document.body.innerText,
          font: getComputedStyle(document.body).fontFamily,
          background: getComputedStyle(document.body).backgroundColor,
          accent: getComputedStyle(document.documentElement).getPropertyValue(
            "--accent-color",
          ),
        })),
        null,
        2,
      ),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
