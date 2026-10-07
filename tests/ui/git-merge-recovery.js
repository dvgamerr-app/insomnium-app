import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { openGitBranches } from "./helpers/git-panel.js";
import { heldHttp } from "./helpers/held-http.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
const http = await heldHttp({body:"fresh after merge"});
try {
  await withNativeApp("git-merge-recovery", async context => {
    const {page,invoke,output} = context;
    const x = await advanceFixture(context);
    const errors = /** @type {string[]} */ ([]);
    page.on("pageerror", error => errors.push(error.message));
    await fixtureGit(x.repo, ["update-ref","refs/heads/incoming",x.newOid]);
    await page.getByRole("button",{name:"Git",exact:true}).click();
    const panel = page.getByRole("region",{name:"Source Control",exact:true});
    const review = page.getByRole("dialog",{name:"Review merge",exact:true});
    const recovery = page.getByRole("dialog",{name:"Recover merge",exact:true});
    const main = () => fixtureGit(x.repo,["rev-parse","refs/heads/main"]);
    /** @type {string[]} */ const checks = [];
    async function startReview() {
      await openGitBranches(page);
      const branches = page.getByRole("dialog",{name:"Branches",exact:true});
      await branches.getByRole("combobox").first().selectOption("incoming");
      await branches.getByRole("button",{name:"Review merge",exact:true}).click();
      await review.waitFor();
    }
    /** @param {"local"|"incoming"} [choice] */
    async function prepare(choice="incoming") {
      await startReview();
      await review.getByLabel("Working conflict choice " + x.f.requestId,{exact:true}).selectOption(choice);
      await review.getByRole("button",{name:"Review resolutions",exact:true}).click();
      await review.getByRole("button",{name:"Apply merge",exact:true}).waitFor();
    }
    async function apply() { await review.getByRole("button",{name:"Apply merge",exact:true}).click(); }
    /** Independent exact-ref setup only inside the uniquely owned fixture repository.
     * @param {any} data */
    async function reset(data) {
      await assertAdvanceCleanup(x);
      await fixtureGit(x.repo,["update-ref","refs/heads/main",x.f.oid,x.newOid]);
      await invoke("save_workspace",{data});
      await page.reload();
    }
    /** @param {any} data */
    function checkIncoming(data) {
      const expected = structuredClone(x.after);
      // Git's documented legacy format supplies this marker on the replaced
      // public request. Untouched local records must remain exactly unchanged.
      expected.resources.find((/** @type {any} */ row)=>row._id===x.f.requestId).type="Request";
      assert.deepEqual(data,expected,"Authoritative recovery matches the complete expected workspace");
    }
    await prepare();
    const baselineLock = await lockProbeWorkspaceReplacement();
    try {
      const bytes = await readFile(x.workspace);
      const observed = await withIpcSuccessHook(page,"git_repository_apply_merge",async()=>{},async()=>{
        await apply();
        await review.waitFor({state:"hidden"});
        await panel.getByRole("alert").filter({hasText:/os error (5|32)|access.*denied|sharing/i}).waitFor();
      });
      assert.equal(observed.calls,0,"Failed baseline save submits no merge command");
      assert.equal(await recovery.count(),0);
      assert.deepEqual(await readFile(x.workspace),bytes);
      assert.deepEqual(await invoke("load_workspace"),x.before);
      assert.equal(await main(),x.f.oid);
      await assertAdvanceCleanup(x);
      await page.screenshot({path:join(output,"baseline-save-refusal.png")});
    } finally { baselineLock.release(); }
    checks.push("actual-baseline-save-refusal-no-merge-submit-exact-bytes-ref-preserved");
    await prepare();
    let transitionLock = /** @type {Awaited<ReturnType<typeof lockProbeWorkspaceReplacement>>|null} */ (null);
    try {
      const observed = await withIpcSuccessHook(page,"save_workspace",async()=>{
        transitionLock = await lockProbeWorkspaceReplacement();
      },async()=>{
        await apply();
        await recovery.waitFor();
        assert.ok(transitionLock);
        assert.match(await recovery.innerText(),/os error (5|32)|access.*denied|sharing/i);
        await page.keyboard.press("Escape");
        assert.equal(await recovery.isVisible(),true,"Recovery cannot be dismissed");
        assert.deepEqual(await Bun.file(x.workspace).json(),x.before);
        assert.equal(await main(),x.newOid,"Ref advanced before refused workspace replacement");
        const journal = await Bun.file(x.journalPath).json();
        assert.equal(journal.schemaVersion,2);
        assert.equal(journal.advance.kind,"fastForward");
        assert.equal(journal.targetOid,x.newOid);
        const lockedBytes = await readFile(x.workspace);
        await page.screenshot({path:join(output,"post-ref-write-refusal.png")});
        transitionLock.release();
        let blocked = "";
        try { await invoke("save_workspace",{data:x.before}); } catch(error) { blocked=String(error); }
        assert.match(blocked,/transition|recovery/i,"Ordinary save blocked by durable journal");
        assert.deepEqual(await readFile(x.workspace),lockedBytes);
        await recovery.getByRole("button",{name:"Retry recovery",exact:true}).click();
        await recovery.waitFor({state:"hidden"});
        checkIncoming(await invoke("load_workspace"));
        assert.equal(await main(),x.newOid);
        await assertAdvanceCleanup(x);
      });
      assert.equal(observed.calls,2,"Only baseline and explicit blocked-save probe; recovery performs no save");
      assert.equal(observed.hooks,1);
    } finally { transitionLock?.release(); }
    checks.push("actual-post-ref-write-refusal-locked-journal-recovery-completes-reviewed-workspace");
    await reset(x.before);
    await page.getByRole("button",{name:"Git",exact:true}).click();
    await prepare();
    const fault = await withIpcFailure(page,"git_repository_apply_merge",true,async()=>{
      await apply();
      await recovery.waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await recovery.isVisible(),true);
      checkIncoming(await invoke("load_workspace"));
      assert.equal(await main(),x.newOid);
      await recovery.getByRole("button",{name:"Retry recovery",exact:true}).click();
      await recovery.waitFor({state:"hidden"});
    });
    assert.equal(fault.calls,1,"Lost success never resubmits merge");
    assert.equal(fault.completed,1);
    checkIncoming(await invoke("load_workspace"));
    await assertAdvanceCleanup(x);
    await page.screenshot({path:join(output,"source-control-after-recovery.png")});
    checks.push("completed-native-success-lost-reply-locked-authoritative-recovery-no-resubmit");
    const heldBefore = structuredClone(x.before);
    heldBefore.resources.find((/** @type {any} */ row)=>row._id===x.f.requestId).url=`http://127.0.0.1:${http.port}/held`;
    await reset(heldBefore);
    await page.getByRole("button",{name:"Send",exact:true}).click();
    await poll(async()=>http.held===1,"Held native request reached fixture");
    await page.getByRole("button",{name:"Git",exact:true}).click();
    await prepare("local");
    await apply();
    await review.waitFor({state:"hidden"});
    await panel.getByRole("status").filter({hasText:"Merged into main"}).waitFor();
    await poll(async()=>http.cancelled===1,"Merge drain closes native held HTTP connection");
    assert.deepEqual(await invoke("load_workspace"),heldBefore,"Drain creates no cancelled history or late resource write");
    assert.equal(await main(),x.newOid);
    await assertAdvanceCleanup(x);
    checks.push("actual-native-held-request-drain-no-cancelled-history-late-write-full-preservation");
    await page.reload();
    await page.getByLabel("Request URL",{exact:true}).fill(`http://127.0.0.1:${http.port}/fresh`);
    await page.getByRole("button",{name:"Send",exact:true}).click();
    await poll(async()=>http.echoes===1,"Fresh native request after merge drain");
    await poll(async()=>(await invoke("load_workspace")).history.some((/** @type {any} */ response)=>
      response.requestId===x.f.requestId && response.status===200 &&
      !heldBefore.history.some((/** @type {any} */ previous)=>previous._id===response._id)),"Fresh200 persisted after merge");
    checks.push("fresh-native-send-and-persisted200-after-merge-drain");
    await page.reload();
    const heldUrl = `http://127.0.0.1:${http.port}/held`;
    await page.getByLabel("Request URL",{exact:true}).fill(heldUrl);
    await page.getByRole("button",{name:"Send",exact:true}).click();
    await poll(async()=>http.held===2,"Second held request before up-to-date review");
    await poll(async()=>(await invoke("load_workspace")).resources.find((/** @type {any} */ row)=>row._id===x.f.requestId).url===heldUrl,"Pending URL save completed before no-write assertion");
    const upToDateBefore = await invoke("load_workspace");
    const upToDateBytes = await readFile(x.workspace);
    await page.getByRole("button",{name:"Git",exact:true}).click();
    await startReview();
    await review.getByText("The current branch already includes this revision.",{exact:true}).waitFor();
    await review.getByRole("button",{name:"Confirm up to date",exact:true}).click();
    await review.waitFor({state:"hidden"});
    await panel.getByRole("status").filter({hasText:"Already up to date"}).waitFor();
    assert.equal(http.cancelled,1,"Up-to-date confirmation keeps the active request connected");
    assert.deepEqual(await readFile(x.workspace),upToDateBytes);
    assert.deepEqual(await invoke("load_workspace"),upToDateBefore);
    assert.equal(await main(),x.newOid);
    await panel.getByRole("button",{name:"Close Source Control",exact:true}).click();
    await page.getByRole("button",{name:"Cancel",exact:true}).click();
    await poll(async()=>http.cancelled===2,"Explicit user Cancel closes the preserved request");
    assert.deepEqual((await invoke("load_workspace")).history,upToDateBefore.history);
    await assertAdvanceCleanup(x);
    checks.push("up-to-date-preserves-active-native-request-no-write-until-explicit-user-cancel");
    assert.deepEqual(errors,[]);
    await Bun.write(join(output,"acceptance.json"),JSON.stringify({passed:true,checks,
      scope:"Mounted Windows merge: actual baseline/post-ref file-sharing refusals, injected lost completed-success reply, actual HTTP drain/fresh Send and up-to-date preserving active HTTP until explicit Cancel. Independent owned ref setup; no retained-copy/OS-close/crash/disk-full/network Pull/other-platform acceptance."},null,2));
  });
} finally { await http.close(); }
