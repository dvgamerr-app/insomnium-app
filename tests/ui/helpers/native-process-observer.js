// Official ABI contracts: only query/synchronize rights; never terminate processes.
// https://bun.sh/docs/runtime/ffi
// https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess
// https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew
// https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes
// https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject
// https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle
import assert from "node:assert/strict";
import {
  classifyTerminalStartup,
  creationInterval,
} from "./native-process-startup.js";
import { nativeErrorTree } from "./native-error.js";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
/** @param {Uint8Array} b */
const sha = (b) => createHash("sha256").update(b).digest("hex");
// Pure injectable orchestration for preparation guards. Production uses only query/synchronize APIs.
/** @typedef {{child:{exitCode:number|null,exited:Promise<number>},hostObservation:()=>any[],processObservation:()=>any[],exe:string,exeSHA256:string,output:string}} ObserverOptions */
/** @param {ObserverOptions} options @param {{k:any,pointer:(view:any)=>any,imageHash:(path:string)=>Promise<string>,sleep:(ms:number)=>Promise<any>,write:(path:string,value:any)=>Promise<any>,now:()=>string,closeLibrary:()=>void,sourceSHA256:string}} d */
export async function observeWithApi(
  { child, hostObservation, processObservation, exe, exeSHA256, output },
  d,
) {
  const retained = /** @type {Map<number,any>} */ (new Map()),
    terminal = /** @type {Map<number,any>} */ (new Map()),
    k = d.k;
  const result = /** @type {any} */ ({
    observerSourceSHA256: d.sourceSHA256,
    retainedBeforeExit: false,
    observationAfterScenarioChildExit: false,
    handleClosed: false,
    observedChildren: [],
    calls: [],
    attempts: [],
    terminalStartupAttempts: [],
    errors: [],
  });
  /** @param {unknown} error @param {string} phase */
  const fail = (error, phase) => {
    result.errors.push({
      phase,
      error: String(error),
      errorTree: nativeErrorTree(error),
    });
    result.errorTree ??= nativeErrorTree(error);
    result.error ??= String(error);
  };
  /** @param {string} name @param {any[]} args @param {any} row @param {any} handle @param {string} phase @param {string|null} creationTime */
  function call(name, args, row, handle, phase, creationTime = null) {
    const started = d.now(),
      raw = k[name](...args),
      lastError = k.GetLastError();
    const value = typeof raw === "bigint" ? raw.toString() : raw;
    const entry = /** @type {any} */ ({
      phase,
      api: name,
      pid: row.pid,
      parentPid: row.parentPid,
      cimSnapshot: { ...row },
      handle: handle === null ? null : handle.toString(),
      creationTime,
      started,
      finished: d.now(),
      rawReturn: value,
      lastError,
      errorMeaningful:
        name === "WaitForSingleObject"
          ? raw === 0xffffffff
          : name === "OpenProcess"
            ? raw === 0n
            : raw === 0,
    });
    if (name === "OpenProcess") entry.handle = raw.toString();
    entry.sequence = result.calls.length;
    if (name === "WaitForSingleObject") entry.timeout = args[1];
    result.calls.push(entry);
    if (entry.errorMeaningful) result.firstFailure ??= { ...entry };
    return raw;
  }
  /** @param {any} row @param {boolean} host */
  async function retain(row, host) {
    if (terminal.has(row.pid)) {
      const known = terminal.get(row.pid);
      assert.deepEqual(
        known.cimSnapshot,
        row,
        "Terminal PID snapshot changed; no retry/reuse",
      );
      return;
    }
    if (retained.has(row.pid)) {
      const previous = retained.get(row.pid).receipt;
      assert.equal(
        previous.cimCreationTime,
        row.creationTime,
        "Owned PID reuse refused",
      );
      assert.equal(previous.parentPid, row.parentPid);
      return;
    }
    assert(Number.isSafeInteger(row.pid) && row.pid > 0 && row.path);
    const attempt = /** @type {any} */ ({
      pid: row.pid,
      parentPid: row.parentPid,
      cimSnapshot: { ...row },
      started: d.now(),
      accepted: false,
    });
    result.attempts.push(attempt);
    const handle = call(
      "OpenProcess",
      [0x100000 | 0x1000, 0, row.pid],
      row,
      null,
      "retain-open",
    );
    attempt.handle = handle.toString();
    assert.notEqual(handle, 0n);
    let accepted = false,
      closeAttempted = false;
    try {
      const text = new Uint16Array(32768),
        length = new Uint32Array([text.length]);
      const imageOK = call(
        "QueryFullProcessImageNameW",
        [handle, 0, d.pointer(text), d.pointer(length)],
        row,
        handle,
        "retain-image",
      );
      if (!imageOK && !host && result.calls.at(-1).lastError === 31) {
        const failure = result.calls.at(-1),
          waitResult = call(
            "WaitForSingleObject",
            [handle, 0],
            row,
            handle,
            "startup-immediate-wait",
          ),
          wait = result.calls.at(-1);
        assert.equal(
          waitResult,
          0,
          "Active or unknown startup attempt refused",
        );
        const creation = new BigUint64Array(1),
          exit = new BigUint64Array(1),
          system = new BigUint64Array(1),
          user = new BigUint64Array(1);
        const timesResult = call(
            "GetProcessTimes",
            [
              handle,
              d.pointer(creation),
              d.pointer(exit),
              d.pointer(system),
              d.pointer(user),
            ],
            row,
            handle,
            "startup-times",
          ),
          times = result.calls.at(-1);
        assert(timesResult);
        times.creationTime = creation[0].toString();
        times.exitTime = exit[0].toString();
        closeAttempted = true;
        attempt.handleClosed =
          call(
            "CloseHandle",
            [handle],
            row,
            handle,
            "startup-close",
            times.creationTime,
          ) !== 0;
        const closed = result.calls.at(-1),
          parent = retained.get(row.parentPid);
        assert(parent, "Startup parent must already be authenticated");
        const classification = classifyTerminalStartup({
          host,
          row,
          parent: parent.receipt,
          failure,
          wait,
          times,
          closed,
        });
        attempt.creationTime = classification.creationTime;
        attempt.classification = classification.kind;
        terminal.set(row.pid, classification);
        result.terminalStartupAttempts.push(classification);
        return;
      }
      assert(imageOK);
      assert(length[0] > 0 && length[0] < text.length);
      const imagePath = String.fromCharCode(...text.subarray(0, length[0]));
      assert.equal(imagePath.toLowerCase(), row.path.toLowerCase());
      const imageSHA256 = await d.imageHash(imagePath);
      if (host) {
        assert.equal(imagePath, exe);
        assert.equal(imageSHA256, exeSHA256);
      }
      const creation = new BigUint64Array(1),
        exit = new BigUint64Array(1),
        system = new BigUint64Array(1),
        user = new BigUint64Array(1);
      assert(
        call(
          "GetProcessTimes",
          [
            handle,
            d.pointer(creation),
            d.pointer(exit),
            d.pointer(system),
            d.pointer(user),
          ],
          row,
          handle,
          "retain-times",
        ),
      );
      attempt.creationTime = creation[0].toString();
      const interval = creationInterval(
        row.creationTime,
        row.cimCreationPrecisionDigits,
      );
      assert(
        creation[0] >= interval.start && creation[0] < interval.end,
        "Authenticated PID/creation snapshot mismatch",
      );
      const beforeExitWaitResult = call(
        "WaitForSingleObject",
        [handle, 0],
        row,
        handle,
        "retain-before-exit",
        attempt.creationTime,
      );
      assert.equal(beforeExitWaitResult, 258);
      retained.set(row.pid, {
        handle,
        host,
        row,
        receipt: {
          pid: row.pid,
          parentPid: row.parentPid,
          imagePath,
          imageSHA256,
          creationTime: attempt.creationTime,
          cimCreationTime: row.creationTime,
          retainedBeforeExit: true,
          beforeExitWaitResult,
          retainedAt: d.now(),
        },
      });
      accepted = true;
      attempt.accepted = true;
    } finally {
      if (!accepted && !closeAttempted) {
        attempt.handleClosed =
          call(
            "CloseHandle",
            [handle],
            row,
            handle,
            "refused-close",
            attempt.creationTime ?? null,
          ) !== 0;
        assert(attempt.handleClosed);
      }
    }
  }
  try {
    while (child.exitCode === null) {
      const hosts = hostObservation();
      assert(hosts.length <= 1);
      if (hosts.length) {
        const host = hosts[0];
        assert.equal(host.ExecutablePath, exe);
        const table = processObservation(),
          row = table.find((r) => r.pid === host.ProcessId);
        assert(row);
        await retain(row, true);
        const descendants = [],
          known = new Set([row.pid]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const r of table)
            if (known.has(r.parentPid) && !known.has(r.pid)) {
              known.add(r.pid);
              descendants.push(r);
              changed = true;
            }
        }
        for (const r of descendants) await retain(r, false);
        Object.assign(result, retained.get(row.pid).receipt);
        await d.write(output + "/physical-host-before-exit.json", {
          ...result,
          observedChildren: [...retained.values()]
            .filter((r) => !r.host)
            .map((r) => r.receipt),
        });
      }
      await d.sleep(100);
    }
  } catch (error) {
    fail(error, "observation");
  } finally {
    try {
      await child.exited;
      result.observationAfterScenarioChildExit = true;
    } catch (error) {
      fail(error, "child-exited");
    }
    // Every authenticated retained object is sampled independently even after any earlier error.
    if (result.observationAfterScenarioChildExit) {
      if (![...retained.values()].some((r) => r.host))
        fail(Error("Host never observed alive"), "terminal-host");
      for (const r of retained.values())
        try {
          r.receipt.waitResult = call(
            "WaitForSingleObject",
            [r.handle, 0],
            r.row,
            r.handle,
            "after-child-exit",
            r.receipt.creationTime,
          );
          r.receipt.signaled = r.receipt.waitResult === 0;
          assert(
            r.receipt.signaled,
            "Retained owned process is still live: " + r.receipt.pid,
          );
        } catch (error) {
          fail(error, "terminal-wait-" + r.row.pid);
        }
      try {
        result.ownedHostsAbsent = hostObservation().length === 0;
        assert(result.ownedHostsAbsent);
      } catch (error) {
        fail(error, "postexit-hosts");
      }
    }
    for (const r of retained.values())
      try {
        r.receipt.handleClosed =
          call(
            "CloseHandle",
            [r.handle],
            r.row,
            r.handle,
            "retained-close",
            r.receipt.creationTime,
          ) !== 0;
        assert(r.receipt.handleClosed);
      } catch (error) {
        fail(error, "close-" + r.row.pid);
      }
    const host = [...retained.values()].find((r) => r.host);
    if (host) Object.assign(result, host.receipt);
    result.observedChildren = [...retained.values()]
      .filter((r) => !r.host)
      .map((r) => r.receipt);
    result.observedAt = d.now();
    try {
      d.closeLibrary();
    } catch (error) {
      fail(error, "library-close");
    }
    await d.write(output + "/physical-host-after-exit.json", result);
  }
  return result;
}
/** Load query/synchronize-only Win32 symbols only for an explicitly invoked live observer.
 * @param {ObserverOptions} options */
