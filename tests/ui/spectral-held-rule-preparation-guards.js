import assert from "node:assert/strict";
import {
  assertHeldMutationEvidence,
  heldReplacementRule,
} from "./helpers/spectral-held-rule-mutation.js";
import { assertSpectralFixturePath } from "./helpers/spectral-native-external.js";

// Pure shape/refusal checks only: fabricated evidence is not live-object authority.
const fixture = {
    workspaceId: "wrk_owned",
    specId: "spc_owned",
    repositoryId: "git_spectral_" + "a".repeat(32),
  },
  job = {
    jobId: "12345678-1234-4234-8234-123456789abc",
    mode: "held",
    reserved: 1000,
    input: {
      workspaceId: fixture.workspaceId,
      specId: fixture.specId,
      repositoryId: fixture.repositoryId,
      expectedBinding: { nativeRepositoryId: fixture.repositoryId },
    },
  },
  process = {
    pid: 123,
    started: 1000,
    aliveRetainedObject: true,
    processIdentity: { created: "100", sidecarSha256: "a".repeat(64) },
  },
  marker = { pid: 123, entered: 1100 };
assertHeldMutationEvidence(fixture, job, process, marker);
/** @type {((value:any)=>void)[]} */
const mutations = [
  (v) => (v.job.jobId = "foreign"),
  (v) => (v.job.mode = "warnings"),
  (v) => (v.job.exited = 1200),
  (v) => (v.job.cancelled = true),
  (v) => (v.job.input.workspaceId = "foreign"),
  (v) => (v.job.input.specId = "foreign"),
  (v) => (v.job.input.repositoryId = "foreign"),
  (v) => (v.job.input.expectedBinding.nativeRepositoryId = "foreign"),
  (v) => (v.process.aliveRetainedObject = false),
  (v) => (v.process.processIdentity.created = ""),
  (v) => (v.process.processIdentity.sidecarSha256 = "foreign"),
  (v) => (v.marker.pid = 999),
  (v) => (v.marker.entered = 999),
  (v) => (v.process.started = -1),
];
for (const mutate of mutations) {
  const value = structuredClone({ job, process, marker });
  mutate(value);
  assert.throws(() =>
    assertHeldMutationEvidence(fixture, value.job, value.process, value.marker),
  );
}
assertSpectralFixturePath("other/.spectral.yaml");
assert.ok(heldReplacementRule.includes("changed-rule-B"));
assert.ok(!heldReplacementRule.includes("pause"));
assert.ok(!heldReplacementRule.includes("Owned delayed finding"));
const entry = await Bun.file("tests/ui/spectral-api-design-native.js").text(),
  trace = await Bun.file("tests/ui/helpers/spectral-native-trace.js").text();
assert.ok(
  entry.indexOf("exerciseHeldRuleMutationNegative(page") >
    entry.indexOf("native-component-acceptance.json"),
);
assert.ok(
  trace.includes("No rule edits until actual native process settlement"),
);
for (const key of [
  "nocturne:split:workspace-left",
  "nocturne:split:request-response",
  "nocturne:split:design",
])
  assert.ok(
    entry.includes('"' + key + '"'),
    "Capture and finally restore actual SplitPane key " + key,
  );
const oracle = await Bun.file("tests/ui/helpers/spectral-api-design.js").text();
assert.equal((oracle.match(/assert\.\w+\(/g) || []).length, 73);
const output =
  "artifacts/spectral-held-rule-preparation/pure-guards-" +
  Date.now() +
  ".json";
await Bun.write(
  output,
  JSON.stringify(
    {
      passed: true,
      refusals: mutations.length,
      pureEvidenceShapeOnly: true,
      actualNativeNegativeExecuted: false,
      original61CheckpointBeforeOptIn: true,
      original73Assertions: true,
      noNativeProfile: true,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ passed: true, refusals: mutations.length, output }),
);
