<script>
  import GitRecovery from "../../../src/lib/components/GitRecovery.svelte";
  import { sameWorkspace } from "../../../src/lib/git-workspace.js";
  let retained = { resources: [{ _id: "retained", name: "Unsaved original" }] };
  let picks = $state(0);
  let writes = $state.raw(/** @type {Record<string,any>[]} */ ([]));
  let attempts = $state(0);
  let complete = $state(false);
  async function pickCopy() {
    picks++;
    // First picker cancels. Remaining picks return an isolated fixture path.
    return picks === 1 ? null : "fixture-recovery.json";
  }
  /** @param {unknown} path @param {string} contents */
  async function writeCopy(path, contents) {
    if (picks === 2) throw new Error("Fixture write refused");
    writes = [...writes, JSON.parse(contents)];
    if (picks === 4)
      retained = {
        resources: [{ _id: "retained", name: "Edit during copy write" }],
      };
  }
  /** @param {Record<string,any>|null} [reviewed] */
  async function recoverWorkspace(reviewed) {
    attempts++;
    if (attempts === 1) {
      retained = {
        resources: [{ _id: "retained", name: "New unexpected edit" }],
      };
      throw new Error("Live edits changed; save and review the new copy");
    }
    if (!sameWorkspace(reviewed, retained))
      throw new Error("Stale copy refused");
    complete = true;
  }
</script>

<output aria-label="Recovery fixture evidence"
  >{JSON.stringify({ picks, writes, attempts, complete })}</output
>
{#if !complete}
  <GitRecovery
    getRetained={() => retained}
    {pickCopy}
    {writeCopy}
    {recoverWorkspace}
  />
{:else}
  <p>Authoritative workspace loaded</p>
{/if}