export async function observeHost(options) {
  assert.equal(process.platform, "win32");
  assert.equal(process.arch, "x64", "Reviewed handle ABI is Windows x64");
  const { dlopen, ptr } = await import("bun:ffi");
  const sourceSHA256 = sha(await readFile(import.meta.path));
  const lib = dlopen("kernel32.dll", {
    OpenProcess: { args: ["u32", "i32", "u32"], returns: "u64" },
    QueryFullProcessImageNameW: {
      args: ["u64", "u32", "ptr", "ptr"],
      returns: "i32",
    },
    GetProcessTimes: {
      args: ["u64", "ptr", "ptr", "ptr", "ptr"],
      returns: "i32",
    },
    WaitForSingleObject: { args: ["u64", "u32"], returns: "u32" },
    CloseHandle: { args: ["u64"], returns: "i32" },
    GetLastError: { args: [], returns: "u32" },
  });
  return observeWithApi(options, {
    k: lib.symbols,
    pointer: ptr,
    imageHash: async (p) => sha(await readFile(p)),
    sleep: (ms) => Bun.sleep(ms),
    write: async (p, value) => writeFile(p, JSON.stringify(value, null, 2)),
    now: () => new Date().toISOString(),
    closeLibrary: () => lib.close(),
    sourceSHA256,
  });
}
