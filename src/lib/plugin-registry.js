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
    /** Capture only explicitly loaded sessions. No discovery/module execution.
     * The returned closures cannot outlive this exact catalog or its owners. */
    captureTemplateTags() {
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
          (/** @type {any} */ item) => item.kind === "templateTags",
        );
        return (contribution?.items ?? []).map(
          (/** @type {any} */ item, /** @type {number} */ index) => ({
            plugin: name,
            index,
            definition: structuredClone(item.definition),
            isCurrent: current,
            /** @param {any[]} args @param {{isCurrent:()=>boolean,signal:AbortSignal,context:Record<string,any>}} operation */
            invoke(args, operation) {
              if (!current()) return Promise.reject(aborted());
              return record.session
                .invoke("templateTags", index, args, {
                  ...operation,
                  isCurrent: () => current() && operation.isCurrent(),
                })
                .catch((/** @type {any} */ error) => {
                  // Active cancellation/errors close a retained guest. It must be
                  // explicitly reloaded rather than left advertised as ready.
                  if (
                    record.current() &&
                    record.session.isClosed?.() === true
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
            },
          }),
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
