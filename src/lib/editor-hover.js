/** Use the official GraphQL info renderer with explicitly owned popup lifetime.
 * The upstream info option leaves document listeners/popups outside its disable path.
 * @param {any} editor @param {()=>any} options
 */
export function attachGraphqlHover(editor, options) {
  const wrapper = editor.getWrapperElement();
  /** @type {HTMLElement|undefined} */ let popup;
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let pending;
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let hiding;
  function close() {
    clearTimeout(pending);
    clearTimeout(hiding);
    popup?.remove();
    popup = undefined;
  }
  function leave() {
    clearTimeout(pending);
    hiding = setTimeout(close, 200);
  }
  function over(/** @type {MouseEvent} */ event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.nodeName !== "SPAN") return;
    const settings = options();
    if (!settings) return;
    close();
    pending = setTimeout(() => {
      if (!target.isConnected || !options()) return;
      const box = target.getBoundingClientRect();
      const position = editor.coordsChar(
        { left: (box.left + box.right) / 2, top: (box.top + box.bottom) / 2 },
        "window",
      );
      const info = editor.getHelper(position, "info")?.(
        editor.getTokenAt(position, true),
        options(),
      );
      if (!info) return;
      popup = document.createElement("div");
      popup.className = "graphql-editor-info";
      popup.setAttribute("role", "dialog");
      popup.setAttribute("aria-label", "GraphQL schema information");
      popup.append(info);
      document.body.append(popup);
      // The official renderer prevents navigation; use a CSP-safe URL as well.
      for (const link of popup.querySelectorAll("a"))
        link.setAttribute("href", "#");
      popup.style.left =
        Math.max(
          4,
          Math.min(box.left, window.innerWidth - popup.offsetWidth - 8),
        ) + "px";
      popup.style.top =
        Math.max(
          4,
          Math.min(box.bottom, window.innerHeight - popup.offsetHeight - 8),
        ) + "px";
      popup.onmouseenter = () => clearTimeout(hiding);
      popup.onmouseleave = leave;
    }, 500);
  }
  function keyboard(/** @type {KeyboardEvent} */ event) {
    if (event.key === "Escape") close();
  }
  wrapper.addEventListener("mouseover", over);
  wrapper.addEventListener("mouseleave", leave);
  document.addEventListener("keydown", keyboard);
  editor.on("change", close);
  editor.on("scroll", close);
  return {
    close,
    destroy() {
      close();
      wrapper.removeEventListener("mouseover", over);
      wrapper.removeEventListener("mouseleave", leave);
      document.removeEventListener("keydown", keyboard);
      editor.off("change", close);
      editor.off("scroll", close);
    },
  };
}
