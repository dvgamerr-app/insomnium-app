import assert from "node:assert/strict";
import { dlopen, ptr } from "bun:ffi";
import { lstat, realpath } from "node:fs/promises";
import { resolve, sep, basename } from "node:path";

/** Select/cancel only an exact PID-owned chooser using closed existing fixture
 * paths. No foreground typing, activation, title selection or overwrite.
 * Known control IDs follow the SAME saved Windows Save helper; this is bounded
 * chooser acceptance, not a universal modern/legacy-dialog identity claim.
 * @param {number} pid @param {string} output @param {string|null} path
 * @param {'file'|'folder'} kind */
export async function respondToOwnedOpenDialog(pid, output, path, kind) {
  assert.equal(process.platform, "win32");
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  assert.ok(["file", "folder"].includes(kind));
  const root = resolve(output),
    selected = path === null ? null : resolve(path);
  const verifyPath = async () => {
    if (selected === null) return;
    assert.ok(
      selected.startsWith(root + sep),
      "Only this scenario's existing fixtures",
    );
    let current = selected;
    for (;;) {
      const info = await lstat(current);
      assert.equal(info.isSymbolicLink(), false);
      assert.equal(
        (await realpath(current)).toLowerCase(),
        current.toLowerCase(),
      );
      if (current === selected)
        assert.equal(
          kind === "folder" ? info.isDirectory() : info.isFile(),
          true,
        );
      else assert.equal(info.isDirectory(), true);
      if (current === root) break;
      const parent = resolve(current, "..");
      assert.ok(parent === root || parent.startsWith(root + sep));
      current = parent;
    }
    if (kind === "file")
      assert.ok(selected.endsWith(".db"), "Only owned legacy database input");
  };
  await verifyPath();
  const library = dlopen("user32.dll", {
    GetTopWindow: { args: ["u64"], returns: "u64" },
    GetWindow: { args: ["u64", "u32"], returns: "u64" },
    GetParent: { args: ["u64"], returns: "u64" },
    IsChild: { args: ["u64", "u64"], returns: "i32" },
    GetWindowThreadProcessId: { args: ["u64", "ptr"], returns: "u32" },
    GetClassNameW: { args: ["u64", "ptr", "i32"], returns: "i32" },
    GetDlgCtrlID: { args: ["u64"], returns: "i32" },
    IsWindowVisible: { args: ["u64"], returns: "i32" },
    IsWindowEnabled: { args: ["u64"], returns: "i32" },
    SendMessageTimeoutW: {
      args: ["u64", "u32", "u64", "i64", "u32", "u32", "ptr"],
      returns: "i64",
    },
    PostMessageW: { args: ["u64", "u32", "u64", "i64"], returns: "i32" },
  });
  let failureDialog = 0n,
    failureMain = 0n;
  try {
    const api = library.symbols,
      owner = new Uint32Array(1),
      returned = new BigUint64Array(1);
    const owned = (/** @type {bigint} */ hwnd) => {
      owner[0] = 0;
      assert.ok(api.GetWindowThreadProcessId(hwnd, ptr(owner)));
      assert.equal(owner[0], pid);
    };
    const cls = (/** @type {bigint} */ hwnd) => {
      const bytes = new Uint16Array(256);
      const count = api.GetClassNameW(hwnd, ptr(bytes), bytes.length);
      assert.ok(count > 0 && count < bytes.length);
      return String.fromCharCode(...bytes.subarray(0, count));
    };
    let chooser = 0n,
      main = 0n;
    const deadline = Date.now() + 15000;
    while (!chooser && Date.now() < deadline) {
      const found = /** @type {bigint[]} */ ([]),
        visited = new Set();
      for (
        let hwnd = api.GetTopWindow(0n);
        hwnd !== 0n;
        hwnd = api.GetWindow(hwnd, 2)
      ) {
        assert.ok(visited.size < 10000 && !visited.has(hwnd));
        visited.add(hwnd);
        owner[0] = 0;
        const thread = api.GetWindowThreadProcessId(hwnd, ptr(owner));
        if (
          thread &&
          owner[0] === pid &&
          api.IsWindowVisible(hwnd) &&
          cls(hwnd) === "#32770"
        ) {
          const parent = api.GetWindow(hwnd, 4);
          if (parent && cls(parent) === "Tauri Window") {
            owned(parent);
            found.push(hwnd);
          }
        }
      }
      assert.ok(found.length <= 1, "Ambiguous owned chooser");
      chooser = found[0] ?? 0n;
      if (!chooser) await Bun.sleep(50);
    }
    assert.notEqual(chooser, 0n, "Owned chooser must appear");
    main = api.GetWindow(chooser, 4);
    failureDialog = chooser;
    failureMain = main;
    const authenticate = () => {
      owned(main);
      owned(chooser);
      assert.equal(cls(main), "Tauri Window");
      assert.equal(cls(chooser), "#32770");
      assert.equal(api.GetWindow(chooser, 4), main);
    };
    const hideMain = () => {
      authenticate();
      // native-app hides this host before CDP. Hiding it again can also hide
      // its owned modal while the common dialog is being initialized.
      assert.equal(api.IsWindowVisible(main), 0);
      assert.notEqual(
        api.IsWindowVisible(chooser),
        0,
        "Owned native chooser remains visible",
      );
    };
    hideMain();
    if (selected === null) {
      authenticate();
      assert.notEqual(api.PostMessageW(chooser, 0x0111, 2n, 0n), 0);
      return {
        pid,
        dialog: String(chooser),
        main: String(main),
        kind,
        action: "cancel",
        mainHidden: true,
        dialogHidden: false,
      };
    }
    let edit = 0n,
      button = 0n,
      combo = 0n,
      comboEx = 0n;
    const folderParents = /** @type {{hwnd:bigint,cls:string,id:number,parent:bigint}[]} */ ([]);
    const readinessDeadline = Date.now() + 5000;
    let lastControls = "";
    // Bounded read-only readiness observations before ONE action submission.
    while (!edit && Date.now() < readinessDeadline) {
      authenticate();
      const rows =
          /** @type {{hwnd:bigint,cls:string,id:number,parent:bigint}[]} */ ([]),
        seen = new Set();
      const visit = (/** @type {bigint} */ parent, depth = 0) => {
        assert.ok(depth <= 32);
        for (
          let child = api.GetWindow(parent, 5);
          child !== 0n;
          child = api.GetWindow(child, 2)
        ) {
          assert.ok(rows.length < 1000 && !seen.has(child));
          seen.add(child);
          owned(child);
          assert.ok(api.IsChild(chooser, child));
          rows.push({
            hwnd: child,
            cls: cls(child),
            id: api.GetDlgCtrlID(child),
            parent: api.GetParent(child),
          });
          visit(child, depth + 1);
        }
      };
      visit(chooser);
      lastControls = JSON.stringify(
        rows.map((row) => ({
          cls: row.cls,
          id: row.id,
          parentId: api.GetDlgCtrlID(row.parent),
          enabled: !!api.IsWindowEnabled(row.hwnd),
        })),
      );
      const edits = rows.filter((row) => {
        if (kind === "folder")
          return row.cls === "Edit" && row.id === 1152 &&
            api.GetDlgCtrlID(row.parent) === 0 && api.IsWindowEnabled(row.hwnd);
        const p = rows.find((r) => r.hwnd === row.parent),
          g = rows.find((r) => r.hwnd === p?.parent);
        return (
          row.cls === "Edit" &&
          row.id === 1148 &&
          p?.cls === "ComboBox" &&
          p.id === 1148 &&
          g?.cls === "ComboBoxEx32" &&
          g.id === 1148
        );
      });
      const buttons = rows.filter(
        (row) =>
          row.cls === "Button" &&
          row.id === 1 &&
          (kind === "folder" || api.IsWindowEnabled(row.hwnd)),
      );
      assert.ok(edits.length <= 1 && buttons.length <= 1);
      if (edits.length === 1 && buttons.length === 1) {
        edit = edits[0].hwnd;
        button = buttons[0].hwnd;
        if (kind === "file") {
          combo = edits[0].parent;
          comboEx = api.GetParent(combo);
        } else {
          let parent = edits[0].parent;
          const parentsSeen = new Set();
          while (parent !== chooser) {
            assert.ok(parent && folderParents.length < 32 && !parentsSeen.has(parent));
            parentsSeen.add(parent);
            owned(parent);
            assert.ok(api.IsChild(chooser, parent));
            folderParents.push({hwnd: parent, cls: cls(parent),
              id: api.GetDlgCtrlID(parent), parent: api.GetParent(parent)});
            parent = api.GetParent(parent);
          }
          // Also pin a direct-dialog parent; its ID is part of the observed mode.
          assert.equal(api.GetDlgCtrlID(edits[0].parent), 0);
        }
      } else await Bun.sleep(25);
    }
    assert.notEqual(
      edit,
      0n,
      "Exactly one mode-specific filename/folder Edit and IDOK: " +
        lastControls,
    );
    const verifyControls = (requireButtonEnabled = true) => {
      authenticate();
      assert.equal(api.IsWindowVisible(main), 0, "Owned host remains hidden");
      assert.notEqual(
        api.IsWindowVisible(chooser),
        0,
        "Owned native chooser remains visible",
      );
      for (const hwnd of (kind === "file" ? [edit, button, combo, comboEx] : [edit, button])) {
        owned(hwnd);
        assert.ok(api.IsChild(chooser, hwnd));
      }
      assert.equal(cls(edit), "Edit");
      if (kind === "file") {
        assert.equal(cls(combo), "ComboBox");
        assert.equal(cls(comboEx), "ComboBoxEx32");
        for (const hwnd of [edit, combo, comboEx])
          assert.equal(api.GetDlgCtrlID(hwnd), 1148);
        assert.equal(api.GetParent(edit), combo);
        assert.equal(api.GetParent(combo), comboEx);
      } else {
        assert.equal(api.GetDlgCtrlID(edit), 1152);
        assert.equal(api.GetParent(edit), folderParents[0]?.hwnd ?? chooser);
        assert.equal(api.GetDlgCtrlID(api.GetParent(edit)), 0);
        for (const row of folderParents) {
          owned(row.hwnd);
          assert.ok(api.IsChild(chooser, row.hwnd));
          assert.equal(cls(row.hwnd), row.cls);
          assert.equal(api.GetDlgCtrlID(row.hwnd), row.id);
          assert.equal(api.GetParent(row.hwnd), row.parent);
        }
      }
      assert.ok(api.IsWindowEnabled(edit));
      assert.equal(cls(button), "Button");
      assert.equal(api.GetDlgCtrlID(button), 1);
      if (requireButtonEnabled) assert.ok(api.IsWindowEnabled(button));
    };
    const text = (/** @type {bigint} */ hwnd) => {
      const buffer = new Uint16Array(4097);
      assert.notEqual(
        api.SendMessageTimeoutW(
          hwnd,
          0x000d,
          BigInt(buffer.length),
          BigInt(ptr(buffer)),
          2,
          1000,
          ptr(returned),
        ),
        0n,
      );
      assert.ok(returned[0] < 4096n);
      return String.fromCharCode(...buffer.subarray(0, Number(returned[0])));
    };
    await verifyPath();
    hideMain();
    verifyControls(kind !== "folder");
    const label = text(button).replaceAll("&", "").trim().toLowerCase();
    assert.equal(label, kind === "folder" ? "select folder" : "open");
    const before = text(edit);
    assert.ok(
      ["", selected, basename(selected)].includes(before),
      "Refuse unknown prior chooser value",
    );
    assert.match(
      selected,
      /^[\x20-\x7e]{1,1024}$/,
      "Only bounded ASCII fixture paths",
    );
    const inputStarted = Date.now(),
      inputDeadline = inputStarted + 5000;
    /** @param {number} message @param {bigint} wParam @param {bigint} lParam */
    const sendEdit = (message, wParam, lParam) => {
      // IDOK may change enabled state while the path is partially typed. No
      // button action occurs here; its strict enabled guard is retained below.
      verifyControls(false);
      assert.ok(
        Date.now() < inputDeadline,
        "Owned edit input aggregate deadline",
      );
      assert.notEqual(
        api.SendMessageTimeoutW(
          edit,
          message,
          wParam,
          lParam,
          2,
          Math.max(1, Math.min(1000, inputDeadline - Date.now())),
          ptr(returned),
        ),
        0n,
        "Owned edit message timed out",
      );
      verifyControls(false);
    };
    if (before !== "") {
      sendEdit(0x00b1, 0n, -1n); // EM_SETSEL selects only this Edit's text.
      sendEdit(0x0102, 8n, 1n); // WM_CHAR backspace removes the selection.
      assert.equal(text(edit), "", "Owned previous path was fully removed");
    }
    for (let index = 0; index < selected.length; index++)
      sendEdit(0x0102, BigInt(selected.charCodeAt(index)), 1n);
    assert.equal(text(edit), selected, "Exact full path after owned WM_CHAR");
    await verifyPath();
    hideMain();
    verifyControls();
    assert.equal(text(edit), selected);
    assert.equal(text(button).replaceAll("&", "").trim().toLowerCase(), label);
    assert.notEqual(
      api.PostMessageW(button, 0x00f5, 0n, 0n),
      0,
      "ONE owned IDOK BM_CLICK",
    );
    return {
      pid,
      dialog: String(chooser),
      main: String(main),
      kind,
      action: "open",
      path: selected,
      mainHidden: true,
      dialogHidden: false,
      controlChain: kind === "file" ? "ComboBoxEx32/ComboBox/Edit1148" : "OwnedParent0/Edit1152",
      folderParentChain: kind === "folder" ? folderParents.map(row => ({
        hwnd: String(row.hwnd), cls: row.cls, id: row.id, parent: String(row.parent),
      })) : undefined,
      readback: true,
      submissions: 1,
      input: {
        method: "owned-edit-WM_CHAR",
        asciiCodeUnits: selected.length,
        clearedPriorSelection: before !== "",
        elapsedMs: Date.now() - inputStarted,
        deadlineMs: 5000,
        explicitComboNotifications: false,
      },
    };
  } catch (error) {
    // A refused control must not leave a modal chooser blocking host cleanup.
    // Cancel only the same still-authenticated owned dialog, never retry selection.
    if (failureDialog) {
      const api = library.symbols,
        pidBuffer = new Uint32Array(1),
        name = new Uint16Array(256);
      const thread = api.GetWindowThreadProcessId(
        failureDialog,
        ptr(pidBuffer),
      );
      if (
        thread &&
        pidBuffer[0] === pid &&
        api.GetWindow(failureDialog, 4) === failureMain
      ) {
        const count = api.GetClassNameW(failureDialog, ptr(name), name.length);
        if (String.fromCharCode(...name.subarray(0, count)) === "#32770")
          api.PostMessageW(failureDialog, 0x0010, 0n, 0n);
      }
    }
    throw error;
  } finally {
    library.close();
  }
}
