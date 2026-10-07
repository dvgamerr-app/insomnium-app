import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

/** Per-run untrusted certificate; never installs trust or changes client TLS.
 * @param {string} output */
export async function serveUntrustedGitTls(output) {
  const root = await realpath(output);
  const relation = relative(resolve("artifacts/playwright"), root);
  assert.ok(relation && !relation.startsWith("..") && !relation.includes(":"));
  const directory = join(root, "owned-untrusted-tls");
  await mkdir(directory);
  const key = join(directory, "server.key");
  const cert = join(directory, "server.pem");
  const command = [
    "C:/Program Files/Git/usr/bin/openssl.exe",
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-noenc",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=owned-git-tls.invalid",
    "-addext",
    "subjectAltName=IP:127.0.0.1",
    "-addext",
    "basicConstraints=critical,CA:FALSE",
  ];
  const generated = Bun.spawnSync(command, { windowsHide: true });
  assert.equal(generated.exitCode, 0, generated.stderr.toString());
  const state = { requests: 0, posts: 0, credentialRequests: 0 };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    tls: { key: Bun.file(key), cert: Bun.file(cert) },
    fetch(request) {
      state.requests++;
      if (request.method === "POST") state.posts++;
      if (request.headers.has("Authorization")) state.credentialRequests++;
      return new Response("", { status: 503 });
    },
  });
  return {
    state,
    url: `https://127.0.0.1:${server.port}/repo.git`,
    close: () => server.stop(true),
  };
}
