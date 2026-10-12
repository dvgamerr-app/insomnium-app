<script>
  import ApiDesign from "../../../src/lib/components/ApiDesign.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import { workspace } from "../../../src/lib/workspace.svelte.js";

  const native = /** @type {any} */ (window).__spectralNativeSeed;
  if (!native?.saved || !native?.fixture) throw new Error("Native saved seed required");
  let workspaceId = $state(native.fixture.workspaceId), shown = $state(true);
  const specId = native.fixture.specId, otherWorkspace = native.fixture.otherWorkspaceId;
  function seed(repository = false) {
    workspaceId = native.fixture.workspaceId;
    workspace.data = structuredClone(native.saved);
    if (!repository) workspace.data.resources = workspace.data.resources.filter((row) => row._id !== native.fixture.repositoryId);
    workspace.data.activeWorkspaceId = workspaceId;
    workspace.ready = true;
    shown = true;
  }
  seed();
  function current() {
    return workspace.data.resources.find((r) => r._id === specId);
  }
  function external(remote = false) {
    seed(true);
    const base = remote ? native.referenceOrigin + "/references/" : "../";
    const spec = current();
    if (!spec) return;
    spec.files = [];
    spec.contents =
      "\uFEFFopenapi: 3.2.0\r\n$self: memory:///design/openapi.yaml\r\ninfo:\r\n  title: External 😀\r\n  version: '1'\r\npaths:\r\n  /payload:\r\n    post:\r\n      requestBody:\r\n        content:\r\n          application/json:\r\n            schema:\r\n              $ref: '" +
      base +
      "a/shared.yaml'\r\n      responses:\r\n        '200':\r\n          description: OK\r\ncomponents:\r\n  schemas:\r\n    A:\r\n      $ref: '" +
      base +
      "a/shared.yaml'\r\n    B:\r\n      $ref: '" +
      base +
      "b/shared.yaml'\r\n";
  }
  function manyExternal() {
    seed(true);
    const spec = current();
    if (!spec) return;
    spec.files = [];
    spec.contents = JSON.stringify(
      {
        openapi: "3.1.0",
        info: { title: "External capacity", version: "1" },
        paths: {
          "/payload": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: { $ref: "./many/schema-0.yaml" },
                  },
                },
              },
              responses: { "200": { description: "OK" } },
            },
          },
        },
        components: {
          schemas: Object.fromEntries(
            Array.from({ length: 40 }, (_, i) => [
              "R" + i,
              { $ref: "./many/schema-" + i + ".yaml" },
            ]),
          ),
        },
      },
      null,
      2,
    );
  }
  function attachedPrecedence() {
    external(false);
    const spec = current();
    if (spec)
      spec.files = [
        {
          name: "../a/shared.yaml",
          contents:
            "type: object\nproperties:\n  label:\n    type: string\n    enum: ['attached😀']\n",
        },
      ];
  }
</script>

<div class="fixture-controls">
  <Button onclick={attachedPrecedence}>Attached precedence fixture</Button>
  <Button onclick={manyExternal}>External capacity fixture</Button>
  <Button onclick={() => external(false)}>External repository fixture</Button>
  <Button onclick={() => external(true)}>External HTTP fixture</Button>
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
  <aside>Native Spectral component fixture</aside>
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

