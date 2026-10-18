// Explicit manual CI retention through the native gh CLI; never publishes a release.
import { appendFile, lstat, realpath } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const planOnly = process.argv.length === 3 && process.argv[2] === "--plan";
if (!planOnly && process.argv.length !== 2)
  throw Error("Usage: bun scripts/retain-desktop-packages.mjs [--plan]");
const {
  GITHUB_REPOSITORY: repository,
  GITHUB_SHA: sha,
  GITHUB_RUN_ID: runId,
  GITHUB_RUN_ATTEMPT: attempt,
  BUILD_TARGET: target,
} = process.env;
if (
  process.env.GITHUB_SERVER_URL !== "https://github.com" ||
  !/^[\w.-]+\/[\w.-]+$/.test(repository || "") ||
  !/^[a-f0-9]{40}$/.test(sha || "") ||
  !/^[1-9]\d*$/.test(runId || "") ||
  !/^[1-9]\d*$/.test(attempt || "") ||
  ![
    "x86_64-unknown-linux-gnu",
    "x86_64-pc-windows-msvc",
    "universal-apple-darwin",
  ].includes(target)
)
  throw Error("Invalid desktop retention coordinates.");
if (!planOnly && process.env.GITHUB_EVENT_NAME !== "workflow_dispatch")
  throw Error("Desktop retention requires explicit manual workflow dispatch.");

const manifest = resolve("desktop-packages.json");
const manifestStat = await lstat(manifest);
if (
  !manifestStat.isFile() ||
  manifestStat.isSymbolicLink() ||
  manifestStat.size > 1024 * 1024
)
  throw Error("Package manifest must be an ordinary file.");
const manifestBytes = await Bun.file(manifest).arrayBuffer();
const records = JSON.parse(
  new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes),
);
if (!Array.isArray(records) || records.length < 1 || records.length > 40)
  throw Error("Package manifest must contain 1–40 packages.");
