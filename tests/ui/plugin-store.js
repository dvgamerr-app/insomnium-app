import assert from "node:assert/strict";
import { readFile, writeFile, realpath, unlink, lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withNativeApp, probeIdentifier, poll } from "./helpers/native-app.js";
import {
  pluginStoreScenario,
  installPluginStoreFixture,
  storeCall,
} from "./helpers/plugin-store.js";

assert.ok(process.env.APPDATA);
const root = resolve(process.env.APPDATA, probeIdentifier);
assert.equal(
  (await realpath(root)).toLowerCase(),
  root.toLowerCase(),
  "Refuse redirected probe app data",
);
const path = join(root, "plugin-data-v1.json");
let original;
try {
  const metadata = await lstat(path);
  assert.ok(
    metadata.isFile() && !metadata.isSymbolicLink(),
    "Refuse a linked or non-file probe store before preparing faults",
  );
  assert.equal((await realpath(path)).toLowerCase(), path.toLowerCase());
  original = await readFile(path);
} catch (error) {
  if (/** @type {any} */ (error).code !== "ENOENT") throw error;
}
/** @type {Awaited<ReturnType<typeof pluginStoreScenario>>|undefined} */
let continuation;
try {
  await withNativeApp("plugin-store", async (context) => {
    if(process.env.INSOMNIUM_PLUGIN_LEGACY_DATA!=="1"){
      continuation = await pluginStoreScenario(context, path);
      return;
    }
    const {page,invoke,output}=context;
    const workspace=await invoke('load_workspace');
    const a='insomnia-plugin-legacy-store-fixture',b='insomnia-plugin-legacy-store-control';
    await installPluginStoreFixture(page,output);
    await storeCall(page,a,'clear');await storeCall(page,b,'clear');
    await storeCall(page,a,'setItem',['existing','current']);
    try{
      const seed=structuredClone(workspace);
      seed.resources=seed.resources.filter((/** @type {any} */record)=>record._type!=='plugin_data');
      seed.resources.push(...[
        {_id:'plg_fixture_old',key:'imported',value:'old',modified:1},
        {_id:'plg_fixture_new',key:'imported',value:'ล่าสุด',modified:2},
        {_id:'plg_fixture_existing',key:'existing',value:'legacy',modified:3},
      ].map(record=>({...record,_type:'plugin_data',plugin:a,parentId:null})));
      await invoke('save_workspace',{data:seed});await page.reload();
      await page.locator('button[aria-label="Preferences"]').click();
      await page.getByRole('tab',{name:'Plugins',exact:true}).click();
      await page.getByRole('button',{name:'Import legacy plugin data',exact:true}).click();
      await page.getByRole('status').filter({hasText:'Imported 1 values; kept 2'}).waitFor();
      await page.getByRole('tab',{name:'General',exact:true}).click();
      await page.getByRole('checkbox',{name:'Follow system colour scheme',exact:true}).check();
      await poll(async()=>(await invoke('load_workspace')).settings.autoDetectColorScheme===true,'system theme persisted');
      await page.reload();
      await page.locator('button[aria-label="Preferences"]').click();
      assert.equal(await page.getByRole('checkbox',{name:'Follow system colour scheme',exact:true}).isChecked(),true);
      await installPluginStoreFixture(page,output);
      const expected={a:[{key:'existing',value:'current'},{key:'imported',value:'ล่าสุด'}],b:[]};
      assert.deepEqual(await storeCall(page,a,'all'),expected.a);
      const retained=await readFile(path);
      await assert.rejects(()=>invoke('import_legacy_plugin_data',{records:[{plugin:a,key:'must-not-commit',value:'x'},{plugin:'../invalid',key:'x',value:'x'}]}));
      assert.deepEqual(await readFile(path),retained,'Invalid batch cannot commit its valid prefix');
      continuation={a,b,expected,retained,workspace,parentOutput:output};
      await Bun.write(join(output,'legacy-acceptance.json'),JSON.stringify({passed:true,checks:['actual Plugins import button','latest duplicate wins','current key preserved','invalid batch atomic refusal','system preference survives reload'],nativeMode:'native-hidden'},null,2));
    }catch(failure){
      await Bun.write(join(output,'legacy-failure.txt'),await page.locator('body').innerText());
      throw failure;
    }finally{
      await invoke('save_workspace',{data:workspace});await page.reload();
      await page.locator('button[aria-label="Preferences"]').waitFor();
    }
  });
  assert.ok(continuation);
  const saved = /** @type {Awaited<ReturnType<typeof pluginStoreScenario>>} */ (
    continuation
  );
  await withNativeApp(
    "plugin-store-restart",
    async ({ page, invoke, output }) => {
      await installPluginStoreFixture(page, output);
      assert.deepEqual(await readFile(path), saved.retained);
      const actual = {
        a: await storeCall(page, saved.a, "all"),
        b: await storeCall(page, saved.b, "all"),
      };
      assert.deepEqual(actual, saved.expected);
      assert.deepEqual(await invoke("load_workspace"), saved.workspace);
      assert.deepEqual(await readFile(path), saved.retained);
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            parentOutput: saved.parentOutput,
            actual,
            expected: saved.expected,
            workspacePreserved: true,
            storeBytes: saved.retained.length,
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  // Restore only this isolated probe's exact store, after native processes exit.
  if (original) {
    await writeFile(path, original);
    assert.deepEqual(await readFile(path), original);
  } else {
    await unlink(path).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    assert.equal(await Bun.file(path).exists(), false);
  }
}
