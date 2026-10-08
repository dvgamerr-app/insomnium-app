import assert from "node:assert/strict";
import { join, relative, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import { X509Certificate } from "node:crypto";
import { dlopen, ptr } from "bun:ffi";

/** Generate owned multi-key containers with OpenSSL's public builder API, then
 * obtain an independent PKCS12_parse selection baseline (the Node TLS API).
 * @param {string} directory @param {string} password */
export async function pfxContainers(directory, password) {
  assert.equal(process.platform, "win32");
  assert.equal(process.arch, "x64");
  const root = await realpath(directory);
  const owned = relative(resolve("artifacts/playwright"), root);
  assert.ok(owned && !owned.startsWith("..") && !owned.includes(":"));
  const library = dlopen(
    "C:/Program Files/Git/mingw64/bin/libcrypto-3-x64.dll",
    {
      BIO_new_mem_buf: { args: ["ptr", "i32"], returns: "ptr" },
      BIO_free: { args: ["ptr"], returns: "i32" },
      PEM_read_bio_PrivateKey: {
        args: ["ptr", "ptr", "ptr", "ptr"],
        returns: "ptr",
      },
      PEM_read_bio_X509: { args: ["ptr", "ptr", "ptr", "ptr"], returns: "ptr" },
      EVP_PKEY_free: { args: ["ptr"], returns: "void" },
      X509_free: { args: ["ptr"], returns: "void" },
      PKCS7_free: { args: ["ptr"], returns: "void" },
      PKCS12_SAFEBAG_free: { args: ["ptr"], returns: "void" },
      PKCS12_free: { args: ["ptr"], returns: "void" },
      OPENSSL_sk_num: { args: ["ptr"], returns: "i32" },
      OPENSSL_sk_value: { args: ["ptr", "i32"], returns: "ptr" },
      OPENSSL_sk_free: { args: ["ptr"], returns: "void" },
      OPENSSL_sk_new_null: { args: [], returns: "ptr" },
      OPENSSL_sk_push: { args: ["ptr", "ptr"], returns: "i32" },
      OBJ_txt2nid: { args: ["ptr"], returns: "i32" },
      PKCS12_add_key: {
        args: ["ptr", "ptr", "i32", "i32", "i32", "ptr"],
        returns: "ptr",
      },
      PKCS12_add_cert: { args: ["ptr", "ptr"], returns: "ptr" },
      PKCS12_add_friendlyname_utf8: {
        args: ["ptr", "ptr", "i32"],
        returns: "i32",
      },
      PKCS12_add_localkeyid: { args: ["ptr", "ptr", "i32"], returns: "i32" },
      PKCS12_add_safe: {
        args: ["ptr", "ptr", "i32", "i32", "ptr"],
        returns: "i32",
      },
      PKCS12_add_safes: { args: ["ptr", "i32"], returns: "ptr" },
      PKCS12_set_mac: {
        args: ["ptr", "ptr", "i32", "ptr", "i32", "i32", "ptr"],
        returns: "i32",
      },
      EVP_sha256: { args: [], returns: "ptr" },
      i2d_PKCS12: { args: ["ptr", "ptr"], returns: "i32" },
      i2d_X509: { args: ["ptr", "ptr"], returns: "i32" },
      i2d_PKCS12_SAFEBAG: { args: ["ptr", "ptr"], returns: "i32" },
      d2i_PKCS12_SAFEBAG: { args: ["ptr", "ptr", "i32"], returns: "ptr" },
      PKCS12_parse: {
        args: ["ptr", "ptr", "ptr", "ptr", "ptr"],
        returns: "i32",
      },
      OpenSSL_version: { args: ["i32"], returns: "cstring" },
    },
  );
  const api = /** @type {any} */ (library.symbols);
  const text = (/** @type {string} */ value) => Buffer.from(value + "\0");
  const pointer = (/** @type {BigUint64Array} */ value) => Number(value[0]);
  const pass = text(password);
  const aes = text("AES-256-CBC");
  const dataType = text("pkcs7-data");
  const cipher = api.OBJ_txt2nid(ptr(aes));
  const type = api.OBJ_txt2nid(ptr(dataType));
  assert.ok(cipher > 0 && type > 0);
  /** @param {number} stack @param {(pointer:number)=>void} free */
  const freeStack = (stack, free) => {
    if (!stack) return;
    for (let index = 0; index < api.OPENSSL_sk_num(stack); index++)
      free(api.OPENSSL_sk_value(stack, index));
    api.OPENSSL_sk_free(stack);
  };
  /** @param {number} object @param {(object:number,out:number|null)=>number} encode */
  const der = (object, encode) => {
    const length = encode(object, null);
    assert.ok(length > 0 && length < 1024 * 1024);
    const bytes = Buffer.alloc(length);
    const cursor = new BigUint64Array([BigInt(ptr(bytes))]);
    assert.equal(encode(object, ptr(cursor)), length);
    return bytes;
  };
  const cases = [
    {
      id: "nested-safe",
      keys: ["client", "wrong-client"],
      certs: ["wrong-client", "client", "ca", "other-ca"],
      attributes: false,
      nested: true,
      success: true,
    },
    {
      id: "split-safes",
      keys: ["client", "wrong-client"],
      certs: ["wrong-client", "client", "ca", "other-ca"],
      attributes: false,
      splitSafes: true,
      success: true,
    },
    {
      id: "unencrypted-no-attributes",
      keys: ["client", "wrong-client"],
      certs: ["wrong-client", "client", "ca", "other-ca"],
      attributes: false,
      unencrypted: true,
      success: true,
    },
    {
      id: "first-key-wrong-password",
      keys: ["client", "wrong-client"],
      certs: ["client", "wrong-client", "ca", "other-ca"],
      attributes: true,
      wrongFirstPassword: true,
      success: false,
      preTcp: true,
    },
    {
      id: "first-client",
      keys: ["client", "wrong-client"],
      certs: ["wrong-client", "client", "ca", "other-ca"],
      attributes: true,
      success: true,
    },
    {
      id: "first-untrusted",
      keys: ["wrong-client", "client"],
      certs: ["client", "wrong-client", "ca", "other-ca"],
      attributes: true,
      success: false,
    },
    {
      id: "no-attributes",
      keys: ["client", "wrong-client"],
      certs: ["wrong-client", "client", "ca", "other-ca"],
      attributes: false,
      success: true,
    },
    {
      id: "later-key-wrong-password",
      keys: ["client", "wrong-client"],
      certs: ["client", "wrong-client", "ca", "other-ca"],
      attributes: true,
      wrongLaterPassword: true,
      success: true,
    },
    {
      id: "first-key-no-match",
      keys: ["wrong-client", "client"],
      certs: ["client", "ca"],
      attributes: false,
      success: false,
      preTcp: true,
    },
  ];
  const result = [];
  try {
    for (const entry of cases) {
      assert.equal(
        await Bun.file(join(directory, "multi-" + entry.id + ".pfx")).exists(),
        false,
        "Owned fixture output must be new",
      );
      const bags = new BigUint64Array(1);
      const safes = new BigUint64Array(1);
      let pfx = 0;
      try {
        for (const [index, name] of entry.keys.entries()) {
          const input = Buffer.from(
            await Bun.file(join(directory, name + ".key")).arrayBuffer(),
          );
          const bio = api.BIO_new_mem_buf(ptr(input), input.length);
          assert.ok(bio);
          const key = api.PEM_read_bio_PrivateKey(bio, null, null, null);
          api.BIO_free(bio);
          assert.ok(key);
          try {
            const keyPass =
              (entry.wrongLaterPassword && index === 1) ||
              (entry.wrongFirstPassword && index === 0)
                ? text(password + "-other")
                : pass;
            const bag = api.PKCS12_add_key(
              ptr(bags),
              key,
              0,
              2048,
              entry.unencrypted ? -1 : cipher,
              ptr(keyPass),
            );
            assert.ok(bag);
            if (entry.attributes) {
              // Reverse alphabetic aliases and deliberately contradictory IDs.
              const alias = text(index === 0 ? "z-first" : "a-second");
              assert.equal(
                api.PKCS12_add_friendlyname_utf8(bag, ptr(alias), -1),
                1,
              );
              const id = Buffer.from([index + 1]);
              assert.equal(
                api.PKCS12_add_localkeyid(bag, ptr(id), id.length),
                1,
              );
            }
          } finally {
            api.EVP_PKEY_free(key);
          }
          if (entry.splitSafes && index === 0) {
            assert.equal(
              api.PKCS12_add_safe(
                ptr(safes),
                pointer(bags),
                -1,
                2048,
                ptr(pass),
              ),
              1,
            );
            freeStack(pointer(bags), api.PKCS12_SAFEBAG_free);
            bags[0] = 0n;
          }
        }
        for (const [index, name] of entry.certs.entries()) {
          const input = Buffer.from(
            await Bun.file(join(directory, name + ".pem")).arrayBuffer(),
          );
          const bio = api.BIO_new_mem_buf(ptr(input), input.length);
          assert.ok(bio);
          const cert = api.PEM_read_bio_X509(bio, null, null, null);
          api.BIO_free(bio);
          assert.ok(cert);
          try {
            const bag = api.PKCS12_add_cert(ptr(bags), cert);
            assert.ok(bag);
            if (entry.attributes && index < 2) {
              const id = Buffer.from([index + 1]);
              assert.equal(
                api.PKCS12_add_localkeyid(bag, ptr(id), id.length),
                1,
              );
            }
          } finally {
            api.X509_free(cert);
          }
        }
        if (entry.nested) {
          // Only the DER wrapper is assembled here. OpenSSL encodes children,
          // independently validates the wrapper, then builds and MACs the PFX.
          const wrap = (
            /** @type {number} */ tag,
            /** @type {Buffer} */ value,
          ) => {
            const length = value.length;
            const size =
              length < 128
                ? Buffer.from([length])
                : length < 256
                  ? Buffer.from([0x81, length])
                  : length < 65536
                    ? Buffer.from([0x82, length >> 8, length & 255])
                    : Buffer.from([
                        0x83,
                        length >> 16,
                        (length >> 8) & 255,
                        length & 255,
                      ]);
            return Buffer.concat([Buffer.from([tag]), size, value]);
          };
          const children = [];
          for (
            let index = 0;
            index < api.OPENSSL_sk_num(pointer(bags));
            index++
          )
            children.push(
              der(
                api.OPENSSL_sk_value(pointer(bags), index),
                api.i2d_PKCS12_SAFEBAG,
              ),
            );
          const bytes = wrap(
            0x30,
            Buffer.concat([
              Buffer.from("060b2a864886f70d010c0a0106", "hex"),
              wrap(0xa0, wrap(0x30, Buffer.concat(children))),
            ]),
          );
          const cursor = new BigUint64Array([BigInt(ptr(bytes))]);
          const nested = api.d2i_PKCS12_SAFEBAG(
            null,
            ptr(cursor),
            bytes.length,
          );
          assert.ok(nested);
          freeStack(pointer(bags), api.PKCS12_SAFEBAG_free);
          bags[0] = BigInt(api.OPENSSL_sk_new_null());
          assert.ok(pointer(bags));
          assert.equal(api.OPENSSL_sk_push(pointer(bags), nested), 1);
        }
        assert.equal(
          api.PKCS12_add_safe(ptr(safes), pointer(bags), -1, 2048, ptr(pass)),
          1,
        );
        pfx = api.PKCS12_add_safes(pointer(safes), type);
        assert.ok(pfx);
        assert.equal(
          api.PKCS12_set_mac(
            pfx,
            ptr(pass),
            -1,
            null,
            0,
            2048,
            api.EVP_sha256(),
          ),
          1,
        );
        const path = join(directory, "multi-" + entry.id + ".pfx");
        await Bun.write(path, der(pfx, api.i2d_PKCS12));
        const key = new BigUint64Array(1);
        const leaf = new BigUint64Array(1);
        const extra = new BigUint64Array(1);
        try {
          const parsed = api.PKCS12_parse(
            pfx,
            ptr(pass),
            ptr(key),
            ptr(leaf),
            ptr(extra),
          );
          assert.equal(parsed, entry.wrongFirstPassword ? 0 : 1);
          if (parsed) assert.ok(pointer(key));
          const fingerprint = pointer(leaf)
            ? new X509Certificate(der(pointer(leaf), api.i2d_X509))
                .fingerprint256
            : null;
          const expected = new X509Certificate(
            await Bun.file(join(directory, entry.keys[0] + ".pem")).text(),
          ).fingerprint256;
          assert.equal(fingerprint, entry.preTcp ? null : expected);
          result.push({
            ...entry,
            opensslVersion: String(api.OpenSSL_version(0)),
            baselineParseCode: parsed,
            path,
            password,
            baselineFingerprint: fingerprint,
            expectedFingerprint: expected,
          });
        } finally {
          if (pointer(key)) api.EVP_PKEY_free(pointer(key));
          if (pointer(leaf)) api.X509_free(pointer(leaf));
          freeStack(pointer(extra), api.X509_free);
        }
      } finally {
        if (pfx) api.PKCS12_free(pfx);
        freeStack(pointer(bags), api.PKCS12_SAFEBAG_free);
        freeStack(pointer(safes), api.PKCS7_free);
      }
    }
    await Bun.write(
      join(directory, "multi-pfx-baseline.json"),
      JSON.stringify(
        result.map(({ password, ...entry }) => entry),
        null,
        2,
      ),
    );
    return result;
  } finally {
    library.close();
  }
}
