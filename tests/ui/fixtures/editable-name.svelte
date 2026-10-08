<script>
  import EditableName from "../../../src/lib/components/ui/EditableName.svelte";
  import Input from "../../../src/lib/components/ui/Input.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  let value = $state("Owned name");
  let callbacks = $state(0);
</script>

<main style="padding:24px">
  <Input aria-label="Parent value" bind:value />
  <div class="request-heading">
    <EditableName
      {value}
      onchange={(name) => {
        callbacks++;
        value = name;
      }}
    />
  </div>
  <Button>Leave rename</Button>
  <output aria-label="Rename callbacks">{callbacks}</output>
  <output aria-label="Controlled name">{value}</output>
</main>
