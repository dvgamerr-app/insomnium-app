import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { withPreview } from "./helpers/preview-app.js";
import { createSvelteUiFixturePlugin } from "./helpers/component-fixture.js";
import { poll } from "./helpers/native-app.js";

const themeUi=process.env.INSOMNIUM_PLUGIN_THEME_UI==="1";
const modulesUi=process.env.INSOMNIUM_PLUGIN_MODULES_UI==="1";
const actionUi=modulesUi||themeUi||process.env.INSOMNIUM_PLUGIN_ACTION_UI==="1";
await withPreview(actionUi?"plugin-resource-actions":"plugin-app-dialogs", async (page, output) => {
  const bundle = await Bun.build({ entrypoints: [actionUi?"tests/ui/fixtures/plugin-resource-actions.js":"tests/ui/fixtures/plugin-app-dialogs.js"], target: "browser", format: "iife", conditions: ["browser", "svelte"], plugins: [...(actionUi?[{name:'browser-native-action-adapter',setup(/** @type {Parameters<import('bun').BunPlugin['setup']>[0]} */build){build.onResolve({filter:/plugin-app-native\.js$/},()=>({path:'native-action-adapter',namespace:'action-native'}));build.onLoad({filter:/.*/,namespace:'action-native'},()=>({contents:"export function createPluginNativeAppEndpoint(){return async()=>{throw Error('Native app IO is outside this browser UI fixture');};}",loader:'js'}));}}]:[]),createSvelteUiFixturePlugin()], define: { "import.meta.url": JSON.stringify(page.url()) } });
  assert.ok(bundle.success, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const workers = (await readdir("build/_app/immutable/workers")).filter(name => /^plugin\.worker-.*\.js$/.test(name));
  assert.equal(workers.length, 1);
  const url = new URL("/_app/immutable/workers/" + workers[0], page.url()).href;
  const served = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), url);
  const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");
  const workerSha256 = hash(Buffer.from(served));
  assert.equal(workerSha256, hash(await Bun.file("build/_app/immutable/workers/" + workers[0]).bytes()));
  if(actionUi){
    if(modulesUi){
      for(const format of ['commonjs','module']){
        await page.evaluate(({url,format})=>/** @type {any} */(window).__resourceActions.open(url,false,format),{url,format});
        try{
          const root=page.getByRole('region',{name:'Plugin action fixture'});
          await root.locator('summary').click();
          await root.getByRole('button',{name:'Module pipeline · insomnia-plugin-action-ui',exact:true}).click();
          const dialog=page.getByRole('dialog',{name:'Plugin module pipeline',exact:true});
          await dialog.getByText('helloไทย',{exact:true}).waitFor();
          await dialog.getByRole('button',{name:'Ok',exact:true}).click();
          await root.getByRole('status').filter({hasText:'Action completed.'}).waitFor();
        }finally{await page.evaluate(()=>/** @type {any} */(window).__resourceActions.close());}
      }
      await Bun.write(output+'/modules-ui-acceptance.json',JSON.stringify({passed:true,headless:true,workerSha256,checks:['CommonJS/ESM buffer and stream imports','actual action and owned dialog','promise pipeline with Unicode bytes'],limits:'Browser production Worker and real registry/UI; native package IO not covered'},null,2));
      return;
    }
    if(themeUi){
      await page.evaluate(url=>/** @type {any} */(window).__resourceActions.open(url,true),url);
      const root=page.getByRole('region',{name:'Plugin action fixture'});
      try{
        const select=root.getByRole('combobox',{name:'Theme',exact:true});
        await select.selectOption('plugin:insomnia-plugin-action-ui:ocean');
        await page.waitForFunction(()=>document.body.getAttribute('theme')==='ocean');
        assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(18, 52, 86)');
        assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--theme-probe').trim()),'active');
        await root.getByRole('checkbox',{name:'Follow system colour scheme',exact:true}).check();
        await root.getByRole('combobox',{name:'Dark theme',exact:true}).selectOption('plugin:insomnia-plugin-action-ui:ocean');
        await page.emulateMedia({colorScheme:'light'});
        await page.waitForFunction(()=>document.documentElement.dataset.theme==='light'&&!document.querySelector('style[data-plugin-theme]'));
        await page.emulateMedia({colorScheme:'dark'});
        await page.waitForFunction(()=>document.body.getAttribute('theme')==='ocean');
        await root.getByRole('checkbox',{name:'Follow system colour scheme',exact:true}).uncheck();
        await page.evaluate(()=>/** @type {any} */(window).__resourceActions.unload());
        await page.waitForFunction(()=>!document.querySelector('style[data-plugin-theme]'));
        assert.equal(await page.locator('body').getAttribute('theme'),null);
        assert.equal(await select.inputValue(),'plugin:insomnia-plugin-action-ui:ocean');
        await select.selectOption('light');
        await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
        await Bun.write(output+'/theme-ui-acceptance.json',JSON.stringify({passed:true,headless:true,workerSha256,checks:['actual Preferences selection','production theme host and guest metadata','raw CSS theme selector','system light/dark changes with independent theme choice','manual selection recovery','unload stylesheet and attribute cleanup','unavailable selection retained','built-in recovery'],limits:'Isolated browser workspace; native persistence and full legacy visual parity unverified'},null,2));
      }finally{await page.evaluate(()=>/** @type {any} */(window).__resourceActions.close());}
      return;
    }
    await page.evaluate(url=>/** @type {any} */(window).__resourceActions.open(url),url);
    const root=page.getByRole('region',{name:'Plugin action fixture'}),before=await page.evaluate(()=>/** @type {any} */(window).__resourceActions.snapshot());
    try{
      for(const type of ['Request','Folder','Collection','Document']){
        await root.getByRole('button',{name:'Select '+type,exact:true}).click();
        await root.locator('summary').click();
        await root.getByRole('button',{name:type+' action · insomnia-plugin-action-ui',exact:true}).click();
        const dialog=page.getByRole('dialog',{name:'Run '+type+' action',exact:true});
        await poll(async()=>await dialog.isVisible()||await root.locator('.inline-error').count()>0,'Action dialog or failure',10000);
        if(await root.locator('.inline-error').count())throw Error(await root.innerText());
        assert.equal(await root.locator('details').evaluate(el=>/** @type {HTMLDetailsElement} */(el).open),type!=='Document','hideAfterClick controls menu');
        await dialog.getByRole('button',{name:'Ok',exact:true}).click();
        await root.getByRole('status').filter({hasText:'Action completed.'}).waitFor();
      }
      assert.equal(await page.evaluate(()=>/** @type {any} */(window).__resourceActions.snapshot()),before,'Actions cannot mutate saved argument snapshots');
      await root.getByRole('button',{name:'Select Request',exact:true}).click();
      for(const mode of ['cancel','source-edit']){
        if(!await root.locator('details').evaluate(el=>/** @type {HTMLDetailsElement} */(el).open))await root.locator('summary').click();
        await root.getByRole('button',{name:'Request action · insomnia-plugin-action-ui',exact:true}).click();
        const owned=page.getByRole('dialog',{name:'Run Request action',exact:true});await owned.waitFor();
        if(mode==='cancel')await root.getByRole('button',{name:'Cancel plugin action',exact:true}).evaluate(el=>/** @type {HTMLButtonElement} */(el).click());
        else await page.evaluate(()=>/** @type {any} */(window).__resourceActions.editRequest('Changed while pending'));
        await owned.waitFor({state:'hidden'});
        await root.getByRole('button',{name:'Cancel plugin action',exact:true}).waitFor({state:'detached'});
        assert.equal(await root.locator('.inline-error').count(),0,'Retired action cannot publish stale error');
        assert.equal(await root.getByRole('status').count(),0,'Retired action cannot publish success');
        await page.evaluate(()=>/** @type {any} */(window).__resourceActions.editRequest('Public request'));
        await root.getByRole('button',{name:'Request action · insomnia-plugin-action-ui',exact:true}).click();
        await owned.waitFor();await owned.getByRole('button',{name:'Ok',exact:true}).click();
        await root.getByRole('status').filter({hasText:'Action completed.'}).waitFor();
      }
      await root.getByRole('button',{name:'Select Document',exact:true}).click();
      await root.locator('summary').click();
      await root.getByRole('button',{name:'Throw action · insomnia-plugin-action-ui',exact:true}).click();
      await root.locator('.inline-error').filter({hasText:'owned action failure'}).waitFor();
      assert.equal(await root.getByRole('button',{name:'Throw action · insomnia-plugin-action-ui',exact:true}).count(),0,'Failed guest leaves visible error after registry quarantine');
      await page.screenshot({path:output+'/actions.png'});
      await Bun.write(output+'/action-ui-acceptance.json',JSON.stringify({passed:true,renderingMode:'headless',workerSha256,checks:['request/folder/collection/document actual UI dispatch through registry and production worker','owned alerts and completion','document hideAfterClick','saved argument isolation','Cancel/source-edit retire alerts without stale feedback and allow fresh action','guest quarantine keeps failure visible'],nativeAdapter:'fixture; native app IPC and file/persistence are not covered'},null,2));
    }catch(error){await Bun.write(output+'/action-failure.txt',await root.innerText());await page.screenshot({path:output+'/action-failure.png'});throw error;}finally{await page.evaluate(()=>/** @type {any} */(window).__resourceActions.close());}
    return;
  }
  // evaluate callbacks are self-contained and use the injected fixture explicitly.
  const open = async (/** @type {'preview'|'send'|'action'} */ purpose) => page.evaluate(({ url, purpose }) => /** @type {any} */ (window).__pluginAppDialogs.open(url, purpose), { url, purpose });
  const start = async (/** @type {string} */ kind, /** @type {any[]} */ args) => page.evaluate(({ kind, args }) => /** @type {any} */ (window).__pluginAppDialogs.start(kind, args), { kind, args });
  const result = async () => page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.result());
  const checks = [];
  try {
    await open("preview");
    const previews = /** @type {[string,any[],any][]} */ ([
      ["alert", ["Preview", "Message"], "void"],
      ["prompt", ["Preview", { defaultValue: "fallback" }], "fallback"],
      ["showSaveDialog", [{ defaultPath: "fixture.txt" }], null],
    ]);
    for (const [kind, args, expected] of previews) { await start(kind, args); assert.deepEqual(await result(), { value: expected }); }
    assert.equal(await page.getByRole("dialog", { name: "Preview", exact: true }).count(), 0);
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls), []);
    checks.push("preview has default/void/null values and zero UI/save dispatch");
    await open("send"); await start("alert", ["Owned alert", "<img src=x onerror=alert(1)>\nไทย😀"]);
    const alert = page.getByRole("dialog", { name: "Owned alert", exact: true });
    await alert.waitFor(); await page.waitForTimeout(5500);
    assert.equal(await alert.locator("img").count(), 0);
    await alert.getByRole("button", { name: "Ok", exact: true }).click();
    assert.deepEqual(await result(), { value: "void" }); await alert.waitFor({ state: "hidden" });
    checks.push("actual owned alert renders literal Unicode text and pauses callback deadline beyond five seconds");
    await start("prompt", ["App prompt", { label: "Secret", defaultValue: "initial", submitName: "Use value", inputType: "password" }]);
    const prompt = page.getByRole("dialog", { name: "App prompt", exact: true }); await prompt.waitFor();
    await prompt.getByLabel("Secret", { exact: true }).fill("answer");
    await prompt.getByRole("button", { name: "Use value", exact: true }).click();
    assert.deepEqual(await result(), { value: "answer" }); await prompt.waitFor({ state: "hidden" });
    checks.push("real app prompt retains label/default/password/custom submit/result");
    await start("prompt", ["App prompt", {}]); await prompt.waitFor();
    await prompt.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.match((await result()).error, /Prompt App prompt cancelled/);
    checks.push("user prompt Cancel rejects with legacy title-bearing error");
    // A failed callback closes its owned VM; recovery must use a fresh session.
    await open("send");
    for (const checked of [false, true]) {
      await start("prompt", ["App prompt", { label: "Flag", inputType: "checkbox" }]); await prompt.waitFor();
      await prompt.getByRole("checkbox", { name: "Flag", exact: true }).setChecked(checked);
      await prompt.getByRole("button", { name: "Submit", exact: true }).click();
      assert.deepEqual(await result(), { value: String(checked) });
    }
    await start("prompt", ["App prompt", { label: "Decimal", defaultValue: "0.5", inputType: "decimal" }]); await prompt.waitFor();
    const decimal = prompt.getByRole("spinbutton", { name: "Decimal", exact: true });
    assert.equal(await decimal.getAttribute("min"), "0.5"); assert.equal(await decimal.getAttribute("step"), "0.1");
    await decimal.fill("2.7"); await prompt.getByRole("button", { name: "Submit", exact: true }).click();
    assert.deepEqual(await result(), { value: "2.7" });
    await start("prompt", ["App prompt", { label: "Unknown", inputType: "unknown-legacy-type" }]); await prompt.waitFor();
    await prompt.getByLabel("Unknown", { exact: true }).fill(""); await prompt.getByRole("button", { name: "Submit", exact: true }).click();
    assert.deepEqual(await result(), { value: "" });
    checks.push("legacy checkbox booleans, decimal min/step and browser unknown-type text fallback");
    await open("action"); await start("showSaveDialog", [{ defaultPath: "fixture.txt" }]);
    assert.deepEqual(await result(), { value: "fixture-save.txt" });
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls), [{ title: "Save File", defaultPath: "fixture.txt" }]);
    checks.push("action save passes native title/defaultPath and returns controlled path");
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.mode("cancel"));
    await start("showSaveDialog", [{}]); assert.deepEqual(await result(), { value: null });
    checks.push("chooser Cancel returns null");
    await start("showSaveDialog", [{ invoke: "forged" }]);
    assert.match((await result()).error, /Invalid plugin dialog options/);
    assert.equal((await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls)).length, 2);
    checks.push("invalid options refuse before save dispatch");
    await open("action"); await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.mode("error"));
    await start("showSaveDialog", [{}]); assert.match((await result()).error, /controlled save failure/);
    await open("action"); await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.mode("held"));
    await start("showSaveDialog", [{}]);
    await poll(async () => (await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls)).length === 1, "held save dispatch");
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.cancel());
    const cancelledSave = await result(); assert.match(cancelledSave.error, /abort|cancel/i);
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.releaseSave());
    await poll(async () => (await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.completed())) === 1, "late save completion cleanup");
    assert.deepEqual(await result(), cancelledSave);
    checks.push("save service failure/owner Cancel and late result suppression recover with fresh VM");
    await open("send"); await start("alert", ["Owned alert", "Cancel owner"]); await alert.waitFor();
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.cancel());
    assert.match((await result()).error, /abort|cancel/i); await alert.waitFor({ state: "hidden" });
    checks.push("root Cancel hides owned alert and refuses callback");
    await open("send"); await start("alert", ["Owned alert", "Lost owner"]); await alert.waitFor();
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.invalidate());
    assert.match((await result()).error, /abort|cancel|current/i); await alert.waitFor({ state: "hidden" });
    checks.push("owner invalidation without parent Abort still hides owned alert and terminates callback");
  } finally { await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.close()); }
  const records = await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.records);
  assert.ok(records.every((/** @type {any} */ record) => record.terminated));
  await Bun.write(output + "/result.json", JSON.stringify({ status: "passed", headless: true, checks, workerSha256, workers: records.length, allTerminated: true, completeAppFacadeActivated: false, limits: "Actual VM/worker/dialog component; controlled save, no native chooser or clipboard acceptance." }, null, 2));
},actionUi?{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}:{});
