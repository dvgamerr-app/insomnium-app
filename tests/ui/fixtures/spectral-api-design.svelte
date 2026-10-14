<script>
  import ApiDesign from "../../../src/lib/components/ApiDesign.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import { workspace, withWorkspaceRunsPaused, canEditWorkspace, update } from "../../../src/lib/workspace.svelte.js";
  import { initialData } from "../../../src/lib/model.js";
  import {
    structuralFiles,
    structuralSource,
  } from "../helpers/structural-source-fixture.js";
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
          _id: "req_spectral_foreign",
          _type: "request",
          parentId: initial.activeWorkspaceId,
          name: "Existing foreign POST",
          method: "POST",
          body: { mimeType: "text/plain", text: "literal foreign request" },
          sourceSpecId: "spc_spectral_foreign",
        },
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
  const fixtureOwner = /** @type {any} */ (window);
  fixtureOwner.spectralDrain = {
    phase: "idle", events: [], error: "",
    state: () => JSON.parse(JSON.stringify(workspace.data)),
    start() {
      this.phase = "waiting";
      this.events.push("drain-requested");
      void withWorkspaceRunsPaused(async () => {
        this.events.push(fixtureOwner.spectralSaveGate.acknowledged ? "operation-after-ack" : "operation-before-ack");
        this.phase = "entered";
      }).then(() => { this.phase = "finished"; this.events.push("drain-finished"); })
        .catch((error) => { this.error = String(error); this.phase = "failed"; });
    },
    attemptEdit() {
      const allowed = canEditWorkspace();
      update("req_spectral_foreign", { name: "REFUSED owned drain edit" });
      return { allowed, notice: workspace.notice };
    },
    canEdit: () => canEditWorkspace(),
  };
  function external(remote = false) {
    seed(true);
    const base = remote ? window.location.origin + "/references/" : "../";
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
  function structural(remote = false) {
    seed(true);
    const spec = current();
    if (!spec) return;
    spec.contents = structuralSource(
      remote ? window.location.origin + "/references/" : "../",
    );
    spec.files = remote
      ? []
      : Object.entries(structuralFiles).map(([name, contents]) => ({
          name: "../" + name,
          contents,
        }));
  }
  function ambiguous() {
    seed(true);
    const spec = current();
    if (!spec) return;
    spec.files = [];
    spec.contents = JSON.stringify(
      {
        openapi: "3.1.0",
        info: { title: "Unknown origin", version: "1" },
        paths: {},
        components: {
          schemas: {
            A: { $id: "memory:///collision", type: "string" },
            B: { $id: "memory:///collision", type: "string" },
          },
        },
      },
      null,
      2,
    );
  }
  function current() {
    return workspace.data.resources.find((r) => r._id === specId);
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
  <Button onclick={() => structural(false)}>Structural attached fixture</Button>
  <Button onclick={() => structural(true)}>Structural HTTP fixture</Button>
  <Button onclick={ambiguous}>Structural ambiguous fixture</Button>
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
