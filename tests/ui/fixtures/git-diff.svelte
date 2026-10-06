<script>
  import UnifiedDiff from "../../../src/lib/components/ui/UnifiedDiff.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  const before =
    "name: Sample\nurl: https://example.invalid/before\nbody:\n  text: |\n    first line\n    keep this line\n";
  const after =
    "name: Sample\nurl: https://example.invalid/after\nbody:\n  text: |\n    changed line\n    keep this line\n";
  let scenario = $state("modified");
  let theme = $state("dark");
  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });
</script>

<div class="fixture">
  <nav aria-label="Diff fixture cases">
    {#each ["modified", "added", "deleted", "unchanged"] as item}
      <Button onclick={() => (scenario = item)}>{item}</Button>
    {/each}
    <Button onclick={() => (theme = theme === "dark" ? "light" : "dark")}
      >Toggle fixture theme</Button
    >
  </nav>
  <UnifiedDiff
    identity="fixture-diff"
    before={scenario === "added" ? null : before}
    after={scenario === "deleted"
      ? null
      : scenario === "unchanged"
        ? before
        : after}
  />
</div>

<style>
  .fixture {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    padding: 24px;
    gap: 16px;
  }
  nav {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
