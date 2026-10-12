import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { structuralFiles } from "./structural-source-fixture.js";

export const spectralFixtureExeSHA =
  "f5690ce1dc4136c9604964cdf2b2e490442581437db453b14c1f340c2a8d962a";
const modes = new Set([
  "default",
  "custom",
  "warnings",
  "fallback",
  "held",
  "external-repo",
  "external-http",
  "structural-http",
]);
const hash = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** Own ONLY a normal no-descendant compiled host; not Rust/native admission.
 * @param {string} output @param {string} bundleRoot */
export async function createSpectralFixtureHost(output, bundleRoot) {
  const proof = resolve(output, "host");
  await mkdir(proof, { recursive: true });
  const executable = resolve(proof, "spectral-linter.exe");
  const producerPath = resolve(
    process.env.INSOMNIUM_SPECTRAL_FIXTURE_EXE ||
      "src-tauri/binaries/spectral-linter-x86_64-pc-windows-msvc.exe",
  );
  const bytes = new Uint8Array(await Bun.file(producerPath).arrayBuffer());
  assert.equal(hash(bytes), spectralFixtureExeSHA);
  await Bun.write(executable, bytes);
  /** @type {Record<string,string>} */ const repositories = {};
  const common = "extends: []\nrules:\n";
  /** @type {Record<string,string>} */ const rules = {
    custom:
      common +
      [0, 1, 2, 3]
        .map(
          (severity) =>
            `  '${severity}':\n    description: Fixture severity ${severity}\n    severity: ${severity}\n    given: '$.info'\n    then:\n      field: x-required-${severity}\n      function: truthy\n`,
        )
        .join("") +
      "  attached-warning:\n    severity: warn\n    given: '$.components.schemas.*'\n    then:\n      field: description\n      function: truthy\n",
    warnings:
      common +
      "  warning-only:\n    severity: warn\n    given: '$.info'\n    then:\n      field: x-required\n      function: truthy\n",
    fallback: "extends: [./missing-owned-rules.yaml]\n",
    held:
      common +
      "  entered-owned-function:\n    severity: warn\n    given: '$'\n    then:\n      function: pause\nfunctions: [pause]\nfunctionsDir: ./functions\n",
  };
  rules["external-repo"] =
    rules.warnings +
    "  attached-warning:\n    severity: warn\n    given: '$.components.schemas.*'\n    then:\n      field: description\n      function: truthy\n  nested-warning:\n    severity: warn\n    given: '$.paths.*.*.requestBody.content.*.schema.properties.*'\n    then:\n      field: description\n      function: truthy\n";
  rules["external-http"] = rules["external-repo"];
  rules["structural-http"] = rules.warnings;
  for (const [name, body] of Object.entries(rules)) {
    const repository = resolve(proof, name);
    await mkdir(resolve(repository, "other/functions"), { recursive: true });
    await Bun.write(resolve(repository, "other/.spectral.yaml"), body);
    if (name === "held")
      await Bun.write(
        resolve(repository, "other/functions/pause.js"),
        'export default async function(){console.info("SPECTRAL_UI_ENTERED");await new Promise(resolve=>setTimeout(resolve,4000));return [{message:"Owned delayed finding",path:["info","title"]}];}\n',
      );
    repositories[name] = repository;
  }
  let revision = "one";
  /** @type {(version?:string)=>Record<string,string>} */ const externalFiles =
    (version = revision) => ({
      "a/shared.yaml":
        "\uFEFFtype: object\r\nproperties:\r\n  label:\r\n    $ref: '../nested/value.yaml'\r\n",
      "b/shared.yaml": "type: integer\r\nenum: [11]\r\n",
      "nested/value.yaml": "type: string\r\nenum: ['" + version + "😀']\r\n",
    });
  const writeReferences = async () => {
    for (const [name, contents] of Object.entries(externalFiles())) {
      const path = resolve(repositories["external-repo"], name);
      await mkdir(resolve(path, ".."), { recursive: true });
      await Bun.write(path, contents);
    }
  };
  await writeReferences();
  for (let i = 0; i < 40; i++) {
    const path = resolve(
      repositories["external-repo"],
      "many",
      "schema-" + i + ".yaml",
    );
    await mkdir(resolve(path, ".."), { recursive: true });
    await Bun.write(
      path,
      "type: object\nproperties:\n  label:\n    type: string\n    enum: ['many-" +
        i +
        "']\n",
    );
  }
  /** @type {Map<string,any>} */ const jobs = new Map();
  /** @type {any[]} */ const events = [];
  let mode = "default";
  /** @type {any} */ let lastSave = null;
  let server;
  const persist = async () =>
    Bun.write(
      resolve(proof, "jobs.json"),
      JSON.stringify(
        {
          native: false,
          exeSHA: spectralFixtureExeSHA,
          events,
          jobs: [...jobs.values()].map(
            ({ process, completion, ...job }) => job,
          ),
          lastSave,
        },
        null,
        2,
      ),
    );
  const execute = (/** @type {any} */ job) => {
    job.completion = (async () => {
      const repository = job.mode === "default" ? null : repositories[job.mode];
      const frame = {
        protocol: 1,
        jobId: job.jobId,
        sourceJson: job.input.sourceJson,
        repositoryRoot: repository,
        rulesetPath: repository
          ? resolve(repository, "other/.spectral.yaml")
          : null,
      };
      const child = spawn(executable, [], {
        cwd: proof,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      job.process = child;
      job.pid = child.pid;
      job.started = Date.now();
      events.push({
        type: "spawn",
        jobId: job.jobId,
        pid: child.pid,
        mode: job.mode,
      });
      /** @type {Buffer[]} */ const stdout = [];
      /** @type {Buffer[]} */ const stderr = [];
      let outputBytes = 0;
      child.stdout.on("data", (chunk) => {
        outputBytes += chunk.length;
        if (outputBytes > 16 * 1024 * 1024) child.kill();
        else stdout.push(chunk);
      });
      child.stderr.on("data", (chunk) => {
        if (Buffer.concat(stderr).length < 1024 * 1024) stderr.push(chunk);
        if (Buffer.concat(stderr).toString().includes("SPECTRAL_UI_ENTERED"))
          job.entered = true;
      });
      const terminal = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      child.stdin.end(JSON.stringify(frame) + "\n");
      const timeout = setTimeout(() => {
        job.timedOut = true;
        child.kill();
      }, 15000);
      let exit;
      try {
        exit = await terminal;
      } finally {
        clearTimeout(timeout);
        job.process = null;
        job.exited = Date.now();
      }
      job.exit = exit;
      job.stdout = Buffer.concat(stdout).toString("utf8");
      job.stderr = Buffer.concat(stderr).toString("utf8");
      events.push({ type: "closed", jobId: job.jobId, pid: job.pid, exit });
      if (job.cancelled || job.timedOut) {
        await persist();
        throw new Error(job.timedOut ? "timeout" : "cancelled");
      }
      assert.equal(exit.code, 0);
      assert.ok(job.stdout.endsWith("\n"));
      assert.equal(
        job.stdout.trim().split("\n").length,
        1,
        "Actual producer emits one closed frame",
      );
      const reply = JSON.parse(job.stdout);
      assert.equal(reply.jobId, job.jobId);
      if (reply.error) {
        await persist();
        throw new Error(reply.error.code);
      }
      assert.equal(typeof reply.resultJson, "string");
      job.result = JSON.parse(reply.resultJson);
      await persist();
      return { jobId: job.jobId, resultJson: reply.resultJson };
    })();
    void job.completion.catch(() => {});
    return job.completion;
  };
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/__spectral_ipc") {
        assert.equal(request.method, "POST");
        assert.equal(request.headers.get("origin"), url.origin);
        const { command, args } = await request.json();
        try {
          let value;
          if (command === "reserve_spectral_lint") {
            assert.equal(typeof args.input?.sourceJson, "string");
            const jobId = crypto.randomUUID();
            const job = {
              jobId,
              input: structuredClone(args.input),
              mode,
              cancelled: false,
              entered: false,
            };
            jobs.set(jobId, job);
            events.push({ type: "reserve", jobId, mode });
            value = { jobId };
          } else if (command === "run_spectral_lint") {
            const job = jobs.get(args.jobId);
            assert.ok(job && !job.completion && !job.cancelled);
            value = await execute(job);
          } else if (command === "cancel_spectral_lint") {
            const job = jobs.get(args.jobId);
            assert.ok(job);
            job.cancelled = true;
            if (job.process) job.process.kill();
            if (job.completion) await job.completion.catch(() => {});
            events.push({ type: "cancel-settled", jobId: job.jobId });
            value = { jobId: job.jobId, cancelled: true };
          } else if (command === "save_workspace") {
            lastSave = structuredClone(args.data);
            value = null;
          } else throw new Error("Unsupported fixture command");
          await persist();
          return Response.json({ ok: true, value });
        } catch (error) {
          await persist();
          return Response.json({
            ok: false,
            error: error instanceof Error ? error.message : "process",
          });
        }
      }
      if (url.pathname === "/__case") {
        assert.equal(request.method, "POST");
        const next = await request.json();
        assert.ok(modes.has(next.mode));
        mode = next.mode;
        if (next.revision !== undefined) {
          assert.ok(["one", "two"].includes(next.revision));
          revision = next.revision;
          await writeReferences();
        }
        return Response.json({ mode });
      }
      if (url.pathname.startsWith("/references/")) {
        const name = url.pathname.slice("/references/".length);
        const contents =
          mode === "structural-http"
            ? structuralFiles[
                /** @type {keyof typeof structuralFiles} */ (name)
              ]
            : externalFiles()[name];
        if (contents === undefined)
          return new Response("Unknown owned reference", { status: 404 });
        events.push({
          type: "reference-http",
          name,
          revision,
          time: Date.now(),
        });
        return new Response(contents, {
          headers: { "Content-Type": "application/yaml" },
        });
      }
      if (url.pathname === "/__state")
        return Response.json({
          mode,
          events,
          jobs: [...jobs.values()].map(
            ({ process, completion, ...job }) => job,
          ),
          lastSave,
        });
      if (url.pathname === "/")
        return new Response(
          '<html data-theme="dark"><head><link rel="stylesheet" href="/spectral-api-design.css"></head><body><script type="module" src="/spectral-api-design.js"></script></body></html>',
          { headers: { "Content-Type": "text/html" } },
        );
      const target = resolve(bundleRoot, "." + url.pathname);
      if (!target.startsWith(resolve(bundleRoot) + sep))
        return new Response("Not found", { status: 404 });
      const file = Bun.file(target);
      return (await file.exists())
        ? new Response(file)
        : new Response("Not found", { status: 404 });
    },
  });
  return {
    server,
    origin: "http://127.0.0.1:" + server.port,
    proof,
    executable,
    // Only this fixed owned fixture resource is deliberately changed by /__case.
    // Every other source, ruleset, executable and emitted asset remains frozen.
    mutableSources: [
      {
        path: resolve(repositories["external-repo"], "nested/value.yaml"),
        hashes: ["one", "two"].map((version) =>
          hash(
            new TextEncoder().encode(
              externalFiles(version)["nested/value.yaml"],
            ),
          ),
        ),
      },
    ],
    async close() {
      for (const job of jobs.values()) {
        if (job.process) {
          job.cancelled = true;
          job.process.kill();
        }
      }
      await Promise.allSettled(
        [...jobs.values()].map((job) => job.completion).filter(Boolean),
      );
      await persist();
      server.stop(true);
      assert.ok(
        [...jobs.values()].every((job) => !job.process),
        "Every owned normal host closed",
      );
    },
  };
}
