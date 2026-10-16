import assert from "node:assert/strict";
import { resourceRemovalIds, duplicateResource } from "../src/lib/resources.js";
import { runnerSuite, runnerSuites, runnerRequestId, selectedRunnerSuite } from "../src/lib/runner-model.js";
import { parseImport } from "../src/lib/import-export.js";

const resources = [
  { _id: "wrk_a", _type: "workspace" },
  { _id: "wrk_b", _type: "workspace" },
  { _id: "folder", _type: "request_group", parentId: "wrk_a" },
  { _id: "suite_root", _type: "unit_test_suite", parentId: "wrk_a" },
  { _id: "suite_nested", _type: "unit_test_suite", parentId: "folder" },
  { _id: "suite_foreign", _type: "unit_test_suite", parentId: "wrk_b" },
  { _id: "meta", _type: "workspace_meta", parentId: "wrk_a", activeUnitTestSuiteId: "suite_nested" },
  { _id: "test", _type: "unit_test", parentId: "suite_nested", name: "Imported test", code: "expect(true).to.equal(true);", requestId: "req" },
  { _id: "req", _type: "request", parentId: "folder" },
];
const original = JSON.stringify(resources);
assert.equal(selectedRunnerSuite(resources, "wrk_a")?._id, "suite_nested");
const plan = runnerSuite(resources, "suite_nested");
assert.equal(plan.collectionId, "wrk_a");
assert.deepEqual(plan.testIds, ["test"]);
assert.equal(plan.suite.tests[0].requestId, "req");
assert.equal(JSON.stringify(resources), original);
assert.deepEqual(runnerSuites(resources, "wrk_a").map((r) => r._id), ["suite_root", "suite_nested"]);
assert.deepEqual(runnerSuites(resources, "wrk_b").map((r) => r._id), ["suite_foreign"]);
assert.equal(selectedRunnerSuite(resources.map((r) => r._id === "meta" ? {...r, activeUnitTestSuiteId: "suite_foreign"} : r), "wrk_a")?._id, "suite_root");
console.log("Nested runner selection and imported test binding passed");

const history = [...resources,
  {_id: "suite_result", _type: "unit_test_result", parentId: "wrk_a", unitTestSuiteId: "suite_nested"},
  {_id: "test_result", _type: "unit_test_result", parentId: "wrk_a", unitTestId: "test"},
  {_id: "old_result", _type: "unit_test_result", parentId: "suite_nested"},
  {_id: "unattributed", _type: "unit_test_result", parentId: "wrk_a"},
  {_id: "foreign_result", _type: "unit_test_result", parentId: "wrk_b", unitTestSuiteId: "suite_foreign"},
];
const removingSuite = resourceRemovalIds(history, "suite_nested");
assert.deepEqual([...removingSuite].sort(), ["suite_nested", "test", "suite_result", "test_result", "old_result"].sort());
assert.deepEqual([...resourceRemovalIds(history, "test")].sort(), ["test", "test_result"]);
assert.deepEqual([...resourceRemovalIds(history, "req")], ["req"]);
console.log("Runner deletion covers linked and legacy results without removing unrelated history");

const imported = parseImport(JSON.stringify({resources})).resources;
const importedWorkspace = imported.find((r) => r._type === "workspace" && r._id !== "wrk_a")?._id;
const importedRequest = imported.find((r) => r._type === "request");
assert.ok(importedWorkspace && importedRequest);
assert.equal(runnerRequestId([...resources, ...imported], importedWorkspace, "req"), importedRequest._id);
assert.equal(runnerRequestId(imported, importedWorkspace, importedRequest._id), importedRequest._id);
assert.equal(runnerRequestId(imported, "wrk_b", "req"), "req");
assert.equal(imported.find((r) => r._type === "unit_test")?.code, resources.find((r) => r._type === "unit_test")?.code);
const reimported = parseImport(JSON.stringify({resources:imported})).resources;
const reimportedRequest = reimported.find((r) => r._type === "request");
assert.ok(reimportedRequest);
assert.ok(reimportedRequest._importRequestIds.includes("req"));
assert.ok(reimportedRequest._importRequestIds.includes(importedRequest._id));
assert.throws(() => runnerRequestId([...imported, {...importedRequest, _id:"duplicate_alias"}], importedWorkspace, "req"), /ambiguous/);
console.log("Imported runner literal IDs resolve locally and survive reimport without changing scripts");

const duplicatedResources = structuredClone(imported);
duplicateResource(duplicatedResources, importedRequest._id);
assert.equal(runnerRequestId(duplicatedResources, importedWorkspace, "req"), importedRequest._id);
const copiedWorkspace = duplicateResource(duplicatedResources, importedWorkspace);
assert.ok(copiedWorkspace);
const copiedPlan = duplicatedResources.filter((r) => r._type === "request" && r._importRequestIds?.includes(importedRequest._id));
assert.equal(copiedPlan.length, 1);
assert.equal(runnerRequestId(duplicatedResources, copiedWorkspace, importedRequest._id), copiedPlan[0]._id);
assert.equal(runnerRequestId(duplicatedResources, copiedWorkspace, "req"), copiedPlan[0]._id);
console.log("Request copies preserve original aliases; collection copies resolve their own script IDs");
