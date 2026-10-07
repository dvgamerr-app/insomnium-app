import { nativeGitBinding } from "./git-client.js";
import { normalizeFetchBranch } from "./git-remote-client.js";
import {
  readGitRemoteSettings,
  validateGitRemoteSettings,
} from "./git-remote-settings.js";
import { sameWorkspace } from "./git-workspace.js";

const copy = (/** @type {any} */ value) => JSON.parse(JSON.stringify(value));
const fullOid = (/** @type {any} */ value) =>
  typeof value === "string" &&
  /^[a-f0-9]{40}$/.test(value) &&
  !/^0+$/.test(value);

/** @param {Record<string,any>[]} resources @param {string} workspaceId */
export function pendingGitPush(resources, workspaceId) {
  const binding = nativeGitBinding(resources, workspaceId);
  const intent = binding?.nativePushIntent;
  if (!intent) return null;
  if (
    intent.version !== 1 ||
    intent.phase !== "submitted" ||
    intent.workspaceId !== workspaceId ||
    intent.bindingId !== binding._id ||
    intent.repositoryId !== binding.nativeRepositoryId ||
    intent.url !== binding.uri ||
    !fullOid(intent.sourceOid) ||
    !(intent.expectedRemoteOid === null || fullOid(intent.expectedRemoteOid)) ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(intent.operationId) ||
    !intent.sourceBranch ||
    normalizeFetchBranch(intent.sourceBranch) !== intent.sourceBranch ||
    !intent.destinationBranch ||
    normalizeFetchBranch(intent.destinationBranch) !== intent.destinationBranch
  )
    throw new Error("Saved Push operation is invalid. Keep it for inspection.");
  return copy(intent);
}

/** Private one-use reviews; only intent bookkeeping mutates live data.
 * No workspace drain, checkout, staging or implicit commit occurs here.
 * @param {{getData:()=>any,persist:()=>Promise<boolean>,invoke:(command:string,args:any)=>Promise<any>,
 * advertise:(input:any,scope:{signal:AbortSignal,current:()=>boolean})=>Promise<any>,
 * begin:()=>{signal:AbortSignal,cancel:()=>void,finish:()=>void}}} options */
