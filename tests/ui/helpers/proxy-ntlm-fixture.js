import assert from "node:assert/strict";
import {
  createServer as httpServer,
  request as httpRequest,
  Agent as HttpAgent,
} from "node:http";
import {
  createServer as httpsServer,
  request as httpsRequest,
  Agent as HttpsAgent,
} from "node:https";
import { createServer as netServer, connect } from "node:net";
import { createServer as tlsServer } from "node:tls";
import {
  createHash,
  createHmac,
  timingSafeEqual,
  X509Certificate,
} from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";

// Independent proof oracle: MS-NLMP 2.2.1.2 / 2.2.2.1 / 3.3.2.
// https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/
// RFC9110 9.3.6 (CONNECT), 11.7 (407); RFC5929 tls-server-end-point.
// https://www.rfc-editor.org/rfc/rfc9110.html
// https://www.rfc-editor.org/rfc/rfc5929.html
const username = "FIXTURE\\fixture",
  password = "synthetic:password";
const challengeNonce = Buffer.from("0123456789abcdef", "hex");
const originNonce = Buffer.from("fedcba9876543210", "hex");
const digestNonce = 'owned-proxy-digest-nonce';
/** @param {string} nonce @param {boolean} [stale] */
export function digestChallenge(nonce,stale=false){
  return `Digest realm="owned Digest", nonce="${nonce}", algorithm=SHA-256, qop="auth-int"${stale?', stale=true':''}`;
}
/** Independent RFC7616 SHA-256/auth-int oracle from actual target/entity bytes.
 * @param {string} value @param {string} method @param {string} target @param {Buffer} body
 * @param {string} nonce @param {string} [user] @param {string} [secret] */
export function digestProof(value,method,target,body,nonce,user=username,secret=password){
  assert.match(value,/^Digest /);
  const fields=Object.fromEntries([...value.matchAll(/([\w*]+)=(?:"((?:\\.|[^"\\])*)"|([^,\s]+))/g)]
    .map(match=>[match[1],match[2]===undefined?match[3]:match[2].replace(/\\(.)/g,'$1')]));
  assert.equal(fields.username,user);assert.equal(fields.realm,'owned Digest');assert.equal(fields.nonce,nonce);
  assert.equal(fields.uri,target);assert.equal(fields.qop,'auth-int');assert.equal(fields.algorithm,'SHA-256');
  assert.equal(fields.nc,'00000001');assert.ok(fields.cnonce);
  const hash=(/** @type {string|Buffer} */ value)=>createHash('sha256').update(value).digest('hex');
  const ha1=hash(user+':owned Digest:'+secret),ha2=hash(method+':'+target+':'+hash(body));
  assert.equal(fields.response,hash([ha1,nonce,fields.nc,fields.cnonce,'auth-int',ha2].join(':')));
  return {proofValid:true,digestNonce:nonce,digestTarget:target,digestQop:fields.qop};
}
/** Independent RFC7616 request/response oracle, using only observed wire fields.
 * @param {any} req @param {Buffer} body @param {Buffer} entity */
