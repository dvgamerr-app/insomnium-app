import assert from "node:assert/strict";
import { createServer } from "node:http2";

export const expectedProtoRequestText = "owned-input";

/** Literal NeDB resources: embedded text, never original filesystem paths.
 * @param {string} address */
export function legacyProtoRecords(address) {
  assert.match(address, /^http:\/\/127\.0\.0\.1:\d+$/);
  const ids = {
    workspace: "wrk_legacy_proto", request: "greq_selected", selectedFile: "pf_selected",
    otherRequest: "greq_other", otherFile: "pf_other", missingRequest: "greq_missing",
    missingFile: "pf_missing", rootA: "pd_a", rootB: "pd_b", unsafeFile: "pf_unsafe",
  };
  const expectedMethods = { selected: "/owned.Probe/Echo", other: "/alternate.Probe/Echo" };
  /** @param {string} id @param {string} parentId @param {string} name */
  const directory = (id, parentId, name) => ({ _id: id, type: "ProtoDirectory", parentId, name });
  /** @param {string} id @param {string} parentId @param {string} name @param {string} protoText */
  const file = (id, parentId, name, protoText) => ({ _id: id, type: "ProtoFile", parentId, name, protoText });
  /** @param {string} id @param {string} name @param {string} protoFileId @param {string} protoMethodName */
  const request = (id, name, protoFileId, protoMethodName) => ({
    _id: id, type: "GrpcRequest", parentId: ids.workspace, name, url: address,
    protoFileId, protoMethodName, body: { text: JSON.stringify({ text: expectedProtoRequestText }) },
    metadata: [{ name: "owned-proto", value: "legacy-embedded" }],
    literal: { protoFileId }, isPrivate: false,
  });
  /** @type {Record<string,any>[]} */
  const records = [
    { _id: ids.workspace, type: "Workspace", parentId: null, name: "Owned legacy proto roots", scope: "collection" },
    directory(ids.rootA, ids.workspace, "shared"),
    directory(ids.rootB, ids.workspace, "shared"),
    directory("pd_first", ids.rootA, "first"),
    directory("pd_second", ids.rootA, "second"),
    directory("pd_deep", "pd_first", "deep"),
    directory("pd_empty", "pd_first", "empty"),
    directory("pd_nested", "pd_first", "nested"),
    directory("pd_last", "pd_second", "last"),
    file(ids.selectedFile, ids.rootA, "entry.proto", 'syntax = "proto3"; package owned; import "common.proto"; service Probe { rpc Echo(Envelope) returns (Envelope); }'),
    // Old file-encounter ordering picks this deeper incompatible definition first.
    file("pf_deep_common", "pd_deep", "common.proto", 'syntax = "proto3"; package owned; message Envelope { int32 wrong = 2; }'),
    file("pf_parent_common", "pd_first", "common.proto", 'syntax = "proto3"; package owned; import "nested/support.proto"; message Envelope { string text = 1; Support support = 2; }'),
    file("pf_support", "pd_nested", "support.proto", 'syntax = "proto3"; package owned; message Support { string tag = 1; }'),
    file(ids.otherFile, ids.rootB, "entry.proto", 'syntax = "proto3"; package alternate; message Envelope { string text = 1; } service Probe { rpc Echo(Envelope) returns (Envelope); }'),
    directory("pd_unsafe", ids.workspace, "unsafe"),
    directory("pd_escape", "pd_unsafe", ".."),
    file(ids.unsafeFile, "pd_escape", "unsafe.proto", 'syntax = "proto3"; package unsafe; message Never {}'),
    directory("pd_missing", ids.workspace, "missing"),
    file(ids.missingFile, "pd_missing", "entry.proto", 'syntax = "proto3"; package missing; import "absent.proto"; service Probe { rpc Echo(Absent) returns (Absent); }'),
    request(ids.request, "Legacy selected proto", ids.selectedFile, expectedMethods.selected),
    request(ids.otherRequest, "Legacy alternate proto", ids.otherFile, expectedMethods.other),
    request(ids.missingRequest, "Legacy missing import", ids.missingFile, "/missing.Probe/Echo"),
  ];
  return {
    records, dbText: records.map((row) => JSON.stringify(row)).join("\r\n") + "\r\n", ids,
    expectedMethods, expectedRequestText: expectedProtoRequestText,
    expectedIncludes: ["first", "first/deep", "first/empty", "first/nested", "second", "second/last"],
  };
}

/** Independent small protobuf string/HTTP2 gRPC framing oracle.
 * @param {string} text */
export function legacyProtoEchoFrame(text) {
  const value = Buffer.from(text);
  assert.ok(value.length < 128, "Closed fixture string size");
  const payload = Buffer.concat([Buffer.from([10, value.length]), value]);
  const header = Buffer.alloc(5);
  header.writeUInt32BE(payload.length, 1);
  return Buffer.concat([header, payload]);
}

