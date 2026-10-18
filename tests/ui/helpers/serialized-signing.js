import assert from "node:assert/strict";
import { createHash, createHmac, verify, constants } from "node:crypto";

/** Independently recompute signatures from captured HTTP fields and raw body.
 * @param {Record<string,any>} wire @param {string} base @param {string} kind @param {string} [publicKey] */
export function assertSerializedSignature(wire, base, kind, publicKey) {
  if(kind==='asap'){
    assert.ok(publicKey);
    assert.match(wire.authorization,/^Bearer /);
    const [header,payload,signature]=wire.authorization.slice(7).split('.');
    const metadata=JSON.parse(Buffer.from(header,'base64url').toString()),text=Buffer.from(payload,'base64url').toString();
    const claims=JSON.parse(text),bytes=Buffer.from(signature,'base64url'),input=Buffer.from(header+'.'+payload);
    const hash='sha'+metadata.alg.slice(2);
    assert.match(text,/"large":9007199254740993(?:,|})/,'Large integer claim must not be rounded');
    assert.equal(claims.iss,'owned-asap-issuer');assert.equal(claims.sub,'owned-asap-issuer');
    assert.deepEqual(claims.aud,['owned-audience','second']);
    assert.equal(verify(hash,input,metadata.alg.startsWith('ES')?{key:publicKey,dsaEncoding:'ieee-p1363'}:metadata.alg.startsWith('PS')?{key:publicKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:constants.RSA_PSS_SALTLEN_DIGEST}:publicKey,bytes),true);
    if(metadata.alg==='ES512')assert.equal(bytes.length,132,'JWS P-521 signature uses fixed R||S bytes');
    assert.equal(wire.url,base);
    return;
  }
  if(kind==='aws'){
    // Same independent SigV4 reconstruction as url-encoding.js, now including
    // actual payload bytes and query signatures instead of only empty bodies.
    const url=new URL(wire.url),querySigning=url.searchParams.has('X-Amz-Signature');
    const match=(wire.authorization??'').match(/^AWS4-HMAC-SHA256 Credential=([^,]+), SignedHeaders=([^,]+), Signature=([\da-f]+)$/);
    if(!querySigning)assert.ok(match);
    const credential=querySigning?url.searchParams.get('X-Amz-Credential'):match?.[1];
    const [access,date,region,service,terminator]=String(credential).split('/');
    assert.equal(access,'OWNEDAWSKEY');assert.equal(region,'us-east-1');assert.equal(terminator,'aws4_request');
    const headers=new Map(wire.headers);
    const timestamp=querySigning?url.searchParams.get('X-Amz-Date'):headers.get('x-amz-date');
    assert.equal(String(timestamp).slice(0,8),date);
    assert.equal(querySigning?url.searchParams.get('X-Amz-Security-Token'):headers.get('x-amz-security-token'),'owned-session-token');
    const names=String(querySigning?url.searchParams.get('X-Amz-SignedHeaders'):match?.[2]).split(';');
    assert.deepEqual(names,[...names].sort());assert.ok(names.includes('host'));assert.ok(!names.includes('content-length'));
    const encode=(/** @type {string} */value)=>encodeURIComponent(value).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
    const query=[...url.searchParams].filter(([name])=>name!=='X-Amz-Signature').map(row=>row.map(encode)).sort((a,b)=>a[0]===b[0]?(a[1]<b[1]?-1:a[1]>b[1]?1:0):a[0]<b[0]?-1:1);
    const payload=querySigning&&service==='s3'?'UNSIGNED-PAYLOAD':createHash('sha256').update(Buffer.from(wire.bodyBase64,'base64')).digest('hex');
    if(!querySigning&&service==='s3')assert.equal(headers.get('x-amz-content-sha256'),payload);
    const path=service==='s3'?url.pathname:url.pathname.split('/').map(encode).join('/');
    const canonical=[wire.method,path,query.map(row=>row.join('=')).join('&'),names.map(name=>name+':'+String(headers.get(name)).trim().replace(/ +/g,' ')+'\n').join(''),names.join(';'),payload].join('\n');
    let key=createHmac('sha256','AWS4owned-aws-secret').update(date).digest();
    for(const value of [region,service,terminator])key=createHmac('sha256',key).update(value).digest();
    const scope=[date,region,service,terminator].join('/');
    const expected=createHmac('sha256',key).update(['AWS4-HMAC-SHA256',timestamp,scope,createHash('sha256').update(canonical).digest('hex')].join('\n')).digest('hex');
    assert.equal(querySigning?url.searchParams.get('X-Amz-Signature'):match?.[3],expected);
    assert.equal(url.href.startsWith(base+(querySigning?'&':'')),true);
    return;
  }
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
