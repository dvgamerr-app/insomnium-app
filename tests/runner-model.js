import assert from "node:assert/strict";
import { resourceRemovalIds } from "../src/lib/resources.js";
import { runnerSuite, runnerSuites, selectedRunnerSuite } from "../src/lib/runner-model.js";

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
