<script>
  import SegmentedControl from "./ui/SegmentedControl.svelte";
  import Toolbar from "./ui/Toolbar.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import EmptyState from "./ui/EmptyState.svelte";

  import FilePicker from "./ui/FilePicker.svelte";
  import Field from "./ui/Field.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import { untrack, onDestroy, tick } from "svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import { createTemplateEditorSession } from "../template-editor-session.svelte.js";
  import {
    graphqlVariableTypes,
    graphqlReferenceType,
    graphqlReferenceMember,
    graphqlSchemaMemberRange,
    graphqlReferencedTypes,
    graphqlDirectiveText,
  } from "../graphql-editor.js";
  import { environmentFor } from "../model.js";
  import { printType } from "graphql";
  import { jsonPrettify, jsonIndent } from "../json-prettify.js";
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
    clearSchema,
    schemaRevisionFor,
  } from "../workspace.svelte.js";
  import { download } from "../import-export.js";
  /** @type {{ request: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { request, onchange } = $props();
  const fileWork = createWorkspaceWorkScope();
  let disposed = false;
  onDestroy(() => { disposed = true; fileWork.dispose(); });
  let view = $state("Query");
  let message = $state("");
  let error = $state("");
  let search = $state("");
  let selectedType = $state("");
  let selectedDirective = $state("");
  let selectedMember=$state.raw(/** @type {ReturnType<typeof graphqlReferenceMember>} */(null));
  let navigation=$state(/** @type {{view:string,search:string,type:string,directive:string,member:typeof selectedMember}[]} */([]));
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
  $effect(()=>{void schema;void request._id;navigation=[];selectedMember=null;});
  function rememberNavigation(){
    navigation=[...navigation.slice(-99),{view,search,type:type?.name||'',directive:selectedDirective,member:selectedMember}];
  }
  let schemaSearch = $state(/** @type {HTMLInputElement | undefined} */ (undefined));
  export async function focusSchemaFilter() {
    if (!schema || disposed) return false;
    const owner = request._id;
    rememberNavigation();
    view = "Schema";
    await tick();
    if (disposed || request._id !== owner || !schemaSearch?.isConnected) return false;
    schemaSearch.focus();
    schemaSearch.select();
    return true;
  }

  async function navigateBack(/** @type {MouseEvent & {currentTarget: HTMLButtonElement}} */ event){
    const button = event.currentTarget;
    const restoreFocus = document.activeElement === button;
    const previous=navigation.at(-1);
    if(!previous)return;
    navigation=navigation.slice(0,-1);
    view=previous.view;search=previous.search;selectedType=previous.type;selectedDirective=previous.directive;selectedMember=previous.member;
    await tick();
    if (restoreFocus && !button.isConnected && document.activeElement === document.body) {
      schemaSearch?.focus();
    }
  }
  // Variable-value edits replace the JSON body too. Keep the schema mapping
  // stable unless its actual inputs change, so an open completion can update
  // without CodeEditor's mapping-change effect closing it on every keystroke.
  const variableQuery = $derived(content.body.query || "");
  const variableOperation = $derived(content.body.operationName);
  const variableTypes = $derived(
    graphqlVariableTypes(
      schema,
      variableQuery,
      variableOperation,
    ),
  );
  function navigate(/** @type {any} */ reference) {
    if (
      reference?.directive &&
      schema?.getDirective(reference.directive.name)
    ) {
      rememberNavigation();
      selectedMember=graphqlReferenceMember(reference);
      selectedDirective = reference.directive.name;
      search = "";
      view = "Schema";
      return;
    }
    const name = graphqlReferenceType(reference);
    if (!name || !schema?.getType(name)) return;
    rememberNavigation();
    selectedMember=graphqlReferenceMember(reference);
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
    const query = search.trim().toLowerCase();
    return Object.values(schema.getTypeMap())
      .filter(
        (/** @type {any} */ type) =>
          (!type.name.startsWith("__") || type.name===selectedType || query.startsWith('__')) &&
          `${type.name} ${type.description || ""} ${printType(type)}`
            .toLowerCase()
            .includes(query),
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
        graphqlDirectiveText(item)
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ) || [],
  );
  const directive = $derived(
    directives.find(
      (/** @type {any} */ item) => item.name === selectedDirective,
    ),
  );
  const referencedTypes = $derived(graphqlReferencedTypes(directive || type, schema));
  const schemaDefinition=$derived(directive?graphqlDirectiveText(directive):type?printType(type):'No matching types');
  const memberRange=$derived(selectedMember?.owner===(directive?'directive:'+directive.name:'type:'+type?.name)
    ? graphqlSchemaMemberRange(schemaDefinition,selectedMember,directive?.description?directive.description.length+2:0):null);
  let definitionElement=$state(/** @type {HTMLPreElement|undefined} */(undefined));
  $effect(()=>{
    const range=memberRange,element=definitionElement;
    if(range&&element)void tick().then(()=>{
      if(!disposed&&range===memberRange&&element.isConnected)
        element.querySelector('mark')?.scrollIntoView({block:'nearest',inline:'nearest'});
    });
  });
  function change(/** @type {Record<string, any>} */ patch) {
    if (content.error) return;
    onchange({
      ...request.body,
      text: JSON.stringify({ ...content.body, ...patch }),
    });
    message = "";
    error = "";
  }
  function formatQueryBody() {
    if (content.error) return;
    try { change({query:formatQuery(content.body.query || '')});error=''; }
    catch(e) {error=String(e);}
  }
  function formatVariables() {
    if (content.error) return;
    try {
      const value=content.body.variables;
      change({variables:jsonPrettify(typeof value === 'string' ? value : JSON.stringify(value ?? {}),jsonIndent(workspace.data.settings),false)});
      error='';
    } catch(e) {error=String(e);}
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
    const originalRequest = request, originalContext = context, originalCache = cached;
    const originalRevision = schemaRevisionFor(requestId);
    event.currentTarget.value = "";
    if (!file) return;
    fileWork.cancel();
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    const current = () => (!work || work.current()) && request === originalRequest &&
      request._id === requestId && context === originalContext && cached === originalCache &&
      schemaRevisionFor(requestId) === originalRevision;
    try {
      work = fileWork.begin();
      if (file.size > schemaLimit)
        throw new Error("Schema exceeds the 20 MiB limit.");
      const text = await file.text();
      if (!current()) return;
      const result = readSchema(text);
      if (
        !workspace.data.resources.some((resource) => resource._id === requestId)
      )
        return;
      cacheSchema(requestId, result, "local", file.name);
      error = "";
      view = "Schema";
    } catch (e) {
      if (current()) error = String(e);
    } finally {
      work?.finish();
    }
  }