function digestResponseProof(req, body, entity) {
  const options = new URL(req.url, 'http://fixture').searchParams;
  const algorithm = options.get('algorithm') || 'SHA-256', qop = options.get('qop') || 'auth-int';
  let nonce = 'owned-response-nonce';
  const realm = 'owned response', mode = options.get('proof') || 'header';
  const challenge = `Digest realm="${realm}", nonce="${nonce}", algorithm=${algorithm}${qop === 'none' ? '' : `, qop="${qop}"`}`;
  if (!req.headers.authorization) return { challenge, info: '', proofValid: false };
  const fields = Object.fromEntries([...req.headers.authorization.matchAll(/([\w*]+)=(?:"((?:\\.|[^"\\])*)"|([^,\s]+))/g)]
    .map((/** @type {any} */ match) => [match[1], match[2] === undefined ? match[3] : match[2].replace(/\\(.)/g, '$1')]));
  if (mode.endsWith('stale') && fields.nonce === nonce + '-next') nonce += '-next';
  assert.equal(fields.username, 'origin-digest-user'); assert.equal(fields.realm, realm);
  assert.equal(fields.nonce, nonce); assert.equal(fields.uri, req.url); assert.equal(fields.algorithm ?? 'MD5', algorithm);
  assert.equal(fields.qop, qop === 'none' ? undefined : qop);
  if (qop !== 'none') { assert.equal(fields.nc, '00000001'); assert.ok(fields.cnonce); }
  const hashName = algorithm.replace(/-sess$/, '').toLowerCase().replace('sha-512-256', 'sha512-256').replace('sha-256', 'sha256');
  const hash = (/** @type {string|Buffer} */ value) => createHash(hashName).update(value).digest('hex');
  let ha1 = hash(`origin-digest-user:${realm}:origin-digest-password`);
  if (algorithm.endsWith('-sess')) ha1 = hash(`${ha1}:${nonce}:${fields.cnonce}`);
  const digest = (/** @type {string} */ ha2) => hash(qop === 'none' ? `${ha1}:${nonce}:${ha2}` : `${ha1}:${nonce}:${fields.nc}:${fields.cnonce}:${qop}:${ha2}`);
  assert.equal(fields.response, digest(hash(`${req.method}:${req.url}${qop === 'auth-int' ? ':' + hash(body) : ''}`)));
  let rspauth = digest(hash(`:${req.url}${qop === 'auth-int' ? ':' + hash(entity) : ''}`));
  if (['forged', 'bad-redirect', 'bad-stale'].includes(mode)) rspauth = '0'.repeat(rspauth.length);
  let info = `rspauth="${rspauth}"${qop === 'none' ? '' : `, qop=${qop}, cnonce="${fields.cnonce}", nc=${fields.nc}`}`;
  if (mode === 'cnonce') info = info.replace(fields.cnonce, 'foreign-client');
  if (mode === 'nc') info = info.replace('nc=00000001', 'nc=00000002');
  if (mode === 'qop') info = info.replace(`qop=${qop}`, 'qop=foreign');
  if (mode === 'duplicate') info += `, rspauth="${rspauth}"`;
  if (mode === 'malformed') info = 'rspauth="unterminated';
  if (mode === 'incomplete') info = `qop=${qop}`;
  if (mode === 'nextnonce') info = 'nextnonce="future-nonce"';
  return { challenge, info, proofValid: true, algorithm, qop, nonce };
}
/** @param {string} [domainName] @param {Buffer} [nonce] */
function type2(domainName = "FIXTURE", nonce = challengeNonce) {
  const domain = Buffer.from(domainName, "utf16le"),
    av = Buffer.alloc(4 + domain.length + 4);
  av.writeUInt16LE(2);
  av.writeUInt16LE(domain.length, 2);
  domain.copy(av, 4);
  const token = Buffer.alloc(56 + domain.length + av.length);
  token.write("NTLMSSP\0");
  token.writeUInt32LE(2, 8);
  for (const [at, data, offset] of /** @type {[number,Buffer,number][]} */ ([
    [12, domain, 56],
    [40, av, 56 + domain.length],
  ])) {
    token.writeUInt16LE(data.length, at);
    token.writeUInt16LE(data.length, at + 2);
    token.writeUInt32LE(offset, at + 4);
    data.copy(token, offset);
  }
  token.writeUInt32LE(0x00888205, 20);
  nonce.copy(token, 24);
  return token;
}
const challenge = type2();
const originChallenge = type2("ORIGIN", originNonce);
/** @param {Buffer} der */
function bindingHash(der) {
  const data = Buffer.concat([
    Buffer.from("tls-server-end-point:"),
    createHash("sha256").update(der).digest(),
  ]);
  // RFC4121 canonical GSS hash input excludes native structure offsets/pointers:
  // zero initiator type/length, zero acceptor type/length, application length.
  // https://www.rfc-editor.org/rfc/rfc4121.html#section-4.1.1.2
  const bindings = Buffer.alloc(20);
  bindings.writeUInt32LE(data.length, 16);
  return createHash("md5")
    .update(Buffer.concat([bindings, data]))
    .digest();
}
/** @param {Buffer} token @param {Buffer|undefined} certificate @param {'proxy'|'origin'} [role] */
function proof(token, certificate, role = "proxy") {
  const field = (/** @type {number} */ at) => {
    assert.ok(at + 8 <= token.length);
    const size = token.readUInt16LE(at),
      offset = token.readUInt32LE(at + 4);
    assert.ok(offset + size <= token.length);
    return token.subarray(offset, offset + size);
  };
  const domain = field(28).toString("utf16le"),
    user = field(36).toString("utf16le");
  assert.equal(domain, role === "origin" ? "ORIGIN" : "FIXTURE");
  assert.equal(user, role === "origin" ? "origin-user" : "fixture");
  const response = field(20);
  assert.ok(response.length >= 48);
  assert.deepEqual(response.subarray(16, 18), Buffer.from([1, 1]));
  const ntHash = createHash("md4")
    .update(
      Buffer.from(
        role === "origin" ? "synthetic:origin-password" : password,
        "utf16le",
      ),
    )
    .digest();
  const key = createHmac("md5", ntHash)
    .update(Buffer.from(user.toUpperCase() + domain, "utf16le"))
    .digest();
  const expected = createHmac("md5", key)
    .update(
      Buffer.concat([
        role === "origin" ? originNonce : challengeNonce,
        response.subarray(16),
      ]),
    )
    .digest();
  assert.ok(
    timingSafeEqual(response.subarray(0, 16), expected),
    "Independent role-specific NTLMv2 password proof",
  );
  let at = 44;
  /** @type {Buffer|undefined} */ let channel;
  const seen = new Set();
  while (at + 4 <= response.length) {
    const id = response.readUInt16LE(at),
      size = response.readUInt16LE(at + 2);
    at += 4;
    assert.ok(at + size <= response.length);
    if (id === 0) {
      assert.equal(size, 0);
      break;
    }
    assert.ok(!seen.has(id), "Unique AV identifiers");
    seen.add(id);
    if (id === 10) channel = response.subarray(at, at + size);
    at += size;
  }
  if (certificate) {
    assert.ok(channel, "HTTPS role Type3 includes channel binding AV10");
    assert.deepEqual(
      channel,
      bindingHash(certificate),
      "AV10 binds the actual role certificate",
    );
  }
  return {
    user,
    domain,
    proofVerified: true,
    channelBindingVerified: Boolean(certificate),
    proofValid: true,
    channelBindingValid: Boolean(certificate),
  };
}

