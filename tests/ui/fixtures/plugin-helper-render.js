import { openPluginSession } from "../../../src/lib/plugin-session.js";
import { createPluginRegistry } from "../../../src/lib/plugin-registry.js";
import { installPluginTemplateProvider } from "../../../src/lib/plugin-template-tags.js";
import { createRequestRenderSession } from "../../../src/lib/template-session.js";
import {
  renderSendRequest,
  renderOAuthRequest,
  renderMessageValue,
  renderGrpcRequest,
} from "../../../src/lib/request-render.js";
import { renderRequestPreview } from "../../../src/lib/template-preview.js";
import { resolveQuery } from "../../../src/lib/graphql.js";
import { initialData } from "../../../src/lib/model.js";
import {captureCookieSourceOwner,replaceCookieTemplateSources} from '../../../src/lib/cookie-template-sources.js';
import { mount } from "svelte";
import TemplatePromptDialog from "../../../src/lib/components/TemplatePromptDialog.svelte";
import { askTemplatePrompt } from "../../../src/lib/template-prompt-dialog.js";

// The injected bundle owns its module state; mount the genuine dialog for that
// same queue, rather than borrowing the built application's unrelated singleton.
const promptTarget = document.createElement("div");
document.body.append(promptTarget);
mount(TemplatePromptDialog, { target: promptTarget });

const parent = "insomnia-plugin-render-parent",
  child = "insomnia-plugin-render-child";
/** @type {Record<string,string>} */ const sources = {
  [parent]:
    "exports.templateTags=[{name:'parenthelper',async run(c){const r=await c.util.models.request.getById('r');const nested=await c.util.render('{{ token }}:{% childhelper %}');const sent=await c.network.sendRequest({_id:'r'},{marker:'options'});return r.name+':'+nested+':'+c.util.models.response.getBodyBuffer(sent).toString('hex');}},{name:'siblinghelper',async run(c){return await c.util.render('{{ token }}');}},{name:'selfhelper',async run(c){return await c.util.render('{% siblinghelper %}');}},{name:'mutualhelper',async run(c){return await c.util.render('{% childloop %}')}},{name:'appdialoghelper',async run(c){return await c.app.prompt('Plugin app dialog',{label:'Value',defaultValue:'app default'});}},{name:'prompthelper',async run(c){return await c.util.render(\"{% prompt 'Plugin helper wait', 'Value', 'default' %}\");}},\n{name:'prompttwice',async run(c){const a=c.util.render(\"{% prompt 'Plugin helper first', 'Value', 'first' %}\");const b=c.util.render(\"{% prompt 'Plugin helper second', 'Value', 'second' %}\");return (await Promise.all([a,b])).join(':');}},\n{name:'promptcpu',async run(c){const prompt=c.util.render(\"{% prompt 'Plugin helper CPU', 'Value', 'default' %}\");await c.network.sendRequest({_id:'probe-after-prompt'});while(true){};return await prompt;}}];",
  [child]:
    "exports.templateTags=[{name:'childhelper',async run(c){const w=await c.util.models.workspace.getById('w');const jar=await c.util.models.cookieJar.getOrCreateForWorkspace(w);return (await c.util.render('{{ token }}'))+':'+jar.parentId;}},{name:'childloop',async run(c){return await c.util.render('{% siblinghelper %}');}}];",
};
sources[parent] += "\nexports.templateTags.push({name:'entryextra',run(c){const first=c.context.getExtraInfo('marker');first.value='guest-mutated';return c.context.getExtraInfo('marker').value;}});";
sources[parent] += "\nexports.templateTags.push({name:'jsonoutput',run(){return " + JSON.stringify('quote" slash\\ newline\nไทย') + ";}});";
/** @type {Record<string,any>[]} */ const resources = [
  { _id: "w", _type: "workspace", name: "Workspace" },
  {
    _id: "env",
    _type: "environment",
    parentId: "w",
    data: { token: "environment" },
  },
  {
    _id: "r",
    _type: "request",
    parentId: "w",
    name: "Saved request",
    url: "http://example.test",
  },
];
/** @type {any[]} */ const records = [];
/** @type {any[]} */ const calls = [];
/** @type {ReturnType<typeof createPluginRegistry>|undefined} */ let registry;
/** @type {ReturnType<typeof createRequestRenderSession>|undefined} */ let renderer;
/** @type {(()=>void)|undefined} */ let remove;
/** @type {((value:any)=>void)|undefined} */ let release;
/** @type {Promise<any>|undefined} */ let result;
/** @type {AbortController|undefined} */ let entryController;
let owner = {},
  held = false;
