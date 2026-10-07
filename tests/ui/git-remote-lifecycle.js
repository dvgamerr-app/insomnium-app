import assert from "node:assert/strict";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { fixtureGit } from "./helpers/git-advance-fixture.js";

// This scenario covers native IPC plus the existing UI remaining usable.
// Remote settings/Stop UI is covered by the separate saved settings scenario.
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-remote-ui-probe/build-state.json";

/** @param {string} value */
const packet = (value) =>
  (Buffer.byteLength(value) + 4).toString(16).padStart(4, "0") + value;
const oid = "1111111111111111111111111111111111111111";
const advertisement =
  packet("# service=git-upload-pack\n") +
  "0000" +
  packet(oid + " HEAD\0multi_ack symref=HEAD:refs/heads/main\n") +
  packet(oid + " refs/heads/main\n") +
  "0000";
let stalls = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0, // Let the native 30-second timeout win, not Bun's idle timeout.
  fetch(request) {
    if (new URL(request.url).pathname.startsWith("/stall/")) {
      stalls++;
      return new Promise((resolve) => {
        request.signal.addEventListener(
          "abort",
          () => resolve(new Response("", { status: 499 })),
          { once: true },
        );
      });
    }
    return new Response(advertisement, {
      headers: {
        "Content-Type": "application/x-git-upload-pack-advertisement",
      },
    });
  },
});
const base = "http://127.0.0.1:" + server.port;
const publicTls = process.env.INSOMNIUM_REMOTE_PUBLIC_TLS === "1";

