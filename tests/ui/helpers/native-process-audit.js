import assert from "node:assert/strict";
import {
  classifyTerminalStartup,
  requiredCoverage,
  creationInterval,
} from "./native-process-startup.js";
const beforeKeys = [
  "pid",
  "parentPid",
  "imagePath",
  "imageSHA256",
  "creationTime",
  "cimCreationTime",
  "retainedBeforeExit",
  "beforeExitWaitResult",
  "retainedAt",
];
/** @param {any} r */
function beforeReceipt(r) {
  return Object.fromEntries(
    beforeKeys.map((k) => {
      assert(Object.hasOwn(r, k), "Missing authenticated parent field " + k);
      return [k, r[k]];
    }),
  );
}
/** Independently account for every raw kernel call and every required child.
 * @param {any} p @param {any[]} required */
export function validateClassifiedObserver(p, required) {
  assert.equal(p.error, undefined);
  assert.deepEqual(p.errors, []);
  assert(Array.isArray(p.calls));
  assert(Array.isArray(p.attempts));
  assert(Array.isArray(p.terminalStartupAttempts));
  const sequence = new Map();
  for (let i = 0; i < p.calls.length; i++) {
    const c = p.calls[i];
    assert.equal(c.sequence, i, "Dense ordered unique raw call sequences");
    assert(!sequence.has(c.sequence));
    sequence.set(c.sequence, c);
  }
  const all = [p, ...p.observedChildren],
    authenticated = new Map(all.map((v) => [v.pid, v]));
  assert.equal(authenticated.size, all.length);
  assert.equal(
    new Set(p.terminalStartupAttempts.map((/** @type {any} */ v) => v.pid))
      .size,
    p.terminalStartupAttempts.length,
  );
  const classified = new Map(
      p.terminalStartupAttempts.map((/** @type {any} */ v) => [v.pid, v]),
    ),
    allowedFailures = new Map();
  for (const terminal of p.terminalStartupAttempts) {
    const parent = authenticated.get(terminal.parentPid);
    assert(
      parent,
      "Embedded parent must resolve to actual authenticated host/child",
    );
    assert.deepEqual(
      Object.keys(terminal.parentSnapshot).sort(),
      [...beforeKeys].sort(),
    );
    assert.deepEqual(
      terminal.parentSnapshot,
      beforeReceipt(parent),
      "No fabricated parent snapshot",
    );
    const expected = classifyTerminalStartup({
      host: false,
      row: terminal.cimSnapshot,
      parent: terminal.parentSnapshot,
      failure: terminal.rawFailure,
      wait: terminal.wait,
      times: terminal.times,
      closed: terminal.closed,
    });
    assert.deepEqual(terminal, expected);
    assert(!required.some((v) => v.pid === terminal.pid));
    for (const call of [
      terminal.rawFailure,
      terminal.wait,
      terminal.times,
      terminal.closed,
    ])
      assert.deepEqual(sequence.get(call.sequence), call);
    allowedFailures.set(terminal.rawFailure.sequence, terminal.rawFailure);
  }
  for (const call of p.calls)
    if (call.errorMeaningful) {
      assert(allowedFailures.has(call.sequence), "Arbitrary API failure fatal");
      assert.deepEqual(call, allowedFailures.get(call.sequence));
    }
  if (p.firstFailure) {
    assert(allowedFailures.has(p.firstFailure.sequence));
    assert.deepEqual(
      p.firstFailure,
      allowedFailures.get(p.firstFailure.sequence),
    );
  } else assert.equal(allowedFailures.size, 0, "Raw first failure retained");
  requiredCoverage(required, p.observedChildren, p.terminalStartupAttempts);
  assert.deepEqual(
    p.attempts
      .map((/** @type {any} */ v) => v.pid)
      .sort((/** @type {number} */ a, /** @type {number} */ b) => a - b),
    [...all, ...p.terminalStartupAttempts]
      .map((v) => v.pid)
      .sort((a, b) => a - b),
  );
  const accounted = new Set();
  /** @param {any} attempt @param {string} phase @param {string} api */
  function find(attempt, phase, api) {
    const rows = p.calls.filter(
      (/** @type {any} */ c) =>
        c.pid === attempt.pid && c.phase === phase && c.api === api,
    );
    assert.equal(rows.length, 1);
    const c = rows[0];
    assert.equal(c.parentPid, attempt.parentPid);
    assert.deepEqual(c.cimSnapshot, attempt.cimSnapshot);
    assert.equal(c.handle, attempt.handle);
    accounted.add(c.sequence);
    return c;
  }
  for (const attempt of p.attempts) {
    const opened = find(attempt, "retain-open", "OpenProcess");
    assert.equal(opened.rawReturn, attempt.handle);
    assert.match(attempt.handle, /^[1-9][0-9]*$/);
    assert.equal(opened.errorMeaningful, false);
    if (!attempt.accepted) {
      const terminal = classified.get(attempt.pid);
      assert(terminal);
      assert.equal(attempt.handle, terminal.handle);
      assert.equal(attempt.creationTime, terminal.creationTime);
      assert.equal(attempt.handleClosed, true);
      assert.equal(attempt.classification, "terminal-startup-attempt");
      assert.deepEqual(attempt.cimSnapshot, terminal.cimSnapshot);
      assert(opened.sequence < terminal.rawFailure.sequence);
      for (const c of [
        terminal.rawFailure,
        terminal.wait,
        terminal.times,
        terminal.closed,
      ])
        accounted.add(c.sequence);
      continue;
    }
    const r = authenticated.get(attempt.pid);
    assert(r);
    assert.equal(attempt.creationTime, r.creationTime);
    assert.equal(attempt.parentPid, r.parentPid);
    assert.equal(attempt.cimSnapshot.creationTime, r.cimCreationTime);
    assert.equal(
      attempt.cimSnapshot.path.toLowerCase(),
      r.imagePath.toLowerCase(),
    );
    assert.match(r.creationTime, /^[1-9][0-9]+$/);
    const interval = creationInterval(
      attempt.cimSnapshot.creationTime,
      attempt.cimSnapshot.cimCreationPrecisionDigits,
    );
    assert(
      BigInt(r.creationTime) >= interval.start &&
        BigInt(r.creationTime) < interval.end,
      "Authenticated kernel creation must match declared CIM precision",
    );
    assert.equal(r.retainedBeforeExit, true);
    assert.equal(r.beforeExitWaitResult, 258);
    assert.equal(r.waitResult, 0);
    assert.equal(r.signaled, true);
    assert.equal(r.handleClosed, true);
    const image = find(attempt, "retain-image", "QueryFullProcessImageNameW"),
      times = find(attempt, "retain-times", "GetProcessTimes"),
      before = find(attempt, "retain-before-exit", "WaitForSingleObject"),
      after = find(attempt, "after-child-exit", "WaitForSingleObject"),
      closed = find(attempt, "retained-close", "CloseHandle");
    assert(
      opened.sequence < image.sequence &&
        image.sequence < times.sequence &&
        times.sequence < before.sequence &&
        before.sequence < after.sequence &&
        after.sequence < closed.sequence,
    );
    for (const c of [image, times, closed]) {
      assert(typeof c.rawReturn === "number" && c.rawReturn !== 0);
      assert.equal(c.errorMeaningful, false);
    }
    for (const [c, raw] of [
      [before, 258],
      [after, 0],
    ]) {
      assert.equal(c.timeout, 0);
      assert.equal(c.rawReturn, raw);
      assert.equal(c.creationTime, r.creationTime);
      assert.equal(c.errorMeaningful, false);
    }
    assert.equal(closed.creationTime, r.creationTime);
  }
  assert.equal(
    accounted.size,
    p.calls.length,
    "Every raw call belongs to authenticated or classified attempt",
  );
  assert.equal(p.observationAfterScenarioChildExit, true);
  assert.equal(p.ownedHostsAbsent, true);
  return {
    classifiedTerminalAttempts: p.terminalStartupAttempts.length,
    requiredAuthenticatedChildren: required.length,
    noRequiredChildExemption: true,
    parentBoundToAuthenticatedReceipt: true,
    denseCallSequence: true,
  };
}
