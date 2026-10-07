import assert from "node:assert/strict";
import { dlopen, ptr, JSCallback } from "bun:ffi";
import { resolve, sep } from "node:path";

/** Control only the owned probe's Windows file dialog. Never type into the
 * foreground window or use titles/global keyboard input. Save paths must be new
 * JSON artifacts inside this scenario's output; no overwrite prompt is allowed.
 * @param {number} pid @param {string} output @param {string|null} path */
export async function respondToOwnedSaveDialog(pid, output, path) {
  assert.equal(process.platform, "win32");
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  if (path) {
    assert.ok(resolve(path).startsWith(resolve(output) + sep));
    assert.ok(path.endsWith(".json"));
    assert.equal(await Bun.file(path).exists(), false, "Refuse overwrite");
  }
  const library = dlopen("user32.dll", {
    EnumWindows: { args: ["ptr", "i64"], returns: "i32" },
    GetWindow: { args: ["u64", "u32"], returns: "u64" },
    GetParent: { args: ["u64"], returns: "u64" },
    GetWindowThreadProcessId: { args: ["u64", "ptr"], returns: "u32" },
    IsWindowVisible: { args: ["u64"], returns: "i32" },
    GetClassNameW: { args: ["u64", "ptr", "i32"], returns: "i32" },
    GetDlgCtrlID: { args: ["u64"], returns: "i32" },
    SendMessageTimeoutW: {
      args: ["u64", "u32", "u64", "i64", "u32", "u32", "ptr"],
      returns: "i64",
    },
    PostMessageW: { args: ["u64", "u32", "u64", "i64"], returns: "i32" },
  });
  try {
    const api = library.symbols;
    const owner = new Uint32Array(1);
    const className = (/** @type {bigint} */ handle) => {
      const buffer = new Uint16Array(256);
      const length = api.GetClassNameW(handle, ptr(buffer), buffer.length);
      return String.fromCharCode(...buffer.subarray(0, length));
    };
    const owned = (/** @type {bigint} */ handle) => {
      owner[0] = 0;
      return (
        !!api.GetWindowThreadProcessId(handle, ptr(owner)) && owner[0] === pid
      );
    };
    let dialog = 0n;
    const deadline = Date.now() + 15000;
    while (!dialog && Date.now() < deadline) {
      const candidates = [];
      // GetWindow traversal can repeat handles when the dialog changes Z-order.
      // Collect a bounded native enumeration, then inspect only owned windows.
      const handles = /** @type {bigint[]} */ ([]);
      const enumerate = new JSCallback(
        (handle) => {
          handles.push(handle);
          return handles.length < 10000 ? 1 : 0;
        },
        { args: ["u64", "i64"], returns: "i32" },
      );
      let complete;
      try {
        complete = api.EnumWindows(enumerate.ptr, 0n);
      } finally {
        enumerate.close();
      }
      assert.ok(
        complete && handles.length < 10000,
        "Window enumeration failed",
      );
      for (const handle of handles) {
        if (
          owned(handle) &&
          api.IsWindowVisible(handle) &&
          className(handle) === "#32770"
        )
          candidates.push(handle);
      }
      assert.ok(candidates.length <= 1, "Ambiguous owned dialog");
      dialog = candidates[0] || 0n;
      if (!dialog) await Bun.sleep(100);
    }
    assert.notEqual(dialog, 0n, "Owned save dialog did not appear");
    const parent = api.GetWindow(dialog, 4);
    assert.ok(
      parent && owned(parent) && className(parent) === "Tauri Window",
      "Dialog must belong directly to owned Tauri window",
    );
    if (!path) {
      assert.ok(owned(dialog));
      assert.notEqual(api.PostMessageW(dialog, 0x0111, 2n, 0n), 0);
      return { pid, dialog: String(dialog), action: "cancel" };
    }
    /** @type {{handle:bigint,className:string,id:number,parentId:number}[]} */
    const controls = [];
    const visit = (/** @type {bigint} */ container, depth = 0) => {
      assert.ok(depth < 32 && controls.length < 1000);
      for (
        let child = api.GetWindow(container, 5);
        child !== 0n;
        child = api.GetWindow(child, 2)
      ) {
        assert.ok(owned(child));
        controls.push({
          handle: child,
          className: className(child),
          id: api.GetDlgCtrlID(child),
          parentId: api.GetDlgCtrlID(api.GetParent(child)),
        });
        visit(child, depth + 1);
      }
    };
    visit(dialog);
    const edits = controls.filter(
      (control) =>
        control.className === "Edit" &&
        (control.parentId === 1148 || control.id === 1001),
    );
    assert.equal(
      edits.length,
      1,
      "Expected filename edit: " +
        JSON.stringify(controls, (_, value) =>
          typeof value === "bigint" ? String(value) : value,
        ),
    );
    const buttons = controls.filter(
      (control) => control.className === "Button" && control.id === 1,
    );
    assert.equal(buttons.length, 1, "Expected one Save button");
    const text = Buffer.from(resolve(path) + "\0", "utf16le");
    const result = new BigUint64Array(1);
    assert.ok(owned(edits[0].handle) && owned(buttons[0].handle));
    assert.notEqual(
      api.SendMessageTimeoutW(
        edits[0].handle,
        0x000c,
        0n,
        BigInt(ptr(text)),
        2,
        5000,
        ptr(result),
      ),
      0n,
      "Filename WM_SETTEXT timed out",
    );
    assert.notEqual(
      api.PostMessageW(buttons[0].handle, 0x00f5, 0n, 0n),
      0,
      "Save BM_CLICK failed",
    );
    return { pid, dialog: String(dialog), action: "save", path: resolve(path) };
  } finally {
    library.close();
  }
}
