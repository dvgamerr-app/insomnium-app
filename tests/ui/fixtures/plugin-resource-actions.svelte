<script>
  import PluginResourceActions from '../../../src/lib/components/PluginResourceActions.svelte';
  import TemplatePromptDialog from '../../../src/lib/components/TemplatePromptDialog.svelte';
  import PluginThemeHost from '../../../src/lib/components/PluginThemeHost.svelte';
  import SettingsPanel from '../../../src/lib/components/SettingsPanel.svelte';
  import {workspace} from '../../../src/lib/workspace.svelte.js';
  let {themes=false}=$props();
  let selected=$state('req_action');
</script>
<section aria-label="Plugin action fixture">
  {#if themes}<PluginThemeHost/><SettingsPanel settings={workspace.data.settings}/>{:else}
  {#each [['req_action','Request'],['group_action','Folder'],['wrk_action','Collection'],['spec_action','Document']] as [id,label]}
    <button type="button" onclick={()=>selected=id}>Select {label}</button>
  {/each}
  {#key selected}<PluginResourceActions resourceId={selected}/>{/key}
  {/if}
</section>
<TemplatePromptDialog/>
