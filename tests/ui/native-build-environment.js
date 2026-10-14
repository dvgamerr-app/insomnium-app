// Saved regressions for namespace producer PATH/tool lookup and updated env.
// No Cargo, full inventory, profile access, native host or browser is launched.
import assert from "node:assert/strict";
import { resolve, join, dirname } from "node:path";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { namespaceReviewedJournal } from "./helpers/namespace-before-claim.js";
import {
  namespaceBuildEnvironment,
  validateNamespaceProducerPath,
  verifyNativeBuildClosure,
  readNamespaceCargoMetadata,
} from "./helpers/native-build-closure.js";

assert.equal(process.platform, "win32");
if (process.argv.includes("--env-forward-child")) {
  console.log(
    JSON.stringify({
      observedCargoHome: process.env.CARGO_HOME,
      observedRustupHome: process.env.RUSTUP_HOME,
    }),
  );
  process.exit(0);
}
if (process.argv.includes("--cargo-metadata-probe")) {
  assert.equal(process.env.TAURI_ENV_TARGET_TRIPLE, "x86_64-pc-windows-msvc");
  const output = resolve(
    process.env.INSOMNIUM_NATIVE_METADATA_PROBE_OUTPUT ?? "",
  );
  assert.ok(
    output.startsWith(resolve("artifacts/native-namespace-audit-probe") + "\\"),
  );
  const metadataProbe = await readNamespaceCargoMetadata();
  const environment = Object.fromEntries(
    [
      "CARGO_BUILD_BUILD_DIR",
      "CARGO_BUILD_TARGET_DIR",
      "CARGO_TARGET_DIR",
      "CARGO_HOME",
      "RUSTUP_HOME",
      "RUSTUP_TOOLCHAIN",
      "RUSTC",
      "CARGO_MANIFEST_DIR",
      "PWD",
      "INIT_CWD",
      "TAURI_ENV_TARGET_TRIPLE",
      "TAURI_ENV_PLATFORM",
      "TAURI_ENV_ARCH",
      "TAURI_ENV_DEBUG",
    ].map((key) => [key, process.env[key] ?? null]),
  );
  const hashedEnvironment = Object.fromEntries(
    ["TAURI_CONFIG", "CARGO_ENCODED_CONFIG_TOML"].map((key) => {
      const value = process.env[key];
      return [
        key,
        value === undefined
          ? null
          : {
              bytes: Buffer.byteLength(value),
              sha256: createHash("sha256").update(value).digest("hex"),
            },
      ];
    }),
  );
  await writeFile(
    join(output, "metadata-hook-diagnostics.json"),
    JSON.stringify(
      {
        metadataProbe,
        environment,
        hashedEnvironment,
        cwd: process.cwd(),
        pid: process.pid,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      metadataOnly: true,
      sha256: metadataProbe.rawSHA256,
      intentionalStopBeforeCargo: true,
    }),
  );
  process.exit(41);
}
const originalPATH = process.env.PATH;
assert.ok(originalPATH);
const environment = namespaceBuildEnvironment(),
  parentPATH = environment.PATH;
assert.ok(parentPATH);
const root = resolve("."),
  bin = join(root, "node_modules/.bin"),
  ancestorBin = join(dirname(root), "node_modules/.bin");
