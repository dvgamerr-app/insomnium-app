// RPM v4 signature-header size tags. Main header, payload and signatures stay
// byte-identical. See rpm.org/docs/6.0.x/manual/format_v4.html and RPM4.18
// lib/package.c / rpm2cpio.c. Native RPM tools verify before publication.
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  readFile,
  writeFile,
  link,
  rename,
  unlink,
} from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const magic = Buffer.from("8eade80100000000", "hex");
const align = (value, boundary) => Math.ceil(value / boundary) * boundary;

function signature(bytes) {
  assert(
    bytes.length >= 112 &&
      bytes.subarray(0, 4).equals(Buffer.from("edabeedb", "hex")) &&
      bytes[4] === 3,
    "Expected RPM v4 package lead",
  );
  assert(bytes.subarray(96, 104).equals(magic), "Invalid RPM signature header");
  const count = bytes.readUInt32BE(104),
    size = bytes.readUInt32BE(108);
  assert(
    count > 0 && count <= 65536 && size <= 16 * 1024 * 1024,
    "Invalid RPM signature bounds",
  );
  const start = 112 + count * 16,
    end = start + size,
    next = align(end, 8);
  assert(
    next + 16 <= bytes.length && bytes.subarray(next, next + 8).equals(magic),
    "Missing RPM main header",
  );
  assert(
    bytes.subarray(end, next).every((byte) => byte === 0),
    "Nonzero signature padding",
  );
  const data = bytes.subarray(start, end),
    entries = [],
    tags = new Set();
  for (let index = 0; index < count; index++) {
    const at = 112 + index * 16;
    const tag = bytes.readUInt32BE(at),
      type = bytes.readUInt32BE(at + 4),
      offset = bytes.readUInt32BE(at + 8),
      length = bytes.readUInt32BE(at + 12);
    assert(!tags.has(tag) && offset <= size, "Invalid RPM signature index");
    tags.add(tag);
    let finish = offset;
    if ([1, 2, 3, 4, 5, 7].includes(type)) {
      const width = { 3: 2, 4: 4, 5: 8 }[type] ?? 1;
      assert(offset % width === 0, "Unaligned RPM signature value");
      finish += width * length;
    } else if ([6, 8, 9].includes(type)) {
      assert(
        length <= size && (type !== 6 || length === 1),
        "Invalid RPM signature strings",
      );
      for (let item = 0; item < length; item++) {
        const zero = data.indexOf(0, finish);
        assert(zero >= finish, "Unterminated RPM signature string");
        finish = zero + 1;
      }
    } else throw Error("Unsupported RPM signature value type");
    assert(finish <= size, "RPM signature value exceeds header");
    entries.push({ tag, type, offset, count: length, finish });
  }
  const region = entries[0];
  assert(
    region.tag === 62 &&
      region.type === 7 &&
      region.count === 16 &&
      region.finish === size,
    "Expected single immutable signature region",
  );
  assert(
    data.readUInt32BE(region.offset) === 62 &&
      data.readUInt32BE(region.offset + 4) === 7 &&
      data.readInt32BE(region.offset + 8) === -count * 16 &&
      data.readUInt32BE(region.offset + 12) === 16,
    "Invalid signature region trailer",
  );
  assert(
    entries
      .slice(1)
      .every((entry) => entry.tag > 62 && entry.finish <= region.offset),
    "Signature value overlaps region trailer",
  );
  return { data, entries, region, next };
}

function withSize(bytes, archiveSize) {
  const header = signature(bytes);
  assert(
    !header.entries.some((entry) => entry.tag === 271),
    "Archive size already present",
  );
  const entries = header.entries
    .slice(1)
    .map((entry) => ({
      ...entry,
      value: header.data.subarray(entry.offset, entry.finish),
    }));
  const size64 = Buffer.alloc(8);
  size64.writeBigUInt64BE(archiveSize);
  entries.push({ tag: 271, type: 5, count: 1, value: size64 });
  if (
    archiveSize <= 0xffffffffn &&
    !entries.some((entry) => entry.tag === 1007)
  ) {
    const size32 = Buffer.alloc(4);
    size32.writeUInt32BE(Number(archiveSize));
    entries.push({ tag: 1007, type: 4, count: 1, value: size32 });
  }
  entries.sort((a, b) => a.tag - b.tag);
  const chunks = [];
  let offset = 0;
  for (const entry of entries) {
    const width = { 3: 2, 4: 4, 5: 8 }[entry.type] ?? 1;
    const padding = align(offset, width) - offset;
    chunks.push(Buffer.alloc(padding), entry.value);
    offset += padding;
    entry.offset = offset;
    offset += entry.value.length;
  }
  entries.unshift({ tag: 62, type: 7, offset, count: 16 });
  const trailer = Buffer.alloc(16);
  trailer.writeUInt32BE(62);
  trailer.writeUInt32BE(7, 4);
  trailer.writeInt32BE(-entries.length * 16, 8);
  trailer.writeUInt32BE(16, 12);
  chunks.push(trailer);
  const data = Buffer.concat(chunks),
    indexes = Buffer.alloc(entries.length * 16);
  entries.forEach((entry, index) => {
    const at = index * 16;
    indexes.writeUInt32BE(entry.tag, at);
    indexes.writeUInt32BE(entry.type, at + 4);
    indexes.writeUInt32BE(entry.offset, at + 8);
    indexes.writeUInt32BE(entry.count, at + 12);
  });
  const prefix = Buffer.alloc(16);
  magic.copy(prefix);
  prefix.writeUInt32BE(entries.length, 8);
  prefix.writeUInt32BE(data.length, 12);
  const sig = Buffer.concat([prefix, indexes, data]);
  const result = Buffer.concat([
    bytes.subarray(0, 96),
    sig,
    Buffer.alloc(align(sig.length, 8) - sig.length),
    bytes.subarray(header.next),
  ]);
  const updated = signature(result);
  assert(
    result.subarray(updated.next).equals(bytes.subarray(header.next)),
    "RPM main header/payload changed",
  );
  for (const entry of header.entries.slice(1)) {
    const next = updated.entries.find((item) => item.tag === entry.tag);
    assert(
      next &&
        next.type === entry.type &&
        next.count === entry.count &&
        updated.data
          .subarray(next.offset, next.finish)
          .equals(header.data.subarray(entry.offset, entry.finish)),
      "Existing signature value changed",
    );
  }
  return result;
}

