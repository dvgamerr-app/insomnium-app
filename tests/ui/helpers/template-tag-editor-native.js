import assert from "node:assert/strict";
import { poll } from "./native-app.js";
import { withIpcSuccessHook } from "./ipc-success-hook.js";
import { withDialogSelection } from "./dialog-selection.js";
import { pluginWorkerRecords } from "./plugin-worker-probe.js";

export const editorTemplate =
  '{% editor "hello", -0, false, _.scope, 1 + 2, "0", "", "" %}';
export const editorTagSource = `exports.templateTags.push({
 name:'editor',displayName:'Native editor',
 disablePreview:args=>args[2].value===true,
 args:[
 {type:'string',displayName:'Text',encoding:'base64',defaultValue:'hello',help:args=>'Text: '+args[0].value,validate:value=>value==='bad'?'Invalid native text':''},
 {type:'number',displayName:'Number',defaultValue:-0},
 {type:'boolean',displayName:'Mask',defaultValue:false},
 {type:'variable',displayName:'Variable'},
 {type:'expression',displayName:'Expression',hide:args=>args[0].value==='hide'},
 {type:'enum',displayName:'Choice',options:[{value:false,displayName:'False'},{value:0,displayName:'Zero'}]},
 {type:'file',displayName:'Path',extensions:['txt'],itemTypes:['file','directory']},
 {type:'model',displayName:'Request',model:'Request'}],
 actions:[{name:'Editor action',async run(c){if(!Object.isFrozen(c)||Object.keys(c).join(',')!=='store')throw Error('Wrong action context');await c.store.setItem('editorAction',JSON.stringify({context:Object.keys(c),thisName:this.name}));}},
 {name:'Held editor action',async run(c){await c.store.getItem('editorGate');await c.store.setItem('editorForbidden','leaked');}}],
 async run(c,...args){return JSON.stringify({args,negativeZero:Object.is(args[1],-0),scope:c.context.scope,meta:c.meta,purpose:c.renderPurpose,action:await c.store.getItem('editorAction')});}
});`;

/** Real mounted editor/plugin/template workers/native store/loopback Send.
 * File dialog selection alone is controlled; no worker or native store reply is fabricated.
 * @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string,requestId:string,collection:string,plugin:string,body:(text:string)=>Promise<void>,send:(expected:string|null)=>Promise<void>,reload:()=>Promise<void>}} context */
