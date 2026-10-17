import { isTauri } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/** Copy complete text through the host clipboard on desktop.
 * Browser previews retain the browser's permission and user-gesture behavior.
 * @param {string} text */
export async function copyText(text) {
  if (isTauri()) {
    // CF_UNICODETEXT terminates at NUL, even when the input contains more data.
    if (/Windows/i.test(navigator.userAgent) && text.includes("\0"))
      throw new Error(
        "Windows cannot copy text containing NUL characters. Use Base64 for binary events or save the complete content to a file.",
      );
    await writeText(text);
  }
  else await navigator.clipboard.writeText(text);
}
