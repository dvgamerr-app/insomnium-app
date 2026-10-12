import assert from "node:assert/strict";
import { dlopen, ptr } from "bun:ffi";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";

/** Observe only the real fixed sidecar of an owned native host, retaining object
 * handles before retirement. Never spawn/terminate processes or select by PID alone.
 * @param {{appPid:number,sidecar:string,sidecarSha256:string}} options */
export async function watchSpectralNativeProducer({
  appPid,
  sidecar,
  sidecarSha256,
}) {
  assert.equal(process.platform, "win32");
  assert.ok(["x64", "arm64"].includes(process.arch));
  assert.ok(Number.isInteger(appPid) && appPid > 0);
  const expected = resolve(sidecar);
  assert.equal(basename(expected), "spectral-linter.exe");
  assert.ok(
    expected
      .toLowerCase()
      .startsWith((resolve("artifacts") + "\\").toLowerCase()),
  );
  assert.match(sidecarSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    createHash("sha256")
      .update(await Bun.file(expected).bytes())
      .digest("hex"),
    sidecarSha256,
  );
  const kernel = dlopen("kernel32.dll", {
    CreateToolhelp32Snapshot: { args: ["u32", "u32"], returns: "u64" },
    Process32FirstW: { args: ["u64", "ptr"], returns: "i32" },
    Process32NextW: { args: ["u64", "ptr"], returns: "i32" },
    OpenProcess: { args: ["u32", "i32", "u32"], returns: "u64" },
    QueryFullProcessImageNameW: {
      args: ["u64", "u32", "ptr", "ptr"],
      returns: "i32",
    },
    GetProcessTimes: {
      args: ["u64", "ptr", "ptr", "ptr", "ptr"],
      returns: "i32",
    },
    GetExitCodeProcess: { args: ["u64", "ptr"], returns: "i32" },
    WaitForSingleObject: { args: ["u64", "u32"], returns: "u32" },
    CloseHandle: { args: ["u64"], returns: "i32" },
  });
  const api = kernel.symbols,
    started = Date.now();
  /** @type {{handle:bigint,pid:number,created:string,createdMs:number,path:string,observed:number}[]} */ const owned =
    [];
  let stopped = false,
    error = /** @type {unknown} */ (null);
  const scan = () => {
    const snapshot = api.CreateToolhelp32Snapshot(2, 0);
    assert.notEqual(snapshot, 0xffffffffffffffffn);
    try {
      const entry = new Uint8Array(568),
        view = new DataView(entry.buffer);
      view.setUint32(0, 568, true);
      let valid = api.Process32FirstW(snapshot, ptr(entry));
      while (valid) {
        const pid = view.getUint32(8, true),
          parent = view.getUint32(32, true);
        if (parent === appPid && !owned.some((row) => row.pid === pid)) {
          const handle = api.OpenProcess(0x100000 | 0x1000, 0, pid);
          if (handle !== 0n) {
            let retained = false;
            try {
              const text = new Uint16Array(32768),
                length = new Uint32Array([text.length]);
              if (
                api.QueryFullProcessImageNameW(
                  handle,
                  0,
                  ptr(text),
                  ptr(length),
                )
              ) {
                const path = String.fromCharCode(
                  ...text.subarray(0, length[0]),
                );
                if (resolve(path).toLowerCase() === expected.toLowerCase()) {
                  const created = new Uint32Array(2),
                    exited = new Uint32Array(2),
                    system = new Uint32Array(2),
                    user = new Uint32Array(2);
                  assert.notEqual(
                    api.GetProcessTimes(
                      handle,
                      ptr(created),
                      ptr(exited),
                      ptr(system),
                      ptr(user),
                    ),
                    0,
                  );
                  const identity =
                      (BigInt(created[1]) << 32n) | BigInt(created[0]),
                    createdMs = Number(identity / 10000n) - 11644473600000;
                  if (createdMs >= started) {
                    owned.push({
                      handle,
                      pid,
                      created: String(identity),
                      createdMs,
                      path,
                      observed: Date.now(),
                    });
                    retained = true;
                  }
                }
              }
            } finally {
              if (!retained) api.CloseHandle(handle);
            }
          }
        }
        valid = api.Process32NextW(snapshot, ptr(entry));
      }
    } finally {
      api.CloseHandle(snapshot);
    }
  };
  scan();
  const timer = setInterval(() => {
    if (!stopped)
      try {
        scan();
      } catch (cause) {
        error = cause;
      }
  }, 5);
  return {
    /** Authenticate the exact retained live object before an owned fixture mutation. */
    async alive() {
      if (error) throw error;
      assert.equal(stopped, false);
      assert.equal(owned.length, 1);
      const row = owned[0];
      assert.equal(
        api.WaitForSingleObject(row.handle, 0),
        258,
        "Retained producer must still be running",
      );
      return {
        pid: row.pid,
        started: row.createdMs,
        aliveRetainedObject: true,
        processIdentity: {
          path: row.path,
          created: row.created,
          sidecarSha256,
        },
      };
    },
    /** Process observation is NOT evidence that a custom function entered.
     * @returns {Promise<{pid:number,observed:number}|null>} */ async observed() {
      if (error) throw error;
      return owned[0]
        ? { pid: owned[0].pid, observed: owned[0].observed }
        : null;
    },
    /** After the real native RUN response/error, assert this exact process object retired. */ async settle() {
      stopped = true;
      clearInterval(timer);
      if (error) throw error;
      assert.equal(
        owned.length,
        1,
        "Exactly one actual sidecar must be observed before result; missed observations fail",
      );
      const row = owned[0];
      const signaled = api.WaitForSingleObject(row.handle, 0);
      assert.equal(
        signaled,
        0,
        "Actual native settlement must already signal the retained producer object",
      );
      const code = new Uint32Array(1);
      assert.notEqual(api.GetExitCodeProcess(row.handle, ptr(code)), 0);
      return {
        pid: row.pid,
        started: row.createdMs,
        observed: row.observed,
        exited: Date.now(),
        exit: { code: code[0] },
        processIdentity: {
          path: row.path,
          created: row.created,
          sidecarSha256,
        },
        observedProcessObject: true,
      };
    },
    close() {
      stopped = true;
      clearInterval(timer);
      for (const row of owned) api.CloseHandle(row.handle);
      owned.length = 0;
      kernel.close();
    },
  };
}
