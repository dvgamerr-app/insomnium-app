import { mount } from "svelte";
import { initialData } from "../../../src/lib/model.js";
import "../../../src/lib/styles/index.css";

const owner = /** @type {any} */ (window);
const data = initialData();
const fixture = {
  calls: /** @type {{command:string,args:any}[]} */ ([]),
  restored: false,
  saves: 0,
  saved: /** @type {any} */ (null),
  failNextLoad: false,
  loaded: /** @type {any} */ (null),
};
owner.workspaceRecoveryFixture = fixture;
owner.isTauri = true;
owner.__TAURI_INTERNALS__ = {
  async invoke(/** @type {string} */ command, /** @type {any} */ args = {}) {
    fixture.calls.push({ command, args });
    if (command === "load_workspace") {
      if (fixture.failNextLoad) {
        fixture.failNextLoad = false;
        return new Promise((_, reject) => {
          owner.failPendingWorkspaceLoad = () => reject(new Error("Controlled reload failure"));
        });
      }
      if (!fixture.restored) throw new Error("Controlled damaged workspace");
      return structuredClone(fixture.loaded || data);
    }
    if (command === "inspect_workspace_backup")
      return {
        data: structuredClone(data),
        primarySha256: "a".repeat(64),
        backupSha256: "b".repeat(64),
      };
    if (command === "restore_workspace_backup") {
      fixture.restored = true;
      return "/owned/workspace-v1.damaged-fixture.json";
    }
    if (command === "save_workspace") {
      fixture.saves++;
      if (fixture.saves === 1) throw new Error("Controlled save failure");
      fixture.saved = structuredClone(args.data);
      return;
    }
    throw new Error("Unexpected recovery fixture IPC: " + command);
  },
};
void import("./workspace-recovery.svelte")
  .then(({ default: Fixture }) => {
    mount(Fixture, { target: document.body });
    owner.workspaceRecoveryFixtureReady = true;
  })
  .catch((error) => {
    owner.workspaceRecoveryFixtureError = String(error);
  });
