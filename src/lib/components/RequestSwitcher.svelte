<script>
  import Modal from "./ui/Modal.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  /** @type {{entries:Record<string,any>[],initialIndex?:number,recent?:boolean,onselect:(id:string)=>void,onclose:()=>void}} */
  let {
    entries,
    initialIndex = 0,
    recent = false,
    onselect,
    onclose,
  } = $props();
  let search = $state("");
  // The opening order stays fixed while Ctrl+Tab cycles; committing a selection
  // is the only action that updates the durable most-recently-used order.
  let selected = $state("");
  const matches = $derived(
    entries.filter((row) =>
      (String(row.name || "") + " " + String(row.url || ""))
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  $effect(() => {
    selected = entries[initialIndex]?._id || "";
  });
  $effect(() => {
    if (!matches.some((row) => row._id === selected))
      selected = matches[0]?._id || "";
  });
  function choose() {
    if (selected && matches.some((row) => row._id === selected))
      onselect(selected);
  }
  function move(/** @type {number} */ direction) {
    if (!matches.length) return;
    const index = matches.findIndex((row) => row._id === selected);
    selected =
      matches[(index + direction + matches.length) % matches.length]._id;
  }
  function keyboard(/** @type {KeyboardEvent} */ event) {
    if (event.defaultPrevented || event.isComposing || event.altKey) return;
    if (event.key === "Tab" && event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      move(event.shiftKey ? -1 : 1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (
      event.key === "Enter" &&
      (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement)
    ) {
      event.preventDefault();
      choose();
    }
  }
</script>

<svelte:window
  onkeydown={keyboard}
  onkeyup={(event) => {
    if (recent && event.key === "Control") choose();
  }}
  onblur={onclose}
/>
<Modal title={recent ? "Recent requests" : "Switch requests"} {onclose}>
  <Input
    autofocus
    aria-label="Search requests"
    placeholder="Find request by name or URL…"
    bind:value={search}
  />
  <Select
    size={8}
    aria-label="Matching requests"
    bind:value={selected}
    ondblclick={choose}
  >
    {#each matches as row}<option value={row._id}
        >{row.name || "Untitled request"} · {row.method || "gRPC"} · {row.url ||
          ""}</option
      >{/each}
  </Select>
  {#if !matches.length}<p class="hint">No matching requests.</p>{/if}
  <div class="modal-actions">
    <Button onclick={onclose}>Cancel</Button><Button
      disabled={!selected}
      onclick={choose}>Open request</Button
    >
  </div>
</Modal>
