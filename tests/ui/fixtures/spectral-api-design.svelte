<script>
  import ApiDesign from "../../../src/lib/components/ApiDesign.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import { workspace } from "../../../src/lib/workspace.svelte.js";
  import { initialData } from "../../../src/lib/model.js";
  const initial = initialData();
  let workspaceId = $state(initial.activeWorkspaceId),
    shown = $state(true);
  const specId = "spc_spectral_owned",
    otherWorkspace = "wrk_spectral_other";
  const source =
    "\uFEFFopenapi: 3.1.0\r\ninfo:\r\n  title: Fixture 😀\r\n  version: '1'\r\npaths:\r\n  /probe:\r\n    get:\r\n      responses:\r\n        '200':\r\n          description: OK\r\ncomponents:\r\n  schemas:\r\n    A:\r\n      $ref: './a/shared.yaml'\r\n    B:\r\n      $ref: './b/shared.yaml'\r\n";
  function seed(repository = false) {
    workspaceId = initial.activeWorkspaceId;
    workspace.data = {
      ...structuredClone(initial),
      resources: [
        ...structuredClone(initial.resources),
        {
          _id: otherWorkspace,
          _type: "workspace",
          name: "Owned other collection",
        },
        {
          _id: specId,
          _type: "api_spec",
          parentId: workspaceId,
          fileName: "openapi.yaml",
          contents: source,
          files: [
            {
              name: "a/shared.yaml",
              contents:
                "\uFEFFtype: object\r\nproperties:\r\n  label😀:\r\n    type: string\r\n",
            },
            {
              name: "b/shared.yaml",
              contents:
                "type: object\r\nproperties:\r\n  label:\r\n    type: integer\r\n",
            },
          ],
          exampleFiles: [],
        },
        ...(repository
          ? [
              {
                _id: "git_spectral_owned",
                _type: "git_repository",
                parentId: workspaceId,
                nativeBindingVersion: 1,
                nativeRepositoryId: "git_spectral_fixture",
              },
            ]
          : []),
      ],
    };
    workspace.ready = true;
    shown = true;
  }
  seed();
  function current() {
    return workspace.data.resources.find((r) => r._id === specId);
  }
</script>

<div class="fixture-controls">
  <Button onclick={() => seed(false)}>Default fixture</Button>
  <Button onclick={() => seed(true)}>Repository fixture</Button>
  <Button
    onclick={() => {
      const spec = current();
      if (spec) spec.files[0].contents += "\n# changed ref";
    }}>Mutate owned reference</Button
  >
  <Button
    onclick={() => {
      workspace.data.resources = workspace.data.resources.filter(
        (r) => r._id !== specId,
      );
    }}>Remove owned spec</Button
  >
  <Button
    onclick={() => {
      workspace.data = JSON.parse(JSON.stringify(workspace.data));
    }}>Replace owned workspace</Button
  >
  <Button
    onclick={() => {
      workspace.data.activeWorkspaceId = otherWorkspace;
      workspaceId = otherWorkspace;
    }}>Switch owned workspace</Button
  >
  <Button
    onclick={() => {
      shown = !shown;
    }}>Toggle owned API view</Button
  >
  <Button
    onclick={() => {
      const spec = current();
      if (spec) spec.contents = "openapi: 3.1.0\ninfo: [";
    }}>Owned parser error</Button
  >
  <output data-fixture-snapshot={JSON.stringify(workspace.data)}></output>
</div>
<div class="fixture-shell">
  <aside>Owned Spectral API UI fixture</aside>
  {#if shown}<ApiDesign {workspaceId} onrequests={() => {}} />{/if}
</div>

<style>
  .fixture-controls {
    height: 44px;
    display: flex;
    gap: var(--space-4);
    overflow: auto;
  }
  .fixture-shell {
    display: grid;
    grid-template-columns: clamp(266px, 23vw, 328px) minmax(0, 1fr);
    height: calc(100vh - 76px);
  }
  aside {
    border-right: 1px solid var(--line);
    padding: var(--space-16);
  }
</style>
