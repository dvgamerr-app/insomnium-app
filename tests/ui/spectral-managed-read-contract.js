import assert from "node:assert/strict";
import { resolve, join, sep, basename } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Actual producer source/SDK protocol controls only; not Rust/native app acceptance.
const output = resolve(
    "artifacts/spectral-managed-read-fix/producer-" + Date.now(),
  ),
  repository = join(output, "repository");
await mkdir(join(repository, "other/functions"), { recursive: true });
const sha = (/** @type {Uint8Array} */ raw) =>
    createHash("sha256").update(raw).digest("hex"),
  spec = {
    fileName: "openapi.yaml",
    contents:
      "openapi: 3.1.0\ninfo: {title: Owned, version: '1'}\npaths: {}\ncomponents:\n  schemas:\n    Owned:\n      $ref: './schema.yaml'\n",
    files: [],
  };
const executable = process.env.INSOMNIUM_SPECTRAL_READ_TEST_EXE;
if (executable) {
  assert.ok(
    resolve(executable).startsWith(
      resolve("artifacts/spectral-managed-read-fix") + sep,
    ),
  );
  assert.equal(basename(executable), "spectral-linter.exe");
  assert.ok(await Bun.file(executable).exists());
}
await writeFile(join(repository, "schema.yaml"), "type: string\n");
const rules =
  "extends: []\nrules:\n  owned:\n    severity: warn\n    given: '$.info'\n    then:\n      function: check\nfunctions: [check]\nfunctionsDir: ./functions\n";
await writeFile(join(repository, "other/.spectral.yaml"), rules);
await writeFile(
  join(repository, "other/functions/helper.js"),
  "export const message='Owned helper 😀';\n",
);
await writeFile(
  join(repository, "other/functions/check.js"),
  "import {message} from './helper.js';export default function(){return [{message,path:['info','title']}];}\n",
);
/** @param {number} protocol */ async function run(protocol) {
  const env = { ...process.env };
  for (const key of ["BUN_BE_BUN", "BUN_OPTIONS", "NODE_OPTIONS", "NODE_PATH"])
    delete env[key];
  const jobId = crypto.randomUUID(),
    child = Bun.spawn(
      executable
        ? [executable]
        : [process.execPath, "tools/spectral-linter/host.js"],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env,
      },
    ),
    frame = {
      protocol,
      jobId,
      sourceJson: JSON.stringify(spec),
      repositoryRoot: repository,
      rulesetPath: join(repository, "other/.spectral.yaml"),
    };
  child.stdin.write(JSON.stringify(frame) + "\n");
  child.stdin.end();
  const [stdout, stderr, exit] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  await Bun.write(
    join(output, "raw-" + protocol + "-" + jobId + ".json"),
    JSON.stringify({ stdout, stderr, exit }, null, 2),
  );
  assert.equal(exit, 0);
  const reply = JSON.parse(stdout);
  assert.equal(reply.jobId, jobId);
  assert.equal(reply.protocol, protocol);
  assert.equal(reply.error, undefined);
  const parsed = JSON.parse(reply.resultJson);
  await Bun.write(
    join(output, "frame-" + protocol + "-" + jobId + ".json"),
    JSON.stringify({ reply, stderr, exit }, null, 2),
  );
  return { reply, parsed };
}
const before = await run(1),
  actual = await run(2);
assert.deepEqual(actual.parsed, before.parsed);
assert.equal(actual.parsed.selectedRuleset, "custom");
assert.ok(
  actual.parsed.diagnostics.some(
    (/** @type {any} */ r) => r.message === "Owned helper 😀",
  ),
);
assert.equal(actual.reply.readSet.version, 1);
const names = new Map();
for (const row of actual.reply.readSet.entries) {
  const name = Buffer.from(row.logical, "base64").toString("utf16le");
  names.set(name.replaceAll("\\", "/"), row);
  assert.equal(row.outcome, "bytes");
  assert.equal(row.sha256, sha(await readFile(join(repository, name))));
}
for (const path of [
  "other/.spectral.yaml",
  "other/functions/check.js",
  "other/functions/helper.js",
  "schema.yaml",
])
  assert.ok(names.has(path), "Actual consumed closure " + path);
await writeFile(
  join(repository, "other/.spectral.yaml"),
  "extends: [./missing-owned.yaml]\n",
);
const fallback = await run(2);
assert.equal(fallback.parsed.fallback, true);
assert.ok(
  fallback.reply.readSet.entries.some(
    (/** @type {any} */ row) =>
      row.outcome === "missing" &&
      Buffer.from(row.logical, "base64")
        .toString("utf16le")
        .endsWith("missing-owned.yaml"),
  ),
  "Failed direct fallback dependency read must be recorded",
);
await writeFile(
  join(repository, "other/extend.yaml"),
  'extends: []\nrules:\n  extension-warning:\n    severity: warn\n    given: "$.info"\n    then:\n      field: x-extension\n      function: truthy\n',
);
await writeFile(
  join(repository, "other/.spectral.yaml"),
  "extends: [./extend.yaml]\n",
);
const nestedBefore = await run(1),
  nestedActual = await run(2);
assert.deepEqual(nestedActual.parsed, nestedBefore.parsed);
assert.ok(
  nestedActual.reply.readSet.entries.some(
    (/** @type {any} */ row) =>
      row.outcome === "bytes" &&
      Buffer.from(row.logical, "base64")
        .toString("utf16le")
        .endsWith("extend.yaml"),
  ),
  "Actual nested YAML consumed bytes must be recorded",
);
await Bun.write(
  join(output, "acceptance.json"),
  JSON.stringify(
    {
      passed: true,
      actualSourceProducer: true,
      actualCompiledProducer: !!executable,
      executableSha256: executable
        ? sha(await Bun.file(executable).bytes())
        : null,
      native: false,
      version1ResultEqualVersion2: true,
      paths: [...names.keys()],
      fallbackMissingReceipt: true,
      nestedExtendsResultEqual: true,
      nestedExtendsSelectedRuleset: nestedActual.parsed.selectedRuleset,
      nestedExtendsFallback: nestedActual.parsed.fallback,
      externalAmbientNotClaimed: true,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: true, output, paths: [...names.keys()] }));
