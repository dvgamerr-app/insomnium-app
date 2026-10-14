import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { nativeErrorTree } from "./native-error.js";
import { observeHost } from "./native-process-observer.js";
import {
  namespaceRead,
  namespaceHash,
  namespaceSave,
  namespaceHosts,
  namespaceProcessTable,
  auditNamespaceProcesses,
} from "./namespace-process-evidence.js";
import {
  captureNamespaceProfile,
  assertNamespaceBaseline,
  namespaceBaselineSha256,
  preserverProtected,
  fixtureOwnership,
  normalizeNamespaceProtected,
} from "./namespace-profile-audit.js";
import {
  auditOriginal,
  auditFields,
  auditHistory,
} from "./namespace-case-audit.js";
import { auditNamespaceLayout } from "./namespace-layout-audit.js";
import {
  namespaceBuildEnvironment,
  verifyNativeBuildClosure,
} from "./native-build-closure.js";

/** @param {string} path */
const json = async (path) => JSON.parse((await namespaceRead(path)).toString());
const restorationDirectories = async () =>
  (await readdir(resolve("artifacts/playwright")))
    .filter((name) => /^resource-manager-restoration-\d+$/.test(name))
    .sort();
/** @param {any} state @param {any} before */
export async function namespaceCurrentClosure(state, before) {
  Object.assign(process.env, namespaceBuildEnvironment());
  process.env.INSOMNIUM_NAMESPACE_BUILD_ARGS = JSON.stringify(state.actualArgs);
  await verifyNativeBuildClosure(before, resolve(state.artifact, ".."));
}
/** @param {any} binding @param {any} before @param {any} physical */
async function physicalAudit(binding, before, physical) {
  const context = await json(join(binding.operatorOutput, "context.json"));
  assert.equal(context.profile, binding.profile);
  assert.equal(context.pid, physical.pid);
  const first = await json(
      join(context.output, "namespace-process-before-first-save.json"),
    ),
    closing = await json(
      join(context.output, "namespace-process-before-close.json"),
    ),
    bridge = await json(
      join(binding.operatorOutput, "bridge-before-close.json"),
    );
  assert.equal(bridge.capturedBeforeOriginalNativeHelperClose, true);
  assert.deepEqual(bridge.host, closing.host);
  const observer = resolve("tests/ui/helpers/native-process-observer.js");
  assert.equal(
    physical.observerSourceSHA256,
    namespaceHash(await readFile(observer)),
  );
  const original = await json(
    join(binding.operatorOutput, "original-workspace.json"),
  );
  assert.deepEqual(original, before.workspace);
  const required = [
    ...context.descendants,
    ...bridge.descendants,
    ...physical.attempts
      .filter(
        (/** @type {any} */ row) => row.accepted && row.pid !== physical.pid,
      )
      .map((/** @type {any} */ row) => row.cimSnapshot),
  ];
  return auditNamespaceProcesses(first, closing, physical, required, binding);
}
/** @param {any} binding @param {any} before @param {any} physical @param {number} exitCode @param {string} restorationName */
async function independentAudit(
  binding,
  before,
  physical,
  exitCode,
  restorationName,
) {
  assert.equal(exitCode, 0);
  const processResult = await physicalAudit(binding, before, physical),
    context = await json(join(binding.operatorOutput, "context.json")),
    output = context.output;
  const run = await json(join(output, "result.json"));
  assert.equal(run.pid, context.pid);
  assert.equal(run.status, "passed");
  assert.equal(run.exit.code, 0);
  assert.equal(run.exit.signal, null);
  assert.equal(run.renderingMode, "native-hidden");
  assert.equal(run.hiddenWindow.visible, false);
  assert.equal(run.hiddenWindow.pid, context.pid);
  assert.equal(run.intentionalParentTermination, false);
  assert.equal(run.nativeCloseRequested, false);
  const old = await json(join(output, "namespace-acceptance.json")),
    fields = await json(join(output, "namespace-native-field-acceptance.json"));
  const originalResult = auditOriginal(old),
    fieldResult = auditFields(fields),
    historyResult = auditHistory(
      await json(join(output, "namespace-history-policy-before.json")),
      await json(join(output, "namespace-history-policy-after.json")),
    ),
    layoutResult = auditNamespaceLayout(
      await json(join(output, "xml-layout-restoration.json")),
    );
  const restoration = resolve("artifacts/playwright", restorationName),
    rBefore = await json(join(restoration, "before.json")),
    r = await json(join(restoration, "result.json"));
  assert.equal(rBefore.root, binding.profile);
  assert.equal(r.root, binding.profile);
  assert.equal(r.passed, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(preserverProtected(rBefore), before.protectedBefore);
  assert.deepEqual(r.buffers, rBefore.buffers);
  assert.deepEqual(r.immutable, rBefore.immutable);
  for (const name of ["workspace-v1.json", "workspace-v1.previous.json"]) {
    const archived = await namespaceRead(
        join(binding.operatorOutput, "changed-" + name),
      ),
      receipt = await json(
        join(binding.operatorOutput, "changed-" + name + ".receipt.json"),
      );
    assert.equal(receipt.pid, context.pid);
    assert.equal(receipt.readBeforeOriginalNativeHelperClose, true);
    assert.equal(receipt.sha256, namespaceHash(archived));
    assert.equal(receipt.bytes, archived.length);
    assert.equal(
      namespaceHash(await namespaceRead(join(restoration, "changed-" + name))),
      receipt.sha256,
      "No unobserved late save before restore",
    );
  }
  const changed = await json(
    join(binding.operatorOutput, "changed-workspace-v1.json"),
  );
  const fixture = fixtureOwnership(
    before.workspace,
    changed,
    r.registered,
    old.checks.find(
      (/** @type {any} */ row) => row.kind === "request-isolation",
    ),
    Date.parse(run.finishedAt),
  );
  for (const item of r.cleanup) {
    assert.equal(item.collectionId, fixture.workspaceId);
    assert.equal(item.collectionName, r.registered[0][1]);
    assert.ok(
      new RegExp(
        "^cookies/" + fixture.workspaceId + "(?:\\.previous)?\\.json$",
      ).test(item.name),
    );
    const bytes = await namespaceRead(
      join(restoration, "owned-" + item.name.slice(8)),
    );
    assert.equal(namespaceHash(bytes), item.sha256);
    assert.deepEqual(JSON.parse(bytes.toString()), []);
  }
  assert.equal(
    r.cleanup.length,
    new Set(r.cleanup.map((/** @type {any} */ row) => row.name)).size,
  );
  return {
    passed: true,
    completeCaseMap: true,
    original: originalResult,
    fields: fieldResult,
    history: historyResult,
    layout: layoutResult,
    fixture,
    physical: processResult,
    protectedMapping: normalizeNamespaceProtected(before.protectedBefore)
      .mapping,
    fullGitFiles: Object.keys(before.gitBefore).length,
    settingsExactlyRestored: true,
    profileClaimHeld: true,
    profileReleased: false,
    allRecordedChildrenRequired: true,
  };
}
/** Current original-profile operator. The leaf uses the saved scenario unchanged
 * apart from explicit observation hooks and preservation evidence.
 * @param {any} state @param {any} ledger @param {string} buildState @param {any} prepared */
export async function runNamespaceOperator(
  state,
  ledger,
  buildState,
  prepared,
) {
  assert.ok(
    prepared,
    "Original profile/claim must be recorded before runtime imports",
  );
  const { binding, bindingPath, bindingSHA256, before, claim } = prepared,
    operatorOutput = binding.operatorOutput;
  assert.equal(claim.owner, "/root");
  assert.equal(claim.runnerPid, process.pid);
  assert.equal(claim.terminal, false);
  assert.equal(claim.bindingSHA256, bindingSHA256);
  assert.equal(claim.exeSHA256, state.app.sha256);
  assert.equal(binding.buildState, resolve(buildState));
  const directoriesBefore = await restorationDirectories();
  await namespaceSave(
    join(operatorOutput, "restoration-directories-before.json"),
    directoriesBefore,
  );
  let child = /** @type {ReturnType<typeof Bun.spawn>|undefined} */ (undefined),
    exitCode = /** @type {number|undefined} */ (undefined),
    physical = /** @type {any} */ (undefined);
  const failures = /** @type {unknown[]} */ ([]);
  try {
    await namespaceCurrentClosure(state, ledger);
    assert.deepEqual(namespaceHosts(), []);
    await assertNamespaceBaseline(before, binding.baseline);
    child = Bun.spawn(
      [
        process.execPath,
        resolve("tests/ui/namespace-operator.js"),
        "--leaf",
        buildState,
        bindingPath,
        bindingSHA256,
      ],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
          INSOMNIUM_NAMESPACE_OPERATOR_BINDING: bindingPath,
          INSOMNIUM_NAMESPACE_OPERATOR_BINDING_SHA256: bindingSHA256,
          INSOMNIUM_UI_BUILD_STATE: binding.buildState,
          INSOMNIUM_UI_PROBE_IDENTIFIER: binding.identifier,
          INSOMNIUM_XML_RESPONSE_NAMESPACES: "1",
        },
        stdout: Bun.file(join(operatorOutput, "stdout.log")),
        stderr: Bun.file(join(operatorOutput, "stderr.log")),
        stdin: "ignore",
        windowsHide: true,
      },
    );
    await namespaceSave(join(operatorOutput, "running.json"), {
      pid: child.pid,
      started: Date.now(),
    });
    const observed = observeHost({
      child,
      hostObservation: namespaceHosts,
      processObservation: namespaceProcessTable,
      exe: binding.artifact,
      exeSHA256: binding.exeSHA256,
      output: operatorOutput,
    });
    [exitCode, physical] = await Promise.all([child.exited, observed]);
    assert.equal(exitCode, 0);
    assert.equal(physical.error, undefined);
  } catch (error) {
    failures.push(error);
  } finally {
    if (child && exitCode === undefined) exitCode = await child.exited;
    await namespaceSave(join(operatorOutput, "run-result.json"), {
      pid: child?.pid,
      exitCode,
      terminal: !child || exitCode !== undefined,
      scenarioStarted: !!child,
      physical,
      failures: failures.map(nativeErrorTree),
      profileClaimHeld: true,
      profileReleased: false,
    });
    for (const action of [
      async () => {
        assert.deepEqual(namespaceHosts(), []);
        await namespaceCurrentClosure(state, ledger);
      },
      async () => {
        const after = await captureNamespaceProfile(binding);
        await namespaceSave(
          join(operatorOutput, "filesystem-after.json"),
          after,
        );
        await assertNamespaceBaseline(after, binding.baseline);
        assert.deepEqual(after.workspace, before.workspace);
        assert.deepEqual(after.topLevel, before.topLevel);
      },
      async () => {
        const directoriesAfter = await restorationDirectories(),
          added = directoriesAfter.filter(
            (name) => !directoriesBefore.includes(name),
          );
        await namespaceSave(
          join(operatorOutput, "restoration-directories-after.json"),
          { directoriesAfter, added },
        );
        assert.equal(added.length, 1, "ONE original resource preserver");
        const audit = await independentAudit(
          binding,
          before,
          physical,
          /** @type {number} */ (exitCode),
          added[0],
        );
        assert.equal(
          failures.length,
          0,
          "Scenario failure cannot be masked by audits",
        );
        await namespaceSave(
          join(operatorOutput, "independent-audit.json"),
          audit,
        );
      },
    ])
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    Object.assign(claim, {
      terminal: !child || exitCode !== undefined,
      finished: Date.now(),
      failures: failures.map(nativeErrorTree),
      independentAuditPending: failures.length !== 0,
    });
    await Bun.write(
      join(operatorOutput, "claim.json"),
      JSON.stringify(claim, null, 2),
    );
  }
  console.log(
    JSON.stringify({
      operatorOutput,
      exitCode,
      profileClaimHeld: true,
      profileReleased: false,
      explicitSeparateReleaseRequired: true,
    }),
  );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Namespace operator failures retained; claim held",
      { cause: failures[0] },
    );
}
/** Explicit separate actor; failed runs permit cleanup release only, never case acceptance.
 * @param {any} state @param {any} ledger @param {string} bindingPath @param {boolean} cleanupOnly @param {string} expectedBindingHash */
