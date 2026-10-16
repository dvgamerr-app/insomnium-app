import { mount } from "svelte";
import { initialData } from "../../../src/lib/model.js";
import "../../../src/lib/styles/index.css";

const owner = /** @type {any} */ (window);
const data = initialData();
const collectionId = data.resources.find((r) => r._type === "workspace")?._id;
if (!collectionId) throw new Error("Fixture requires a collection");
data.resources.push(
  {_id:"runner_folder", _type:"request_group", parentId:collectionId, name:"Folder"},
  {_id:"runner_suite", _type:"unit_test_suite", parentId:"runner_folder", name:"Nested suite"},
  {_id:"runner_test", _type:"unit_test", parentId:"runner_suite", name:"Original test", requestId:null, code:"expect(true).to.equal(true);"},
  {_id:"runner_result", _type:"unit_test_result", parentId:collectionId, unitTestSuiteId:"runner_suite", results:{tests:[], stats:{passes:1}}},
);
owner.runnerManagement = { saved:null, saves:0 };
owner.isTauri = true;
owner.__TAURI_INTERNALS__ = {
  async invoke(/** @type {string} */ command, /** @type {any} */ args = {}) {
    if (command === "load_workspace") return structuredClone(data);
    if (command === "save_workspace") {
      owner.runnerManagement.saved = structuredClone(args.data);
      owner.runnerManagement.saves++;
      return;
    }
    throw new Error("Unexpected runner fixture IPC: " + command);
  },
};
try {
  const [{workspace, initialize}, {default: Sidebar}, {default: Pane}] = await Promise.all([
    import("../../../src/lib/workspace.svelte.js"),
    import("../../../src/lib/components/RunnerSidebar.svelte"),
    import("../../../src/lib/components/RunnerPane.svelte"),
  ]);
  await initialize();
  if (!workspace.ready) throw new Error(workspace.error);
  const sidebar = document.createElement("aside");
  const main = document.createElement("main");
  document.body.append(sidebar, main);
  mount(Sidebar, {target:sidebar, props:{collectionId}});
  mount(Pane, {target:main, props:{collectionId}});
  owner.runnerManagementReady = true;
} catch (error) {
  owner.runnerManagementError = String(error);
}
