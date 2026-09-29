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

/** Snapshot one request's render inputs and own all child workers/interactions.
 * Caller must dispose the session after rendering its fields.
 * @param {Record<string, any>} context
 * @param {{purpose:'preview'|'send', requestId:string, workspaceId?:string,
 * resources:Record<string,any>[], history?:Record<string,any>[], environmentId?:string|null,
 * signal:AbortSignal, ask?:typeof askTemplatePrompt,
 * responseResolver?:(args:any[],signal:AbortSignal)=>any|Promise<any>,
 * environmentLayers?:{data:Record<string,any>,order?:Record<string,any>|null}[]}} options
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
    workspaceId: options.workspaceId,
    resources: options.resources,
    history: options.history || [],
    environmentId: options.environmentId,
  });
  options.signal.throwIfAborted();
  const native = nativeTemplateTags(snapshot);
  const cookie = native?.cookie;
  const ask = options.ask || askTemplatePrompt;
  const controller = new AbortController();
  const interaction = createTemplateInteraction();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeout;
  const abort = () => controller.abort(options.signal.reason);
  const cleanup = () => {
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

  /** @param {string} input @param {AbortSignal} signal @param {string[]} chain @param {{count:number}} budget @param {Record<string,any>} renderContext */
  const run = async (input, signal, chain, budget, renderContext) => {
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
        interactivePrompts: purpose === "send",
        interaction: purpose === "send" ? interaction : undefined,
        tags: {
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
      controller.abort(
        new DOMException("Template render session ended", "AbortError"),
      );
    },
  };
}
