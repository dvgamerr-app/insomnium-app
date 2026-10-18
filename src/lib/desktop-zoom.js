import {getCurrentWebview} from "@tauri-apps/api/webview";
/** @param {unknown} value */
export function windowZoom(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.25 && value <= 5 ? value : 1;
}
let pending = Promise.resolve();
let revision = 0;
/** Serialize platform calls and skip superseded queued values.
 * @param {number} value */
export function applyWindowZoom(value) {
  const own = ++revision;
  pending = pending.catch(() => {}).then(() => {
    if (own === revision) return getCurrentWebview().setZoom(windowZoom(value));
  });
  return pending;
}
