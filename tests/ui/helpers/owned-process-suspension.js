import assert from "node:assert/strict";
import { dlopen, ptr } from "bun:ffi";
import { basename, join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import {
  namespaceOwnedSnapshot,
  namespaceProcessTable,
} from "./namespace-process-evidence.js";
import { creationInterval } from "./native-process-startup.js";
import { resourceCrudProbeIdentifier } from "./native-profile-ownership.js";

// Debugger-style fault injection, never synchronization of application threads.
// https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-suspendthread
// https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-resumethread
// https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-threadentry32
/** Suspend only the owned native host or its unique profile-bound WebView renderer.
 * Every successful suspend increment has one matching resume, including failures.
 * @param {{pid:number,output:string,artifact:string,exeSHA256:string,kind:'renderer'|'host',name:string}} options
 * @param {(control:{verify:()=>void,evidence:Record<string,any>})=>Promise<any>} during */
export async function withOwnedProcessSuspended(options, during) {
  assert.equal(process.platform, "win32");
  assert.ok(["renderer", "host"].includes(options.kind));
  assert.match(options.name, /^[a-z0-9-]+$/);
  assert.notEqual(options.pid, process.pid);
  const output = resolve(options.output),
    artifact = resolve(options.artifact);
  assert.ok(output.startsWith(resolve("artifacts/playwright") + sep));
  assert.ok(artifact.startsWith(resolve("artifacts") + sep));
  assert.equal(
    createHash("sha256")
      .update(await Bun.file(artifact).bytes())
      .digest("hex"),
    options.exeSHA256,
  );
  assert.ok(
    Buffer.from(await Bun.file(artifact).bytes()).includes(
      Buffer.from(resourceCrudProbeIdentifier),
    ),
    "Require the closed isolated probe identity",
  );
  const library = dlopen("kernel32.dll", {
    OpenProcess: { args: ["u32", "i32", "u32"], returns: "u64" },
    GetProcessId: { args: ["u64"], returns: "u32" },
    GetProcessTimes: {
      args: ["u64", "ptr", "ptr", "ptr", "ptr"],
      returns: "i32",
    },
    QueryFullProcessImageNameW: {
      args: ["u64", "u32", "ptr", "ptr"],
      returns: "i32",
    },
    CreateToolhelp32Snapshot: { args: ["u32", "u32"], returns: "u64" },
    Thread32First: { args: ["u64", "ptr"], returns: "i32" },
    Thread32Next: { args: ["u64", "ptr"], returns: "i32" },
    OpenThread: { args: ["u32", "i32", "u32"], returns: "u64" },
    GetProcessIdOfThread: { args: ["u64"], returns: "u32" },
    GetThreadId: { args: ["u64"], returns: "u32" },
    SuspendThread: { args: ["u64"], returns: "u32" },
    ResumeThread: { args: ["u64"], returns: "u32" },
    WaitForSingleObject: { args: ["u64", "u32"], returns: "u32" },
    CloseHandle: { args: ["u64"], returns: "i32" },
    GetLastError: { args: [], returns: "u32" },
  });
  const k = library.symbols;
  /** @type {Map<number,{handle:bigint,row:any}>} */ const processes =
    new Map();
  /** @type {Map<number,{handle:bigint,increments:number,baseline:number}>} */ const threads =
    new Map();
  /** @type {unknown[]} */ const failures = [];
  const evidence = /** @type {Record<string,any>} */ ({
    kind: options.kind,
    ownerPid: options.pid,
    started: Date.now(),
    targetPid: null,
    processes: [],
    calls: [],
    threadSnapshots: [],
    fullyFrozenAt: null,
    resumeStarted: null,
    resumedAt: null,
    watchdogExpired: false,
    handlesClosed: false,
    errors: [],
  });
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let watchdog;
  /** @type {any} */ let value;
  /** @param {string} api @param {number} pid @param {number|null} tid @param {any} result */
  const log = (api, pid, tid, result) =>
    evidence.calls.push({
      api,
      pid,
      tid,
      result: typeof result === "bigint" ? String(result) : result,
      at: Date.now(),
    });
  /** @param {any} row */
  const retainProcess = (row) => {
    if (processes.has(row.pid)) return processes.get(row.pid);
    const handle = k.OpenProcess(0x100000 | 0x1000, 0, row.pid);
    assert.notEqual(handle, 0n, "Open owned process failed");
    processes.set(row.pid, { handle, row });
    assert.equal(k.GetProcessId(handle), row.pid);
    assert.equal(
      k.WaitForSingleObject(handle, 0),
      258,
      "Owned process must be alive",
    );
    const text = new Uint16Array(32768),
      length = new Uint32Array([text.length]);
    assert.notEqual(
      k.QueryFullProcessImageNameW(handle, 0, ptr(text), ptr(length)),
      0,
    );
    assert.equal(
      String.fromCharCode(...text.subarray(0, length[0])).toLowerCase(),
      resolve(row.path).toLowerCase(),
    );
    const creation = new BigUint64Array(1),
      exit = new BigUint64Array(1),
      kernel = new BigUint64Array(1),
      user = new BigUint64Array(1);
    assert.notEqual(
      k.GetProcessTimes(
        handle,
        ptr(creation),
        ptr(exit),
        ptr(kernel),
        ptr(user),
      ),
      0,
    );
    const interval = creationInterval(
      row.creationTime,
      row.cimCreationPrecisionDigits,
    );
    assert.ok(
      creation[0] >= interval.start && creation[0] < interval.end,
      "PID creation identity must match CIM",
    );
    evidence.processes.push({
      ...row,
      handle: String(handle),
      nativeCreationTime: String(creation[0]),
    });
    return processes.get(row.pid);
  };
  /** @param {number} pid */
  const threadIds = (pid) => {
    const snapshot = k.CreateToolhelp32Snapshot(4, 0);
    assert.ok(snapshot !== 0n && snapshot !== 0xffffffffffffffffn);
    const ids = /** @type {number[]} */ ([]);
    try {
      const entry = new Uint32Array(7);
      entry[0] = 28;
      let present = k.Thread32First(snapshot, ptr(entry)),
        count = 0;
      while (present) {
        assert.ok(++count < 100000 && entry[0] >= 16);
        if (entry[3] === pid) ids.push(entry[2]);
        entry[0] = 28;
        present = k.Thread32Next(snapshot, ptr(entry));
      }
      assert.equal(
        k.GetLastError(),
        18,
        "Thread enumeration must finish normally",
      );
    } finally {
      assert.notEqual(k.CloseHandle(snapshot), 0);
    }
    assert.ok(ids.length > 0 && ids.length < 512);
    assert.equal(new Set(ids).size, ids.length);
    evidence.threadSnapshots.push({ at: Date.now(), pid, ids });
    return ids;
  };
  const resume = () => {
    evidence.resumeStarted ??= Date.now();
    for (const [tid, row] of [...threads].reverse())
      while (row.increments > 0) {
        const expected = row.baseline + row.increments;
        const previous = k.ResumeThread(row.handle);
        log("ResumeThread", evidence.targetPid, tid, previous);
        if (previous === 0xffffffff) {
          failures.push(new Error("Resume owned thread failed: " + tid));
          break;
        }
        if (previous !== expected)
          failures.push(
            new Error(
              "Owned suspend count changed: " +
                tid +
                "/" +
                previous +
                " expected " +
                expected,
            ),
          );
        row.increments = previous === 0 ? 0 : row.increments - 1;
      }
    if ([...threads.values()].every((row) => row.increments === 0))
      evidence.resumedAt = Date.now();
  };
  const verify = () => {
    assert.equal(evidence.resumedAt, null, "Suspension already released");
    const target = processes.get(evidence.targetPid);
    assert.ok(target);
    assert.equal(k.WaitForSingleObject(target.handle, 0), 258);
    const ids = threadIds(evidence.targetPid);
    assert.equal(
      ids.length,
      threads.size,
      "Thread set changed during suspension",
    );
    for (const tid of ids) {
      const row = threads.get(tid);
      assert.ok(row && row.increments === 1 && row.baseline === 0);
      assert.equal(k.GetProcessIdOfThread(row.handle), evidence.targetPid);
      assert.equal(k.WaitForSingleObject(row.handle, 0), 258);
      const previous = k.SuspendThread(row.handle);
      log("VerifySuspendThread", evidence.targetPid, tid, previous);
      assert.notEqual(previous, 0xffffffff);
      row.increments++;
      const restored = k.ResumeThread(row.handle);
      if (restored !== 0xffffffff) row.increments--;
      log("VerifyResumeThread", evidence.targetPid, tid, restored);
      assert.equal(previous, 1, "All owned threads must remain suspended");
      assert.equal(
        restored,
        2,
        "Verification must restore our original suspend count",
      );
    }
  };
  try {
    const owned = namespaceOwnedSnapshot(
      namespaceProcessTable(),
      options.pid,
      artifact,
    );
    retainProcess(owned.host);
    /** @type {any} */ let target = owned.host;
    if (options.kind === "renderer") {
      const ids = owned.descendants.map((row) => row.pid);
      assert.ok(ids.length > 0);
      for (const id of ids) assert.ok(Number.isSafeInteger(id) && id > 0);
      const filter = ids.map((id) => "ProcessId=" + id).join(" OR ");
      const query =
        "@(Get-CimInstance Win32_Process -Filter '" +
        filter +
        "' | ForEach-Object {@{pid=[int]$_.ProcessId;commandLine=$_.CommandLine;creationTime=$_.CreationDate.ToUniversalTime().ToString('o')}})|ConvertTo-Json -Compress";
      const child = Bun.spawnSync(
        [
          "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          query,
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
          stdin: "ignore",
          windowsHide: true,
          timeout: 5000,
          maxBuffer: 2 * 1024 * 1024,
        },
      );
      assert.equal(child.exitCode, 0);
      assert.equal(child.success, true);
      const raw = JSON.parse(Buffer.from(child.stdout).toString()),
        commands = Array.isArray(raw) ? raw : [raw];
      const renderers = owned.descendants.filter(
        (row) =>
          basename(row.path).toLowerCase() === "msedgewebview2.exe" &&
          /(?:^|\s)--type=renderer(?:\s|$)/.test(
            commands.find((c) => c.pid === row.pid)?.commandLine ?? "",
          ),
      );
      assert.equal(
        renderers.length,
        1,
        "Require one unambiguous owned renderer",
      );
      target = renderers[0];
      /** @type {any[]} */ const chain = [];
      let cursor = target;
      while (cursor.pid !== options.pid) {
        assert.ok(chain.length < 16);
        chain.push(cursor);
        retainProcess(cursor);
        const command = commands.find((c) => c.pid === cursor.pid);
        assert.ok(command);
        assert.equal(
          command.creationTime,
          cursor.creationTime,
          "Command line must bind the same process birth",
        );
        cursor = [owned.host, ...owned.descendants].find(
          (row) => row.pid === cursor.parentPid,
        );
        assert.ok(cursor, "Renderer ancestry must reach owned host");
        retainProcess(cursor);
        const childBirth = evidence.processes.find(
          (/** @type {any} */ row) => row.pid === chain.at(-1).pid,
        ).nativeCreationTime;
        const parentBirth = evidence.processes.find(
          (/** @type {any} */ row) => row.pid === cursor.pid,
        ).nativeCreationTime;
        assert.ok(
          BigInt(childBirth) >= BigInt(parentBirth),
          "Child birth must follow retained parent birth",
        );
      }
      const profile = resolve(
        join(output, "webview-profile", "EBWebView"),
      ).toLowerCase();
      evidence.ancestry = chain;
      evidence.profileBinding = {
        profile,
        rendererPid: target.pid,
        commandLines: chain.map((row) =>
          commands.find((c) => c.pid === row.pid),
        ),
      };
      assert.ok(
        chain.some((row) => {
          const command =
            commands.find((c) => c.pid === row.pid)?.commandLine ?? "";
          const match = /(?:^|\s)--user-data-dir=(?:"([^"]+)"|(\S+))/.exec(
            command,
          );
          return (
            match && resolve(match[1] ?? match[2]).toLowerCase() === profile
          );
        }),
        "Renderer ancestry must carry this scenario's exact profile",
      );
    }
    assert.notEqual(target.pid, process.pid);
    evidence.targetPid = target.pid;
    const retained = retainProcess(target);
    assert.ok(retained);
    for (let pass = 0; pass < 8; pass++) {
      assert.equal(k.WaitForSingleObject(retained.handle, 0), 258);
      const missing = threadIds(target.pid).filter((tid) => !threads.has(tid));
      if (!missing.length) break;
      assert.ok(pass < 7, "Thread set did not settle");
      for (const tid of missing) {
        const handle = k.OpenThread(2 | 0x800 | 0x100000, 0, tid);
        assert.notEqual(handle, 0n, "Open owned thread failed");
        const retainedThread = { handle, increments: 0, baseline: 0 };
        threads.set(tid, retainedThread);
        assert.equal(k.GetThreadId(handle), tid);
        assert.equal(k.GetProcessIdOfThread(handle), target.pid);
        assert.equal(k.WaitForSingleObject(handle, 0), 258);
        const previous = k.SuspendThread(handle);
        log("SuspendThread", target.pid, tid, previous);
        assert.notEqual(previous, 0xffffffff);
        retainedThread.increments++;
        retainedThread.baseline = previous;
        assert.equal(previous, 0, "Refuse a pre-suspended thread");
      }
    }
    evidence.fullyFrozenAt = Date.now();
    verify();
    watchdog = setTimeout(() => {
      evidence.watchdogExpired = true;
      resume();
    }, 60000);
    value = await during({ verify, evidence });
    assert.equal(evidence.watchdogExpired, false, "Suspension watchdog fired");
    verify();
  } catch (error) {
    failures.push(error);
  } finally {
    if (watchdog) clearTimeout(watchdog);
    resume();
    let closedHandles = true;
    for (const [tid, row] of threads) {
      if (row.increments > 0)
        failures.push(new Error("Thread remains suspended: " + tid));
      if (!k.CloseHandle(row.handle)) {
        closedHandles = false;
        failures.push(new Error("Thread handle close failed: " + tid));
      }
    }
    for (const [pid, row] of processes)
      if (!k.CloseHandle(row.handle)) {
        closedHandles = false;
        failures.push(new Error("Process handle close failed: " + pid));
      }
    library.close();
    evidence.handlesClosed = closedHandles;
    evidence.errors = failures.map(String);
    await Bun.write(
      join(output, options.name + "-suspension.json"),
      JSON.stringify(evidence, null, 2),
    );
  }
  if (failures.length)
    throw new AggregateError(failures, "Owned process suspension failed");
  return { value, evidence };
}
