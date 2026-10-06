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
    onrequestclose={() => cancelTemplatePrompt(prompt.id)}
    onclose={() => cancelTemplatePrompt(prompt.id)}
    closeLabel="Cancel prompt"
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
        const input = event.currentTarget.elements.namedItem("prompt-value");
        if (input instanceof HTMLInputElement)
          answerTemplatePrompt(prompt.id, input.value);
      }}
    >
      <Field class="name-label" for={"template-prompt-value-" + prompt.id}>
        {prompt.label || "Value"}
        <Input
          id={"template-prompt-value-" + prompt.id}
          name="prompt-value"
          type={prompt.inputType}
          value={prompt.defaultValue}
          maxlength={MAX_PROMPT_VALUE}
          autocomplete="off"
          spellcheck="false"
        />
      </Field>
      <div class="modal-actions">
        <Button
          variant="secondary"
          type="button"
          class="secondary-button"
          onclick={() => cancelTemplatePrompt(prompt.id)}>Cancel</Button
        >
        <Button variant="primary" type="submit" class="primary-button"
          >Submit</Button
        >
      </div>
    </form>
  </DialogShell>
{/each}
