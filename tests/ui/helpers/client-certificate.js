import assert from "node:assert/strict";
import { mkdir, realpath, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { poll } from "./native-app.js";
import { X509Certificate } from "node:crypto";

/** Per-run private CA, server and client identities. Trust stays inside the owned fixture/app.
 * @param {string} output @param {{grpc?:boolean}} [options] */
export async function clientCertificateFixture(output, options = {}) {
  const root = await realpath(output);
  const relation = relative(resolve("artifacts/playwright"), root);
  assert.ok(relation && !relation.startsWith("..") && !relation.includes(":"));
  const directory = join(root, "owned-client-certificates");
  await mkdir(directory);
  const openssl = "C:/Program Files/Git/usr/bin/openssl.exe";
  /** @param {string[]} args */
  const run = (args) => {
    const result = Bun.spawnSync([openssl, ...args], { windowsHide: true });
    assert.equal(result.exitCode, 0, result.stderr.toString());
  };
  /** @param {string} name */
  const authority = (name) => {
    run([
      "req",
      "-x509",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-256",
      "-noenc",
      "-keyout",
      join(directory, name + ".key"),
      "-out",
      join(directory, name + ".pem"),
      "-days",
      "1",
      "-subj",
      "/CN=Insomnium owned " + name,
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ]);
  };
  authority("ca");
  authority("other-ca");
  const clientName = "owned-client-" + crypto.randomUUID();
  /** @param {string} name @param {string} cn @param {string} issuer @param {string} extensions */
  const leaf = async (name, cn, issuer, extensions) => {
    await Bun.write(join(directory, name + ".extensions"), extensions);
    run([
      "req",
      "-new",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-256",
      "-noenc",
      "-keyout",
      join(directory, name + ".key"),
      "-out",
      join(directory, name + ".csr"),
      "-subj",
      "/CN=" + cn,
    ]);
    run([
      "x509",
      "-req",
      "-in",
      join(directory, name + ".csr"),
      "-CA",
      join(directory, issuer + ".pem"),
      "-CAkey",
      join(directory, issuer + ".key"),
      "-set_serial",
      "0x" + crypto.randomUUID().replaceAll("-", ""),
      "-out",
      join(directory, name + ".pem"),
      "-days",
      "1",
      "-extfile",
      join(directory, name + ".extensions"),
    ]);
    const certificate = await Bun.file(join(directory, name + ".pem")).text();
    const key = await Bun.file(join(directory, name + ".key")).text();
    return {
      certificate,
      key,
      identity: key + certificate,
      fingerprint: new X509Certificate(certificate).fingerprint256,
    };
  };
  const serverIdentity = await leaf(
    "server",
    "localhost",
    "ca",
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n",
  );
  const clientExtensions =
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\n";
  const client = await leaf("client", clientName, "ca", clientExtensions);
  const wrongClient = await leaf(
    "wrong-client",
    "owned-untrusted-client",
    "other-ca",
    clientExtensions,
  );
  const ca = await Bun.file(join(directory, "ca.pem")).text();
  const otherCa = await Bun.file(join(directory, "other-ca.pem")).text();
  /** @type {Array<{url:string,method:string,body:string,authorized:boolean,cn:string,fingerprint:string}>} */
  const requests = [];
  /** @type {Array<Record<string,any>>} */ const socketEvents = [];
  /** @type {Array<{url:string,method:string}>} */ const sinkRequests = [];
  assert.equal(
    process.platform,
    "win32",
    "Windows native TLS fixture compiler",
  );
  for (const [name, pem] of [
    ["server.der", serverIdentity.certificate],
    ["server-key.der", serverIdentity.key],
    ["ca.der", ca],
  ]) {
    await Bun.write(
      join(directory, name),
      Buffer.from(
        pem.replace(/-----[^\n]+-----/g, "").replace(/\s/g, ""),
        "base64",
      ),
    );
  }
  const executable = join(directory, "client-certificate-fixture.exe");
  const deps = resolve("src-tauri/target/release/deps");
  const vc =
    "C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023";
  const sdk = "C:/Program Files (x86)/Windows Kits/10";
  const version = "10.0.19041.0";
  const env = {
    ...process.env,
    CARGO_HOME: "D:/home/.cargo",
    RUSTUP_HOME: "D:/home/.rustup",
    PATH:
      vc +
      "/bin/Hostx64/x64;" +
      sdk +
      "/bin/" +
      version +
      "/x64;D:/home/.cargo/bin;" +
      process.env.PATH,
    LIB:
      vc +
      "/lib/x64;" +
      sdk +
      "/Lib/" +
      version +
      "/ucrt/x64;" +
      sdk +
      "/Lib/" +
      version +
      "/um/x64",
  };
  const args = [
    "--edition=2021",
    "-C",
    "panic=abort",
    "-C",
    "lto=yes",
    "--crate-name",
    "client_certificate_fixture",
    resolve("tests/ui/fixtures/client-certificate.rs"),
    "-L",
    "dependency=" + deps,
    "-o",
    executable,
  ];
  if (options.grpc) args.push("--cfg", "grpc_fixture");
  for (const name of [
    "rustls",
    "sha2",
    "serde_json",
    "x509_parser",
    "tungstenite",
    ...(options.grpc
      ? [
          "tokio",
          "tokio_rustls",
          "h2",
          "prost",
          "prost_types",
          "tonic_reflection",
        ]
      : []),
  ]) {
    const files = await Array.fromAsync(
      new Bun.Glob("lib" + name + "-*.rlib").scan(deps),
    );
    const candidates = await Promise.all(
      files.map(async (file) => ({
        file,
        modified: (await stat(join(deps, file))).mtimeMs,
      })),
    );
    candidates.sort((a, b) => b.modified - a.modified);
    assert.ok(
      candidates.length,
      "Accepted native release dependency required: " + name,
    );
    args.push("--extern", name + "=" + join(deps, candidates[0].file));
  }
  const compiler = Bun.spawn(["D:/home/.cargo/bin/rustc.exe", ...args], {
    env,
    stdout: "pipe",
    stderr: "pipe",
    windowsHide: true,
  });
  const diagnostic = new Response(compiler.stderr).text();
  assert.equal(await compiler.exited, 0, await diagnostic);
  const child = Bun.spawn(
    [
      executable,
      join(directory, "server.der"),
      join(directory, "server-key.der"),
      join(directory, "ca.der"),
    ],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe", windowsHide: true },
  );
  const errors = new Response(child.stderr).text();
  const state = {
    ready: /** @type {Record<string,any>|undefined} */ (undefined),
  };
  const connections = { primary: 0, sink: 0 };
  const rejected = /** @type {Array<Record<string,any>>} */ ([]);
  const grpcRequests = /** @type {Array<Record<string,any>>} */ ([]);
  const grpcConnections = { count: 0 };
  const grpcEvents = /** @type {Array<Record<string,any>>} */ ([]);
  const drain = (async () => {
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let end;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end).trim();
        pending = pending.slice(end + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.event === "ready") state.ready = event;
        else if (event.event === "grpc-request") grpcRequests.push(event);
        else if (event.event === "grpc-connection") grpcConnections.count++;
        else if (
          [
            "grpc-open",
            "grpc-message",
            "grpc-end",
            "grpc-cancelled",
            "grpc-reflection",
            "grpc-reflection-unimplemented",
          ].includes(event.event)
        )
          grpcEvents.push(event);
        else if (event.event === "request") {
          if (event.role === "sink")
            sinkRequests.push({ url: event.url, method: event.method });
          else requests.push(event);
        } else if (event.event === "connection") {
          if (event.role === "sink") connections.sink++;
          else connections.primary++;
        } else if (event.event === "rejected") rejected.push(event);
        else if (["socket-message", "socket-close"].includes(event.event))
          socketEvents.push(event);
      }
    }
  })();
  const close = async () => {
    await Bun.write(
      join(directory, "fixture-observations.json"),
      JSON.stringify(
        {
          requests,
          sinkRequests,
          connections,
          rejected,
          socketEvents,
          grpcRequests,
          grpcConnections,
          grpcEvents,
        },
        null,
        2,
      ),
    );
    child.stdin.write("stop\n");
    child.stdin.end();
    const exited = await Promise.race([
      child.exited,
      Bun.sleep(10000).then(() => null),
    ]);
    if (exited === null) {
      child.kill();
      await child.exited;
    }
    await drain;
    assert.equal(exited, 0, await errors);
  };
  try {
    await poll(
      async () => !!state.ready,
      "Native mTLS fixture listening",
      15000,
    );
  } catch (error) {
    await close();
    throw error;
  }
  assert.ok(state.ready);
  const primary = { url: String(state.ready.primary) };
  const sink = { url: String(state.ready.sink) };
  return {
    ca,
    otherCa,
    client,
    wrongClient,
    clientName,
    primary,
    sink,
    requests,
    socketEvents,
    sinkRequests,
    connections,
    rejected,
    grpc: { url: String(state.ready.grpc) },
    grpcAlpha: { url: String(state.ready.grpcAlpha) },
    grpcRequests,
    grpcConnections,
    grpcEvents,
    async verifyFixture() {
      for (const endpoint of [primary, sink]) {
        const response = await fetch(endpoint.url + "/fixture-check", {
          method: "POST",
          body: "fixture self-check",
          signal: AbortSignal.timeout(5000),
          tls: {
            ca,
            cert: client.certificate,
            key: client.key,
            rejectUnauthorized: true,
          },
        });
        assert.equal(response.status, 200);
        assert.equal(await response.text(), "owned mTLS response");
      }
      assert.equal(requests.length, 1);
      assert.equal(requests[0].authorized, true);
      assert.equal(requests[0].cn, clientName);
      assert.equal(requests[0].fingerprint, client.fingerprint);
      assert.equal(sinkRequests.length, 1);
      assert.ok(connections.primary > 0 && connections.sink > 0);
      requests.length = 0;
      sinkRequests.length = 0;
      connections.primary = 0;
      connections.sink = 0;
    },
    close,
  };
}
