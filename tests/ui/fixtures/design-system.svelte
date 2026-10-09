<script>
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import Checkbox from "../../../src/lib/components/ui/Checkbox.svelte";
  import DialogShell from "../../../src/lib/components/ui/DialogShell.svelte";
  import Field from "../../../src/lib/components/ui/Field.svelte";
  import Feedback from "../../../src/lib/components/ui/Feedback.svelte";
  import FilePicker from "../../../src/lib/components/ui/FilePicker.svelte";
  import Input from "../../../src/lib/components/ui/Input.svelte";
  import Select from "../../../src/lib/components/ui/Select.svelte";
  import TabButton from "../../../src/lib/components/ui/TabButton.svelte";
  import TabList from "../../../src/lib/components/ui/TabList.svelte";
  import TabPanel from "../../../src/lib/components/ui/TabPanel.svelte";
  import Textarea from "../../../src/lib/components/ui/Textarea.svelte";
  import KeyValueEditor from "../../../src/lib/components/KeyValueEditor.svelte";
  let helpRows = $state(
    /** @type {Record<string,any>[]} */ ([
      { name: "ordinary", value: "plain", disabled: false },
      {
        name: "nullable",
        value: '""',
        disabled: false,
        _openapiSerialization: {
          style: "form",
          kind: "scalar-json",
          explode: true,
          nullable: true,
        },
      },
      {
        name: "content",
        value: '{"key":"value"}',
        disabled: false,
        _openapiSerialization: {
          style: "content",
          kind: "json",
          explode: false,
          mediaType: "application/json",
        },
      },
      {
        name: "reserved",
        value: '["x/y%2f"]',
        disabled: false,
        _openapiSerialization: {
          style: "form",
          kind: "array",
          explode: true,
          allowReserved: true,
        },
      },
      {
        name: "combined",
        value: '"x/y%2f"',
        disabled: false,
        _openapiSerialization: {
          style: "form",
          kind: "scalar-json",
          explode: true,
          nullable: true,
          allowReserved: true,
        },
      },
      {
        name: "form",
        value: '["x + y", "z"]',
        disabled: false,
        _openapiSerialization: {
          formBody: true,
          style: "form",
          kind: "array",
          explode: true,
          allowReserved: true,
        },
      },
      {
        name: "form-content",
        value: '{"nested":{"zip":"99999+1234"}}',
        disabled: false,
        _openapiSerialization: {
          formBody: true,
          style: "content",
          kind: "object",
          mediaType: "application/json",
        },
      },
      {
        name: "form-style-items",
        value: '[{"R":100},{"G":200}]',
        disabled: false,
        _openapiSerialization: {
          formBody: true,
          style: "form",
          kind: "array",
          explode: false,
          formArrayItems: true,
          itemKind: "object",
        },
      },
      {
        name: "nullable-form-content",
        value: "null",
        disabled: false,
        _openapiSerialization: {
          formBody: true,
          style: "content",
          kind: "scalar-json",
          nullable: true,
          mediaType: "application/json",
        },
      },
      {
        name: "parameterized-json-content",
        value: '"a +"',
        disabled: false,
        _openapiSerialization: {
          formBody: true,
          style: "content",
          kind: "scalar-json",
          mediaType: 'APPLICATION/JSON; charset="UTF-8"; note="a,b;c"',
        },
      },
      {
        name: "parameterized-text-content",
        value: "a +",
        disabled: false,
        _openapiSerialization: {
          formBody: true,
          style: "content",
          kind: "scalar",
          mediaType: 'TEXT/PLAIN; CHARSET="uTf-8"; note="a,b;c"',
        },
      },
    ]),
  );
  let multipartRows = $state(
    /** @type {Record<string,any>[]} */ ([
      { name: "part", value: "body", disabled: false, type: "text" },
    ]),
  );
  let error = $state("");
  let disabled = $state(false);
  let readOnly = $state(false);
  let busy = $state(false);
  let checked = $state(false);
  let indeterminate = $state(true);
  let text = $state("initial");
  let number = $state(12);
  let selected = $state("first");
  let activeId = $state("");
  let orientation = $state(
    /** @type {'horizontal'|'vertical'} */ ("horizontal"),
  );
  let fileCount = $state(0);
  let fileName = $state("");
  let dialog = $state(false);
  let dialogSize = $state(/** @type {'normal'|'compact'} */ ("normal"));
  let locked = $state(false);
  let required = $state(true);
  let submitted = $state(0);
  const feedbackTags = /** @type {('p'|'pre'|'div'|'small')[]} */ ([
    "p",
    "pre",
    "div",
    "small",
  ]);
  const feedbackTones = /** @type {('hint'|'error')[]} */ (["hint", "error"]);
