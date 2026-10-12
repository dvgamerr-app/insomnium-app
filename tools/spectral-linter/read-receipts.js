import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { resolve, relative, isAbsolute, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { limits, fail } from "./protocol.js";

/** Public IO/loader hooks record consumed bytes, not arbitrary trusted ambient effects. */
export function createReadReceipts(root) {
  const entries = [],
    seen = new Set(),
    coverage = {
      external: false,
      remote: false,
      ambient: root !== null,
      resolution: root !== null,
    };
  let size = 0,
    fatal = null;
  const reject = (code) => {
    fatal = code;
    fail(code);
  };
  const inside = (p) => {
    const rel = relative(root, p);
    return (
      rel !== "" &&
      !isAbsolute(rel) &&
      rel !== ".." &&
      !rel.startsWith(".." + sep)
    );
  };
  const encoded = (p) =>
    Buffer.from(relative(root, p), "utf16le").toString("base64");
  const record = async (file, role, outcome, raw, consumedCanonical) => {
    if (root === null) return;
    let logical;
    try {
      logical = resolve(file instanceof URL ? fileURLToPath(file) : file);
    } catch {
      coverage.external = true;
      return;
    }
    if (!inside(logical)) {
      coverage.external = true;
      return;
    }
    let canonical = null;
    try {
      canonical = consumedCanonical || (await fs.promises.realpath(logical));
    } catch (error) {
      if (outcome !== "missing") reject("binding");
    }
    if (canonical && !inside(canonical)) {
      coverage.external = true;
      return;
    }
    const entry = {
      logical: encoded(logical),
      canonical: canonical ? encoded(canonical) : null,
      role,
      outcome,
      bytes: raw?.length ?? null,
      sha256: raw ? createHash("sha256").update(raw).digest("hex") : null,
    };
    const key = JSON.stringify(entry);
    if (seen.has(key)) return;
    size += Buffer.byteLength(key);
    if (size > limits.output) reject("output_limit");
    seen.add(key);
    entries.push(entry);
  };
  const read = async (file, options, role) => {
    let raw;
    try {
      raw = await fs.promises.readFile(
        file,
        typeof options === "object" && options !== null
          ? { ...options, encoding: null }
          : { encoding: null },
      );
    } catch (error) {
      if (error?.code === "ENOENT") await record(file, role, "missing", null);
      else coverage.resolution = true;
      throw error;
    }
    await record(file, role, "bytes", raw);
    const encoding = typeof options === "string" ? options : options?.encoding;
    return encoding ? raw.toString(encoding) : raw;
  };
  const ioFs = {
    ...fs,
    promises: new Proxy(fs.promises, {
      get(target, key) {
        if (key === "readFile")
          return (file, options) => read(file, options, "ruleset");
        return Reflect.get(target, key);
      },
    }),
  };
  const plugin = {
    name: "insomnium-consumed-managed-reads",
    options(options) {
      if (typeof options.external !== "function") return;
      const external = options.external;
      return {
        ...options,
        external(...args) {
          const result = external(...args);
          if (result) coverage.external = true;
          return result;
        },
      };
    },
    async resolveId(source, importer, options) {
      const result = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (result) return result;
      if (importer && isAbsolute(importer) && /^\.\.?[\\/]/.test(source)) {
        const file = resolve(dirname(importer), source);
        try {
          await fs.promises.stat(file);
        } catch (error) {
          if (error?.code === "ENOENT")
            await record(file, "module", "missing", null);
        }
      }
      return null;
    },
    async load(id) {
      if (typeof id !== "string" || id.startsWith("\0") || !isAbsolute(id))
        return null;
      return read(id, "utf8", "module");
    },
  };
  return {
    ioFs,
    plugin,
    async reference(file, raw, consumedCanonical) {
      await record(file, "reference", "bytes", raw, consumedCanonical);
    },
    async missing(file, role) {
      await record(file, role, "missing", null);
    },
    fetch(...args) {
      coverage.remote = true;
      return fetch(...args);
    },
    snapshot() {
      if (fatal) fail(fatal);
      return { version: 1, entries, coverage };
    },
  };
}
