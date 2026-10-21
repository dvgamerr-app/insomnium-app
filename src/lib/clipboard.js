import { invoke, isTauri } from "@tauri-apps/api/core";

/** CF_UNICODETEXT terminates at NUL even when input contains more data.
 * @param {string} text */
export function validateNativeClipboardText(text){
  if (/Windows/i.test(navigator.userAgent) && text.includes("\0"))
    throw new Error("Windows clipboard text cannot contain NUL characters. Use Base64 or save the content to a file.");
}

/** Copy complete text through the host clipboard on desktop.
 * Browser previews retain the browser's permission and user-gesture behavior.
 * @param {string} text */
export async function copyText(text) {
  if (isTauri()) {
    validateNativeClipboardText(text);
    await invoke("write_clipboard_text", { text });
  }
  else await navigator.clipboard.writeText(text);
}
