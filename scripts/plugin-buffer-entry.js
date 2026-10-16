import { Readable } from "readable-stream/lib/ours/browser.js";
import { Buffer } from "buffer/";
// This runs inside the isolated QuickJS VM, never the application global.
globalThis.Buffer = Buffer;
Object.defineProperty(globalThis, "__pluginBuffer", { value: Buffer });

Object.defineProperty(globalThis, "__pluginReadable", { value: Readable });
