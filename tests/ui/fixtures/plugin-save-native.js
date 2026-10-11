import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openPluginSession } from "../../../src/lib/plugin-session.js";
import { createPluginAppAsyncHelpers } from "../../../src/lib/plugin-app-async.js";
import { createPluginAppDialogEndpoint } from "../../../src/lib/plugin-app-dialogs.js";
import { createPluginSaveClient } from "../../../src/lib/plugin-save-client.js";
import { createTemplateInteraction } from "../../../src/lib/template-interaction.js";

const source = `const make=${createPluginAppAsyncHelpers.toString()};exports.templateTags=[{name:'nativeSave',async run(c,gen,defaultPath){const app=make((method,args)=>__pluginStoreCall(JSON.stringify({generation:gen,helper:__pluginValueCodec.encode({method,args})})).then(__pluginValueCodec.decode),()=>__pluginHelperCurrent(gen));return await app.showSaveDialog({defaultPath});}}];`;
/** @type {Map<number,any>} */ const slots = new Map();
/** @type {any[]} */ const records = [];
/** @type {any} */ (window).__pluginSaveNative = {
  records,
  async writeSelected(/** @type {string} */ path, /** @type {string} */ text) { await writeTextFile(path, text); return readTextFile(path); },
  /** @param {number} index @param {string} url @param {string} [defaultPath] */
  async start(index, url, defaultPath = "fixture-plugin-save.txt") {
    if (slots.has(index)) throw Error("Duplicate native save fixture slot");
    const controller = new AbortController(), interaction = createTemplateInteraction();
    const slot = { controller, interaction, current: true, id: "", session: /** @type {any} */ (null), result: /** @type {any} */ (null), completed: false, settled: false, events: /** @type {any[]} */ ([]), saveSignal: /** @type {AbortSignal|null} */ (null) };
    slots.set(index, slot);
    const client = createPluginSaveClient({
      invoke: async (command, args) => {
        slot.events.push({ command, phase: "start", at: Date.now() });
        const value = await invoke(command, args);
        slot.events.push({ command, phase: "done", at: Date.now(), ...(command === "cancel_plugin_save" ? { accepted: value } : {}) });
        if (command === "reserve_plugin_save") slot.id = /** @type {string} */ (value);
        return value;
      },
      platform: async () => invoke("read_template_os", { function: "platform" }), fallback: save,
    });
    const endpoint = createPluginAppDialogEndpoint({ purpose: "send", current: () => slot.current, signal: controller.signal, interaction, save: (options, signal) => {
      slot.saveSignal = signal;
      signal.addEventListener("abort", () => slot.events.push({ phase: "save-abort", at: Date.now() }), { once: true });
      return client(options, signal);
    } });
    slot.session = await openPluginSession({ name: "insomnia-plugin-native-save-" + index, entry: "index.js", format: "commonjs", files: { "index.js": source } }, {
      isCurrent: () => slot.current,
      createWorker: () => {
        const worker = new Worker(url, { type: "module" });
        const record = { index, terminated: false }; records.push(record);
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => { record.terminated = true; terminate(); };
        return worker;
      },
    });
    slot.result = slot.session.invoke("templateTags", 0, [1, defaultPath], {
      isCurrent: () => slot.current, signal: controller.signal, interaction,
      helperCall: (/** @type {any} */ call) => endpoint(call).finally(() => { slot.completed = true; }),
    }).then((/** @type {any} */ value) => { slot.settled = true; return { value }; }, (/** @type {Error} */ error) => { slot.settled = true; return { error: String(error), name: error.name }; });
  },
  id: (/** @type {number} */ index) => slots.get(index)?.id,
  result: (/** @type {number} */ index) => slots.get(index)?.result,
  completed: (/** @type {number} */ index) => slots.get(index)?.completed,
  settled: (/** @type {number} */ index) => slots.get(index)?.settled,
  aborted: (/** @type {number} */ index) => slots.get(index)?.controller.signal.aborted,
  diagnostics: (/** @type {number} */ index) => { const slot = slots.get(index); return { events: slot?.events, saveAborted: slot?.saveSignal?.aborted, completed: slot?.completed }; },
  invalidate(/** @type {number} */ index) { slots.get(index).current = false; },
  cancel(/** @type {number} */ index) { const slot = slots.get(index); slot.current = false; slot.controller.abort(); slot.interaction.dispose(); },
  close() { for (const slot of slots.values()) { slot.current = false; slot.controller.abort(); slot.interaction.dispose(); slot.session?.close(); } },
};
