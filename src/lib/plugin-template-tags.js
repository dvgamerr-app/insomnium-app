// Application-owned provider; renderer modules never import workspace state.
import { requestEnvironmentLayers } from "./template-environment.js";
import { workspaceFor } from "./model.js";
import {
  builtinTemplateNames,
  isTemplateTagName,
} from "./template-registration.js";
export { builtinTemplateNames } from "./template-registration.js";
/** @typedef {{definition:Record<string,any>,plugin:string,index:number,isCurrent:()=>boolean,invoke:(args:any[],operation:{isCurrent:()=>boolean,signal:AbortSignal,context:Record<string,any>})=>Promise<any>,queryMetadata?:(args:any[],operation:{isCurrent:()=>boolean,signal:AbortSignal})=>Promise<any>,runAction?:(index:number,operation:{isCurrent:()=>boolean,signal:AbortSignal})=>Promise<any>}} CapturedTag */
/** @type {(snapshot:Record<string,any>)=>{tags:CapturedTag[],isCurrent:()=>boolean}} */
let provider = () => ({ tags: [], isCurrent: () => true });
/** Match the exact request, collection and inherited environment inputs consumed
 * by this renderer. History/token updates and unrelated requests cannot invalidate it.
 * @param {Record<string,any>[]} resources @param {string} requestId @param {string|null|undefined} environmentId */
export function pluginRenderSourceKey(resources, requestId, environmentId) {
  const request = resources.find((item) => item._id === requestId);
  if (!request) throw Error("Plugin render request no longer exists");
  return JSON.stringify([
    request,
    workspaceFor(resources, requestId),
    environmentId || null,
    requestEnvironmentLayers(resources, requestId, environmentId),
  ]);
}

/** @param {typeof provider} next */
export function installPluginTemplateProvider(next) {
  provider = next;
  return () => {
    if (provider === next)
      provider = () => ({ tags: [], isCurrent: () => true });
  };
}

/** Last discovered custom definition wins; legacy local definitions win every
 * built-in collision. Priority controls presentation, never the collision winner.
 * @param {Record<string,any>} snapshot */
export function capturePluginTemplateTags(snapshot) {
  const captured = provider(snapshot);
  const winners = new Map();
  captured.tags.forEach((tag, order) => {
    const name = tag.definition.name;
    if (builtinTemplateNames.includes(name)) return;
    if (!isTemplateTagName(name))
      throw Error("Unsupported custom template tag name: " + String(name));
    winners.set(name, {
      ...tag,
      priority: tag.definition.priority || order || -1,
    });
  });
  if (winners.size + builtinTemplateNames.length > 64)
    throw Error("Template extension registration limit exceeded");
  const tags = Array.from(winners.values()).sort((a, b) =>
    a.priority > b.priority ? 1 : -1,
  );
  const current = () =>
    captured.isCurrent() && tags.every((tag) => tag.isCurrent());
  return {
    names: tags.map((tag) => tag.definition.name),
    definitions: tags.map((tag) => ({
      ...tag.definition,
      plugin: tag.plugin,
      priority: tag.priority,
    })),
    /** Query the same collision winner used for rendering. No helper capabilities
     * are supplied, and both catalog/resource and dialog-operation owners apply.
     * @param {string} name @param {any[]} args
     * @param {{signal:AbortSignal,isCurrent:()=>boolean}} operation */
    async queryMetadata(name, args, operation) {
      const tag = tags.find((item) => item.definition.name === name);
      const live = () =>
        !operation.signal.aborted && current() && operation.isCurrent();
      if (!tag || !live())
        throw new DOMException("Plugin editor owner changed", "AbortError");
      if (!tag.queryMetadata)
        throw Error("Plugin metadata query is unavailable");
      const result = await tag.queryMetadata(args, {
        signal: operation.signal,
        isCurrent: live,
      });
      if (!live())
        throw new DOMException("Plugin editor owner changed", "AbortError");
      return { ...result, plugin: tag.plugin, priority: tag.priority };
    },
    /** The legacy action contract supplies only the namespaced store facade.
     * @param {string} name @param {number} index
     * @param {{signal:AbortSignal,isCurrent:()=>boolean}} operation */
    async runAction(name, index, operation) {
      const tag = tags.find((item) => item.definition.name === name);
      const live = () =>
        !operation.signal.aborted && current() && operation.isCurrent();
      if (!tag || !live())
        throw new DOMException("Plugin editor owner changed", "AbortError");
      if (!tag.runAction) throw Error("Template tag action is unavailable");
      await tag.runAction(index, { signal: operation.signal, isCurrent: live });
      if (!live())
        throw new DOMException("Plugin editor owner changed", "AbortError");
    },
    /** @param {Record<string,any>} context @param {AbortSignal} signal @param {'preview'|'send'} purpose @param {()=>boolean} isCurrent */
    handlers(context, signal, purpose, isCurrent) {
      return Object.fromEntries(
        tags.map((tag) => [
          tag.definition.name,
          (
            /** @type {any[]} */ args,
            /** @type {AbortSignal} */ childSignal,
          ) => {
            const live = () =>
              !signal.aborted &&
              !childSignal.aborted &&
              current() &&
              isCurrent();
            if (!live())
              throw new DOMException(
                "Plugin render owner changed",
                "AbortError",
              );
            return tag
              .invoke(args, {
                isCurrent: live,
                signal: childSignal,
                context: {
                  context: { ...context, _: context },
                  meta: {
                    requestId: snapshot.requestId,
                    workspaceId: snapshot.workspaceId ?? "n/a",
                  },
                  renderPurpose: purpose === "send" ? "send" : "general",
                },
              })
              .then((/** @type {any} */ value) => {
                if (!live())
                  throw new DOMException(
                    "Plugin render owner changed",
                    "AbortError",
                  );
                // CallExtensionAsync concatenates suppressValue with autoescape
                // disabled: preserve that coercion before the JSON worker bridge.
                return value == null ? "" : String(value);
              });
          },
        ]),
      );
    },
    isCurrent: current,
  };
}
