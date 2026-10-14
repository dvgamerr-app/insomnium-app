import assert from "node:assert/strict";
export const keys = [
  "nocturne:split:workspace-left",
  "nocturne:split:request-response",
  "nocturne:split:design",
  "insomnium.requestResponseSplit.v1",
  "insomnium.apiSourcePreviewSplit.v1",
];
/** Require the actual single post-restoration read of every original layout key.
 * @param {{passed:boolean,currentKeys:string[],legacyKeys:string[],layout:Record<string,string|null>,after:Record<string,string|null>,restoredLayout:Record<string,string|null>}} r */
export function auditNamespaceLayout(r) {
  assert.equal(r.passed, true);
  assert.deepEqual(r.currentKeys, keys.slice(0, 3));
  assert.deepEqual(r.legacyKeys, keys.slice(3));
  for (const value of [r.layout, r.after, r.restoredLayout]) {
    assert(value && typeof value === "object");
    assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
    for (const x of Object.values(value))
      assert(x === null || typeof x === "string");
  }
  assert.deepEqual(
    r.restoredLayout,
    r.layout,
    "Actual read-once post-restore snapshot required; after is only pre-restore",
  );
  return {
    passed: true,
    currentKeys: 3,
    legacyKeys: 2,
    actualPostRestoreRead: true,
  };
}
