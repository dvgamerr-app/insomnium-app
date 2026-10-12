import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const addonUrl = new URL(
  "../node_modules/codemirror/addon/lint/lint.js",
  import.meta.url,
);
const moduleId = "\0insomnium:codemirror-lint-ownership";
export const lintInputSHA =
  "8d16a6b48b5b860807aaf7c329009d7a49f8078570263a6def773c61d2b353fb";

/** Pinned external source compiled normally, never evaluated at runtime.
 * @returns {Promise<string>} */
export async function createLintOwnershipSource() {
  const bytes = await readFile(addonUrl);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    lintInputSHA,
    "Review changed CodeMirror lint source before adopting it",
  );
  const pkg = JSON.parse(
    await readFile(
      new URL("../node_modules/codemirror/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(pkg.version, "5.65.21");
  let source = bytes.toString("utf8").replaceAll("\r\n", "\n");
  /** @param {string} before @param {string} after */
  function patch(before, after) {
    assert.equal(
      source.split(before).length,
      2,
      "Pinned patch anchor must be unique",
    );
    source = source.replace(before, after);
  }
  patch(
    '  var LINT_LINE_ID = "CodeMirror-lint-line-";',
    '  var LINT_LINE_ID = "CodeMirror-lint-line-";\n  var activeTooltips = new WeakMap();\n  var positionCleanup = new WeakMap();',
  );
  patch(
    '    CodeMirror.on(document, "mousemove", position);',
    '    CodeMirror.on(document, "mousemove", position);\n    positionCleanup.set(tt, function() { CodeMirror.off(document, "mousemove", position); });',
  );
  patch(
    "  function hideTooltip(tt) {\n    if (!tt.parentNode) return;",
    "  function hideTooltip(tt) {\n    var detachPosition = positionCleanup.get(tt);\n    if (detachPosition) { detachPosition(); positionCleanup.delete(tt); }\n    if (!tt.parentNode) return;",
  );
  patch(
    "  function showTooltipFor(cm, e, content, node) {\n    var tooltip = showTooltip(cm, e, content);",
    "  function showTooltipFor(cm, e, content, node) {\n    if (!cm.state.lint) return;\n    var previous = activeTooltips.get(cm);\n    if (previous) previous();\n    var tooltip = showTooltip(cm, e, content);",
  );
  patch(
    "      if (tooltip) { hideTooltip(tooltip); tooltip = null; }",
    "      if (tooltip) { hideTooltip(tooltip); tooltip = null; }\n      clearInterval(poll);\n      if (activeTooltips.get(cm) === hide) activeTooltips.delete(cm);",
  );
  patch(
    '    CodeMirror.on(node, "mouseout", hide);',
    '    activeTooltips.set(cm, hide);\n    CodeMirror.on(node, "mouseout", hide);',
  );
  patch(
    "  function clearMarks(cm) {\n    var state = cm.state.lint;",
    "  function clearMarks(cm) {\n    var previous = activeTooltips.get(cm);\n    if (previous) previous();\n    var state = cm.state.lint;",
  );
  const boundary = "})(function(CodeMirror) {\n";
  assert.equal(source.split(boundary).length, 2);
  assert.ok(source.trimEnd().endsWith("});"));
  const body = source
    .slice(source.indexOf(boundary) + boundary.length)
    .trimEnd()
    .slice(0, -3);
  const license = await readFile(
    new URL("../node_modules/codemirror/LICENSE", import.meta.url),
    "utf8",
  );
  return `/*! CodeMirror 5.65.21 lint addon; pinned input ${lintInputSHA}.\n${license}\nApp patch: one active tooltip per editor; deterministic listener/poll cleanup. */\nimport CodeMirror from "codemirror";\n(function(CodeMirror) {\n${body}\n})(CodeMirror);\n`;
}

/** @returns {import('vite').Plugin} */
export function codemirrorLintOwnership() {
  return {
    name: "insomnium-codemirror-lint-ownership",
    enforce: "pre",
    resolveId(id) {
      if (id === "codemirror/addon/lint/lint.js") return moduleId;
    },
    async load(id) {
      if (id === moduleId)
        return { code: await createLintOwnershipSource(), map: null };
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "codemirror-lint.LICENSE.txt",
        source: await readFile(
          new URL("../node_modules/codemirror/LICENSE", import.meta.url),
          "utf8",
        ),
      });
    },
  };
}

/** Same pinned bytes for saved Svelte fixtures built directly with Bun.
 * @param {import('bun').PluginBuilder} build */
export function registerLintOwnershipBuild(build) {
  const namespace = "insomnium-lint-ownership";
  build.onResolve({ filter: /^codemirror\/addon\/lint\/lint\.js$/ }, () => ({
    path: "lint",
    namespace,
  }));
  build.onResolve({ filter: /^codemirror$/, namespace }, () => ({
    path: Bun.resolveSync("codemirror", import.meta.dir),
  }));
  build.onLoad({ filter: /^lint$/, namespace }, async () => ({
    contents: await createLintOwnershipSource(),
    loader: "js",
  }));
}
