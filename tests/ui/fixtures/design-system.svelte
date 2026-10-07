<script>
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import Checkbox from "../../../src/lib/components/ui/Checkbox.svelte";
  import DialogShell from "../../../src/lib/components/ui/DialogShell.svelte";
  import Field from "../../../src/lib/components/ui/Field.svelte";
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
  let orientation = $state(/** @type {'horizontal'|'vertical'} */ ("horizontal"));
  let fileCount = $state(0);
  let fileName = $state("");
  let dialog = $state(false);
  let locked = $state(false);
</script>

<main style="padding:24px;overflow:auto;height:100vh">
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
  <Field label="Contract checkbox" layout="inline"
    ><Checkbox bind:checked bind:indeterminate /></Field
  >
  <output aria-label="Checkbox value"
    >{String(checked)} / {String(indeterminate)}</output
  >
  <output aria-label="Number value"
    >{number === undefined ? "empty" : number}</output
  >
  <Button onclick={() => (error = error ? "" : "Shared error")}
    >Toggle error</Button
  >
  <Button onclick={() => (disabled = !disabled)}>Toggle disabled</Button>
  <Button onclick={() => (readOnly = !readOnly)}>Toggle read only</Button>
  <Button onclick={() => (busy = !busy)}>Toggle loading</Button>
  <Button onclick={() => (dialog = true)}>Open shared dialog</Button>
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
      onrequestclose={() => (dialog = false)}
      ><Input aria-label="Dialog value" /></DialogShell
    >{/if}
  {#if locked}<DialogShell title="Locked dialog" dismissible={false}
      ><Button onclick={() => (locked = false)}>Finish locked dialog</Button
      ></DialogShell
    >{/if}
</main>
