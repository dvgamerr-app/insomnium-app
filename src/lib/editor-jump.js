/** Own the jump gesture's listeners for exactly the current option/editor lifetime.
 * The installed codemirror-graphql helper still resolves the schema reference.
 * @param {typeof import('codemirror')} CodeMirror */
export function installGraphqlJump(CodeMirror) {
  CodeMirror.defineOption('jump', false, (editor, options) => {
    const cm = /** @type {any} */ (editor);
    cm.state.jump?.destroy?.();
    if (!options) return;
    const wrapper = cm.getWrapperElement();
    let retired = false;
    const state = /** @type {any} */ ({
      options, isHoldingModifier: false, cursor: null, marker: null,
      destination: null, destroy,
    });
    cm.state.jump = state;
    const modifier = navigator.userAgent.includes('Mac') ? 'Meta' : 'Control';
    function clearMarker() {
      state.marker?.clear();
      state.marker = null;
      state.destination = null;
    }
    function release() {
      state.isHoldingModifier = false;
      state.cursor = null;
      clearMarker();
    }
    function enable() {
      if (retired || state.marker || !state.cursor || !state.isHoldingModifier) return;
      const pos = cm.coordsChar(state.cursor);
      const token = cm.getTokenAt(pos, true);
      const resolve = options.getDestination || cm.getHelper(pos, 'jump');
      const destination = resolve?.(token, options, cm);
      if (!destination) return;
      state.destination = destination;
      state.marker = cm.markText(
        {line: pos.line, ch: token.start}, {line: pos.line, ch: token.end},
        {className: 'CodeMirror-jump-token'},
      );
    }
    /** @param {MouseEvent} event */
    function over(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.nodeName !== 'SPAN') return;
      const box = target.getBoundingClientRect();
      state.cursor = {left: (box.left + box.right) / 2, top: (box.top + box.bottom) / 2};
      enable();
    }
    function out() {
      state.cursor = null;
      clearMarker();
    }
    /** @param {KeyboardEvent} event */
    function down(event) {
      if (event.key !== modifier || state.isHoldingModifier) return;
      state.isHoldingModifier = true;
      enable();
    }
    /** @param {KeyboardEvent} event */
    function up(event) {
      if (event.key === modifier) release();
    }
    /** @param {MouseEvent} event */
    function click(event) {
      if (retired || !state.isHoldingModifier || !state.destination ||
          !(event.target instanceof Node) || !wrapper.contains(event.target)) return;
      options.onClick?.(state.destination, event);
    }
    /** @param {any} _editor @param {any} event */
    function mouseDown(_editor, event) {
      if (!retired && state.isHoldingModifier && state.destination) event.codemirrorIgnore = true;
    }
    function destroy() {
      if (retired) return;
      retired = true;
      release();
      wrapper.removeEventListener('mouseover', over);
      wrapper.removeEventListener('mouseout', out);
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
      document.removeEventListener('click', click);
      window.removeEventListener('blur', release);
      cm.off('mousedown', mouseDown);
      if (cm.state.jump === state) delete cm.state.jump;
    }
    wrapper.addEventListener('mouseover', over);
    wrapper.addEventListener('mouseout', out);
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    document.addEventListener('click', click);
    window.addEventListener('blur', release);
    cm.on('mousedown', mouseDown);
  });
}
