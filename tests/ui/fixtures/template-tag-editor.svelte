<script>
  import { onMount } from "svelte";
  import CodeEditor from "../../../src/lib/components/CodeEditor.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import Input from "../../../src/lib/components/ui/Input.svelte";
  import Textarea from "../../../src/lib/components/ui/Textarea.svelte";
  import TemplateFieldDialogHost from "../../../src/lib/components/TemplateFieldDialogHost.svelte";
  import {
    builtinTagDefinitions,
    resolveBuiltinTag,
  } from "../../../src/lib/template-builtin-definitions.js";
  import { createPluginTagMetadata } from "../../../src/lib/plugin-tag-metadata.js";
  let value = $state('before {% base64 "encode", "normal", "hello" %} after');
  let editor = $state(/** @type {CodeEditor|undefined} */ (undefined));
  let changed = $state(0),
    closed = $state(0),
    queries = $state(0),
    previews = $state(0),
    actions = $state(0);
  let holdPreview = false;
  let heldPreviews = 0;
  /** @type {Record<string,any>[]} */ const events = [];
  /** @type {(()=>void)|undefined} */ let releasePreview;
  /** @type {AbortController|undefined} */ let activeController;
  const metadata = createPluginTagMetadata();
  const recipe = {
    name: "owned",
    displayName: "Owned",
    description: "Synthetic metadata fixture",
    deprecated: true,
    priority: 3,
    disablePreview: (/** @type {any[]} */ args) => args[2].value === true,
    args: [
      {
        type: "string",
        displayName: "Text",
        defaultValue: "hello",
        encoding: "base64",
        help: (/** @type {any[]} */ args) => "Value: " + args[0].value,
        validate: (/** @type {string} */ value) =>
          value === "bad" ? "Invalid text" : "",
      },
      { type: "number", displayName: "Number", defaultValue: -0 },
      { type: "boolean", displayName: "Mask", defaultValue: false },
      { type: "variable", displayName: "Variable" },
      {
        type: "expression",
        displayName: "Expression",
        hide: (/** @type {any[]} */ args) => args[2].value === true,
      },
      {
        type: "enum",
        displayName: "Choice",
        options: [
          { value: false, displayName: "False" },
          { value: 0, displayName: "Zero" },
        ],
      },
      {
        type: "file",
        displayName: "Path",
        itemTypes: ["file", "directory"],
        extensions: ["txt"],
      },
      { type: "model", displayName: "Request", model: "Request" },
    ],
    actions: [{ name: "Clear fixture", run: () => {} }],
    run: () => "",
  };
  const resources = [
    { _id: "wrk_fixture", _type: "workspace", name: "Fixture collection" },
    {
      _id: "fld_outer",
      _type: "request_group",
      parentId: "wrk_fixture",
      name: "Outer",
      metaSortKey: 1,
    },
    {
      _id: "fld_inner",
      _type: "request_group",
      parentId: "fld_outer",
      name: "Inner",
      metaSortKey: 1,
    },
    {
      _id: "req_owned",
      _type: "request",
      name: "Fixture request",
      method: "POST",
      parentId: "fld_inner",
      metaSortKey: 1,
    },
    {
      _id: "req_other",
      _type: "request",
      name: "Other request",
      method: "GET",
      parentId: "wrk_fixture",
      metaSortKey: 2,
    },
  ];
  function session() {
    events.push({ type: "open", value });
    const controller = new AbortController();
    activeController = controller;
    return {
      signal: controller.signal,
      definitions: [
        {
          ...metadata.inspect({
            name: "not callable",
            args: [],
            run: () => "",
          }),
          plugin: "Fixture",
        },
        { ...metadata.inspect(recipe), plugin: "Fixture" },
        ...builtinTagDefinitions(),
      ],
      resources,
      variables: ["env.value", "env.token"],
      isCurrent: () => !controller.signal.aborted,
      async queryMetadata(
        /** @type {string} */ name,
        /** @type {any[]} */ args,
        /** @type {{signal:AbortSignal,isCurrent:()=>boolean}} */ operation,
      ) {
        queries++;
        if (!operation.isCurrent() || operation.signal.aborted)
          throw new DOMException("stale", "AbortError");
        return name === "owned"
          ? { ...metadata.resolve(recipe, args[0], args[1]), plugin: "Fixture" }
          : resolveBuiltinTag(name, args[0], args[1]);
      },
      async renderPreview(
        /** @type {string} */ text,
        /** @type {{signal:AbortSignal,isCurrent:()=>boolean}} */ operation,
      ) {
        previews++;
        if (holdPreview) {
          heldPreviews++;
          await new Promise((resolve, reject) => {
            const abort = () =>
              reject(new DOMException("cancelled", "AbortError"));
            operation.signal.addEventListener("abort", abort, { once: true });
            releasePreview = () => {
              operation.signal.removeEventListener("abort", abort);
              resolve(undefined);
            };
          });
        }
        return "Controlled preview: " + text;
      },
      async choosePath(
        /** @type {'file'|'directory'} */ kind,
        /** @type {Record<string,any>} */ definition,
      ) {
        return kind === "file" && definition.extensions[0] === "txt"
          ? "C:\\selected.txt"
          : "C:\\folder";
      },
      async runAction(
        /** @type {string} */ name,
        /** @type {number} */ index,
        /** @type {{signal:AbortSignal,isCurrent:()=>boolean}} */ operation,
      ) {
        if (name !== "owned" || index !== 0 || !operation.isCurrent())
          throw Error("Unexpected action");
        actions++;
      },
      close() {
        events.push({
          type: "close",
          value,
          aborted: controller.signal.aborted,
        });
        if (!controller.signal.aborted) {
          closed++;
          controller.abort();
        }
      },
    };
  }
  onMount(() => {
    /** @type {any} */ (window).__tagEditorFixture = {
      state: () => ({
        value,
        changed,
        closed,
        queries,
        previews,
        actions,
        heldPreviews,
        events: structuredClone(events),
      }),
      hold: () => {
        holdPreview = true;
      },
      release: () => {
        holdPreview = false;
        releasePreview?.();
        releasePreview = undefined;
      },
      abort: () => activeController?.abort(),
      replace: (/** @type {string} */ next) => {
        value = next;
      },
    };
    return () => {
      delete (/** @type {any} */ (window).__tagEditorFixture);
    };
  });
</script>

<main style="padding:24px">
  <TemplateFieldDialogHost />
  <Input aria-label="Parent text" bind:value />
  <Input
    aria-label="Template field"
    {value}
    templateEditor={session}
    oninput={(event) => {
      value = event.currentTarget.value;
      changed++;
    }}
  />
  <Textarea
    aria-label="Template textarea"
    {value}
    templateEditor={session}
    oninput={(event) => {
      value = event.currentTarget.value;
      changed++;
    }}
  />
  <Button onclick={() => editor?.editTemplateTag()}>Template tag</Button>
  <div style="height:300px;margin-top:12px">
    <CodeEditor
      bind:this={editor}
      identity="tag-fixture"
      {value}
      label="Fixture code"
      mode="text/plain"
      templateEditor={session}
      onchange={(next) => {
        value = next;
        changed++;
      }}
    />
  </div>
  <output aria-label="Applied text">{value}</output><output aria-label="Changes"
    >{changed}</output
  ><output aria-label="Closed dialogs">{closed}</output>
</main>
