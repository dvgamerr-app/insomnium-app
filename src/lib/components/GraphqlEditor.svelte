<script>
  import SplitPane from "./ui/SplitPane.svelte";
  import { untrack, onDestroy } from "svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import {
    graphqlVariableTypes,
    graphqlReferenceType,
    graphqlDirectiveText,
  } from "../graphql-editor.js";
  import { environmentFor } from "../model.js";
  import { printType } from "graphql";
  import {
    readGraphqlBody,
    formatQuery,
    parseQuery,
    readSchema,
    resolveQuery,
    validateQuery,
    schemaContext,
    schemaLimit,
  } from "../graphql.js";
  import {
    workspace,
    createWorkspaceWorkScope,
    execute,
    stop,
    cacheSchema,
  } from "../workspace.svelte.js";
  import { download } from "../import-export.js";
  /** @type {{ request: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { request, onchange } = $props();
  const fileWork = createWorkspaceWorkScope();
  onDestroy(fileWork.dispose);
  let view = $state("Query");
  let message = $state("");
  let error = $state("");
  let search = $state("");
  let selectedType = $state("");
  let selectedDirective = $state("");
  let content = $derived.by(() => {
    try {
      return { body: readGraphqlBody(request.body?.text || "{}"), error: "" };
    } catch (error) {
      return { body: {}, error: String(error) };
    }
  });
  let context = $derived.by(() => {
    try {
      return schemaContext(workspace.data, request);
    } catch {
      return "";
    }
  });
  let cached = $derived(workspace.schemas[request._id]);
  let entry = $derived(
    cached && (cached.context === "local" || cached.context === context)
      ? cached
      : null,
  );
  let schema = $derived(entry?.schema || null);
  const variableTypes = $derived(
    graphqlVariableTypes(
      schema,
      content.body.query || "",
      content.body.operationName,
    ),
  );
  function navigate(/** @type {any} */ reference) {
    if (
      reference?.directive &&
      schema?.getDirective(reference.directive.name)
    ) {
      selectedDirective = reference.directive.name;
      search = "";
      view = "Schema";
      return;
    }
    const name = graphqlReferenceType(reference);
    if (!name || !schema?.getType(name)) return;
    search = "";
    selectedDirective = "";
    selectedType = name;
    view = "Schema";
  }
  let running = $derived(Boolean(workspace.running[request._id]));
  let operations = $derived.by(() => {
    try {
      return parseQuery(content.body.query || "")
        .definitions.filter((def) => def.kind === "OperationDefinition")
        .map((def) => def.name?.value)
        .filter(Boolean);
    } catch {
      return [];
    }
  });
  let types = $derived.by(() => {
    if (!schema) return [];
    return Object.values(schema.getTypeMap())
      .filter(
        (/** @type {any} */ type) =>
          !type.name.startsWith("__") &&
          `${type.name} ${type.description || ""} ${printType(type)}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((/** @type {any} */ a, /** @type {any} */ b) =>
        a.name.localeCompare(b.name),
      );
  });
  let type = $derived(
    types.find((/** @type {any} */ item) => item.name === selectedType) ||
      types[0],
  );
  const directives = $derived(
    schema
      ?.getDirectives()
      .filter((/** @type {any} */ item) =>
        `${item.name} ${item.description || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ) || [],
  );
  const directive = $derived(
    directives.find(
      (/** @type {any} */ item) => item.name === selectedDirective,
    ),
  );
  function change(/** @type {Record<string, any>} */ patch) {
    if (content.error) return;
    onchange({
      ...request.body,
      text: JSON.stringify({ ...content.body, ...patch }),
    });
    message = "";
    error = "";
  }
  let validating = $state(false);
  /** @type {AbortController | undefined} */
  let validationController;
  let validationRevision = 0;
  function cancelValidation() {
    validationRevision++;
    validationController?.abort();
    validationController = undefined;
    validating = false;
  }
  $effect(() => {
    void context;
    void request.body?.text;
    void workspace.data.history;
    void schema;
    untrack(() => {
      cancelValidation();
      message = "";
      error = "";
    });
    return cancelValidation;
  });
  async function check() {
    cancelValidation();
    const revision = validationRevision;
    const controller = new AbortController();
    validationController = controller;
    validating = true;
    error = "";
    message = "";
    const source = context;
    const body = request.body?.text;
    const history = workspace.data.history;
    const selectedSchema = schema;
    const current = () =>
      revision === validationRevision &&
      !controller.signal.aborted &&
      context === source &&
      request.body?.text === body &&
      workspace.data.history === history &&
      schema === selectedSchema;
    try {
      const prepared = await resolveQuery(
        $state.snapshot(workspace.data),
        $state.snapshot(request),
        controller.signal,
      );
      if (current()) message = validateQuery(prepared, selectedSchema);
    } catch (e) {
      if (current()) error = String(e);
    } finally {
      if (revision === validationRevision) {
        validationController = undefined;
        validating = false;
      }
    }
  }
  async function importSchema(
    /** @type {Event & { currentTarget: HTMLInputElement }} */ event,
  ) {
    const file = event.currentTarget.files?.[0];
    const requestId = request._id;
    event.currentTarget.value = "";
    if (!file) return;
    fileWork.cancel();
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    try {
      work = fileWork.begin();
      if (file.size > schemaLimit)
        throw new Error("Schema exceeds the 20 MiB limit.");
      const text = await file.text();
      if (!work.current() || request._id !== requestId) return;
      const result = readSchema(text);
      if (
        !workspace.data.resources.some((resource) => resource._id === requestId)
      )
        return;
      cacheSchema(requestId, result, "local", file.name);
      error = "";
      view = "Schema";
    } catch (e) {
      if (!work || work.current()) error = String(e);
    } finally {
      work?.finish();
    }
  }
</script>

<div class="graphql-panel">
  <div class="graphql-toolbar">
    <button class:active={view === "Query"} onclick={() => (view = "Query")}
      >Query</button
    >
    <button class:active={view === "Schema"} onclick={() => (view = "Schema")}
      >Schema</button
    >
    <button
      disabled={Boolean(content.error)}
      onclick={() => {
        try {
          change({ query: formatQuery(content.body.query || "") });
        } catch (e) {
          error = String(e);
        }
      }}>Format</button
    >
    <button disabled={Boolean(content.error) || validating} onclick={check}
      >{validating ? "Validating…" : "Validate"}</button
    >
    <span class="spacer"></span>
    <button
      disabled={!context || running}
      title="Send a separate introspection POST using this request's auth, headers and environment"
      onclick={async () => {
        await execute(request._id, true);
        view = "Schema";
      }}>Fetch schema</button
    >
    {#if running}<button onclick={() => stop(request._id)}>Cancel</button>{/if}
    <label class="schema-import"
      >Import schema<input
        type="file"
        accept=".json,.graphql,.gql,.graphqls"
        onchange={importSchema}
      /></label
    >
    {#if entry}<button
        onclick={async () => {
          try {
            await download(entry.sdl, "schema.graphql");
          } catch (e) {
            error = String(e);
          }
        }}>Export SDL</button
      ><button
        onclick={() => {
          delete workspace.schemas[request._id];
          delete workspace.schemaErrors[request._id];
        }}>Clear schema</button
      >{/if}
  </div>
  {#if content.error}<p class="inline-error">
      {content.error} Edit the original body below to repair it.
    </p>{/if}
  {#if error || workspace.schemaErrors[request._id]}<pre
      class="graphql-diagnostic error-label"
      role="alert">{error || workspace.schemaErrors[request._id]}</pre>{/if}
  {#if message}<p class="hint padded" role="status">{message}</p>{/if}
  {#if content.error}
    <textarea
      class="code-editor body-text"
      aria-label="Invalid GraphQL body JSON"
      value={request.body?.text || ""}
      oninput={(event) =>
        onchange({ ...request.body, text: event.currentTarget.value })}
    ></textarea>
  {:else if view === "Query"}
    <label class="graphql-operation"
      >Operation name<input
        aria-label="GraphQL operation name"
        list={`graphql-operations-${request._id}`}
        value={content.body.operationName || ""}
        placeholder="Automatic for a single operation"
        oninput={(event) =>
          change({ operationName: event.currentTarget.value })}
      /></label
    >
    <datalist id={`graphql-operations-${request._id}`}
      >{#each operations as operation}<option value={operation}
        ></option>{/each}</datalist
    >
    <SplitPane
      class="graphql-editors"
      storageKey="graphql"
      label="GraphQL query and variables size"
      initial={67}
      stackAt={640}
      minFirst={150}
      minSecond={150}
    >
      {#snippet first()}
        <div class="graphql-editor-column">
          QUERY<CodeEditor
            identity={request._id + ":graphql-query"}
            mode="graphql"
            onnavigate={navigate}
            label="GraphQL query"
            value={content.body.query || ""}
            {schema}
            settings={workspace.data.settings}
            environment={environmentFor(
              workspace.data.resources,
              request,
              workspace.data.activeEnvironmentId,
            )}
            onchange={(query) => change({ query })}
            placeholder={"query { viewer { id } }"}
          />
        </div>
      {/snippet}{#snippet second()}
        <div class="graphql-editor-column">
          VARIABLES<CodeEditor
            identity={request._id + ":graphql-variables"}
            mode="graphql-variables"
            variableToType={variableTypes}
            label="GraphQL variables"
            value={typeof content.body.variables === "string"
              ? content.body.variables
              : JSON.stringify(content.body.variables ?? {}, null, 2)}
            settings={workspace.data.settings}
            environment={environmentFor(
              workspace.data.resources,
              request,
              workspace.data.activeEnvironmentId,
            )}
            onchange={(variables) => change({ variables })}
            placeholder={"{}"}
          />
        </div>
      {/snippet}</SplitPane
    >
  {:else if entry}
    <p class="hint padded">
      {entry.source} · {new Date(entry.loadedAt).toLocaleTimeString()} · {schema.getQueryType()
        ?.name || "Query"}{schema.getMutationType()
        ? ` / ${schema.getMutationType().name}`
        : ""}{schema.getSubscriptionType()
        ? ` / ${schema.getSubscriptionType().name}`
        : ""} · Session cache
    </p>
    <SplitPane
      class="schema-explorer"
      storageKey="graphql-schema"
      label="Schema types and documentation size"
      initial={30}
      minFirst={140}
      minSecond={170}
    >
      {#snippet first()}
        <div class="schema-types">
          <input
            aria-label="Search schema types and fields"
            placeholder="Find type or field…"
            bind:value={search}
          />
          <select
            size={8}
            aria-label="Schema types"
            value={directive ? "" : type?.name || ""}
            onchange={(event) => {
              selectedType = event.currentTarget.value;
              selectedDirective = "";
            }}
            >{#each types as item}<option value={item.name}>{item.name}</option
              >{/each}</select
          >
          <select
            size={4}
            aria-label="Schema directives"
            value={directive?.name || ""}
            onchange={(event) =>
              (selectedDirective = event.currentTarget.value)}
          >
            {#each directives as item}<option value={item.name}
                >@{item.name}</option
              >{/each}
          </select>
        </div>
      {/snippet}{#snippet second()}
        <pre class="schema-definition">{directive
            ? graphqlDirectiveText(directive)
            : type
              ? printType(type)
              : "No matching types"}</pre>
      {/snippet}</SplitPane
    >
  {:else}
    <div class="empty-body">
      <p>
        {cached
          ? "Request or environment changed. Fetch schema again."
          : "No schema loaded"}
      </p>
      <span
        >Fetch from this endpoint or import introspection JSON / GraphQL SDL.</span
      >
    </div>
  {/if}
</div>
