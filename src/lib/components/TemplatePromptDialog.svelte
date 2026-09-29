<script>
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import {
    templatePrompt,
    attachTemplatePromptHost,
    answerTemplatePrompt,
    cancelTemplatePrompt,
    MAX_PROMPT_VALUE,
  } from "../template-prompt-dialog.js";

  onMount(attachTemplatePromptHost);

  /** @param {HTMLDialogElement} element @param {number} id */
  function openDialog(element, id) {
    try {
      element.showModal();
      const input = element.querySelector("input");
      input?.focus();
      input?.select();
    } catch (error) {
      cancelTemplatePrompt(id, new Error(String(error)));
    }
    return {
      destroy() {
        element.close();
      },
    };
  }
</script>

{#each $templatePrompt ? [$templatePrompt] : [] as prompt (prompt.id)}
  <dialog
    class="modal template-prompt-modal"
    use:openDialog={prompt.id}
    aria-labelledby={"template-prompt-title-" + prompt.id}
    oncancel={(event) => {
      event.preventDefault();
      cancelTemplatePrompt(prompt.id);
    }}
    onclose={() => cancelTemplatePrompt(prompt.id)}
  >
    <div class="modal-heading">
      <h2 id={"template-prompt-title-" + prompt.id}>{prompt.title}</h2>
      <button
        class="icon-button"
        aria-label="Cancel prompt"
        onclick={() => cancelTemplatePrompt(prompt.id)}
        ><Icon name="close" /></button
      >
    </div>
    <form
      class="modal-content"
      onsubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("prompt-value");
        if (input instanceof HTMLInputElement)
          answerTemplatePrompt(prompt.id, input.value);
      }}
    >
      <label class="name-label" for={"template-prompt-value-" + prompt.id}>
        {prompt.label || "Value"}
        <input
          id={"template-prompt-value-" + prompt.id}
          name="prompt-value"
          type={prompt.inputType}
          value={prompt.defaultValue}
          maxlength={MAX_PROMPT_VALUE}
          autocomplete="off"
          spellcheck="false"
        />
      </label>
      <div class="modal-actions">
        <button
          type="button"
          class="secondary-button"
          onclick={() => cancelTemplatePrompt(prompt.id)}>Cancel</button
        >
        <button type="submit" class="primary-button">Submit</button>
      </div>
    </form>
  </dialog>
{/each}

<style>
  .template-prompt-modal {
    width: 480px;
  }
  h2 {
    overflow-wrap: anywhere;
  }
</style>
