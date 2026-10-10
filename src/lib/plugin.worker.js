import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
import release from "@jitl/quickjs-wasmfile-release-sync";
import wasmUrl from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import { inspectPluginExportsIsolated } from "./plugin-runtime.js";

let started = false;
self.onmessage = async (event) => {
  if (started || event.data?.type !== "inspect") return;
  started = true;
  try {
    const engine = await newQuickJSWASMModuleFromVariant(
      newVariant(release, { wasmLocation: wasmUrl }),
    );
    const result = inspectPluginExportsIsolated(engine, event.data.snapshot);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: (error instanceof Error ? error.message : String(error)).slice(
        0,
        8192,
      ),
    });
  }
};
