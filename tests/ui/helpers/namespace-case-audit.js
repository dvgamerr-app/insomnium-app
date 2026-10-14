import assert from "node:assert/strict";
export const profiles = ["dark", "light"].flatMap((theme) =>
  [1440, 900, 760, 560].map((width) => ({ theme, width })),
);
/** Audit all additive native field cases without promoting callback/physical claims.
 * @param {{passed:boolean,native:boolean,callbackRefusalNative:boolean,physicalWidthClaim:boolean,failures:any[],checks:any[]}} a */
export function auditFields(a) {
  assert.equal(a.passed, true);
  assert.equal(a.native, true);
  assert.equal(a.callbackRefusalNative, false);
  assert.equal(a.physicalWidthClaim, false);
  assert.deepEqual(a.failures, []);
  assert.equal(a.checks.length, 88);
  for (const { theme, width } of profiles) {
    const rows = a.checks.filter((r) => r.theme === theme && r.width === width);
    assert.equal(rows.length, 11);
    for (const [kind, count] of [
      ["geometry", 1],
      ["escape-no-save-focus", 1],
      ["association", 4],
      ["focused-removal", 3],
      ["32-cap", 1],
      ["native-save-reload", 1],
    ])
      assert.equal(rows.filter((r) => r.kind === kind).length, count);
    const m = rows.find((r) => r.kind === "geometry").metrics;
    assert(m.left >= 0 && m.right <= width && m.scroll <= m.client + 1);
    for (const x of m.labels) assert.equal(x.gap, "6px");
    for (const x of m.rows) {
      assert.equal(x.gap, "6px");
      assert.equal(x.columns.split(" ").length, width <= 600 ? 1 : 3);
    }
    const associations = rows.filter((r) => r.kind === "association");
    assert.deepEqual(
      associations.map((r) => r.message),
      ["unique", "without a colon", "Namespace URI", "reserved"],
    );
    for (const r of associations) {
      assert.equal(r.state.invalid, "true");
      assert(r.state.id);
      assert.equal(r.state.describedby, r.state.id + "-error");
      const names =
        r.message === "unique"
          ? ["Namespace prefix 1", "Namespace prefix 2"]
          : r.message === "reserved"
            ? ["Namespace prefix 1", "Namespace URI 1"]
            : [r.target];
      assert.deepEqual(
        r.affected.map((/** @type {any} */ x) => x.name),
        names,
      );
      assert.equal(
        new Set(r.affected.map((/** @type {any} */ x) => x.id)).size,
        names.length,
      );
      for (const x of r.affected) {
        assert(x.id);
        assert.equal(x.invalid, "true");
        assert.equal(x.describedby, x.id + "-error");
        assert(x.text.includes(r.message));
      }
    }
    const removals = rows.filter((r) => r.kind === "focused-removal");
    assert.deepEqual(
      removals.map((r) => [
        r.index,
        r.key,
        r.remaining,
        r.active.name,
        r.active.inDialog,
      ]),
      [
        [2, "Enter", 2, "Remove namespace 2", true],
        [2, "Space", 1, "Remove namespace 1", true],
        [1, "Enter", 0, "Add namespace", true],
      ],
    );
    const cap = rows.find((r) => r.kind === "32-cap");
    assert.equal(cap.controls, 64);
    assert.deepEqual(
      [...cap.names].sort(),
      Array.from({ length: 32 }, (_, i) => [
        "Namespace prefix " + (i + 1),
        "Namespace URI " + (i + 1),
      ])
        .flat()
        .sort(),
    );
    const save = rows.find((r) => r.kind === "native-save-reload");
    assert.equal(save.viewportMode, "CDP-emulated");
    assert.equal(save.physicalWidthClaim, false);
    assert.deepEqual(save.beforeReload.namespaces, save.expected);
    assert.deepEqual(save.reloaded.namespaces, save.expected);
    for (const key of ["response", "filter", "filterHistory", "extra"])
      assert.deepEqual(save.beforeReload[key], save.reloaded[key]);
  }
  return {
    passed: true,
    profiles: 8,
    groups: 88,
    fieldRefusals: 32,
    affectedFields: 48,
    focusedRemovals: 24,
    durableReloads: 8,
    nativeCallbackRefusal: false,
    physicalWidth: false,
  };
}
/** Audit the original complete 20-case namespace matrix and exact wire/worker counts.
 * @param {{passed:boolean,checks:any[],wire:any[],workers:any[]}} a */
export function auditOriginal(a) {
  assert.equal(a.passed, true);
  assert.equal(a.checks.length, 20);
  assert.equal(a.wire.length, 3);
  assert.deepEqual(
    a.wire.map((r) => [r.path, r.method]),
    [
      ["/document", "GET"],
      ["/mapped", "GET"],
      ["/mapped", "GET"],
    ],
  );
  const counts = {
    validation: 1,
    selection: 6,
    reload: 1,
    "validation-ui": 1,
    "cancel-focus": 1,
    "clear-retains-map": 1,
    layout: 6,
    "mapping-generation": 1,
    "remove-map": 1,
    "request-isolation": 1,
  };
  for (const [k, n] of Object.entries(counts))
    assert.equal(a.checks.filter((r) => r.kind === k).length, n);
  assert.equal(a.checks.find((r) => r.kind === "validation").refusals, 15);
  assert.equal(a.checks.find((r) => r.kind === "validation-ui").refusals, 4);
  assert.equal(a.workers.length, 20);
  return { passed: true, groups: 20, httpRequests: 3, workerEvents: 20 };
}
/** Original history must survive fixture sends under the unchanged product ceiling.
 * @param {{fixtureOnly:boolean,productMaximum:number,required:number,after:number,original:any[]}} before
 * @param {{passed:boolean,policy:any,setting:number,history:any[]}} after */
export function auditHistory(before, after) {
  assert.equal(after.passed, true);
  assert.deepEqual(after.policy, before);
  assert.equal(before.fixtureOnly, true);
  assert.equal(before.productMaximum, 100);
  assert(before.required <= 100);
  assert.equal(after.setting, before.after);
  const ids = new Set(before.original.map((v) => v._id));
  assert.equal(ids.size, before.original.length);
  assert.deepEqual(
    after.history.filter((v) => ids.has(v._id)),
    before.original,
  );
  return {
    passed: true,
    originalCount: before.original.length,
    duringCasePreserved: true,
    fixtureSetting: before.after,
  };
}
