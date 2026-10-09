import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";

/** Independently recompute signatures from captured HTTP fields and raw body.
 * @param {Record<string,any>} wire @param {string} base @param {string} kind */
export function assertSerializedSignature(wire, base, kind) {
  const fields = Object.fromEntries(
    [...wire.authorization.matchAll(/([\w]+)="([^"]*)"/g)].map((m) => [
      m[1],
      kind === "oauth1" ? decodeURIComponent(m[2]) : m[2],
    ]),
  );
  const url = new URL(base);
  if (kind === "hawk") {
    const mime = (wire.type || "").split(";", 1)[0].trim().toLowerCase();
    const hash = createHash("sha256")
      .update("hawk.1.payload\n" + mime + "\n" + wire.body + "\n")
      .digest("base64");
    assert.equal(fields.hash, hash);
    const normalized = [
      "hawk.1.header",
      fields.ts,
      fields.nonce,
      wire.method,
      wire.target,
      url.hostname,
      url.port || "80",
      hash,
      "",
      "",
    ].join("\n");
    assert.equal(
      fields.mac,
      createHmac("sha256", "owned-signing-key")
        .update(normalized)
        .digest("base64"),
    );
    return;
  }
  const encode = (/** @type {string} */ s) =>
    encodeURIComponent(s).replace(
      /[!'()*]/g,
      (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
    );
  const queryIndex = wire.target.indexOf("?");
  const path = queryIndex < 0 ? wire.target : wire.target.slice(0, queryIndex);
  const pairs = [
    ...new URLSearchParams(
      queryIndex < 0 ? "" : wire.target.slice(queryIndex + 1),
    ),
  ];
  const form =
    (wire.type || "").split(";", 1)[0].trim().toLowerCase() ===
    "application/x-www-form-urlencoded";
  if (form) {
    pairs.push(...new URLSearchParams(wire.body));
    assert.equal(fields.oauth_body_hash, undefined);
  } else
    assert.equal(
      fields.oauth_body_hash,
      createHash("sha1").update(wire.body).digest("base64"),
    );
  pairs.push(
    ...Object.entries(fields).filter(
      ([k]) => k !== "oauth_signature" && k !== "realm",
    ),
  );
  const normalized = pairs
    .map(([k, v]) => [encode(k), encode(v)])
    .sort((a, b) =>
      a[0] < b[0]
        ? -1
        : a[0] > b[0]
          ? 1
          : a[1] < b[1]
            ? -1
            : a[1] > b[1]
              ? 1
              : 0,
    )
    .map((p) => p.join("="))
    .join("&");
  const text = [
    wire.method,
    encode(url.origin + path),
    encode(normalized),
  ].join("&");
  assert.equal(
    fields.oauth_signature,
    createHmac("sha1", "owned-consumer-secret&owned-token-secret")
      .update(text)
      .digest("base64"),
  );
}
