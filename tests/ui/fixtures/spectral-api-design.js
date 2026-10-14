import "../../../src/lib/styles/index.css";
const owner = /** @type {any} */ (window);
owner.isTauri = true;
// Controlled fixture acknowledgement gate; this is not native persistence.
owner.spectralSaveGate = {
  armed: false, held: false, acknowledged: false, payload: null, release: () => {},
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
      await new Promise((resolve) => { gate.release = () => resolve(undefined); });
      gate.held = false;
      gate.acknowledged = true;
    }
    return reply.value;
  },
};
const { mount } = await import("svelte");
const { default: Fixture } = await import("./spectral-api-design.svelte");
mount(Fixture, { target: document.body });
