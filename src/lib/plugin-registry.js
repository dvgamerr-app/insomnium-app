import { createPluginValueCodec } from "./plugin-values.js";

/** Application-owned admission and retained-session lifetime. Discovery never
 * executes packages; only explicit prepare does. Callback integration is separate.
 * @param {{getContext:()=>{owner:object,ready:boolean,settings:Record<string,any>},discover:(settings:Record<string,any>)=>Promise<any>,readPackage:(directory:string)=>Promise<any>,openSession:(snapshot:any,options:{isCurrent:()=>boolean,signal:AbortSignal})=>Promise<any>}} adapters */
export function createPluginRegistry(adapters) {
  const records = new Map(),
    listeners = new Set();
  let disposed = false,
    generation = 0;
  /** @type {object|undefined} */ let owner;
  let paths = "";
  let catalogRevision = 0;
  /** @type {Promise<any>|undefined} */ let discovery;
  /** @type {Promise<{loaded:string[],errors:string[]}>|undefined} */ let reloadPromise;
  const aborted = () =>
    new DOMException("Plugin loading is no longer current", "AbortError");
  /** @param {Record<string,any>} settings */
  const pathKey = (settings) =>
    JSON.stringify([
      settings.pluginDirectories ?? [],
      settings.pluginPathMigrationVersion === 1
        ? null
        : (settings.pluginPath ?? null),
    ]);
  /** @param {Record<string,any>} settings @param {string} name */
  const configKey = (settings, name) =>
    JSON.stringify(settings.pluginConfig?.[name] ?? {});
  function read() {
    return Object.fromEntries(
      Array.from(records, ([name, record]) => [
        name,
        {
          status: record.status,
          error: record.error,
          metadata: record.session?.metadata
            ? structuredClone(record.session.metadata)
            : undefined,
        },
      ]),
    );
  }
  function emit() {
    catalogRevision++;
    const state = read();
    for (const listener of listeners) listener(state);
  }
  /** @param {string} [name] */
  function invalidate(name) {
    if (name !== undefined) {
      const record = records.get(name);
      records.delete(name);
      record?.controller.abort();
      record?.session?.close();
    } else {
      generation++;
      discovery = undefined;
      for (const record of records.values()) {
        record.controller.abort();
        record.session?.close();
      }
      records.clear();
    }
    emit();
  }
  function synchronize() {
    const context = adapters.getContext();
    // Track nested configuration changes in the root application's Svelte effect.
    JSON.stringify(context.settings.pluginConfig ?? {});
    const nextPaths = pathKey(context.settings);
    if (!context.ready || owner !== context.owner || paths !== nextPaths) {
      if (records.size || discovery) invalidate();
      owner = context.owner;
      paths = nextPaths;
    }
    for (const [name, record] of records) {
      if (
        context.settings.pluginConfig?.[name]?.disabled === true ||
        record.config !== configKey(context.settings, name)
      )
        invalidate(name);
    }
    return context;
  }
  return {
    read,
    synchronize,
    invalidate,
    /** Reload only sessions explicitly admitted by the user, using fresh discovery
     * and package snapshots. Never load other discovered packages implicitly. */
    reload() {
      if (reloadPromise) return reloadPromise;
      if (disposed) return Promise.reject(aborted());
      const context=synchronize();
      if (!context.ready) return Promise.reject(aborted());
      const names=Array.from(records.entries()).filter(([,record])=>record.status==='ready'||record.reloadAdmitted===true)
        .sort((a,b)=>a[1].order-b[1].order).map(([name])=>name);
      invalidate();
      const epoch=generation, sourcePaths=pathKey(context.settings);
      const current=()=>{const now=adapters.getContext();return !disposed && generation===epoch && now.ready && now.owner===context.owner && pathKey(now.settings)===sourcePaths;};
      const work=(async()=>{
        /** @type {string[]} */ const loaded=[],errors=[];
        for (const name of names) {
          if(!current())throw aborted();
          try {await this.prepare(name);loaded.push(name);}
          catch(error){if(!current())throw aborted();const record=records.get(name);if(record)record.reloadAdmitted=true;errors.push(name+': '+String(error));}
        }
        if(!current())throw aborted();
        return {loaded,errors};
      })();
      reloadPromise=work;
      void work.finally(()=>{if(reloadPromise===work)reloadPromise=undefined;}).catch(()=>{});
      return work;
    },
    /** Capture only explicitly loaded sessions. No discovery/module execution.
     * The returned closures cannot outlive this exact catalog or its owners. */
    captureTemplateTags() { return this.captureCallbacks("templateTags"); },
    captureRequestHooks() { return this.captureCallbacks("requestHooks"); },
    captureResponseHooks() { return this.captureCallbacks("responseHooks"); },
    /** @param {"templateTags"|"requestHooks"|"responseHooks"} contributionKind */
    captureCallbacks(contributionKind) {
      if (disposed) throw aborted();
      const context = synchronize();
      if (!context.ready) return [];
      const revision = catalogRevision;
      const ready = Array.from(records.entries())
        .filter(([, record]) => record.status === "ready")
        .sort((a, b) => a[1].order - b[1].order);
      const current = () =>
        catalogRevision === revision &&
        ready.every(([, record]) => record.current());
      return ready.flatMap(([name, record]) => {
        const contribution = record.session.metadata.contributions.find(
          (/** @type {any} */ item) => item.kind === contributionKind,
        );
        return (contribution?.items ?? []).map(
          (/** @type {any} */ item, /** @type {number} */ index) => {
            /** @param {'templateTags'|'templateTagMetadata'|'templateTagAction'|'requestHooks'|'responseHooks'} kind @param {any[]} args
             * @param {{isCurrent:()=>boolean,signal:AbortSignal,context?:Record<string,any>}} operation */
            async function dispatch(kind, args, operation) {
              if (
                !current() ||
                operation.signal.aborted ||
                !operation.isCurrent()
              )
                throw aborted();
              operation = { ...operation };
              if (
                record.session.isClosed?.() === true &&
                record.session.wasCancelled?.() === true
              ) {
                // Recovery waits must not expose mutable caller data to a new VM.
                const codec = createPluginValueCodec();
                const detached = codec.decode(
                  codec.encode({ args, context: operation.context ?? {} }),
                );
                args = detached.args;
                if (operation.context !== undefined)
                  operation.context = detached.context;
                await record.recoverSession();
              }
              if (
                !current() ||
                operation.signal.aborted ||
                !operation.isCurrent()
              )
                throw aborted();
              const session = record.session;
              const domOwner=/** @type {any} */(operation).domOwner;
              domOwner?.bindSession?.(()=>current()&&record.session===session&&session.isClosed?.()!==true);
              return session
                .invoke(kind, index, args, {
                  ...operation,
                  isCurrent: () => current() && operation.isCurrent(),
                })
                .then((/** @type {any} */ result) => {
                  if (
                    !current() ||
                    operation.signal.aborted ||
                    !operation.isCurrent()
                  )
                    throw aborted();
                  return result;
                })
                .catch((/** @type {any} */ error) => {
                  // Cancellation retires only this VM, retaining the admitted
                  // catalog for a fresh callback. Failed/over-budget guests stay
                  // quarantined until explicit Load. Ignore late retired replies.
                  if (
                    record.current() &&
                    record.session === session &&
                    session.isClosed?.() === true &&
                    session.wasCancelled?.() !== true
                  ) {
                    record.status = "error";
                    record.error = String(error.message ?? error).slice(
                      0,
                      8192,
                    );
                    record.controller.abort();
                    record.session.close();
                    emit();
                  }
                  throw error;
                });
            }
            return {
              plugin: name,
              index,
              definition: structuredClone(item.definition),
              isCurrent: current,
              /** @param {any[]} args @param {{isCurrent:()=>boolean,signal:AbortSignal,context:Record<string,any>,helperCall?:(call:{method:string,args:any[]})=>Promise<any>,interaction?:import('./plugin-session.js').PluginInteraction,syncCall?:(call:{method:string,args:any[]})=>Promise<any>}} operation */
              invoke(args, operation) {
                return dispatch(contributionKind, args, operation);
              },
              /** Metadata evaluation has no render/helper/store context.
               * @param {any[]} args @param {{isCurrent:()=>boolean,signal:AbortSignal}} operation */
              queryMetadata(args, operation) {
                return dispatch("templateTagMetadata", args, {
                  isCurrent: operation.isCurrent,
                  signal: operation.signal,
                });
              },
              /** @param {number} actionIndex @param {{isCurrent:()=>boolean,signal:AbortSignal}} operation */
              runAction(actionIndex, operation) {
                if (
                  !Number.isInteger(actionIndex) ||
                  actionIndex < 0 ||
                  !item.definition.actions?.some(
                    (/** @type {Record<string,any>} */ action) =>
                      action.index === actionIndex,
                  )
                )
                  return Promise.reject(
                    new Error("Template tag action is unavailable"),
                  );
                return dispatch("templateTagAction", [actionIndex], {
                  isCurrent: operation.isCurrent,
                  signal: operation.signal,
                });
              },
            };
          },
        );
      });
    },
    /** @param {(state:Record<string,any>)=>void} listener */
    subscribe(listener) {
      listeners.add(listener);
      listener(read());
      return () => listeners.delete(listener);
    },
    /** @param {string} name */
    async prepare(name) {
      if (disposed) throw aborted();
      const context = synchronize();
      if (
        !context.ready ||
        context.settings.pluginConfig?.[name]?.disabled === true
      )
        throw aborted();
      if (typeof name !== "string" || !name || name.length > 256)
        throw Error("Select a valid plugin package.");
      const existing = records.get(name);
      if (existing?.status === "loading") return existing.promise;
      if (existing?.status === "ready")
        return structuredClone(existing.session.metadata);
      if (records.size >= 32 && !existing)
        throw Error(
          "At most 32 plugin sessions can be loaded. Unload a plugin first.",
        );
      const controller = new AbortController(),
        epoch = generation,
        config = configKey(context.settings, name);
      const record = /** @type {any} */ ({
        controller,
        config,
        status: "loading",
        error: "",
        session: undefined,
        promise: undefined,
      });
      records.set(name, record);
      emit();
      const current = () => {
        try {
          const now = adapters.getContext();
          return (
            !disposed &&
            !controller.signal.aborted &&
            generation === epoch &&
            records.get(name) === record &&
            now.ready &&
            now.owner === context.owner &&
            pathKey(now.settings) === paths &&
            configKey(now.settings, name) === config &&
            now.settings.pluginConfig?.[name]?.disabled !== true
          );
        } catch {
          return false;
        }
      };
      record.current = current;
      record.promise = (async () => {
        try {
          if (!discovery) {
            // Svelte settings arrays are proxies; copy their string entries
            // without passing the reactive proxy to structuredClone.
            const directories = Array.from(
                context.settings.pluginDirectories ?? [],
              ),
              legacyPath =
                context.settings.pluginPathMigrationVersion === 1
                  ? null
                  : (context.settings.pluginPath ?? null);
            discovery = adapters.discover({
              pluginDirectories: directories,
              pluginPath: legacyPath,
              pluginPathMigrationVersion: legacyPath === null ? 1 : 0,
            });
          }
          const result = await discovery;
          if (!current()) throw aborted();
          const report = result.report;
          if (!report?.complete || !Array.isArray(report.packages))
            throw Error(
              "Plugin folders are not completely inspected. Reload after resolving their errors.",
            );
          const matches = report.packages.filter(
            (/** @type {any} */ p) => p.name === name,
          );
          if (matches.length !== 1 || matches[0].status !== "execution-pending")
            throw Error(
              "Select a unique supported plugin from the saved plugin folders.",
            );
          const plugin = matches[0],
            snapshot = await adapters.readPackage(plugin.directory);
          record.order = report.packages.indexOf(plugin);
          if (!current()) throw aborted();
          const manifest = JSON.parse(
            snapshot.files?.["package.json"] ?? "null",
          );
          const normalize = (/** @type {string} */ path) =>
            path
              .replace(/^\\\\\?\\/, "")
              .replaceAll("\\", "/")
              .toLowerCase();
          if (
            snapshot.name !== name ||
            snapshot.format !== plugin.format ||
            manifest?.name !== name ||
            (typeof manifest.version === "string"
              ? manifest.version
              : "unknown") !== plugin.version ||
            normalize(plugin.directory + "/" + snapshot.entry) !==
              normalize(plugin.entry)
          )
            throw Error(
              "Plugin package changed. Reload plugins before loading it.",
            );
          const session = await adapters.openSession(snapshot, {
            isCurrent: current,
            signal: controller.signal,
          });
          if (!current()) {
            session.close();
            throw aborted();
          }
          record.session = session;
          const admittedSnapshot = structuredClone(snapshot);
          const admittedMetadata = JSON.stringify(session.metadata);
          record.recoverSession = () => {
            if (record.recovery) return record.recovery;
            record.recovery = (async () => {
              let replacement;
              try {
                if (!current()) throw aborted();
                // Never reread changed source or replay the cancelled callback.
                replacement = await adapters.openSession(
                  structuredClone(admittedSnapshot),
                  {
                    isCurrent: current,
                    signal: controller.signal,
                  },
                );
                if (!current()) throw aborted();
                if (JSON.stringify(replacement.metadata) !== admittedMetadata)
                  throw Error(
                    "Plugin catalog changed during recovery. Reload the plugin.",
                  );
                record.session = replacement;
              } catch (error) {
                replacement?.close();
                if (current()) {
                  controller.abort();
                  record.status = "error";
                  record.error = (
                    error instanceof Error ? error.message : String(error)
                  ).slice(0, 8192);
                  emit();
                }
                throw error;
              } finally {
                record.recovery = undefined;
              }
            })();
            return record.recovery;
          };
          record.reloadAdmitted = true;
          record.status = "ready";
          emit();
          return structuredClone(session.metadata);
        } catch (error) {
          controller.abort();
          record.session?.close();
          if (records.get(name) === record) {
            record.status = "error";
            record.error = (
              error instanceof Error ? error.message : String(error)
            ).slice(0, 8192);
            emit();
          }
          throw error;
        }
      })();
      return record.promise;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      invalidate();
      listeners.clear();
    },
  };
}
