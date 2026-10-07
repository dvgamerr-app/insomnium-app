import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, fixtureGitBytes, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { conflictEdgeFixture, rawTreeEntries } from "./helpers/git-conflict-edge-fixture.js";
import { gitRepositoryPack } from "./helpers/git-repository-pack.js";
import { serveGitPack } from "./helpers/git-smart-http.js";
import { openGitRemote } from "./helpers/git-panel.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-pull-conflict-edges", async context => {
  const { page, invoke, output } = context;
  const x = await advanceFixture(context);
  const f = await conflictEdgeFixture(x);
  await fixtureGit(x.repo, ["update-ref", "refs/heads/main", f.current.oid, x.f.oid]);
  const prepared = await invoke("git_repository_prepare_merge", { input: {
    repositoryId: x.f.repositoryId, workspaceId: x.f.workspaceId, sourceBranch: "main",
    sourceOid: f.current.oid, incomingOid: f.incoming.oid,
    authorName: x.f.author.name, authorEmail: x.f.author.email, message: "Pinned edge conflicts" } });
  assert.equal(prepared.conflicts.length, 11);
  assert.equal(prepared.targetOid, null);
  const contents = /** @type {Map<string,any>} */ (new Map(prepared.conflictContents.map((/** @type {any} */ entry) => [entry.oid, entry])));
  assert.ok(prepared.conflictContents.some((/** @type {any} */ entry) => entry.kind === "budgetExceeded"));
  assert.ok(prepared.conflictContents.some((/** @type {any} */ entry) => entry.kind === "tooLarge"));
  for (const id of f.gitlinks) assert.equal(contents.get(id).kind, "gitlink");
  const network = serveGitPack(await gitRepositoryPack(x, f.incoming.oid));
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    const source = page.getByRole("region", { name: "Source Control", exact: true });
    const info = await invoke("git_repository_info", { repositoryId: x.f.repositoryId });
    for (const path of [f.rawPath, f.secondRawPath]) {
      const rawStatus = info.changes.find((/** @type {any} */ row) => row.pathBytes && Buffer.from(row.pathBytes).equals(path));
      assert.ok(rawStatus, "Native status must retain distinct unrelated raw paths rather than refusing collection Git");
      assert.equal(rawStatus.path, "Path bytes: " + path.toString("hex").match(/../g)?.join(" "));
    }
    await openGitRemote(page);
    const remote = page.getByRole("region", { name: "Git remote", exact: true });
    await remote.getByLabel("Repository URL", { exact: true }).fill(`http://127.0.0.1:${network.server.port}/repo`);
    await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
    await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
    const before = await invoke("load_workspace");
    const bytes = await readFile(x.workspace);
    const indexPath = join(x.repo, ".git", "index");
    const index = await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
    const review = page.getByRole("dialog", { name: "Review merge", exact: true });
    async function start() {
      if (!(await remote.isVisible())) await openGitRemote(page);
      await remote.getByLabel("Fetch branch (optional)", { exact: true }).fill("main");
      await remote.getByRole("button", { name: "Review pull", exact: true }).click();
      await review.waitFor();
    }
    const labelPath = (/** @type {number[]} */ bytes) => {
      try { return new TextDecoder("utf8", { fatal: true }).decode(Uint8Array.from(bytes)); }
      catch { return "Path bytes: " + Buffer.from(bytes).toString("hex").match(/../g)?.join(" "); }
    };
    await start();
    assert.equal(await review.getByRole("combobox", { name: /^Git conflict choice / }).count(), 11);
    for (let i = 0; i < prepared.conflicts.length; i++) {
      const conflict = prepared.conflicts[i];
      const name = labelPath(conflict.ours.path);
      for (const [side, label] of [["ours", "Current branch"], ["theirs", "Incoming branch"]]) {
        const content = contents.get(conflict[side].oid);
        if (["gitlink", "tooLarge", "budgetExceeded"].includes(content.kind) ||
            [f.rawPath, f.secondRawPath].some(path => Buffer.from(conflict[side].path).equals(path))) {
          const details = review.getByText(label + ": " + name, { exact: true }).locator("..");
          await details.locator("summary").click();
          if (content.kind === "gitlink") {
            await details.getByText("Submodule commit " + conflict[side].oid + ".", { exact: true }).waitFor();
            assert.equal(content.size, null);
          } else if (content.kind === "tooLarge") {
            await details.getByText("Content preview omitted because the file exceeds 256 KiB. Keep either branch or enter a replacement.", { exact: true }).waitFor();
          } else if (content.kind === "budgetExceeded") {
            await details.getByText("Content preview omitted because this review exceeds the 2 MiB preview budget. Keep either branch or enter a replacement.", { exact: true }).waitFor();
          } else assert.equal(await details.getByLabel(label + " content " + (i + 1), { exact: true }).inputValue(), content.text);
        }
      }
    }
    await page.screenshot({ path: join(output, "edge-conflict-preview.png") });
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]), f.current.oid);
    await review.getByRole("button", { name: "Cancel merge", exact: true }).click();
    await review.waitFor({ state: "hidden" });
    assert.deepEqual(await invoke("load_workspace"), before);
    assert.deepEqual(await Bun.file(indexPath).exists() ? await readFile(indexPath) : null, index);
    await assertAdvanceCleanup(x);
    await start();
    const selected = /** @type {Map<string,{oid:string,mode:string,type:string}>} */ (new Map());
    const customText = "Reviewed exact byte path\n";
    for (let i = 0; i < prepared.conflicts.length; i++) {
      const conflict = prepared.conflicts[i], raw = Buffer.from(conflict.ours.path);
      const custom = raw.equals(f.rawPath);
      const side = raw.toString().startsWith("01-") || raw.toString().startsWith("02-") ||
        contents.get(conflict.theirs.oid).kind === "budgetExceeded" ? "theirs" : "ours";
      await review.getByLabel("Git conflict choice " + (i + 1), { exact: true }).selectOption(custom ? "custom" : side);
      if (custom) {
        await review.getByLabel("Custom merge path " + (i + 1), { exact: true }).selectOption("theirs");
        await review.getByLabel("Custom merge mode " + (i + 1), { exact: true }).selectOption("100755");
        await review.getByLabel("Custom merge text " + (i + 1), { exact: true }).fill(customText);
        selected.set(raw.toString("hex"), { mode: "100755", type: "blob", oid: await fixtureGit(x.repo, ["hash-object", "--stdin"], customText) });
      } else {
        const entry = conflict[side];
        selected.set(raw.toString("hex"), { mode: entry.mode.toString(8), type: entry.mode === 0o160000 ? "commit" : "blob", oid: entry.oid });
      }
    }
    await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
    await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
    assert.deepEqual(await readFile(x.workspace), bytes);
    await review.getByRole("button", { name: "Apply merge", exact: true }).click();
    await review.waitFor({ state: "hidden" });
    await source.getByRole("status").filter({ hasText: "Merged into main" }).waitFor();
    const tip = await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]);
    assert.equal(await fixtureGit(x.repo, ["show", "-s", "--format=%P", tip]), f.current.oid + " " + f.incoming.oid);
    const entries = rawTreeEntries(await fixtureGitBytes(x.repo, ["ls-tree", "-z", tip]));
    for (const [path, expected] of selected) {
      const actual = entries.find(entry => entry.path.toString("hex") === path);
      assert.ok(actual);
      assert.deepEqual({ oid: actual.oid, mode: actual.mode, type: actual.type }, expected);
    }
    assert.ok(entries.some(entry => entry.path.equals(f.rawPath)));
    assert.ok(entries.some(entry => entry.path.equals(f.secondRawPath)));
    assert.equal(entries.some(entry => entry.path.includes(Buffer.from([0xef, 0xbf, 0xbd]))), false);
    for (const record of [...f.current.records, ...f.incoming.records].filter(record => record.path.toString().endsWith("-only.txt"))) {
      assert.equal(entries.find(entry => entry.path.equals(record.path))?.oid, record.oid);
    }
    for (const id of f.gitlinks) assert.equal(await fixtureGit(x.repo, ["cat-file", "--batch-check"], id + "\n"), id + " missing");
    assert.deepEqual(await invoke("load_workspace"), before);
    await assertAdvanceCleanup(x);
    assert.deepEqual(errors, []);
    assert.equal(network.state.gets, 2);
    assert.equal(network.state.posts, 2);
    await Bun.write(join(output, "acceptance.json"), JSON.stringify({ tip, pathHex: f.rawPath.toString("hex"), gets: network.state.gets, posts: network.state.posts,
      checks: ["real native Pull preserves and displays non-UTF8 path bytes without replacement decoding",
        "missing submodule commits display exact gitlink identities without object lookup",
        "file and aggregate preview limits show metadata while preserving complete immutable resolution",
        "cancel and second review preserve full workspace/ref/index before confirmation",
        "confirmation preserves exact raw path/custom executable blob/gitlink/symlink/large-budget chosen OIDs/modes/ordered parents/unrelated files/full workspace"],
      scope: "Windows loopback byte-path/gitlink/symlink/large/budget conflict review; rename/ancestor collision and other history/provider/platform/fault acceptance remain open" }, null, 2));
  } finally { network.close(); }
});
