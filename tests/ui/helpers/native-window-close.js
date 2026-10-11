import assert from "node:assert/strict";
import { dlopen, ptr } from "bun:ffi";
import { basename, resolve, sep } from "node:path";

/** Request the normal Windows close event for exactly one Tauri window of
 * the owned probe PID, including a hidden test window. Never broadcast,
 * force-destroy, or select by title.
 * HWND is an integer handle, not a Bun FFI pointer.
 * @param {number} pid */
export function requestOwnedWindowClose(pid) {
  return ownedWindowOperation(pid, (api, window) => {
    assert.notEqual(api.PostMessageW(window, 0x0010, 0n, 0n), 0, "WM_CLOSE must be posted");
    return { pid, window: String(window), message: "WM_CLOSE" };
  });
}

/** Hide only the owned native probe; return null until its window exists.
 * Headless Chromium launch does not control a native WebView2 host window.
 * @param {number} pid */
export function hideOwnedWindow(pid) {
  return ownedWindowOperation(pid, (api, window) => {
    api.ShowWindow(window, 0); // SW_HIDE; return value is previous visibility.
    assert.equal(api.IsWindowVisible(window), 0, "Owned probe must be hidden");
    return { pid, window: String(window), visible: false };
  }, true);
}

/** Inspect/hide only native dialogs directly owned by this probe's main HWND.
 * No title selection or foreign process/window operation.
 * @param {number} pid @param {boolean} [hide] */
export function inspectOwnedDialogs(pid, hide = false) {
  const inspected = ownedWindowOperation(pid, (api, parent) => {
    const rows = /** @type {{pid:number,window:string,visible:boolean}[]} */ ([]);
    const owner = new Uint32Array(1);
    const visited = new Set();
    let handle = api.GetTopWindow(0n);
    while (handle !== 0n) {
      assert.ok(visited.size < 10000 && !visited.has(handle)); visited.add(handle);
      owner[0] = 0;
      const thread = api.GetWindowThreadProcessId(handle, ptr(owner));
      if (thread && owner[0] === pid && api.GetWindow(handle, 4) === parent) {
        const buffer = new Uint16Array(256);
        const length = api.GetClassNameW(handle, ptr(buffer), buffer.length);
        if (String.fromCharCode(...buffer.subarray(0, length)) === "#32770") {
          owner[0] = 0;
          assert.ok(api.GetWindowThreadProcessId(handle, ptr(owner)));
          assert.equal(owner[0], pid); assert.equal(api.GetWindow(handle, 4), parent);
          if (hide) api.ShowWindow(handle, 0);
          const visible = api.IsWindowVisible(handle) !== 0;
          if (hide) assert.equal(visible, false);
          rows.push({ pid, window: String(handle), visible });
        }
      }
      handle = api.GetWindow(handle, 2);
    }
    return rows;
  });
  assert.ok(inspected);
  return inspected;
}

/** User-close control for one rechecked native dialog of the owned probe.
 * @param {number} pid @param {string} handle */
export function requestOwnedDialogClose(pid, handle) {
  assert.match(handle, /^[0-9]+$/);
  assert.ok(inspectOwnedDialogs(pid).some(row => row.window === handle));
  return ownedWindowOperation(pid, (api, parent) => {
    const window = BigInt(handle), owner = new Uint32Array(1), buffer = new Uint16Array(256);
    assert.ok(api.GetWindowThreadProcessId(window, ptr(owner)));
    assert.equal(owner[0], pid); assert.equal(api.GetWindow(window, 4), parent);
    const length = api.GetClassNameW(window, ptr(buffer), buffer.length);
    assert.equal(String.fromCharCode(...buffer.subarray(0, length)), "#32770");
    assert.notEqual(api.PostMessageW(window, 0x0010, 0n, 0n), 0);
    return { pid, window: handle, message: "WM_CLOSE" };
  });
}

/** Inspect/hide confirmation windows directly owned by this exact probe chooser.
 * @param {number} pid @param {string} chooser */
