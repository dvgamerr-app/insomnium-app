import assert from "node:assert/strict";
import { historyLimit } from "../../../src/lib/model.js";

/** Fixture-only capacity for the three original namespace sends. The preserver
 * restores original settings; existing product maximum remains100.
 * @param {Record<string,any>} data */
export function namespaceHistoryPolicy(data) {
  const original = structuredClone(data.history);
  const before = {
    present: Object.hasOwn(data.settings, "maxHistory"),
    value: data.settings.maxHistory ?? null,
    effective: historyLimit(data.settings.maxHistory),
  };
  const required = original.length + 3;
  assert.ok(
    required <= 100,
    "Original history plus3 sends exceeds existing bounded maximum",
  );
  const after = Math.max(before.effective, required);
  assert.equal(historyLimit(after), after);
  data.settings.maxHistory = after;
  return {
    before,
    after,
    required,
    original,
    fixtureOnly: true,
    productMaximum: 100,
  };
}

/** @param {ReturnType<typeof namespaceHistoryPolicy>} policy @param {Record<string,any>} data */
export function assertNamespaceHistory(policy, data) {
  const ids = new Set(
    policy.original.map((/** @type {Record<string,any>} */ row) => row._id),
  );
  assert.equal(ids.size, policy.original.length);
  assert.deepEqual(
    data.history.filter((/** @type {Record<string,any>} */ row) =>
      ids.has(row._id),
    ),
    policy.original,
    "Original history remains throughout the namespace workflow",
  );
}
