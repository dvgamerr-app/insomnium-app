<script>
  import PluginResourceActions from '../../../src/lib/components/PluginResourceActions.svelte';
  import TemplatePromptDialog from '../../../src/lib/components/TemplatePromptDialog.svelte';
  let selected=$state('req_action');
</script>
<section aria-label="Plugin action fixture">
  {#each [['req_action','Request'],['group_action','Folder'],['wrk_action','Collection'],['spec_action','Document']] as [id,label]}
    <button type="button" onclick={()=>selected=id}>Select {label}</button>
  {/each}
  {#key selected}<PluginResourceActions resourceId={selected}/>{/key}
</section>
<TemplatePromptDialog/>