export async function exerciseTemplateTagEditorNative(context) {
  const {
    page,
    invoke,
    output,
    requestId,
    collection,
    plugin,
    body,
    send,
    reload,
  } = context;
  const checks = [];
  const observations = [];
  const dialog = page.getByRole("dialog", {
    name: "Template tag",
    exact: true,
  });
  const code = page.locator(".request-editor .CodeMirror").first();
  const ready = () =>
    poll(
      async () =>
        await dialog
          .getByRole("button", { name: "Apply", exact: true })
          .isEnabled(),
      "Native tag editor ready",
    );
  async function open() {
    await code.evaluate((element) => {
      const cm = /** @type {any} */ (element).CodeMirror;
      cm.setCursor(cm.posFromIndex(cm.getValue().indexOf("{%") + 5));
      cm.focus();
    });
    await page
      .getByRole("button", { name: "Template tag", exact: true })
      .click();
    await dialog.waitFor();
    await ready();
  }
  const preview = async () =>
    JSON.parse(
      await dialog.getByLabel("Preview", { exact: true }).inputValue(),
    );
  await body("before " + editorTemplate + " after");
  await open();
  const geometry = [];
  for (const theme of ["dark", "light"])
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const bounds = await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          width: r.width,
          viewport: innerWidth,
          overflow: el.scrollWidth > el.clientWidth,
        };
      });
      assert.ok(
        bounds.width > 0 &&
          bounds.left >= 0 &&
          bounds.right <= bounds.viewport &&
          !bounds.overflow,
      );
      const controls = await dialog
        .locator("input,select,textarea,button")
        .evaluateAll((elements) =>
          elements.map((el) => {
            const owner = el.closest("dialog");
            if (!owner) throw Error("Control lost its dialog");
            const r = el.getBoundingClientRect(),
              p = owner.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              width: r.width,
              ownerLeft: p.left,
              ownerRight: p.right,
            };
          }),
        );
      assert.ok(
        controls.every(
          (c) =>
            c.width > 0 && c.left >= c.ownerLeft && c.right <= c.ownerRight,
        ),
      );
      geometry.push({ theme, width, bounds, controls });
      await dialog.getByLabel("Tag", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: output + `/editor-${theme}-${width}.png` });
      await dialog
        .getByRole("button", { name: "Apply", exact: true })
        .scrollIntoViewIfNeeded();
      if (width === 760)
        await page.screenshot({
          path: output + `/editor-${theme}-${width}-bottom.png`,
        });
    }
  observations.push({ geometry });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  assert.equal(
    await dialog.getByLabel("Number", { exact: true }).inputValue(),
    "-0",
  );
  assert.deepEqual((await preview()).meta, {
    requestId,
    workspaceId: collection,
  });
  await dialog.getByLabel("Text", { exact: true }).fill("bad");
  await dialog.getByText("Invalid native text", { exact: true }).waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Apply", exact: true })
      .isEnabled(),
    false,
  );
  await dialog.getByLabel("Text", { exact: true }).fill("native ' ไทย😀");
  await ready();
  await dialog.getByLabel("Request", { exact: true }).selectOption(requestId);
  await ready();
  const path = output + "\\native-editor.txt";
  const file = await withDialogSelection(page, path, async () => {
    await dialog
      .getByRole("button", { name: "Choose file", exact: true })
      .click();
    await ready();
  });
  assert.equal(file.options.options.directory, false);
  assert.deepEqual(file.options.options.filters, [
    { name: "Files", extensions: ["txt"] },
  ]);
  assert.equal(
    await dialog.getByLabel("Path", { exact: true }).inputValue(),
    path,
  );
  const folder = await withDialogSelection(page, output, async () => {
    await dialog
      .getByRole("button", { name: "Choose folder", exact: true })
      .click();
    await ready();
  });
  assert.equal(folder.options.options.directory, true);
  assert.equal(folder.options.options.filters, undefined);
  assert.equal(
    await dialog.getByLabel("Path", { exact: true }).inputValue(),
    output,
  );
  await dialog.getByLabel("Path", { exact: true }).fill(path);
  await ready();
  await dialog
    .getByRole("button", { name: "Editor action", exact: true })
    .click();
  await ready();
  const action = await invoke("plugin_store", {
    plugin,
    operation: { action: "getItem", key: "editorAction" },
  });
  assert.deepEqual(JSON.parse(action), {
    context: ["store"],
    thisName: "Editor action",
  });
  const rendered = await preview();
  assert.equal(rendered.negativeZero, true);
  assert.equal(rendered.scope, "base");
  assert.equal(rendered.action, action);
  assert.deepEqual(rendered.args, [
    "native ' ไทย😀",
    0,
    false,
    "base",
    3,
    "0",
    path,
    requestId,
  ]);
  assert.equal(rendered.purpose, "general");
  observations.push({ rendered, file, folder, action });
  await page.screenshot({ path: output + "/native-editor.png" });
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await poll(
    async () =>
      (await invoke("load_workspace")).resources
        .find((/** @type {any} */ item) => item._id === requestId)
        .body.text.includes("b64::"),
    "Applied native authoring persisted",
  );
  await send(
    "before " + JSON.stringify({ ...rendered, purpose: "send" }) + " after",
  );
  checks.push(
    "eight typed arguments, actual metadata validation, encoded Unicode/signed zero, native action/store and actual Send",
  );

  await body(editorTemplate);
  await open();
  await dialog.getByLabel("Mask", { exact: true }).check();
  await ready();
  assert.equal(
    await dialog.getByLabel("Preview", { exact: true }).inputValue(),
    "Preview disabled",
  );
  const held = await withIpcSuccessHook(
    page,
    "plugin_store",
    async () => {
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    },
    async () => {
      await dialog
        .getByRole("button", { name: "Held editor action", exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
    },
  );
  assert.equal(held.calls, 1);
  assert.equal(held.hooks, 1);
  assert.equal(
    await invoke("plugin_store", {
      plugin,
      operation: { action: "hasItem", key: "editorForbidden" },
    }),
    false,
  );
  observations.push({ held });
  await reload();
  checks.push(
    "cancel after one genuine held native action read prevents the later write and explicit Load recovers",
  );

  await body(editorTemplate);
  await open();
  await dialog.getByLabel("Mask", { exact: true }).check();
  await ready();
  const draftHeld = await withIpcSuccessHook(
    page,
    "plugin_store",
    async () => {
      await dialog
        .getByLabel("Text", { exact: true })
        .fill("changed during action");
    },
    async () => {
      await dialog
        .getByRole("button", { name: "Held editor action", exact: true })
        .click();
      await poll(
        async () =>
          (await pluginWorkerRecords(page)).at(-1)?.terminated === true,
        "Changed draft closes the active guest before a later write",
      );
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    },
  ).catch(async (error) => {
    await Bun.write(
      output + "/draft-action-failure.json",
      JSON.stringify(
        {
          error: String(error),
          forbidden: await invoke("plugin_store", {
            plugin,
            operation: { action: "hasItem", key: "editorForbidden" },
          }),
          records: await pluginWorkerRecords(page),
        },
        null,
        2,
      ) + "\n",
    );
    throw error;
  });
  assert.equal(draftHeld.calls, 1);
  assert.equal(draftHeld.hooks, 1);
  assert.equal(
    await invoke("plugin_store", {
      plugin,
      operation: { action: "hasItem", key: "editorForbidden" },
    }),
    false,
  );
  observations.push({ draftHeld });
  await reload();
  checks.push(
    "draft change after one real held action read terminates its guest and refuses the later write",
  );

  const prompt =
    "{% prompt 'Owned editor prompt', 'Value', 'initial', 'editor-native-key', false, true %}";
  await body(prompt);
  const pending = send("remembered");
  const promptDialog = page.getByRole("dialog", {
    name: "Owned editor prompt",
    exact: true,
  });
  await promptDialog.getByLabel("Value", { exact: true }).fill("remembered");
  await promptDialog
    .getByRole("button", { name: "Submit", exact: true })
    .click();
  await pending;
  await send("remembered");
  assert.equal(await promptDialog.count(), 0);
  await open();
  assert.equal(
    await dialog.getByLabel("Preview", { exact: true }).inputValue(),
    "remembered",
  );
  await dialog.getByRole("button", { name: "Clear", exact: true }).click();
  await ready();
  assert.equal(
    await dialog.getByLabel("Preview", { exact: true }).inputValue(),
    "initial",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const afterClear = send("fresh");
  await promptDialog.getByLabel("Value", { exact: true }).fill("fresh");
  await promptDialog
    .getByRole("button", { name: "Submit", exact: true })
    .click();
  await afterClear;
  checks.push(
    "real Prompt Clear removes cached explicit key and the next native Send prompts again",
  );

  await page
    .getByRole("button", { name: "Close Plugin render request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit environment", exact: true })
    .click();
  const envCode = page
    .locator(".shared-code-editor")
    .filter({ has: page.locator('textarea[aria-label="Environment JSON"]') })
    .locator(".CodeMirror");
  await envCode.evaluate((element) => {
    const cm = /** @type {any} */ (element).CodeMirror;
    cm.setCursor(cm.posFromIndex(cm.getValue().indexOf("{% editor") + 5));
    cm.focus();
  });
  await page.keyboard.press("Control+Alt+Space");
  await dialog.waitFor();
  await ready();
  const general = await preview();
  assert.deepEqual(general.meta, { requestId: "n/a", workspaceId: collection });
  assert.equal(general.scope, "base");
  observations.push({ general });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByText("Plugin render request", { exact: true })
    .first()
    .click();
  await body("{% dup %}");
  checks.push(
    "general environment editor retains genuine custom catalog with collection source and n/a request meta",
  );
  return { checks, observations };
}
