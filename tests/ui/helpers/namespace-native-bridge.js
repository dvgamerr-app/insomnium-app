import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { withNativeApp as nativeApp, probeIdentifier } from "./native-app.js";
import { nativeErrorTree } from "./native-error.js";
import {
  namespaceRead,
  namespaceHash,
  namespaceSave,
  namespaceProcessTable,
  namespaceOwnedSnapshot,
  recordNamespaceProcesses,
} from "./namespace-process-evidence.js";
/** @returns {Promise<any|null>} */
export async function namespaceOperatorBinding() {
  const path = process.env.INSOMNIUM_NAMESPACE_OPERATOR_BINDING;
  if (!path) return null;
  const bytes = await namespaceRead(path);
  assert.equal(
    namespaceHash(bytes),
    process.env.INSOMNIUM_NAMESPACE_OPERATOR_BINDING_SHA256,
  );
  const binding = JSON.parse(bytes.toString());
  assert.equal(binding.identifier, probeIdentifier);
  assert.equal(binding.status, "current-original-namespace-operator");
  assert.equal(process.env.INSOMNIUM_XML_RESPONSE_NAMESPACES, "1");
  assert.equal(process.env.INSOMNIUM_UI_PROBE_IDENTIFIER, probeIdentifier);
  assert.equal(
    resolve(process.env.INSOMNIUM_UI_BUILD_STATE ?? ""),
    binding.buildState,
  );
  const claim = JSON.parse(
    (
      await namespaceRead(join(binding.operatorOutput, "claim.json"))
    ).toString(),
  );
  assert.equal(claim.runnerPid, process.ppid);
  assert.equal(claim.owner, "/root");
  assert.equal(claim.terminal, false);
  assert.equal(
    claim.bindingSHA256,
    process.env.INSOMNIUM_NAMESPACE_OPERATOR_BINDING_SHA256,
  );
  assert.equal(claim.baselineSHA256, binding.baseline.sha256);
  assert.equal(claim.held, true);
  assert.equal(claim.exeSHA256, binding.exeSHA256);
  return binding;
}
/** @param {import("./native-app.js").ScenarioContext} context */
export async function namespaceBeforeFirstSave(context) {
  const binding = await namespaceOperatorBinding();
  if (binding)
    await recordNamespaceProcesses(
      context.pid,
      context.output,
      "before-first-save",
      binding,
    );
}
/** Delegate the saved native helper; retain ONE original resource preserver.
 * @param {string} name @param {(context:import("./native-app.js").ScenarioContext)=>Promise<void>} run */
export async function withNamespaceNativeApp(name, run) {
  const binding = await namespaceOperatorBinding();
  if (!binding) return nativeApp(name, run);
  assert.equal(name, "xml-response-filter");
  return nativeApp(name, async (context) => {
    const actual = resolve(
      await context.invoke("plugin:path|resolve_directory", {
        directory: 14,
        path: null,
      }),
    );
    assert.equal(actual.toLowerCase(), binding.profile.toLowerCase());
    const start = namespaceOwnedSnapshot(
      namespaceProcessTable(),
      context.pid,
      binding.artifact,
    );
    await namespaceSave(join(binding.operatorOutput, "context.json"), {
      pid: context.pid,
      output: context.output,
      profile: actual,
      ...start,
      recordedBeforeFixture: true,
    });
    const original = await context.invoke("load_workspace");
    assert.equal(original.resources.length, 43);
    assert.equal(original.history.length, 20);
    await namespaceSave(
      join(binding.operatorOutput, "original-workspace.json"),
      original,
    );
    const failures = /** @type {unknown[]} */ ([]);
    try {
      await run(context);
    } catch (error) {
      failures.push(error);
    }
    for (const action of [
      async () => {
        for (const name of [
          "workspace-v1.json",
          "workspace-v1.previous.json",
        ]) {
          const bytes = await readFile(join(binding.profile, name));
          await writeFile(
            join(binding.operatorOutput, "changed-" + name),
            bytes,
            { flag: "wx" },
          );
          await namespaceSave(
            join(binding.operatorOutput, "changed-" + name + ".receipt.json"),
            {
              source: join(binding.profile, name),
              pid: context.pid,
              bytes: bytes.length,
              sha256: namespaceHash(bytes),
              readBeforeOriginalNativeHelperClose: true,
            },
          );
        }
      },
      async () => {
        const closing = await recordNamespaceProcesses(
          context.pid,
          context.output,
          "before-close",
          binding,
        );
        await namespaceSave(
          join(binding.operatorOutput, "bridge-before-close.json"),
          { ...closing, capturedBeforeOriginalNativeHelperClose: true },
        );
      },
    ])
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    if (failures.length) {
      await namespaceSave(
        join(binding.operatorOutput, "leaf-failures.json"),
        failures.map(nativeErrorTree),
      );
      throw new AggregateError(
        failures,
        "Namespace primary and raw before-close failures retained",
        { cause: failures[0] },
      );
    }
  });
}
