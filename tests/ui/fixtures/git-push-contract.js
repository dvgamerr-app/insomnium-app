import { createGitPush } from "../../../src/lib/git-push.js";
import { sameWorkspace } from "../../../src/lib/git-workspace.js";

const button = document.createElement("button");
button.textContent = "Run Push contracts";
const evidence = document.createElement("pre");
evidence.setAttribute("aria-label", "Push contract evidence");
document.body.append(button, evidence);
/** @param {boolean} condition @param {string} message */
function check(condition, message) {
  if (!condition) throw new Error(message);
}
/** @param {()=>Promise<any>} action @param {RegExp} expected */
async function rejects(action, expected) {
  let error = "";
  try {
    await action();
  } catch (cause) {
    error = String(cause);
  }
  check(expected.test(error), "Unexpected refusal: " + error);
}
const clone = (/** @type {any} */ value) => JSON.parse(JSON.stringify(value));
/** Deterministic adapters around the production coordinator, not native proof. */
function fixture() {
  const workspaceId = "wrk_push_contract",
    repositoryId = "git_push_contract";
  const oid = "a".repeat(40);
  const remote = {
    url: "https://example.invalid/owned.git",
    credentials: { kind: "anonymous" },
  };
  let data = /** @type {any} */ ({
    activeWorkspaceId: workspaceId,
    activeRequestId: "req_push",
    openTabs: ["req_push"],
    settings: { theme: "dark" },
    history: [{ id: "old-history" }],
    resources: [
      {
        _id: workspaceId,
        _type: "workspace",
        scope: "collection",
        parentId: null,
        name: "Push contract",
      },
      {
        _id: repositoryId,
        _type: "git_repository",
        nativeBindingVersion: 1,
        nativeRepositoryId: repositoryId,
        parentId: workspaceId,
        uri: remote.url,
        credentials: null,
      },
      {
        _id: "req_push",
        _type: "request",
        parentId: workspaceId,
        name: "Working edit",
        url: "https://example.invalid/local",
      },
      {
        _id: "req_private",
        _type: "request",
        parentId: workspaceId,
        isPrivate: true,
        name: "Private",
      },
      {
        _id: "wrk_foreign",
        _type: "workspace",
        scope: "collection",
        parentId: null,
        name: "Foreign",
      },
    ],
  });
  let durable = clone(data);
  /** @type {any} */ let receipt = null;
  const hooks = /** @type {Record<string,(args:any)=>void>} */ ({});
  /** @type {string[]} */ const calls = [];
  let active = 0;
  let saves = 0;
  let saveOkay = true;
  let input = clone(remote);
  const coordinator = createGitPush({
    getData: () => data,
    persist: async () => {
      calls.push("save");
      saves++;
      hooks.save?.(saves);
      if (saveOkay) durable = clone(data);
      return saveOkay;
    },
    begin: () => {
      const controller = new AbortController();
      active++;
      return {
        signal: controller.signal,
        cancel: () => controller.abort(),
        finish: () => {
          active--;
        },
      };
    },
    advertise: async (_input, scope) => {
      calls.push("advertise");
      hooks.advertise?.(scope);
      return { branches: [{ name: "main", oid: "b".repeat(40) }] };
    },
    invoke: async (command, args) => {
      calls.push(command);
      hooks[command]?.(args);
      if (command === "git_repository_info")
        return { branch: "main", headOid: oid };
      if (command === "git_remote_cancel") return;
      if (command === "git_remote_push") {
        receipt = {
          version: 1,
          intent: clone(args.request.intent),
          phase: "finished",
          stageName: "fetch-" + crypto.randomUUID(),
          stageMarker: "owned fixture marker",
          result: {
            operationId: args.request.intent.operationId,
            sourceOid: oid,
            destinationBranch: "main",
            outcome: "accepted",
            advertisedRemoteOid: "b".repeat(40),
          },
        };
        return clone(receipt);
      }
      if (command === "git_remote_push_inspect")
        return {
          operationId: args.request.push.intent.operationId,
          observedRemoteOid: oid,
          matchesPinnedCommit: true,
          receipt: clone(receipt),
        };
      if (command === "git_remote_push_retire") {
        check(
          sameWorkspace(args.request.expectedReceipt, receipt),
          "Retirement did not pin inspected receipt",
        );
        receipt = {
          ...receipt,
          phase: "retired",
          stageName: null,
          stageMarker: null,
        };
        return clone(receipt);
      }
      throw new Error("Unexpected command " + command);
    },
  });
  const signal = () => new AbortController().signal;
  const binding = () =>
    data.resources.find((/** @type {any} */ row) => row._id === repositoryId);
  return {
    coordinator,
    hooks,
    calls,
    binding,
    workspaceId,
    signal,
    data: () => data,
    durable: () => durable,
    active: () => active,
    replace: () => {
      data = clone(data);
    },
    setInput: (/** @type {any} */ value) => {
      input = value;
    },
    saveRefusal: () => {
      saveOkay = false;
    },
    review: () =>
      coordinator.review(workspaceId, () => input, "main", signal()),
    inspect: () => coordinator.inspect(workspaceId, signal()),
    submit: async () => {
      const review = await coordinator.review(
        workspaceId,
        () => input,
        "main",
        signal(),
      );
      return coordinator.confirm(review, signal());
    },
  };
}
button.onclick = async () => {
  button.disabled = true;
  /** @type {string[]} */ const checks = [];
  try {
    let x = fixture(),
      review = await x.review();
    await rejects(
      () => x.coordinator.confirm(clone(review), x.signal()),
      /review expired/i,
    );
    x.coordinator.cancel(review);
    await rejects(
      () => x.coordinator.confirm(review, x.signal()),
      /review expired/i,
    );
    check(
      !x.calls.includes("save") &&
        !x.calls.includes("git_remote_push") &&
        x.active() === 0,
      "Forged/cancelled review submitted",
    );
    checks.push(
      "private review identity/cancellation refuse without save/upload and release tracked work",
    );

    for (const mutate of [
      (/** @type {any} */ f) => {
        f.data().resources[2].url += "/edited";
      },
      (/** @type {any} */ f) => {
        f.data().resources[3].name = "Private changed";
      },
      (/** @type {any} */ f) => {
        f.data().resources[4].name = "Foreign changed";
      },
      (/** @type {any} */ f) => {
        f.data().history.push({ id: "new" });
      },
      (/** @type {any} */ f) => {
        f.data().settings.theme = "light";
      },
      (/** @type {any} */ f) => {
        f.binding().name = "Binding changed";
      },
      (/** @type {any} */ f) => {
        f.data().activeWorkspaceId = "wrk_foreign";
      },
    ]) {
      x = fixture();
      review = await x.review();
      mutate(x);
      const before = clone(x.data());
      await rejects(
        () => x.coordinator.confirm(review, x.signal()),
        /Workspace changed since Push review/,
      );
      await rejects(
        () => x.coordinator.confirm(review, x.signal()),
        /review expired/i,
      );
      check(
        sameWorkspace(before, x.data()) &&
          !x.calls.includes("save") &&
          !x.calls.includes("git_remote_push"),
        "Stale review rewrote state",
      );
    }
    checks.push(
      "full current public/private/foreign/history/settings/binding/selection guard consumes stale reviews without mutation",
    );

    x = fixture();
    x.hooks.advertise = () => {
      x.data().history.push({ id: "during-advertisement" });
    };
    await rejects(() => x.review(), /Workspace changed while reviewing/);
    x = fixture();
    x.setInput({
      url: "https://example.invalid/other.git",
      credentials: { kind: "anonymous" },
    });
    await rejects(() => x.review(), /Save remote settings/);
    check(
      !x.calls.includes("save") && !x.calls.includes("git_repository_info"),
      "Unsaved endpoint reached native info",
    );
    checks.push(
      "advertisement-time full-state changes and unsaved remote settings invalidate review before persistence/upload",
    );

    x = fixture();
    x.saveRefusal();
    await rejects(() => x.submit(), /intent could not be saved/);
    check(
      !!x.binding().nativePushIntent &&
        !x.calls.includes("git_remote_push") &&
        x.active() === 0,
      "Refused intent save dispatched Push",
    );
    x = fixture();
    x.hooks.save = () => {
      x.binding().name = "Changed during admission save";
    };
    await rejects(() => x.submit(), /binding changed before Push/i);
    check(
      !x.calls.includes("git_remote_push"),
      "Changed saved binding dispatched Push",
    );
    checks.push(
      "intent-save refusal and binding change during queued admission prevent native submission",
    );

    x = fixture();
    x.hooks.git_remote_push = () => {
      x.replace();
      x.data().history.push({ id: "during-push" });
      x.data().resources[3].name = "Retained private edit";
    };
    await x.submit();
    check(
      x.data().history.length === 2 &&
        x.data().resources[3].name === "Retained private edit" &&
        !!x.binding().nativePushIntent,
      "Push completion applied stale full state",
    );
    check(
      x.calls.filter((c) => c === "save").length === 1 &&
        x.calls.filter((c) => c === "git_remote_push").length === 1,
      "Completion automatically saved/resubmitted",
    );
    checks.push(
      "confirmed reply preserves newer whole-state replacement/history/private edits and exact pending intent without stale save",
    );

    x = fixture();
    await x.submit();
    let observation = await x.inspect();
    await rejects(
      () => x.coordinator.forget(clone(observation), x.signal()),
      /review expired/i,
    );
    x.coordinator.cancelObservation(observation);
    await rejects(
      () => x.coordinator.forget(observation, x.signal()),
      /review expired/i,
    );
    observation = await x.inspect();
    x.binding().name = "Changed since observation";
    await rejects(
      () => x.coordinator.forget(observation, x.signal()),
      /binding changed since Push inspection/i,
    );
    check(
      !x.calls.includes("git_remote_push_retire"),
      "Forged/stale observation retired",
    );
    checks.push(
      "private observation identity/cancellation and changed binding refuse retirement without clearing tracking",
    );

    x = fixture();
    await x.submit();
    x.hooks.git_remote_push_inspect = () => {
      x.binding().name = "Changed while inspecting";
    };
    await rejects(() => x.inspect(), /binding changed during Push inspection/i);
    check(
      !!x.binding().nativePushIntent &&
        x.calls.filter((c) => c === "git_remote_push").length === 1,
      "Inspection change resent/lost intent",
    );
    checks.push(
      "binding change during independent inspection refuses review and preserves operation without upload",
    );

    x = fixture();
    await x.submit();
    observation = await x.inspect();
    x.hooks.git_remote_push_retire = () => {
      x.binding().name = "Changed during cleanup";
    };
    await rejects(
      () => x.coordinator.forget(observation, x.signal()),
      /binding changed during Push cleanup/i,
    );
    check(
      !!x.binding().nativePushIntent &&
        x.calls.filter((c) => c === "save").length === 1,
      "Changed cleanup binding cleared/saved tracking",
    );
    checks.push(
      "binding change during native retirement preserves current intent and requires fresh review",
    );

    x = fixture();
    await x.submit();
    observation = await x.inspect();
    x.hooks.git_remote_push_retire = () => {
      x.replace();
      x.data().history.push({ id: "during-cleanup" });
      x.data().resources[3].name = "Latest private";
    };
    await x.coordinator.forget(observation, x.signal());
    check(
      !x.binding().nativePushIntent,
      "Equal binding object replaced during cleanup left live intent uncleared",
    );
    check(
      x.data().history.length === 2 &&
        x.data().resources[3].name === "Latest private" &&
        sameWorkspace(x.data(), x.durable()),
      "Cleanup overwrote latest full state",
    );
    checks.push(
      "equal binding object replacement during retirement clears only current live intent and saves latest full data",
    );

    x = fixture();
    await x.submit();
    observation = await x.inspect();
    const originalIntent = clone(x.binding().nativePushIntent);
    x.hooks.save = () => {
      x.replace();
      x.data().history.push({ id: "during-refused-save" });
    };
    x.saveRefusal();
    await rejects(
      () => x.coordinator.forget(observation, x.signal()),
      /tracking could not be cleared/,
    );
    check(
      sameWorkspace(x.binding().nativePushIntent, originalIntent) &&
        x.data().history.length === 2,
      "Refused save failed to restore exact intent on current replacement",
    );
    checks.push(
      "failed tracking save restores exact intent on current equal binding replacement while preserving later edits",
    );

    x = fixture();
    await x.submit();
    observation = await x.inspect();
    const nextIntent = {
      ...clone(x.binding().nativePushIntent),
      operationId: crypto.randomUUID(),
    };
    x.hooks.save = () => {
      x.replace();
      x.binding().nativePushIntent = clone(nextIntent);
    };
    x.saveRefusal();
    await rejects(
      () => x.coordinator.forget(observation, x.signal()),
      /tracking could not be cleared/,
    );
    check(
      sameWorkspace(x.binding().nativePushIntent, nextIntent),
      "Failed save overwrote newer operation",
    );
    check(
      x.active() === 0 &&
        x.calls.filter((c) => c === "git_remote_push").length === 1,
      "Work leak or automatic resend",
    );
    checks.push(
      "failed save never replaces newer live operation and releases tracked work without resubmission",
    );
    x = fixture();
    await x.submit();
    observation = await x.inspect();
    x.hooks.save = () => {
      x.replace();
      x.binding().uri = "https://example.invalid/new-binding.git";
    };
    x.saveRefusal();
    await rejects(
      () => x.coordinator.forget(observation, x.signal()),
      /tracking could not be cleared/,
    );
    check(
      x.binding().uri === "https://example.invalid/new-binding.git" &&
        !x.binding().nativePushIntent,
      "Failed save attached old intent to a changed current endpoint",
    );
    check(
      !!x
        .durable()
        .resources.find(
          (/** @type {any} */ row) => row._type === "git_repository",
        ).nativePushIntent,
      "Failed save rewrote durable pending operation",
    );
    checks.push(
      "failed save never adopts changed endpoint/current binding; durable original pending state remains authoritative",
    );
    evidence.textContent = JSON.stringify({
      passed: true,
      checks,
      scope:
        "Production frontend coordinator in headless browser with controlled adapters/state replacement; not real native IPC or mounted App acceptance.",
    });
  } catch (error) {
    evidence.textContent = JSON.stringify({
      passed: false,
      checks,
      error: String(error),
    });
  }
};
