import {getCurrentWindow} from "@tauri-apps/api/window";
let pending = Promise.resolve();
/** Read platform state for each serialized toggle, including OS-initiated changes. */
export function toggleWindowFullscreen() {
  pending = pending.catch(() => {}).then(async () => {
    const window = getCurrentWindow();
    await window.setFullscreen(!(await window.isFullscreen()));
  });
  return pending;
}
