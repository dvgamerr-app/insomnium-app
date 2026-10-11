import { promptTemplateTag } from "./template-prompt.js";
import { askTemplatePrompt } from "./template-prompt-dialog.js";
import { responseTemplatePreview } from "./template-response.js";
import { renderTemplate } from "./template-client.js";
import { nativeTemplateTags } from "./template-native.js";
import { requestTemplateTag } from "./template-request.js";
import { createTemplateInteraction } from "./template-interaction.js";
import { buildTemplateEnvironment } from "./template-environment.js";
import { renderTemplateValue, TemplateLimitError } from "./template-object.js";
import { PROMPT_TOTAL_MS } from "./template-deadline.js";
import { capturePluginTemplateTags } from "./plugin-template-tags.js";
import { createPluginHelperDispatcher } from "./plugin-helper-dispatcher.js";
import { createPluginAppDialogEndpoint } from "./plugin-app-dialogs.js";
import { createPluginNativeAppEndpoint } from "./plugin-app-native.js";
import {createPluginDomRenderOwner} from "./plugin-dom-render-owner.js";
import {completePluginRequest,linkPluginRequestSignal} from "./plugin-request-lifetime.js";

/** Explicit host capabilities, carried separately from template data.
 * @typedef {Pick<Parameters<typeof createRequestRenderSession>[1], 'pluginServices'|'pluginHelperPath'|'pluginExtraInfo'>} PluginRenderOptions */

/** Capture capabilities before a caller's first native or renderer await.
 * @param {PluginRenderOptions} options
 * @returns {{pluginServices:PluginRenderOptions['pluginServices'],pluginHelperPath:string[],pluginExtraInfo:{name:string,value:any}[]}} */
export function capturePluginRenderOptions(options) {
  const services = options.pluginServices
    ? Object.freeze({
        getData: options.pluginServices.getData,
        send: options.pluginServices.send,
        cookieJar: options.pluginServices.cookieJar,
        isCurrent: options.pluginServices.isCurrent === undefined ? (()=>true) : options.pluginServices.isCurrent,
      })
    : undefined;
  if (
    services &&
    Object.values(services).some((fn) => typeof fn !== "function")
  )
    throw Error("Plugin helper services are incomplete");
  const rootPluginPath = structuredClone(options.pluginHelperPath ?? []);
  const pluginExtraInfo = structuredClone(options.pluginExtraInfo ?? []);
  if (!Array.isArray(pluginExtraInfo) || pluginExtraInfo.some(item =>
    !item || typeof item !== "object" || Array.isArray(item) ||
    typeof item.name !== "string" || !Object.hasOwn(item, "value")))
    throw Error("Invalid plugin extra render information");
  if (
    !Array.isArray(rootPluginPath) ||
    rootPluginPath.length > 12 ||
    rootPluginPath.some((p) => typeof p !== "string" || !p)
  )
    throw Error("Invalid plugin helper render ancestry");
  return { pluginServices: services, pluginHelperPath: rootPluginPath, pluginExtraInfo };
}

/** Snapshot one request's render inputs and own all child workers/interactions.
 * Caller must dispose the session after rendering its fields.
 * @param {Record<string, any>} context
 * @param {{purpose:'preview'|'send', requestId:string, sourceResourceId?:string, workspaceId?:string,
 * resources:Record<string,any>[], history?:Record<string,any>[], environmentId?:string|null,
 * signal:AbortSignal, ask?:typeof askTemplatePrompt,
 * responseResolver?:(args:any[],signal:AbortSignal)=>any|Promise<any>,
 * environmentLayers?:{data:Record<string,any>,order?:Record<string,any>|null}[],
 * pluginHelperPath?:string[],
 * pluginExtraInfo?:{name:string,value:any}[],
 * pluginServices?:{isCurrent?:()=>boolean,getData:()=>{resources:Record<string,any>[],history?:Record<string,any>[],settings?:Record<string,any>},
 * send:(request:Record<string,any>,extra:any,signal:AbortSignal,path:string[])=>Promise<any>,
 * cookieJar:(workspace:Record<string,any>,signal:AbortSignal)=>Promise<any>}}} options
 */
