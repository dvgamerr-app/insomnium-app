import { Channel, invoke } from "@tauri-apps/api/core";

// Test-owned real Channel receiver. Application callbacks and native IPC are
// untouched; these separate native invocations intentionally control their ACKs.
// https://v2.tauri.app/develop/calling-rust/#channels
/** @type {Map<string,Record<string,any>>} */ const runs = new Map();
/** @param {Record<string,any>} run @param {number} sequence */
function acknowledge(run, sequence) {
  if (run.acked.has(sequence)) return;
  run.acked.add(sequence);
  void invoke("acknowledge_stream", { id: run.id, sequence }).catch((error) =>
    run.ackErrors.push(String(error)),
  );
}

if (/** @type {any} */ (window).__ownedSseAckProbe)
  throw Error("Refuse to replace an existing probe");
/** @type {any} */ (window).__ownedSseAckProbe = {
  /** @param {Record<string,any>} request @param {boolean} held
   * @param {'sse'|'websocket'} [protocol] */
  start(request, held, protocol = "sse") {
    if (!["sse", "websocket"].includes(protocol))
      throw Error("Unsupported owned probe protocol");
    if (runs.has(request.id) && !runs.get(request.id)?.done)
      throw Error("Refuse to replace a live probe invocation");
    const run = {
      id: request.id,
      held,
      protocol,
      manualAcks: /** @type {Record<string,any>[]} */ ([]),
      packets: /** @type {Record<string,any>[]} */ ([]),
      acked: new Set(),
      ackErrors: /** @type {string[]} */ ([]),
      startedAt: performance.now(),
      doneAt: 0,
      done: false,
      result: /** @type {Record<string,any>|null} */ (null),
      promise: /** @type {Promise<void>|undefined} */ (undefined),
    };
    runs.set(run.id, run);
    const channel = new Channel((/** @type {Record<string,any>} */ packet) => {
      run.packets.push({ ...packet, at: performance.now() });
      if (packet.sequence != null && !run.held)
        acknowledge(run, packet.sequence);
    });
    run.promise = invoke("connect_stream", {
      request,
      protocol,
      onEvent: channel,
    })
      .then(
        () => {
          run.result = { ok: true };
        },
        (error) => {
          run.result = { ok: false, error: String(error) };
        },
      )
      .finally(() => {
        run.doneAt = performance.now();
        run.done = true;
      });
  },
  /** @param {string} id */
  status(id) {
    const run = runs.get(id);
    if (!run) throw Error("Unknown owned probe");
    return {
      id,
      held: run.held,
      protocol: run.protocol,
      manualAcks: run.manualAcks,
      packets: run.packets,
      ackErrors: run.ackErrors,
      startedAt: run.startedAt,
      doneAt: run.doneAt,
      done: run.done,
      result: run.result,
    };
  },
  /** @param {string} id */
  release(id) {
    const run = runs.get(id);
    if (!run || run.done) throw Error("Probe is not live");
    run.held = false;
    for (const packet of run.packets)
      if (packet.sequence != null) acknowledge(run, packet.sequence);
  },
  /** Explicit native ACK controls, restricted to an owned UUID run or its
   * deliberately absent foreign-id control. No application callback is replaced.
   * @param {string} id @param {number} sequence @param {boolean} [foreign] */
  async ack(id, sequence, foreign = false) {
    const run = runs.get(id);
    if (!run || !Number.isSafeInteger(sequence) || sequence < 0)
      throw Error("Invalid owned acknowledgement control");
    const target = foreign ? id + "-foreign" : id;
    await invoke("acknowledge_stream", { id: target, sequence });
    run.manualAcks.push({ id: target, sequence, at: performance.now() });
  },
  /** @param {string} id */
  async cancel(id) {
    if (!runs.has(id) || runs.get(id)?.done) throw Error("Probe is not live");
    await invoke("cancel_http", { id });
  },
  async dispose() {
    for (const run of runs.values())
      if (!run.done) await invoke("cancel_http", { id: run.id });
    await Promise.all([...runs.values()].map((run) => run.promise));
    delete (/** @type {any} */ (window).__ownedSseAckProbe);
  },
};
