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
  <Field label="Contract textarea"><Textarea value="body" /></Field>
  <Field label="Contract select"
    ><Select><option>One</option><option>Two</option></Select></Field
  >
  <Feedback tone="hint" aria-label="Normal feedback">Shared hint</Feedback>
  <Feedback tone="hint" density="compact" aria-label="Compact feedback"
    >Compact shared hint</Feedback
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
</main>
