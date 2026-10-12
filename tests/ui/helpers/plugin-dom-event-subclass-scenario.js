import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSvelteUiFixturePlugin} from './component-fixture.js';
import {exerciseEventSubclasses,observeNativeSubclass} from './plugin-dom-event-subclass-cases.js';
/** @param {import('playwright-core').Page} page @param {string} output @param {{nativeFixturePath?:string}} [options] */
export async function runEventSubclassScenario(page,output,options={}){
    const oracle = await page.evaluate(
      (source) => new Function("return (" + source + ")(globalThis)")(),
      exerciseEventSubclasses.toString(),
    );
    await Bun.write(output + "/oracle.json", JSON.stringify(oracle, null, 2));
    if(options.nativeFixturePath){
      const path=options.nativeFixturePath,bytes=await Bun.file(path).bytes(),served=await page.evaluate(async url=>Array.from(new Uint8Array(await(await fetch(url)).arrayBuffer())), '/'+path.replace(/^build\//,''));
      assert.equal(createHash('sha256').update(Uint8Array.from(served)).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
      await page.evaluate(await Bun.file(path).text());
    }else{
      const fixture=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-guest-dom.js'],target:'browser',format:'iife',conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()],define:{'import.meta.url':JSON.stringify(page.url())}});
      assert.equal(fixture.success,true);await page.evaluate(await fixture.outputs[0].text());
    }
    const files = (await readdir("build/_app/immutable/workers")).filter((name) =>
      /^plugin\.worker-.*\.js$/.test(name),
    );
    assert.equal(files.length, 1);
    const path = "build/_app/immutable/workers/" + files[0],
      url = new URL("/_app/immutable/workers/" + files[0], page.url()).href,
      workerSha256 = createHash("sha256")
        .update(await Bun.file(path).bytes())
        .digest("hex");
    const call = (/** @type {string} */ method, /** @type {any[]} */ args = []) =>
      page.evaluate(
        ({ method, args }) => /** @type {any} */ (window).__pluginGuestDom[method](...args),
        { method, args },
      );
    const initialized = [];
    try {
      for (const format of ["commonjs", "module"]) {
        await call("open", [url, format]);
        const initializedGuest = await call("eventSubclasses", ["initialized"]);
        assert.deepEqual(initializedGuest, oracle);
        const guest = await call("eventSubclasses", ["surface"]);
        await Bun.write(output + "/" + format + ".json", JSON.stringify(guest, null, 2));
        assert.deepEqual(guest, oracle);
        initialized.push(format);
      }
      await call("eventSubclasses", ["native"]);
      const dialog = page.getByRole("dialog", { name: "Event subclass dialog", exact: true }),
        input = dialog.getByRole("textbox", { name: "Guest subclass input" });
      await input.waitFor();
      await input.evaluate((element, source) => {
        /** @type {any} */ (window).__subclassOracle = [];
        const observe = new Function("return (" + source + ")")();
        for (const type of ["click", "keydown", "keyup"])
          element.addEventListener(type, (event) =>
            /** @type {any} */ (window).__subclassOracle.push(observe(event, globalThis)),
          );
      }, observeNativeSubclass.toString());
      await input.click();
      await input.press("Shift+K");
      const text = await dialog.getByRole("status").textContent();
      assert.ok(text);
      const guestNative = JSON.parse(text),
        nativeOracle = await page.evaluate(() => /** @type {any} */ (window).__subclassOracle);
      await Bun.write(
        output + "/native.json",
        JSON.stringify({ guestNative, nativeOracle }, null, 2),
      );
      assert.deepEqual(guestNative, nativeOracle);
      assert.ok(guestNative.some((/** @type {any} */ row) => row.pointer && row.trusted));
      assert.ok(
        guestNative.some(
          (/** @type {any} */ row) => row.keyboard && row.key === "K" && row.shiftKey,
        ),
      );
      await call("close");
      const records = await page.evaluate(
        () => /** @type {any} */ (window).__pluginGuestDom.records,
      );
      assert.ok(records.every((/** @type {any} */ row) => row.terminated));
      await Bun.write(
        output + "/"+(options.nativeFixturePath?"native-subclasses-acceptance.json":"result.json"),
        JSON.stringify(
          {
            status: "passed",
            headless: !options.nativeFixturePath,
            renderingMode:options.nativeFixturePath?"native-hidden":"headless",
            checks: [
              "Five constructor surfaces match browser in CommonJS",
              "Five constructor surfaces match browser in ES module",
              "Actual trusted pointer brand and serialized values match same browser event",
              "Actual trusted keyboard brands and values match same browser events",
            ],
            oracle,
            initialized,
            guestNative,
            nativeOracle,
            records,
            workerSha256,
            eventFeatureComplete: false,
          limits:
            "Owned native view uses an isolated Window facade; foreign/null views do not expose a host Window. Full Window APIs, legacy mouse/keyboard initializers, extended modifiers, pointer coalesced/predicted samples and full synthetic dispatch remain open.",
          },
          null,
          2,
        ),
      );
    } finally {
      await call("close").catch(() => {});
    }
}
