<script>
  import { untrack, onDestroy } from "svelte";
  import TemplateTagDialog from "./TemplateTagDialog.svelte";
  import {
    closeTemplateField,
    applyTemplateField,
  } from "../template-field-dialog.svelte.js";
  /** @type {{frame:import('../template-field-dialog.svelte.js').Frame}} */
  let { frame } = $props();
  // This component is keyed per opening. Teardown callbacks must retain the
  // opening's owner even after the host clears its reactive current frame.
  const owner = untrack(() => frame);
  onDestroy(() => closeTemplateField(owner));
</script>

<TemplateTagDialog
  {...owner.session}
  initialValue={owner.source.slice(owner.start, owner.end)}
  isCurrent={owner.current}
  onclose={() => closeTemplateField(owner)}
  onapply={(text) => applyTemplateField(owner, text)}
/>