export function inspectOwnedOverwrite(pid, chooser) {
  assert.ok(inspectOwnedDialogs(pid).some(row => row.window === chooser));
  const inspected = ownedWindowOperation(pid, (api, parent) => {
    const source = BigInt(chooser), owner = new Uint32Array(1);
    assert.equal(api.GetWindow(source, 4), parent);
    const rows = /** @type {{window:string,visible:boolean}[]} */ ([]), visited = new Set();
    let window = api.GetTopWindow(0n);
    while (window !== 0n) {
      assert.ok(visited.size < 10000 && !visited.has(window)); visited.add(window);
      owner[0] = 0;
      if (api.GetWindowThreadProcessId(window, ptr(owner)) && owner[0] === pid && api.GetWindow(window, 4) === source) {
        const buffer = new Uint16Array(256), length = api.GetClassNameW(window, ptr(buffer), buffer.length);
        if (String.fromCharCode(...buffer.subarray(0, length)) === "#32770") {
          owner[0] = 0; assert.ok(api.GetWindowThreadProcessId(window, ptr(owner)));
          assert.equal(owner[0], pid); assert.equal(api.GetWindow(window, 4), source);
          api.ShowWindow(window, 0); assert.equal(api.IsWindowVisible(window), 0);
          rows.push({ window: String(window), visible: false });
        }
      }
      window = api.GetWindow(window, 2);
    }
    return rows;
  });
  assert.ok(inspected); return inspected;
}

/** Click native Yes/No only within the exact owned overwrite confirmation.
 * @param {number} pid @param {string} chooser @param {string} confirmation @param {boolean} accept */
export function answerOwnedOverwrite(pid, chooser, confirmation, accept) {
  assert.ok(inspectOwnedOverwrite(pid, chooser).some(row => row.window === confirmation));
  return ownedWindowOperation(pid, (api, parent) => {
    const source = BigInt(chooser), window = BigInt(confirmation), owner = new Uint32Array(1);
    assert.equal(api.GetWindow(source, 4), parent); assert.equal(api.GetWindow(window, 4), source);
    assert.ok(api.GetWindowThreadProcessId(window, ptr(owner))); assert.equal(owner[0], pid);
    const buttons = /** @type {bigint[]} */ ([]), controls = /** @type {any[]} */ ([]), visited = new Set();
    const scan = (/** @type {bigint} */ container, depth = 0) => {
      assert.ok(depth < 32);
      let child = api.GetWindow(container, 5);
      while (child !== 0n) {
        assert.ok(visited.size < 1000 && !visited.has(child)); visited.add(child);
        owner[0] = 0; assert.ok(api.GetWindowThreadProcessId(child, ptr(owner))); assert.equal(owner[0], pid);
        assert.notEqual(api.IsChild(window, child), 0);
        const buffer = new Uint16Array(256), length = api.GetClassNameW(child, ptr(buffer), buffer.length);
        const className = String.fromCharCode(...buffer.subarray(0, length)), id = api.GetDlgCtrlID(child);
        let label = "";
        if (className === "Button") {
          const value = new Uint16Array(256), result = new BigUint64Array(1);
          assert.ok(api.SendMessageTimeoutW(child, 0x000d, BigInt(value.length), BigInt(ptr(value)), 0x23, 1000, ptr(result)));
          label = String.fromCharCode(...value.subarray(0, Number(result[0]))).replaceAll("&", "").trim().toLowerCase();
        }
        controls.push({ className, id, ...(className === "Button" ? { label } : {}) });
        if (className === "Button" && (id === (accept ? 6 : 7) || label === (accept ? "yes" : "no"))) buttons.push(child);
        scan(child, depth + 1); child = api.GetWindow(child, 2);
      }
    };
    scan(window);
    assert.equal(buttons.length, 1, "Expected native overwrite Yes/No control: " + JSON.stringify(controls));
    const button = buttons[0];
    owner[0] = 0; assert.ok(api.GetWindowThreadProcessId(button, ptr(owner))); assert.equal(owner[0], pid);
    assert.notEqual(api.IsChild(window, button), 0);
    assert.notEqual(api.PostMessageW(button, 0x00f5, 0n, 0n), 0);
    return { accept, window: confirmation, clicked: true };
  });
}

/** Select only a fixture path through the real owned save chooser controls.
 * @param {number} pid @param {string} handle @param {string} defaultName @param {string} path @param {boolean} [filenameOnly] */
