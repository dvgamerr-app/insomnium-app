import {
  createRenderDeadline,
  RENDER_ACTIVE_MS,
  PROMPT_TOTAL_MS,
} from "./template-deadline.js";
import {
  builtinTemplateNames,
  nativeTemplateNames,
  isTemplateTagName,
} from "./template-registration.js";
import { createPluginValueCodec } from "./plugin-values.js";
/**
 * One disposable worker per render. Native handlers stay on the application side;
 * only explicitly registered native tag names and structured values cross it.
 * @param {string} text @param {Record<string, any>} context
 * @param {{interaction?:{subscribe:(listener:(waiting:boolean)=>void)=>()=>void}, interactivePrompts?:boolean, mode?: 'all'|'variables'|'tags', signal?: AbortSignal,
 * customTagNames?:string[], tags?: Record<string,
 * (args: any[], signal: AbortSignal) => any | Promise<any>>}} [options]
 * @returns {Promise<string>}
 */
export function renderTemplate(text, context, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException("Template render cancelled", "AbortError"));
      return;
    }
    /** @type {Record<string, (args: any[], signal: AbortSignal) => any>} */
    const handlers = { ...options.tags };
    const names = Object.keys(handlers);
    const customNames = options.customTagNames ?? [];
    const argumentCodec = createPluginValueCodec();
    if (
      !Array.isArray(customNames) ||
      customNames.length > 53 ||
      new Set(customNames).size !== customNames.length ||
      customNames.some(
        (name) =>
          !isTemplateTagName(name) || builtinTemplateNames.includes(name),
      )
    ) {
      reject(new Error("Invalid custom template tag registration"));
      return;
    }
    if (
      names.some(
        (name) =>
          (!nativeTemplateNames.includes(name) &&
            !customNames.includes(name)) ||
          typeof handlers[name] !== "function",
      )
    ) {
      reject(new Error("Invalid native template tag registration"));
      return;
    }
    if (customNames.some((name) => !Object.hasOwn(handlers, name))) {
      reject(new Error("Missing custom template tag handler"));
      return;
    }
    if (
      options.interactivePrompts !== undefined &&
      typeof options.interactivePrompts !== "boolean"
    ) {
      reject(new Error("Invalid interactive template policy"));
      return;
    }
    if (
      options.interaction &&
      (!options.interactivePrompts ||
        typeof options.interaction.subscribe !== "function")
    ) {
      reject(new Error("Invalid shared template interaction policy"));
      return;
    }
    const controller = new AbortController();
    const seen = new Set();
    /** @type {Worker | undefined} */ let worker;
    /** @type {ReturnType<typeof createRenderDeadline> | undefined} */ let deadline;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let heartbeatTimeout;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let hardTimeout;
    const waitingPrompts = new Set();
    let sharedWaiting = false;
    /** @type {(() => void) | undefined} */ let unsubscribeInteraction;
    /** @type {(() => void) | undefined} */ let resumeInteraction;
    let settled = false;
    const finish = (
      /** @type {string | undefined} */ value,
      /** @type {Error | undefined} */ error,
    ) => {
      if (settled) return;
      settled = true;
      deadline?.dispose();
      unsubscribeInteraction?.();
      clearTimeout(heartbeatTimeout);
      clearTimeout(hardTimeout);
      options.signal?.removeEventListener("abort", abort);
      worker?.terminate();
      controller.abort();
      if (error) reject(error);
      else resolve(value || "");
    };
    const abort = () =>
      finish(
        undefined,
        new DOMException("Template render cancelled", "AbortError"),
      );
    const watchHeartbeat = () => {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = setTimeout(
        () =>
          finish(
            undefined,
            new DOMException(
              "Template renderer stopped responding",
              "TimeoutError",
            ),
          ),
        RENDER_ACTIVE_MS,
      );
    };
    const reply = (/** @type {any} */ message) => {
      if (settled) return;
      try {
        worker?.postMessage(message);
      } catch (error) {
        finish(undefined, new Error(String(error)));
      }
    };
    try {
      worker = new Worker(new URL("./template.worker.js", import.meta.url), {
        type: "module",
      });
      options.signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = (event) => {
        if (settled) return;
        const message = event.data;
        if (message?.type === "heartbeat" && options.interactivePrompts) {
          if (waitingPrompts.size || sharedWaiting) watchHeartbeat();
          return;
        }
        if (message?.type === "tag") {
          const { id, name } = message;
          let args;
          try {
            args = customNames.includes(name)
              ? argumentCodec.decode(message.argsWire)
              : message.args;
          } catch {
            finish(
              undefined,
              new Error("Invalid custom template tag arguments"),
            );
            return;
          }
          if (
            !Number.isSafeInteger(id) ||
            id < 1 ||
            seen.has(id) ||
            seen.size >= 1000 ||
            !Object.hasOwn(handlers, name) ||
            !Array.isArray(args) ||
            args.length > 32
          ) {
            finish(undefined, new Error("Invalid native template tag call"));
            return;
          }
          seen.add(id);
          const interactive = name === "prompt" && options.interactivePrompts;
          const resume = interactive ? deadline?.pause() : undefined;
          if (interactive) {
            waitingPrompts.add(id);
            if (waitingPrompts.size === 1 && !sharedWaiting) watchHeartbeat();
          }
          Promise.resolve()
            .then(() => {
              if (settled)
                throw new DOMException(
                  "Template render cancelled",
                  "AbortError",
                );
              return handlers[name](args, controller.signal);
            })
            .then((value) => {
              if (settled) return;
              const serialized = JSON.stringify({ value });
              if (serialized.length > 20 * 1024 * 1024)
                throw new Error("Template tag result exceeds 20 Mi characters");
              reply({
                type: "tag-result",
                id,
                value: JSON.parse(serialized).value,
              });
            })
            .catch((error) => {
              if (
                ["AbortError", "TimeoutError", "TemplateLimitError"].includes(
                  error?.name,
                )
              ) {
                finish(undefined, error);
                return;
              }
              reply({
                type: "tag-result",
                id,
                error: error instanceof Error ? error.message : String(error),
              });
            })
            .finally(() => {
              resume?.();
              waitingPrompts.delete(id);
              if (!waitingPrompts.size && !sharedWaiting)
                clearTimeout(heartbeatTimeout);
            });
          return;
        }
        if (
          message?.type !== "result" ||
          (typeof message.text !== "string" &&
            typeof message.error !== "string")
        ) {
          finish(undefined, new Error("Invalid template result"));
          return;
        }
        finish(
          message.text,
          typeof message.error === "string"
            ? new Error(message.error)
            : undefined,
        );
      };
      worker.onerror = () =>
        finish(undefined, new Error("Could not load template renderer"));
      worker.onmessageerror = () =>
        finish(undefined, new Error("Could not read template result"));
      deadline = createRenderDeadline(RENDER_ACTIVE_MS, () =>
        finish(
          undefined,
          new DOMException(
            "Template rendering exceeded 5 seconds",
            "TimeoutError",
          ),
        ),
      );
      if (options.interactivePrompts)
        hardTimeout = setTimeout(
          () =>
            finish(
              undefined,
              new DOMException(
                "Template prompting exceeded 10 minutes",
                "TimeoutError",
              ),
            ),
          PROMPT_TOTAL_MS,
        );
      worker.postMessage({
        type: "render",
        text,
        context,
        mode: options.mode || "all",
        tags: names,
        customTagNames: customNames,
        interactivePrompts: options.interactivePrompts || false,
      });
      unsubscribeInteraction = options.interaction?.subscribe((waiting) => {
        if (settled || sharedWaiting === waiting) return;
        sharedWaiting = waiting;
        if (waiting) {
          resumeInteraction = deadline?.pause();
          if (settled) return;
          if (!waitingPrompts.size) watchHeartbeat();
        } else {
          resumeInteraction?.();
          resumeInteraction = undefined;
          if (!waitingPrompts.size) clearTimeout(heartbeatTimeout);
        }
        reply({ type: "interaction", waiting });
      });
    } catch (error) {
      finish(
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  });
}
