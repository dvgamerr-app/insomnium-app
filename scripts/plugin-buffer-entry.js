import { Buffer } from "buffer/";
// This runs inside the isolated QuickJS VM, never the application global.
globalThis.Buffer = Buffer;
Object.defineProperty(globalThis, "__pluginBuffer", { value: Buffer });
