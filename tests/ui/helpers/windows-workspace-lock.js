import assert from "node:assert/strict";
import { dlopen } from "bun:ffi";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { probeIdentifier } from "./native-app.js";

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
  const library = dlopen("kernel32.dll", {
    CreateFileW: {
      args: ["buffer", "u32", "u32", "ptr", "u32", "u32", "u64"],
      returns: "u64",
    },
    CloseHandle: { args: ["u64"], returns: "i32" },
    GetLastError: { args: [], returns: "u32" },
  });
  const filename = Buffer.from(path + "\0", "utf16le");
  // GENERIC_READ, FILE_SHARE_READ|WRITE, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL.
  const handle = library.symbols.CreateFileW(
    filename,
    0x80000000,
    3,
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
          "Close owned workspace handle",
        );
      } finally {
        library.close();
      }
    },
  };
}
