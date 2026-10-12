<script>
  import ResourceManager from "../../../src/lib/components/ResourceManager.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import Modal from "../../../src/lib/components/ui/Modal.svelte";
  const owned = {
    _id: "wrk_owned_only",
    _type: "workspace",
    parentId: null,
    name: "Owned only collection",
  };
  let resources = $state([owned]);
  let calls = $state(0);
  let validationOpen = $state(false);
  let rejectSave = $state(false);
  let saves = $state(/** @type {any[]} */ ([]));
  let folder = $state(/** @type {Record<string,any>} */ ({}));
  function openValidation() {
    folder = {
      _id: "fld_owned_validation",
      _type: "request_group",
      parentId: owned._id,
      name: "Owned validation folder",
      description: "Original description",
      environment: { preserved: "original" },
      unknown: "retained",
    };
    saves = [];
    rejectSave = false;
    validationOpen = true;
  }
</script>

<main>
  <ResourceManager
    resource={owned}
    {resources}
    onsave={() => calls++}
    onduplicate={() => calls++}
    ondelete={() => calls++}
    onreorder={() => calls++}
    onrequest={() => calls++}
    onfolder={() => calls++}
    onclose={() => {}}
  />
  <Button
    onclick={() =>
      (resources =
        resources.length === 1
          ? [
              ...resources,
              {
                _id: "wrk_owned_second",
                _type: "workspace",
                parentId: null,
                name: "Owned second collection",
              },
            ]
          : [owned])}>Toggle second owned collection</Button
  >
  <output aria-label="Owned actions">{calls}</output>
  <Button onclick={openValidation}>Open validation folder</Button>
  <output
    data-validation-snapshot={JSON.stringify({ folder, saves, rejectSave })}
  ></output>
</main>
{#if validationOpen}
  <Modal title="Manage owned folder" onclose={() => (validationOpen = false)}>
    <ResourceManager
      resource={folder}
      resources={[owned, folder]}
      onsave={(patch, parentId) => {
        if (rejectSave)
          throw new Error("Owned destination changed. Retry save.");
        saves.push(JSON.parse(JSON.stringify({ patch, parentId })));
        folder = { ...folder, ...patch, parentId };
      }}
      onduplicate={() => {}}
      ondelete={() => {}}
      onreorder={() => {}}
      onrequest={() => {}}
      onfolder={() => {}}
      onclose={() => (validationOpen = false)}
    />
    <Button onclick={() => (rejectSave = !rejectSave)}
      >Toggle owned save failure</Button
    >
  </Modal>
{/if}
