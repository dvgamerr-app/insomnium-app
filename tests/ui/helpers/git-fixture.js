import { snapshotGitCollection } from "../../../src/lib/git-collection.js";
import { initialData } from "../../../src/lib/model.js";

/** Adds a uniquely owned collection to isolated probe data; retains older fixtures. */
/** @param {{page:import("playwright-core").Page,invoke:import("./native-app.js").NativeInvoke}} context */
export async function gitCollection({ page, invoke }) {
  const suffix = Date.now() + "_" + crypto.randomUUID().slice(0, 8);
  const workspaceId = "wrk_pw_" + suffix,
    repositoryId = "git_pw_" + suffix;
  const requestId = "req_pw_" + suffix,
    environmentId = "env_pw_" + suffix;
  const data = (await invoke("load_workspace")) || initialData();
  const author = {
    name: "Playwright Probe",
    email: "playwright@example.invalid",
  };
  data.resources.push(
    {
      _id: workspaceId,
      _type: "workspace",
      parentId: null,
      name: "Playwright " + suffix,
      scope: "collection",
    },
    {
      _id: environmentId,
      _type: "environment",
      parentId: workspaceId,
      name: "Base Environment",
      data: {},
    },
    {
      _id: requestId,
      _type: "request",
      parentId: workspaceId,
      name: "Preserved local request",
      method: "GET",
      url: "https://example.invalid/baseline",
      headers: [],
      parameters: [],
      authentication: {},
      body: { mimeType: "", text: "", params: [] },
      description: "",
      created: Date.now(),
      modified: Date.now(),
    },
    {
      _id: repositoryId,
      _type: "git_repository",
      parentId: workspaceId,
      nativeBindingVersion: 1,
      nativeRepositoryId: repositoryId,
      author,
    },
  );
  data.resources.push({
    _id: "wrkm_pw_" + suffix,
    _type: "workspace_meta",
    parentId: workspaceId,
    activeEnvironmentId: environmentId,
    created: Date.now(),
    modified: Date.now(),
  });
  data.activeWorkspaceId = workspaceId;
  data.activeRequestId = requestId;
  data.activeEnvironmentId = environmentId;
  data.openTabs = [requestId];
  await invoke("save_workspace", { data });
  await invoke("git_repository_init", { repositoryId });
  const snapshot = snapshotGitCollection(data.resources, workspaceId);
  const oid = await invoke("git_repository_commit", {
    repositoryId,
    input: {
      branch: "main",
      expectedHeadOid: null,
      workspaceId,
      files: snapshot.files,
      authorName: author.name,
      authorEmail: author.email,
      message: "Playwright source fixture",
    },
  });
  data.resources.find((/** @type {any} */ r) => r._id === requestId).url =
    "https://example.invalid/local-edit";
  await invoke("save_workspace", { data });
  await page.reload();
  await page.getByRole("button", { name: "Git", exact: true }).waitFor();
  await page.waitForFunction(
    (id) =>
      /** @type {HTMLSelectElement|null} */ (
        document.querySelector('[aria-label="Collection"]')
      )?.value === id,
    workspaceId,
    { timeout: 60000 },
  );
  return { workspaceId, repositoryId, requestId, author, oid, data };
}

/** @param {{fixture:Awaited<ReturnType<typeof gitCollection>>,invoke:import("./native-app.js").NativeInvoke}} context */
export async function seedCreateIntent({ fixture, invoke }) {
  const data = await invoke("load_workspace");
  const intent = {
    version: 1,
    phase: "submitted",
    operationId: "pw_" + crypto.randomUUID().replaceAll("-", ""),
    workspaceId: fixture.workspaceId,
    bindingId: fixture.repositoryId,
    repositoryId: fixture.repositoryId,
    name: "feature/resume-" + Date.now(),
    sourceBranch: "main",
    sourceOid: fixture.oid,
    author: fixture.author,
  };
  data.resources.find(
    (/** @type {any} */ r) => r._id === fixture.repositoryId,
  ).nativeCreateIntent = intent;
  await invoke("save_workspace", { data });
  return intent;
}
