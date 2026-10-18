export const editorHistoryEvent = "insomnium-editor-history";

/** Use the focused editor's own undo stack; never replace its contents.
 * @param {"undo"|"redo"} action */
export function runEditorHistory(action) {
  if (action !== "undo" && action !== "redo") return false;
  const command = new CustomEvent(editorHistoryEvent, {
    detail: action,
    cancelable: true,
  });
  if (!window.dispatchEvent(command)) return true;
  const target = document.activeElement;
  const field =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  if (
    !(target instanceof HTMLElement) ||
    !(field || target.isContentEditable) ||
    (field && (target.disabled || target.readOnly)) ||
    typeof document.execCommand !== "function"
  )
    return false;
  const contents = () => (field ? target.value : target.innerHTML);
  const before = contents();
  let notified = false;
  const notice = () => {
    notified = true;
  };
  target.addEventListener("input", notice, { once: true });
  let handled;
  try {
    handled = document.execCommand(action);
  } finally {
    target.removeEventListener("input", notice);
  }
  // Some WebViews update the undo buffer without notifying form bindings.
  if (!notified && contents() !== before)
    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: action === "undo" ? "historyUndo" : "historyRedo",
      }),
    );
  return handled;
}