export function submitOwnedSavePath(pid, handle, defaultName, path, filenameOnly = false) {
  assert.ok(resolve(path).startsWith(resolve("artifacts/playwright") + sep));
  assert.ok(inspectOwnedDialogs(pid).some(row => row.window === handle));
  return ownedWindowOperation(pid, (api, parent) => {
    const dialog = BigInt(handle), process = new Uint32Array(1);
    const verify = (/** @type {bigint} */ window) => {
      process[0] = 0;
      assert.ok(api.GetWindowThreadProcessId(window, ptr(process)));
      assert.equal(process[0], pid);
      if (window !== dialog) assert.notEqual(api.IsChild(dialog, window), 0);
      assert.equal(api.GetWindow(dialog, 4), parent);
    };
    const text = (/** @type {bigint} */ window) => {
      verify(window);
      const buffer = new Uint16Array(32769), result = new BigUint64Array(1);
      assert.ok(api.SendMessageTimeoutW(window, 0x000d, BigInt(buffer.length), BigInt(ptr(buffer)), 0x23, 1000, ptr(result)));
      return String.fromCharCode(...buffer.subarray(0, Number(result[0])));
    };
    verify(dialog);
    const found = /** @type {bigint[]} */ ([]), visited = new Set(), controls = /** @type {any[]} */ ([]);
    const scan = (/** @type {bigint} */ container, depth = 0) => {
      assert.ok(depth < 32);
      let child = api.GetWindow(container, 5);
      while (child !== 0n) {
        assert.ok(visited.size < 1000 && !visited.has(child)); visited.add(child);
        verify(child);
        const buffer = new Uint16Array(256);
        const length = api.GetClassNameW(child, ptr(buffer), buffer.length);
        const className = String.fromCharCode(...buffer.subarray(0, length));
        const value = className === "Edit" ? text(child) : undefined;
        controls.push({ className, id: api.GetDlgCtrlID(child), ...(value === undefined ? {} : { length: value.length, fixtureMatch: value === defaultName }) });
        if (value === defaultName) found.push(child);
        scan(child, depth + 1);
        child = api.GetWindow(child, 2);
      }
    };
    scan(dialog);
    assert.equal(found.length, 1, "Exactly one fixture filename edit required: " + JSON.stringify(controls));
    const input = filenameOnly ? basename(path) : path;
    const edit = found[0], value = new Uint16Array(input.length + 1), result = new BigUint64Array(1);
    for (let index = 0; index < input.length; index++) value[index] = input.charCodeAt(index);
    verify(edit);
    assert.ok(api.SendMessageTimeoutW(edit, 0x000c, 0n, BigInt(ptr(value)), 0x23, 1000, ptr(result)));
    assert.equal(result[0], 1n);
    assert.equal(text(edit), input);
    const button = api.GetDlgItem(dialog, 1);
    assert.notEqual(button, 0n); verify(button);
    assert.notEqual(api.PostMessageW(button, 0x00f5, 0n, 0n), 0, "Native Save button click posted");
    return { pid, window: handle, filenameMatched: true, saveClicked: true };
  });
}

/** @template T
 * @param {number} pid
 * @param {(api:any,window:bigint)=>T} action
 * @param {boolean} [allowMissing] */
function ownedWindowOperation(pid, action, allowMissing = false) {
  assert.equal(process.platform, "win32");
  assert.equal(process.arch, "x64");
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const library = dlopen("user32.dll", {
    GetTopWindow: { args: ["u64"], returns: "u64" },
    GetWindow: { args: ["u64", "u32"], returns: "u64" },
    GetWindowThreadProcessId: { args: ["u64", "ptr"], returns: "u32" },
    IsWindowVisible: { args: ["u64"], returns: "i32" },
    GetClassNameW: { args: ["u64", "ptr", "i32"], returns: "i32" },
    GetDlgItem: { args: ["u64", "i32"], returns: "u64" },
    GetDlgCtrlID: { args: ["u64"], returns: "i32" },
    IsChild: { args: ["u64", "u64"], returns: "i32" },
    SendMessageTimeoutW: { args: ["u64", "u32", "u64", "i64", "u32", "u32", "ptr"], returns: "i64" },
    GetWindowLongPtrW: { args: ["u64", "i32"], returns: "i64" },
    PostMessageW: { args: ["u64", "u32", "u64", "i64"], returns: "i32" },
    ShowWindow: { args: ["u64", "i32"], returns: "i32" },
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
    if (!found.length && allowMissing) return null;
    assert.equal(
      found.length,
      1,
      "Expected one Tauri top-level window for owned probe PID: " +
        JSON.stringify(candidates),
    );
    owner[0] = 0;
    assert.ok(api.GetWindowThreadProcessId(found[0], ptr(owner)));
    assert.equal(owner[0], pid, "Recheck owner immediately before window operation");
    return action(api, found[0]);
  } finally {
    library.close();
  }
}
