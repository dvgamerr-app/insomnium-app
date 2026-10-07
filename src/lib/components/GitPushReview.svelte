<script>
  import DialogShell from "./ui/DialogShell.svelte";
  import Button from "./ui/Button.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Field from "./ui/Field.svelte";
  /** @type {{review:any,observation?:boolean,busy:boolean,oncancel:()=>void,onconfirm:()=>void}} */
  let { review, observation = false, busy, oncancel, onconfirm } = $props();
  let acknowledged = $state(false);
</script>

<DialogShell
  title={observation ? "Inspect Push result" : "Review Push"}
  dismissible={!busy}
  onrequestclose={oncancel}
>
  <p class="endpoint">{review.url}</p>
  <dl>
    <dt>Remote branch</dt>
    <dd>{review.destinationBranch}</dd>
    <dt>Local commit</dt>
    <dd><code>{review.sourceOid}</code></dd>
    {#if observation}
      <dt>Observed remote commit</dt>
      <dd>
        <code
          >{review.observedRemoteOid || "Branch does not currently exist"}</code
        >
      </dd>
    {:else}
      <dt>Local branch</dt>
      <dd>{review.sourceBranch}</dd>
      <dt>Remote commit before Push</dt>
      <dd>
        <code>{review.expectedRemoteOid || "Create a new remote branch"}</code>
      </dd>
    {/if}
  </dl>
  {#if observation}
    <p>
      {review.matchesPinnedCommit
        ? "The remote currently points to the reviewed commit."
        : "The remote currently differs from the reviewed commit."}
    </p>
    <p>
      This observation does not prove who changed the remote or whether an
      earlier Push succeeded. Clearing tracking does not undo remote changes.
    </p>
    <Field layout="inline" disabled={busy}>
      <Checkbox bind:checked={acknowledged} />
      I have reviewed the observed remote state.
    </Field>
  {:else}
    <p>
      {review.equal
        ? "The advertised remote already has this commit. Confirmation checks it again."
        : "Send this committed revision using a normal Push."}
    </p>
    <p>
      Working changes stay local. Push does not create a commit or force an
      update.
    </p>
  {/if}
  <div class="resource-tools">
    <Button disabled={busy} onclick={oncancel}
      >{observation ? "Keep tracking Push" : "Cancel Push review"}</Button
    >
    <Button
      variant="primary"
      disabled={busy || (observation && !acknowledged)}
      onclick={onconfirm}
    >
      {busy
        ? "Working…"
        : observation
          ? "Stop tracking reviewed Push"
          : "Confirm Push"}
    </Button>
  </div>
</DialogShell>

<style>
  .endpoint,
  dd,
  code {
    overflow-wrap: anywhere;
  }
  dl {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-8);
    margin: 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0 0 var(--space-8);
  }
</style>