</script>

<div class="graphql-panel">
  <Toolbar variant="graphql" class="graphql-toolbar">
    <SegmentedControl
      label="GraphQL view"
      variant="default"
      value={view}
      options={[
        { value: "Query", label: "Query" },
        { value: "Schema", label: "Schema" },
      ]}
      onchange={(value) => (view = String(value))}
    />
    <Button
      variant="ghost"
      disabled={Boolean(content.error)}
      onclick={formatQueryBody}>Format</Button
    >
    <Button
      variant="ghost"
      disabled={Boolean(content.error) || validating}
      onclick={check}>{validating ? "Validating…" : "Validate"}</Button
    >
    <span class="spacer"></span>
    <Button
      variant="ghost"
      disabled={!context || running}
      title="Send a separate introspection POST using this request's auth, headers and environment"
      onclick={async () => {
        const originalRequest = request, originalContext = context;
        await execute(request._id, true);
        if (!disposed && request === originalRequest && context === originalContext)
          view = "Schema";
      }}>Fetch schema</Button
    >
    {#if running}<Button variant="ghost" onclick={() => stop(request._id)}
        >Cancel</Button
      >{/if}
    <FilePicker
      class="schema-import"
      variant="compact"
      accept=".json,.graphql,.gql,.graphqls"
      onchange={importSchema}>Import schema</FilePicker
    >
    {#if entry}<Button
        variant="ghost"
        onclick={async () => {
          const originalRequest = request, originalContext = context, originalEntry = entry;
          if (!originalEntry) return;
          try {
            await download(originalEntry.sdl, "schema.graphql");
          } catch (e) {
            if (!disposed && request === originalRequest && context === originalContext && entry === originalEntry)
              error = String(e);
          }
        }}>Export SDL</Button
      ><Button
        variant="ghost"
        onclick={() => {
          clearSchema(request._id);
        }}>Clear schema</Button
      >{/if}
  </Toolbar>
  {#if content.error}<Feedback as="p" class="inline-error">
      {content.error} Edit the original body below to repair it.
    </Feedback>{/if}
  {#if error || workspace.schemaErrors[request._id]}<pre
      class="graphql-diagnostic error-label"
      role="alert">{error || workspace.schemaErrors[request._id]}</pre>{/if}
  {#if message}<p class="hint padded" role="status">{message}</p>{/if}
  {#if content.error}
    <Textarea
      class="code-editor body-text"
      aria-label="Invalid GraphQL body JSON"
      value={request.body?.text || ""}
      templateEditor={() => createTemplateEditorSession(request._id)}
      oninput={(event) =>
        onchange({ ...request.body, text: event.currentTarget.value })}
    ></Textarea>
  {:else if view === "Query"}
    <Field class="graphql-operation"
      >Operation name<Input
        aria-label="GraphQL operation name"
        list={`graphql-operations-${request._id}`}
        value={content.body.operationName || ""}
        templateEditor={() => createTemplateEditorSession(request._id)}
        placeholder="Automatic for a single operation"
        oninput={(event) =>
          change({ operationName: event.currentTarget.value })}
      /></Field
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
            templateEditor={() => createTemplateEditorSession(request._id)}
            identity={request._id + ":graphql-query"}
            mode="graphql"
            onnavigate={navigate}
            label="GraphQL query"
            onformat={formatQueryBody}
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
            templateEditor={() => createTemplateEditorSession(request._id)}
            identity={request._id + ":graphql-variables"}
            mode="graphql-variables"
            variableToType={variableTypes}
            label="GraphQL variables"
            onformat={formatVariables}
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
          {#if navigation.length}<Button variant="plain" onclick={navigateBack} aria-label="Back in schema navigation">← Back</Button>{/if}
          <Input
            bind:element={schemaSearch}
            aria-label="Search schema types and fields"
            placeholder="Find type or field…"
            bind:value={search}
          />
          <Select
            size={8}
            aria-label="Schema types"
            value={directive ? "" : type?.name || ""}
            onchange={(event) => {
              rememberNavigation();
              selectedMember=null;
              selectedType = event.currentTarget.value;
              selectedDirective = "";
            }}
            >{#each types as item}<option value={item.name}>{item.name}</option
              >{/each}</Select
          >
          <Select
            size={4}
            aria-label="Schema directives"
            value={directive?.name || ""}
            onchange={(event) => {
              rememberNavigation();
              selectedMember=null;
              selectedDirective = event.currentTarget.value;
            }}
          >
            {#each directives as item}<option value={item.name}
                >@{item.name}</option
              >{/each}
          </Select>
          {#if referencedTypes.length}
            <nav class="schema-reference-links" aria-label="Referenced schema types">
              <p class="hint">Referenced types</p>
              {#each referencedTypes as name}
                <Button
                  variant="plain"
                  onclick={() => navigate({ type: schema.getType(name) })}
                  >{name}</Button
                >
              {/each}
            </nav>
          {/if}
        </div>
      {/snippet}{#snippet second()}
        <pre bind:this={definitionElement} class="schema-definition">{#if memberRange}{schemaDefinition.slice(0,memberRange.start)}<mark class="schema-member-reference">{schemaDefinition.slice(memberRange.start,memberRange.end)}</mark>{schemaDefinition.slice(memberRange.end)}{:else}{schemaDefinition}{/if}</pre>
      {/snippet}</SplitPane
    >
  {:else}
    <EmptyState variant="body" class="empty-body">
      <p>
        {cached
          ? "Request or environment changed. Fetch schema again."
          : "No schema loaded"}
      </p>
      <span
        >Fetch from this endpoint or import introspection JSON / GraphQL SDL.</span
      >
    </EmptyState>
  {/if}
</div>
