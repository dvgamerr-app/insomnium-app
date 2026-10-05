import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

/** @typedef {import("playwright-core").Page} Page */
/** @typedef {(command:string,args?:Record<string,any>)=>Promise<any>} NativeInvoke */
/** @typedef {{page:Page,output:string,invoke:NativeInvoke,requestNativeClose:()=>Promise<any>,terminateParent:()=>Promise<{pid:number,exit:any}>}} ScenarioContext */
export const probeIdentifier = "app.insomnium.probe.checkout20260929";

/** Only launch the isolated artifact described by a successful build record.
 * No production executable, external browser session, shell, or Node worker. */
/** @param {string} scenario @param {(context:ScenarioContext)=>Promise<void>} run @param {{allowParentTermination?:boolean,allowNativeClose?:boolean}} [options] */
export async function withNativeApp(scenario, run, options = {}) {
  const buildPath =
    process.env.INSOMNIUM_UI_BUILD_STATE ||
    "artifacts/native-nocturne-controls-probe/build-state.json";
  const build = JSON.parse(await readFile(buildPath, "utf8"));
  assert.equal(build.status, "finished", "Native build must finish first");
  assert.equal(build.result?.code, 0, "Native build failed");
  assert.equal(
    build.identifier,
    probeIdentifier,
    "Refuse non-probe app identity",
  );
  const exe = resolve(build.artifact);
  assert.ok(
    exe.startsWith(resolve("artifacts") + "\\"),
    "Artifact must be inside artifacts",
  );
  assert.ok(
    (await stat(exe)).mtimeMs >= build.started,
    "Stale probe executable",
  );
  assert.ok(
    (await readFile(exe)).includes(Buffer.from(probeIdentifier)),
    "Probe identity missing",
  );
  const output = resolve("artifacts/playwright", scenario + "-" + Date.now());
  await mkdir(output, { recursive: true });
  const reservation = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response(""),
  });
  const port = reservation.port;
  reservation.stop(true);
  const fd = openSync(join(output, "app.log"), "w");
  const child = spawn(exe, [], {
    shell: false,
    windowsHide: true,
    stdio: ["ignore", fd, fd],
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=" + port,
      WEBVIEW2_USER_DATA_FOLDER: join(output, "webview-profile"),
    },
  });
  const exited = new Promise((resolve) => {
    child.once("error", (error) => resolve({ error: String(error) }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  /** @type {import("playwright-core").Browser|undefined} */ let browser;
  /** @type {Page|undefined} */ let page;
  /** @type {string|undefined} */ let error;
  let exit;
  let intentionalParentTermination = false;
  let nativeCloseRequested = false;
  const startedAt = new Date().toISOString();
  try {
    await poll(async () => {
      if (child.exitCode !== null)
        throw Error("Probe exited before WebView was ready");
      return fetch("http://127.0.0.1:" + port + "/json/version")
        .then((/** @type {any} */ r) => r.ok)
        .catch(() => false);
    }, "WebView2 debugging endpoint");
    browser = await chromium.connectOverCDP("http://127.0.0.1:" + port);
    await poll(async () => {
      page = browser
        ?.contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().includes("tauri.localhost"));
      return !!page;
    }, "Tauri page");
    assert.ok(page, "Tauri page not available");
    const activePage = page;
    page.setDefaultTimeout(15000);
    await page.locator(".app-shell").waitFor();
    await run({
      page,
      output,
      requestNativeClose: async () => {
        assert.equal(
          options.allowNativeClose,
          true,
          "Scenario must enable native close",
        );
        assert.ok(
          child.pid && child.exitCode === null && child.signalCode === null,
          "Owned probe must be running",
        );
        const { requestOwnedWindowClose } =
          await import("./native-window-close.js");
        const posted = requestOwnedWindowClose(child.pid);
        const result = await Promise.race([
          exited,
          Bun.sleep(15000).then(() => null),
        ]);
        assert.ok(
          result && !("error" in result),
          "Native close must exit without forced cleanup",
        );
        assert.equal(result.code, 0, "Native close must exit successfully");
        nativeCloseRequested = true;
        return { ...posted, exit: result };
      },
      terminateParent: async () => {
        assert.equal(
          options.allowParentTermination,
          true,
          "Scenario must explicitly enable parent termination",
        );
        assert.ok(
          child.pid && child.exitCode === null && child.signalCode === null,
          "Owned parent must be running",
        );
        assert.equal(
          child.kill(),
          true,
          "Terminate only the owned probe parent",
        );
        const result = await Promise.race([
          exited,
          Bun.sleep(5000).then(() => null),
        ]);
        assert.ok(
          result && !("error" in result),
          "Parent termination must have an exit event",
        );
        intentionalParentTermination = true;
        return { pid: child.pid, exit: result };
      },
      invoke: (command, args = {}) => invoke(activePage, command, args),
    });
  } catch (cause) {
    error = String(cause instanceof Error ? cause.stack : cause);
    if (page) {
      await page
        .screenshot({ path: join(output, "failure.png") })
        .catch(() => {});
      await writeFile(
        join(output, "failure.txt"),
        await page
          .locator("body")
          .innerText()
          .catch(() => ""),
      ).catch(() => {});
    }
  } finally {
    if (
      !intentionalParentTermination &&
      !nativeCloseRequested &&
      page &&
      !page.isClosed()
    ) {
      await page
        .evaluate(() => {
          setTimeout(
            () =>
              /** @type {any} */ (window).__TAURI_INTERNALS__.invoke(
                "plugin:window|destroy",
                {
                  label: "main",
                },
              ),
            50,
          );
        })
        .catch(() => {});
    }
    exit = await Promise.race([exited, Bun.sleep(5000).then(() => null)]);
    if (!exit) {
      child.kill();
      exit = await exited;
      error ||= "Probe required forced cleanup";
    }
    await browser?.close().catch(() => {});
    closeSync(fd);
    if (!intentionalParentTermination && exit.code !== 0)
      error ||= "Probe exit was not successful: " + JSON.stringify(exit);
    await writeFile(
      join(output, "result.json"),
      JSON.stringify(
        {
          scenario,
          status: error ? "failed" : "passed",
          error,
          startedAt,
          finishedAt: new Date().toISOString(),
          pid: child.pid,
          exit,
          buildPath,
          intentionalParentTermination,
          nativeCloseRequested,
          limits: intentionalParentTermination
            ? "Deliberate owned parent process termination; not power-loss or OS-close acceptance."
            : nativeCloseRequested
              ? "Owned Windows probe received WM_CLOSE and exited without force; not other-platform or OS-shutdown acceptance."
              : "Explicit window destroy cleanup; not OS-close lifecycle acceptance.",
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        scenario,
        status: error ? "failed" : "passed",
        output,
        error,
      }),
    );
  }
  if (error) throw Error(error);
}

/** @param {()=>Promise<boolean>} predicate @param {string} label @param {number} [timeout] */
export async function poll(predicate, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Bun.sleep(100);
  }
  throw Error("Timed out: " + label);
}

/** @param {Page} page @param {string} command @param {Record<string,any>} [args] */
export function invoke(page, command, args = {}) {
  return page.evaluate(
    ({ command, args }) =>
      /** @type {any} */ (window).__TAURI_INTERNALS__.invoke(command, args),
    { command, args },
  );
}