async function readPayload(path) {
  const child = Bun.spawn(["rpm2cpio", path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stderr = new Response(child.stderr).text();
  let bytes = 0n;
  const hash = createHash("sha256");
  for await (const chunk of child.stdout) {
    bytes += BigInt(chunk.length);
    hash.update(chunk);
  }
  return {
    bytes,
    sha256: hash.digest("hex"),
    exitCode: await child.exited,
    stderr: await stderr,
  };
}
async function verifyDigests(path) {
  // Authenticity is not re-established here. Existing signature bytes are
  // preserved above; this check verifies header/payload digests without keys.
  const child = Bun.spawn(["rpm", "--checksig", "--nosignature", path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  assert(exit === 0, "RPM digest verification failed: " + stdout + stderr);
}

export async function normalizeRpmArchiveSize(argument) {
  const path = resolve(argument),
    stat = await lstat(path);
  assert(
    stat.isFile() && !stat.isSymbolicLink(),
    "Expected ordinary RPM output",
  );
  const original = await readFile(path),
    header = signature(original);
  await verifyDigests(path);
  const before = await readPayload(path);
  const legacy = header.entries.find((entry) => entry.tag === 1007);
  if (legacy)
    assert(
      legacy.type === 4 &&
        legacy.count === 1 &&
        BigInt(header.data.readUInt32BE(legacy.offset)) === before.bytes,
      "Invalid existing 32-bit RPM archive size",
    );
  const existing = header.entries.find((entry) => entry.tag === 271);
  if (existing) {
    assert(
      existing.type === 5 &&
        existing.count === 1 &&
        header.data.readBigUInt64BE(existing.offset) === before.bytes &&
        before.exitCode === 0 &&
        !before.stderr,
      "Invalid existing RPM archive size",
    );
    return {
      path,
      changed: false,
      archiveBytes: String(before.bytes),
      sha256: digest(original),
    };
  }
  assert(
    [0, 1].includes(before.exitCode) && before.bytes > 0n && !before.stderr,
    "Cannot read RPM archive for size normalization",
  );
  const candidate = withSize(original, before.bytes),
    temporary = path + "." + randomUUID() + ".rpm";
  let retainedTemporary = false;
  try {
    await writeFile(temporary, candidate, { flag: "wx", mode: stat.mode });
    await verifyDigests(temporary);
    const after = await readPayload(temporary);
    assert(
      after.exitCode === 0 &&
        !after.stderr &&
        after.bytes === before.bytes &&
        after.sha256 === before.sha256,
      "Normalized RPM archive verification failed",
    );
    assert(
      (await lstat(path)).isFile() && (await readFile(path)).equals(original),
      "RPM output changed during normalization",
    );
    const backup = path + ".before-archive-size." + digest(original);
    try {
      await link(path, backup); // Never replace an older original/failure receipt.
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      assert(
        (await lstat(backup)).isFile() &&
          (await readFile(backup)).equals(original),
        "Original RPM backup conflict",
      );
    }
    await rename(temporary, path);
    retainedTemporary = true;
    return {
      path,
      changed: true,
      backup,
      archiveBytes: String(before.bytes),
      cpioSha256: before.sha256,
      beforeSha256: digest(original),
      sha256: digest(candidate),
    };
  } finally {
    if (!retainedTemporary)
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
  }
}

if (import.meta.main) {
  assert(
    Bun.argv.length === 3,
    "Usage: bun scripts/normalize-rpm-archive-size.mjs PACKAGE.rpm",
  );
  console.log(JSON.stringify(await normalizeRpmArchiveSize(Bun.argv[2])));
}
