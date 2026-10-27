import { createSocket } from "node:dgram";
import assert from "node:assert/strict";
import { mkdir, realpath, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { poll } from "./native-app.js";
import { X509Certificate } from "node:crypto";
import { pfxContainers } from "./pfx-containers.js";

/** Shared pinned-policy input for the reference client and native DNS TXT.
 * @param {number} enforcement */
export function grpcOutlierConfig(enforcement) {
  assert.ok([0, 100].includes(enforcement));
  return {
    loadBalancingConfig: [{outlier_detection: {
      interval: {seconds:0,nanos:100000000},
      base_ejection_time: {seconds:1,nanos:0},
      max_ejection_time: {seconds:1,nanos:0},
      max_ejection_percent:100,
      failure_percentage_ejection: {threshold:0,enforcement_percentage:enforcement,minimum_hosts:1,request_volume:1},
      child_policy: [{round_robin:{}}],
    }}],
    methodConfig: [{name:[{service:'owned.Sample'}],retryPolicy:{maxAttempts:2,initialBackoff:'0.01s',maxBackoff:'0.1s',backoffMultiplier:2,retryableStatusCodes:['UNAVAILABLE']}}],
  };
}

/** Per-run private CA, server and client identities. Trust stays inside the owned fixture/app.
 * @param {string} output @param {{grpc?:boolean,fileIdentities?:boolean,multipleIdentities?:boolean,grpcPolicy?:boolean,grpcOrca?:boolean,grpcOutlier?:boolean,grpcOutlierRecovery?:boolean,grpcStatusNames?:boolean,grpcBudget?:boolean,grpcEmptyBudget?:boolean,grpcThrottle?:boolean,grpcThrottleResize?:boolean,grpcThrottleReset?:boolean,grpcDeadline?:boolean,grpcPolicyDeadline?:boolean,grpcResolverHold?:boolean}} [options] */
export async function clientCertificateFixture(output, options = {}) {
  const root = await realpath(output);
  const relation = relative(resolve("artifacts/playwright"), root);
  assert.ok(relation && !relation.startsWith("..") && !relation.includes(":"));
  const directory = join(root, "owned-client-certificates");
  await mkdir(directory);
  const openssl = "C:/Program Files/Git/usr/bin/openssl.exe";
  /** @param {string[]} args */
  const run = (args) => {
    // The MSYS executable cannot load the MinGW legacy provider DLL.
    const executable =
      args[0] === "pkcs12"
        ? "C:/Program Files/Git/mingw64/bin/openssl.exe"
        : openssl;
    const result = Bun.spawnSync([executable, ...args], { windowsHide: true });
    assert.equal(result.exitCode, 0, result.stderr.toString());
  };
  /** @param {string} name */
  const authority = (name, rsa = false) => {
    run([
      "req",
      "-x509",
      "-newkey",
      ...(rsa ? ["rsa:2048"] : ["ec", "-pkeyopt", "ec_paramgen_curve:P-256"]),
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
  if (options.multipleIdentities) authority("rsa-ca", true);
  const configPath = join(directory, "validity-ca.cnf");
  const configFile = (/** @type {string} */ name) =>
    join(directory, name).replaceAll("\\", "/");
  await Bun.write(join(directory, "validity-index"), "");
  await Bun.write(join(directory, "validity-serial"), "1000\n");
  await Bun.write(
    configPath,
    `[ca]\ndefault_ca = owned\n[owned]\ndatabase = "${configFile("validity-index")}"\nserial = "${configFile("validity-serial")}"\nnew_certs_dir = "${directory.replaceAll("\\", "/")}"\ncertificate = "${configFile("ca.pem")}"\nprivate_key = "${configFile("ca.key")}"\ndefault_md = sha256\ndefault_days = 1\nunique_subject = no\npolicy = owned_policy\nx509_extensions = leaf\n[owned_policy]\ncommonName = supplied\n`,
  );
  const clientName = "owned-client-" + crypto.randomUUID();
  /** @param {string} name @param {string} cn @param {string} issuer @param {string} extensions @param {{start:string,end:string}} [dates] */
  const leaf = async (name, cn, issuer, extensions, dates, rsa = false) => {
    await Bun.write(
      join(directory, name + ".extensions"),
      (dates ? "[leaf]\n" : "") + extensions,
    );
    run([
      "req",
      "-new",
      "-newkey",
      ...(rsa ? ["rsa:2048"] : ["ec", "-pkeyopt", "ec_paramgen_curve:P-256"]),
      "-noenc",
      "-keyout",
      join(directory, name + ".key"),
      "-out",
      join(directory, name + ".csr"),
      "-subj",
      "/CN=" + cn,
    ]);
    run(
      dates
        ? [
            "ca",
            "-batch",
            "-notext",
            "-config",
            configPath,
            "-in",
            join(directory, name + ".csr"),
            "-out",
            join(directory, name + ".pem"),
            "-startdate",
            dates.start,
            "-enddate",
            dates.end,
            "-extfile",
            join(directory, name + ".extensions"),
            "-extensions",
            "leaf",
          ]
        : [
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
          ],
    );
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
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n".replace("DNS:localhost",options.grpcPolicy ? "DNS:localhost,DNS:owned-policy.test" : "DNS:localhost"),
  );
  const serverExtensions =
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n";
  const now = Date.now();
  const date = (/** @type {number} */ offset) =>
    new Date(now + offset * 3600000)
      .toISOString()
      .replaceAll(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z")
      .replace("T", "");
  const serverVariants = [
    {
      id: "hostname",
      identity: await leaf(
        "hostname",
        "localhost",
        "ca",
        serverExtensions.replace(
          "IP:127.0.0.1,DNS:localhost",
          "DNS:owned.invalid",
        ),
      ),
      code: 64,
    },
    {
      id: "expired",
      identity: await leaf("expired", "localhost", "ca", serverExtensions, {
        start: date(-2),
        end: date(-1),
      }),
      code: 10,
    },
    {
      id: "future",
      identity: await leaf("future", "localhost", "ca", serverExtensions, {
        start: date(1),
        end: date(2),
      }),
      code: 9,
    },
  ];
  const serverCertificates = [];
  for (const variant of serverVariants) {
    const certificate = new X509Certificate(variant.identity.certificate);
    assert.equal(
      certificate.verify(
        new X509Certificate(await Bun.file(join(directory, "ca.pem")).text())
          .publicKey,
      ),
      true,
    );
    const result = Bun.spawnSync(
      [
        openssl,
        "verify",
        "-no-CApath",
        "-no-CAfile",
        "-CAfile",
        join(directory, "ca.pem"),
        "-purpose",
        "sslserver",
        "-verify_ip",
        "127.0.0.1",
        join(directory, variant.id + ".pem"),
      ],
      { windowsHide: true },
    );
    assert.notEqual(result.exitCode, 0);
    const verification = result.stderr.toString() + result.stdout.toString();
    assert.match(
      verification,
      new RegExp("error " + variant.code + " at 0 depth"),
    );
    const chain = Bun.spawnSync(
      [
        openssl,
        "verify",
        "-no-CApath",
        "-no-CAfile",
        "-CAfile",
        join(directory, "ca.pem"),
        "-purpose",
        "sslserver",
        "-no_check_time",
        join(directory, variant.id + ".pem"),
      ],
      { windowsHide: true },
    );
    assert.equal(chain.exitCode, 0, chain.stderr.toString());
    if (variant.id === "hostname")
      assert.equal(certificate.checkIP("127.0.0.1"), undefined);
    if (variant.id === "expired")
      assert.ok(Date.parse(certificate.validTo) < now);
    if (variant.id === "future")
      assert.ok(Date.parse(certificate.validFrom) > now);
    serverCertificates.push({
      id: variant.id,
      fingerprint: certificate.fingerprint256,
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      subjectAltName: certificate.subjectAltName,
      verification,
    });
  }
  await Bun.write(
    join(directory, "server-certificate-validation.json"),
    JSON.stringify(serverCertificates, null, 2),
  );
  const clientExtensions =
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\n";
  const client = await leaf("client", clientName, "ca", clientExtensions);
  const rsaClient = options.multipleIdentities
    ? await leaf(
        "rsa-client",
        "owned-rsa-client",
        "rsa-ca",
        clientExtensions,
        undefined,
        true,
      )
    : null;
  const secondClient = options.multipleIdentities
    ? await leaf("second-client", "owned-second-client", "ca", clientExtensions)
    : null;
  const rsaFiles = {
    cert: join(directory, "rsa-client.pem"),
    key: join(directory, "rsa-client.key"),
    pfx: join(directory, "rsa-client.pfx"),
  };
  const password = "owned-PFX-" + crypto.randomUUID();
  const identityFiles = {
    cert: join(directory, "client.pem"),
    key: join(directory, "client.key"),
    pfx: join(directory, "client.pfx"),
    legacyPfx: join(directory, "client-legacy.pfx"),
    encryptedKey: join(directory, "client-encrypted.key"),
    combined: join(directory, "client-combined.pem"),
    combinedWrongKey: join(directory, "client-wrong-combined.pem"),
    legacyKeys: ["aes128", "aes192", "aes256", "des3"].map((cipher) => ({
      cipher,
      path: join(directory, "client-" + cipher + ".key"),
    })),
    password,
  };
  if (options.fileIdentities) {
    if (secondClient) {
      run([
        "pkcs12",
        "-export",
        "-in",
        join(directory, "second-client.pem"),
        "-inkey",
        join(directory, "second-client.key"),
        "-out",
        join(directory, "second-client-leaf-only.pfx"),
        "-passout",
        "pass:" + password,
      ]);
      const certificates = join(
        directory,
        "second-client-leaf-only-certificates.pem",
      );
      run([
        "pkcs12",
        "-in",
        join(directory, "second-client-leaf-only.pfx"),
        "-nokeys",
        "-passin",
        "pass:" + password,
        "-out",
        certificates,
      ]);
      const pem = await Bun.file(certificates).text();
      assert.equal(
        (pem.match(/-----BEGIN CERTIFICATE-----/g) || []).length,
        1,
        "Independent OpenSSL decode proves leaf-only PFX has no extra CA",
      );
      assert.equal(
        new X509Certificate(pem).fingerprint256,
        secondClient.fingerprint,
      );
      await Bun.write(
        join(directory, "leaf-only-pfx-baseline.json"),
        JSON.stringify({
          certificateCount: 1,
          fingerprint: secondClient.fingerprint,
          extraCertificates: 0,
        }),
      );
    }
    if (rsaClient)
      run([
        "pkcs12",
        "-export",
        "-in",
        rsaFiles.cert,
        "-inkey",
        rsaFiles.key,
        "-certfile",
        join(directory, "rsa-ca.pem"),
        "-out",
        rsaFiles.pfx,
        "-passout",
        "pass:" + password,
      ]);
    for (const legacy of [false, true]) {
      run([
        "pkcs12",
        "-export",
        ...(legacy
          ? [
              "-legacy",
              "-provider-path",
              "C:/Program Files/Git/mingw64/lib/ossl-modules",
            ]
          : []),
        "-in",
        identityFiles.cert,
        "-inkey",
        identityFiles.key,
        "-certfile",
        join(directory, "ca.pem"),
        "-name",
        "owned-client",
        "-out",
        legacy ? identityFiles.legacyPfx : identityFiles.pfx,
        "-passout",
        "pass:" + password,
      ]);
    }
    run([
      "pkcs8",
      "-topk8",
      "-v2",
      "aes-256-cbc",
      "-iter",
      "2048",
      "-in",
      identityFiles.key,
      "-out",
      identityFiles.encryptedKey,
      "-passout",
      "pass:" + password,
    ]);
    await Bun.write(
      identityFiles.combined,
      client.certificate + (await Bun.file(identityFiles.encryptedKey).text()),
    );
    for (const entry of identityFiles.legacyKeys) {
      run([
        "ec",
        "-in",
        identityFiles.key,
        "-" + entry.cipher,
        "-out",
        entry.path,
        "-passout",
        "pass:" + password,
      ]);
    }
  }
  const wrongClient = await leaf(
    "wrong-client",
    "owned-untrusted-client",
    "other-ca",
    clientExtensions,
  );
  if (options.fileIdentities)
    await Bun.write(
      identityFiles.combinedWrongKey,
      client.certificate + wrongClient.key,
    );
  const containers = options.fileIdentities
    ? await pfxContainers(directory, password)
    : [];
  const ca = await Bun.file(join(directory, "ca.pem")).text();
  const caFiles = {
    trusted: join(directory, "ca.pem"),
    other: join(directory, "other-ca.pem"),
    bundleFirst: join(directory, "ca-root-first.pem"),
    bundleLast: join(directory, "ca-root-last.pem"),
    empty: join(directory, "ca-empty.pem"),
    malformed: join(directory, "ca-malformed.pem"),
    noCertificates: join(directory, "ca-no-certificates.pem"),
    invalidDer: join(directory, "ca-invalid-der.pem"),
    invalidUtf8: join(directory, "ca-invalid-utf8.pem"),
    oversized: join(directory, "ca-oversized.pem"),
    directory,
    missing: join(directory, "ca-missing.pem"),
  };
  const otherCaContents = await Bun.file(caFiles.other).text();
  for (const [path, value] of [
    [caFiles.bundleFirst, ca + otherCaContents],
    [caFiles.bundleLast, otherCaContents + ca],
    [caFiles.empty, ""],
    [
      caFiles.malformed,
      "-----BEGIN CERTIFICATE-----\n%%%\n-----END CERTIFICATE-----",
    ],
    [caFiles.noCertificates, "owned CA fixture without PEM certificates"],
    [
      caFiles.invalidDer,
      "-----BEGIN CERTIFICATE-----\nBAEBAA==\n-----END CERTIFICATE-----",
    ],
    [caFiles.oversized, " ".repeat(1024 * 1024 + 1)],
  ])
    await Bun.write(path, value);
  await Bun.write(caFiles.invalidUtf8, new Uint8Array([255, 254, 253]));
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
    ...(options.multipleIdentities
      ? [["rsa-ca.der", await Bun.file(join(directory, "rsa-ca.pem")).text()]]
      : []),
    ...serverVariants.flatMap((variant) => [
      [variant.id + ".der", variant.identity.certificate],
      [variant.id + "-key.der", variant.identity.key],
    ]),
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
  if (options.multipleIdentities) args.push("--cfg", "multiple_identities");
  const fingerprintRoot=resolve('src-tauri/target/release/.fingerprint');
  const appFiles=await Array.fromAsync(new Bun.Glob('insomnium-*/lib-insomnium_lib.json').scan({cwd:fingerprintRoot}));
  const appCandidates=await Promise.all(appFiles.map(async path=>({path,modified:(await stat(join(fingerprintRoot,path))).mtimeMs})));
  appCandidates.sort((a,b)=>b.modified-a.modified);assert.ok(appCandidates.length,'Built application fingerprint required');
  const appFingerprint=await Bun.file(join(fingerprintRoot,appCandidates[0].path)).text();
  const libraryBindings=[];
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
          "flate2",
        ]
      : []),
  ]) {
    // Cargo dependency fingerprints are u64: retain decimal literals before
    // JSON parsing can round them, and match their little-endian disk form.
    let dependency=appFingerprint.match(new RegExp('\\[\\d+,"'+name+'",false,(\\d+)\\]'));
    if(!dependency&&name==='tokio_rustls'){
      const parent=appFingerprint.match(/\[\d+,"tonic",false,(\d+)\]/);assert.ok(parent,'Application tonic dependency required');
      for(const path of await Array.fromAsync(new Bun.Glob('tonic-*/lib-tonic').scan({cwd:fingerprintRoot}))){
        const bytes=(await Bun.file(join(fingerprintRoot,path)).text()).trim();
        if(/^[0-9a-f]{16}$/.test(bytes)&&BigInt('0x'+Buffer.from(bytes,'hex').reverse().toString('hex'))===BigInt(parent[1]))dependency=(await Bun.file(join(fingerprintRoot,path+'.json')).text()).match(/\[\d+,"tokio_rustls",false,(\d+)\]/);
      }
    }
    assert.ok(dependency,'Application library dependency missing: '+name);
    const files=await Array.fromAsync(new Bun.Glob(name.replaceAll('_','?')+'-*/lib-'+name).scan({cwd:fingerprintRoot}));
    const candidates=[];
    for(const path of files){const bytes=(await Bun.file(join(fingerprintRoot,path)).text()).trim();if(/^[0-9a-f]{16}$/.test(bytes)&&BigInt('0x'+Buffer.from(bytes,'hex').reverse().toString('hex'))===BigInt(dependency[1]))candidates.push(path);}
    assert.equal(candidates.length,1,'Exact built application library required: '+name);
    const unit=candidates[0].split(/[\\/]/)[0],suffix=unit.slice(unit.lastIndexOf('-')+1),file=join(deps,'lib'+name+'-'+suffix+'.rlib');
    assert.ok(await Bun.file(file).exists(),'Built application rlib missing: '+file);
    libraryBindings.push({name,path:file,fingerprint:candidates[0]});
    args.push('--extern',name+'='+file);
  }
  await Bun.write(join(directory,'fixture-library-bindings.json'),JSON.stringify({applicationFingerprint:appCandidates[0].path,libraries:libraryBindings},null,2));
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
      directory,
    ],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe", windowsHide: true },
  );
  const errors = new Response(child.stderr).text();
  const state = {
    ready: /** @type {Record<string,any>|undefined} */ (undefined),
  };
  const connections = {
    primary: 0,
    sink: 0,
    hostname: 0,
    expired: 0,
    future: 0,
  };
  const rejected = /** @type {Array<Record<string,any>>} */ ([]);
  const signatures = /** @type {Array<Record<string,any>>} */ ([]);
  const algorithmConnections = /** @type {Record<string,number>} */ ({});
  const grpcRequests = /** @type {Array<Record<string,any>>} */ ([]);
  const grpcConnections = { count: 0 };
  const grpcEvents = /** @type {Array<Record<string,any>>} */ ([]);
  const sseEvents = /** @type {Array<Record<string,any>>} */ ([]);
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
        else if (event.event === "client-signature") signatures.push(event);
        else if (["sse-written", "sse-close"].includes(event.event))
          sseEvents.push(event);
        else if (event.event === "grpc-request") grpcRequests.push(event);
        else if (event.event === "grpc-connection") grpcConnections.count++;
        else if (
          [
            "grpc-open",
            "grpc-orca-report",
            "grpc-orca-malformed",
            "grpc-orca-attempt",
            "grpc-orca-goaway",
            "grpc-orca-close",
            "grpc-message",
            "grpc-malformed-response",
            "grpc-policy-attempt",
            "grpc-policy-cancel",
            "grpc-policy-backoff",
            "grpc-refused-attempt",
            "grpc-throttle-attempt",
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
          algorithmConnections[event.role] =
            (algorithmConnections[event.role] || 0) + 1;
          if (event.role === "sink") connections.sink++;
          else if (event.role in connections)
            connections[/** @type {keyof typeof connections} */ (event.role)]++;
        } else if (event.event === "rejected") rejected.push(event);
        else if (["socket-message", "socket-close"].includes(event.event))
          socketEvents.push(event);
      }
    }
  })();
  /** @type {import("node:dgram").Socket|undefined} */ let policyDns;
  const dnsQueries = /** @type {Array<{name:string,type:number,enforcementPercentage?:number,maxTokens?:number,tokenRatio?:number,throttlePresent?:boolean,receivedAt?:number,sentAt?:number,sendError?:string}>} */ ([]);
  const dnsTimers = /** @type {Set<ReturnType<typeof setTimeout>>} */ (new Set());
  const close = async () => {
    for (const timer of dnsTimers) clearTimeout(timer);
    const dns=policyDns;
    if (dns) await new Promise(resolve => dns.close(()=>resolve(undefined)));
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
          dnsQueries,
          sseEvents,
          signatures,
          algorithmConnections,
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
  let policyUrl;
  if (options.grpcPolicy) {
    /** @type {Array<Record<string,any>>} */
    const methodConfig=options.grpcDeadline ? [
      {name:[{service:'owned.Sample',method:'DeadlineObject'}],timeout:{seconds:0,nanos:800000000}},
      {name:[{service:'owned.Sample',method:'DeadlineString'}],timeout:'1.2s'},
      {name:[{service:'owned.Sample',method:'DeadlineEarlier'}],timeout:'3s'}
    ] : options.grpcThrottle ? [{name:[{service:'owned.Sample'}],retryPolicy:{maxAttempts:3,initialBackoff:'0.01s',maxBackoff:'0.1s',backoffMultiplier:2,retryableStatusCodes:['UNAVAILABLE']}}] : options.grpcBudget ? (options.grpcEmptyBudget ? ['BudgetEmptyExact','BudgetEmptyOver'] : ['BudgetExact','BudgetOver']).map(method=>({name:[{service:'owned.Sample',method}],retryPolicy:{maxAttempts:3,initialBackoff:'0.01s',maxBackoff:'0.1s',backoffMultiplier:2,retryableStatusCodes:['UNAVAILABLE']}})) : [
      {name:[{service:'owned.Sample',method:'RetryOnce'}],retryPolicy:{maxAttempts:3,initialBackoff:'0.01s',maxBackoff:'0.1s',backoffMultiplier:2,retryableStatusCodes:['UNAVAILABLE']}},
      {name:[{service:'owned.Sample',method:'HedgeOnce'}],hedgingPolicy:{maxAttempts:2,hedgingDelay:'0.05s',nonFatalStatusCodes:['UNAVAILABLE']}},
      {name:[{service:'owned.Sample',method:'RetryCancel'}],retryPolicy:{maxAttempts:3,initialBackoff:'0.01s',maxBackoff:'0.1s',backoffMultiplier:2,retryableStatusCodes:['UNAVAILABLE']}},
      {name:[{service:'owned.Sample',method:'HedgeCancel'}],hedgingPolicy:{maxAttempts:3,hedgingDelay:'0.4s',nonFatalStatusCodes:['UNAVAILABLE']}}
    ];
    if(options.grpcStatusNames){
      methodConfig.splice(0,methodConfig.length,...['RetryAscii','RetryUnicode','HedgeAscii','HedgeUnicode'].map(method=>{
        const codes=[method.endsWith('Unicode')?'unavaılable':'uNaVaIlAbLe'];
        return {name:[{service:'owned.Sample',method}],...(method.startsWith('Retry')?{retryPolicy:{maxAttempts:2,initialBackoff:'0.01s',maxBackoff:'0.1s',backoffMultiplier:2,retryableStatusCodes:codes}}:{hedgingPolicy:{maxAttempts:2,hedgingDelay:'0.4s',nonFatalStatusCodes:codes}})};
      }));
    }
    if(options.grpcPolicyDeadline || options.grpcResolverHold)for(const config of methodConfig){
      if(config.name.some((/** @type {Record<string,any>} */ name)=>'method' in name && typeof name.method==='string' && ['RetryCancel','HedgeCancel'].includes(name.method)))Object.assign(config,{timeout:{seconds:0,nanos:650000000}});
    }
    const weightsProbe=process.env.INSOMNIUM_GRPC_ORCA_WEIGHTS;
    if(weightsProbe){methodConfig.splice(0,methodConfig.length,{name:[{service:'owned.Sample',method:'RetryOnce'}],retryPolicy:{maxAttempts:['blackout-exit','expiry-refresh'].includes(weightsProbe)?3:2,initialBackoff:'0.4s',maxBackoff:'0.4s',backoffMultiplier:1,retryableStatusCodes:['UNAVAILABLE']}});}
    /** @type {{
     * loadBalancingConfig?: Array<{weighted_round_robin: {enable_oob_load_report:boolean,oob_load_reporting_period:string,blackout_period:string,weight_update_period:string,weight_expiration_period?:string,error_utilization_penalty?:number}}>,
     * methodConfig: typeof methodConfig,
     * retryThrottling?: {maxTokens:number,tokenRatio:number}
     * }} */
    const serviceConfig={...(options.grpcOrca?{loadBalancingConfig:[{weighted_round_robin:{enable_oob_load_report:true,oob_load_reporting_period:'0.2s',blackout_period:'0s',weight_update_period:'0.1s'}}]}:{}),methodConfig,...(options.grpcThrottle?{retryThrottling:{maxTokens:4,tokenRatio:3}}:{})};
    if(weightsProbe)serviceConfig.loadBalancingConfig=[{weighted_round_robin:{enable_oob_load_report:weightsProbe!=='control',oob_load_reporting_period:'0.2s',blackout_period:['blackout','blackout-exit'].includes(weightsProbe)?'1s':'0s',weight_expiration_period:weightsProbe==='expiry'?'0.1s':weightsProbe==='expiry-refresh'?'0.5s':'180s',error_utilization_penalty:weightsProbe==='penalty0'?0:1,weight_update_period:'0.1s'}}];
    const txt=Buffer.from('grpc_config='+JSON.stringify([{serviceConfig}]));
    let throttleRevision=0;
    let outlierRevision=0;
    const dns=createSocket('udp4');
    policyDns=dns;
    dns.on('message',(packet,peer)=>{
      let end=12;const labels=[];
      while(packet[end]){const size=packet[end++];labels.push(packet.subarray(end,end+size).toString());end+=size;}
      end++;const type=packet.readUInt16BE(end);end+=4;
      const name=labels.join('.');
      const revision=(options.grpcThrottleResize||options.grpcThrottleReset)&&type===16?Math.min(throttleRevision++,2):undefined;
      const resize=options.grpcThrottleReset&&revision!==undefined ? (revision===1?null:{maxTokens:4,tokenRatio:1}) : options.grpcThrottleResize&&revision!==undefined?{maxTokens:[4,8,4][revision],tokenRatio:1}:undefined;
      const enforcementPercentage=options.grpcOutlier&&type===16?(options.grpcOutlierRecovery?100:outlierRevision++===0?0:100):undefined;
      const query=/** @type {(typeof dnsQueries)[number]} */({name,type,...resize,...(enforcementPercentage!==undefined?{enforcementPercentage}:{}),...(options.grpcThrottleReset&&type===16?{throttlePresent:resize!==null}:{}),...(options.grpcResolverHold?{receivedAt:Date.now()}: {})});dnsQueries.push(query);
      const intervalProbe=process.env.INSOMNIUM_GRPC_ORCA_INTERVAL==='1';
      const intervalMs=intervalProbe&&type===16?(outlierRevision++===0?200:400):undefined;
      if(intervalMs!==undefined)Object.assign(query,{intervalMs});
      const intervalTxt=intervalMs===undefined?null:Buffer.from('grpc_config='+JSON.stringify([{serviceConfig:{...serviceConfig,loadBalancingConfig:[{weighted_round_robin:{enable_oob_load_report:true,oob_load_reporting_period:intervalMs===200?'0.2s':'0.4s',blackout_period:'0s',weight_update_period:'0.1s'}}]}}]));
      const selectedTxt=intervalTxt??(enforcementPercentage!==undefined?Buffer.from('grpc_config='+JSON.stringify([{serviceConfig:grpcOutlierConfig(enforcementPercentage)}])):resize===null?Buffer.from('grpc_config='+JSON.stringify([{serviceConfig:{methodConfig}}])):resize?Buffer.from('grpc_config='+JSON.stringify([{serviceConfig:{...serviceConfig,retryThrottling:resize}}])):txt);
      assert.equal(name,'owned-policy.test');assert.ok([1,28,16].includes(type));
      const answer=type===1?Buffer.from([127,0,0,1]):type===16?Buffer.concat(Array.from({length:Math.ceil(selectedTxt.length/255)},(_,i)=>{const part=selectedTxt.subarray(i*255,(i+1)*255);return Buffer.concat([Buffer.from([part.length]),part]);})):null;
      const header=Buffer.alloc(12);packet.copy(header,0,0,2);header.writeUInt16BE(0x8180,2);header.writeUInt16BE(1,4);header.writeUInt16BE(answer?1:0,6);
      let rr=Buffer.alloc(0);if(answer){rr=Buffer.alloc(12);rr.writeUInt16BE(0xc00c,0);rr.writeUInt16BE(type,2);rr.writeUInt16BE(1,4);rr.writeUInt16BE(answer.length,10);rr=Buffer.concat([rr,answer]);}
      if(weightsProbe&&type===1){header.writeUInt16BE(2,6);const other=Buffer.from(rr);other[other.length-1]=2;rr=Buffer.concat([rr,other]);}
      const reply=Buffer.concat([header,packet.subarray(12,end),rr]);
      const timer=setTimeout(()=>{dnsTimers.delete(timer);dns.send(reply,peer.port,peer.address,error=>{if(options.grpcResolverHold){if(error)query.sendError=String(error);else query.sentAt=Date.now();}});},type===1?(options.grpcResolverHold?1500:150):0);dnsTimers.add(timer);
    });
    await new Promise(resolve=>dns.bind(0,'127.0.0.1',()=>resolve(undefined)));
    const address=dns.address(),grpcPort=new URL(String(state.ready.grpc)).port;
    policyUrl='grpcs://dns://127.0.0.1:'+address.port+'/owned-policy.test:'+grpcPort;
  }
  const primary = { url: String(state.ready.primary) };
  const sink = { url: String(state.ready.sink) };
  return {
    identityFiles,
    caFiles,
    containers,
    rsaClient,
    rsaFiles,
    secondClient,
    secondFiles: {
      cert: join(directory, "second-client.pem"),
      key: join(directory, "second-client.key"),
      pfx: join(directory, "second-client-leaf-only.pfx"),
    },
    algorithmServers:
      /** @type {Array<{id:string,url:string,scheme:string,version:string,emptyHints:boolean}>} */ (
        state.ready.algorithmServers
      ),
    signatures,
    algorithmConnections,
    ca,
    otherCa,
    client,
    wrongClient,
    clientName,
    primary,
    sink,
    invalidServers:
      /** @type {Array<{id:string,httpUrl:string,grpcUrl:string}>} */ (
        state.ready.invalidServers
      ),
    serverCertificates,
    requests,
    socketEvents,
    sinkRequests,
    connections,
    rejected,
    grpc: { url: String(state.ready.grpc), policyUrl },
    dnsQueries,
    grpcAlpha: { url: String(state.ready.grpcAlpha) },
    grpcRequests,
    grpcConnections,
    grpcEvents,
    releaseRefusedHeaders: () => { child.stdin.write("release-refused-headers\n"); return child.stdin.flush(); },
    sseEvents,
    async verifyFixture() {
      const independentFailures = [];
      for (const server of /** @type {Array<{id:string,httpUrl:string}>} */ (
        state.ready?.invalidServers || []
      )) {
        let failure;
        try {
          await fetch(server.httpUrl + "/fixture-check", {
            signal: AbortSignal.timeout(5000),
            tls: {
              ca,
              cert: client.certificate,
              key: client.key,
              rejectUnauthorized: true,
            },
          });
        } catch (error) {
          failure = /** @type {Error & {code?:string}} */ (error);
        }
        assert.ok(
          failure,
          "Independent client must refuse invalid " + server.id,
        );
        const evidence = {
          id: server.id,
          code: failure.code,
          message: failure.message,
        };
        const expected =
          server.id === "hostname"
            ? /hostname|ip address|altname/i
            : server.id === "expired"
              ? /expired/i
              : /not.yet.valid/i;
        assert.match(evidence.code + " " + evidence.message, expected);
        independentFailures.push(evidence);
      }
      await Bun.write(
        join(directory, "independent-server-refusals.json"),
        JSON.stringify(independentFailures, null, 2),
      );
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