</script>

<main style="padding:24px;overflow:auto;height:100vh">
  <section class="button-padding-contract" aria-label="Button padding contract">
    <Button variant="primary" data-padding-standard>Primary padding</Button>
    <Button variant="secondary" data-padding-standard>Secondary padding</Button>
    <Button variant="danger" data-padding-standard>Danger padding</Button>
    <Button class="icon-button" data-padding-fixed aria-label="Icon padding"
      >+</Button
    >
    <Button class="send-button" data-padding-fixed>Send padding</Button>
  </section>
  <form
    aria-label="Required field contract"
    onsubmit={(event) => {
      event.preventDefault();
      submitted++;
    }}
  >
    <Field label="Required text" {required}><Input /></Field>
    <Field label="Required notes" {required}><Textarea /></Field>
    <Field label="Required selection" {required}
      ><Select value=""
        ><option value="">Choose</option><option value="chosen">Chosen</option
        ></Select
      ></Field
    >
    <Field label="Required consent" {required} layout="inline"
      ><Checkbox /></Field
    >
    <Field label="Required attachment" {required} error="Attachment validation"
      ><FilePicker resetAfterChange={false}>Select attachment</FilePicker
      ></Field
    >
    <Field label="Optional override" {required}
      ><Input required={false} /></Field
    >
    <Button type="submit">Submit required fields</Button>
    <Button onclick={() => (required = !required)}
      >Toggle required fields</Button
    >
    <output aria-label="Required submissions">{submitted}</output>
  </form>
  <section aria-label="File geometry contract">
    <FilePicker variant="inline" aria-label="Inline geometry file"
      >Inline file</FilePicker
    >
    <FilePicker variant="dropzone" aria-label="Dropzone geometry file"
      >Dropzone file</FilePicker
    >
    <Input
      variant="url"
      aria-label="URL geometry variant"
      value="https://example.invalid/"
    />
    <Input
      variant="inline"
      aria-label="Inline geometry variant"
      value="inline"
    />
  </section>
  <Field
    id="contract-text"
    label="Contract text"
    description="Shared description"
    {error}
    {disabled}
    {readOnly}
    {busy}
  >
    <Input bind:value={text} />
  </Field>
  <Field label="Second shared input"><Input value="second" /></Field>
  <Field label="Contract number"
    ><Input type="number" bind:value={number} /></Field
  >
  <Field label="Contract textarea" {error} {disabled} {readOnly} {busy}
    ><Textarea value="body" /></Field
  >
  <Field label="Contract select" {error} {disabled} {busy}
    ><Select><option>One</option><option>Two</option></Select></Field
  >
  <Feedback tone="hint" aria-label="Normal feedback">Shared hint</Feedback>
  <Feedback tone="hint" density="compact" aria-label="Compact feedback"
    >Compact shared hint</Feedback
  >
  <section aria-label="Compact feedback contract">
    {#each feedbackTags as tag}
      {#each feedbackTones as tone}
        <Feedback
          as={tag}
          {tone}
          density="compact"
          aria-label={`${tag} ${tone} compact feedback`}
          >First line{tone === "error" ? "\nSecond line" : ""}</Feedback
        >
      {/each}
    {/each}
    <ul>
      {#each feedbackTones as tone}<Feedback
          as="li"
          {tone}
          density="compact"
          aria-label={`li ${tone} compact feedback`}>List message</Feedback
        >{/each}
    </ul>
  </section>
  <Feedback
    tone="hint"
    density="compact"
    class="feedback-placement-contract"
    aria-label="Feature placed feedback">Feature owns its placement</Feedback
  >
  <Field label="Contract checkbox" layout="inline"
    ><Checkbox bind:checked bind:indeterminate /></Field
  >
  <output aria-label="Checkbox value"
    >{String(checked)} / {String(indeterminate)}</output
  >
  <div style="max-width:220px">
    <Field layout="inline" align="start" class="contract-wrapped-choice">
      <Checkbox aria-label="Wrapped choice" {disabled} />
      <span
        >This choice wraps across several lines and keeps its checkbox beside
        the first line.</span
      >
    </Field>
  </div>
  <output aria-label="Number value"
    >{number === undefined ? "empty" : number}</output
  >
  <Button onclick={() => (error = error ? "" : "Shared error")}
    >Toggle error</Button
  >
  <Button onclick={() => (disabled = !disabled)}>Toggle disabled</Button>
  <Button onclick={() => (readOnly = !readOnly)}>Toggle read only</Button>
  <Button onclick={() => (busy = !busy)}>Toggle loading</Button>
  <Button
    onclick={() => {
      dialogSize = "normal";
      dialog = true;
    }}>Open shared dialog</Button
  >
  <Button
    onclick={() => {
      dialogSize = "compact";
      dialog = true;
    }}>Open compact dialog</Button
  >
  <Button onclick={() => (locked = true)}>Open locked dialog</Button>
  <FilePicker
    aria-label="Contract file"
    onchange={async (event) => {
      const input = event.currentTarget;
      await new Promise((resolve) => setTimeout(resolve, 20));
      fileName = input.files?.[0]?.name || "";
      fileCount++;
    }}>Choose contract file</FilePicker
  >
  <output aria-label="File selection">{fileCount} / {fileName}</output>
  <Button
    onclick={() =>
      (orientation = orientation === "horizontal" ? "vertical" : "horizontal")}
    >Toggle tab orientation</Button
  >
  <TabList
    aria-label="Contract tabs"
    panelId="contract-panel"
    bind:activeId
    aria-orientation={orientation}
  >
    <TabButton
      aria-selected={selected === "first" ? "true" : "false"}
      onclick={() => (selected = "first")}>First</TabButton
    >
    <TabButton disabled aria-selected={false}>Disabled tab</TabButton>
    <TabButton
      aria-selected={selected === "second"}
      onclick={() => (selected = "second")}>Second</TabButton
    >
  </TabList>
  <TabPanel id="contract-panel" labelledBy={activeId}
    ><p>{selected} panel</p></TabPanel
  >
  {#if dialog}<DialogShell
      title="Shared dialog"
      size={dialogSize}
      onrequestclose={() => (dialog = false)}
      ><Input aria-label="Dialog value" /></DialogShell
    >{/if}
  {#if locked}<DialogShell
      title="Locked dialog"
      dismissible={false}
      size="recovery"
      ><Button onclick={() => (locked = false)}>Finish locked dialog</Button
      ></DialogShell
    >{/if}
  <section aria-label="Key value help geometry contract">
    <section aria-label="Help contract editor">
      <KeyValueEditor
        label="Help contract"
        rows={helpRows}
        onchange={(rows) => (helpRows = rows)}
      />
    </section>
    <section aria-label="Multipart contract editor">
      <KeyValueEditor
        label="Multipart contract"
        files
        rows={multipartRows}
        onchange={(rows) => (multipartRows = rows)}
      />
    </section>
  </section>
</main>

<style>
  :global(.feedback-placement-contract) {
    margin: var(--space-8) var(--space-12);
  }
</style>
