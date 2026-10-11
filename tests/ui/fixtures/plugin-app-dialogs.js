import { mount } from "svelte";
import TemplatePromptDialog from "../../../src/lib/components/TemplatePromptDialog.svelte";
import { openPluginSession } from "../../../src/lib/plugin-session.js";
import { createPluginAppAsyncHelpers } from "../../../src/lib/plugin-app-async.js";
import { createPluginAppDialogEndpoint } from "../../../src/lib/plugin-app-dialogs.js";
import { createTemplateInteraction } from "../../../src/lib/template-interaction.js";

mount(TemplatePromptDialog, { target: document.body.appendChild(document.createElement("div")) });
const source = `const make=${createPluginAppAsyncHelpers.toString()};exports.templateTags=[{name:'app',async run(c,gen,kind,args){const app=make((method,args)=>__pluginStoreCall(JSON.stringify({generation:gen,helper:__pluginValueCodec.encode({method,args})})).then(__pluginValueCodec.decode),()=>__pluginHelperCurrent(gen));return await app[kind](...args);}}];`;
/** @type {Awaited<ReturnType<typeof openPluginSession>>|undefined} */ let session;
/** @type {AbortController|undefined} */ let controller;
/** @type {ReturnType<typeof createTemplateInteraction>|undefined} */ let interaction;
/** @type {Promise<any>|undefined} */ let result;
/** @type {any[]} */ const records = [];
/** @type {any[]} */ const calls = [];
let current = true;
let generation = 0;
let saveMode = "path";
let completed = 0;
/** @type {((value:string|null)=>void)|undefined} */ let releaseSave;
/** @type {any} */ (window).__pluginAppDialogs = {
  records, calls,
  /** @param {string} url @param {'preview'|'send'|'action'} purpose */
  async open(url, purpose) {
    session?.close(); controller?.abort(); interaction?.dispose();
    current = true; generation = 0; calls.length = 0; completed = 0; saveMode = "path"; releaseSave = undefined;
    controller = new AbortController();
    interaction = createTemplateInteraction();
    session = await openPluginSession({ name: "insomnia-plugin-app-dialog-fixture", format: "commonjs", entry: "index.js", files: { "index.js": source } }, {
      isCurrent: () => current,
      createWorker: () => {
        const worker = new Worker(url, { type: "module" });
        const record = { terminated: false }; records.push(record);
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => { record.terminated = true; terminate(); };
        return worker;
      },
    });
    const endpoint = createPluginAppDialogEndpoint({ purpose, current: () => current, signal: controller.signal, interaction,
      save: async options => {
        calls.push(options);
        if (saveMode === "cancel") return null;
        if (saveMode === "error") throw Error("controlled save failure");
        if (saveMode === "held") return await new Promise(resolve => { releaseSave = resolve; });
        return "fixture-save.txt";
      },
    });
    this.endpoint = (/** @type {any} */ call) => endpoint(call).finally(() => { completed++; });
  },
  /** @param {string} kind @param {any[]} args */
  start(kind, args) {
    result = session?.invoke("templateTags", 0, [++generation, kind, args], {
      isCurrent: () => current, signal: controller?.signal, helperCall: this.endpoint,
      interaction,
    }).then(value => ({ value: value === undefined ? "void" : value }), error => ({ error: String(error), name: error.name }));
  },
  result: () => result,
  mode(/** @type {string} */ mode) { saveMode = mode; },
  releaseSave() { releaseSave?.("late-save.txt"); },
  completed: () => completed,
  cancel() { current = false; controller?.abort(); interaction?.dispose(); },
  invalidate() { current = false; },
  close() { this.cancel(); session?.close(); },
};
