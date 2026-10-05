import assert from "node:assert/strict";
import { writeFile, mkdtemp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-journaled-fetch-ui-probe/build-state.json";
const full = gitPackFixture();
const shallow = gitPackFixture({ advance: true, shallow: true });
const expanded = gitPackFixture({ advance: true });
// Real Git mode leaves upload-pack bytes unchanged; only HTTP service framing is added.
const realGit = process.env.INSOMNIUM_UI_REAL_GIT === "1";
const serverRepository = realGit
  ? await mkdtemp(resolve("artifacts/git-upload-pack-ui-"))
  : "";
/** @param {string[]} args @param {string|Buffer} [input] @returns {Promise<Buffer>} */
async function git(args, input = "") {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith("GIT_")) delete env[key];
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "NUL" });
  return await new Promise((resolve, reject) => {
    const child = execFile(
      "git",
      args,
      {
        env,
        shell: false,
        windowsHide: true,
        encoding: "buffer",
        timeout: 15000,
        maxBuffer: 4194304,
      },
      (error, stdout, stderr) =>
        error
          ? reject(new Error(stderr.toString() || String(error)))
          : resolve(stdout),
    );
    child.stdin?.end(input);
  });
}
if (realGit) {
  await git([
    "init",
    "--bare",
    "--object-format=sha1",
    "--template=",
    serverRepository,
  ]);
  await git(
    ["--git-dir", serverRepository, "index-pack", "--stdin"],
    expanded.pack,
  );
  await git([
    "--git-dir",
    serverRepository,
    "update-ref",
    "refs/heads/main",
    full.oid,
  ]);
  await git([
    "--git-dir",
    serverRepository,
    "update-ref",
    "refs/heads/feature/a",
    full.oid,
  ]);
  await git([
    "--git-dir",
    serverRepository,
    "symbolic-ref",
    "HEAD",
    "refs/heads/main",
  ]);
}
const shallowPackets = /** @type {string[]} */ ([]);
let fixture = full,
  limited = false,
  requests = 0;
