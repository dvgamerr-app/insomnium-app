import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { openGitRemote } from "./helpers/git-panel.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-remote-settings-ui-probe/build-state.json";
/** @param {string} s */
const packet = (s) =>
  (Buffer.byteLength(s) + 4).toString(16).padStart(4, "0") + s;
const oid = "1".repeat(40);
const advertisement =
  packet("# service=git-upload-pack\n") +
  "0000" +
  packet(oid + " HEAD\0multi_ack symref=HEAD:refs/heads/main\n") +
  packet(oid + " refs/heads/main\n") +
  "0000";
let stalls = 0;
let aborted = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0,
  fetch(request) {
    if (new URL(request.url).pathname.startsWith("/stall/")) {
      stalls++;
      return new Promise((resolve) =>
        request.signal.addEventListener(
          "abort",
          () => {
            aborted++;
            resolve(new Response("", { status: 499 }));
          },
          { once: true },
        ),
      );
    }
    if (
      request.headers.get("authorization") !==
      "Basic " + Buffer.from("probe:fixture-secret").toString("base64")
    )
      return new Response("", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="fixture"' },
      });
    return new Response(advertisement, {
      headers: {
        "Content-Type": "application/x-git-upload-pack-advertisement",
      },
    });
  },
});
const base = "http://127.0.0.1:" + server.port;
try {
  await withNativeApp(
    "git-remote-settings",
    async ({ page, output, invoke }) => {
      const f = await gitCollection({ page, invoke });
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      let panel = page.getByRole("region", { name: "Git remote", exact: true });
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill(base + "/repo");
      await panel
        .getByRole("combobox", { name: /^Remote authentication/ })
        .selectOption("basic");
      await panel.getByLabel("Git username", { exact: true }).fill("probe");
      await panel
        .getByLabel("Git password or token", { exact: true })
        .fill("fixture-secret");
      await panel
        .getByRole("button", { name: "Save remote settings", exact: true })
        .click();
      await panel
        .getByText("Remote settings saved.", { exact: true })
        .waitFor();
      const data = await invoke("load_workspace");
      const binding = data.resources.find(
        (/** @type {any} */ r) => r.nativeRepositoryId === f.repositoryId,
      );
      assert.equal(binding.uri, base + "/repo");
      assert.deepEqual(binding.credentials, {
        username: "probe",
        password: "fixture-secret",
      });
      await panel
        .getByRole("button", { name: "Read remote branches", exact: true })
        .click();
      await panel
        .getByText("Remote branches loaded.", { exact: true })
        .waitFor();
      await panel.getByText("Default branch: main", { exact: true }).waitFor();
      await panel
        .getByLabel("Git password or token", { exact: true })
        .fill("incorrect-fixture");
      await panel
        .getByRole("button", { name: "Read remote branches", exact: true })
        .click();
      await panel
        .getByRole("alert")
        .filter({ hasText: "Git remote request failed" })
        .waitFor();
      assert.equal(
        await panel
          .getByLabel("Git password or token", { exact: true })
          .inputValue(),
        "incorrect-fixture",
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        data.resources,
      );
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      panel = page.getByRole("region", { name: "Git remote", exact: true });
      await panel.getByLabel("Repository URL", { exact: true }).waitFor();
      assert.equal(
        await panel.getByLabel("Repository URL", { exact: true }).inputValue(),
        base + "/repo",
      );
      assert.equal(
        await panel
          .getByLabel("Git password or token", { exact: true })
          .inputValue(),
        "fixture-secret",
      );
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill(base + "/stall");
      await panel
        .getByRole("button", { name: "Read remote branches", exact: true })
        .click();
      await poll(
        async () => stalls === 1,
        "UI request reaches stalled endpoint",
      );
      await panel
        .getByRole("button", { name: "Stop remote request", exact: true })
        .click();
      await panel
        .getByText("Remote request stopped.", { exact: true })
        .waitFor();
      assert.ok(
        await panel
          .getByRole("button", { name: "Read remote branches", exact: true })
          .isEnabled(),
      );
      await panel
        .getByRole("button", { name: "Read remote branches", exact: true })
        .click();
      await poll(async () => stalls === 2, "second stalled request");
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill(base + "/changed");
      await panel
        .getByText("Remote request stopped.", { exact: true })
        .waitFor();
      assert.equal(
        await panel.getByText("Default branch: main", { exact: true }).count(),
        0,
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        data.resources,
      );
      assert.equal(
        (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
          .headOid,
        f.oid,
      );
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill(base + "/stall");
      await panel
        .getByRole("button", { name: "Read remote branches", exact: true })
        .click();
      await poll(async () => stalls === 3, "request before dialog close");
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await poll(
        async () => aborted === 3,
        "closing dialog cancels native connection",
      );
      await openGitRemote(page);
      panel = page.getByRole("region", { name: "Git remote", exact: true });
      await panel.getByLabel("Repository URL", { exact: true }).waitFor();
      assert.equal(
        await panel.getByLabel("Repository URL", { exact: true }).inputValue(),
        base + "/repo",
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "UI saves local remote settings",
              "Basic-auth remote discovery through UI",
              "Settings and credentials survive reload",
              "Auth error preserves unsaved fields and saved settings",
              "Closing dialog cancels native connection and reopens saved settings",
              "Stop cancels actual stalled request",
              "Editing endpoint cancels and clears stale results",
              "Unsaved edits do not change persisted resources or HEAD",
            ],
            limits:
              "Synthetic loopback provider; no OAuth login/refresh, OS dialogs, fetch/push or full visual parity",
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
