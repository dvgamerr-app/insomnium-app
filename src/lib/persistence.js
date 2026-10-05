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
    value = raw ? JSON.parse(raw) : null;
  }
  if (value == null) return null;
  const data = validateData(value);
  validateTopology(data.resources);
  return data;
}
/** Serialize detached saves and reject writes during a transition. @param {unknown} data */
export function saveData(data) {
  return queue.save(data);
}
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
