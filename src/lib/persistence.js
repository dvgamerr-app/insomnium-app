import { invoke, isTauri } from "@tauri-apps/api/core";
import { validateData } from "./model.js";
import { validateTopology } from "./resources.js";

const key = "insomnium-tauri-preview-v1";
let queue = Promise.resolve();
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
/** Serialize saves: slower disk writes must never overwrite a later edit. @param {unknown} data */
export function saveData(data) {
  const snapshot = JSON.parse(JSON.stringify(data));
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (isTauri()) {
        await invoke("save_workspace", { data: snapshot });
      } else {
        localStorage.setItem(key, JSON.stringify(snapshot));
      }
    });
  return queue;
}