const root = await realpath(
  join("src-tauri", "target", target, "release", "bundle"),
);
const assets = [];
const names = new Set(["desktop-packages.json"]);
for (const record of records) {
  if (
    !record ||
    typeof record.path !== "string" ||
    !record.path ||
    record.path.includes("\\") ||
    record.path.includes("#") ||
    isAbsolute(record.path) ||
    record.path
      .split("/")
      .some((part) => !part || part === "." || part === "..") ||
    !/\.(deb|rpm|AppImage|msi|exe|dmg)$/.test(record.path) ||
    !Number.isSafeInteger(record.bytes) ||
    record.bytes < 1 ||
    record.bytes >= 2 ** 31 ||
    !/^[a-f0-9]{64}$/.test(record.sha256 || "")
  )
    throw Error("Invalid desktop package record.");
  const path = join(root, record.path);
  const stat = await lstat(path);
  const actual = await realpath(path);
  const inside = relative(root, actual);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    !inside ||
    isAbsolute(inside) ||
    inside === ".." ||
    inside.startsWith(".." + sep) ||
    actual.includes("#")
  )
    throw Error(
      "Desktop package must be an ordinary file inside the bundle directory.",
    );
  const name = basename(record.path);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || names.has(name))
    throw Error(
      "Release asset names must be unique and use letters, digits, dot, underscore or hyphen.",
    );
  names.add(name);
  const file = Bun.file(actual);
  const hash = new Bun.CryptoHasher("sha256");
  for await (const chunk of file.stream()) hash.update(chunk);
  if (file.size !== record.bytes || hash.digest("hex") !== record.sha256)
    throw Error("Desktop package changed after its manifest was generated.");
  assets.push({
    path: actual,
    name,
    bytes: record.bytes,
    sha256: record.sha256,
  });
}
assets.push({
  path: manifest,
  name: "desktop-packages.json",
  bytes: manifestBytes.byteLength,
  sha256: new Bun.CryptoHasher("sha256").update(manifestBytes).digest("hex"),
});
const tag = `ci-${runId}-${attempt}-${target}-${sha.slice(0, 12)}`;
const payload = {
  tag_name: tag,
  target_commitish: sha,
  name: `CI packages ${target} · run ${runId}/${attempt}`,
  draft: true,
  prerelease: true,
  body:
    `Unpublished CI package retention.\n\nSource: ${sha}\nTarget: ${target}\nRun: https://github.com/${repository}/actions/runs/${runId}\n\nUnsigned build outputs; signing, installation and runtime acceptance remain separate.\n\n` +
    assets
      .map(
        (asset) =>
          `${asset.name}: ${asset.bytes} bytes, SHA256 ${asset.sha256}`,
      )
      .join("\n"),
};
if (planOnly) {
  console.log(
    JSON.stringify({ repository, payload, assets, network: false }, null, 2),
  );
} else {
  const token = process.env.GH_TOKEN;
  delete process.env.GH_TOKEN;
  if (!token)
    throw Error("The manual retention step requires its job-scoped GH_TOKEN.");
  const env = {
    ...process.env,
    GH_TOKEN: token,
    GH_HOST: "github.com",
    GH_PROMPT_DISABLED: "1",
  };
  async function gh(args, input) {
    const child = Bun.spawn(["gh", ...args], {
      env,
      stdin: input == null ? "ignore" : Buffer.from(JSON.stringify(input)),
      stdout: "pipe",
      stderr: "pipe",
      windowsHide: true,
    });
    const [output, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code) throw Error(`Native gh failed (${code}): ${error.trim()}`);
    return output;
  }
  const api = (path, input) =>
    gh(
      [
        "api",
        "--hostname",
        "github.com",
        "-H",
        "Accept: application/vnd.github+json",
        ...(input == null ? [] : ["--method", "POST", "--input", "-"]),
        `repos/${repository}/${path}`,
      ],
      input,
    ).then(JSON.parse);
  let release;
  try {
    release = await api("releases", payload);
    if (
      !Number.isSafeInteger(release.id) ||
      release.id < 1 ||
      release.draft !== true ||
      release.tag_name !== tag ||
      release.target_commitish !== sha
    )
      throw Error("GitHub returned an unexpected draft release.");
    for (const asset of assets) {
      const current = await api(`releases/${release.id}`);
      if (
        !current.draft ||
        current.tag_name !== tag ||
        current.target_commitish !== sha
      )
        throw Error("Draft release changed before upload.");
      // No --clobber, deletion, release editing or publication is permitted here.
      await gh(["release", "upload", tag, asset.path, "--repo", repository]);
    }
    const uploaded = await api(`releases/${release.id}/assets?per_page=100`);
    if (!Array.isArray(uploaded) || uploaded.length !== assets.length)
      throw Error(
        "Uploaded asset inventory does not match the package manifest.",
      );
    for (const asset of assets) {
      const remote = uploaded.find((value) => value.name === asset.name);
      if (
        !remote ||
        remote.state !== "uploaded" ||
        remote.size !== asset.bytes ||
        remote.digest !== `sha256:${asset.sha256}`
      )
        throw Error("Uploaded asset size or SHA256 did not match.");
    }
    const current = await api(`releases/${release.id}`);
    if (
      current.draft !== true ||
      current.tag_name !== tag ||
      current.target_commitish !== sha
    )
      throw Error("Retained release is no longer the expected draft.");
    const receipt = {
      repository,
      source: sha,
      target,
      runId,
      attempt,
      releaseId: release.id,
      draft: true,
      url: current.html_url,
      assets: uploaded.map(({ id, name, size, digest }) => ({
        id,
        name,
        size,
        digest,
      })),
    };
    await Bun.write(
      "desktop-retention.json",
      JSON.stringify(receipt, null, 2) + "\n",
    );
    const summary =
      `\n### Retained desktop packages\n\nUnpublished draft: ${current.html_url}\n\nSource: ${sha}\n\n` +
      assets
        .map(
          (asset) =>
            `- ${asset.name}: ${asset.bytes} bytes, SHA256 ${asset.sha256}`,
        )
        .join("\n") +
      "\n";
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  } catch (error) {
    if (release?.id)
      console.error(
        `Draft release ${release.id} was preserved for inspection; partial assets were not deleted.`,
      );
    throw error;
  }
}
