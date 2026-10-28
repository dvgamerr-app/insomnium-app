import assert from "node:assert/strict";
import {
  lstat,
  readdir,
  realpath,
  readlink,
  readFile,
  mkdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
import { resolve, join, relative, dirname, sep, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { isBuiltin } from "node:module";
// Maintained CLI modules are runtime tooling, not Svelte application modules.
// Literal URL imports keep their full bytes in the source ledger without pulling
// historically untyped build scripts into the application's JS type boundary.
/** @type {{validateSpectralArtifact:(target:string)=>Promise<{binary:string,manifest:string,provenance:string}>}} */
const { validateSpectralArtifact } = await import(
  new URL("../../../scripts/spectral-artifact.mjs", import.meta.url).href
);
/** @type {{validateNativeNotices:(target:string,options:{expectedRecipe:any})=>Promise<any>}} */
const { validateNativeNotices } = await import(
  new URL("../../../scripts/native-notice-artifact.mjs", import.meta.url).href
);
/** @type {{buildRecipe:(mode:string)=>any}} */
const { buildRecipe } = await import(
  new URL("../../../scripts/generate-native-notices.mjs", import.meta.url).href
);
/** @type {{validateFrontendFS:(root:string)=>Promise<any>}} */
const { validateFrontendFS } = await import(
  new URL("../../../scripts/frontend-notice-fs.mjs", import.meta.url).href
);

export const namespaceProbeIdentifier = "app.insomnium.probe.checkout20260929";
export const resourceCrudBuildIdentifier =
  "app.insomnium.probe.resourcecrud20261012";
/** Only two owner-authorized build identities; namespace callers retain their
 * original fixed entry and output guard. @param {string} identifier */
export function auditedProbeRoute(identifier) {
  assert.ok(
    [namespaceProbeIdentifier, resourceCrudBuildIdentifier].includes(
      identifier,
    ),
    "Unsupported audited native probe identity",
  );
  return {
    identifier,
    outputRoot: join(
      root,
      identifier === namespaceProbeIdentifier
        ? "artifacts/native-namespace-audit-probe"
        : "artifacts/native-resource-crud-audit-probe",
    ),
    artifactName:
      identifier === namespaceProbeIdentifier
        ? "insomnium-namespace-probe.exe"
        : "insomnium-resource-crud-probe.exe",
  };
}
export const namespaceTarget = "x86_64-pc-windows-msvc";
const root = resolve(import.meta.dir, "../../..");
/** Reuse the established saved Windows producer setup only when PATH lacks
 * MSVC link; no identity/security settings are inherited from another probe. */
export function namespaceBuildEnvironment() {
  // Windows retains original key casing (often Path). Child environments must
  // contain one canonical PATH, preserving the actual updated process value.
  const currentPATH = process.env.PATH ?? process.env.Path;
  const inherited = { ...process.env };
  for (const key of Object.keys(inherited))
    if (key.toUpperCase() === "PATH") delete inherited[key];
  inherited.PATH = currentPATH;
  if (Bun.which("link", { PATH: currentPATH })) return inherited;
  const msvc =
      "C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023",
    sdk = "C:/Program Files (x86)/Windows Kits/10";
  const env = {
    ...inherited,
    CARGO_HOME: "D:/home/.cargo",
    RUSTUP_HOME: "D:/home/.rustup",
    PATH: `D:/home/.cargo/bin;${msvc}/bin/Hostx64/x64;${sdk}/bin/10.0.19041.0/x64;${currentPATH}`,
    INCLUDE: `${msvc}/include;${sdk}/Include/10.0.19041.0/ucrt;${sdk}/Include/10.0.19041.0/shared;${sdk}/Include/10.0.19041.0/um`,
    LIB: `${msvc}/lib/x64;${sdk}/Lib/10.0.19041.0/ucrt/x64;${sdk}/Lib/10.0.19041.0/um/x64`,
  };
  assert.ok(
    Bun.which("link", { PATH: env.PATH }),
    "Established MSVC producer tool unavailable",
  );
  return env;
}
/** @returns {{host:string,versionSHA256:string}} */
export function verifyNamespaceHost() {
  assert.ok(
    !process.env.CARGO_BUILD_TARGET,
    "Host build must not inherit Cargo cross-target override",
  );
  const rustc = Bun.which("rustc", { PATH: process.env.PATH });
  assert.ok(rustc);
  const result = Bun.spawnSync([rustc, "-vV"], {
    cwd: root,
    env: { ...process.env },
    windowsHide: true,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10000,
  });
  assert.equal(result.exitCode, 0, "Rust host unavailable");
  const text = Buffer.from(result.stdout).toString(),
    host = /^host:\s*(\S+)$/m.exec(text)?.[1];
  assert.equal(
    host,
    namespaceTarget,
    "Namespace host must match the original Windows x64 target",
  );
  return { host: namespaceTarget, versionSHA256: digest(text) };
}
/** Validate only Bun CLI's known project/ancestor bin prefix expansion. The
 * entire parent suffix remains byte-exact; arbitrary executable paths refuse.
 * @param {string} recordedPATH @param {string} parentPATH */
export function validateNamespaceProducerPath(recordedPATH, parentPATH) {
  assert.ok(
    recordedPATH.length && parentPATH.length,
    "Producer/parent PATH required",
  );
  if (recordedPATH === parentPATH)
    return { prefix: /** @type {string[]} */ ([]), recordedPATH, parentPATH };
  assert.ok(
    recordedPATH.endsWith(";" + parentPATH),
    "Producer PATH changed the exact parent suffix",
  );
  const prefix = recordedPATH.slice(0, -parentPATH.length - 1).split(";");
  assert.ok(
    prefix.length > 0 && prefix.length <= 16,
    "Producer PATH prefix bound",
  );
  const allowed = new Set();
  for (let at = root; ; at = dirname(at)) {
    allowed.add(resolve(at, "node_modules/.bin").toLowerCase());
    if (dirname(at) === at) break;
  }
  for (const entry of prefix)
    assert.ok(
      isAbsolute(entry) && allowed.has(resolve(entry).toLowerCase()),
      "Unbound producer PATH prefix refused",
    );
  return { prefix, recordedPATH, parentPATH };
}
/** @param {Uint8Array|string} bytes */
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
/** @param {string} path @param {string} base */
function inside(path, base) {
  const rel = relative(base, path);
  return (
    rel === "" ||
    (!rel.startsWith(".." + sep) &&
      rel !== ".." &&
      !resolve(rel).startsWith("\\\\") &&
      !rel.includes(":"))
  );
}
/** Reject links in ordinary workspace/output/tool paths, including ancestors.
 * @param {string} path @param {boolean} [missingLeaf] */
export async function ordinary(path, missingLeaf = false) {
  const full = resolve(path);
  for (let at = full; ; at = dirname(at)) {
    try {
      const stat = await lstat(at);
      assert.ok(!stat.isSymbolicLink(), "Linked ordinary path refused: " + at);
    } catch (error) {
      if (!(
        missingLeaf &&
        at === full &&
        /** @type {any} */ (error).code === "ENOENT"
      ))
        throw error;
    }
    if (dirname(at) === at) break;
  }
  try {
    assert.equal((await realpath(full)).toLowerCase(), full.toLowerCase());
  } catch (error) {
    if (!(missingLeaf && /** @type {any} */ (error).code === "ENOENT"))
      throw error;
  }
  return full;
}
/** @param {string} output */
export async function namespaceOutput(output) {
  return auditedProbeOutput(output, namespaceProbeIdentifier);
}
/** @param {string} output @param {string} identifier */
export async function auditedProbeOutput(output, identifier) {
  const route = auditedProbeRoute(identifier);
  const path = resolve(output);
  assert.ok(inside(path, route.outputRoot));
  assert.equal(process.platform, "win32");
  assert.equal(resolve("."), root);
  if (identifier === namespaceProbeIdentifier) await ordinary(path, true);
  else {
    let checked = path;
    for (;;) {
      try {
        await lstat(checked);
        break;
      } catch (error) {
        if (/** @type {any} */ (error).code !== "ENOENT") throw error;
        checked = dirname(checked);
        assert.ok(
          inside(checked, join(root, "artifacts")),
          "Missing CRUD output ancestors exceed owned artifacts",
        );
      }
    }
    await ordinary(checked);
  }
  return path;
}
/** @param {string} path */
async function fileRow(path) {
  const stat = await lstat(path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.ok(stat.size <= 512 * 1024 * 1024);
  const bytes = await readFile(path);
  assert.equal(bytes.length, stat.size);
  return { path: resolve(path), bytes: bytes.length, sha256: digest(bytes) };
}
/** Exact directory/file/link inventory; canonical package links remain internal.
 * @param {string} directory @param {string[]} [linkRoots] @param {(path:string)=>boolean} [skip] */
async function tree(directory, linkRoots = [], skip = () => false) {
  const rows = /** @type {any[]} */ ([]),
    seen = new Set();
  const visit = async (/** @type {string} */ path) => {
    if (skip(path)) return;
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      assert.ok(linkRoots.length, "Source link refused");
      const target = await realpath(path);
      assert.ok(
        linkRoots.some((base) => inside(target, base)),
        "External installed package link refused",
      );
      rows.push({
        kind: "link",
        path: resolve(path),
        link: await readlink(path),
        target,
      });
      await visit(target);
      return;
    }
    const canonical = await realpath(path);
    assert.equal(canonical.toLowerCase(), resolve(path).toLowerCase());
    if (seen.has(canonical.toLowerCase())) return;
    seen.add(canonical.toLowerCase());
    assert.ok(seen.size < 500000, "Inventory bound exceeded");
    if (stat.isDirectory()) {
      rows.push({ kind: "directory", path: resolve(path) });
      for (const name of (await readdir(path)).sort())
        await visit(join(path, name));
    } else {
      assert.ok(stat.isFile(), "Nonordinary build input refused");
      rows.push({ kind: "file", ...(await fileRow(path)) });
    }
  };
  await visit(directory);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
async function authorities() {
  return {
    spectral: await validateSpectralArtifact(namespaceTarget),
    native: await validateNativeNotices(namespaceTarget, {
      expectedRecipe: buildRecipe("manual"),
    }),
    frontend: await validateFrontendFS(root),
    coverage: "incomplete",
    targetLinkage: "unproven",
  };
}
/** Capture only actual notice-consumed private archives and admission pointers. */
async function privateInputs() {
  const paths = new Set();
  for (const kind of ["native", "frontend"]) {
    const publicPath = join(
        root,
        "src-tauri/notices",
        kind,
        "collection-inputs.json",
      ),
      receipt = JSON.parse((await readFile(publicPath)).toString()),
      hash = digest(await readFile(publicPath));
    paths.add(
      kind === "native"
        ? join(root, "artifacts/native-notice-admissions", hash + ".json")
        : join(
            root,
            "artifacts/frontend-notice-private/admissions",
            hash + ".json",
          ),
    );
    paths.add(
      kind === "native"
        ? join(
            root,
            "artifacts/native-notice-admissions",
            "current-" + namespaceTarget + ".json",
          )
        : join(root, "artifacts/frontend-notice-private/current.json"),
    );
    for (const row of receipt.packages) {
      const archive =
        kind === "native"
          ? row.provenance?.kind === "registry"
            ? row.provenance.archive
            : null
          : row.archive;
      if (archive)
        paths.add(
          kind === "native"
            ? join(
                root,
                "artifacts/native-notice-source-snapshots",
                archive.sha256 + ".crate",
              )
            : join(
                root,
                "artifacts/frontend-notice-private/archives",
                archive.sha256 + ".tgz",
              ),
        );
    }
  }
  const provided = join(
    root,
    "artifacts/frontend-notice-provided/admission.json",
  );
  try {
    await ordinary(provided);
    const receipt = JSON.parse((await readFile(provided)).toString());
    paths.add(provided);
    for (const row of receipt.archives) {
      const path = resolve(root, row.path);
      assert.ok(inside(path, join(root, "artifacts/frontend-notice-provided")));
      paths.add(path);
    }
  } catch (error) {
    if (/** @type {any} */ (error).code !== "ENOENT") throw error;
  }
  const rows = [];
  for (const path of [...paths].sort()) {
    await ordinary(path);
    rows.push(await fileRow(path));
  }
  return rows;
}
/** Read the exact maintained metadata command without tree capture/build.
 * Raw SHA remains authoritative; the full parsed object preserves diagnostic
 * field/key ordering rather than silently canonicalizing a failed receipt.
 * @returns {Promise<{rawSHA256:string,metadata:any,argv:string[],selectedCargo:string,rawJSON:string}>} */
export async function readNamespaceCargoMetadata() {
  const cargo = Bun.which("cargo", { PATH: process.env.PATH });
  assert.ok(cargo, "Cargo executable required");
  const argv = [
    cargo,
    "metadata",
    "--format-version",
    "1",
    "--locked",
    "--offline",
    "--filter-platform",
    namespaceTarget,
    "--manifest-path",
    join(root, "src-tauri/Cargo.toml"),
  ];
  const child = Bun.spawn(argv, {
    cwd: root,
    env: { ...process.env },
    windowsHide: true,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  assert.equal(code, 0, "Cargo source resolution failed: " + stderr);
  return {
    rawSHA256: digest(stdout),
    metadata: JSON.parse(stdout),
    argv,
    selectedCargo: cargo,
    rawJSON: stdout,
  };
}
async function cargoSources() {
  const resolved = await readNamespaceCargoMetadata(),
    metadata = resolved.metadata,
    rows = /** @type {any[]} */ ([]),
    packages = /** @type {any[]} */ ([]),
    seen = new Set();
  const cargoHome = resolve(
    process.env.CARGO_HOME ?? join(process.env.USERPROFILE ?? "", ".cargo"),
  );
  await ordinary(cargoHome);
  for (const pkg of metadata.packages) {
    const directory = dirname(pkg.manifest_path);
    await ordinary(directory);
    assert.ok(
      inside(directory, root) || inside(directory, cargoHome),
      "Unreviewed external Cargo source",
    );
    packages.push({
      id: pkg.id,
      source: pkg.source,
      manifestPath: pkg.manifest_path,
    });
    if (inside(directory, root) || seen.has(directory)) continue;
    seen.add(directory);
    rows.push(
      ...(await tree(directory, [], (path) =>
        ["target", ".git"].includes(relative(directory, path).split(sep)[0]),
      )),
    );
  }
  return {
    metadataSHA256: resolved.rawSHA256,
    metadata: resolved.metadata,
    metadataRawJSON: resolved.rawJSON,
    metadataArgv: resolved.argv,
    selectedCargo: resolved.selectedCargo,
    targetDirectory: metadata.target_directory,
    packages: packages.sort((a, b) => a.id.localeCompare(b.id)),
    rows,
  };
}
async function tools() {
  const paths = new Set([
    process.execPath,
    "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
    "C:/Windows/System32/kernel32.dll",
    "C:/Windows/System32/kernelbase.dll",
    "C:/Windows/System32/user32.dll",
    "C:/Windows/Microsoft.NET/assembly/GAC_MSIL/System.Management.Automation/v4.0_3.0.0.0__31bf3856ad364e35/System.Management.Automation.dll",
    ...[
      "mscorlib.dll",
      "System.dll",
      "System.Core.dll",
      "Microsoft.CSharp.dll",
      "csc.exe",
    ].map((name) => "C:/Windows/Microsoft.NET/Framework64/v4.0.30319/" + name),
  ]);
  for (const name of ["cargo", "rustc", "rustup", "link"]) {
    const executable = Bun.which(name, { PATH: process.env.PATH });
    assert.ok(executable, "Required native producer tool missing: " + name);
    paths.add(executable);
  }
  for (const name of ["cl", "lib", "rc", "mt", "cmake", "ninja", "MSBuild"]) {
    const executable = Bun.which(name, { PATH: process.env.PATH });
    if (executable) paths.add(executable);
  }
  for (const name of ["RUSTC", "CC", "CXX", "AR"]) {
    const selected = process.env[name];
    if (selected) {
      const executable = Bun.which(selected, { PATH: process.env.PATH });
      assert.ok(
        executable,
        "Configured producer executable unavailable: " + name,
      );
      paths.add(executable);
    }
  }
  // Bind the actual Rust executables behind rustup's PATH shims too.
  const rustup = Bun.which("rustup", { PATH: process.env.PATH });
  assert.ok(rustup);
  for (const name of ["cargo", "rustc"]) {
    const result = /** @type {Bun.SyncSubprocess<'pipe','pipe'>} */ (
      Bun.spawnSync([rustup, "which", name], {
        cwd: root,
        env: { ...process.env },
        windowsHide: true,
        stdout: "pipe",
        stderr: "pipe",
        timeout: 10000,
      })
    );
    assert.equal(result.exitCode, 0, "Actual Rust producer path unresolved");
    paths.add(Buffer.from(result.stdout).toString().trim());
  }
  if (process.env.LIBCLANG_PATH) {
    const directory = resolve(process.env.LIBCLANG_PATH);
    await ordinary(directory);
    for (const name of await readdir(directory))
      if (/libclang.*\.dll$/i.test(name)) paths.add(join(directory, name));
  }
  const rows = [];
  for (const path of [...paths].sort()) {
    await ordinary(path);
    rows.push(await fileRow(path));
  }
  return rows;
}
async function cargoConfigs() {
  const paths = new Set();
  for (let at = join(root, "src-tauri"); ; at = dirname(at)) {
    for (const name of ["config", "config.toml"])
      paths.add(join(at, ".cargo", name));
    if (dirname(at) === at) break;
  }
  const home = resolve(
    process.env.CARGO_HOME ?? join(process.env.USERPROFILE ?? "", ".cargo"),
  );
  for (const name of ["config", "config.toml"]) paths.add(join(home, name));
  const rows = [];
  for (const path of [...paths].sort()) {
    try {
      await ordinary(path);
      assert.equal(
        /** @type {{build?:{target?:string|string[]}}} */ (
          Bun.TOML.parse((await readFile(path)).toString())
        ).build?.target,
        undefined,
        "Host namespace build refuses configured Cargo cross-target",
      );
      rows.push(await fileRow(path));
    } catch (error) {
      if (/** @type {any} */ (error).code !== "ENOENT") throw error;
    }
  }
  return rows;
}
/** Bind the concrete installed producer/runtime dependency identities to their
 * own maintained lockfiles, in addition to hashing complete installed trees.
 * @param {string[]} bases */
async function packageBindings(bases) {
  const rows = /** @type {any[]} */ ([]);
  // This maintained producer imports a published package through its actual
  // subpaths because that package's declared index.js is not distributed.
  const editorImports = new Bun.Transpiler({ loader: "js" })
    .scanImports(
      (await readFile(join(root, "src/lib/editor-engine.js"))).toString(),
    )
    .map((row) => row.path);
  for (const project of [root, join(root, "tools/spectral-linter")]) {
    const manifest = JSON.parse(
        (await readFile(join(project, "package.json"))).toString(),
      ),
      lock = /** @type {any} */ (
        Bun.JSONC.parse((await readFile(join(project, "bun.lock"))).toString())
      );
    for (const specifier of [
      ...new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
      ]),
    ].sort()) {
      let metadataPath;
      for (let at = project; ; at = dirname(at)) {
        const candidate = join(at, "node_modules", specifier, "package.json");
        try {
          metadataPath = await realpath(candidate);
          break;
        } catch (error) {
          if (/** @type {any} */ (error).code !== "ENOENT") throw error;
        }
        if (at === root || dirname(at) === at) break;
      }
      assert.ok(
        metadataPath,
        "Declared installed package missing: " + specifier,
      );
      assert.ok(
        bases.some((base) => inside(metadataPath, base)),
        "Installed package metadata outside captured trees",
      );
      const metadata = JSON.parse((await readFile(metadataPath)).toString()),
        identity = lock.packages[specifier];
      assert.ok(
        Array.isArray(identity),
        "Declared package missing from own lock",
      );
      assert.equal(
        identity[0],
        metadata.name + "@" + metadata.version,
        "Installed package differs from lock identity",
      );
      let entry = null;
      let resolutionSpecifier = specifier,
        runtimeBuiltin = null;
      let resolutionEntries =
        /** @type {{specifier:string,entry:string}[]} */ ([]);
      try {
        let resolved = Bun.resolveSync(specifier, project);
        if (isBuiltin(resolved)) {
          runtimeBuiltin = resolved;
          resolutionSpecifier = specifier + "/";
          resolved = Bun.resolveSync(resolutionSpecifier, project);
          assert.ok(
            !isBuiltin(resolved),
            "Required installed browser package resolved to runtime builtin",
          );
        }
        entry = await realpath(resolved);
      } catch (error) {
        const subpaths = [
          ...new Set(
            editorImports.filter((value) => value.startsWith(specifier + "/")),
          ),
        ].sort();
        if (subpaths.length) {
          for (const selected of subpaths) {
            const selectedEntry = await realpath(
              Bun.resolveSync(selected, project),
            );
            assert.ok(bases.some((base) => inside(selectedEntry, base)));
            resolutionEntries.push({
              specifier: selected,
              entry: selectedEntry,
            });
          }
          resolutionSpecifier = resolutionEntries[0].specifier;
          entry = resolutionEntries[0].entry;
        } else
          assert.ok(
            specifier.startsWith("@types/"),
            "Required runtime package cannot resolve: " + specifier,
          );
      }
      if (entry !== null)
        assert.ok(
          bases.some((base) => inside(/** @type {string} */ (entry), base)),
          "Resolved package entry outside captured trees",
        );
      const binding = {
        project,
        specifier,
        name: metadata.name,
        version: metadata.version,
        metadataPath,
        entry,
        resolutionSpecifier,
        runtimeBuiltin,
        resolutionEntries: [],
        lockIdentity: identity,
      };
      if (resolutionEntries.length)
        for (const selected of resolutionEntries)
          rows.push({
            ...binding,
            entry: selected.entry,
            resolutionSpecifier: selected.specifier,
          });
      else rows.push(binding);
    }
  }
  return rows;
}
/** Called AFTER real Tauri frontend hook and BEFORE Cargo builds the executable.
 * Source/installed packages remain canonical: no private data/source copies.
 * @param {string} output @param {boolean} [writeLedger] @param {string} [identifier] */
export async function captureNativeBuildClosure(
  output,
  writeLedger = true,
  identifier = namespaceProbeIdentifier,
) {
  for (const name of [
    "BUN_OPTIONS",
    "BUN_BE_BUN",
    "NODE_OPTIONS",
    "NODE_PATH",
    "RUSTC_WRAPPER",
    "RUSTC_WORKSPACE_WRAPPER",
  ])
    assert.ok(
      !process.env[name],
      "Unreviewed preload/compiler wrapper refused: " + name,
    );
  const candidate =
      identifier === namespaceProbeIdentifier
        ? await namespaceOutput(output)
        : await auditedProbeOutput(output, identifier),
    producerHost = verifyNamespaceHost(),
    producerTools = await tools(),
    producerConfigs = await cargoConfigs();
  const authority = await authorities();
  const configPath = await ordinary(join(candidate, "probe-config.json"));
  assert.deepEqual(
    JSON.parse((await readFile(configPath)).toString()),
    {
      identifier,
      build: {
        beforeBuildCommand: "bun tests/ui/helpers/native-build-hook.js",
      },
    },
    "Probe overlay must not change production CSP/capabilities/build recipe",
  );
  const excluded = [
    "src-tauri/target",
    "src-tauri/gen",
    "src-tauri/binaries",
    "src-tauri/notices",
    "tools/spectral-linter/dist",
  ];
  const skip = (/** @type {string} */ path) =>
    excluded.some((base) => inside(path, join(root, base))) ||
    relative(root, path).split(sep).includes("node_modules");
  const collectSources = async () => {
    const sources = /** @type {any[]} */ ([]);
    for (const scope of [
      "src",
      "scripts",
      "tests",
      "tools",
      "src-tauri",
      "static",
      "docs",
      ".github",
    ]) {
      const path = join(root, scope);
      try {
        await ordinary(path);
        sources.push(...(await tree(path, [], skip)));
      } catch (error) {
        if (/** @type {any} */ (error).code !== "ENOENT") throw error;
      }
    }
    for (const name of (await readdir(root)).sort()) {
      const path = join(root, name),
        stat = await lstat(path);
      if (
        stat.isSymbolicLink() &&
        /\.(?:js|mjs|cjs|json|toml|lock)$/.test(name)
      )
        assert.fail("Linked root build configuration refused: " + name);
      if (name.startsWith(".env") && stat.isSymbolicLink())
        assert.fail("Linked environment build input refused: " + name);
      if (stat.isFile() && !/\.timestamp-/.test(name))
        sources.push(await fileRow(path));
    }
    return sources;
  };
  const bases = [];
  const packageRoots = /** @type {any[]} */ ([]);
  for (const path of [
    join(root, "node_modules"),
    join(root, "tools/spectral-linter/node_modules"),
  ]) {
    try {
      const canonical = await realpath(path);
      assert.ok(inside(canonical, root), "External node_modules root refused");
      bases.push(canonical);
      packageRoots.push({
        path,
        canonical,
        link: (await lstat(path)).isSymbolicLink()
          ? await readlink(path)
          : null,
      });
    } catch (error) {
      if (/** @type {any} */ (error).code !== "ENOENT") throw error;
    }
  }
  assert.ok(bases.length);
  const resolvedPackages = await packageBindings(bases);
  const sources = await collectSources();
  const packages = /** @type {any[]} */ ([]);
  for (const base of bases) packages.push(...(await tree(base, bases)));
  const assets = await tree(join(root, "build")),
    notices = await tree(join(root, "src-tauri/notices")),
    spectral = await Promise.all(
      [
        authority.spectral.binary,
        authority.spectral.manifest,
        authority.spectral.provenance,
      ].map(fileRow),
    );
  // Global original/current private input inventories remain separate from the
  // exact admission-consumed snapshot set; unrelated historical stages excluded.
  const privateFullRows = /** @type {any[]} */ ([]);
  for (const scope of [
    "native-notice-admissions",
    "native-notice-source-snapshots",
    "frontend-notice-private",
    "frontend-notice-provided",
  ]) {
    const path = await ordinary(join(root, "artifacts", scope));
    privateFullRows.push(...(await tree(path)));
  }
  const ledger = {
    schemaVersion: 1,
    identifier,
    target: namespaceTarget,
    root,
    candidate,
    capturedAt: Date.now(),
    sources,
    packages,
    packageBindings: resolvedPackages,
    packageRoots,
    cargo: await cargoSources(),
    host: producerHost,
    actualArgs: process.env.INSOMNIUM_NAMESPACE_BUILD_ARGS
      ? JSON.parse(process.env.INSOMNIUM_NAMESPACE_BUILD_ARGS)
      : JSON.parse(
          (await readFile(join(candidate, "build-state.json"))).toString(),
        ).actualArgs,
    cargoConfigs: producerConfigs,
    tools: producerTools,
    assets,
    workers: assets.filter(
      (row) =>
        row.kind === "file" &&
        (/worker.*\.js$/.test(row.path) || /\.wasm$/.test(row.path)),
    ),
    notices,
    spectral,
    privateInputs: await privateInputs(),
    privateFullRows,
    probeConfig: await fileRow(configPath),
    authority,
    generatedOutputExclusions: excluded,
    toolEnvironment: {
      CARGO_HOME: process.env.CARGO_HOME ?? null,
      RUSTUP_HOME: process.env.RUSTUP_HOME ?? null,
      LIBCLANG_PATH: process.env.LIBCLANG_PATH ?? null,
      PATH: process.env.PATH ?? null,
      LIB: process.env.LIB ?? null,
      INCLUDE: process.env.INCLUDE ?? null,
      producerFlags: Object.fromEntries(
        [
          "RUSTUP_TOOLCHAIN",
          "RUSTFLAGS",
          "CARGO_ENCODED_RUSTFLAGS",
          "CARGO_BUILD_RUSTFLAGS",
          "CARGO_TARGET_DIR",
          "RUSTC",
          "CC",
          "CXX",
          "AR",
          "CFLAGS",
          "CXXFLAGS",
          ...Object.keys(process.env).filter(
            (key) =>
              key.startsWith("CARGO_PROFILE_RELEASE_") ||
              (key.startsWith("CARGO_TARGET_") && !key.endsWith("_TOKEN")),
          ),
        ]
          .sort()
          .map((key) => [key, process.env[key] ?? null]),
      ),
    },
    systemLoaderClosureComplete: false,
  };
  assert.deepEqual(
    ledger.actualArgs,
    [
      process.execPath,
      "run",
      "desktop:build",
      "--no-bundle",
      "--config",
      configPath,
      "--",
      "--locked",
    ],
    "Actual original-profile build arguments changed",
  );
  // Capture can take minutes. Refuse dependency drift before Cargo starts,
  // rather than discovering a stale identity only after a release compile.
  await assertNativePackageBindings(bases, resolvedPackages);
  if (writeLedger)
    await writeFile(
      join(candidate, "before-cargo.json"),
      JSON.stringify(ledger, null, 2) + "\n",
      { flag: "wx" },
    );
  return ledger;
}
/** Cheap identity recheck, reusable without repeating the complete tree capture.
 * @param {string[]} bases @param {any[]} expected */
export async function assertNativePackageBindings(bases, expected) {
  assert.deepEqual(await packageBindings(bases),expected,
    "Installed package bindings changed during snapshot capture");
}
/** Recompute complete source/package/assets/notices/Cargo/tool scopes, detecting
 * added/deleted files and changed link targets as well as byte changes.
 * @param {any} before @param {string} output */
export async function verifyNativeBuildClosure(before, output) {
  const parentPATH = process.env.PATH,
    recordedPATH = before.toolEnvironment.PATH;
  validateNamespaceProducerPath(recordedPATH, parentPATH ?? "");
  process.env.PATH = recordedPATH;
  try {
    const after = await captureNativeBuildClosure(
      output,
      false,
      before.identifier,
    );
    for (const key of [
      "identifier",
      "target",
      "root",
      "candidate",
      "sources",
      "packages",
      "packageBindings",
      "packageRoots",
      "cargo",
      "host",
      "actualArgs",
      "cargoConfigs",
      "tools",
      "assets",
      "workers",
      "notices",
      "spectral",
      "privateInputs",
      "privateFullRows",
      "probeConfig",
      "authority",
      "generatedOutputExclusions",
      "toolEnvironment",
      "systemLoaderClosureComplete",
    ])
      assert.deepEqual(
        after[/** @type {keyof typeof after} */ (key)],
        before[key],
        "Build closure changed: " + key,
      );
    return after;
  } finally {
    if (parentPATH === undefined) delete process.env.PATH;
    else process.env.PATH = parentPATH;
  }
}
/** Copy ONLY captured ordinary assets/notices and producer binaries to candidate.
 * @param {any} ledger @param {string} output @param {string} executable */
export async function publishNativeCandidate(ledger, output, executable) {
  const route = auditedProbeRoute(ledger.identifier);
  const candidate = await auditedProbeOutput(output, route.identifier),
    app = await fileRow(await ordinary(executable));
  assert.ok(
    (await readFile(executable)).includes(Buffer.from(route.identifier)),
  );
  const artifact = join(candidate, route.artifactName);
  await copyFile(executable, artifact);
  assert.equal(
    digest(await readFile(artifact)),
    app.sha256,
    "Published native executable differs",
  );
  const copy = async (
    /** @type {any[]} */ rows,
    /** @type {string} */ base,
    /** @type {string} */ destination,
  ) => {
    for (const row of rows) {
      const to = join(candidate, destination, relative(base, row.path));
      if (row.kind === "directory") await mkdir(to, { recursive: true });
      else if (row.kind === "file") {
        await mkdir(dirname(to), { recursive: true });
        await copyFile(row.path, to);
        assert.equal(digest(await readFile(to)), row.sha256);
      }
    }
  };
  await copy(ledger.assets, join(root, "build"), "frontend");
  await copy(ledger.notices, join(root, "src-tauri/notices"), "notices");
  const sidecar = join(candidate, "spectral-linter.exe");
  await copyFile(ledger.authority.spectral.binary, sidecar);
  assert.equal(
    digest(await readFile(sidecar)),
    ledger.spectral.find(
      (/** @type {any} */ row) =>
        row.path === resolve(ledger.authority.spectral.binary),
    ).sha256,
    "Published sidecar differs",
  );
  return {
    artifact,
    app: { ...app, path: artifact },
    sidecar: await fileRow(sidecar),
    closureSHA256: digest(JSON.stringify(ledger)),
  };
}
