import assert from "node:assert/strict";
import { readFile, writeFile, lstat, realpath } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { createHash } from "node:crypto";
import { validateClassifiedObserver } from "./native-process-audit.js";

/** @param {Uint8Array} bytes */
export const namespaceHash = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
/** Only ordinary evidence files under this workspace's ignored artifacts.
 * @param {string} path */
export async function namespaceRead(path) {
  const full = resolve(path),
    base = resolve("artifacts");
  assert.ok(full.startsWith(base + sep));
  const stat = await lstat(full);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal((await realpath(full)).toLowerCase(), full.toLowerCase());
  return readFile(full);
}
/** @param {string} path @param {any} value */
export async function namespaceSave(path, value) {
  assert.ok(resolve(path).startsWith(resolve("artifacts") + sep));
  const parent = resolve(path, "..");
  assert.equal((await realpath(parent)).toLowerCase(), parent.toLowerCase());
  await writeFile(path, JSON.stringify(value, null, 2), { flag: "wx" });
}
// CIM_DATETIME records microseconds; .NET 'o' adds a seventh zero. Preserve
// the producer's precision so a native FILETIME is checked inside that interval.
// https://learn.microsoft.com/en-us/windows/win32/wmisdk/cim-datetime
export const namespaceProcessQuery =
  "@((Get-CimInstance Win32_Process)|ForEach-Object {@{pid=[int]$_.ProcessId;parentPid=[int]$_.ParentProcessId;name=$_.Name;path=$_.ExecutablePath;creationTime=$(if($_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{$null});cimCreationPrecisionDigits=6}})|ConvertTo-Json -Compress";
export function namespaceProcessTable() {
  assert.equal(process.platform, "win32");
  const child = Bun.spawnSync(
    [
      "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      namespaceProcessQuery,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(child.exitCode, 0);
  assert.equal(child.success, true);
  assert.ok(child.signalCode == null);
  assert.notEqual(child.exitedDueToTimeout, true);
  const raw = JSON.parse(Buffer.from(child.stdout).toString()),
    rows = Array.isArray(raw) ? raw : [raw];
  assert.ok(rows.length <= 10000);
  assert.equal(
    rows.length,
    new Set(rows.map((/** @type {any} */ row) => row.pid)).size,
  );
  return rows;
}
export function namespaceHosts() {
  return namespaceProcessTable()
    .filter(
      (/** @type {any} */ row) =>
        typeof row.name === "string" && /^insomnium.*\.exe$/i.test(row.name),
    )
    .map((/** @type {any} */ row) => ({
      ProcessId: row.pid,
      ExecutablePath: row.path,
      CreationDate: row.creationTime,
    }));
}
/** @param {any[]} table @param {number} pid @param {string} executable */
export function namespaceOwnedSnapshot(table, pid, executable) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const host = table.find((row) => row.pid === pid);
  assert.ok(host);
  assert.equal(host.path.toLowerCase(), resolve(executable).toLowerCase());
  const known = new Set([pid]),
    descendants = /** @type {any[]} */ ([]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of table)
      if (known.has(row.parentPid) && !known.has(row.pid)) {
        known.add(row.pid);
        descendants.push(row);
        changed = true;
      }
  }
  assert.ok(descendants.length <= 256);
  for (const row of [host, ...descendants]) {
    assert.ok(
      Number.isSafeInteger(row.pid) &&
        row.pid > 0 &&
        Number.isSafeInteger(row.parentPid),
    );
    assert.match(row.path, /^[A-Za-z]:\\/);
    assert.match(
      row.creationTime,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/,
    );
    assert.equal(row.cimCreationPrecisionDigits, 6);
  }
  return {
    host: { ...host },
    descendants: descendants.map((row) => ({ ...row })),
  };
}
/** @param {number} pid @param {string} output @param {string} phase @param {{artifact:string,exeSHA256:string}} binding */
export async function recordNamespaceProcesses(pid, output, phase, binding) {
  assert.ok(["before-first-save", "before-close"].includes(phase));
  const started = new Date().toISOString(),
    snapshot = namespaceOwnedSnapshot(
      namespaceProcessTable(),
      pid,
      binding.artifact,
    );
  const hostImageSHA256 = namespaceHash(await readFile(binding.artifact));
  assert.equal(hostImageSHA256, binding.exeSHA256);
  const receipt = {
    phase,
    pid,
    started,
    finished: new Date().toISOString(),
    processQuery: namespaceProcessQuery,
    physicalSettlementClaim: false,
    ...snapshot,
    hostImageSHA256,
  };
  await namespaceSave(
    join(output, "namespace-process-" + phase + ".json"),
    receipt,
  );
  return receipt;
}
/** Every independently recorded/transitive child remains mandatory.
 * @param {any} before @param {any} closing @param {any} physical @param {any[]} additional @param {{artifact:string,exeSHA256:string}} binding */
export function auditNamespaceProcesses(
  before,
  closing,
  physical,
  additional,
  binding,
) {
  assert.equal(before.phase, "before-first-save");
  assert.equal(closing.phase, "before-close");
  assert.deepEqual(before.host, closing.host);
  assert.equal(before.hostImageSHA256, binding.exeSHA256);
  assert.equal(closing.hostImageSHA256, binding.exeSHA256);
  assert.equal(physical.pid, before.pid);
  assert.equal(
    physical.imagePath.toLowerCase(),
    resolve(binding.artifact).toLowerCase(),
  );
  assert.equal(physical.cimCreationTime, before.host.creationTime);
  assert.equal(physical.imageSHA256, binding.exeSHA256);
  const required = new Map();
  for (const row of [
    ...before.descendants,
    ...closing.descendants,
    ...additional,
  ]) {
    if (required.has(row.pid))
      assert.deepEqual(required.get(row.pid), row, "PID identity changed");
    else required.set(row.pid, row);
  }
  const result = validateClassifiedObserver(physical, [...required.values()]);
  for (const row of required.values()) {
    const authenticated = physical.observedChildren.find(
      (/** @type {any} */ r) => r.pid === row.pid,
    );
    assert.equal(authenticated.parentPid, row.parentPid);
    assert.equal(authenticated.imagePath.toLowerCase(), row.path.toLowerCase());
    assert.equal(authenticated.cimCreationTime, row.creationTime);
  }
  return {
    ...result,
    independentSnapshotChildren: required.size,
    hostSnapshotBound: true,
    allRecordedChildrenRequired: true,
  };
}
