import assert from "node:assert/strict";
import { withPreview } from "./helpers/preview-app.js";
import {
  exerciseSplit,
  exerciseSplitCollapse,
  exerciseSplitRelease,
  exerciseSplitStorage,
  exerciseGraphqlResponsiveSplit,
  exerciseWorkspaceEditorContent,
} from "./helpers/split-pane.js";
import { assertRequestResponseSplit } from "./helpers/request-response-split.js";
import { exerciseRunnerResults } from "./helpers/runner-results.js";
import {initialData,newRequest} from '../../src/lib/model.js';
import {addWideCollectionFixture} from './helpers/collection-actions-cases.js';

const tabsOnly=process.env.INSOMNIUM_WORKSPACE_TABS_ONLY==='1';
const nestedNetwork=process.env.INSOMNIUM_RUNNER_NESTED_NETWORK==='1';
const nestedDelete=process.env.INSOMNIUM_RUNNER_NESTED_DELETE==='1';
const nestedDeleteSuite=process.env.INSOMNIUM_RUNNER_NESTED_DELETE_SUITE==='1';
const nestedRoundtrip=process.env.INSOMNIUM_RUNNER_NESTED_ROUNDTRIP==='1';
const nestedAmbiguous=process.env.INSOMNIUM_RUNNER_NESTED_AMBIGUOUS==='1';
const nestedEnvironment=process.env.INSOMNIUM_RUNNER_NESTED_ENVIRONMENT==='1';
assert.ok(!nestedEnvironment||nestedRoundtrip&&!nestedAmbiguous);
assert.ok(!nestedAmbiguous||nestedRoundtrip);
assert.ok([nestedDelete,nestedDeleteSuite,nestedRoundtrip].filter(Boolean).length<=1&&(!(nestedDelete||nestedDeleteSuite||nestedRoundtrip)||nestedNetwork));
const runnerNetwork={requests:/** @type {string[]} */ ([]),labels:/** @type {(string|null)[]} */ ([]),environment:nestedEnvironment,aborted:false,finished:false,deleteRequest:nestedDelete,deleteSuite:nestedDeleteSuite,roundtrip:nestedRoundtrip,ambiguous:nestedAmbiguous,release:()=>{}};
const heldDelete={entered:false,aborted:false,completed:false,release:()=>{}};
const tabData=initialData(),foreignTabs=initialData();
const firstTab=tabData.resources.find(row=>row._id===tabData.activeRequestId);assert.ok(firstTab);firstTab.name='Owned restored first';
const secondTab=newRequest(tabData.activeWorkspaceId,{name:'Owned restored second'});
if(tabsOnly){
  const {selectedId}=addWideCollectionFixture(foreignTabs);assert.ok(selectedId);
  foreignTabs.resources.push({_id:'wrkm_owned_large_selection',_type:'workspace_meta',parentId:foreignTabs.activeWorkspaceId,activeRequestId:selectedId});
  foreignTabs.activeRequestId=selectedId;
}
const folder={_id:'fld_owned_tab',_type:'request_group',parentId:tabData.activeWorkspaceId,name:'Owned tab folder'};
tabData.resources.push(secondTab,folder,...foreignTabs.resources);
const tabEnvironment=tabData.resources.find(row=>row._type==='environment');assert.ok(tabEnvironment);
tabData.openTabs=[firstTab._id,secondTab._id,firstTab._id,folder._id,foreignTabs.activeRequestId,'req_missing_tab',secondTab._id,tabEnvironment._id];