/** Owned plaintext loopback HTTP2 only; no reflection/server-side proto compiler.
 * Must outlive withNativeApp and retire naturally AFTER its host exits. */
export async function createLegacyProtoFixture() {
  const server = createServer();
  /** @type {any[]} */ const records = [];
  /** @type {any[]} */ const sessionRecords = [];
  /** @type {any[]} */ const socketRecords = [];
  /** @type {string[]} */ const errors = [];
  /** @type {any[]} */ const errorEvents = [];
  const recordError = (/** @type {string} */ scope, /** @type {number} */ id, /** @type {any} */ error) => {
    if (errorEvents.length >= 256) {
      if (!errors.includes("Fixture error event bound exceeded")) errors.push("Fixture error event bound exceeded");
      return;
    }
    const message = String(error);
    errorEvents.push({ index: errorEvents.length, scope, id, at: Date.now(),
      code: typeof error?.code === "string" ? error.code : null,
      message: message.slice(0, 1024), messageTruncated: message.length > 1024 });
  };
  const sessions = new Map(), sockets = new Map(), streams = new Set();
  const sessionIds = new WeakMap();
  server.on("error", (error) => recordError("server", 0, error));
  const socketIds = new Map();
  /** @param {import('node:net').Socket} socket */
  const observeSocket = (socket) => {
    assert.ok(socket.remotePort && socket.localPort, "Actual connected socket identity");
    const key = [socket.localAddress, socket.localPort, socket.remoteAddress, socket.remotePort].join("|");
    if (socketIds.has(key)) return socketIds.get(key);
    const row = { id: socketRecords.length + 1, localPort: socket.localPort, remotePort: socket.remotePort,
      openedAt: Date.now(), closedAt: /** @type {number|null} */ (null) };
    socketRecords.push(row); sockets.set(socket, row); socketIds.set(key, row.id);
    socket.on("error", (error) => recordError("socket", row.id, error));
    socket.once("close", () => { row.closedAt = Date.now(); sockets.delete(socket); });
    return row.id;
  };
  server.on("connection", observeSocket);
  server.on("session", (session) => {
    const socketId = observeSocket(session.socket);
    const row = { id: sessionRecords.length + 1, socketId, openedAt: Date.now(), closedAt: /** @type {number|null} */ (null) };
    sessionRecords.push(row); sessions.set(session, row); sessionIds.set(session, row.id);
    session.on("error", (error) => recordError("session", row.id, error));
    session.once("close", () => { row.closedAt = Date.now(); sessions.delete(session); });
  });
  server.on("stream", (/** @type {import('node:http2').ServerHttp2Stream} */ stream, headers) => {
    const session = stream.session;
    assert.ok(session);
    const row = {
      id: records.length + 1, sessionId: sessionIds.get(session),
      path: String(headers[":path"]), method: String(headers[":method"]),
      metadata: headers["owned-proto"] ?? null, enteredAt: Date.now(),
      requestFrameBase64: "", responseFrameBase64: "", text: "", replyText: "",
      incomingFrameBase64: "", outgoingFrameBase64: "", requestText: "",
      closedAt: /** @type {number|null} */ (null), rstCode: 0,
      trailersSentAt: /** @type {number|null} */ (null),
      responseFinishedAt: /** @type {number|null} */ (null),
    };
    records.push(row); streams.add(stream);
    const chunks = /** @type {Buffer[]} */ ([]);
    let length = 0, responded = false;
    stream.on("error", (error) => recordError("stream", row.id, error));
    stream.once("finish", () => { row.responseFinishedAt = Date.now(); });
    stream.once("close", () => { row.closedAt = Date.now(); row.rstCode = stream.rstCode; streams.delete(stream); });
    const refuse = (/** @type {unknown} */ error) => {
      errors.push(String(error));
      if (!stream.destroyed) stream.close(2);
    };
    stream.on("data", (chunk) => {
      try {
        length += chunk.length;
        assert.ok(length <= 65536, "Owned proto fixture request exceeded 64 KiB");
        chunks.push(Buffer.from(chunk));
        const received = Buffer.concat(chunks);
        if (responded) {
          assert.deepEqual(received, legacyProtoEchoFrame(expectedProtoRequestText), "No trailing request frames");
          return;
        }
        if (received.length < 5) return;
        assert.equal(received[0], 0, "Uncompressed fixture request frame");
        const declared = received.readUInt32BE(1);
        assert.ok(declared <= 65531, "Bounded declared request frame");
        if (received.length < 5 + declared) return;
        responded = true;
        assert.ok(length <= 65536);
        assert.equal(row.method, "POST");
        assert.ok(["/owned.Probe/Echo", "/alternate.Probe/Echo"].includes(row.path));
        assert.equal(row.metadata, "legacy-embedded");
        const bytes = Buffer.concat(chunks);
        row.requestFrameBase64 = bytes.toString("base64");
        row.incomingFrameBase64 = row.requestFrameBase64;
        assert.deepEqual(bytes, legacyProtoEchoFrame(expectedProtoRequestText), "Exact single uncompressed request frame");
        row.text = expectedProtoRequestText;
        row.requestText = row.text;
        const reply = legacyProtoEchoFrame(expectedProtoRequestText);
        row.responseFrameBase64 = reply.toString("base64");
        row.outgoingFrameBase64 = row.responseFrameBase64; row.replyText = expectedProtoRequestText;
        stream.respond({ ":status": 200, "content-type": "application/grpc", "owned-proto-reply": "exact" }, { waitForTrailers: true });
        stream.once("wantTrailers", () => {
          try {
            stream.sendTrailers({ "grpc-status": "0", "owned-proto-trailer": "complete" });
            row.trailersSentAt = Date.now();
          } catch (error) { refuse(error); }
        });
        stream.end(reply);
      } catch (error) { refuse(error); }
    });
    stream.on("end", () => {
      try {
        assert.ok(responded, "A complete unary request frame was observed");
        assert.deepEqual(Buffer.concat(chunks), legacyProtoEchoFrame(expectedProtoRequestText), "One exact request frame through end");
      } catch (error) { refuse(error); }
    });
  });
  let endpoint;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve(null));
    });
    endpoint = server.address();
    assert.ok(endpoint && typeof endpoint === "object");
  } catch (error) {
    server.close();
    server.unref();
    throw error;
  }
  return {
    address: `http://127.0.0.1:${endpoint.port}`, records, wireRecords: records, sessionRecords, socketRecords, errors, errorEvents,
    get liveSessions() { return sessions.size; },
    get liveSockets() { return sockets.size; },
    async closeAfterHostExit() {
      const started = Date.now();
      while ((sessions.size || sockets.size || streams.size) && Date.now() - started < 15000) await Bun.sleep(25);
      if (sessions.size || sockets.size || streams.size) {
        // Stop accepting; never destroy live peers to manufacture retirement.
        server.close(); server.unref();
        for (const session of sessions.keys()) session.unref();
        for (const socket of sockets.keys()) socket.unref();
      }
      if (records.length) {
        assert.ok(sessionRecords.length > 0, "Nonempty actual HTTP2 session witnesses");
        assert.ok(socketRecords.length > 0, "Nonempty actual socket witnesses");
      }
      assert.equal(streams.size, 0, "All actual gRPC streams close after host exit");
      assert.equal(sessions.size, 0, "All actual HTTP2 sessions close after host exit");
      assert.equal(sockets.size, 0, "All actual sockets close after host exit");
      assert.ok(records.every((row) => row.closedAt !== null));
      assert.ok(sessionRecords.every((row) => row.closedAt !== null));
      assert.ok(socketRecords.every((row) => row.closedAt !== null));
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(null)));
      assert.deepEqual(errors, []);
      const classifiedCompletedProtocolResets = [];
      const unclassifiedErrors = [];
      const expected = legacyProtoEchoFrame(expectedProtoRequestText).toString("base64");
      for (const event of errorEvents) {
        const relatedSessions = event.scope === "session"
          ? sessionRecords.filter((row) => row.id === event.id)
          : event.scope === "socket" ? sessionRecords.filter((row) => row.socketId === event.id) : [];
        const relatedStreams = records.filter((row) => relatedSessions.some((session) => session.id === row.sessionId));
        const relatedSockets = socketRecords.filter((row) => relatedSessions.some((session) => session.socketId === row.id));
        const completed = event.code === "ECONNRESET" && relatedSessions.length > 0 &&
          relatedSockets.length > 0 && relatedStreams.length > 0 &&
          relatedSessions.every((row) => row.closedAt !== null) && relatedSockets.every((row) => row.closedAt !== null) &&
          relatedStreams.every((row) => row.closedAt !== null && row.closedAt <= event.at && row.rstCode === 0 &&
            row.requestFrameBase64 === expected && row.responseFrameBase64 === expected &&
            row.responseFinishedAt !== null && row.responseFinishedAt <= event.at &&
            row.trailersSentAt !== null && row.trailersSentAt <= event.at);
        if (completed) classifiedCompletedProtocolResets.push({ errorIndex: event.index,
          classification: "peer transport reset after completed protocol", sessionIds: relatedSessions.map((row) => row.id),
          socketIds: relatedSockets.map((row) => row.id), streamIds: relatedStreams.map((row) => row.id) });
        else unclassifiedErrors.push(event);
      }
      assert.deepEqual(unclassifiedErrors, [], "Unclassified fixture errors remain fatal");
      return { passed: true, retirementStartedAt: started, finishedAt: Date.now(), records, sessions: sessionRecords, sockets: socketRecords, errors, errorEvents, classifiedCompletedProtocolResets,
        transportLimits: "Completed protocol reset classification is not graceful TCP FIN proof.", forcedSocketClosure: false, forcedSessionClosure: false };
    },
  };
}
