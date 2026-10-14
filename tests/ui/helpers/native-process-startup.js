// Win32 creation timestamps/terminal classification: no retry or required-child exemption.
// https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes
import assert from "node:assert/strict";
/** CIM_DATETIME has six microsecond digits; .NET ISO formatting pads a seventh zero.
 * https://learn.microsoft.com/en-us/windows/win32/wmisdk/cim-datetime
 * @param {string} text @param {number|undefined} [declaredPrecision] */
export function creationInterval(text, declaredPrecision) {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{6,7})Z$/.exec(text);
  assert(m, "Closed UTC microsecond/100ns snapshot only");
  const ms = Date.parse(m[1] + "Z");
  assert(Number.isSafeInteger(ms));
  assert.equal(new Date(ms).toISOString().slice(0, 19), m[1]);
  const precision = declaredPrecision ?? m[2].length;
  assert(
    [6, 7].includes(precision),
    "Only microsecond or 100ns precision is admitted",
  );
  assert(
    precision === m[2].length ||
      (precision === 6 && m[2].length === 7 && m[2].endsWith("0")),
    "Declared precision must match serialization or padded CIM microseconds",
  );
  const start =
    (BigInt(ms) + 11644473600000n) * 10000n + BigInt(m[2].padEnd(7, "0"));
  return {
    start,
    end: start + 10n ** BigInt(7 - precision),
    precisionDigits: precision,
  };
}
/** @param {{host:boolean,row:any,parent:any,failure:any,wait:any,times:any,closed:any}} input */
export function classifyTerminalStartup({
  host,
  row,
  parent,
  failure,
  wait,
  times,
  closed,
}) {
  assert.equal(host, false, "Host failure always fatal");
  assert(Number.isSafeInteger(row.pid) && row.pid > 0);
  assert.notEqual(row.pid, parent.pid);
  assert.equal(row.parentPid, parent.pid);
  assert.equal(parent.retainedBeforeExit, true);
  assert.match(parent.creationTime, /^[1-9][0-9]+$/);
  assert.equal(failure.api, "QueryFullProcessImageNameW");
  assert.equal(failure.phase, "retain-image");
  assert.equal(failure.rawReturn, 0);
  assert.equal(failure.lastError, 31);
  assert.equal(failure.errorMeaningful, true);
  assert.match(failure.handle, /^[1-9][0-9]*$/);
  assert(Number.isSafeInteger(failure.sequence) && failure.sequence >= 0);
  for (const call of [failure, wait, times, closed]) {
    assert.equal(call.pid, row.pid);
    assert.equal(call.parentPid, row.parentPid);
    assert.deepEqual(call.cimSnapshot, row);
    assert.equal(call.handle, failure.handle);
  }
  assert.equal(wait.api, "WaitForSingleObject");
  assert.equal(wait.phase, "startup-immediate-wait");
  assert.equal(wait.sequence, failure.sequence + 1, "No intervening API/retry");
  assert.equal(wait.timeout, 0);
  assert.equal(wait.rawReturn, 0);
  assert.equal(wait.errorMeaningful, false);
  assert.equal(times.api, "GetProcessTimes");
  assert.equal(times.sequence, wait.sequence + 1);
  assert(typeof times.rawReturn === "number" && times.rawReturn !== 0);
  assert.equal(times.errorMeaningful, false);
  assert.match(times.creationTime, /^[1-9][0-9]+$/);
  assert.match(times.exitTime, /^[1-9][0-9]+$/);
  const creation = BigInt(times.creationTime),
    exit = BigInt(times.exitTime),
    interval = creationInterval(
      row.creationTime,
      row.cimCreationPrecisionDigits,
    );
  assert(
    creation >= interval.start && creation < interval.end,
    "PID/creation snapshot mismatch",
  );
  assert(creation >= BigInt(parent.creationTime));
  assert(exit >= creation);
  assert.equal(closed.api, "CloseHandle");
  assert.equal(closed.sequence, times.sequence + 1);
  assert(typeof closed.rawReturn === "number" && closed.rawReturn !== 0);
  assert.equal(closed.errorMeaningful, false);
  return {
    kind: "terminal-startup-attempt",
    pid: row.pid,
    parentPid: row.parentPid,
    cimSnapshot: row,
    parentSnapshot: { ...parent },
    handle: failure.handle,
    creationTime: times.creationTime,
    exitTime: times.exitTime,
    creationPrecisionDigits: interval.precisionDigits,
    immediateWaitResult: 0,
    handleClosed: true,
    imageAuthenticated: false,
    requiredChildProof: false,
    rawFailure: failure,
    wait,
    times,
    closed,
  };
}
/** @param {any[]} required @param {any[]} authenticated @param {any[]} terminal */
export function requiredCoverage(required, authenticated, terminal) {
  const ids = new Set(required.map((r) => r.pid));
  for (const row of terminal) {
    assert.equal(row.kind, "terminal-startup-attempt");
    assert(
      !ids.has(row.pid),
      "Classified attempt never substitutes for required child",
    );
  }
  assert.deepEqual(
    authenticated.map((r) => r.pid).sort((a, b) => a - b),
    required.map((r) => r.pid).sort((a, b) => a - b),
  );
  for (const row of required) {
    const proof = authenticated.find((r) => r.pid === row.pid);
    assert.equal(proof.cimCreationTime, row.creationTime);
    assert.equal(proof.retainedBeforeExit, true);
    assert.equal(proof.waitResult, 0);
    assert.equal(proof.signaled, true);
    assert.equal(proof.handleClosed, true);
    assert.match(proof.imageSHA256, /^[a-f0-9]{64}$/);
  }
}
