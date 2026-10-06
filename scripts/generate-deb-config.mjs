import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { elfAbi } from "./generate-appimage-config.mjs";

export async function main(args = Bun.argv.slice(2)) {
  const [binaryArgument, outputArgument, ...extra] = args;
  if (
    process.platform !== "linux" ||
    !binaryArgument ||
    !outputArgument ||
    extra.length
  ) {
    throw new Error(
      "Usage (Debian/Ubuntu): bun scripts/generate-deb-config.mjs <built-ELF> <output.json>",
    );
  }
  const binary = resolve(binaryArgument),
    output = resolve(outputArgument);
  if (binary === output)
    throw new Error("Output must differ from the executable");
  await elfAbi(binary);
  const command = Bun.which("dpkg-shlibdeps");
  if (!command) throw new Error("Install dpkg-dev before Debian packaging");
  const directory = await mkdtemp(join(tmpdir(), "insomnium-shlibdeps-"));
  try {
    // Isolate dpkg metadata; never read/write a developer's debian/substvars.
    await Bun.write(
      join(directory, "debian/control"),
      "Source: insomnium\n\nPackage: insomnium\nArchitecture: any\nDescription: Insomnium shared-library dependency analysis\n",
    );
    // Dpkg::Path recognizes a package root by its DEBIAN directory.
    await mkdir(join(directory, "debian/insomnium/DEBIAN"), {
      recursive: true,
    });
    const staged = join(directory, "debian/insomnium/usr/bin/insomnium");
    await Bun.write(staged, "");
    await copyFile(binary, staged);
    const child = Bun.spawn(
      [command, "-O", "-edebian/insomnium/usr/bin/insomnium"],
      {
        cwd: directory,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (stderr.trim()) console.error(stderr.trim());
    if (code !== 0) throw new Error("dpkg-shlibdeps failed (" + code + ")");
    const lines = stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith("shlibs:Depends="));
    if (
      lines.length !== 1 ||
      !lines[0].slice("shlibs:Depends=".length).trim()
    ) {
      throw new Error(
        "dpkg-shlibdeps returned no unambiguous requirements; refusing incomplete Debian metadata",
      );
    }
    // Alternatives (a | b) stay together; each comma introduces another group.
    const depends = [
      ...new Set(
        lines[0]
          .slice("shlibs:Depends=".length)
          .split(",")
          .map((value) => value.trim()),
      ),
    ].sort();
    if (depends.some((value) => !value))
      throw new Error("Invalid empty Debian requirement");
    await Bun.write(
      output,
      JSON.stringify({ bundle: { linux: { deb: { depends } } } }, null, 2) +
        "\n",
    );
    console.log(
      "Wrote " + depends.length + " Debian ELF requirements to " + output,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (import.meta.main) await main();
