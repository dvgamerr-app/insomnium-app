import {isTauri} from "@tauri-apps/api/core";
import {openUrl} from "@tauri-apps/plugin-opener";

// The archived clickable overlay's HTTP(S) grammar, shared by paint and hit-test.
export const responseLinkPattern = /^(http|https):\/\/[\wàâäèéêëîïôóœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ\-_.]+[/\wàâäèéêëîïôóœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ.\-+=:\][@%^*&!#?;$~'(),]*/;

/** @param {string} line @param {number} ch */
export function responseLinkAt(line, ch) {
  const starts = /https?:\/\//g;
  for (let start; (start = starts.exec(line));) {
    const match = line.slice(start.index).match(responseLinkPattern);
    if (!match) continue;
    const end = start.index + match[0].length;
    if (ch >= start.index && ch < end) return match[0];
    starts.lastIndex = end;
  }
  return null;
}

/** @param {string} value @param {boolean} [xml] */
export function responseLinkUrl(value, xml = false) {
  // Match the archived XML viewer's single-pass entity replacement.
  const entities = {"&amp;":"&", "&quot;":'"', "&lt;":"<", "&gt;":">"};
  const text = xml ? value.replace(/&amp;|&quot;|&lt;|&gt;/g, entity => entities[/** @type {keyof typeof entities} */ (entity)]) : value;
  if (text.length > 8192 || /[\x00-\x20\x7f]/.test(text)) throw new Error("Invalid response link");
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) throw new Error("Only HTTP(S) response links can be opened");
  return text;
}

/** Opens only on an explicit viewer gesture; never during tokenization.
 * @param {string} value @param {boolean} [xml] */
export async function openResponseLink(value, xml = false) {
  const url = responseLinkUrl(value, xml);
  if (isTauri()) await openUrl(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** @param {import('codemirror').Editor} editor
 * @param {(url:string)=>void|Promise<void>} open
 * @param {(error:unknown)=>void} error */
export function attachResponseLinks(editor, open, error) {
  let live = true;
  let pressed = false;
  let moved = false;
  const wrapper = editor.getWrapperElement();
  const overlay = {
    /** @param {import('codemirror').StringStream} stream */
    token(stream) {
      if (stream.match(responseLinkPattern, true)) return "response-link";
      while (stream.next() != null) if (stream.match(responseLinkPattern, false)) break;
      return null;
    },
  };
  editor.addOverlay(overlay);
  /** @param {string|null} url */
  function activate(url) {
    if (!live || !url) return;
    try { Promise.resolve(open(url)).catch(reason => { if (live) error(reason); }); }
    catch (reason) { if (live) error(reason); }
  }
  /** @param {MouseEvent} event */
  const down = event => { pressed = event.button === 0; moved = false; };
  const move = () => { if (pressed) moved = true; };
  /** @param {MouseEvent} event */
  const up = event => {
    const click = pressed && !moved && event.button === 0 && !editor.somethingSelected();
    pressed = false;
    if (!click || !(event.target instanceof Element) || !event.target.closest(".cm-response-link")) return;
    const pos = editor.coordsChar({left:event.clientX, top:event.clientY}, "window");
    const line = editor.getLine(pos.line);
    activate(responseLinkAt(line, pos.ch) ?? responseLinkAt(line, Math.max(0, pos.ch - 1)));
  };
  /** @param {KeyboardEvent} event */
  const key = event => {
    if (event.defaultPrevented || event.isComposing || event.repeat || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.key !== "Enter" || editor.somethingSelected()) return;
    const pos = editor.getCursor();
    const url = responseLinkAt(editor.getLine(pos.line), pos.ch);
    if (url) { event.preventDefault(); event.stopPropagation(); activate(url); }
  };
  wrapper.addEventListener("mousedown", down);
  wrapper.addEventListener("mousemove", move);
  wrapper.addEventListener("mouseup", up);
  wrapper.addEventListener("keydown", key, true);
  const release = () => { pressed = false; };
  window.addEventListener("mouseup", release);
  window.addEventListener("blur", release);
  return () => {
    live = false;
    editor.removeOverlay(overlay);
    wrapper.removeEventListener("mousedown", down);
    wrapper.removeEventListener("mousemove", move);
    wrapper.removeEventListener("mouseup", up);
    wrapper.removeEventListener("keydown", key, true);
    window.removeEventListener("mouseup", release);
    window.removeEventListener("blur", release);
  };
}
