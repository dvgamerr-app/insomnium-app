import { createPersistenceQueue } from "./persistence-queue.js";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { validateData } from "./model.js";
import { validateTopology } from "./resources.js";

const key = "insomnium-tauri-preview-v1";
const queue = createPersistenceQueue(async (snapshot) => {
  if (isTauri()) await invoke("save_workspace", { data: snapshot });
  else localStorage.setItem(key, JSON.stringify(snapshot));
});
export async function loadData() {
  let value;
  if (isTauri()) {
    value = await invoke("load_workspace");
  } else {
    const raw = localStorage.getItem(key);
    value = raw === null ? null : JSON.parse(raw);
    if (raw !== null && value === null)
      throw new Error("Unsupported or damaged workspace data. The existing file has not been replaced.");
  }
  if (value == null) return null;
  const data = validateData(value);
  validateTopology(data.resources);
  return data;
}

/** Preview only: validate the backup through both model and topology guards. */
export async function inspectWorkspaceBackup() {
  if (!isTauri())
    throw new Error("Backup recovery is available in the desktop app.");
  const preview =
    /** @type {{data:unknown,primarySha256:string|null,backupSha256:string}} */ (
      await invoke("inspect_workspace_backup")
    );
  const data = validateData(preview.data);
  validateTopology(data.resources);
  return { ...preview, data };
}

/** @param {{primarySha256:string|null,backupSha256:string}} preview */
export async function restoreWorkspaceBackup(preview) {
  return invoke("restore_workspace_backup", {
    primarySha256: preview.primarySha256,
    backupSha256: preview.backupSha256,
  });
}
/** Serialize detached saves and reject writes during a transition. @param {unknown} data */
export function saveData(data) {
  return queue.save(data);
}
/** Await writes already admitted before native cookie-owner validation. */
export function flushData() { return queue.flush(); }
/** Caller must quiesce writers, then apply native result inside operation.
 * @template T @param {()=>Promise<T>} operation */
export function runWorkspaceTransition(operation) {
  return queue.exclusive(operation);
}
/** Apply validated recovered state inside operation before reopening saves.
 * @template T @param {()=>Promise<T>} operation */
export function recoverWorkspaceTransition(operation) {
  return queue.recover(operation);
}
export function workspacePersistencePhase() {
  return queue.phase;
}

/** Read-only phase subscription; no public setter can bypass recovery.
 * @param {(phase:import("./persistence-queue.js").PersistencePhase)=>void} listener */
export function subscribeWorkspacePersistence(listener) {
  return queue.subscribe(listener);
}
