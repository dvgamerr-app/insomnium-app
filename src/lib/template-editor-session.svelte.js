import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import { workspace, createWorkspaceWorkScope } from "./workspace.svelte.js";
import { requestDataScope } from "./request-scope.js";
import { environmentFor, environmentSourcesFor, workspaceFor } from "./model.js";
import { environmentPaths } from "./editor-completion.js";
import {
  builtinTagDefinitions,
  resolveBuiltinTag,
} from "./template-builtin-definitions.js";
import {
  capturePluginTemplateTags,
  pluginRenderSourceKey,
} from "./plugin-template-tags.js";
import { renderRequestPreview } from "./template-preview.js";
import { clearPromptValues } from "./template-prompt.js";

/** Each dialog captures its collection/request/environment and participates in
 * the existing workspace drain. Changing any source requires reopening it.
 * @param {string} requestId */
export function createTemplateEditorSession(requestId) {
  return createEditorSession(requestId);
}

/** Environment editing retains legacy active-request context when present;
 * otherwise preview has collection context and an explicit n/a request meta.
 * The saved environment being edited is an additional owner, not a fake request.
 * @param {string} environmentId */
export function createEnvironmentTemplateEditorSession(environmentId) {
  const environment = workspace.data.resources.find(
    (item) => item._id === environmentId && item._type === "environment",
  );
  const workspaceId = workspaceFor(workspace.data.resources, environmentId);
  if (
    !environment ||
    !workspaceId ||
    workspaceId !== workspace.data.activeWorkspaceId
  )
    throw Error("Environment collection no longer exists");
  const expectedEnvironment = JSON.stringify(environment);
  const activeRequestId = workspace.data.activeRequestId;
  const activeResource = workspace.data.resources.find((item) => item._id === activeRequestId);
  const request = activeResource &&
    ["request", "grpc_request"].includes(activeResource._type) &&
    workspaceFor(workspace.data.resources, activeResource._id) === workspaceId
      ? activeResource : undefined;
  return createEditorSession(
    request?._id ?? workspaceId,
    () =>
      workspace.data.activeWorkspaceId === workspaceId &&
      workspace.data.activeRequestId === activeRequestId &&
      workspace.data.resources.find((item) => item._id === activeRequestId) === activeResource &&
      workspace.data.resources.find((item) => item._id === environmentId) === environment &&
      JSON.stringify(environment) === expectedEnvironment,
  );
}

