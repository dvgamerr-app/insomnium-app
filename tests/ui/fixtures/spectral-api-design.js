import "../../../src/lib/styles/index.css";
const owner = /** @type {any} */ (window);
void (async () => {
  const nativeImport = owner.__apiImportNativeSeed?.native === true;
  if (nativeImport) {
    if (owner.__TAURI_INTERNALS__?.metadata?.currentWindow?.label !== "main")
      throw new Error("Actual native main window required");
  } else {
    owner.isTauri = true;
    // Controlled fixture acknowledgement gate; this is not native persistence.
    owner.spectralSaveGate = {
      armed: false,
      held: false,
      acknowledged: false,
      payload: null,
      release: () => {},
    };
    owner.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "spectral-ui-fixture" },
        currentWebview: { label: "spectral-ui-fixture" },
      },
      async invoke(/** @type {string} */ command, args = {}) {
        if (
          ![
            "reserve_spectral_lint",
            "run_spectral_lint",
            "cancel_spectral_lint",
            "save_workspace",
          ].includes(command)
        )
          throw new Error("Unapproved saved fixture IPC: " + command);
        const response = await fetch("/__spectral_ipc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, args }),
        });
        const reply = await response.json();
        if (!reply.ok) throw reply.error;
        if (command === "save_workspace" && owner.spectralSaveGate.armed) {
          const gate = owner.spectralSaveGate;
          gate.armed = false;
          gate.payload = structuredClone(args);
          gate.held = true;
          await new Promise((resolve) => {
            gate.release = () => resolve(undefined);
          });
          gate.held = false;
          gate.acknowledged = true;
        }
        return reply.value;
      },
    };
  }
  const { mount, unmount } = await import("svelte");
  const { default: Fixture } = await import("./spectral-api-design.svelte");
  const target = nativeImport ? document.createElement("div") : document.body;
  if (nativeImport) {
    target.dataset.apiImportNativeFixture = "";
    document.body.prepend(target);
  }
  if (nativeImport) {
    owner.__apiImportOriginalWorker = window.Worker;
    owner.__apiImportWorkerCreations = [];
    window.Worker = new Proxy(window.Worker, {
      construct(original, args) {
        owner.__apiImportWorkerCreations.push(String(args[0]));
        return Reflect.construct(original, args);
      },
    });
  }
  const mounted = mount(Fixture, { target });
  if (nativeImport)
    owner.__apiImportUnmount = async () => {
      await unmount(mounted);
      window.Worker = owner.__apiImportOriginalWorker;
      target.remove();
    };
  if (nativeImport) {
    const original = window.fetch;
    const saveUrl = owner.__TAURI_INTERNALS__.convertFileSrc(
      "save_workspace",
      "ipc",
    );
    owner.__apiImportOriginalFetch = original;
    const observedFetch = function (
      /** @type {RequestInfo|URL} */ input,
      /** @type {RequestInit|undefined} */ init,
    ) {
      // Submit unchanged to genuine Rust IPC first; no gate, delay or fake reply.
      const pending = original.call(window, input, init);
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const trace = owner.apiImportNativeTrace;
      if (url !== saveUrl || !trace?.armed) return pending;
      trace.armed = false;
      try {
        const body = init?.body;
        const text =
          typeof body === "string"
            ? body
            : body instanceof ArrayBuffer
              ? new TextDecoder().decode(body)
              : ArrayBuffer.isView(body)
                ? new TextDecoder().decode(body)
                : null;
        if (text === null)
          throw Error(
            "Native save observation requires synchronous actual IPC body",
          );
        trace.payload = JSON.parse(text);
      } catch (error) {
        trace.error = String(error);
        trace.events.push("native-save-observation-error");
        return pending;
      }
      trace.events.push("native-save-submitted");
      trace.pending = true;
      trace.accepted = owner.spectralDrain.state();
      owner.spectralDrain.start();
      trace.edit = owner.spectralDrain.attemptEdit();
      trace.refused = owner.spectralDrain.state();
      trace.phaseAtSubmission = owner.spectralDrain.phase;
      return pending.then(
        (/** @type {Response} */ response) => {
          trace.pending = false;
          trace.tauriResponse = response.headers.get("Tauri-Response");
          if (trace.tauriResponse === "ok") {
            trace.events.push("native-save-fulfilled");
            trace.acknowledged = true;
          } else {
            trace.error = "Native save response was not acknowledged as ok";
            trace.events.push("native-save-rejected");
          }
          // The caller receives the same unconsumed Response immediately.
          return response;
        },
        (/** @type {unknown} */ error) => {
          trace.pending = false;
          trace.error = String(error);
          trace.events.push("native-save-rejected");
          throw error;
        },
      );
    };
    owner.fetch = observedFetch;
    owner.__apiImportFetchHookInstalled = window.fetch === observedFetch;
    if (!owner.__apiImportFetchHookInstalled)
      throw Error("Actual native fetch observer was not installed");
  }
  owner.__apiImportFixtureReady = true;
})().catch((error) => {
  owner.__apiImportFixtureError = String(error);
});
