import { savePluginFile } from "./plugin-save-client.js";
import { askTemplateAlert, askTemplatePrompt } from "./template-prompt-dialog.js";
import { validatePluginAppAsyncCall } from "./plugin-app-async.js";

/** Actual host services, captured per operation; never supplied by the guest.
 * @param {{purpose:'preview'|'send'|'action',signal:AbortSignal,current:()=>boolean,
 * interaction:import('./template-interaction.js').createTemplateInteraction extends (...args:any[])=>infer R ? R : never,
 * alert?:typeof askTemplateAlert,prompt?:typeof askTemplatePrompt,
 * save?:(options:{title:string,defaultPath?:string},signal:AbortSignal)=>Promise<string|null>}} options */
export function createPluginAppDialogEndpoint(options) {
  const { purpose, signal, current, interaction } = options;
  const alert = options.alert || askTemplateAlert;
  const prompt = options.prompt || askTemplatePrompt;
  const save = options.save || savePluginFile;
  if (!["preview", "send", "action"].includes(purpose) || !(signal instanceof AbortSignal) || typeof current !== "function" || typeof interaction?.begin !== "function" || [alert, prompt, save].some(service => typeof service !== "function"))
    throw Error("Plugin dialogs require a trusted operation owner");
  const begin = interaction.begin.bind(interaction);
  const check = () => {
    signal.throwIfAborted();
    if (!current()) throw Error("Plugin app dialog is no longer current");
  };
  return async (/** @type {any} */ call) => {
    const { method, args } = validatePluginAppAsyncCall(call);
    check();
    if (purpose === "preview") {
      if (method === "app.prompt") return args[1].defaultValue || "";
      return method === "app.showSaveDialog" ? null : undefined;
    }
    const release = begin();
    const owned = new AbortController();
    const ownedSignal = AbortSignal.any([signal, owned.signal]);
    const ownerTimer = setInterval(() => {
      try { check(); } catch (error) { owned.abort(error); }
    }, 100);
    try {
      let value;
      if (method === "app.alert") await alert(args[0], args[1], ownedSignal);
      else if (method === "app.prompt") {
        try { value = await prompt(args[0], args[1], ownedSignal); }
        catch (error) {
          check();
          if (error instanceof DOMException && error.name === "AbortError") throw Error(`Prompt ${args[0]} cancelled`);
          throw error;
        }
      } else {
        value = (await save({ title: "Save File", ...args[0] }, ownedSignal)) || null;
        if (value !== null && typeof value !== "string") throw Error("Invalid native save dialog result");
      }
      check();
      return value;
    } finally { clearInterval(ownerTimer); owned.abort(); release(); }
  };
}
