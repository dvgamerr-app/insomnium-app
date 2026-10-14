import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import {
  auditedProbeOutput,
  auditedProbeRoute,
  namespaceProbeIdentifier,
  namespaceTarget,
  verifyNativeBuildClosure,
  publishNativeCandidate,
  digest,
  namespaceBuildEnvironment,
  verifyNamespaceHost,
} from "./helpers/native-build-closure.js";
// Official Tauri build CLI https://v2.tauri.app/reference/cli/#build
// Hook wrapper delegates the unchanged maintained hook before capturing inputs.
/** Shared normal-hook producer; CLI entries supply fixed closed identities.
 * @param {string} identifier @param {string} requestedOutput */
export async function buildAuditedNativeProbe(identifier, requestedOutput) {
  const route = auditedProbeRoute(identifier);
  const output = await auditedProbeOutput(requestedOutput, route.identifier);
  Object.assign(process.env, namespaceBuildEnvironment());
  const host = verifyNamespaceHost();
  if (output !== route.outputRoot)
    await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  const state = /** @type {any} */ ({
    schemaVersion: 1,
    status: "running",
    started: Date.now(),
    identifier: route.identifier,
    target: namespaceTarget,
    host,
    artifact: join(output, route.artifactName),
  });
  const statePath = join(output, "build-state.json");
  await Bun.write(statePath, JSON.stringify(state, null, 2));
  const config = {
    identifier: route.identifier,
    build: { beforeBuildCommand: "bun tests/ui/helpers/native-build-hook.js" },
  };
  await Bun.write(
    join(output, "probe-config.json"),
    JSON.stringify(config, null, 2),
  );
  let code = 1;
  try {
    const actualArgs = [
      process.execPath,
      "run",
      "desktop:build",
      "--no-bundle",
      "--config",
      join(output, "probe-config.json"),
      "--",
      "--locked",
    ];
    state.actualArgs = actualArgs;
    process.env.INSOMNIUM_NAMESPACE_BUILD_ARGS = JSON.stringify(actualArgs);
    const child = Bun.spawn(actualArgs, {
      cwd: resolve("."),
      env: {
        ...process.env,
        INSOMNIUM_NAMESPACE_BUILD_OUTPUT: output,
        INSOMNIUM_NATIVE_BUILD_IDENTIFIER: route.identifier,
      },
      windowsHide: true,
      stdout: Bun.file(join(output, "build.log")),
      stderr: Bun.file(join(output, "build-error.log")),
    });
    state.nativePid = child.pid;
    await Bun.write(statePath, JSON.stringify(state, null, 2));
    code = await child.exited;
    assert.equal(code, 0, "Fresh namespace native build failed");
    const raw = await readFile(join(output, "before-cargo.json")),
      before = JSON.parse(raw.toString());
    await verifyNativeBuildClosure(before, output);
    const log =
        (await readFile(join(output, "build.log"))).toString() +
        "\n" +
        (await readFile(join(output, "build-error.log"))).toString(),
      emitted = [
        ...new Set(
          [
            ...log
              .replace(/\x1b\[[0-9;]*m/g, "")
              .matchAll(/Built application at:\s*([^\r\n]+)/g),
          ].map((match) => resolve(match[1].trim())),
        ),
      ];
    assert.equal(
      emitted.length,
      1,
      "Tauri must identify exactly one actual emitted application",
    );
    assert.equal(
      emitted[0].toLowerCase(),
      resolve(
        before.cargo.targetDirectory,
        "release/insomnium.exe",
      ).toLowerCase(),
      "Actual Tauri artifact must be the proven host release",
    );
    const receipt = await publishNativeCandidate(before, output, emitted[0]);
    Object.assign(state, receipt, {
      beforeCargoSHA256: digest(raw),
      sourceClosureVerified: true,
      coverage: "incomplete",
      targetLinkage: "unproven",
    });
    await Bun.write(
      join(output, "closure.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          ...before,
          ...receipt,
          sourceRecheckedAfterCargo: true,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    code = 1;
    state.failure = String(error);
    throw error;
  } finally {
    Object.assign(state, {
      status: "finished",
      finished: Date.now(),
      result: { code },
    });
    await Bun.write(statePath, JSON.stringify(state, null, 2));
  }
}
if (import.meta.main)
  await buildAuditedNativeProbe(
    namespaceProbeIdentifier,
    process.argv[2] ?? "artifacts/native-namespace-audit-probe",
  );
