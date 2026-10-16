import assert from "node:assert/strict";
import { grpcBytesArraylikeCase } from "./grpc-bytes-arraylike-case-data.js";
import { grpcReflectionServiceCase } from "./grpc-reflection-service-case-data.js";
import { grpcReflectionArrivalCase } from "./grpc-reflection-arrival-case-data.js";
import {
  grpcReflectionProfileCase,
  profileGrpcFrame,
} from "./grpc-reflection-profile-case-data.js";

/** Each reflection load owns a new channel/session; cache gates never cross loads.
 * @type {WeakMap<object,{closedSeeds:Set<string>,waitingSeeds:(()=>void)[],graphRelease:(()=>void)[],graphReleased:boolean}>} */
const arrivalSessions = new WeakMap();

/** @param {number} value */
function varint(value) {
  assert.ok(Number.isSafeInteger(value) && value >= 0);
  const out = [];
  do {
    const byte = value % 128;
    value = Math.floor(value / 128);
    out.push(byte | (value ? 128 : 0));
  } while (value);
  return Buffer.from(out);
}
/** @param {number} field @param {Buffer|string} value */
function bytesField(field, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([varint(field * 8 + 2), varint(bytes.length), bytes]);
}
/** Bounded descriptor/query reader; unknown primitive descriptor fields are skipped.
 * @param {Buffer} bytes */
export function reflectionFields(bytes) {
  let offset = 0;
  function read() {
    let value = 0;
    for (let shift = 0; shift < 49; shift += 7) {
      assert.ok(offset < bytes.length, "Truncated reflection varint");
      const byte = bytes[offset++];
      value += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) {
        assert.ok(Number.isSafeInteger(value));
        return value;
      }
    }
    throw Error("Oversized reflection varint");
  }
  /** @type {{field:number,value:Buffer}[]} */ const fields = [];
  while (offset < bytes.length) {
    const tag = read(),
      field = Math.floor(tag / 8),
      type = tag % 8;
    assert.ok(field > 0);
    if (type === 0) {
      read();
      continue;
    }
    const size = type === 2 ? read() : type === 1 ? 8 : type === 5 ? 4 : -1;
    assert.ok(
      size >= 0 && offset + size <= bytes.length,
      "Invalid reflection field",
    );
    if (type === 2)
      fields.push({ field, value: bytes.subarray(offset, offset + size) });
    offset += size;
  }
  return fields;
}

/** Real v1/v1alpha wire service backed by pinned server descriptors.
 * @param {import('node:http2').ServerHttp2Stream} stream
 * @param {import('node:http2').IncomingHttpHeaders} headers
 * @param {Record<string,any>[]} records @param {string[]} errors */
