<script>
  import ApiDesign from "../../../src/lib/components/ApiDesign.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import { workspace } from "../../../src/lib/workspace.svelte.js";
  import { initialData } from "../../../src/lib/model.js";

  const data = initialData();
  const workspaceId = data.activeWorkspaceId;
  /** @param {number} count */
  function seed(count) {
    workspace.data = {
      ...data,
      resources: [
        ...data.resources,
        {
          _id: "spc_layout",
          _type: "api_spec",
          parentId: workspaceId,
          fileName: "openapi.yaml",
          contents:
            "openapi: 3.2.1\ninfo:\n  title: Layout\n  version: '1'\npaths: {}\n",
          exampleFiles: Array.from({ length: count }, (_, i) => ({
            name: `examples/owned-${i + 1}.bin`,
            base64: "YQ==",
          })),
          files: Array.from({ length: count === 3 ? 2 : count }, (_, i) => ({
            name: `references/owned-${i + 1}.json`,
            contents: "{}",
          })),
        },
      ],
    };
  }
  seed(3);
</script>

<div class="fixture-controls">
  <Button onclick={() => seed(3)}>Three attachments</Button>
  <Button onclick={() => seed(32)}>Maximum attachments</Button>
</div>
<div class="fixture-shell">
  <aside>
    Saved geometry fixture: production API Design and shared controls
  </aside>
  <ApiDesign {workspaceId} onrequests={() => {}} />
</div>

<style>
  .fixture-controls {
    height: 140px;
    padding: 20px;
  }
  .fixture-shell {
    display: grid;
    grid-template-columns: clamp(266px, 23vw, 328px) minmax(0, 1fr);
    height: calc(100vh - 140px);
  }
  aside {
    border-right: 1px solid var(--line);
    padding: 20px;
  }
</style>