/** @type {Record<string,any>[]|null} */ let cookieOwnerResources=null;
const ActualWorker = window.Worker;
/** @returns {NonNullable<Parameters<typeof createRequestRenderSession>[1]['pluginServices']>} */
function services() {
  return {
    getData: () => ({ resources, history: [] }),
    send: async (request, extra, signal, path) => {
      calls.push({ method: "send", request, extra, path });
      if (request._id === "probe-after-prompt")
        await new Promise((resolve) => setTimeout(resolve, 300));
      if (held)
        await new Promise((resolve) => {
          release = resolve;
        });
      signal.throwIfAborted();
      return {
        _id: "sent",
        requestId: request._id,
        status: 202,
        headers: [],
        bodyBase64: "AP8=",
      };
    },
    cookieJar: async (workspace, signal) => {
      signal.throwIfAborted();
      calls.push({ method: "cookie", workspace });
      return { _id: "jar", parentId: workspace._id };
    },
  };
}
/** @type {any} */ (window).__pluginRenderFixture = {
  records,
  calls,
  /** @param {{plugin:string,template:string}} urls @param {{cookieSourcesOnly?:boolean}} [options] */
  async open(urls,options={}) {
    entryController?.abort();
    renderer?.dispose();
    registry?.dispose();
    remove?.();
    records.length = 0;
    calls.length = 0;
    release = undefined;
    owner = {};
    held = false;
    window.Worker = class extends ActualWorker {
      /** @param {string|URL} url @param {WorkerOptions} [options] */
      constructor(url, options) {
        const pathname = new URL(String(url), location.href).pathname;
        const mapped = pathname.endsWith("/template.worker.js")
          ? urls.template
          : String(url);
        super(mapped, options);
        const record = {
          url: mapped,
          terminated: false,
          messages: /** @type {any[]} */ ([]),
          sent: /** @type {any[]} */ ([]),
        };
        records.push(record);
        const post = this.postMessage.bind(this);
        this.postMessage = (
          /** @type {any} */ message,
          /** @type {Transferable[]|StructuredSerializeOptions} */ options = [],
        ) => {
          record.sent.push({
            type: message?.type,
            callbackId: message?.callbackId,
            id: message?.id,
            waiting: message?.waiting,
            interactive: message?.interactive,
          });
          if (Array.isArray(options)) post(message, options);
          else post(message, options);
        };
        this.addEventListener("message", (e) => record.messages.push(e.data));
        const terminate = this.terminate.bind(this);
        this.terminate = () => {
          record.terminated = true;
          terminate();
        };
      }
    };
    if(options.cookieSourcesOnly)return;
    const settings = {
      pluginDirectories: ["fixture"],
      pluginPathMigrationVersion: 1,
    };
    registry = createPluginRegistry({
      getContext: () => ({ owner, settings, ready: true }),
      discover: async () => ({
        report: {
          complete: true,
          packages: [parent, child].map((name) => ({
            name,
            version: "1.0.0",
            status: "execution-pending",
            directory: "fixture/" + name,
            entry: "fixture/" + name + "/index.js",
            format: "commonjs",
          })),
        },
      }),
      readPackage: async (directory) => {
        const name = directory.split("/").at(-1);
        if (!name || !sources[name]) throw Error("Unknown fixture");
        return {
          name,
          entry: "index.js",
          format: "commonjs",
          files: {
            "index.js": sources[name],
            "package.json": JSON.stringify({
              name,
              version: "1.0.0",
              main: "index.js",
            }),
          },
        };
      },
      openSession: (snapshot, options) =>
        openPluginSession(snapshot, {
          ...options,
          createWorker: () => new Worker(urls.plugin, { type: "module" }),
        }),
    });
    remove = installPluginTemplateProvider(() => ({
      tags: registry?.captureTemplateTags() ?? [],
      isCurrent: () => true,
    }));
    await registry.prepare(parent);
    await registry.prepare(child);
  },
  async reload() {
    await registry?.prepare(parent);
    await registry?.prepare(child);
  },
  startCookieSourceOwner(){
    renderer?.dispose();remove?.();
    cookieOwnerResources=replaceCookieTemplateSources([...resources],'w',[
      {key:'session',value:'owned',domain:'example.invalid',path:'/'}]);
    remove=installPluginTemplateProvider(snapshot=>({tags:[],isCurrent:()=>true,
      cookieSourcesCurrent:captureCookieSourceOwner(snapshot.resources,'w',()=>cookieOwnerResources)}));
    renderer=createRequestRenderSession({}, {purpose:'send',requestId:'r',workspaceId:'w',
      resources:cookieOwnerResources,signal:new AbortController().signal,
      ask:(title,options,signal)=>askTemplatePrompt(title,{...options,submitName:'Resume source'},signal)});
    result=renderer.render('{% prompt "Source owner", "Value", "", "", false, false %}').then(
      value=>({value}),error=>({name:error.name,error:String(error)}));
  },
  /** @param {'foreign'|'remove'} mode */
  mutateCookieSourceOwner(mode){
    if(!cookieOwnerResources)throw Error('Cookie owner fixture is not active');
    cookieOwnerResources=mode==='remove'?replaceCookieTemplateSources(cookieOwnerResources,'w',[]):
      [...cookieOwnerResources,{_id:'foreign_source',_type:'cookie_jar',parentId:'foreign',_activeTemplateCookieSource:true,cookies:[]}];
  },
  /** @param {string} text @param {boolean} [hold] @param {{tamperServices?:boolean,ancestry?:string[],mutateAncestry?:boolean,promptSubmit?:string,json?:boolean}} [options] */
  start(text, hold = false, options = {}) {
    entryController?.abort();
    renderer?.dispose();
    calls.length = 0;
    held = hold;
    release = undefined;
    const pluginServices = services();
    const ancestry = options.ancestry ?? [];
    renderer = createRequestRenderSession(
      { token: "environment" },
      {
        purpose: "send",
        requestId: "r",
        workspaceId: "w",
        resources,
        signal: new AbortController().signal,
        pluginServices,
        pluginHelperPath: ancestry,
        ask: async (title, promptOptions, signal) => {
          const value = await askTemplatePrompt(title, { ...promptOptions, submitName: options.promptSubmit }, signal);
          if ([...document.querySelectorAll("dialog")].some(dialog => dialog.open && dialog.querySelector("h2")?.textContent === title))
            throw Error("Prompt still open when host continuation resumes");
          return value;
        },
      },
    );
    if (options.tamperServices)
      pluginServices.send = async () => {
        throw Error("Replaced service endpoint");
      };
    if (options.mutateAncestry) ancestry.length = 0;
    result = (options.json ? renderer.renderValue(text,{jsonPaths:[""]}) : renderer.render(text)).then(
      (value) => ({ value }),
      (error) => ({ name: error.name, error: String(error) }),
    );
  },
  /** @param {string} kind @param {boolean} [cycle] @param {boolean} [hold] @param {boolean} [tamper] @param {boolean} [extra] */
  startEntry(kind, cycle = false, hold = false, tamper = false, extra = false) {
    renderer?.dispose();
    entryController?.abort();
    entryController = new AbortController();
    const signal = entryController.signal;
    held = hold;
    release = undefined;
    calls.length = 0;
    const data = {
      ...initialData(),
      resources,
      activeWorkspaceId: "w",
      activeRequestId: "r",
      activeEnvironmentId: "",
      history: [],
    };
    const request = {
      ...resources.find((r) => r._id === "r"),
      headers: [],
      parameters: [],
      authentication: {},
      body: { mimeType: "text/plain", text: "" },
    };
    const options = {
      pluginServices: services(),
      pluginHelperPath: cycle ? [parent] : [],
      pluginExtraInfo: [{name:"marker",value:{value:"original"}}],
    };
    const text = extra ? "{% entryextra %}" : "{% parenthelper %}";
    const pending = (async () => {
      if (kind === "http") {
        request.body.text = text;
        return (await renderSendRequest(data, request, signal, options)).request
          .body.text;
      }
      if (kind === "oauth") {
        request.authentication = {
          type: "basic",
          username: text,
          password: "",
        };
        return (await renderOAuthRequest(data, request, signal, options))
          .authentication.username;
      }
      if (kind === "message")
        return await renderMessageValue(
          data,
          request,
          text,
          signal,
          async () => null,
          options,
        );
      if (kind === "grpc") {
        const grpc = {
          ...request,
          _type: "grpc_request",
          metadata: [{ name: "x-helper", value: text }],
        };
        return (
          await renderGrpcRequest(data, grpc, signal, async () => null, options)
        ).metadata[0].value;
      }
      if (kind === "graphql") {
        request.body = {
          mimeType: "application/graphql",
          text: JSON.stringify({ query: text, variables: {} }),
        };
        return JSON.parse(
          (await resolveQuery(data, request, signal, options)).body,
        ).query;
      }
      if (kind === "preview")
        return await renderRequestPreview(
          text,
          {},
          { ...options, requestId: "r", workspaceId: "w", resources, signal },
        );
      throw Error("Unknown helper render entrypoint");
    })();
    if (tamper) {
      options.pluginServices.send = async () => {
        throw Error("Replaced service during entrypoint await");
      };
      options.pluginHelperPath.push(parent);
      options.pluginExtraInfo[0].value.value = "host-mutated";
    }
    result = pending.then(
      (value) => ({ value }),
      (error) => ({ name: error.name, error: String(error) }),
    );
  },
  result: () => result,
  cancel() {
    entryController?.abort();
    renderer?.dispose();
  },
  invalidate() {
    owner = {};
    registry?.synchronize();
  },
  release() {
    release?.(null);
  },
  state: () => registry?.read(),
  close() {
    entryController?.abort();
    release?.(null);
    renderer?.dispose();
    registry?.dispose();
    remove?.();
    window.Worker = ActualWorker;
  },
};