export function handleGrpcProfileReflection(stream, headers, records, errors) {
  const path = String(headers[":path"]);
  if (
    !/^\/grpc\.reflection\.(v1|v1alpha)\.ServerReflection\/ServerReflectionInfo$/.test(
      path,
    )
  )
    return false;
  const mode = String(headers["owned-case"]),
    spec = mode.startsWith("legacy-arraylike-")
      ? grpcBytesArraylikeCase(mode)
      : mode.startsWith("legacy-arrival-")
        ? grpcReflectionArrivalCase(mode)
        : mode.startsWith("legacy-service-")
          ? grpcReflectionServiceCase(mode)
          : grpcReflectionProfileCase(mode);
  const services = spec.services ?? [spec.service];
  const plan = spec.arrivalPlan;
  const session = stream.session;
  if (plan) assert.ok(session, "Owned arrival stream requires a session");
  let arrivalState = plan && session ? arrivalSessions.get(session) : undefined;
  if (plan && session && !arrivalState) {
    arrivalState = {
      closedSeeds: new Set(),
      waitingSeeds: [],
      graphRelease: [],
      graphReleased: false,
    };
    arrivalSessions.set(session, arrivalState);
  }
  const rejected = spec.alphaOnly === true && path.includes(".v1.");
  const row = {
    id: records.length + 1,
    mode,
    path,
    rejected,
    queries: /** @type {any[]} */ ([]),
    responses: 0,
    descriptorReplies: /** @type {any[]} */ ([]),
    verified: false,
    closedAt: /** @type {number|null} */ (null),
    rstCode: /** @type {number|null} */ (null),
    errors: /** @type {any[]} */ ([]),
  };
  records.push(row);
  stream.on("error", (error) =>
    row.errors.push({
      code: /** @type {any} */ (error).code,
      message: String(error),
    }),
  );
  stream.once("close", () => {
    row.closedAt = Date.now();
    row.rstCode = stream.rstCode;
    const symbol = row.queries.find((query) => query.field === 4)?.value;
    if (arrivalState && plan.seedServices.includes(symbol)) {
      assert.ok(row.verified, "Seed cache gate needs a verified response");
      arrivalState.closedSeeds.add(symbol);
      if (
        plan.seedServices.every((/** @type {string} */ name) =>
          arrivalState.closedSeeds.has(name),
        )
      ) {
        for (const resume of arrivalState.waitingSeeds.splice(0)) resume();
      }
    }
  });
  stream.respond(
    { ":status": 200, "content-type": "application/grpc" },
    { waitForTrailers: true },
  );
  stream.on("wantTrailers", () =>
    stream.sendTrailers({ "grpc-status": rejected ? "12" : "0" }),
  );
  const files = reflectionFields(Buffer.from(spec.descriptorSet, "base64"))
    .filter((f) => f.field === 1)
    .map((f) => f.value);
  assert.ok(files.length > 0);
  const byName = new Map(
    files.map((file) => [
      reflectionFields(file)
        .find((field) => field.field === 1)
        ?.value.toString(),
      file,
    ]),
  );
  const sentFiles = new Set();
  let buffered = Buffer.alloc(0),
    ended = false,
    inputEnded = false;
  /** @type {(()=>void)|undefined} */ let heldSibling;
  let preferredSent = false;
  const finish = () => {
    if (
      inputEnded &&
      row.responses === row.queries.length &&
      !ended &&
      !stream.destroyed
    ) {
      ended = true;
      stream.end();
    }
  };
  stream.on("data", (chunk) => {
    try {
      buffered = Buffer.concat([buffered, Buffer.from(chunk)]);
      assert.ok(
        buffered.length <= 1024 * 1024,
        "Reflection request exceeds fixture bound",
      );
      while (buffered.length >= 5) {
        assert.equal(buffered[0], 0);
        const size = buffered.readUInt32BE(1);
        assert.ok(size <= 1024 * 1024);
        if (buffered.length < size + 5) break;
        const payload = buffered.subarray(5, size + 5);
        buffered = buffered.subarray(size + 5);
        const queries = reflectionFields(payload).filter((f) =>
          [3, 4, 7].includes(f.field),
        );
        assert.equal(queries.length, 1);
        const query = queries[0],
          value = query.value.toString();
        row.queries.push({ field: query.field, value });
        if (rejected) {
          row.verified = true;
          if (!ended) {
            ended = true;
            stream.end();
          }
          continue;
        }
        let answer;
        /** @type {{field:number,value:string,files:string[]}|undefined} */
        let descriptorReply;
        if (query.field === 7)
          answer = bytesField(
            6,
            Buffer.concat(
              services.map((/** @type {string} */ service) =>
                bytesField(1, bytesField(1, service)),
              ),
            ),
          );
        else {
          if (query.field === 4)
            assert.ok(services.includes(value), "Unknown reflected service");
          if (query.field === 3)
            assert.ok(
              files.some((file) =>
                reflectionFields(file).some(
                  (f) => f.field === 1 && f.value.toString() === value,
                ),
              ),
              "Unknown descriptor file",
            );
          const requested = spec.discoveryFileGroups
            ? query.field === 4
              ? spec.discoveryFileGroups[value]
              : [value]
            : [...byName.keys()];
          assert.ok(Array.isArray(requested));
          const selected = requested.filter(
            (/** @type {string} */ name) =>
              !spec.omitPreviouslySent || !sentFiles.has(name),
          );
          const returned = selected.map((/** @type {string} */ name) => {
            const file = byName.get(name);
            assert.ok(file, "Missing reflection fixture file");
            return file;
          });
          descriptorReply = {
            field: query.field,
            value,
            files: selected,
          };
          answer = bytesField(
            4,
            Buffer.concat(returned.map((file) => bytesField(1, file))),
          );
        }
        const send = () => {
          if (stream.destroyed || ended) return;
          if (descriptorReply) {
            row.descriptorReplies.push(descriptorReply);
            for (const name of descriptorReply.files) sentFiles.add(name);
          }
          stream.write(
            profileGrpcFrame(Buffer.concat([bytesField(2, payload), answer])),
          );
          row.responses++;
          row.verified = row.responses === row.queries.length;
          finish();
        };
        if (
          arrivalState &&
          query.field === 4 &&
          value === spec.service &&
          !plan.seedServices.every((/** @type {string} */ name) =>
            arrivalState.closedSeeds.has(name),
          )
        ) {
          arrivalState.waitingSeeds.push(send);
        } else if (
          arrivalState &&
          query.field === 3 &&
          plan.graph &&
          ((plan.label === "cold-deep-first" && value === "d.proto") ||
            (plan.label === "cold-shallow-first" && value === "c.proto"))
        ) {
          const resume = () => {
            const timer = setTimeout(send, 40);
            stream.once("close", () => clearTimeout(timer));
          };
          if (arrivalState.graphReleased) resume();
          else arrivalState.graphRelease.push(resume);
        } else {
          const bothMissing =
            plan && !plan.graph && plan.seedServices.length === 0;
          const preferred =
            plan?.arrival === "right-first" ? "right.proto" : "left.proto";
          if (
            bothMissing &&
            query.field === 3 &&
            value !== preferred &&
            !preferredSent
          ) {
            heldSibling = send;
          } else {
            send();
            if (bothMissing && query.field === 3 && value === preferred) {
              preferredSent = true;
              heldSibling?.();
              heldSibling = undefined;
            }
          }
          if (
            arrivalState &&
            query.field === 3 &&
            ((plan.label === "cold-deep-first" && value === "e.proto") ||
              (plan.label === "cold-shallow-first" && value === "d.proto"))
          ) {
            arrivalState.graphReleased = true;
            for (const resume of arrivalState.graphRelease.splice(0)) resume();
          }
        }
      }
    } catch (error) {
      errors.push(String(error));
      stream.close(2);
    }
  });
  stream.on("end", () => {
    if (buffered.length) errors.push("Incomplete reflection frame");
    inputEnded = true;
    finish();
  });
  return true;
}
