import { resolve } from "node:path";

// WebKit loads GLES with dlopen(), so ldd/linuxdeploy cannot discover it.
// Match the built ELF rather than selecting the first host library.
export async function elfAbi(path) {
  const bytes = new Uint8Array(await Bun.file(path).slice(0, 20).arrayBuffer());
  if (
    bytes.length < 20 ||
    bytes[0] !== 127 ||
    bytes[1] !== 69 ||
    bytes[2] !== 76 ||
    bytes[3] !== 70 ||
    ![1, 2].includes(bytes[4]) ||
    ![1, 2].includes(bytes[5])
  )
    throw new Error("Not a supported ELF: " + path);
  const machine = new DataView(bytes.buffer).getUint16(18, bytes[5] === 1);
  return [bytes[4], bytes[5], machine].join(":");
}

export async function main(args = Bun.argv.slice(2)) {
  const [binaryArgument, outputArgument, ...extra] = args;
  if (
    process.platform !== "linux" ||
    !binaryArgument ||
    !outputArgument ||
    extra.length
  ) {
    throw new Error(
      "Usage (Linux): bun scripts/generate-appimage-config.mjs <built-ELF> <output.json>",
    );
  }
  const binary = resolve(binaryArgument),
    output = resolve(outputArgument);
  if (binary === output)
    throw new Error("Output must differ from the executable");
  const abi = await elfAbi(binary);
  const command = Bun.which("ldconfig") ?? "/sbin/ldconfig";
  const child = Bun.spawn([command, "-p"], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error("ldconfig failed: " + stderr.trim());
  const candidates = stdout.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*libGLESv2\.so\.2\s+\([^)]*\)\s+=>\s+(\/.*)$/);
    return match ? [match[1]] : [];
  });
  let library;
  for (const path of candidates) {
    if ((await elfAbi(path)) === abi) {
      library = path;
      break;
    }
  }
  if (!library)
    throw new Error(
      "Install libGLESv2.so.2 for the built ELF architecture before AppImage packaging (Debian/Ubuntu: libgles2).",
    );
  const notices = process.env.INSOMNIUM_GLES_LICENSE
    ? [resolve(process.env.INSOMNIUM_GLES_LICENSE)]
    : [
        "/usr/share/doc/libgles2/copyright",
        "/usr/share/licenses/libglvnd/LICENSE",
      ];
  let notice;
  for (const path of notices) {
    if (
      (await Bun.file(path).exists()) &&
      (await Bun.file(path).text()).trim()
    ) {
      notice = path;
      break;
    }
  }
  if (!notice)
    throw new Error(
      "GLES license notice missing; set INSOMNIUM_GLES_LICENSE to the matching library package notice.",
    );
  const files = {
    "/usr/lib/libGLESv2.so.2": library,
    "/usr/share/licenses/insomnium/libGLESv2.txt": notice,
  };
  await Bun.write(
    output,
    JSON.stringify({ bundle: { linux: { appimage: { files } } } }, null, 2) +
      "\n",
  );
  console.log("AppImage GLES (" + abi + "): " + library);
}
if (import.meta.main) await main();
