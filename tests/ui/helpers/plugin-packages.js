import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";

/** Read-only before/after evidence for a fixture tree.
 * @param {string} directory */
export async function pluginTreeSnapshot(directory) {
  /** @type {Record<string,string>} */
  const files = {};
  /** @param {string} path */
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile())
        files[relative(directory, target)] = createHash("sha256")
          .update(await readFile(target))
          .digest("hex");
    }
  }
  await walk(directory);
  return files;
}

/** Saved package-discovery corpus; never imports fixture package code.
 * @param {string} directory */
export async function pluginPackageFixtures(directory) {
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  const packages = [
    {
      path: "plain",
      name: "insomnia-plugin-fixture",
      description:
        "Fixture with an intentionally long description for responsive layout. ".repeat(
          4,
        ),
      dependencies: { lodash: "1" },
      optionalDependencies: { optional: "1" },
      peerDependencies: { peer: "1" },
    },
    { path: "duplicate-a", name: "insomnia-plugin-duplicate" },
    { path: "duplicate-b", name: "insomnia-plugin-duplicate" },
    { path: "@fixture/scoped", name: "@fixture/scoped" },
    { path: "node_modules/nested", name: "insomnia-plugin-nested" },
    {
      path: "node_modules/@fixture/nested-scope",
      name: "@fixture/nested-scope",
    },
    {
      path: "esm",
      name: "insomnia-plugin-esm",
      type: "module",
      main: "main.mjs",
    },
    {
      path: "missing",
      name: "insomnia-plugin-missing",
      main: "missing.js",
      missing: true,
    },
    {
      path: "escape",
      name: "insomnia-plugin-escape",
      main: "../outside.js",
      missing: true,
    },
    { path: "native", name: "insomnia-plugin-native", main: "index.node" },
    { path: "json", name: "insomnia-plugin-json", main: "index.json" },
    { path: "bad-name", name: "../invalid" },
    {
      path: "fallback",
      name: "insomnia-plugin-fallback",
      main: "lib",
      file: "lib/index.js",
    },
  ];
  const marker = join(root, "executed-marker.txt");
  for (const definition of packages) {
    const { path, missing, file, ...metadata } = definition;
    const target = join(root, path);
    await mkdir(target, { recursive: true });
    await Bun.write(
      join(target, "package.json"),
      JSON.stringify({
        insomnia: { description: "Fallback description" },
        version: "1.2.3",
        ...metadata,
      }),
    );
    if (missing) continue;
    const entry = join(target, file || metadata.main || "index.js");
    await mkdir(resolve(entry, ".."), { recursive: true });
    await Bun.write(
      entry,
      metadata.main === "index.json"
        ? "{}"
        : `require('fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); throw new Error('Package code must not run during discovery');`,
    );
  }
  await Bun.write(join(root, "outside.js"), "throw Error('Outside package');");
  for (const path of ["malformed", "oversized", "ordinary"])
    await mkdir(join(root, path), { recursive: true });
  await Bun.write(join(root, "malformed/package.json"), "{broken");
  await Bun.write(
    join(root, "oversized/package.json"),
    JSON.stringify({
      name: "insomnia-plugin-oversized",
      insomnia: {},
      description: "x".repeat(256 * 1024),
    }),
  );
  await Bun.write(
    join(root, "ordinary/package.json"),
    JSON.stringify({ name: "ordinary-library", main: "index.js" }),
  );
  const large = root + "-large";
  await mkdir(large, { recursive: true });
  for (let index = 0; index < 513; index++)
    await Bun.write(join(large, `entry-${index}.txt`), "fixture");
  return {
    root,
    large,
    marker,
    packages,
    before: await pluginTreeSnapshot(root),
  };
}