await withPreview(
  nestedEnvironment?"nocturne-workspace-nested-environment":nestedAmbiguous?"nocturne-workspace-nested-ambiguous":nestedRoundtrip?"nocturne-workspace-nested-roundtrip":nestedDeleteSuite?"nocturne-workspace-nested-delete-suite":nestedDelete?"nocturne-workspace-nested-delete":"nocturne-workspace",
  async (page, output) => {
    const errors = /** @type {string[]} */ ([]);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("button", { name: "Git", exact: true }).waitFor();
    if(tabsOnly){
      const tabs=page.locator('.request-tabs'),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
      assert.equal(await tabs.locator('.request-tab').count(),2,'Restored tabs have unique request IDs');
      assert.equal(await tabs.getByRole('button',{name:'Close Owned restored first',exact:true}).count(),1);
      await tabs.getByRole('button',{name:'Close Owned restored first',exact:true}).click();
      await page.waitForFunction(id=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').activeRequestId===id,secondTab._id);
      let saved=await read();assert.deepEqual(saved.openTabs,[secondTab._id,foreignTabs.activeRequestId]);
      assert.deepEqual(saved.resources.filter((/** @type {any} */ row)=>tabData.resources.some(original=>original._id===row._id)),tabData.resources);
      await tabs.getByRole('button',{name:'Close Owned restored second',exact:true}).click();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').activeRequestId==='');
      assert.equal(await tabs.locator('.request-tab').count(),0);assert.deepEqual((await read()).openTabs,[foreignTabs.activeRequestId]);
      await page.reload();await page.locator('.tree-request-row').filter({hasText:'Owned restored second'}).waitFor();assert.equal(await tabs.locator('.request-tab').count(),0);assert.equal((await read()).activeRequestId,'');
      await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption(foreignTabs.activeWorkspaceId);
      await tabs.locator('.request-tab').waitFor();assert.equal(await tabs.locator('.request-tab').count(),1);
      assert.equal((await read()).activeRequestId,foreignTabs.activeRequestId,'Large collection restores its last request');
      assert.equal(await tabs.getByText('Owned large request 9999',{exact:true}).isVisible(),true);
      await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption(tabData.activeWorkspaceId);
      await page.waitForFunction(id=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').activeWorkspaceId===id,tabData.activeWorkspaceId);
      saved=await read();assert.equal(saved.activeRequestId,'');assert.deepEqual(saved.openTabs,[foreignTabs.activeRequestId]);assert.deepEqual(saved.history,tabData.history);assert.deepEqual(errors,[]);
      for(const invalid of ['req_missing_owned',foreignTabs.activeRequestId,folder._id]){
        await page.evaluate(({workspaceId,invalid})=>{
          const data=JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}');
          data.activeWorkspaceId=workspaceId;data.activeRequestId=invalid;data.openTabs=[];
          const meta=data.resources.find((/** @type {any} */ row)=>row._type==='workspace_meta'&&row.parentId===workspaceId);
          meta.activeRequestId=invalid;localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(data));
        },{workspaceId:tabData.activeWorkspaceId,invalid});
        await page.reload();
        await tabs.getByRole('button',{name:'Close Owned restored first',exact:true}).waitFor();
        assert.equal(await tabs.locator('.request-tab').count(),1,'Invalid remembered request falls back to a request in its own collection');
        await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption(foreignTabs.activeWorkspaceId);
        await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption(tabData.activeWorkspaceId);
        await page.waitForFunction(id=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').activeRequestId===id,firstTab._id);
        assert.deepEqual((await read()).history,tabData.history);
      }
      const beforeImport=await read();
      const imported={resources:[
        {_id:'wrk_import_selection',_type:'workspace',parentId:null,name:'Owned imported selection',scope:'collection'},
        {_id:'fld_import_selection',_type:'request_group',parentId:'wrk_import_selection',name:'Owned imported folder'},
        {_id:'req_import_first',_type:'request',parentId:'wrk_import_selection',name:'Owned imported first',method:'GET',url:'https://owned.invalid/first'},
        {_id:'req_import_selected',_type:'request',parentId:'fld_import_selection',name:'Owned imported selected',method:'GET',url:new URL('/owned-delete-held',page.url()).href},
        {_id:'env_import_selected',_type:'environment',parentId:'wrk_import_selection',name:'Owned imported environment',data:{owned:'value'}},
        {_id:'wrkm_import_selection',_type:'workspace_meta',parentId:'wrk_import_selection',activeRequestId:'req_import_selected',activeEnvironmentId:'env_import_selected'}
      ]};
      await page.getByRole('button',{name:'Import collection',exact:true}).click();
      const importDialog=page.getByRole('dialog');
      await importDialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(imported));
      await importDialog.getByRole('button',{name:'Review import',exact:true}).click();
      await importDialog.getByRole('button',{name:'Import',exact:true}).click();
      await importDialog.waitFor({state:'detached'});
      await tabs.getByRole('button',{name:'Close Owned imported selected',exact:true}).waitFor();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources.some((/** @type {any} */ row)=>row.name==='Owned imported selection'));
      let afterImport=await read();
      const importedWorkspace=afterImport.resources.find((/** @type {any} */ row)=>row.name==='Owned imported selection');
      const importedRequest=afterImport.resources.find((/** @type {any} */ row)=>row.name==='Owned imported selected');
      const importedEnvironment=afterImport.resources.find((/** @type {any} */ row)=>row.name==='Owned imported environment');
      assert.notEqual(importedWorkspace._id,'wrk_import_selection');assert.notEqual(importedRequest._id,'req_import_selected');assert.notEqual(importedEnvironment._id,'env_import_selected');
      assert.equal(afterImport.activeWorkspaceId,importedWorkspace._id);assert.equal(afterImport.activeRequestId,importedRequest._id);assert.equal(afterImport.activeEnvironmentId,importedEnvironment._id);
      assert.deepEqual(afterImport.history,beforeImport.history);
      await page.reload();await tabs.getByRole('button',{name:'Close Owned imported selected',exact:true}).waitFor();
      afterImport=await read();assert.equal(afterImport.activeRequestId,importedRequest._id);assert.equal(afterImport.activeEnvironmentId,importedEnvironment._id);
      await page.getByRole('button',{name:'Send',exact:true}).click();
      try {
        await page.waitForFunction(()=>document.querySelector('button[aria-label="Delete request"]')!==null);
        for(let attempt=0;attempt<100&&!heldDelete.entered;attempt++)await page.waitForTimeout(50);
        assert.equal(heldDelete.entered,true,'Selected request reached the held endpoint');
        await page.getByRole('button',{name:'Delete request',exact:true}).click();
        const deleteDialog=page.getByRole('dialog',{name:'Delete request?',exact:true});
        await deleteDialog.getByRole('button',{name:'Delete request',exact:true}).click();
        await deleteDialog.waitFor({state:'detached'});
      } finally {heldDelete.release();}
      for(let attempt=0;attempt<100&&!heldDelete.completed;attempt++)await page.waitForTimeout(50);
      assert.equal(heldDelete.completed,true,'Held response was released');
      await page.waitForTimeout(250);
      assert.equal(heldDelete.aborted,true,'Deleting the active request aborts its pending transport');
      await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources.some((/** @type {any} */ row)=>row._id===id),importedRequest._id);
      const deleted=await read();
      assert.equal(deleted.activeRequestId,'');assert.ok(!deleted.openTabs.includes(importedRequest._id));
      assert.equal(deleted.resources.find((/** @type {any} */ row)=>row._type==='workspace_meta'&&row.parentId===importedWorkspace._id).activeRequestId,'');
      assert.ok(deleted.resources.some((/** @type {any} */ row)=>row.name==='Owned imported first'));
      assert.deepEqual(deleted.resources.filter((/** @type {any} */ row)=>row._type!=='workspace_meta'&&beforeImport.resources.some((/** @type {any} */ original)=>original._id===row._id)),beforeImport.resources.filter((/** @type {any} */ row)=>row._type!=='workspace_meta'));
      assert.deepEqual(deleted.history,beforeImport.history);
      await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
      assert.equal(await tabs.getByRole('button',{name:'Close Owned imported selected',exact:true}).count(),0);
      const reloadedDelete=await read();assert.equal(reloadedDelete.activeRequestId,'');assert.deepEqual(reloadedDelete.history,beforeImport.history);
      await Bun.write(output+'/tabs.json',JSON.stringify({passed:true,duplicateTabsRemoved:true,nonRequestAndMissingTabsRemoved:true,stableOrder:true,closeActiveFallback:true,closeLastAndReloadEmpty:true,foreignTabsRetained:true,largeCollectionRequests:10000,rememberedLastRequest:true,invalidRememberedRequestFallback:['missing','foreign','folder'],importedSelectionRemappedAndReloaded:true,deleteHeldImportedRequestAndReload:true,authoredResourcesUnchanged:true,historyUnchanged:true},null,2));
      await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,focus:'saved request tabs'},null,2));return;
    }
    if (process.env.INSOMNIUM_RUNNER_NESTED_ONLY === "1") {
      await page.getByRole("button",{name:"Tests",exact:true}).click();
      await page.getByRole("button",{name:"New Test Suite",exact:true}).click();
      await page.getByRole("textbox",{name:"Test suite name",exact:true}).waitFor();
      await exerciseRunnerResults(page,output,true,nestedNetwork?runnerNetwork:undefined);
      await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,nestedSuiteLevels:3,requests:runnerNetwork.requests,labels:runnerNetwork.labels,aborted:runnerNetwork.aborted,deletedRequest:nestedDelete,deletedSuite:nestedDeleteSuite,roundtrip:nestedRoundtrip,ambiguous:nestedAmbiguous,environment:nestedEnvironment,scope:nestedEnvironment?"Imported nested suite resolves its collection environment; preview only":nestedAmbiguous?"Ambiguous imported request ID refuses dispatch; preview only":nestedRoundtrip?"Nested suite export/reimport, execution and reload; preview only":nestedDeleteSuite?"Nested suite deletion while held, cancellation and reload; preview only":nestedDelete?"Nested runner request deletion while held, cancellation and reload; preview only":nestedNetwork?"Actual Runner UI/worker/VM/nested binding, held preview loopback, Stop and persisted results; no native":"Actual Runner UI/worker/VM/nested titles/request binding/results persistence and original result controls; no network/native"},null,2));
      return;
    }
    assert.equal(
      await page
        .getByRole("textbox", { name: "Request name", exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Edit request name", exact: true })
      .focus();
    const name = page.getByRole("textbox", {
      name: "Request name",
      exact: true,
    });
    await name.fill("Renamed request");
    await name.press("Enter");
    assert.equal(
      await page
        .getByRole("button", { name: "Edit request name", exact: true })
        .innerText(),
      "Renamed request",
    );
    await page
      .getByRole("button", { name: "Edit request name", exact: true })
      .focus();
    assert.equal(
      await name.count(),
      0,
      "Completed keyboard rename remains display-focused without reopening",
    );
    await page
      .getByRole("button", { name: "Edit request name", exact: true })
      .click();
    await name.fill("Discard this");
    await name.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Edit request name", exact: true })
        .innerText(),
      "Renamed request",
    );
    for (const select of await page
      .locator("select.ui-select:not([multiple]):not([size])")
      .all()) {
      assert.equal(
        await select
          .locator("..")
          .locator(".select-arrow svg.lucide-icon")
          .count(),
        1,
        "every shared dropdown uses the same SVG chevron",
      );
    }
    for (const label of ["HTTP method", "Response mode"]) {
      const alignment = await page
        .getByLabel(label, { exact: true })
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            left: style.paddingLeft,
            right: style.paddingRight,
            justify: style.justifyContent,
            align: style.alignItems,
          };
        });
      assert.equal(
        alignment.left,
        alignment.right,
        "balanced padding centers the value in the whole field",
      );
      assert.equal(alignment.justify, "center");
      assert.equal(alignment.align, "center");
      assert.equal(
        await page
          .getByLabel(label, { exact: true })
          .evaluate((el) => getComputedStyle(el).appearance),
        "base-select",
        "SVG-arrow select preserves the shared themed picker",
      );
      assert.equal(
        await page
          .getByLabel(label, { exact: true })
          .evaluate((el) => getComputedStyle(el).textAlign),
        "center",
      );
    }
    for (const control of [
      page.getByLabel("HTTP method", { exact: true }),
      page.getByRole("button", { name: "Send", exact: true }),
    ]) {
      await page.mouse.move(0, 0);
      const before = await control.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      await control.hover({ position: { x: 3, y: 3 } });
      await page.waitForTimeout(160);
      const after = await control.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      assert.notEqual(
        after,
        before,
        "hover in the padded corner changes the full control surface",
      );
    }
    await page.getByLabel("HTTP method", { exact: true }).selectOption("POST");
    await page.getByLabel("Response mode", { exact: true }).selectOption("sse");
    await page
      .getByLabel("Response mode", { exact: true })
      .selectOption("http");
    await page.getByLabel("HTTP method", { exact: true }).selectOption("GET");
    assert.equal(
      await page
        .locator(".activity-bar svg")
        .evaluateAll(
          (icons) =>
            icons.length > 0 &&
            icons.every((icon) => icon.classList.contains("lucide-icon")),
        ),
      true,
      "navigation icons come from Lucide",
    );
    await exerciseSplit(page, "Collection sidebar size");
    await exerciseSplit(page, "Request and response size");
    const sidebar = page.getByRole("separator", {
      name: "Collection sidebar size",
    });
    await sidebar.press("Shift+ArrowLeft");
    const saved = await sidebar.getAttribute("aria-valuenow");
    await page.reload();
    await sidebar.waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Edit request name", exact: true })
        .innerText(),
      "Renamed request",
      "Edited request name persists across reload",
    );
    await page.waitForFunction(
      (value) =>
        document
          .querySelector('[aria-label="Collection sidebar size"]')
          ?.getAttribute("aria-valuenow") === value,
      saved,
    );
    await sidebar.press("Enter");
    await page.getByRole("button", { name: "API Design", exact: true }).click();
    await page
      .getByRole("button", { name: "New document", exact: true })
      .click();
    await exerciseSplit(page, "API source and preview size");
    await exerciseWorkspaceEditorContent(page, output, "api");
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    await page
      .getByRole("button", { name: "New Test Suite", exact: true })
      .click();
    await exerciseSplit(page, "Test editor and results size");
    await exerciseWorkspaceEditorContent(page, output, "tests");
    await exerciseRunnerResults(page, output);
    await page
      .getByRole("button", { name: "Collections", exact: true })
      .click();
    await page
      .getByLabel("Body type", { exact: true })
      .selectOption("application/graphql");
    await exerciseSplit(page, "GraphQL query and variables size");
    await exerciseGraphqlResponsiveSplit(page, output);
    const preferences = page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Preferences", exact: true });
    await preferences.click();
    const dialog = page.getByRole("region", {
      name: "Preferences",
      exact: true,
    });
    await dialog.waitFor();
    const theme = dialog.getByRole("combobox", { name: "Theme", exact: true });
    assert.equal(
      await theme.evaluate((el) => getComputedStyle(el).appearance),
      "base-select",
    );
    await theme.click();
    await page.screenshot({ path: output + "/dropdown-dark.png" });
    await page.keyboard.press("Escape");
    assert.equal(
      await dialog.count(),
      1,
      "Escape closes dropdown before leaving Preferences",
    );
    await theme.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      "light",
      "dropdown supports keyboard selection",
    );
    await theme.click();
    await page.screenshot({ path: output + "/dropdown-light.png" });
    await page.keyboard.press("Escape");
    await theme.selectOption("dark");
    await dialog.getByRole("tab", { name: "Requests", exact: true }).click();
    const timeout = dialog.getByRole("spinbutton", {
      name: "Request timeout (ms)",
      exact: true,
    });
    assert.ok((await timeout.getAttribute("class"))?.includes("ui-input"));
    await timeout.fill("4321");
    await timeout.press("Tab");
    await page.screenshot({ path: output + "/shared-settings.png" });
    await dialog.getByRole("button", { name: "Close Preferences" }).click();
    await dialog.waitFor({ state: "detached" });
    await preferences.click();
    assert.equal(
      await timeout.inputValue(),
      "4321",
      "shared numeric input persists its value",
    );
    await dialog.getByRole("button", { name: "Close Preferences" }).click();
    await page.keyboard.press("Control+Shift+G");
    await page
      .getByRole("region", { name: "Source Control", exact: true })
      .waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: "Git", exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    await page
      .getByText(
        "Open the desktop app to track changes, stage resources and commit to your local repository.",
      )
      .waitFor();
    await page.screenshot({ path: output + "/git-preview.png" });
    await page
      .getByRole("button", { name: "Close Source Control", exact: true })
      .click();
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      const panels = await page.getByRole("tabpanel").evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            id: element.id,
            width: bounds.width,
            height: bounds.height,
            right: bounds.right,
            bottom: bounds.bottom,
            tabindex: element.getAttribute("tabindex"),
          };
        }),
      );
      assert.ok(panels.length > 0, "Application renders shared tab panels");
      for (const panel of panels) {
        assert.equal(panel.tabindex, "0", panel.id);
        assert.ok(panel.width > 0 && panel.height > 0, panel.id);
        assert.ok(panel.right <= width + 1 && panel.bottom <= 961, panel.id);
      }
      await Bun.write(
        output + "/tab-panels-" + width + ".json",
        JSON.stringify(panels, null, 2),
      );
      assert.equal(
        await page
          .locator(".app-shell")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        true,
      );
      await page.screenshot({ path: output + "/panels-" + width + ".png" });
    }
    await exerciseSplitCollapse(page, output);
    await exerciseSplitRelease(page, output);
    await exerciseSplitStorage(page, output);
    await assertRequestResponseSplit(page, output);
    assert.deepEqual(errors, []);
    await Bun.write(
      output + "/result.json",
      JSON.stringify({
        status: "passed",
        checks: [
          "split pointer and keyboard bounds/reset",
          "saved sizes after reload",
          "API, tests and GraphQL panels",
          "modal Escape and focus restoration",
          "custom dropdown dark/light picker and keyboard selection",
          "SVG arrows on every shared dropdown",
          "balanced method/protocol padding and centered flex alignment",
          "full surface hover from padded corners",
          "shared numeric input persistence",
          "Git left tab and preview empty state",
          "1440/900/760 widths",
          "shared tab panel focus targets and bounded layout",
        ],
      }),
    );
  },
  { buildRoot: process.env.INSOMNIUM_UI_PREVIEW_BUILD,beforeNavigate:async page=>{if(tabsOnly)await page.addInitScript(data=>{if(!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(data));},tabData);},fetch:async request=>{const url=new URL(request.url);if(tabsOnly&&url.pathname==='/owned-delete-held'){heldDelete.entered=true;request.signal.addEventListener('abort',()=>{heldDelete.aborted=true;});await new Promise(resolve=>{heldDelete.release=()=>resolve(undefined);});heldDelete.completed=true;return new Response('retired response');}if(nestedNetwork&&url.pathname==='/runner-nested-owned'){runnerNetwork.requests.push(url.pathname);runnerNetwork.labels.push(request.headers.get('x-runner-env'));if(runnerNetwork.requests.length===1){request.signal.addEventListener('abort',()=>{runnerNetwork.aborted=true;});await new Promise(resolve=>{runnerNetwork.release=()=>resolve(undefined);});runnerNetwork.finished=true;}return new Response('nested owned response',{headers:{'content-type':'text/plain'}});}} },
);
