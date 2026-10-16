import { isTauri } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/** Copy complete text through the host clipboard on desktop.
 * Browser previews retain the browser's permission and user-gesture behavior.
 * @param {string} text */
export async function copyText(text) {
  if (isTauri()) await writeText(text);
  else await navigator.clipboard.writeText(text);
}
