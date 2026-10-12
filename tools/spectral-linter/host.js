import { Spectral, Document } from "@stoplight/spectral-core";
import Parsers from "@stoplight/spectral-parsers";
import { oas } from "@stoplight/spectral-rulesets";
import { Resolver } from "@stoplight/spectral-ref-resolver";
import { bundleAndLoadRuleset } from "@stoplight/spectral-ruleset-bundler/with-loader";
import { builtins } from "@stoplight/spectral-ruleset-bundler/plugins/builtins";
import * as fs from "node:fs";
import { Console } from "node:console";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { limits, fail, readRequest, readSource, response } from "./protocol.js";

/** The only stdout write retained before any custom module is evaluated. */
const writeFrame = process.stdout.write.bind(process.stdout);
// Ordinary custom-function console output is drained privately by the backend.
globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });

async function emit(line) {
  await new Promise((resolve, reject) => writeFrame(line, (error) => error ? reject(error) : resolve()));
}

function inside(root, file) {
  const child = relative(root, file);
  return child === "" || (!isAbsolute(child) && child !== ".." && !child.startsWith(".." + sep));
}

function identity(name, base = "memory:///") {
  let url;
  try { url = new URL(name, base); } catch { fail("protocol"); }
  if (!["memory:", "http:", "https:", "file:"].includes(url.protocol)) fail("protocol");
  url.hash = "";
  return url.href;
}

function sourceDocument(contents, name, base) {
  const retrieval = identity(name, base);
  const document = new Document(contents, Parsers.Yaml, retrieval);
  // Match the structural worker's OpenAPI 3.2 declared document identity.
  const declared = String(document.data?.openapi || "").startsWith("3.2.") &&
    typeof document.data?.$self === "string" ? identity(document.data.$self, retrieval) : retrieval;
  return declared === retrieval ? document : new Document(contents, Parsers.Yaml, declared);
}

async function textOf(stream) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of stream) {
    bytes += chunk.byteLength;
    if (bytes > limits.source) fail("input_limit", "Referenced specification exceeds 2 MiB.");
    chunks.push(chunk);
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks, bytes));
}

async function run(frame) {
  const source = readSource(frame.sourceJson);
  const document = sourceDocument(source.contents, source.fileName, "memory:///");
  const rootUri = identity(document.source);
  const known = new Map();
  const add = (uri, name, contents, origin) => {
    if (known.has(uri)) fail("protocol");
    known.set(uri, { uri, name, contents, origin });
  };
  add(rootUri, source.fileName, source.contents, "main");
  for (const file of source.files) {
    const reference = sourceDocument(file.contents, file.name, rootUri);
    add(identity(reference.source), file.name, file.contents, "attached");
  }
  let repositoryRoot = null;
  if (frame.repositoryRoot !== null) {
    if (!isAbsolute(frame.repositoryRoot) || frame.rulesetPath !== resolve(frame.repositoryRoot, "other", ".spectral.yaml")) fail("binding");
    repositoryRoot = await fs.promises.realpath(frame.repositoryRoot);
  }
  const retrieve = async (ref) => {
    const uri = new URL(ref.href());
    uri.hash = "";
    const existing = known.get(uri.href);
    if (existing) return existing.contents;
    let contents, origin;
    if (uri.protocol === "http:" || uri.protocol === "https:") {
      const reply = await fetch(uri);
      if (!reply.ok || !reply.body) throw new Error("Reference could not be loaded");
      contents = await textOf(reply.body);
      origin = "remote";
    } else {
      if (!repositoryRoot) throw new Error("Reference is not attached");
      let path;
      if (uri.protocol === "memory:") path = resolve(repositoryRoot, "." + decodeURIComponent(uri.pathname));
      else if (uri.protocol === "file:") path = fileURLToPath(uri);
      else throw new Error("Unsupported reference source");
      if (!inside(repositoryRoot, path)) throw new Error("Reference is outside its repository");
      const real = await fs.promises.realpath(path);
      if (!inside(repositoryRoot, real)) throw new Error("Reference is outside its repository");
      contents = await textOf(Bun.file(real).stream());
      origin = "repository";
    }
    known.set(uri.href, { uri: uri.href, name: uri.href, contents, origin });
    return contents;
  };
  const resolver = new Resolver({
    // The stock resolver only absolutizes HTTP and filesystem relatives.
    // Its public hook preserves our in-memory document identity at each level.
    transformRef({ ref, uri }) {
      if (!ref || ref.toString().startsWith("#")) return ref;
      return ref.clone().href(new URL(ref.toString(), uri.toString() || rootUri).href);
    },
    resolvers: Object.fromEntries(
      ["memory", "file", "http", "https"].map((scheme) => [scheme, { resolve: retrieve }]),
    ),
  });
  const spectral = new Spectral({ resolver });
  let selectedRuleset = "default", fallback = false;
  if (frame.rulesetPath !== null) {
    try {
      // Rust canonical paths use Windows device syntax. Load from the already
      // realpath-validated root so the bundler resolves local function imports.
      spectral.setRuleset(await bundleAndLoadRuleset(resolve(repositoryRoot, "other", ".spectral.yaml"), { fs, fetch }, [builtins()]));
      selectedRuleset = "custom";
    } catch {
      fallback = true;
      spectral.setRuleset(oas);
    }
  } else spectral.setRuleset(oas);
  // YAML also parses JSON, matching legacy spectral.run(string) behavior.
  const diagnostics = await spectral.run(document);
  const sources = [...known.values()].map(({ contents, ...entry }) =>
    entry.origin === "main" || entry.origin === "attached" ? entry : { ...entry, contents });
  return { diagnostics, sources, selectedRuleset, fallback };
}

let frame;
try {
  frame = await readRequest(Bun.stdin.stream());
  await emit(response(frame, await run(frame)));
} catch (error) {
  const code = ["protocol", "binding", "input_limit", "output_limit"].includes(error?.code) ? error.code : "process";
  await emit(JSON.stringify({ protocol: 1, jobId: frame?.jobId || "", error: { code } }) + "\n");
}
// A custom function may leave timers alive. The one-shot host retires after
// flushing its frame; native Job Object retirement also reaps descendants.
process.exit(0);
