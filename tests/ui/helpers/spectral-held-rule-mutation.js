import assert from "node:assert/strict";

export const heldReplacementRule =
  "extends: []\nrules:\n  changed-rule-B:\n    severity: warn\n    given: '$.info'\n    then:\n      field: x-changed-B\n      function: truthy\n";
/** Pure evidence refusal, not a replacement for retained process-object authentication.
 * @param {any} fixture @param {any} job @param {any} process @param {any} marker */
export function assertHeldMutationEvidence(fixture, job, process, marker) {
  assert.match(
    job.jobId,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
  );
  assert.equal(job.mode, "held");
  assert.equal(job.exited, undefined);
  assert.equal(job.cancelled, undefined);
  assert.equal(job.input.workspaceId, fixture.workspaceId);
  assert.equal(job.input.specId, fixture.specId);
  assert.equal(job.input.repositoryId, fixture.repositoryId);
  assert.equal(
    job.input.expectedBinding.nativeRepositoryId,
    fixture.repositoryId,
  );
  assert.equal(process.aliveRetainedObject, true);
  assert.ok(process.processIdentity.created);
  assert.match(process.processIdentity.sidecarSha256, /^[a-f0-9]{64}$/);
  assert.equal(marker.pid, process.pid);
  assert.ok(marker.entered >= job.reserved);
  assert.ok(process.started >= job.reserved - 1000);
}

/** Explicit opt-in saved negative after original61 acceptance. No release/cancel gate.
 * @param {import('playwright-core').Page} page @param {string} output
 * @param {{trace:any,invoke:any,fixture:any}} context */
export async function exerciseHeldRuleMutationNegative(
  page,
  output,
  { trace, invoke, fixture },
) {
  await trace.configureCase("held");
  await page
    .getByRole("button", { name: "Repository fixture", exact: true })
    .click();
  const snapshot = async () =>
      JSON.parse(
        /** @type {string} */ (
          await page
            .locator("output[data-fixture-snapshot]")
            .getAttribute("data-fixture-snapshot")
        ),
      ),
    before = await snapshot();
  const savedBefore = await invoke("load_workspace"),
    stateBefore = await trace.state(),
    api = page.getByRole("region", { name: "API Design", exact: true });
  await api
    .getByRole("button", { name: "Validate & preview", exact: true })
    .click();
  let entered;
  for (let i = 0; i < 100; i++) {
    const state = await trace.state();
    entered = state.jobs.find(
      (/** @type {any} */ job) =>
        job.mode === "held" && job.entered && !job.exited,
    );
    if (entered) break;
    await page.waitForTimeout(20);
  }
  assert.ok(entered, "Actual entered owned job required before mutation");
  const mutation = await trace.mutateEnteredHeldRule(entered.jobId);
  let settled;
  for (let i = 0; i < 300; i++) {
    settled = (await trace.state()).jobs.find(
      (/** @type {any} */ job) => job.jobId === entered.jobId,
    );
    if (settled?.exited) break;
    await page.waitForTimeout(20);
  }
  assert.ok(
    settled?.exited && settled.observedProcessObject,
    "Exact native process physically retired before verdict",
  );
  assert.notEqual(
    settled.cancelled,
    true,
    "No accepted cancellation may replace normal process completion",
  );
  assert.equal((await trace.state()).jobs.length, stateBefore.jobs.length + 1);
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".api-design button")].some(
      (el) =>
        el.textContent?.trim() === "Validate & preview" &&
        !el.hasAttribute("disabled"),
    ),
  );
  assert.deepEqual(
    await snapshot(),
    before,
    "Source/binding/workspace unchanged",
  );
  assert.deepEqual(
    await invoke("load_workspace"),
    savedBefore,
    "Saved workspace unchanged",
  );
  const oldFinding = settled.result?.diagnostics?.find(
      (/** @type {any} */ row) => row.message === "Owned delayed finding",
    ),
    stalePublished = !!oldFinding;
  const uiPublished = await api
    .locator(".diagnostic-row")
    .filter({ hasText: "Owned delayed finding" })
    .count();
  if (!stalePublished) {
    assert.equal(
      settled.runError,
      "binding",
      "Green requires actual managed read freshness refusal, not protocol/process failure",
    );
    assert.equal(uiPublished, 0);
  }
  await Bun.write(
    output + "/held-rule-mutation-negative.json",
    JSON.stringify(
      {
        scope:
          "Owned rule content-coherence negative; not external ABA guarantee",
        native: true,
        jobId: entered.jobId,
        fixture,
        mutation,
        settled,
        stalePublished,
        uiPublished,
        sourceBindingWorkspaceUnchanged: true,
        physicalSettlement: true,
        noCancellation: settled.cancelled !== true,
        cleanupCancelAfterSettlement: settled.cancelled === false,
        freshnessRefused: !stalePublished && settled.runError === "binding",
        original61Preserved: true,
      },
      null,
      2,
    ),
  );
  assert.equal(
    stalePublished,
    false,
    "REPOSITORY_READ_GATE: producer loaded A and published its finding while owned ruleset is B",
  );
}