export function createGitPush({ getData, persist, invoke, advertise, begin }) {
  const reviews = new WeakMap();
  const observations = new WeakMap();
  /** @template T @param {AbortSignal} signal @param {(signal:AbortSignal)=>Promise<T>} action */
  async function scoped(signal, action) {
    const work = begin();
    const cancel = () => work.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    try {
      return await action(work.signal);
    } finally {
      signal.removeEventListener("abort", cancel);
      work.finish();
    }
  }
  /** @param {string} workspaceId */
  function bindingFor(workspaceId) {
    const data = getData();
    const binding = nativeGitBinding(data.resources, workspaceId);
    if (
      data.activeWorkspaceId !== workspaceId ||
      !binding ||
      !data.resources.some(
        (/** @type {any} */ row) =>
          row._id === workspaceId &&
          row._type === "workspace" &&
          row.isPrivate !== true,
      )
    )
      throw new Error(
        "Open the active public collection's Git settings first.",
      );
    return binding;
  }
  /** @param {string} workspaceId @param {()=>any} getInput @param {string} destination @param {AbortSignal} signal */
  function review(workspaceId, getInput, destination, signal) {
    return scoped(signal, async (signal) => {
      const before = copy(getData());
      const binding = bindingFor(workspaceId);
      if (
        [
          "nativePushIntent",
          "nativeFetchIntent",
          "nativeCreateIntent",
          "nativeRemoteCheckoutIntent",
        ].some((key) => binding[key])
      )
        throw new Error(
          "Resolve the saved Git operation before reviewing Push.",
        );
      if (
        !destination ||
        normalizeFetchBranch(destination) !== destination ||
        new TextEncoder().encode("refs/heads/" + destination).length > 1024
      )
        throw new Error("Choose an exact remote branch for Push.");
      const remote = validateGitRemoteSettings(readGitRemoteSettings(binding));
      if (!sameWorkspace(validateGitRemoteSettings(getInput()), remote))
        throw new Error("Save remote settings before reviewing Push.");
      const current = () =>
        !signal.aborted &&
        sameWorkspace(getData(), before) &&
        sameWorkspace(validateGitRemoteSettings(getInput()), remote);
      if (!current()) throw new Error("Push review cancelled or changed.");
      const info = await invoke("git_repository_info", {
        repositoryId: binding.nativeRepositoryId,
      });
      if (!info.branch || !fullOid(info.headOid))
        throw new Error("Commit the local branch before Push.");
      const advertisement = await advertise(remote, { signal, current });
      if (!current())
        throw new Error(
          "Workspace changed while reviewing Push. Review again.",
        );
      const expectedRemoteOid =
        advertisement.branches.find(
          (/** @type {any} */ branch) => branch.name === destination,
        )?.oid || null;
      const intent = {
        version: 1,
        phase: "submitted",
        operationId: crypto.randomUUID(),
        workspaceId,
        repositoryId: binding.nativeRepositoryId,
        bindingId: binding._id,
        url: remote.url,
        sourceBranch: info.branch,
        sourceOid: info.headOid,
        destinationBranch: destination,
        expectedRemoteOid,
      };
      const shown = {
        workspaceId,
        sourceBranch: intent.sourceBranch,
        sourceOid: intent.sourceOid,
        destinationBranch: destination,
        url: intent.url,
        expectedRemoteOid,
        equal: expectedRemoteOid === intent.sourceOid,
      };
      reviews.set(shown, { before, intent });
      return shown;
    });
  }
  /** @param {any} value @param {any} intent */
  function checkedReceipt(value, intent) {
    if (
      !value ||
      value.version !== 1 ||
      !sameWorkspace(value.intent, intent) ||
      !["preparing", "submitted", "finished", "retired"].includes(
        value.phase,
      ) ||
      (value.phase !== "retired" &&
        (value.phase === "finished") !== !!value.result)
    )
      throw new Error(
        "Push receipt is unconfirmed. Inspect the saved operation.",
      );
    if (
      value.result &&
      (value.result.operationId !== intent.operationId ||
        value.result.sourceOid !== intent.sourceOid ||
        value.result.destinationBranch !== intent.destinationBranch ||
        ![
          "unchanged",
          "accepted",
          "rejected",
          "nonFastForward",
          "stale",
          "unknown",
        ].includes(value.result.outcome) ||
        !(
          value.result.advertisedRemoteOid === null ||
          fullOid(value.result.advertisedRemoteOid)
        ))
    )
      throw new Error(
        "Push result differs from its reviewed operation. Inspect before continuing.",
      );
    return value;
  }
  /** @param {string} command @param {any} args @param {string} jobId @param {AbortSignal} signal */
  async function remoteCall(command, args, jobId, signal) {
    const cancel = () => {
      void invoke("git_remote_cancel", { requestId: jobId }).catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) {
      cancel();
      throw new Error(
        "Push stopped before submission. Inspect the saved operation.",
      );
    }
    try {
      const value = await invoke(command, args);
      if (signal.aborted)
        throw new Error(
          "Push stopped; remote outcome may be unknown. Inspect the saved operation.",
        );
      return value;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  }
  /** @param {object} shown @param {AbortSignal} signal */
  function confirm(shown, signal) {
    const saved = reviews.get(shown);
    reviews.delete(shown);
    if (!saved)
      return Promise.reject(new Error("Push review expired. Review again."));
    return scoped(signal, async (signal) => {
      if (signal.aborted || !sameWorkspace(getData(), saved.before))
        throw new Error("Workspace changed since Push review.");
      const binding = bindingFor(saved.intent.workspaceId);
      binding.nativePushIntent = copy(saved.intent);
      const expectedBinding = copy(binding);
      // Save the current live snapshot through the queue; never apply an old
      // complete review snapshot after asynchronous work/history completion.
      if (!(await persist()))
        throw new Error(
          "Push intent could not be saved. No Push was submitted; save and Inspect before continuing.",
        );
      if (!sameWorkspace(bindingFor(saved.intent.workspaceId), expectedBinding))
        throw new Error(
          "Git binding changed before Push. Inspect the saved operation.",
        );
      try {
        const receipt = checkedReceipt(
          await remoteCall(
            "git_remote_push",
            { request: { intent: saved.intent, expectedBinding } },
            saved.intent.operationId,
            signal,
          ),
          saved.intent,
        );
        // Keep the exact submitted intent until a separate observed-state review.
        // No automatic resubmission or stale full-data replacement follows a reply.
        return { operationId: saved.intent.operationId, receipt };
      } catch (cause) {
        throw Object.assign(
          new Error(
            String(cause) +
              " Operation: " +
              saved.intent.operationId +
              ". Inspect pending Push; do not resend this operation.",
          ),
          { operationId: saved.intent.operationId },
        );
      }
    });
  }
  /** @param {string} workspaceId @param {AbortSignal} signal */
  function inspect(workspaceId, signal) {
    return scoped(signal, async (signal) => {
      const binding = bindingFor(workspaceId);
      const expectedBinding = copy(binding);
      const intent = pendingGitPush(getData().resources, workspaceId);
      if (!intent) throw new Error("No saved Push to inspect.");
      const attemptId = crypto.randomUUID();
      const value = await remoteCall(
        "git_remote_push_inspect",
        { request: { push: { intent, expectedBinding }, attemptId } },
        attemptId,
        signal,
      );
      if (!sameWorkspace(bindingFor(workspaceId), expectedBinding))
        throw new Error("Git binding changed during Push inspection.");
      if (
        value?.operationId !== intent.operationId ||
        !(
          value.observedRemoteOid === null || fullOid(value.observedRemoteOid)
        ) ||
        value.matchesPinnedCommit !==
          (value.observedRemoteOid === intent.sourceOid)
      )
        throw new Error("Invalid Push observation; keep the saved operation.");
      if (value.receipt !== null) checkedReceipt(value.receipt, intent);
      const shown = {
        workspaceId,
        operationId: intent.operationId,
        url: intent.url,
        destinationBranch: intent.destinationBranch,
        sourceOid: intent.sourceOid,
        observedRemoteOid: value.observedRemoteOid,
        matchesPinnedCommit: value.matchesPinnedCommit,
        outcome: value.receipt?.result?.outcome || "unknown",
      };
      observations.set(shown, {
        expectedBinding,
        intent,
        receipt: copy(value.receipt),
      });
      return shown;
    });
  }
  /** Retire the reviewed native operation before clearing exact local tracking.
   * @param {object} shown @param {AbortSignal} signal */
  function forget(shown, signal) {
    const saved = observations.get(shown);
    observations.delete(shown);
    if (!saved)
      return Promise.reject(
        new Error("Push observation review expired. Inspect again."),
      );
    return scoped(signal, async (signal) => {
      if (signal.aborted) throw new Error("Push tracking review cancelled.");
      const binding = bindingFor(saved.intent.workspaceId);
      if (!sameWorkspace(binding, saved.expectedBinding))
        throw new Error("Git binding changed since Push inspection.");
      const attemptId = crypto.randomUUID();
      const receipt = checkedReceipt(
        await remoteCall(
          "git_remote_push_retire",
          {
            request: {
              push: {
                intent: saved.intent,
                expectedBinding: saved.expectedBinding,
              },
              attemptId,
              expectedReceipt: saved.receipt,
            },
          },
          attemptId,
          signal,
        ),
        saved.intent,
      );
      if (
        receipt.phase !== "retired" ||
        receipt.stageName !== null ||
        receipt.stageMarker !== null
      )
        throw new Error(
          "Push cleanup is unconfirmed. Keep tracking and Inspect again.",
        );
      if (
        !sameWorkspace(
          bindingFor(saved.intent.workspaceId),
          saved.expectedBinding,
        )
      )
        throw new Error(
          "Git binding changed during Push cleanup. Inspect again.",
        );
      delete binding.nativePushIntent;
      if (!(await persist())) {
        if (!binding.nativePushIntent)
          binding.nativePushIntent = copy(saved.intent);
        throw new Error(
          "Push tracking could not be cleared. Save and Inspect again.",
        );
      }
    });
  }
  return {
    review,
    confirm,
    inspect,
    forget,
    cancel: (/** @type {object} */ shown) => reviews.delete(shown),
    cancelObservation: (/** @type {object} */ shown) =>
      observations.delete(shown),
  };
}
