import assert from "node:assert/strict";
import { createSecureServer, connect } from "node:http2";
import { mkdir, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { X509Certificate, createHash } from "node:crypto";

/** Owned HTTP/2-only TLS fixture, with independent trusted H2 client control.
 * @param {string} output @param {Buffer} body */
export async function http2Metadata(output, body) {
  const executable = process.env.INSOMNIUM_METADATA_OPENSSL || Bun.which("openssl") || "C:/Program Files/Git/usr/bin/openssl.exe";
  assert.ok(await Bun.file(executable).exists(), "HTTP/2 metadata requires OpenSSL; set INSOMNIUM_METADATA_OPENSSL to its executable path");
  const version = Bun.spawnSync([executable, "version"], { windowsHide: true, timeout: 10000 });
  assert.equal(version.exitCode, 0, "OpenSSL prerequisite failed: " + version.stderr.toString());
  const root = await realpath(output), relation = relative(resolve("artifacts/playwright"), root);
  assert.ok(relation && !relation.startsWith("..") && !relation.includes(":"));
  const directory = join(root, "http2-fixture"); await mkdir(directory);
  const file = (/** @type {string} */ name) => join(directory, name);
  const run = (/** @type {string[]} */ args) => {
    const result = Bun.spawnSync([executable, ...args], { windowsHide: true, timeout: 15000 });
    assert.equal(result.exitCode, 0, result.stderr.toString());
  };
  run(["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-noenc", "-keyout", file("ca.key"), "-out", file("ca.pem"), "-days", "1", "-subj", "/CN=Insomnium owned HTTP2 CA", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign"]);
  run(["req", "-new", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-noenc", "-keyout", file("server.key"), "-out", file("server.csr"), "-subj", "/CN=127.0.0.1"]);
  await Bun.write(file("server.extensions"), "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n");
  run(["x509", "-req", "-in", file("server.csr"), "-CA", file("ca.pem"), "-CAkey", file("ca.key"), "-CAcreateserial", "-out", file("server.pem"), "-days", "1", "-extfile", file("server.extensions")]);
  run(["verify", "-CAfile", file("ca.pem"), file("server.pem")]);
  const ca = await Bun.file(file("ca.pem")).text(), cert = await Bun.file(file("server.pem")).text();
  const parsed = new X509Certificate(cert), authority = new X509Certificate(ca);
  assert.ok(parsed.checkIssued(authority) && parsed.verify(authority.publicKey));
  assert.equal(parsed.checkIP("127.0.0.1"), "127.0.0.1");
  const encoded = gzipSync(body), nonce = crypto.randomUUID();
  const requests = /** @type {Record<string,any>[]} */ ([]), controls = /** @type {Record<string,any>[]} */ ([]), errors = /** @type {string[]} */ ([]);
  const sessions = new Set(), sockets = new Set();
  const lifecycle = /** @type {Record<string,any>[]} */ ([]);
  const peer = (/** @type {import('node:net').Socket} */ socket) => ({address:socket.remoteAddress,port:socket.remotePort});
  const recordError = (/** @type {string} */ origin, /** @type {Error} */ error, details={}) => { errors.push(error.message); lifecycle.push({origin,event:'error',message:error.message,...details}); }; 
  const server = createSecureServer({ key: await Bun.file(file("server.key")).text(), cert, allowHTTP1: false, ALPNProtocols: ["h2"] });
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); socket.on("error", error => recordError("socket",error,peer(socket))); });
  server.on("session", session => { sessions.add(session); session.once("close", () => sessions.delete(session)); session.on("error", error => recordError("session",error)); });
  server.on("tlsClientError", (error,socket) => recordError("tlsClientError",error,peer(socket)));
  server.on("unknownProtocol", socket => { errors.push("Peer did not negotiate h2"); socket.destroy(); });
  server.on("stream", (/** @type {import('node:http2').ServerHttp2Stream} */ stream, headers) => {
    stream.on("error", error => recordError("stream",error,{streamId:stream.id,path:headers[":path"]}));
    const ownedSession=stream.session;
    const alpn = /** @type {import('node:tls').TLSSocket} */ (ownedSession?.socket).alpnProtocol;
    assert.equal(alpn, "h2"); assert.equal(headers[":path"], "/gzip");
    const row = { method: headers[":method"], path: headers[":path"], alpn, encodedBytes: encoded.length, peerPort: stream.session?.socket.remotePort, streamId: stream.id, finished:false, closed:false };
    (headers["x-insomnium-fixture-probe"] === nonce ? controls : requests).push(row);
    stream.respond({ ":status": 200, "content-type": "text/plain; charset=utf-8", "content-encoding": "gzip", "content-length": String(encoded.length) });
    stream.once("finish",()=>{row.finished=true;});
    stream.once("close",()=>{
      row.closed=true;lifecycle.push({origin:"stream",event:"close",...row});
      // This fixture serves exactly one response per connection. Retire its
      // session after the complete stream, before a native host exits.
      if(row.finished && ownedSession && !ownedSession.destroyed){
        lifecycle.push({origin:"session",event:"graceful-close",peerPort:row.peerPort,streamId:row.streamId});
        ownedSession.close();
      }
    });
    stream.end(encoded);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); resolve(null); });
  });
  const address = server.address(); assert.ok(address && typeof address === "object");
  const url = `https://127.0.0.1:${address.port}/gzip`;
  const close = async () => {
    for (const session of sessions) session.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(() => resolve(null)));
    await Bun.write(file("observations.json"), JSON.stringify({ requests, controls, errors, lifecycle, encodedBytes: encoded.length, decodedBytes: body.length, decodedSha256: createHash("sha256").update(body).digest("hex"), certificateFingerprint: parsed.fingerprint256 }, null, 2));
  };
  try {
    const client = connect(`https://127.0.0.1:${address.port}`, { ca });
    try {
      const bytes = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { client.destroy(); reject(Error("HTTP/2 control timed out")); }, 15000);
        client.once("error", error => { clearTimeout(timer); reject(error); });
        const stream = client.request({ ":path": "/gzip", "x-insomnium-fixture-probe": nonce });
        const chunks = /** @type {Buffer[]} */ ([]);
        stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
        stream.once("error", error => { clearTimeout(timer); reject(error); }); stream.once("end", () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); }); stream.end();
      });
      assert.equal(client.alpnProtocol, "h2");
      assert.deepEqual(bytes, encoded); assert.deepEqual(gunzipSync(/** @type {Buffer} */ (bytes)), body);
      assert.equal(controls.length, 1);
    } finally {
      if (!client.destroyed) await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{client.destroy();reject(Error("HTTP/2 control graceful close timed out"));},3000);
        client.once("close",()=>{clearTimeout(timer);resolve(null);});
        client.close();
      });
    }
    return { url, ca, requests, controls, errors, lifecycle, close };
  } catch (error) { await close(); throw error; }
}