export function createRequestRenderSession(context, options) {
  options.signal.throwIfAborted();
  const purpose = options.purpose;
  if (purpose !== "preview" && purpose !== "send")
    throw new Error("Unknown template render purpose");
  const snapshot = structuredClone({
    context,
    environmentLayers: options.environmentLayers,
    requestId: options.requestId,
    sourceResourceId: options.sourceResourceId,
    workspaceId: options.workspaceId,
    resources: options.resources,
    history: options.history || [],
    environmentId: options.environmentId,
    extraInfo: options.pluginExtraInfo ?? [],
  });
  options.signal.throwIfAborted();
  const native = nativeTemplateTags(snapshot);
  const plugins = capturePluginTemplateTags(snapshot);
  const cookie = native?.cookie;
  const ask = options.ask || askTemplatePrompt;
  const { pluginServices: services, pluginHelperPath: rootPluginPath } =
    capturePluginRenderOptions(options);
  const controller = new AbortController();
  linkPluginRequestSignal(controller.signal,options.signal);
  const domOwners=new Set(/** @type {ReturnType<typeof createPluginDomRenderOwner>[]} */([]));
  let finishing=false;
  const interaction = createTemplateInteraction();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeout;
  const abort = () => controller.abort(options.signal.reason);
  const cleanup = () => {
    if(!finishing)for(const owner of domOwners)owner.dispose();
    domOwners.clear();
    clearTimeout(timeout);
    options.signal.removeEventListener("abort", abort);
    interaction.dispose();
  };
  controller.signal.addEventListener("abort", cleanup, { once: true });
  options.signal.addEventListener("abort", abort, { once: true });
  timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          purpose === "send"
            ? "Template render session exceeded 10 minutes"
            : "Template preview session exceeded 30 seconds",
          "TimeoutError",
        ),
      ),
    purpose === "send" ? PROMPT_TOTAL_MS : 30000,
  );
  let totalRenders = 0;
  let active = 0;

  /** @param {string} input @param {AbortSignal} signal @param {string[]} chain @param {{count:number}} budget @param {Record<string,any>} renderContext @param {string[]} [pluginPath] @returns {Promise<string>} */
  const run = async (
    input,
    signal,
    chain,
    budget,
    renderContext,
    pluginPath = rootPluginPath,
  ) => {
    signal.throwIfAborted();
    if (++budget.count > 64 || ++totalRenders > 1000 || chain.length > 12) {
      const error = new TemplateLimitError(
        "Request template reference limit exceeded",
      );
      controller.abort(error);
      throw error;
    }
    if (active >= 16)
      throw new TemplateLimitError(
        "Too many concurrent request template renders",
      );
    active++;
    try {
      return await renderTemplate(input, renderContext, {
        signal,
        customTagNames: plugins.names,
        interactivePrompts: purpose === "send",
        interaction: purpose === "send" ? interaction : undefined,
        tags: {
          ...plugins.handlers(
            renderContext,
            controller.signal,
            purpose,
            () => !controller.signal.aborted,
            services
              ? (plugin, childSignal, isCurrent) =>
                  createPluginHelperDispatcher({
                    plugin,
                    ancestors: pluginPath,
                    signal: childSignal,
                    isCurrent,
                    getData: () => services.getData(),
                    render: (text, nestedSignal, nestedPath) =>
                      run(
                        text,
                        nestedSignal,
                        chain,
                        budget,
                        renderContext,
                        nestedPath,
                      ),
                    send: (request, extra, nestedSignal, nestedPath) =>
                      services.send(request, extra, nestedSignal, nestedPath),
                    cookieJar: (workspace, childSignal) =>
                      services.cookieJar(workspace, childSignal),
                    app: createPluginAppDialogEndpoint({
                      purpose,
                      signal: childSignal,
                      current: isCurrent,
                      interaction,
                      prompt: ask,
                    }),
                  })
              : undefined,
            services && purpose === "send" ? interaction : undefined,
            services ? (_plugin,childSignal,current) => createPluginNativeAppEndpoint({signal:childSignal,current}) : undefined,
            services ? (plugin,current)=>{
              const owner=createPluginDomRenderOwner({
              purpose,signal:options.signal,current:()=>current()&&services.isCurrent?.()===true,
              synchronous:(signal,current)=>createPluginNativeAppEndpoint({signal,current}),
              helpers:(signal,current,uiInteraction)=>createPluginHelperDispatcher({
                plugin,ancestors:pluginPath,signal,isCurrent:current,getData:()=>services.getData(),
                send:(request,extra,nestedSignal,nestedPath)=>services.send(request,extra,nestedSignal,nestedPath),
                cookieJar:(workspace,signal)=>services.cookieJar(workspace,signal),
                render:async(text,nestedSignal,nestedPath)=>{
                  const data=services.getData();
                  const child=createRequestRenderSession(renderContext,{...options,signal:nestedSignal,
                    environmentLayers:undefined,
                    resources:data.resources,history:data.history||[],pluginHelperPath:nestedPath,pluginServices:services});
                  try{return await child.render(text);}finally{child.dispose();}
                },
                app:createPluginAppDialogEndpoint({purpose,signal,current,interaction:uiInteraction,prompt:ask}),
              }),
              });domOwners.add(owner);return owner;
            }:undefined,
          ),
          ...native,
          prompt: (args, childSignal) =>
            promptTemplateTag(args, {
              requestId: snapshot.requestId,
              purpose,
              signal: childSignal,
              ask: async (title, promptOptions, promptSignal) => {
                const release = interaction.begin();
                try {
                  return await ask(title, promptOptions, promptSignal);
                } finally {
                  release();
                }
              },
            }),
          response: async (args, childSignal) => {
            if (purpose === "send" && options.responseResolver) {
              // The application owns the wait; guest templates cannot pause deadlines.
              const release = interaction.begin();
              try {
                childSignal.throwIfAborted();
                const result = await options.responseResolver(
                  args,
                  childSignal,
                );
                childSignal.throwIfAborted();
                return result;
              } finally {
                release();
              }
            }
            if (
              purpose === "send" &&
              ["always", "no-history", "when-expired"].includes(
                String(args[3] || "never").toLowerCase(),
              )
            )
              throw new Error(
                "Dependent response sending is not connected yet",
              );
            return responseTemplatePreview(
              snapshot.resources,
              snapshot.history,
              snapshot.environmentId,
              args,
              childSignal,
            );
          },
          request: (args, childSignal) =>
            requestTemplateTag(
              snapshot.resources,
              snapshot.requestId,
              (fieldText, field) => {
                if (chain.includes(field))
                  throw new Error(
                    "Cyclic request template reference: " + field,
                  );
                return run(
                  fieldText,
                  childSignal,
                  [...chain, field],
                  budget,
                  renderContext,
                  pluginPath,
                );
              },
              args,
              cookie
                ? (url, name) => cookie([url, name], childSignal)
                : undefined,
            ),
        },
      });
    } finally {
      active--;
    }
  };
  /** @type {Promise<Record<string,any>>|undefined} */
  let prepared;
  const prepare = () =>
    (prepared ||= snapshot.environmentLayers
      ? buildTemplateEnvironment(
          snapshot.environmentLayers,
          (text, current, field) =>
            run(text, controller.signal, [field], { count: 0 }, current),
          controller.signal,
        )
      : Promise.resolve(snapshot.context));
  /** @param {()=>Promise<any>} action */
  const guarded = async (action) => {
    try {
      controller.signal.throwIfAborted();
      const result = await action();
      controller.signal.throwIfAborted();
      if (plugins.names.length && !plugins.isCurrent())
        throw new DOMException("Plugin render owner changed", "AbortError");
      return result;
    } catch (error) {
      const reason = controller.signal.aborted
        ? controller.signal.reason
        : error;
      controller.abort(reason);
      throw reason;
    }
  };
  /** @param {any} value @param {{path?:string,keepOnError?:boolean,blacklist?:RegExp|null}} [settings] */
  const renderValue = (value, settings = {}) =>
    guarded(async () => {
      const current = await prepare();
      return renderTemplateValue(
        value,
        (text, field) =>
          run(
            text,
            controller.signal,
            field ? [field] : [],
            { count: 0 },
            current,
          ),
        { ...settings, signal: controller.signal },
      );
    });
  return {
    signal: controller.signal,
    /** @param {string} text @param {string} [field] @returns {Promise<string>} */
    render(text, field) {
      return renderValue(text, { path: field });
    },
    renderValue,
    getContext() {
      return guarded(async () => structuredClone(await prepare()));
    },
    dispose() {
      finishing=true;
      completePluginRequest(controller,
        new DOMException("Template render session ended", "AbortError"),
      );
    },
  };
}
