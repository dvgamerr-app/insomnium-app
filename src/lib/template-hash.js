import {md5, sha1, ripemd160} from "@noble/hashes/legacy.js";
import {sha224, sha256, sha384, sha512, sha512_224, sha512_256} from "@noble/hashes/sha2.js";
import {sha3_224, sha3_256, sha3_384, sha3_512, shake128, shake256} from "@noble/hashes/sha3.js";
import {blake2b, blake2s} from "@noble/hashes/blake2.js";

// Legacy createHash names, including digest aliases used by imported templates.
// Keep this explicit: signing aliases select a digest, never a signing operation.
/** @type {Map<string,(bytes:Uint8Array)=>Uint8Array>} */
const hashes = new Map();
/** @param {(bytes:Uint8Array)=>Uint8Array} hash @param {string[]} names */
function register(hash, names) { for (const name of names) hashes.set(name, hash); }
register(md5, ["md5", "rsa-md5"]);
register(sha1, ["sha1", "sha1withrsaencryption", "rsa-sha1", "rsa-sha1-2", "ssl3-sha1"]);
register(md5, ["ssl3-md5"]);
register(sha224, ["sha224", "sha224withrsaencryption", "rsa-sha224"]);
register(sha256, ["sha256", "sha256withrsaencryption", "rsa-sha256"]);
register(sha384, ["sha384", "sha384withrsaencryption", "rsa-sha384"]);
register(sha512, ["sha512", "sha512withrsaencryption", "rsa-sha512"]);
register(sha512_224, ["sha512-224", "sha512-224withrsaencryption", "rsa-sha512/224"]);
register(sha512_256, ["sha512-256", "sha512-256withrsaencryption", "rsa-sha512/256"]);
register(sha3_224, ["sha3-224", "id-rsassa-pkcs1-v1_5-with-sha3-224"]);
register(sha3_256, ["sha3-256", "id-rsassa-pkcs1-v1_5-with-sha3-256"]);
register(sha3_384, ["sha3-384", "id-rsassa-pkcs1-v1_5-with-sha3-384"]);
register(sha3_512, ["sha3-512", "id-rsassa-pkcs1-v1_5-with-sha3-512"]);
register(shake128, ["shake128"]);
register(shake256, ["shake256"]);
register(blake2b, ["blake2b512"]);
register(blake2s, ["blake2s256"]);
register(ripemd160, ["ripemd160", "ripemd", "rmd160", "rsa-ripemd160"]);
register(bytes => {
  const result = new Uint8Array(36);
  result.set(md5(bytes)); result.set(sha1(bytes), 16);
  return result;
}, ["md5-sha1"]);

/** @param {any} algorithm @param {string} value */
export function templateHash(algorithm, value) {
  if (typeof algorithm !== "string") throw new TypeError("Hash algorithm must be a string");
  const hash = hashes.get(algorithm.toLowerCase());
  if (!hash) throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  return hash(new TextEncoder().encode(value));
}