const recordedPATH = [bin, bin, ancestorBin, parentPATH].join(";");
const checks = /** @type {string[]} */ ([]);
try {
  const journal =
    "repo-git_pw_1791356525503_83aca9b4/.git/insomnium-restore-ref-locks-v1.json";
  const journalHash =
    "4762dac534b3ddb82e2e641424cc78a6827c366c448ed5164e471052b339af90";
  assert.equal(namespaceReviewedJournal(journal, 414, journalHash), true);
  for (const [
    path,
    bytes,
    digest,
  ] of /** @type {[string, number, string][]} */ ([
    [journal.replace("83aca9b4", "different"), 414, journalHash],
    [journal, 413, journalHash],
    [journal, 414, "0".repeat(64)],
    [journal + "/child", 414, journalHash],
  ]))
    assert.equal(namespaceReviewedJournal(path, bytes, digest), false);
  checks.push("exact-historical-journal-only");
  process.env.PATH = parentPATH;
  const link = Bun.which("link", { PATH: process.env.PATH });
  assert.ok(
    link,
    "Explicit current producer PATH must resolve the actual linker",
  );
  assert.ok(await Bun.file(link).exists());
  assert.equal(
    namespaceBuildEnvironment().PATH,
    parentPATH,
    "Repeated setup must not duplicate fallback prefixes",
  );
  checks.push("explicit-link-resolution", "idempotent-producer-setup");

  // Exercise the real metadata-reader spawn boundary through an owned Bun child,
  // replacing only the Cargo executable launch: no Cargo or source scan occurs.
  const originalSpawn = Bun.spawn,
    originalCargoHome = process.env.CARGO_HOME,
    originalRustupHome = process.env.RUSTUP_HOME;
  const syntheticCargoHome = "saved-cargo-env-" + crypto.randomUUID(),
    syntheticRustupHome = "saved-rustup-env-" + crypto.randomUUID();
  let forwarded = /** @type {any} */ (null);
  try {
    process.env.CARGO_HOME = syntheticCargoHome;
    process.env.RUSTUP_HOME = syntheticRustupHome;
    /** @type {any} */ (Bun).spawn = (
      /** @type {string[]} */ argv,
      /** @type {any} */ options,
    ) => {
      assert.equal(argv[1], "metadata");
      forwarded = options.env;
      return originalSpawn(
        [
          process.execPath,
          resolve("tests/ui/native-build-environment.js"),
          "--env-forward-child",
        ],
        options,
      );
    };
    const observed = await readNamespaceCargoMetadata();
    assert.ok(forwarded);
    assert.equal(forwarded.CARGO_HOME, syntheticCargoHome);
    assert.equal(forwarded.RUSTUP_HOME, syntheticRustupHome);
    assert.equal(observed.metadata.observedCargoHome, syntheticCargoHome);
    assert.equal(observed.metadata.observedRustupHome, syntheticRustupHome);
    checks.push("updated-environment-forwarded-through-metadata-spawn");
  } finally {
    /** @type {any} */ (Bun).spawn = originalSpawn;
    if (originalCargoHome === undefined) delete process.env.CARGO_HOME;
    else process.env.CARGO_HOME = originalCargoHome;
    if (originalRustupHome === undefined) delete process.env.RUSTUP_HOME;
    else process.env.RUSTUP_HOME = originalRustupHome;
  }

  assert.deepEqual(
    validateNamespaceProducerPath(parentPATH, parentPATH).prefix,
    [],
  );
  assert.deepEqual(
    validateNamespaceProducerPath(recordedPATH, parentPATH).prefix,
    [bin, bin, ancestorBin],
  );
  checks.push("equal-path", "known-cli-prefixes");
  for (const [name, path] of [
    ["foreign-prefix", "C:\\unbound-producer-bin;" + parentPATH],
    ["relative-prefix", "node_modules/.bin;" + parentPATH],
    ["changed-parent", bin + ";" + parentPATH + ";C:\\changed-parent"],
    ["prefix-bound", Array(17).fill(bin).join(";") + ";" + parentPATH],
    ["empty-prefix", ";" + parentPATH],
  ]) {
    assert.throws(() => validateNamespaceProducerPath(path, parentPATH));
    checks.push(name);
  }
  let failure = /** @type {unknown} */ (undefined);
  try {
    await verifyNativeBuildClosure(
      { toolEnvironment: { PATH: recordedPATH } },
      resolve("artifacts/namespace-refused-output"),
    );
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof Error);
  assert.ok(
    failure.stack?.includes("namespaceOutput"),
    "Refusal must occur before tool/source/profile inventory",
  );
  assert.equal(
    process.env.PATH,
    parentPATH,
    "Rejected capture must restore the parent PATH",
  );
  checks.push("capture-refusal-restores-path");
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      groups: checks.length,
      scope:
        "Actual producer environment forwarding, linker lookup and PATH admission/restoration only; no Cargo, build, full capture or namespace acceptance",
    }),
  );
} finally {
  process.env.PATH = originalPATH;
}
