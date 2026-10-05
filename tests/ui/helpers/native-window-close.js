import assert from "node:assert/strict";
import { dlopen, ptr } from "bun:ffi";

/** Request the normal Windows close event for exactly one visible window of
 * the owned probe PID. Never broadcast, force-destroy, or select by title.
 * HWND is an integer handle, not a Bun FFI pointer.
 * @param {number} pid */
export function requestOwnedWindowClose(pid) {
  assert.equal(process.platform, "win32");
  assert.equal(process.arch, "x64");
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const library = dlopen("user32.dll", {
    GetTopWindow: { args: ["u64"], returns: "u64" },
    GetWindow: { args: ["u64", "u32"], returns: "u64" },
    GetWindowThreadProcessId: { args: ["u64", "ptr"], returns: "u32" },
    IsWindowVisible: { args: ["u64"], returns: "i32" },
    GetClassNameW: { args: ["u64", "ptr", "i32"], returns: "i32" },
    GetWindowLongPtrW: { args: ["u64", "i32"], returns: "i64" },
    PostMessageW: { args: ["u64", "u32", "u64", "i64"], returns: "i32" },
  });
  try {
    const api = library.symbols;
    const owner = new Uint32Array(1);
    let found = [];
    const visited = new Set();
    let window = api.GetTopWindow(0n);
    while (window !== 0n) {
      assert.ok(
        visited.size < 10000 && !visited.has(window),
        "Window enumeration must terminate",
      );
      visited.add(window);
      owner[0] = 0;
      const thread = api.GetWindowThreadProcessId(window, ptr(owner));
      if (
        thread &&
        owner[0] === pid &&
        api.IsWindowVisible(window) &&
        api.GetWindow(window, 4) === 0n
      )
        found.push(window);
      window = api.GetWindow(window, 2);
    }
    const candidates = found.map((handle) => {
      const buffer = new Uint16Array(256);
      const length = api.GetClassNameW(handle, ptr(buffer), buffer.length);
      return {
        handle: String(handle),
        className: String.fromCharCode(...buffer.subarray(0, length)),
        style: String(api.GetWindowLongPtrW(handle, -16)),
      };
    });
    found = candidates
      .filter((candidate) => candidate.className === "Tauri Window")
      .map((candidate) => BigInt(candidate.handle));
    assert.equal(
      found.length,
      1,
      "Expected one visible top-level window for owned probe PID: " +
        JSON.stringify(candidates),
    );
    owner[0] = 0;
    assert.ok(api.GetWindowThreadProcessId(found[0], ptr(owner)));
    assert.equal(owner[0], pid, "Recheck owner immediately before close");
    assert.notEqual(
      api.PostMessageW(found[0], 0x0010, 0n, 0n),
      0,
      "WM_CLOSE must be posted",
    );
    return { pid, window: String(found[0]), message: "WM_CLOSE" };
  } finally {
    library.close();
  }
}
