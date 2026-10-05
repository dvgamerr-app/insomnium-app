<script>
  import { onMount } from "svelte";
  import { attachGraphqlHover } from "../editor-hover.js";
  import { loadEditorKeymap } from "../editor-keymaps.js";
  import { environmentPaths, environmentHints } from "../editor-completion.js";
  import {
    editorMode,
    saveEditorState,
    takeEditorState,
  } from "../editor-state.js";
  /** @type {{identity:string,value?:string,mode?:string,label?:string,placeholder?:string,readOnly?:boolean,maxBytes?:number,onlimit?:()=>void,settings?:Record<string,any>,environment?:Record<string,any>,schema?:import('graphql').GraphQLSchema|null,variableToType?:Record<string,import('graphql').GraphQLInputType>,onnavigate?:(reference:any)=>void,onchange?:(value:string)=>void}} */
  let {
    identity,
    value = "",
    mode = "text/plain",
    label = "Code editor",
    placeholder = "",
    readOnly = false,
    maxBytes = 0,
    onlimit = () => {},
    settings = {},
    environment,
    schema = null,
    variableToType,
    onnavigate,
    onchange = () => {},
  } = $props();
  let textarea = $state(
    /** @type {HTMLTextAreaElement|undefined} */ (undefined),
  );
  let host = $state(/** @type {HTMLDivElement|undefined} */ (undefined));
  let cm = $state(
    /** @type {import('codemirror').EditorFromTextArea|undefined} */ (
      undefined
    ),
  );
  let failure = $state("");
  let active = "";
  let synchronizing = false;
  export function focus() {
    if (cm) cm.focus();
    else textarea?.focus();
  }
  export function setSelectionRange(
    /** @type {number} */ start,
    /** @type {number} */ end,
  ) {
    if (cm) {
      cm.setSelection(cm.posFromIndex(start), cm.posFromIndex(end));
      cm.scrollIntoView(cm.posFromIndex(start), 40);
    } else textarea?.setSelectionRange(start, end);
  }
  /** @type {ReturnType<typeof attachGraphqlHover>|undefined} */ let hover;
  const paths = $derived(environment ? environmentPaths(environment) : []);
  const pathKey = $derived(paths.join("\n"));
  /** @type {any} */ let pass;
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let hintTimer;
  function complete(force = false) {
    if (!cm || readOnly || !cm.hasFocus()) return;
    cm.showHint({
      completeSingle: false,
      hint: (/** @type {import('codemirror').Editor} */ editor) => {
        const cursor = editor.getCursor();
        const hints = environmentHints(
          editor.getLine(cursor.line),
          cursor.ch,
          paths,
          force && !editorMode(mode).startsWith("graphql"),
        );
        return hints
          ? {
              ...hints,
              from: { line: cursor.line, ch: hints.from },
              to: { line: cursor.line, ch: hints.to },
            }
          : (editorMode(mode) === "graphql" && schema) ||
              mode === "graphql-variables"
            ? /** @type {any} */ (editor).getHelper(cursor, "hint")?.(editor, {
                schema,
                variableToType,
              })
            : undefined;
      },
      extraKeys: {
        Tab: (editor) => {
          editor.closeHint();
          return pass;
        },
      },
    });
  }
  function remember() {
    if (!cm || !active) return;
    saveEditorState(active, {
      text: cm.getValue(),
      history: cm.getHistory(),
      selections: cm.listSelections(),
      scroll: cm.getScrollInfo(),
    });
  }
  // The upstream variables linter assumes an object AST and throws on a valid
  // JSON scalar/list. Keep diagnostics usable while the user repairs the body.
  function lintText(
    /** @type {string} */ text,
    /** @type {any} */ options,
    /** @type {any} */ editor,
  ) {
    try {
      if (mode === "graphql-variables") {
        try {
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return [
              {
                message: "GraphQL variables must be a JSON object.",
                severity: "error",
                from: { line: 0, ch: 0 },
                to: editor.posFromIndex(text.length),
              },
            ];
        } catch {
          /* The upstream JSON parser supplies syntax locations. */
        }
      }
      return (
        editor.getHelper({ line: 0, ch: 0 }, "lint")?.(text, options, editor) ||
        []
      );
    } catch (error) {
      return [
        {
          message: String(error),
          severity: "error",
          from: { line: 0, ch: 0 },
          to: { line: 0, ch: 1 },
        },
      ];
    }
  }
  onMount(() => {
    let disposed = false;
    /** @type {ResizeObserver|undefined} */ let observer;
    import("../editor-engine.js")
      .then(({ default: CodeMirror }) => {
        if (disposed || !textarea || !host) return;
        pass = CodeMirror.Pass;
        const editor = CodeMirror.fromTextArea(textarea, {
          value,
          mode: editorMode(mode),
          lineNumbers: true,
          foldGutter: true,
          gutters: [
            "CodeMirror-lint-markers",
            "CodeMirror-linenumbers",
            "CodeMirror-foldgutter",
          ],
          matchBrackets: true,
          autoCloseBrackets: true,
          styleActiveLine: true,
          viewportMargin: 30,
          undoDepth: 100,
          inputStyle: "textarea",
          screenReaderLabel: label,
          extraKeys: {
            "Ctrl-Space": () => complete(true),
            "Ctrl-F": "findPersistent",
            "Cmd-F": "findPersistent",
            "Ctrl-Q": "foldCode",
            "Ctrl-/": "toggleComment",
            "Cmd-/": "toggleComment",
            "Shift-Ctrl--": "foldAll",
            "Shift-Cmd--": "foldAll",
            "Shift-Ctrl-=": "unfoldAll",
            "Shift-Cmd-=": "unfoldAll",
            "Shift-Tab": "indentLess",
            Tab: (editor) => {
              if (editor.somethingSelected()) editor.indentSelection("add");
              else
                editor.replaceSelection(
                  editor.getOption("indentWithTabs")
                    ? "\t"
                    : " ".repeat(editor.getOption("indentUnit") || 4),
                  "end",
                  "+input",
                );
            },
          },
        });
        editor.on("beforeChange", (instance, change) => {
          if (!maxBytes || synchronizing) return;
          const old = instance.getValue();
          const next =
            old.slice(0, instance.indexFromPos(change.from)) +
            change.text.join("\n") +
            old.slice(instance.indexFromPos(change.to));
          if (new TextEncoder().encode(next).byteLength > maxBytes) {
            change.cancel();
            onlimit();
          }
        });
        editor.on("change", () => {
          if (!synchronizing) onchange(editor.getValue());
        });
        editor.on("inputRead", () => {
          clearTimeout(hintTimer);
          if (!readOnly && Number(settings.autocompleteDelay ?? 150) > 0)
            hintTimer = setTimeout(
              () => complete(),
              Math.min(2000, Number(settings.autocompleteDelay ?? 150)),
            );
        });
        cm = editor;
        hover = attachGraphqlHover(editor, () =>
          mode === "graphql" && schema ? { schema, onClick: onnavigate } : null,
        );
        observer = new ResizeObserver(() => editor.refresh());
        observer.observe(host);
      })
      .catch((error) => {
        if (!disposed) failure = String(error);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      hover?.destroy();
      clearTimeout(hintTimer);
      cm?.closeHint();
      cm?.setOption("lint", false);
      cm?.setOption("keyMap", "default");
      if (cm) /** @type {any} */ (cm).setOption("jump", false);
      remember();
      cm?.toTextArea();
      cm = undefined;
    };
  });
  $effect(() => {
    if (!cm) return;
    synchronizing = true;
    try {
      if (active !== identity) {
        clearTimeout(hintTimer);
        cm.closeHint();
        remember();
        active = identity;
        cm.setValue(value);
        cm.clearHistory();
        const saved = takeEditorState(identity);
        if (saved?.text === value) {
          cm.setHistory(saved.history);
          cm.setSelections(saved.selections);
          cm.scrollTo(saved.scroll.left, saved.scroll.top);
        } else {
          cm.setCursor(0, 0);
          cm.scrollTo(0, 0);
        }
      } else if (cm.getValue() !== value) {
        cm.replaceRange(
          value,
          { line: 0, ch: 0 },
          cm.posFromIndex(cm.getValue().length),
          "external",
        );
      }
      cm.setOption("mode", editorMode(mode));
      cm.setOption(
        "lint",
        editorMode(mode).startsWith("graphql") &&
          !readOnly &&
          value.length < 1000000 &&
          !value.includes("{{") &&
          !value.includes("{%")
          ? /** @type {any} */ ({
              schema,
              variableToType,
              delay: 500,
              getAnnotations: lintText,
            })
          : false,
      );
      cm.setOption("readOnly", readOnly);
      cm.setOption("placeholder", placeholder);
      cm.setOption("screenReaderLabel", label);
      cm.setOption("lineWrapping", settings.editorLineWrapping ?? true);
      const indent = Math.max(
        1,
        Math.min(16, Number(settings.editorIndentSize) || 4),
      );
      cm.setOption("indentUnit", indent);
      cm.setOption("tabSize", indent);
      cm.setOption(
        "indentWithTabs",
        !!settings.editorIndentWithTabs &&
          !mode.includes("yaml") &&
          mode !== "openapi",
      );
    } finally {
      synchronizing = false;
    }
  });
  $effect(() => {
    const editor = cm;
    const name =
      !readOnly && ["vim", "emacs", "sublime"].includes(settings.editorKeyMap)
        ? settings.editorKeyMap
        : "default";
    if (!editor) return;
    let cancelled = false;
    editor.setOption("keyMap", "default");
    if (name !== "default")
      void loadEditorKeymap(name)
        .then(() => {
          if (!cancelled) editor.setOption("keyMap", name);
        })
        .catch((error) => {
          if (!cancelled) failure = `Keymap unavailable: ${error}`;
        });
    return () => {
      cancelled = true;
    };
  });
  $effect(() => {
    pathKey;
    schema;
    variableToType;
    identity;
    mode;
    hover?.close();
    if (cm) cm.closeHint();
  });
  $effect(() => {
    if (cm)
      /** @type {any} */ (cm).setOption(
        "jump",
        mode === "graphql" && schema && onnavigate
          ? { schema, onClick: onnavigate }
          : false,
      );
  });
</script>

<div class="shared-code-editor" bind:this={host}>
  {#if failure}<p class="inline-error">Editor unavailable: {failure}</p>{/if}
  <textarea
    bind:this={textarea}
    aria-label={label}
    {value}
    {placeholder}
    readonly={readOnly}
    spellcheck="false"
    oninput={(event) => {
      if (
        maxBytes &&
        new TextEncoder().encode(event.currentTarget.value).byteLength >
          maxBytes
      ) {
        event.currentTarget.value = value;
        onlimit();
      } else onchange(event.currentTarget.value);
    }}></textarea>
</div>

<style>
  :global(.graphql-editor-info) {
    position: fixed;
    z-index: 1000;
    max-width: 420px;
    max-height: 45vh;
    overflow: auto;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--raised);
    color: var(--text);
    box-shadow: 0 4px 18px #0005;
    font-size: 12px;
    white-space: pre-wrap;
  }
  :global(.graphql-editor-info a) {
    color: var(--accent-text);
    cursor: pointer;
  }
  :global(.graphql-editor-info .type-name-pill) {
    margin-left: 8px;
  }
  :global(.graphql-editor-info .info-description),
  :global(.graphql-editor-info .info-deprecation) {
    margin-top: 8px;
  }
  :global(body .CodeMirror-lint-tooltip) {
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font: 12px/1.6 var(--font-mono);
    padding: 8px 12px;
    box-shadow: 0 4px 18px #0005;
    max-width: min(600px, calc(100vw - 24px));
  }
  :global(body .CodeMirror-hints) {
    font-family: var(--font-mono);
    background: var(--raised);
    border-color: var(--line);
    color: var(--text);
    max-width: 480px;
  }
  :global(body .CodeMirror-hint) {
    color: var(--text);
  }
  :global(body li.CodeMirror-hint-active) {
    background: var(--selected);
    color: var(--text);
  }
  .shared-code-editor {
    position: relative;
    flex: 1;
    min-height: 180px;
    min-width: 0;
    background: var(--bg);
  }
  textarea {
    width: 100%;
    height: 100%;
    min-height: 180px;
    resize: vertical;
    font-family: var(--font-mono);
  }
  .shared-code-editor :global(.CodeMirror) {
    height: 100%;
    min-height: 180px;
    background: var(--bg);
    color: var(--text);
    font: 12px/1.6 var(--font-mono);
  }
  .shared-code-editor :global(.CodeMirror-gutters) {
    background: var(--bg);
    border: 0;
  }
  .shared-code-editor :global(.CodeMirror-linenumber) {
    color: var(--faint);
  }
  .shared-code-editor :global(.CodeMirror-cursor) {
    border-left-color: var(--text);
  }
  .shared-code-editor :global(.CodeMirror-selected),
  .shared-code-editor :global(.CodeMirror-focused .CodeMirror-selected) {
    background: var(--selected);
  }
  .shared-code-editor :global(.CodeMirror-activeline-background) {
    background: var(--hover);
  }
  .shared-code-editor :global(.cm-string),
  .shared-code-editor :global(.cm-string-2),
  .shared-code-editor :global(.cm-variable),
  .shared-code-editor :global(.cm-variable-2) {
    color: var(--syntax-variable);
  }
  .shared-code-editor :global(.cm-property),
  .shared-code-editor :global(.cm-tag),
  .shared-code-editor :global(.cm-def),
  .shared-code-editor :global(.cm-attribute) {
    color: var(--syntax-name);
  }
  .shared-code-editor :global(.cm-number),
  .shared-code-editor :global(.cm-atom) {
    color: var(--syntax-constant);
  }
  .shared-code-editor :global(.cm-keyword) {
    color: var(--syntax-keyword);
  }
  .shared-code-editor :global(.cm-comment),
  .shared-code-editor :global(.cm-meta),
  .shared-code-editor :global(.cm-bracket),
  .shared-code-editor :global(.cm-qualifier) {
    color: var(--syntax-meta);
  }
  .shared-code-editor :global(.cm-operator) {
    color: var(--syntax-operator);
  }
  .shared-code-editor :global(.cm-type),
  .shared-code-editor :global(.cm-variable-3) {
    color: var(--syntax-type);
  }
  .shared-code-editor :global(.cm-builtin) {
    color: var(--syntax-process);
  }
  .shared-code-editor :global(.cm-link),
  .shared-code-editor :global(.cm-header) {
    color: var(--syntax-link);
  }
  .shared-code-editor :global(.cm-error),
  .shared-code-editor :global(.CodeMirror-nonmatchingbracket) {
    color: var(--danger);
  }
  .shared-code-editor :global(.CodeMirror-matchingbracket) {
    color: var(--text);
    background: var(--selected);
    text-decoration: underline;
  }
  .shared-code-editor :global(.CodeMirror-dialog) {
    background: var(--panel);
    color: var(--text);
    border-color: var(--line);
  }
</style>
