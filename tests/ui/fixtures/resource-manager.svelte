<script>
  import ResourceManager from "../../../src/lib/components/ResourceManager.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  const owned = {
    _id: "wrk_owned_only",
    _type: "workspace",
    parentId: null,
    name: "Owned only collection",
  };
  let resources = $state([owned]);
  let calls = $state(0);
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
</main>
