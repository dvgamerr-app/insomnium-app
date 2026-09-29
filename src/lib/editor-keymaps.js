/** Optional legacy keymaps are loaded only when selected.
 * @param {string} name
 */
export function loadEditorKeymap(name) {
  switch (name) {
    case "vim":
      return import("codemirror/keymap/vim.js");
    case "emacs":
      return import("codemirror/keymap/emacs.js");
    case "sublime":
      return import("codemirror/keymap/sublime.js");
    default:
      return Promise.resolve();
  }
}
