import assert from "node:assert/strict";
import { appendStreamEvent } from "../src/lib/streaming.js";
const MiB = 1024 * 1024;
const large = JSON.stringify({ value: "x".repeat(9 * MiB) });
const empty = () => ({
  events: /** @type {Record<string,any>[]} */ ([]),
  retainedBytes: 0,
  dropped: 0,
});
const cases = [];
for (const kind of ["sent", "message", "sse"]) {
  const response = empty();
  const payload =
    kind === "sse" ? { kind, data: large } : { kind, text: large };
  appendStreamEvent(response, payload);
  for (const terminal of [
    { kind: "metadata", headers: [["content-type", "application/grpc"]] },
    { kind: "status", code: 0, details: "OK", trailers: [] },
    { kind: "error", message: "Call cancelled" },
  ]) {
    appendStreamEvent(response, terminal);
    assert.equal(response.events.filter((e) => e.kind === kind).length, 1);
    assert.equal(
      response.events.find((e) => e.kind === kind)?.[
        kind === "sse" ? "data" : "text"
      ],
      large,
    );
  }
  cases.push(kind + "-terminal-retention");
}
for (const next of [
  { kind: "sent", text: "small next send" },
  { kind: "message", text: "small reply" },
]) {
  const response = empty();
  appendStreamEvent(response, { kind: "sent", text: large });
  appendStreamEvent(response, next);
  assert.equal(
    response.events.some((e) => e.text === large),
    false,
  );
  assert.equal(response.events.at(-1)?.text, next.text);
  assert.ok(response.retainedBytes <= 8 * MiB);
  cases.push("large-sent-replaced-by-" + next.kind);
}
const metadata = empty();
appendStreamEvent(metadata, { kind: "sent", text: large });
for (let i = 0; i < 12; i++)
  appendStreamEvent(metadata, { kind: "metadata", value: "m".repeat(MiB) });
const sent = metadata.events.find((e) => e.kind === "sent");
assert.equal(sent?.text, large);
assert.ok(metadata.retainedBytes - sent.byteLength <= 8 * MiB);
assert.ok(metadata.dropped > 0);
cases.push("metadata-byte-budget");
const counted = empty();
appendStreamEvent(counted, { kind: "sent", text: large });
for (let i = 0; i < 1005; i++)
  appendStreamEvent(counted, { kind: "status", code: i });
assert.equal(counted.events.length, 1000);
assert.equal(counted.events[0].text, large);
assert.equal(counted.dropped, 6);
cases.push("metadata-count-budget");
const socket = empty();
appendStreamEvent(socket, { kind: "message", format: "text", data: large });
appendStreamEvent(socket, { kind: "message", format: "pong", data: "pong" });
appendStreamEvent(socket, { kind: "closed", code: 1000 });
assert.equal(socket.events.find((e) => e.format === "text")?.data, large);
cases.push("websocket-control-terminal-retention");
console.log(JSON.stringify({ passed: true, cases }));
