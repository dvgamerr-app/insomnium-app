import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { gitRepositoryPack } from "./helpers/git-repository-pack.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
import { managedHistoryPack } from "./helpers/git-managed-history-pack.js";
import { openGitRemote } from "./helpers/git-panel.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-pull-history", async context => {
  const { page, invoke, output } = context;
  const fixture = await advanceFixture(context);
  const managed = await gitRepositoryPack(fixture);
  const shallow = gitPackFixture({ advance: true, shallow: true });
  const full = gitPackFixture({ advance: true });
  const selected = await managedHistoryPack(fixture);
  let expanded = false;
  let selectedExpanded = false;
  const selectedBodies = /** @type {string[]} */ ([]);
  let shallowPosts = 0, fullPosts = 0;
  const packet = (/** @type {string} */ value) => (Buffer.byteLength(value) + 4).toString(16).padStart(4, "0") + value;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    const unrelated = path.startsWith("/unrelated");
    const selectedRoute = path.startsWith("/selected");
    const advertised = selectedRoute ? selected.shallow : unrelated ? expanded ? full : shallow : managed;
    if (request.method === "POST") {
      const body = await request.text();
      if (selectedRoute) selectedBodies.push(body);
      const limited = selectedRoute ? !selectedExpanded : unrelated && !expanded;
      const pack = selectedRoute ? limited ? selected.shallow : selected.full : advertised;
      if (limited) shallowPosts++; else fullPosts++;
      const prefix = limited ? packet("shallow " + (selectedRoute ? selected.oid : shallow.oid)) + "0000" : "";
      return new Response(limited && !body.includes("done") ? Buffer.from(prefix) :
        Buffer.concat([Buffer.from(prefix + "0008NAK\n"), pack.pack]), {
        headers: { "Content-Type": "application/x-git-upload-pack-result" },
      });
    }
    return new Response(advertised.advertisement, {
      headers: { "Content-Type": "application/x-git-upload-pack-advertisement" },
    });
  } });
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await openGitRemote(page);
    const remote = page.getByRole("region", { name: "Git remote", exact: true });
    const depth = remote.getByLabel("Fetch depth (optional)", { exact: true });
    const branch = remote.getByLabel("Fetch branch (optional)", { exact: true });
    async function saveEndpoint(/** @type {string} */ path) {
      await remote.getByLabel("Repository URL", { exact: true }).fill(`http://127.0.0.1:${server.port}/${path}`);
      await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
      await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
    }
    const success = remote.getByText("Remote branches fetched. Your local branch is unchanged.", { exact: true });
    await saveEndpoint("unrelated");
    await branch.fill("main");
    await depth.fill("1");
    await remote.getByRole("button", { name: "Fetch remote branches", exact: true }).click();
    await success.waitFor();
    const shallowPath = join(fixture.repo, ".git", "shallow");
    const shallowBytes = await Bun.file(shallowPath).text();
    assert.equal(shallowBytes, shallow.oid + "\n");
    assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "--is-shallow-repository"]), "true");
    const parent = (await fixtureGit(fixture.repo, ["cat-file", "-p", shallow.oid])).match(/^parent ([0-9a-f]{40})$/m)?.[1];
    assert.ok(parent);
    assert.equal(await fixtureGit(fixture.repo, ["cat-file", "--batch-check"], parent + "\n"), parent + " missing");
    assert.ok(shallowPosts > 0, "Native depth-one pack really omits ancestor objects");
    await saveEndpoint("managed");
    const baseline = await invoke("load_workspace");
    await remote.getByRole("button", { name: "Review pull", exact: true }).click();
    if (process.env.INSOMNIUM_UI_EXPECT_SHALLOW_REFUSAL === "1") {
      await remote.getByRole("alert").filter({ hasText: "Expand fetched history before classifying this merge" }).waitFor();
      assert.deepEqual(await invoke("load_workspace"), baseline);
      assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.f.oid);
      assert.equal(await Bun.file(shallowPath).text(), shallowBytes);
      await Bun.write(join(output, "reproducer.json"), JSON.stringify({ reproduced: true,
        reason: "Unrelated actual shallow snapshot blocks complete managed Pull", shallowPosts, fullPosts }, null, 2));
      return;
    }
    const review = page.getByRole("dialog", { name: "Review merge", exact: true });
    await review.waitFor();
    assert.equal(await Bun.file(shallowPath).text(), shallowBytes);
    await review.getByLabel("Working conflict choice " + fixture.f.requestId, { exact: true }).selectOption("incoming");
    await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
    await review.getByRole("button", { name: "Apply merge", exact: true }).click();
    await review.waitFor({ state: "hidden" });
    await page.getByRole("region", { name: "Source Control", exact: true }).getByRole("status").filter({ hasText: "Merged into main" }).waitFor();
    const expected = structuredClone(baseline);
    const request = expected.resources.find((/** @type {any} */ row) => row._id === fixture.f.requestId);
    request.url = "https://example.invalid/advance-writer";
    request.type = "Request";
    assert.deepEqual(await invoke("load_workspace"), expected);
    assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.newOid);
    assert.equal(await Bun.file(shallowPath).text(), shallowBytes, "Complete Pull must not remove unrelated shallow cuts");
    await assertAdvanceCleanup(fixture);
    await openGitRemote(page);
    expanded = true;
    await saveEndpoint("unrelated");
    await branch.fill("main");
    await depth.fill("");
    await remote.getByRole("button", { name: "Fetch remote branches", exact: true }).click();
    await success.waitFor();
    assert.equal(await Bun.file(shallowPath).text(), "", "Atomic publication retains an empty marker with no physical cuts");
    assert.notEqual(await fixtureGit(fixture.repo, ["cat-file", "--batch-check"], parent + "\n"), parent + " missing");
    const saved = await invoke("load_workspace");
    const binding = saved.resources.find((/** @type {any} */ row) => row._id === fixture.f.repositoryId);
    const inspected = await invoke("git_remote_fetch_inspect", { request: {
      requestId: crypto.randomUUID(), repositoryId: fixture.f.repositoryId, workspaceId: fixture.f.workspaceId, expectedBinding: binding,
    } });
    const history = inspected.snapshot.manifest.histories.find((/** @type {any} */ row) => row.name === "main");
    assert.equal(history.depth, null);
    assert.deepEqual(history.boundaries, []);
    assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.newOid);
    assert.deepEqual(saved.resources.filter((/** @type {any} */ row) => row._id !== fixture.f.repositoryId),
      expected.resources.filter((/** @type {any} */ row) => row._id !== fixture.f.repositoryId));
    await saveEndpoint("selected");
    await depth.fill("1");
    await remote.getByRole("button", { name: "Fetch remote branches", exact: true }).click();
    await success.waitFor();
    assert.equal(await Bun.file(shallowPath).text(), selected.oid + "\n");
    assert.equal(await fixtureGit(fixture.repo, ["cat-file", "--batch-check"], selected.missingParent + "\n"), selected.missingParent + " missing");
    assert.ok(selectedBodies.some(body => body.includes("deepen 1")));
    const selectedBefore = await invoke("load_workspace");
    const depthOneRequests = selectedBodies.length;
    selectedExpanded = true;
    await remote.getByRole("button", { name: "Review pull", exact: true }).click();
    await review.waitFor();
    assert.equal(await Bun.file(shallowPath).text(), "", "Complete Pull removes every selected physical cut");
    assert.notEqual(await fixtureGit(fixture.repo, ["cat-file", "--batch-check"], selected.missingParent + "\n"), selected.missingParent + " missing");
    assert.ok(selectedBodies.length > depthOneRequests && selectedBodies.slice(depthOneRequests).every(body => !body.includes("deepen 1")));
    assert.deepEqual(await invoke("load_workspace"), selectedBefore);
    assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.newOid);
    await review.getByRole("button", { name: "Apply merge", exact: true }).click();
    await review.waitFor({ state: "hidden" });
    await page.getByRole("region", { name: "Source Control", exact: true }).getByRole("status").filter({ hasText: "Merged into main" }).waitFor();
    assert.deepEqual(await invoke("load_workspace"), selectedBefore);
    assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), selected.oid);
    await assertAdvanceCleanup(fixture);
    assert.deepEqual(errors, []);
    await Bun.write(join(output, "acceptance.json"), JSON.stringify({ shallowPosts, fullPosts,
      checks: ["actual depth-one unrelated snapshot has absent parent and physical cut", "complete managed Pull proceeds while preserving unrelated cut/full workspace",
        "explicit complete-history Fetch restores missing parent and removes physical cut", "expanded manifest is complete and local branch/resources remain unchanged",
        "selected managed shallow tip has genuinely absent intermediate before Pull", "Pull downloads missing intermediate/removes cut before review and confirms exact full workspace/new ref"],
      scope: "Windows loopback retained unrelated cut/explicit expansion/selected managed depth1 to complete-history Pull; other missing-source ancestry/multiple-base/provider/platform remain open",
    }, null, 2));
  } finally { server.stop(true); }
});
