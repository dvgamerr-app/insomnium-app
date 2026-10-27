import assert from "node:assert/strict";
import { writeFile, readFile, readdir, lstat, realpath, mkdtemp, rename, rmdir } from "node:fs/promises";
import { join, resolve, sep, basename, parse } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { withNativeApp, poll, integrationProbeIdentifier, selectedNativeProbeIdentifier } from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { withResourceProbePreserved, registerResourceProbeCollection } from "./helpers/resource-manager-cases.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { openGitBranches } from "./helpers/git-panel.js";
import { withGitStreamErrors } from "./helpers/git-stream-error-history.js";

assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE, "Explicit audited native build required");

await preserveNativeProfile(async ({ profile, workspacePath }) => withResourceProbePreserved(async () => {
const baseline=JSON.parse(await readFile(workspacePath,"utf8"));
for(const key of ["caPem","identityHost","identityPem"])assert.ok(!baseline.settings[key],"Git history fixture requires empty synthetic TLS settings");
const gitRoot=join(profile,"git-v1"),originalGitRoot=await lstat(gitRoot).then(()=>true,error=>{if(error.code!=="ENOENT")throw error;return false;});
const archiveRoot=await mkdtemp(join(tmpdir(),"insomnium-git-snapshot-"));
assert.equal((await realpath(archiveRoot)).toLowerCase(),resolve(archiveRoot).toLowerCase());
let ownedRepository="",scenarioOutput="";
try {
await withNativeApp(
  "git-create-and-switch",
  async ({ page, output, invoke }) => {
    scenarioOutput=output;
    const commands = /** @type {string[]} */ ([]);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost")
        commands.push(decodeURIComponent(url.pathname.slice(1)));
    });
    const fixture = await gitCollection({ page, invoke:async(command,args={})=>{
      if(command==="git_repository_init"){
        assert.equal(ownedRepository,"");assert.match(args.repositoryId,/^git_pw_\d+_[0-9a-f]{8}$/);
        const path=resolve(gitRoot,"repo-"+args.repositoryId);assert.ok(path.startsWith(resolve(gitRoot)+sep));
        assert.equal(await lstat(path).then(()=>true,error=>{if(error.code!=="ENOENT")throw error;return false;}),false,"Only a newly absent fixture repository may be archived");
        ownedRepository=path;
      }
      return invoke(command,args);
    } });
    const collection=fixture.data.resources.find((/** @type {any} */ row)=>row._id===fixture.workspaceId);assert.ok(collection);
    registerResourceProbeCollection(fixture.workspaceId,collection.name);
    await withGitStreamErrors(
      { page, invoke, output },
      fixture,
      async (verify) => {
        const branch = "feature/playwright-" + Date.now();
        await page.getByRole("button", { name: "Git", exact: true }).click();
        await openGitBranches(page);
        const dialog = page.locator("dialog[open]");
        await dialog.getByLabel("New branch", { exact: true }).fill(branch);
        await dialog
          .getByRole("button", { name: "Create and switch", exact: true })
          .click();
        await dialog
          .getByText("Switched to " + branch, { exact: true })
          .waitFor();
        await poll(
          async () =>
            (
              await invoke("git_repository_info", {
                repositoryId: fixture.repositoryId,
              })
            ).branch === branch,
          "new native HEAD",
        );
        const info = await invoke("git_repository_info", {
          repositoryId: fixture.repositoryId,
        });
        assert.equal(info.headOid, fixture.oid);
        assert.equal(
          commands.filter((command) => command === "git_repository_checkout")
            .length,
          1,
          "Mounted branch creation must perform the real native checkout transition",
        );
        const saved = await invoke("load_workspace");
        assert.deepEqual(saved.resources, fixture.data.resources);
        assert.deepEqual(saved.history, fixture.data.history);
        assert.equal(
          saved.resources.find(
            (/** @type {any} */ r) => r._id === fixture.repositoryId,
          ).nativeCreateIntent,
          undefined,
        );
        await dialog
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await verify("checkout");
        await page.reload();
        await page.getByRole("button", { name: "Git", exact: true }).click();
        await page
          .getByRole("region", { name: "Source Control", exact: true })
          .getByRole("button", { name: "Branches", exact: true })
          .click();
        await page
          .locator(".git-heading")
          .getByText(new RegExp(branch))
          .waitFor();
        assert.equal(
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === fixture.requestId,
          ).url,
          "https://example.invalid/local-edit",
        );
        await page
          .getByRole("dialog", { name: "Branches", exact: true })
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Branches", exact: true })
          .waitFor({ state: "detached" });
        await verify("reload");
        await writeFile(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              status: "passed",
              branch,
              repositoryId: fixture.repositoryId,
              commands,
              checks: [
                "actual UI create-and-switch",
                "same commit HEAD",
                "all resources and history preserved",
                "pending intent cleared",
                "native branch and local edit survive reload",
              ],
            },
            null,
            2,
          ),
        );
      },
    );
  },
);
} finally {
  if(ownedRepository&&await lstat(ownedRepository).then(()=>true,error=>{if(error.code!=="ENOENT")throw error;return false;})){
    const inventory=async(/** @type {string} */ root)=>{
      const rows=/** @type {Record<string,string>} */({});
      const visit=async(/** @type {string} */ path,relative="")=>{
        const info=await lstat(path);assert.ok(!info.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),resolve(path).toLowerCase());
        if(info.isDirectory()){rows[relative]="directory";for(const name of(await readdir(path)).sort())await visit(join(path,name),relative?relative+"/"+name:name);}
        else{assert.ok(info.isFile()&&info.size<=16*1024*1024);rows[relative]=createHash("sha256").update(await readFile(path)).digest("hex");}
      };await visit(root);return rows;
    };
    assert.ok(ownedRepository.startsWith(resolve(gitRoot)+sep));
    const target=resolve(archiveRoot,basename(ownedRepository));assert.ok(target.startsWith(resolve(archiveRoot)+sep));assert.equal(parse(target).root.toLowerCase(),parse(ownedRepository).root.toLowerCase());
    assert.equal(await lstat(target).then(()=>true,error=>{if(error.code!=="ENOENT")throw error;return false;}),false,"Never replace an existing archive");
    const before=await inventory(ownedRepository);await rename(ownedRepository,target);assert.deepEqual(await inventory(target),before,"Retain every owned Git fixture byte after the host exits");
    await writeFile(join(scenarioOutput,"owned-git-archive.json"),JSON.stringify({retained:true,source:ownedRepository,target,entries:Object.keys(before).length,files:before,hostExitAwaited:true},null,2));
  }
  if(!originalGitRoot)await rmdir(gitRoot).catch(error=>{if(error.code!=="ENOENT")throw error;});
}
}, { expectedIdentifier: integrationProbeIdentifier }));
