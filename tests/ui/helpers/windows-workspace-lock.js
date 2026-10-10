import assert from "node:assert/strict";
import { dlopen, ptr } from "bun:ffi";
import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { probeIdentifier } from "./native-app.js";

/** Deny atomic replacement of this isolated probe's existing PluginData file.
 * Allows reads/writes, never creates/truncates/deletes. Release in finally. */
export async function lockProbePluginStoreReplacement() {
  assert.equal(process.platform, "win32");
  assert.ok(process.env.APPDATA);
  const expected = resolve(process.env.APPDATA, probeIdentifier, "plugin-data-v1.json");
  const path = await realpath(expected);
  assert.equal(path.toLowerCase(), expected.toLowerCase(), "Refuse redirected probe PluginData");
  return openReadLock(path, 3);
}

/** Allows reads/writes but denies replacement of the existing probe workspace.
 * Release in finally. Never creates/truncates/deletes a file. */
export async function lockProbeWorkspaceReplacement() {
  assert.equal(process.platform, "win32");
  assert.ok(process.env.APPDATA);
  const expected = resolve(
    process.env.APPDATA,
    probeIdentifier,
    "workspace-v1.json",
  );
  const path = await realpath(expected);
  assert.equal(
    path.toLowerCase(),
    expected.toLowerCase(),
    "Refuse redirected probe workspace",
  );
  return openReadLock(path, 3);
}

/** Deny native writes to an existing scenario-owned recovery artifact. Caller
 * creates the sentinel only after picker selection and releases in finally.
 * @param {string} output @param {string} selectedPath */
export async function lockScenarioCopyWrite(output, selectedPath) {
  assert.equal(process.platform, "win32");
  const root = await realpath(resolve(output));
  assert.equal(
    root.toLowerCase(),
    resolve(output).toLowerCase(),
    "Refuse redirected scenario output",
  );
  const path = await realpath(resolve(selectedPath));
  assert.equal(
    path.toLowerCase(),
    resolve(selectedPath).toLowerCase(),
    "Refuse redirected recovery artifact",
  );
  assert.ok(path.toLowerCase().startsWith((root + sep).toLowerCase()));
  assert.ok(path.endsWith(".json"));
  return openReadLock(path, 1);
}

/** Deny deletion of one existing payload file in the exact owned Push snapshot.
 * @param {string} stageName @param {string} operationId */
export async function lockProbePushPayload(stageName, operationId) {
  assert.equal(process.platform, "win32");
  assert.ok(process.env.APPDATA);
  assert.match(stageName, /^fetch-[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.match(operationId, /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const expected = resolve(
    process.env.APPDATA,
    probeIdentifier,
    "git-fetch-v1",
    stageName,
  );
  assert.equal(
    (await realpath(expected)).toLowerCase(),
    expected.toLowerCase(),
  );
  assert.equal(
    await Bun.file(resolve(expected, ".insomnium-push-snapshot")).text(),
    operationId,
  );
  const selected = resolve(expected, "repository", "config");
  const path = await realpath(selected);
  assert.equal(path.toLowerCase(), selected.toLowerCase());
  return openReadLock(path, 3); // Reads/writes allowed; delete sharing denied.
}

/** Deny atomic replacement of an existing exact owned Push receipt.
 * @param {string} operationId */
export async function lockProbePushReceipt(operationId) {
  assert.equal(process.platform, "win32");
  assert.ok(process.env.APPDATA);
  assert.match(operationId, /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const expected = resolve(
    process.env.APPDATA,
    probeIdentifier,
    "git-push-v1",
    "push-" + operationId,
    "receipt.json",
  );
  const path = await realpath(expected);
  assert.equal(path.toLowerCase(), expected.toLowerCase());
  const receipt = await Bun.file(path).json();
  assert.equal(receipt.intent.operationId, operationId);
  assert.equal(receipt.phase, "submitted");
  assert.equal(receipt.result, null);
  return openReadLock(path, 3);
}

/** @param {string} path @param {number} sharing */
function openReadLock(path, sharing) {
  const library = dlopen("kernel32.dll", {
    CreateFileW: {
      args: ["buffer", "u32", "u32", "ptr", "u32", "u32", "u64"],
      returns: "u64",
    },
    CloseHandle: { args: ["u64"], returns: "i32" },
    GetLastError: { args: [], returns: "u32" },
  });
  const filename = Buffer.from(path + "\0", "utf16le");
  // GENERIC_READ, caller-selected sharing, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL.
  const handle = library.symbols.CreateFileW(
    filename,
    0x80000000,
    sharing,
    null,
    3,
    128,
    0n,
  );
  if (BigInt(handle) === 0xffffffffffffffffn) {
    const error = library.symbols.GetLastError();
    library.close();
    throw new Error("CreateFileW failed: " + error);
  }
  let released = false;
  return {
    path,
    release() {
      if (released) return;
      released = true;
      try {
        assert.equal(
          library.symbols.CloseHandle(handle),
          1,
          "Close owned file handle",
        );
      } finally {
        library.close();
      }
    },
  };
}

/** Hold the actual native ref ownership lease to exercise live-owner refusal.
 * Only the existing isolated probe's managed repository is accepted.
 * @param {string} repositoryId */
export async function holdProbeRestoreLease(repositoryId) {
  return holdProbeLease(repositoryId, "insomnium-restore-ref-locks-v1.lease");
}

/** @param {string} repositoryId */
export async function holdProbeAdvanceLease(repositoryId) {
  return holdProbeLease(repositoryId, "insomnium-advance-ref-locks-v1.lease");
}

/** @param {string} repositoryId @param {string} name */
async function holdProbeLease(repositoryId, name) {
  assert.equal(process.platform, "win32");
  assert.ok(process.env.APPDATA);
  assert.match(repositoryId, /^[A-Za-z0-9_-]{1,100}$/);
  const expected = resolve(
    process.env.APPDATA,
    probeIdentifier,
    "git-v1",
    "repo-" + repositoryId,
    ".git",
    name,
  );
  const path = await realpath(expected);
  assert.equal(path.toLowerCase(), expected.toLowerCase());
  const library = dlopen("kernel32.dll", {
    CreateFileW: {
      args: ["buffer", "u32", "u32", "ptr", "u32", "u32", "u64"],
      returns: "u64",
    },
    LockFileEx: {
      args: ["u64", "u32", "u32", "u32", "u32", "ptr"],
      returns: "i32",
    },
    CloseHandle: { args: ["u64"], returns: "i32" },
    GetLastError: { args: [], returns: "u32" },
  });
  const handle = library.symbols.CreateFileW(
    Buffer.from(path + "\0", "utf16le"),
    0xc0000000,
    7,
    null,
    3,
    128,
    0n,
  );
  if (handle === 0xffffffffffffffffn) {
    const error = library.symbols.GetLastError();
    library.close();
    throw new Error("Cannot open owned lease: " + error);
  }
  const overlapped = new Uint8Array(32);
  if (
    !library.symbols.LockFileEx(
      handle,
      3,
      0,
      0xffffffff,
      0xffffffff,
      ptr(overlapped),
    )
  ) {
    const error = library.symbols.GetLastError();
    library.symbols.CloseHandle(handle);
    library.close();
    throw new Error("Cannot hold owned lease: " + error);
  }
  let released = false;
  return {
    path,
    release() {
      if (released) return;
      released = true;
      try {
        assert.equal(library.symbols.CloseHandle(handle), 1);
      } finally {
        library.close();
      }
    },
  };
}