export async function releaseNamespaceProfile(
  state,
  ledger,
  bindingPath,
  cleanupOnly,
  expectedBindingHash,
) {
  await namespaceCurrentClosure(state, ledger);
  assert.deepEqual(namespaceHosts(), []);
  const binding = await json(bindingPath),
    claim = await json(join(binding.operatorOutput, "claim.json")),
    run = await json(join(binding.operatorOutput, "run-result.json")),
    before = await json(join(binding.operatorOutput, "filesystem-before.json"));
  assert.equal(claim.held, true);
  assert.match(expectedBindingHash,/^[a-f0-9]{64}$/);
  assert.equal(namespaceHash(await namespaceRead(bindingPath)),expectedBindingHash);
  assert.equal(claim.bindingSHA256,expectedBindingHash);
  assert.equal(claim.terminal, true);
  assert.equal(claim.owner, "/root");
  assert.equal(claim.exeSHA256, state.app.sha256);
  assert.equal(claim.baselineSHA256, namespaceBaselineSha256);
  assert.equal(binding.identifier, state.identifier);
  assert.equal(
    binding.buildState,
    join(resolve(state.artifact, ".."), "build-state.json"),
  );
  assert.equal(run.terminal, true);
  assert.equal(
    claim.bindingSHA256,
    namespaceHash(await namespaceRead(bindingPath)),
  );
  assert.equal(binding.exeSHA256, state.app.sha256);
  if (cleanupOnly) {
    assert.ok(claim.failures.length > 0);
  } else {
    assert.deepEqual(claim.failures, []);
    assert.equal(run.exitCode, 0);
    const audit = await json(
      join(binding.operatorOutput, "independent-audit.json"),
    );
    assert.equal(audit.passed, true);
    assert.equal(audit.completeCaseMap, true);
    assert.equal(audit.allRecordedChildrenRequired, true);
  }
  let physical;
  if (cleanupOnly && run.scenarioStarted === false) {
    assert.equal(run.pid, undefined);
    assert.equal(run.physical, undefined);
    physical = {
      nativeLaunchOccurred: false,
      scenarioChildStarted: false,
      requiredChildren: 0,
    };
  } else physical = await physicalAudit(binding, before, run.physical);
  const after = await captureNamespaceProfile(binding);
  await assertNamespaceBaseline(after, binding.baseline);
  assert.deepEqual(after.workspace, before.workspace);
  assert.deepEqual(after.topLevel, before.topLevel);
  await namespaceSave(
    join(
      binding.operatorOutput,
      cleanupOnly
        ? "cleanup-release-filesystem.json"
        : "release-filesystem.json",
    ),
    after,
  );
  await namespaceSave(
    join(
      binding.operatorOutput,
      cleanupOnly ? "cleanup-profile-release.json" : "profile-release.json",
    ),
    {
      released: true,
      cleanupOnly,
      fullOriginalNamespaceScenarioAccepted: !cleanupOnly,
      original20: !cleanupOnly,
      additional88: !cleanupOnly,
      owner: "/root",
      profile: binding.profile,
      claimPreserved: true,
      claim: {
        path: join(binding.operatorOutput, "claim.json"),
        sha256: namespaceHash(
          await namespaceRead(join(binding.operatorOutput, "claim.json")),
        ),
      },
      bindingSHA256: claim.bindingSHA256,
      physical,
      liveHandles: [],
      scope:
        "Authentic retained handles plus fresh full protected/Git/profile-layout snapshot; no unobserved-birth guarantee",
    },
  );
  console.log(
    JSON.stringify({
      released: true,
      cleanupOnly,
      operatorOutput: binding.operatorOutput,
    }),
  );
}
