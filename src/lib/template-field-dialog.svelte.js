import { untrack } from "svelte";
import { templateTagRange } from "./template-authoring.js";

/** @typedef {ReturnType<import('./template-editor-session.svelte.js').createTemplateEditorSession>} Session */
/** @typedef {{id:number,element:HTMLInputElement|HTMLTextAreaElement,value:unknown,source:string,start:number,end:number,session:Session,current:()=>boolean,abort:()=>void}} Frame */
export const templateFieldDialog = new (class {
  /** @type {Frame|null} */ current = $state.raw(null);
  error = $state("");
})();
let nextId = 0;

/** Close only the captured dialog; a late callback cannot close a newer one.
 * @param {Frame} frame @param {number} [cursor] */
export function closeTemplateField(frame, cursor = frame.end) {
  if (templateFieldDialog.current !== frame) return;
  templateFieldDialog.current = null;
  frame.session.signal.removeEventListener("abort", frame.abort);
  frame.session.close();
  queueMicrotask(() => {
    if (templateFieldDialog.current || !frame.element.isConnected) return;
    frame.element.focus();
    try {
      frame.element.setSelectionRange(cursor, cursor);
    } catch {
      /* email inputs have no selection API */
    }
  });
}

/** @param {Frame} frame @param {string} text */
export function applyTemplateField(frame, text) {
  if (templateFieldDialog.current !== frame || !frame.current()) {
    closeTemplateField(frame);
    return;
  }
  const value =
    frame.source.slice(0, frame.start) + text + frame.source.slice(frame.end);
  if (frame.element.maxLength >= 0 && value.length > frame.element.maxLength) {
    templateFieldDialog.error =
      "The template exceeds this field's length limit.";
    return;
  }
  frame.element.value = value;
  // Use the field's existing input pipeline, including its binding and caller.
  frame.element.dispatchEvent(new Event("input", { bubbles: true }));
  closeTemplateField(frame, frame.start + text.length);
}

/** @param {KeyboardEvent & {currentTarget:HTMLInputElement|HTMLTextAreaElement}} event
 * @param {(()=>Session)|undefined} factory @param {unknown} value */
export function templateFieldKeydown(event, factory, value) {
  if (
    !factory ||
    event.defaultPrevented ||
    !(event.ctrlKey || event.metaKey) ||
    !event.altKey ||
    event.code !== "Space"
  )
    return;
  const element = event.currentTarget;
  if (
    element.disabled ||
    element.readOnly ||
    (element instanceof HTMLInputElement &&
      !["text", "password", "search", "url", "email", "tel"].includes(
        element.type,
      ))
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  if (templateFieldDialog.current)
    closeTemplateField(templateFieldDialog.current);
  templateFieldDialog.error = "";
  try {
    const source = element.value;
    const range = templateTagRange(
      source,
      element.selectionStart ?? source.length,
      element.selectionEnd ?? source.length,
    );
    const session = factory();
    const frame = /** @type {Frame} */ ({
      id: ++nextId,
      element,
      value,
      source,
      start: range.start,
      end: range.end,
      session,
      current: () =>
        element.isConnected &&
        !element.disabled &&
        !element.readOnly &&
        element.value === source &&
        session.isCurrent(),
      abort: () => closeTemplateField(frame),
    });
    templateFieldDialog.current = frame;
    session.signal.addEventListener("abort", frame.abort, { once: true });
    if (session.signal.aborted || !frame.current()) closeTemplateField(frame);
  } catch (error) {
    templateFieldDialog.error =
      error instanceof Error ? error.message : String(error);
  }
}

/** Track native field ownership without subscribing every input to dialog state.
 * @param {HTMLInputElement|HTMLTextAreaElement} element
 * @param {{value:unknown,disabled?:boolean|null,readOnly?:boolean|null,factory?:()=>Session}} parameters */
export function templateField(element, parameters) {
  /** @param {typeof parameters} next */
  function update(next) {
    untrack(() => {
      const frame = templateFieldDialog.current;
      if (
        frame?.element === element &&
        (next.value !== frame.value ||
          next.disabled ||
          next.readOnly ||
          !next.factory ||
          !frame.current())
      )
        closeTemplateField(frame);
    });
  }
  update(parameters);
  return {
    update,
    destroy() {
      const frame = untrack(() => templateFieldDialog.current);
      if (frame?.element === element) closeTemplateField(frame);
    },
  };
}
