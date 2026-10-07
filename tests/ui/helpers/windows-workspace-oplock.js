import assert from "node:assert/strict";
import { dlopen, ptr } from "bun:ffi";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { probeIdentifier } from "./native-app.js";

/** Read/handle oplock on exactly the existing isolated probe workspace. A
 * rename break requiring acknowledgement blocks native atomic replacement.
 * No data is written, deleted or created. Always release in finally.
 */
export async function gateProbeWorkspaceReplacement() {
  assert.equal(process.platform, "win32");
  assert.equal(process.arch, "x64");
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
    CreateEventW: { args: ["ptr", "i32", "i32", "ptr"], returns: "u64" },
    DeviceIoControl: {
      args: ["u64", "u32", "ptr", "u32", "ptr", "u32", "ptr", "ptr"],
      returns: "i32",
    },
    GetOverlappedResult: { args: ["u64", "ptr", "ptr", "i32"], returns: "i32" },
    CancelIoEx: { args: ["u64", "ptr"], returns: "i32" },
    WaitForSingleObject: { args: ["u64", "u32"], returns: "u32" },
    CloseHandle: { args: ["u64"], returns: "i32" },
    GetLastError: { args: [], returns: "u32" },
  });
  const api = library.symbols;
  const handle = api.CreateFileW(
    Buffer.from(path + "\0", "utf16le"),
    0x80000000,
    7,
    null,
    3,
    0x40000080,
    0n,
  );
  if (handle === 0xffffffffffffffffn) {
    const error = api.GetLastError();
    library.close();
    throw new Error("Oplock open failed: " + error);
  }
  const event = api.CreateEventW(null, 1, 0, null);
  if (!event) {
    const error = api.GetLastError();
    api.CloseHandle(handle);
    library.close();
    throw new Error("Oplock event failed: " + error);
  }
  const input = new Uint8Array(12);
  const request = new DataView(input.buffer);
  request.setUint16(0, 1, true);
  request.setUint16(2, 12, true);
  request.setUint32(4, 3, true); // READ|HANDLE
  request.setUint32(8, 1, true); // REQUEST
  const output = new Uint8Array(24);
  const overlapped = new Uint8Array(32);
  new DataView(overlapped.buffer).setBigUint64(24, event, true);
  const transferred = new Uint32Array(1);
  const result = api.DeviceIoControl(
    handle,
    0x90240,
    ptr(input),
    input.length,
    ptr(output),
    output.length,
    ptr(transferred),
    ptr(overlapped),
  );
  const error = api.GetLastError();
  if (result || error !== 997) {
    api.CloseHandle(handle);
    api.CloseHandle(event);
    library.close();
    throw new Error(
      "Oplock must be pending (997), got " + result + "/" + error,
    );
  }
  let released = false;
  return {
    path,
    breakState() {
      assert.equal(released, false);
      const state = api.WaitForSingleObject(event, 0);
      if (state === 258) return null;
      assert.equal(state, 0, "Oplock event wait failed");
      assert.equal(
        api.GetOverlappedResult(handle, ptr(overlapped), ptr(transferred), 0),
        1,
        "Oplock break completion failed",
      );
      const info = new DataView(output.buffer);
      return {
        originalLevel: info.getUint32(4, true),
        newLevel: info.getUint32(8, true),
        flags: info.getUint32(12, true),
        acknowledgementRequired: !!(info.getUint32(12, true) & 1),
      };
    },
    release() {
      if (released) return;
      released = true;
      // Finish/cancel overlapped I/O before releasing its buffers and library.
      api.CancelIoEx(handle, ptr(overlapped));
      const completed = api.WaitForSingleObject(event, 5000);
      assert.equal(
        completed,
        0,
        "Cancelled oplock must complete before disposal",
      );
      api.CloseHandle(handle); // Closing acknowledges a pending rename break.
      api.CloseHandle(event);
      library.close();
    },
  };
}
