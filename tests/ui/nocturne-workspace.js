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
  "nocturne-workspace",
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
      await Bun.write(output+'/tabs.json',JSON.stringify({passed:true,duplicateTabsRemoved:true,nonRequestAndMissingTabsRemoved:true,stableOrder:true,closeActiveFallback:true,closeLastAndReloadEmpty:true,foreignTabsRetained:true,largeCollectionRequests:10000,rememberedLastRequest:true,authoredResourcesUnchanged:true,historyUnchanged:true},null,2));
      await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,focus:'saved request tabs'},null,2));return;
    }
    if (process.env.INSOMNIUM_RUNNER_NESTED_ONLY === "1") {
      await page.getByRole("button",{name:"Tests",exact:true}).click();
      await page.getByRole("button",{name:"New Test Suite",exact:true}).click();
      await page.getByRole("textbox",{name:"Test suite name",exact:true}).waitFor();
      await exerciseRunnerResults(page,output,true);
      await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,nestedSuiteLevels:3,scope:"Actual Runner UI/worker/VM/nested titles/request binding/results persistence and original result controls; no network/native"},null,2));
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
  { buildRoot: process.env.INSOMNIUM_UI_PREVIEW_BUILD,beforeNavigate:async page=>{if(tabsOnly)await page.addInitScript(data=>{if(!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(data));},tabData);} },
);
