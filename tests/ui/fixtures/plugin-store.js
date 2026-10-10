import { createPluginStore } from "../../../src/lib/plugin-store.js";

// Saved fixture bundles the actual host adapter; native invoke is unchanged.
/** @type {any} */ (window).__pluginStoreFixture = { createPluginStore };
