import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

/** Small real Git pack for saved native UI scenarios; no external Git process.
 * Format: https://git-scm.com/docs/pack-format */
/** @param {{advance?:boolean,shallow?:boolean}} [options] */
export function gitPackFixture({ advance = false, shallow = false } = {}) {
  /** @type {{type:"commit"|"tree"|"blob",data:Buffer,oid:string}[]} */
  const objects = [];
  /** @param {"commit"|"tree"|"blob"} type @param {string|Buffer} bytes */
  function object(type, bytes) {
    const data = Buffer.from(bytes);
    const oid = createHash("sha1")
      .update(type + " " + data.length + "\0")
      .update(data)
      .digest("hex");
    objects.push({ type, data, oid });
    return oid;
  }
  const blob = object("blob", Buffer.from([0, 1, 2, 255]));
  const tree = object(
    "tree",
    Buffer.concat([
      Buffer.from("100644 external.bin\0"),
      Buffer.from(blob, "hex"),
    ]),
  );
  const author = "Fixture <fixture@example.invalid> 1700000000 +0000";
  const first = object(
    "commit",
    "tree " +
      tree +
      "\nauthor " +
      author +
      "\ncommitter " +
      author +
      "\n\nfirst\n",
  );
  let oid = object(
    "commit",
    "tree " +
      tree +
      "\nparent " +
      first +
      "\nauthor " +
      author +
      "\ncommitter " +
      author +
      "\n\nsecond\n",
  );
  if (advance)
    oid = object(
      "commit",
      "tree " +
        tree +
        "\nparent " +
        oid +
        "\nauthor " +
        author +
        "\ncommitter " +
        author +
        "\n\nthird\n",
    );
  const packed = shallow
    ? objects.filter((item) => item.type !== "commit" || item.oid === oid)
    : objects;
  const pack = packGitObjects(packed);
  const packet = (/** @type {string} */ s) =>
    (Buffer.byteLength(s) + 4).toString(16).padStart(4, "0") + s;
  const advertisement =
    packet("# service=git-upload-pack\n") +
    "0000" +
    packet(
      oid +
        " HEAD\0multi_ack" +
        (shallow ? " shallow" : "") +
        " symref=HEAD:refs/heads/main\n",
    ) +
    packet(oid + " refs/heads/main\n") +
    packet(oid + " refs/heads/feature/a\n") +
    "0000";
  return { oid, first, blob, tree, pack, advertisement };
}

/** Pack real object bodies for saved smart-HTTP scenarios.
 * @param {{type:"commit"|"tree"|"blob",data:Buffer}[]} packed */
export function packGitObjects(packed) {
  const header = Buffer.alloc(12);
  header.write("PACK");
  header.writeUInt32BE(2, 4);
  header.writeUInt32BE(packed.length, 8);
  const chunks = [header];
  for (const { type, data } of packed) {
    let size = data.length;
    const bytes = [({ commit: 1, tree: 2, blob: 3 }[type] << 4) | (size & 15)];
    size >>>= 4;
    while (size) {
      bytes[bytes.length - 1] |= 128;
      bytes.push(size & 127);
      size >>>= 7;
    }
    chunks.push(Buffer.from(bytes), deflateSync(data));
  }
  const body = Buffer.concat(chunks);
  return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