try {
  await withNativeApp(
    publicTls ? "git-remote-lifecycle-public-tls" : "git-remote-lifecycle",
    async ({ page, output, invoke }) => {
      const fixture = await gitCollection({ page, invoke });
      const originalPages = page.context().pages().length;
      const result = await invoke("git_remote_advertise", {
        requestId: crypto.randomUUID(),
        input: { url: base + "/normal" },
      });
      assert.equal(result.defaultBranch, "main");
      assert.equal(result.branches[0].oid, oid);
      assert.equal(page.context().pages().length, originalPages);

      let tlsEvidence;
      if (publicTls) {
        // Anonymous discovery only: this scenario never submits a public Push.
        const url = "https://github.com/octocat/Hello-World.git";
        assert.ok(process.env.APPDATA);
        const directory = join(process.env.APPDATA, probeIdentifier);
        assert.equal(
          (await realpath(directory)).toLowerCase(),
          directory.toLowerCase(),
        );
        const repo = join(directory, "git-v1", "repo-" + fixture.repositoryId);
        assert.equal((await realpath(repo)).toLowerCase(), repo.toLowerCase());
        const workspace = join(directory, "workspace-v1.json");
        const data = await invoke("load_workspace");
        const bytes = await readFile(workspace);
        const localRefs = await fixtureGit(repo, ["show-ref"]);
        const localInfo = await invoke("git_repository_info", {
          repositoryId: fixture.repositoryId,
        });
        for (const name of [
          "GIT_SSL_NO_VERIFY",
          "GIT_SSL_CAINFO",
          "SSL_CERT_FILE",
          "SSL_CERT_DIR",
          "CURL_CA_BUNDLE",
          "NODE_TLS_REJECT_UNAUTHORIZED",
        ])
          assert.equal(
            process.env[name],
            undefined,
            "Public TLS evidence requires unchanged default trust: " + name,
          );
        // Independently read refs through Git CLI (not the native worker parser).
        const expected = await fixtureGit(repo, ["ls-remote", "--symref", url]);
        const branches = expected
          .split("\n")
          .flatMap((line) => {
            const match = /^([a-f0-9]{40})\t(refs\/heads\/(.+))$/.exec(line);
            return match
              ? [{ name: match[3], reference: match[2], oid: match[1] }]
              : [];
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        assert.ok(branches.length > 0);
        const defaultBranch = /^ref: refs\/heads\/(.+)\tHEAD$/m.exec(
          expected,
        )?.[1];
        const headOid = /^([a-f0-9]{40})\tHEAD$/m.exec(expected)?.[1];
        assert.ok(defaultBranch && headOid);
        const discovered = await invoke("git_remote_advertise", {
          requestId: crypto.randomUUID(),
          input: { url, credentials: { kind: "anonymous" } },
        });
        assert.equal(discovered.url, url);
        assert.deepEqual(discovered.branches, branches);
        assert.equal(discovered.defaultBranch, defaultBranch);
        assert.equal(discovered.headOid, headOid);
        assert.deepEqual(await invoke("load_workspace"), data);
        assert.deepEqual(await readFile(workspace), bytes);
        assert.equal(await fixtureGit(repo, ["show-ref"]), localRefs);
        assert.deepEqual(
          await invoke("git_repository_info", {
            repositoryId: fixture.repositoryId,
          }),
          localInfo,
        );
        assert.equal(page.context().pages().length, originalPages);
        const failures = [];
        for (const [host, expectedCode] of [
          ["wrong.host.badssl.com", "ERR_TLS_CERT_ALTNAME_INVALID"],
          ["expired.badssl.com", "CERT_HAS_EXPIRED"],
        ]) {
          const endpoint = "https://" + host + "/";
          let independentCode = "";
          try {
            await fetch(endpoint, {
              redirect: "error",
              signal: AbortSignal.timeout(15000),
            });
          } catch (error) {
            independentCode = /** @type {any} */ (error).code;
          }
          assert.equal(
            independentCode,
            expectedCode,
            "Independent TLS failure classification",
          );
          let nativeError = "";
          try {
            await invoke("git_remote_advertise", {
              requestId: crypto.randomUUID(),
              input: { url: endpoint, credentials: { kind: "anonymous" } },
            });
          } catch (error) {
            nativeError = String(error);
          }
          assert.match(
            nativeError,
            /Certificate/,
            "Native certificate refusal, not HTTP/not-a-Git-repo failure",
          );
          assert.deepEqual(await invoke("load_workspace"), data);
          assert.deepEqual(await readFile(workspace), bytes);
          assert.equal(await fixtureGit(repo, ["show-ref"]), localRefs);
          assert.deepEqual(
            await invoke("git_repository_info", {
              repositoryId: fixture.repositoryId,
            }),
            localInfo,
          );
          failures.push({ endpoint, independentCode, nativeError });
        }
        tlsEvidence = {
          url,
          defaultBranch,
          headOid,
          branches,
          failures,
          credentials: "anonymous",
          scope:
            "Actual Windows native worker public HTTPS discovery with default certificate validation and independent Git refs; native hostname/expired-certificate refusal independently classified by Bun. No public Push, credential challenge, server-side negative request counters, mTLS/proxy or other-platform acceptance.",
        };
      }

      const requestId = crypto.randomUUID();
      const pending = invoke("git_remote_advertise", {
        requestId,
        input: { url: base + "/stall" },
      }).then(
        () => ({ error: "" }),
        (error) => ({ error: String(error) }),
      );
      try {
        await poll(
          async () => stalls === 1,
          "remote worker reaches stalled endpoint",
        );
        await page.getByRole("button", { name: "Git", exact: true }).click();
        const dialog = page.getByRole("region", {
          name: "Source Control",
          exact: true,
        });
        await dialog
          .getByRole("button", { name: "Reload changes", exact: true })
          .waitFor();
        await dialog
          .getByRole("button", { name: "Reload changes", exact: true })
          .click();
        await dialog
          .getByRole("button", { name: "Reload changes", exact: true })
          .waitFor();
        const started = Date.now();
        await invoke("git_remote_cancel", { requestId });
        assert.match((await pending).error, /cancelled/);
        assert.ok(
          Date.now() - started < 5000,
          "Native cancellation should complete promptly",
        );
      } finally {
        await invoke("git_remote_cancel", { requestId });
        await pending;
      }
      const before = stalls;
      const early = crypto.randomUUID();
      await invoke("git_remote_cancel", { requestId: early });
      await assert.rejects(
        invoke("git_remote_advertise", {
          requestId: early,
          input: { url: base + "/stall" },
        }),
        /cancelled/,
      );
      assert.equal(stalls, before);

      const started = Date.now();
      await assert.rejects(
        invoke("git_remote_advertise", {
          requestId: crypto.randomUUID(),
          input: { url: base + "/stall" },
        }),
        /timed out/,
      );
      const timeoutMs = Date.now() - started;
      assert.ok(
        timeoutMs >= 29000 && timeoutMs < 35000,
        "Actual 30-second supervisor timeout",
      );
      assert.equal(page.context().pages().length, originalPages);
      assert.equal(
        (
          await invoke("git_repository_info", {
            repositoryId: fixture.repositoryId,
          })
        ).headOid,
        fixture.oid,
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        fixture.data.resources,
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            timeoutMs,
            tls: tlsEvidence,
            checks: [
              "Native worker advertisement result",
              "No extra WebView page from worker dispatch",
              "Existing Git dialog reload works during blocked network",
              "Native cancel resolves promptly",
              "Pre-cancel prevents network admission",
              "Actual 30-second native timeout",
              "Local HEAD and workspace unchanged",
              ...(publicTls
                ? [
                    "Actual native public HTTPS anonymous discovery matches independent Git refs and preserves exact full workspace bytes/data/local refs/info",
                    "Native hostname and expired-certificate refusals independently classified by Bun, preserving exact full workspace bytes/data/local refs/info",
                  ]
                : []),
            ],
            limits:
              "IPC and existing UI responsiveness; optional public TLS discovery only, not provider authentication, remote settings/Stop UI, public Push or OS-close acceptance",
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