/** @param {string} requestId @param {()=>boolean} [ownerCurrent] */
function createEditorSession(requestId, ownerCurrent = () => true) {
  const scope = createWorkspaceWorkScope(),
    work = scope.begin();
  let closed = false,
    finished = false;
  /** @type {Set<Promise<any>>} */ const pending = new Set();
  function finishClosedWork() {
    if (closed && !finished && !pending.size) {
      finished = true;
      work.finish();
    }
  }
  /** @template {(...args:any[])=>Promise<any>} F @param {F} operation @returns {F} */
  function tracked(operation) {
    return /** @type {F} */ (
      /** @type {unknown} */ (
        (/** @type {any[]} */ ...args) => {
          if (closed)
            return Promise.reject(
              new DOMException("Template editor closed", "AbortError"),
            );
          const execution = Promise.resolve().then(() => operation(...args));
          pending.add(execution);
          void execution
            .finally(() => {
              pending.delete(execution);
              finishClosedWork();
            })
            .catch(() => {});
          return execution;
        }
      )
    );
  }
  try {
    const ownerResource = workspace.data.resources.find((item) => item._id === requestId);
    if (!ownerResource) throw Error("Request no longer exists");
    const data = requestDataScope($state.snapshot(workspace.data), requestId);
    const request = data.resources.find((item) => item._id === requestId);
    if (!request) throw Error("Request no longer exists");
    const general = request._type === "workspace";
    const snapshot = {
      requestId: general ? "n/a" : requestId,
      sourceResourceId: requestId,
      workspaceId: data.activeWorkspaceId,
      resources: data.resources,
      environmentId: data.activeEnvironmentId || null,
    };
    const expected = pluginRenderSourceKey(
      data.resources,
      requestId,
      data.activeEnvironmentId,
    );
    const current = () => {
      if (
        closed ||
        !work.current() ||
        workspace.data.resources.find((item) => item._id === requestId) !== ownerResource ||
        !ownerCurrent() ||
        (general
          ? workspace.data.activeWorkspaceId !== requestId
          : workspace.data.activeRequestId !== requestId)
      )
        return false;
      try {
        const live = requestDataScope(workspace.data, requestId);
        return (
          pluginRenderSourceKey(
            live.resources,
            requestId,
            live.activeEnvironmentId,
          ) === expected
        );
      } catch {
        return false;
      }
    };
    const plugins = capturePluginTemplateTags(snapshot);
    const context = environmentFor(
      data.resources,
      request,
      data.activeEnvironmentId,
    );
    const builtins = builtinTagDefinitions();
    const session = {
      signal: work.signal,
      definitions: [...plugins.definitions, ...builtins],
      resources: data.resources.filter(
        (item) =>
          workspaceFor(data.resources, item._id) === data.activeWorkspaceId,
      ),
      variables: environmentPaths(context),
      .../** @type {{variableSources?:ReturnType<typeof environmentSourcesFor>}} */ ({variableSources:environmentSourcesFor(data.resources,request,data.activeEnvironmentId)}),
      isCurrent: () => current() && plugins.isCurrent(),
      /** @param {string} name @param {any[]} args @param {{signal:AbortSignal,isCurrent:()=>boolean}} operation */
      async queryMetadata(name, args, operation) {
        const live = () =>
          current() &&
          operation.isCurrent() &&
          !operation.signal.aborted &&
          !work.signal.aborted;
        if (!live())
          throw new DOMException("Template editor owner changed", "AbortError");
        if (builtins.some((item) => item.name === name)) {
          const resolved = resolveBuiltinTag(name, args[0], args[1]);
          if (!live())
            throw new DOMException(
              "Template editor owner changed",
              "AbortError",
            );
          return resolved;
        }
        return plugins.queryMetadata(name, args, {
          signal: operation.signal,
          isCurrent: live,
        });
      },
      /** @param {string} text @param {{signal:AbortSignal,isCurrent:()=>boolean}} operation */
      async renderPreview(text, operation) {
        if (!current() || !operation.isCurrent())
          throw new DOMException("Template editor owner changed", "AbortError");
        const controller = new AbortController();
        const abort = () => controller.abort();
        work.signal.addEventListener("abort", abort, { once: true });
        operation.signal.addEventListener("abort", abort, { once: true });
        if (work.signal.aborted || operation.signal.aborted) abort();
        try {
          const rendered = await renderRequestPreview(text, context, {
            ...snapshot,
            history: data.history ?? [],
            signal: controller.signal,
          });
          if (!current() || !operation.isCurrent())
            throw new DOMException(
              "Template editor owner changed",
              "AbortError",
            );
          return rendered;
        } finally {
          work.signal.removeEventListener("abort", abort);
          operation.signal.removeEventListener("abort", abort);
        }
      },
      /** @param {string} name @param {number} index @param {{signal:AbortSignal,isCurrent:()=>boolean}} operation */
      async runAction(name, index, operation) {
        const live = () =>
          current() &&
          plugins.isCurrent() &&
          operation.isCurrent() &&
          !operation.signal.aborted &&
          !work.signal.aborted;
        if (!live())
          throw new DOMException("Template editor owner changed", "AbortError");
        if (builtins.some((item) => item.name === name)) {
          if (name !== "prompt" || index !== 0)
            throw Error("Template tag action is unavailable");
          clearPromptValues();
          return;
        }
        await plugins.runAction(name, index, {
          signal: operation.signal,
          isCurrent: live,
        });
      },
      choosePath: isTauri()
        ? async (
            /** @type {'file'|'directory'} */ kind,
            /** @type {Record<string,any>} */ argument,
          ) => {
            if (!current())
              throw new DOMException(
                "Template editor owner changed",
                "AbortError",
              );
            const selected = await open({
              directory: kind === "directory",
              multiple: false,
              title: kind === "directory" ? "Choose folder" : "Choose file",
              ...(kind === "file" && argument.extensions?.length
                ? {
                    filters: [
                      {
                        name: "Files",
                        extensions: argument.extensions.map(
                          (/** @type {string} */ extension) =>
                            extension.replace(/^\*?\./, ""),
                        ),
                      },
                    ],
                  }
                : {}),
            });
            return current() && typeof selected === "string" ? selected : null;
          }
        : undefined,
      close() {
        if (closed) return;
        closed = true;
        work.cancel();
        scope.dispose();
        finishClosedWork();
      },
    };
    session.queryMetadata = tracked(session.queryMetadata);
    session.renderPreview = tracked(session.renderPreview);
    session.runAction = tracked(session.runAction);
    if (session.choosePath) session.choosePath = tracked(session.choosePath);
    return session;
  } catch (failure) {
    work.cancel();
    work.finish();
    scope.dispose();
    throw failure;
  }
}
