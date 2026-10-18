<script>
  import CodeEditor from "./CodeEditor.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import {formatBulkKeyValues,parseBulkKeyValues,bulkTemplateRange} from "../bulk-key-values.js";
  /** @type {{rows:Record<string,any>[],onchange:(rows:Record<string,any>[])=>void,label:string,identity:string,settings?:Record<string,any>,environment?:Record<string,any>,templateEditor?:()=>ReturnType<import('../template-editor-session.svelte.js').createTemplateEditorSession>}} */
  let {rows,onchange,label,identity,settings={},environment={},templateEditor}=$props();
  let text=$state("");
  let error=$state("");
  let applied="";
  $effect(()=>{
    const signature=JSON.stringify(rows);
    if(signature!==applied){applied=signature;text=formatBulkKeyValues(rows);error="";}
  });
  /** @param {string} value */
  function change(value) {
    text=value;error="";
    const next=parseBulkKeyValues(value,rows);
    applied=JSON.stringify(next);
    onchange(next);
  }
</script>
<div class="bulk-key-value-editor">
  <p class="hint padded">One name: value per line. Prefix # followed by a space to disable a row.
    Names without a colon have an empty value. JSON tuples such as ["name", "value", false, false] preserve literal whitespace or line breaks; the last two flags mean disabled and bare.
    Use Table Edit to select file sources.</p>
  {#if error}<Feedback as="p" class="padded" role="alert">{error}</Feedback>{/if}
  <CodeEditor {identity} value={text} mode="text/plain" label={label+" bulk editor"} {settings} {environment} {templateEditor} templateRange={bulkTemplateRange}
    maxBytes={1024*1024} onlimit={()=>error="Bulk text exceeds the 1 MiB editor limit."} onchange={change}/>
</div>
<style>.bulk-key-value-editor {display:flex;flex-direction:column;flex:1;min-height:240px;}</style>
