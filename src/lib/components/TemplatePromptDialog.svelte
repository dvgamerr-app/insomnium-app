<script>
  import Field from "./ui/Field.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import { onMount } from "svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import {
    templatePrompt,
    attachTemplatePromptHost,
    answerTemplatePrompt,
    cancelTemplatePrompt,
    MAX_PROMPT_VALUE,
  } from "../template-prompt-dialog.js";

  onMount(attachTemplatePromptHost);
</script>

{#each $templatePrompt ? [$templatePrompt] : [] as prompt (prompt.id)}
  <DialogShell
    title={prompt.title}
    size="compact"
    wrapContent={false}
    onrequestclose={() => prompt.kind === "alert" ? answerTemplatePrompt(prompt.id, "") : cancelTemplatePrompt(prompt.id)}
    onclose={() => prompt.kind === "alert" ? answerTemplatePrompt(prompt.id, "") : cancelTemplatePrompt(prompt.id)}
    closeLabel={prompt.kind === "alert" ? "Close alert" : "Cancel prompt"}
    onopenerror={(error) =>
      cancelTemplatePrompt(prompt.id, new Error(String(error)))}
    onopen={(element) => {
      const input = element.querySelector("input");
      input?.focus();
      input?.select();
    }}
  >
    <form
      class="modal-content"
      onsubmit={(event) => {
        event.preventDefault();
        if (prompt.kind === "alert") { answerTemplatePrompt(prompt.id, ""); return; }
        const input = event.currentTarget.elements.namedItem("prompt-value");
        if (input instanceof HTMLInputElement) {
          const value = input.type === "checkbox" ? String(input.checked) : input.value;
          if (value || input.type === "text") answerTemplatePrompt(prompt.id, value);
          else cancelTemplatePrompt(prompt.id);
        }
      }}
    >
      {#if prompt.kind === "alert"}
        <p style="white-space: pre-wrap">{prompt.message}</p>
      {:else}
      <Field class="name-label" for={"template-prompt-value-" + prompt.id}>
        {prompt.label || "Value"}
        <Input
          id={"template-prompt-value-" + prompt.id}
          name="prompt-value"
          type={prompt.inputType === "decimal" ? "number" : prompt.inputType}
          step={prompt.inputType === "decimal" ? "0.1" : undefined}
          min={prompt.inputType === "decimal" ? "0.5" : undefined}
          value={prompt.defaultValue}
          maxlength={MAX_PROMPT_VALUE}
          autocomplete="off"
          spellcheck="false"
        />
      </Field>
      {/if}
      <div class="modal-actions">
        {#if prompt.kind !== "alert"}
        <Button
          variant="secondary"
          type="button"
          class="secondary-button"
          onclick={() => cancelTemplatePrompt(prompt.id)}>Cancel</Button
        >
        {/if}
        <Button variant="primary" type="submit" class="primary-button"
          >{prompt.submitName}</Button
        >
      </div>
    </form>
  </DialogShell>
{/each}