const bodies = /** @type {string[]} */ ([]);
const packet = (/** @type {string} */ s) =>
  (Buffer.byteLength(s) + 4).toString(16).padStart(4, "0") + s;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    requests++;
    if (request.method === "POST") {
      const body = await request.text();
      bodies.push(body);
      if (realGit) {
        const bytes = await git(
          ["upload-pack", "--stateless-rpc", serverRepository],
          body,
        );
        let offset = 0;
        while (offset + 4 <= bytes.length) {
          const header = bytes.subarray(offset, offset + 4).toString();
          if (!/^[0-9a-f]{4}$/.test(header)) break;
          const length = parseInt(header, 16);
          if (length === 0) {
            offset += 4;
            continue;
          }
          if (length < 4 || offset + length > bytes.length) break;
          const payload = bytes
            .subarray(offset + 4, offset + length)
            .toString();
          if (payload.startsWith("shallow ")) shallowPackets.push(payload);
          offset += length;
        }
        return new Response(Uint8Array.from(bytes), {
          headers: { "Content-Type": "application/x-git-upload-pack-result" },
        });
      }
      const prefix = limited ? packet("shallow " + fixture.oid) + "0000" : "";
      const bytes =
        limited && !body.includes("done")
          ? Buffer.from(prefix)
          : Buffer.concat([Buffer.from(prefix + "0008NAK\n"), fixture.pack]);
      return new Response(bytes, {
        headers: { "Content-Type": "application/x-git-upload-pack-result" },
      });
    }
    const advertisement = realGit
      ? Buffer.concat([
          Buffer.from(packet("# service=git-upload-pack\n") + "0000"),
          await git([
            "upload-pack",
            "--stateless-rpc",
            "--advertise-refs",
            serverRepository,
          ]),
        ])
      : fixture.advertisement;
    return new Response(advertisement, {
      headers: {
        "Content-Type": "application/x-git-upload-pack-advertisement",
      },
    });
  },
});
try {
  await withNativeApp(
    realGit ? "git-fetch-depth-real-git" : "git-fetch-depth",
    async ({ page, invoke, output }) => {
      const f = await gitCollection({ page, invoke });
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      const depth = panel.getByLabel("Fetch depth (optional)", { exact: true });
      const branch = panel.getByLabel("Fetch branch (optional)", {
        exact: true,
      });
      const fetchButton = panel.getByRole("button", {
        name: "Fetch remote branches",
        exact: true,
      });
      const success = panel.getByText(
        "Remote branches fetched. Your local branch is unchanged.",
        { exact: true },
      );
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill("http://127.0.0.1:" + server.port + "/repo");
      await panel
        .getByRole("button", { name: "Save remote settings", exact: true })
        .click();
      await panel
        .getByText("Remote settings saved.", { exact: true })
        .waitFor();
      await fetchButton.click();
      await success.waitFor();
      async function binding() {
        return (await invoke("load_workspace")).resources.find(
          /** @param {any} r */ (r) => r._id === f.repositoryId,
        );
      }
      let saved = await binding();
      const base = { workspaceId: f.workspaceId, repositoryId: f.repositoryId };
      const initial = await invoke("git_remote_fetch_inspect", {
        request: {
          ...base,
          requestId: crypto.randomUUID(),
          expectedBinding: saved,
        },
      });
      assert.equal(initial.snapshot.manifest.version, 3);
      assert.ok(
        initial.snapshot.manifest.histories.every(
          /** @param {any} h */ (h) =>
            h.depth === null && h.boundaries.length === 0,
        ),
      );
      await depth.fill("0");
      const beforeInvalid = requests;
      await fetchButton.click();
      await panel
        .getByRole("alert")
        .filter({ hasText: "Invalid fetch history depth" })
        .waitFor();
      assert.equal(requests, beforeInvalid);
      assert.equal((await binding()).nativeFetchIntent, undefined);
      if (realGit)
        await git([
          "--git-dir",
          serverRepository,
          "update-ref",
          "refs/heads/main",
          expanded.oid,
        ]);
      fixture = shallow;
      limited = true;
      await branch.fill("main");
      await depth.fill("1");
      const fault = await withIpcFailure(
        page,
        "git_remote_fetch",
        true,
        async () => {
          await fetchButton.click();
          await panel
            .getByRole("alert")
            .filter({ hasText: "Injected IPC failure" })
            .waitFor();
        },
      );
      assert.equal(fault.completed, 1);
      saved = await binding();
      const intent = saved.nativeFetchIntent;
      assert.equal(intent.version, 3);
      assert.equal(intent.depth, 1);
      assert.equal(intent.branch, "main");
      assert.ok(bodies.some((body) => body.includes("deepen 1")));
      if (realGit)
        assert.ok(
          shallowPackets.includes("shallow " + shallow.oid),
          "Unmodified real Git response includes exact shallow boundary",
        );
      const request = {
        ...base,
        requestId: intent.operationId,
        expectedBinding: saved,
        branch: "main",
        depth: 1,
      };
      const observed = await invoke("git_remote_fetch_inspect", { request });
      assert.equal(observed.confirmedCurrent, true);
      const manifest = observed.snapshot.manifest;
      assert.equal(manifest.requestedDepth, 1);
      assert.deepEqual(
        manifest.histories.find(/** @param {any} h */ (h) => h.name === "main"),
        { name: "main", depth: 1, boundaries: [shallow.oid] },
      );
      assert.deepEqual(
        manifest.histories.find(
          /** @param {any} h */ (h) => h.name === "feature/a",
        ),
        { name: "feature/a", depth: null, boundaries: [] },
      );
      assert.equal(
        manifest.branches.find(
          /** @param {any} b */ (b) => b.name === "feature/a",
        ).oid,
        full.oid,
      );
      const beforeInspect = requests;
      assert.equal(
        (await invoke("git_remote_fetch", { request })).reconciled,
        true,
      );
      await assert.rejects(
        invoke("git_remote_fetch", { request: { ...request, depth: 2 } }),
        /history depth/,
      );
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      assert.equal(await depth.inputValue(), "1");
      assert.equal(await depth.isDisabled(), true);
      await panel
        .getByRole("button", { name: "Inspect pending fetch", exact: true })
        .click();
      await panel
        .getByText("Previous fetch completed. Pending operation cleared.", {
          exact: true,
        })
        .waitFor();
      assert.equal(requests, beforeInspect);
      assert.equal((await binding()).nativeFetchIntent, undefined);
      fixture = expanded;
      limited = false;
      await depth.fill("");
      await fetchButton.click();
      await success.waitFor();
      saved = await binding();
      const final = await invoke("git_remote_fetch_inspect", {
        request: {
          ...base,
          requestId: crypto.randomUUID(),
          expectedBinding: saved,
          branch: "main",
        },
      });
      assert.equal(final.snapshot.manifest.requestedDepth, undefined);
      assert.ok(
        final.snapshot.manifest.histories.every(
          /** @param {any} h */ (h) =>
            h.depth === null && h.boundaries.length === 0,
        ),
      );
      assert.equal(
        (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
          .headOid,
        f.oid,
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "Public full Fetch publishes v3 full histories through journal writer",
              "Invalid depth rejected before network and intent persistence",
              "Selected shallow Fetch sends deepen 1 and preserves unselected full history",
              "Lost committed reply retains v3 branch/depth intent",
              "Same operation/depth reconciles without network; changed depth refuses",
              "Reload restores pending depth and Inspect acknowledges without download",
              "Later full Fetch expands selected history and preserves local HEAD",
            ],
            server: realGit
              ? "git upload-pack --stateless-rpc"
              : "controlled pack fixture",
            gitVersion: realGit
              ? (await git(["--version"])).toString().trim()
              : null,
            serverRepository,
            shallowPackets,
            limits:
              "Loopback HTTP acceptance; hosted-provider auth/TLS, process crashes and OS faults are separate gates.",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  server.stop(true);
}