/** Owned saved-scenario fixture; synthetic identities only. No browser actions.
 * @param {string} output */
export async function createProxyNtlmFixture(output) {
  const root = await realpath(output),
    relation = relative(resolve("artifacts/playwright"), root);
  assert.ok(relation && !relation.startsWith("..") && !relation.includes(":"));
  const directory = join(root, "proxy-ntlm-fixture");
  await mkdir(directory, { recursive: true });
  const file = (/** @type {string} */ name) => join(directory, name);
  const executable =
    process.env.INSOMNIUM_METADATA_OPENSSL ||
    Bun.which("openssl") ||
    "C:/Program Files/Git/usr/bin/openssl.exe";
  assert.ok(await Bun.file(executable).exists());
  const run = (/** @type {string[]} */ args) => {
    const result = Bun.spawnSync([executable, ...args], {
      windowsHide: true,
      timeout: 15000,
    });
    assert.equal(
      result.exitCode,
      0,
      "Owned proxy certificate generation failed",
    );
  };
  run([
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-noenc",
    "-keyout",
    file("ca.key"),
    "-out",
    file("ca.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=Insomnium synthetic proxy fixture CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  ]);
  await Bun.write(
    file("leaf.extensions"),
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n",
  );
  for (const name of ["proxy", "origin"]) {
    run([
      "req",
      "-new",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-256",
      "-noenc",
      "-keyout",
      file(name + ".key"),
      "-out",
      file(name + ".csr"),
      "-subj",
      "/CN=127.0.0.1",
    ]);
    run([
      "x509",
      "-req",
      "-in",
      file(name + ".csr"),
      "-CA",
      file("ca.pem"),
      "-CAkey",
      file("ca.key"),
      "-CAcreateserial",
      "-out",
      file(name + ".pem"),
      "-days",
      "1",
      "-sha256",
      "-extfile",
      file("leaf.extensions"),
    ]);
    run(["verify", "-CAfile", file("ca.pem"), file(name + ".pem")]);
  }
  const ca = await Bun.file(file("ca.pem")).text(),
    authority = new X509Certificate(ca),
    certificates =
      /** @type {Record<string,{cert:string,key:string,der:Buffer}>} */ ({});
  for (const name of ["proxy", "origin"]) {
    const cert = await Bun.file(file(name + ".pem")).text(),
      parsed = new X509Certificate(cert);
    assert.ok(
      parsed.checkIssued(authority) && parsed.verify(authority.publicKey),
    );
    assert.equal(parsed.checkIP("127.0.0.1"), "127.0.0.1");
    certificates[name] = {
      cert,
      key: await Bun.file(file(name + ".key")).text(),
      der: parsed.raw,
    };
  }
  assert.notDeepEqual(certificates.proxy.der, certificates.origin.der);
  const records = /** @type {any[]} */ ([]),
    origins = /** @type {any[]} */ ([]),
    errors = /** @type {string[]} */ ([]),
    sockets = new Set(),
    servers = /** @type {import('node:net').Server[]} */ ([]),
    agents = new Set(),
    originStates = new WeakMap();
  let mode = "ntlm",
    serial = 0,
    closing = false;
  const remember = (/** @type {import('node:net').Socket} */ socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    return socket;
  };
  const serveOrigin = async (
    /** @type {any} */ req,
    /** @type {any} */ res,
  ) => {
    try {
      const chunks = /** @type {Buffer[]} */ ([]);
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      let state = originStates.get(req.socket);
      if (!state) {
        state = { id: ++serial, phase: 0 };
        originStates.set(req.socket, state);
      }
      const row = {
        socketId: state.id,
        method: req.method,
        path: req.url,
        bytes: body.length,
        bodyBase64: body.toString("base64"),
        bodySha256: createHash("sha256").update(body).digest("hex"),
        proxyAuthorizationPresent: Boolean(req.headers["proxy-authorization"]),
        proxyAuthorization: req.headers["proxy-authorization"] ?? null,
        authorization: req.headers.authorization ?? null,
        type: 0,
        proofValid: false,
        channelBindingValid: false,
      };
      origins.push(row);
      assert.equal(
        req.headers["proxy-authorization"],
        undefined,
        "Proxy credentials never reach origin",
      );
      if(req.url==='/origin-digest'){
        if(!req.headers.authorization){res.writeHead(401,{'WWW-Authenticate':digestChallenge('owned-origin-digest-nonce'),'Content-Length':'0'});res.end();return;}
        Object.assign(row,digestProof(req.headers.authorization,req.method || '',req.url,body,'owned-origin-digest-nonce','origin-digest-user','origin-digest-password'));
      }
      if (req.url.startsWith('/origin-digest-proof')) {
        const options = new URL(req.url, 'http://fixture').searchParams;
        const mode = options.get('proof') || 'header', coding = options.get('coding');
        const decoded = req.method === 'HEAD' || options.has('empty') ? Buffer.alloc(0)
          : options.has('sse') ? Buffer.from('event: fixture\ndata: digest-response-ok\n\n') : body;
        let entity = decoded;
        if (coding === 'gzip') entity = gzipSync(decoded);
        if (coding === 'deflate') entity = deflateSync(decoded);
        if (coding === 'br') entity = brotliCompressSync(decoded);
        if (coding === 'stacked') entity = brotliCompressSync(gzipSync(decoded));
        const proof = digestResponseProof(req, body, mode === 'decoded-hash' ? decoded : entity);
        Object.assign(row, proof, { entityBase64: entity.toString('base64') });
        if (!proof.proofValid) { res.writeHead(401, { 'WWW-Authenticate': proof.challenge, 'Content-Length': '0' }); res.end(); return; }
        const headers = /** @type {Record<string,string>} */ ({ 'Content-Type': options.has('sse') ? 'text/event-stream' : 'application/octet-stream' });
        if (coding) headers['Content-Encoding'] = coding === 'stacked' ? 'gzip, br' : coding;
        if (['trailer', 'missing-trailer'].includes(mode)) headers.Trailer = 'Authentication-Info';
        else { headers['Content-Length'] = String(entity.length); if (mode !== 'absent') headers['Authentication-Info'] = proof.info; }
        if (mode.endsWith('redirect')) headers.Location = '/origin-digest-proof?proof=header';
        const stale = mode.endsWith('stale') && proof.nonce === 'owned-response-nonce';
        if (stale) headers['WWW-Authenticate'] = proof.challenge.replace('nonce="owned-response-nonce"', 'nonce="owned-response-nonce-next"') + ', stale=true';
        res.writeHead(stale ? 401 : mode.endsWith('redirect') ? 307 : options.has('empty') ? 204 : 200, headers);
        if (mode === 'trailer') { res.write(entity.subarray(0, 3)); res.write(entity.subarray(3)); res.addTrailers({ 'Authentication-Info': proof.info }); res.end(); }
        else res.end(entity);
        return;
      }
      if (req.url === "/origin-ntlm") {
        const auth = req.headers.authorization ?? "";
        if (!auth) {
          res.writeHead(401, {
            "WWW-Authenticate": "NTLM",
            "Content-Length": "0",
          });
          res.end();
          return;
        }
        assert.ok(auth.startsWith("NTLM "));
        const token = Buffer.from(auth.slice(5), "base64");
        assert.ok(token.length >= 12);
        assert.equal(token.subarray(0, 8).toString(), "NTLMSSP\0");
        row.type = token.readUInt32LE(8);
        if (row.type === 1) {
          assert.equal(state.phase, 0);
          state.phase = 1;
          res.writeHead(401, {
            "WWW-Authenticate": "NTLM " + originChallenge.toString("base64"),
            "Content-Length": "0",
          });
          res.end();
          return;
        }
        assert.equal(row.type, 3);
        assert.equal(state.phase, 1, "Origin Type3 uses its original socket");
        Object.assign(
          row,
          proof(
            token,
            req.socket.encrypted ? certificates.origin.der : undefined,
            "origin",
          ),
        );
        state.phase = 3;
      }
      if (req.url === "/redirect") {
        res.writeHead(302, { Location: "/echo", "Content-Length": "0" });
        res.end();
        return;
      }
      if (req.url === "/oauth-token") {
        assert.equal(req.method, "POST");
        assert.equal(
          new URLSearchParams(body.toString()).get("grant_type"),
          "client_credentials",
        );
        const json = JSON.stringify({
          access_token: "owned-proxy-token",
          token_type: "Bearer",
          expires_in: 3600,
        });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(json)),
        });
        res.end(json);
        return;
      }
      if (req.url === "/sse") {
        const events = "event: fixture\ndata: proxy-ntlm-sse-ok\n\n";
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(events);
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(body.length),
      });
      res.end(body);
    } catch (error) {
      errors.push("Origin forwarding assertion failed: " + String(error));
      res.writeHead(500);
      res.end();
    }
  };
  // Minimal saved-fixture RFC6455 implementation, without optional extensions.
  // https://www.rfc-editor.org/rfc/rfc6455.html sections 4.2.2 and 5.2–5.5.
  const websocketUpgrade = (
    /** @type {import('node:http').IncomingMessage} */ req,
    /** @type {import('node:stream').Duplex} */ socket,
    /** @type {Buffer} */ head,
  ) => {
    try {
      assert.ok(req.url);
      assert.equal(req.url.split('?')[0], "/websocket");
      assert.equal(req.method, "GET");
      assert.equal(req.headers.upgrade?.toLowerCase(), "websocket");
      assert.ok(
        req.headers.connection
          ?.toLowerCase()
          .split(/\s*,\s*/)
          .includes("upgrade"),
      );
      assert.equal(req.headers["sec-websocket-version"], "13");
      const key = req.headers["sec-websocket-key"];
      assert.equal(typeof key, "string");
      assert.equal(
        Buffer.from(/** @type {string} */ (key), "base64").length,
        16,
      );
      assert.equal(req.headers["proxy-authorization"], undefined);
      const row = /** @type {any} */ ({
        socketId: ++serial,
        path: req.url,
        method: req.method,
        bodyBase64: "",
        authorization: req.headers.authorization ?? null,
        proxyAuthorization: null,
        upgrade: true,
        closed: false,
        messages: [],
      });
      origins.push(row);
      socket.once("close", () => {
        row.closed = true;
      });
      socket.once('end', () => socket.end());
      let digestInfo = '';
      if (req.url.includes('?')) {
        const proof = digestResponseProof(req, Buffer.alloc(0), Buffer.alloc(0));
        Object.assign(row, proof);
        if (!proof.proofValid) { socket.end(`HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: ${proof.challenge}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`); return; }
        digestInfo = `Authentication-Info: ${proof.info}\r\n`;
      }
      const accept = createHash("sha1")
        .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n${digestInfo}\r\n`,
      );
      let input = Buffer.from(head),
        fragmentOpcode = 0,
        total = 0;
      const fragments = /** @type {Buffer[]} */ ([]);
      const send = (
        /** @type {number} */ opcode,
        /** @type {Buffer} */ bytes,
      ) => {
        const prefix = Buffer.alloc(
          bytes.length < 126 ? 2 : bytes.length <= 65535 ? 4 : 10,
        );
        prefix[0] = 0x80 | opcode;
        if (prefix.length === 2) prefix[1] = bytes.length;
        else if (prefix.length === 4) {
          prefix[1] = 126;
          prefix.writeUInt16BE(bytes.length, 2);
        } else {
          prefix[1] = 127;
          prefix.writeBigUInt64BE(BigInt(bytes.length), 2);
        }
        socket.write(Buffer.concat([prefix, bytes]));
      };
      const receive = () => {
        try {
          while (input.length >= 2) {
            const first = input[0],
              opcode = first & 15,
              fin = Boolean(first & 128),
              masked = Boolean(input[1] & 128);
            assert.equal(first & 112, 0);
            assert.ok(masked);
            assert.ok([0, 1, 2, 8, 9, 10].includes(opcode));
            let size = input[1] & 127,
              at = 2;
            if (size === 126) {
              if (input.length < 4) return;
              size = input.readUInt16BE(2);
              assert.ok(size >= 126);
              at = 4;
            } else if (size === 127) {
              if (input.length < 10) return;
              const wide = input.readBigUInt64BE(2);
              assert.ok(wide > 65535n && wide <= 1048576n);
              size = Number(wide);
              at = 10;
            }
            assert.ok(size <= 1048576);
            if (opcode >= 8) {
              assert.ok(fin && size <= 125);
            }
            if (input.length < at + 4 + size) return;
            const mask = input.subarray(at, at + 4),
              bytes = Buffer.from(input.subarray(at + 4, at + 4 + size));
            for (let index = 0; index < bytes.length; index++)
              bytes[index] ^= mask[index % 4];
            input = input.subarray(at + 4 + size);
            if (opcode === 8) {
              assert.notEqual(bytes.length, 1);
              if (bytes.length >= 2) {
                const code = bytes.readUInt16BE(0);
                assert.ok(
                  (code >= 3000 && code <= 4999) ||
                    [
                      1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011,
                      1012, 1013, 1014,
                    ].includes(code),
                );
                new TextDecoder("utf-8", { fatal: true }).decode(
                  bytes.subarray(2),
                );
              }
              row.closeReceived = true;
              send(8, bytes);
              socket.end();
              return;
            }
            if (opcode === 9) {
              send(10, bytes);
              continue;
            }
            if (opcode === 10) continue;
            if (opcode === 0) assert.ok(fragmentOpcode !== 0);
            else {
              assert.equal(fragmentOpcode, 0);
              fragmentOpcode = opcode;
            }
            fragments.push(bytes);
            total += bytes.length;
            assert.ok(total <= 1048576);
            if (fin) {
              const payload = Buffer.concat(fragments);
              if (fragmentOpcode === 1)
                new TextDecoder("utf-8", { fatal: true }).decode(payload);
              row.messages.push({
                opcode: fragmentOpcode,
                bodyBase64: payload.toString("base64"),
              });
              send(fragmentOpcode, payload);
              fragments.length = 0;
              fragmentOpcode = 0;
              total = 0;
            }
          }
        } catch {
          if (!closing)
            errors.push("WebSocket fixture protocol assertion failed");
          socket.destroy();
        }
      };
      socket.on("data", (chunk) => {
        input = Buffer.concat([input, chunk]);
        if (input.length > 1048590) {
          errors.push("WebSocket frame exceeds bound");
          socket.destroy();
          return;
        }
        receive();
      });
      if (input.length) receive();
    } catch {
      errors.push("WebSocket fixture upgrade assertion failed");
      socket.destroy();
    }
  };
  const listen = async (/** @type {import('node:net').Server} */ server) => {
    servers.push(server);
    server.on("connection", remember);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve(null);
      });
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    return address.port;
  };
  let httpOrigin = "",
    httpsOrigin = "";
  const ownedTarget = (/** @type {string} */ url) => {
    const target = new URL(url);
    if (target.protocol === "ws:") target.protocol = "http:";
    if (target.protocol === "wss:") target.protocol = "https:";
    assert.ok(
      [httpOrigin, httpsOrigin].includes(target.origin),
      "Forward only owned loopback origin",
    );
    return target;
  };
  const parse = (/** @type {Buffer} */ buffer) => {
    const boundary = buffer.indexOf("\r\n\r\n");
    if (boundary < 0) {
      assert.ok(buffer.length < 64 * 1024);
      return;
    }
    const lines = buffer.subarray(0, boundary).toString("latin1").split("\r\n"),
      [method, target, version] = (lines.shift() ?? "").split(" ");
    assert.equal(version, "HTTP/1.1");
    const headers = /** @type {Record<string,string>} */ ({});
    for (const line of lines) {
      const colon = line.indexOf(":");
      assert.ok(colon > 0);
      const name = line.slice(0, colon).toLowerCase();
      assert.equal(
        headers[name],
        undefined,
        "Duplicate fixture request header",
      );
      headers[name] = line.slice(colon + 1).trim();
    }
    let end = boundary + 4,
      body;
    if (headers["transfer-encoding"]) {
      assert.equal(headers["transfer-encoding"].toLowerCase(), "chunked");
      const chunks = [];
      let size = 0;
      while (true) {
        const lineEnd = buffer.indexOf("\r\n", end);
        if (lineEnd < 0) return;
        const length = Number.parseInt(
          buffer.subarray(end, lineEnd).toString().split(";")[0],
          16,
        );
        assert.ok(Number.isSafeInteger(length) && length >= 0);
        end = lineEnd + 2;
        if (length === 0) {
          if (buffer.length < end + 2) return;
          if (buffer.subarray(end, end + 2).toString() === "\r\n") {
            end += 2;
            break;
          }
          const trailer = buffer.indexOf("\r\n\r\n", end);
          if (trailer < 0) return;
          end = trailer + 4;
          break;
        }
        if (buffer.length < end + length + 2) return;
        assert.equal(
          buffer.subarray(end + length, end + length + 2).toString(),
          "\r\n",
        );
        chunks.push(buffer.subarray(end, end + length));
        size += length;
        assert.ok(size <= 2 * 1024 * 1024);
        end += length + 2;
      }
      body = Buffer.concat(chunks);
    } else {
      const length = Number(headers["content-length"] ?? 0);
      assert.ok(
        Number.isSafeInteger(length) &&
          length >= 0 &&
          length <= 2 * 1024 * 1024,
      );
      if (buffer.length < end + length) return;
      body = buffer.subarray(end, end + length);
      end += length;
    }
    return { method, target, headers, body, end };
  };
  const proxyHandler =
    (/** @type {boolean} */ tls) =>
    (/** @type {import('node:net').Socket} */ socket) => {
      remember(socket);
      const id = ++serial,
        socketMode = mode,
        httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 1 }),
        httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 1, ca });
      agents.add(httpAgent);
      agents.add(httpsAgent);
      socket.once("close", () => {
        httpAgent.destroy();
        httpsAgent.destroy();
        agents.delete(httpAgent);
        agents.delete(httpsAgent);
      });
      let buffer = Buffer.alloc(0),
        processing = false,
        stage = 0,
        tunnel = false;
      socket.once("close", () => {
        for (const row of records)
          if (row.socketId === id) {
            row.closed = true;
            row.socketClosed = true;
          }
      });
      const reply = (/** @type {string|string[]} */ challengeHeader) => {
        const body =
            socketMode === "oversized-body"
              ? Buffer.alloc(1024 * 1024 + 64, 65)
              : Buffer.from("owned framed 407 challenge body"),
          lines = (
            Array.isArray(challengeHeader) ? challengeHeader : [challengeHeader]
          )
            .map((value) => "Proxy-Authenticate: " + value + "\r\n")
            .join("");
        socket.write(
          `HTTP/1.1 407 Proxy Authentication Required\r\n${lines}Content-Length: ${body.length}\r\nConnection: keep-alive\r\n\r\n`,
        );
        if (socketMode !== "held-challenge") socket.write(body);
      };
      const process = async () => {
        if (processing || tunnel) return;
        processing = true;
        try {
          while (!tunnel) {
            const req = parse(buffer);
            if (!req) break;
            buffer = buffer.subarray(req.end);
            const auth = req.headers["proxy-authorization"] ?? "",
              row = /** @type {any} */ ({
                id,
                socketId: id,
                tls,
                proxyTls: tls,
                mode: socketMode,
                closed: false,
                socketClosed: false,
                method: req.method,
                target: req.target,
                userAgent: req.headers["user-agent"] ?? null,
                authority: req.headers.host ?? null,
                type: 0,
                bytes: req.body.length,
                bodyBase64: req.body.toString("base64"),
                bodySha256: createHash("sha256").update(req.body).digest("hex"),
                proofValid: false,
                channelBindingValid: false,
              });
            records.push(row);
            if (!auth && (stage !== 3 || socketMode.startsWith('digest'))) {
              if(socketMode.startsWith('digest'))stage=0;
              reply(
                socketMode.startsWith('digest')
                  ? [digestChallenge(digestNonce),'Basic realm="fallback"']
                  : socketMode === "basic"
                  ? 'Basic realm="owned proxy"'
                  : socketMode === "malformed"
                    ? "NTLM !!!!"
                    : socketMode === "duplicate"
                      ? ["NTLM", "NTLM"]
                      : 'Basic realm="fallback", NTLM',
              );
              continue;
            }
            if(auth && socketMode.startsWith('digest')){
              Object.assign(row,digestProof(auth,req.method,req.target,req.body,stage===1?digestNonce+'-next':digestNonce));
              row.type='digest';
              if(socketMode==='digest-reject'){reply('Basic realm="no downgrade"');continue;}
              if(socketMode==='digest-stale'&&stage===0){stage=1;reply(digestChallenge(digestNonce+'-next',true));continue;}
              stage=3;
            } else if (auth && socketMode === "basic") {
              assert.equal(
                auth,
                "Basic " +
                  Buffer.from(username + ":" + password).toString("base64"),
              );
              row.type = "basic";
              stage = 3;
            } else if (auth) {
              assert.ok(auth.startsWith("NTLM "));
              const token = Buffer.from(auth.slice(5), "base64");
              assert.ok(token.length >= 12);
              assert.equal(token.subarray(0, 8).toString(), "NTLMSSP\0");
              row.type = token.readUInt32LE(8);
              if (row.type === 1) {
                assert.equal(
                  stage,
                  0,
                  "No restarted Type1 on authenticated socket",
                );
                stage = 1;
                reply("NTLM " + challenge.toString("base64"));
                if (socketMode === "close-after-type2") {
                  socket.end();
                  return;
                }
                continue;
              }
              assert.equal(row.type, 3);
              assert.equal(
                stage,
                1,
                "Type3 must follow Type1 on this exact socket",
              );
              Object.assign(
                row,
                proof(token, tls ? certificates.proxy.der : undefined),
              );
              stage = 3;
              if (socketMode === "repeated") {
                reply("NTLM " + challenge.toString("base64"));
                continue;
              }
            }
            if (req.method === "CONNECT") {
              const target = ownedTarget("https://" + req.target);
              const upstream = remember(
                connect(Number(target.port), target.hostname),
              );
              await new Promise((resolve, reject) => {
                upstream.once("connect", resolve);
                upstream.once("error", reject);
              });
              tunnel = true;
              socket.removeListener("data", data);
              socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
              if (buffer.length) upstream.write(buffer);
              socket.pipe(upstream);
              upstream.pipe(socket);
              socket.once("close", () => upstream.destroy());
              upstream.once("close", () => socket.destroy());
              return;
            }
            const target = ownedTarget(req.target),
              headers = { ...req.headers };
            delete headers["proxy-authorization"];
            delete headers["proxy-connection"];
            delete headers["transfer-encoding"];
            headers["content-length"] = String(req.body.length);
            headers.host = target.host;
            await new Promise((resolve, reject) => {
              const upstream = (
                target.protocol === "https:" ? httpsRequest : httpRequest
              )(
                target,
                {
                  method: req.method,
                  headers,
                  ca,
                  agent: target.protocol === "https:" ? httpsAgent : httpAgent,
                },
                (response) => {
                  const chunks = /** @type {Buffer[]} */ ([]),
                    stream =
                      response.headers["content-type"] === "text/event-stream",
                    forward = ["content-type", "www-authenticate", "location"]
                      .filter((name) => response.headers[name] !== undefined)
                      .map((name) => `${name}: ${response.headers[name]}\r\n`)
                      .join("");
                  if (stream)
                    socket.write(
                      `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${forward}Transfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n`,
                    );
                  response.on("data", (chunk) => {
                    const bytes = Buffer.from(chunk);
                    if (stream) {
                      socket.write(bytes.length.toString(16) + "\r\n");
                      socket.write(bytes);
                      socket.write("\r\n");
                    } else chunks.push(bytes);
                  });
                  response.on("error", reject);
                  response.on("end", () => {
                    if (stream) socket.write("0\r\n\r\n");
                    else {
                      const body = Buffer.concat(chunks);
                      socket.write(
                        `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${forward}Content-Length: ${body.length}\r\nConnection: keep-alive\r\n\r\n`,
                      );
                      socket.write(body);
                    }
                    resolve(null);
                  });
                },
              );
              socket.once("close", () => upstream.destroy());
              upstream.on("socket", remember);
              upstream.on("upgrade", (response, upstreamSocket, head) => {
                try {
                  assert.equal(response.statusCode, 101);
                  tunnel = true;
                  socket.removeListener("data", data);
                  remember(
                    /** @type {import('node:net').Socket} */ (upstreamSocket),
                  );
                  const names = [
                      "upgrade",
                      "connection",
                      "sec-websocket-accept",
                      "sec-websocket-protocol",
                    ],
                    forward = names
                      .filter((name) => response.headers[name] !== undefined)
                      .map((name) => `${name}: ${response.headers[name]}\r\n`)
                      .join("");
                  socket.write(
                    "HTTP/1.1 101 Switching Protocols\r\n" + forward + "\r\n",
                  );
                  if (head.length) socket.write(head);
                  if (buffer.length) upstreamSocket.write(buffer);
                  socket.pipe(upstreamSocket);
                  upstreamSocket.pipe(socket);
                  socket.once("close", () => upstreamSocket.destroy());
                  upstreamSocket.once("close", () => socket.destroy());
                  resolve(null);
                } catch (error) {
                  upstreamSocket.destroy();
                  reject(error);
                }
              });
              upstream.on("error", reject);
              upstream.end(req.body);
            });
          }
        } catch {
          if (!closing && !socket.destroyed)
            errors.push(
              "Proxy fixture authentication/forwarding assertion failed",
            );
          socket.destroy();
        } finally {
          processing = false;
          if (buffer.length && !tunnel && !socket.destroyed && parse(buffer))
            queueMicrotask(process);
        }
      };
      const data = (/** @type {Buffer} */ chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > 3 * 1024 * 1024) {
          errors.push("Proxy request exceeds fixture bound");
          socket.destroy();
          return;
        }
        void process();
      };
      socket.on("data", data);
    };
  try {
    const plainOrigin = httpServer(serveOrigin);
    plainOrigin.on("upgrade", websocketUpgrade);
    httpOrigin = "http://127.0.0.1:" + (await listen(plainOrigin));
    const secureOrigin = httpsServer(
      { ...certificates.origin, ALPNProtocols: ["http/1.1"] },
      serveOrigin,
    );
    secureOrigin.on("upgrade", websocketUpgrade);
    httpsOrigin = "https://127.0.0.1:" + (await listen(secureOrigin));
    const httpPort = await listen(netServer(proxyHandler(false))),
      httpsPort = await listen(
        tlsServer(
          { ...certificates.proxy, ALPNProtocols: ["http/1.1"] },
          proxyHandler(true),
        ),
      );
    const auth =
      encodeURIComponent(username) + ":" + encodeURIComponent(password) + "@";
    return {
      httpProxy: "http://" + auth + "127.0.0.1:" + httpPort,
      httpsProxy: "https://" + auth + "127.0.0.1:" + httpsPort,
      httpOrigin,
      httpsOrigin,
      ca,
      caDerBase64: authority.raw.toString("base64"),
      proxyCertificateDer: certificates.proxy.der,
      originCertificateDer: certificates.origin.der,
      records,
      origins,
      errors,
      activeSocketCount: () => sockets.size,
      socketDiagnostics: () => [...sockets].map(socket => ({ localPort: socket.localPort, remotePort: socket.remotePort,
        readableEnded: socket.readableEnded, writableEnded: socket.writableEnded, destroyed: socket.destroyed })),
      setMode(/** @type {string} */ next) {
        assert.ok(
          [
            "ntlm",
            "digest",
            "digest-stale",
            "digest-reject",
            "basic",
            "malformed",
            "repeated",
            "close-after-type2",
            "held-challenge",
            "oversized-body",
            "duplicate",
          ].includes(next),
        );
        mode = next;
      },
      async close() {
        closing = true;
        for (const agent of agents) agent.destroy();
        for (const socket of sockets) socket.destroy();
        await Promise.all(
          servers.map(
            (server) =>
              new Promise((resolve) => server.close(() => resolve(null))),
          ),
        );
      },
    };
  } catch (error) {
    closing = true;
    for (const socket of sockets) socket.destroy();
    await Promise.all(
      servers
        .filter((server) => server.listening)
        .map(
          (server) =>
            new Promise((resolve) => server.close(() => resolve(null))),
        ),
    );
    throw error;
  }
}
