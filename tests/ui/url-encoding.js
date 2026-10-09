import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { createServer } from "node:net";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-url-encoding-ui-probe/build-state.json";
/** @type {string[]} */ const received = [];
/** @type {string[][]} */ const wireHeaders = [];
/** @type {string[]} */ const wireBodies = [];
const server = createServer((socket) => {
  let buffered = Buffer.alloc(0);
  let recorded = false;
  socket.on("data", (chunk) => {
    if (recorded) return;
    buffered = Buffer.concat([
      buffered,
      typeof chunk === "string" ? Buffer.from(chunk) : chunk,
    ]);
    const headerEnd = buffered.indexOf("\r\n\r\n");
    if (headerEnd >= 0) {
      const lines = buffered
        .subarray(0, headerEnd)
        .toString("latin1")
        .split("\r\n");
      const length = Number(
        lines
          .find((line) => /^content-length:/i.test(line))
          ?.split(":")[1]
          ?.trim() || 0,
      );
      if (buffered.length < headerEnd + 4 + length) return;
      recorded = true;
      received.push(
        buffered.subarray(0, buffered.indexOf("\r\n")).toString("latin1"),
      );
      wireHeaders.push(lines.slice(1));
      wireBodies.push(
        buffered
          .subarray(headerEnd + 4, headerEnd + 4 + length)
          .toString("utf8"),
      );
      socket.end(
        "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK",
      );
    }
  });
});
await new Promise((resolve) =>
  server.listen(0, "127.0.0.1", () => resolve(null)),
);
try {
  await withNativeApp("url-encoding", async ({ page, invoke, output }) => {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url =
      "http://127.0.0.1:" + address.port + "/100%/:id?empty=&x=%2f#fragment";
    const name = "URL encoding " + Date.now();
    /** @type {any[]} */ const resources = [
      {
        _id: "wrk_encoding",
        _type: "workspace",
        parentId: null,
        name,
        scope: "collection",
      },
      {
        _id: "req_encoding",
        _type: "request",
        parentId: "wrk_encoding",
        name,
        method: "GET",
        url,
        headers: [],
        parameters: [
          { name: "q", value: "a b+" },
          { name: "off", value: "ignored", disabled: true },
        ],
        segmentParams: [{ name: "id", value: "a b" }],
        body: { mimeType: "" },
        authentication: {
          type: "apikey",
          addTo: "queryParams",
          key: "key",
          value: "a+b",
        },
      },
    ];
    for (const algorithm of ["sha1", "sha256"])
      for (const bodyMode of ["legacy", "standard"])
        for (const enabled of [true, false])
          resources.push({
            ...resources[1],
            _id: "req_" + algorithm + bodyMode + enabled,
            name: name + " " + algorithm + " " + bodyMode + " " + enabled,
            settingEncodeUrl: enabled,
            authentication: {
              type: "hawk",
              id: "encoding-fixture",
              key: "local-fixture-key",
              algorithm,
              bodyMode,
              nonce: "urlprobe",
              timestamp: "1700000000",
              validatePayload: false,
            },
          });
    for (const signatureMethod of ["HMAC-SHA1", "HMAC-SHA256"])
      for (const bodyMode of ["legacy", "standard"])
        for (const enabled of [true, false])
          resources.push({
            ...resources[1],
            _id: "req_oauth_" + signatureMethod + bodyMode + enabled,
            name:
              name +
              " OAuth " +
              signatureMethod +
              " " +
              bodyMode +
              " " +
              enabled,
            settingEncodeUrl: enabled,
            authentication: {
              type: "oauth1",
              consumerKey: "fixture-consumer",
              consumerSecret: "consumer +&secret",
              tokenKey: "fixture-token",
              tokenSecret: "token /secret",
              signatureMethod,
              bodyMode,
              nonce: "oauthprobe",
              timestamp: "1700000000",
              version: "1.0",
              realm: "excluded-realm",
            },
          });
    for (const service of ["s3", "execute-api"])
      for (const enabled of [true, false])
        resources.push({
          ...resources[1],
          _id: "req_aws_" + service + enabled,
          name: name + " AWS " + service + " " + enabled,
          settingEncodeUrl: enabled,
          authentication: {
            type: "iam",
            accessKeyId: "LOCALFIXTURE",
            secretAccessKey: "local-aws-secret",
            sessionToken: "local-session-token",
            region: "us-east-1",
            service,
          },
        });
    for (const source of resources
      .slice(2)
      .filter(
        (r) =>
          (r.authentication.type === "hawk" &&
            r.authentication.algorithm === "sha256" &&
            r.authentication.bodyMode === "standard") ||
          (r.authentication.type === "oauth1" &&
            r.authentication.signatureMethod === "HMAC-SHA256" &&
            r.authentication.bodyMode === "standard") ||
          (r.authentication.type === "iam" &&
            r.authentication.service === "execute-api"),
      ))
      resources.push({
        ...source,
        _id: source._id + "_reserved",
        name: source.name + " reserved query",
        parameters: [
          ...source.parameters,
          {
            name: "color",
            value: ":/?[]#@!$&'()*+,;=%2f%GG",
            _openapiSerialization: {
              style: "form",
              explode: true,
              kind: "scalar",
              allowReserved: true,
            },
          },
        ],
      });
    assert.equal(
      resources.length,
      28,
      "Original20 and reserved6 signing cases",
    );
    for (const source of resources
      .slice(2)
      .filter(
        (r) =>
          r.authentication.type === "oauth1" &&
          r.settingEncodeUrl === true &&
          !r._id.endsWith("_reserved"),
      ))
      resources.push({
        ...source,
        _id: source._id + "_form",
        name: source.name + " form style body",
        method: "POST",
        body: {
          mimeType: "application/x-www-form-urlencoded",
          params: [
            {
              name: "color",
              value: '["a +","b&="]',
              _openapiSerialization: {
                formBody: true,
                style: "form",
                explode: true,
                kind: "array",
              },
            },
            { name: "color", value: "manual +" },
          ],
        },
      });
    assert.equal(
      resources.length,
      32,
      "Four form-body OAuth1 signing regressions",
    );
    for (const source of resources.filter((r) => r._id.endsWith("_form")))
      resources.push({
        ...source,
        _id: source._id + "_content",
        name: source.name + " JSON content",
        body: {
          ...source.body,
          params: [
            {
              ...source.body.params[0],
              _openapiSerialization: {
                formBody: true,
                style: "content",
                kind: "array",
                mediaType: "application/json",
                formArrayItems: true,
                itemKind: "scalar-json",
              },
            },
            source.body.params[1],
          ],
        },
      });
    assert.equal(
      resources.length,
      36,
      "Four JSON form-content signing regressions",
    );
    for (const source of resources.filter((r) => r._id.endsWith("_form")))
      resources.push({
        ...source,
        _id: source._id + "_items",
        name: source.name + " 3.2 array items",
        body: {
          ...source.body,
          params: [
            {
              ...source.body.params[0],
              _openapiSerialization: {
                ...source.body.params[0]._openapiSerialization,
                explode: false,
                formArrayItems: true,
                itemKind: "scalar-json",
              },
            },
            source.body.params[1],
          ],
        },
      });
    assert.equal(
      resources.length,
      40,
      "Four per-item form signing regressions",
    );
    for (const source of resources.filter((r) =>
      r._id.endsWith("_form_content"),
    ))
      resources.push({
        ...source,
        _id: source._id + "_whole",
        name: source.name + " whole array",
        body: {
          ...source.body,
          params: [
            {
              ...source.body.params[0],
              _openapiSerialization: {
                formBody: true,
                style: "content",
                kind: "array",
                mediaType: "application/json",
              },
            },
            source.body.params[1],
          ],
        },
      });
    assert.equal(
      resources.length,
      44,
      "Four whole JSON-array signing regressions",
    );
    for (const source of resources.filter((r) => r._id.endsWith("_form")))
      resources.push({
        ...source,
        _id: source._id + "_text_content",
        name: source.name + " UTF-8 text content",
        body: {
          ...source.body,
          params: [
            {
              ...source.body.params[0],
              value: '["a +","ไทย/🌙",0,false]',
              _openapiSerialization: {
                formBody: true,
                style: "content",
                kind: "array",
                mediaType: 'Text/Plain; charset="UTF-8"; note="a,b;c"',
                formArrayItems: true,
                itemKind: "json",
              },
            },
            source.body.params[1],
          ],
        },
      });
    assert.equal(
      resources.length,
      48,
      "Four parameterized text form-content signing regressions",
    );
    await page
      .getByRole("button", { name: "Import collection", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Import collection or cURL commands", { exact: true })
      .fill(JSON.stringify({ resources }));
    await dialog
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const select = () =>
      page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GET " + name, exact: true })
        .click();
    await select();
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    const checkbox = page.getByRole("checkbox", {
      name: "Automatically encode URL",
      exact: true,
    });
    assert.equal(await checkbox.isChecked(), true);
    /** @type {any} */ let saved;
    const read = async () => {
      saved = (await invoke("load_workspace")).resources.find(
        /** @param {any} r */ (r) => r._type === "request" && r.name === name,
      );
      return saved;
    };
    for (const enabled of [true, false, true]) {
      await checkbox.setChecked(enabled);
      if (enabled !== true || received.length > 0)
        await poll(
          async () =>
            Boolean(await read()) && saved.settingEncodeUrl === enabled,
          "encoding setting persisted",
        );
      await page.reload();
      await select();
      await page.getByRole("tab", { name: "Settings", exact: true }).click();
      assert.equal(await checkbox.isChecked(), enabled);
      const count = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => received.length === count + 1,
        "raw native request line",
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Send settled",
      );
      assert.equal(
        received[count],
        enabled
          ? "GET /100%25/a%20b?empty&x=%2F&q=a%20b%2B&key=a%2Bb HTTP/1.1"
          : "GET /100%/a%20b?empty=&x=%2f&q=a%20b%2B&key=a%2Bb HTTP/1.1",
      );
      await read();
      assert.equal(saved.url, url);
      assert.deepEqual(saved.segmentParams, resources[1].segmentParams);
    }
    for (const signed of resources.slice(2)) {
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name: signed.method + " " + signed.name,
          exact: true,
        })
        .click();
      await page.reload();
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name: signed.method + " " + signed.name,
          exact: true,
        })
        .click();
      const count = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => received.length === count + 1,
        "Hawk signed request",
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Hawk Send settled",
      );
      const [method, target] = received[count].split(" ");
      assert.equal(
        wireBodies[count],
        signed.body.mimeType === "application/x-www-form-urlencoded"
          ? signed.body.params[0]._openapiSerialization.style === "content"
            ? signed.body.params[0]._openapiSerialization.mediaType ===
              'Text/Plain; charset="UTF-8"; note="a,b;c"'
              ? "color=a+%2B&color=%E0%B9%84%E0%B8%97%E0%B8%A2%2F%F0%9F%8C%99&color=0&color=false&color=manual+%2B"
              : signed.body.params[0]._openapiSerialization.formArrayItems
                ? "color=%22a+%2B%22&color=%22b%26%3D%22&color=manual+%2B"
                : "color=%5B%22a+%2B%22%2C%22b%26%3D%22%5D&color=manual+%2B"
            : "color=a%20%2B&color=b%26%3D&color=manual+%2B"
          : "",
      );
      // Only the first ? starts the query; RFC3986 permits ? inside query data.
      const queryStart = target.indexOf("?");
      const wirePath = queryStart < 0 ? target : target.slice(0, queryStart);
      const wireQuery = queryStart < 0 ? "" : target.slice(queryStart + 1);
      await Bun.write(
        output + "/wire-signature-progress.json",
        JSON.stringify(
          {
            name: signed.name,
            received,
            wireHeaders,
            limits:
              "Owned local fixture credentials only; partial evidence, not scenario acceptance.",
          },
          null,
          2,
        ),
      );
      assert.equal(
        target,
        (signed.settingEncodeUrl
          ? "/100%25/a%20b?empty&x=%2F&q=a%20b%2B"
          : "/100%/a%20b?empty=&x=%2f&q=a%20b%2B") +
          (signed.parameters.some(
            (/** @type {any} */ p) => p._openapiSerialization?.allowReserved,
          )
            ? "&color=:/?%5B%5D%23@!$&%27()*+,;=%2f%25GG"
            : ""),
      );
      const header = wireHeaders[count].find((line) =>
        /^authorization:/i.test(line),
      );
      assert.ok(header, "Signed Authorization on wire");
      if (signed.authentication.type === "iam") {
        const match = header.match(
          /AWS4-HMAC-SHA256 Credential=([^,]+), SignedHeaders=([^,]+), Signature=([0-9a-f]+)/,
        );
        assert.ok(match, "AWS Authorization structure");
        const headers = new Map(
          wireHeaders[count]
            .filter((line) => line.includes(":"))
            .map((line) => {
              const i = line.indexOf(":");
              return [
                line.slice(0, i).toLowerCase(),
                line
                  .slice(i + 1)
                  .trim()
                  .replace(/\s+/g, " "),
              ];
            }),
        );
        assert.equal(headers.get("host"), "127.0.0.1:" + address.port);
        assert.equal(
          headers.get("x-amz-security-token"),
          "local-session-token",
        );
        const [access, date, region, service, terminator] = match[1].split("/");
        assert.equal(access, "LOCALFIXTURE");
        assert.equal(region, "us-east-1");
        assert.equal(service, signed.authentication.service);
        assert.equal(terminator, "aws4_request");
        const timestamp = headers.get("x-amz-date");
        assert.ok(timestamp);
        assert.equal(timestamp.slice(0, 8), date);
        const encode = (/** @type {string} */ v) =>
          encodeURIComponent(v).replace(
            /[!'()*]/g,
            (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
          );
        const query = [...new URLSearchParams(wireQuery)].map(([k, v]) => [
          encode(k),
          encode(v),
        ]);
        query.sort((a, b) =>
          a[0] < b[0]
            ? -1
            : a[0] > b[0]
              ? 1
              : a[1] < b[1]
                ? -1
                : a[1] > b[1]
                  ? 1
                  : 0,
        );
        const path = wirePath;
        const canonicalPath =
          service === "s3" ? path : path.split("/").map(encode).join("/");
        const signedHeaders = match[2].split(";");
        assert.deepEqual(signedHeaders, [...signedHeaders].sort());
        assert.ok(
          signedHeaders.includes("host") &&
            signedHeaders.includes("x-amz-date") &&
            signedHeaders.includes("x-amz-security-token"),
        );
        const canonicalHeaders = signedHeaders
          .map((k) => {
            assert.ok(headers.has(k));
            return k + ":" + headers.get(k) + "\n";
          })
          .join("");
        const hash = (/** @type {string} */ v) =>
          createHash("sha256").update(v).digest("hex");
        const payloadHash = hash("");
        if (service === "s3")
          assert.equal(headers.get("x-amz-content-sha256"), payloadHash);
        const canonical = [
          method,
          canonicalPath,
          query.map((pair) => pair.join("=")).join("&"),
          canonicalHeaders,
          match[2],
          payloadHash,
        ].join("\n");
        const scope = [date, region, service, terminator].join("/");
        let signingKey = createHmac("sha256", "AWS4local-aws-secret")
          .update(date)
          .digest();
        for (const value of [region, service, terminator])
          signingKey = createHmac("sha256", signingKey).update(value).digest();
        const toSign = [
          "AWS4-HMAC-SHA256",
          timestamp,
          scope,
          hash(canonical),
        ].join("\n");
        assert.equal(
          match[3],
          createHmac("sha256", signingKey).update(toSign).digest("hex"),
          "Independent SigV4 from exact wire request",
        );
        continue;
      }
      if (signed.authentication.type === "oauth1") {
        assert.match(header, /^authorization: OAuth /i);
        const oauth = Object.fromEntries(
          [...header.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [
            m[1],
            decodeURIComponent(m[2]),
          ]),
        );
        assert.equal(oauth.oauth_consumer_key, "fixture-consumer");
        assert.equal(oauth.oauth_token, "fixture-token");
        assert.equal(oauth.oauth_nonce, "oauthprobe");
        assert.equal(oauth.oauth_timestamp, "1700000000");
        assert.equal(
          oauth.oauth_signature_method,
          signed.authentication.signatureMethod,
        );
        assert.equal(oauth.realm, "excluded-realm");
        const encode = (/** @type {string} */ v) =>
          encodeURIComponent(v).replace(
            /[!'()*]/g,
            (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
          );
        const params = [
          ...new URLSearchParams(wireQuery).entries(),
          ...(signed.authentication.bodyMode === "standard" &&
          signed.body.mimeType === "application/x-www-form-urlencoded"
            ? new URLSearchParams(wireBodies[count]).entries()
            : []),
          ...Object.entries(oauth).filter(
            ([k]) => k !== "realm" && k !== "oauth_signature",
          ),
        ];
        const pairs = params.map(([k, v]) => [encode(k), encode(v)]);
        pairs.sort((a, b) =>
          a[0] < b[0]
            ? -1
            : a[0] > b[0]
              ? 1
              : a[1] < b[1]
                ? -1
                : a[1] > b[1]
                  ? 1
                  : 0,
        );
        const normalized = pairs.map((pair) => pair.join("=")).join("&");
        const base = [
          method,
          "http://127.0.0.1:" + address.port + wirePath,
          normalized,
        ]
          .map(encode)
          .join("&");
        const key = encode("consumer +&secret") + "&" + encode("token /secret");
        const algorithm =
          signed.authentication.signatureMethod === "HMAC-SHA1"
            ? "sha1"
            : "sha256";
        const expected = createHmac(algorithm, key)
          .update(base)
          .digest("base64");
        assert.equal(
          oauth.oauth_signature,
          expected,
          "Independent OAuth1 signature from wire URL/query/header",
        );
        assert.notEqual(
          oauth.oauth_signature,
          createHmac(algorithm, key)
            .update(base + "changed")
            .digest("base64"),
        );
        continue;
      }
      assert.match(header, /^authorization: Hawk /i);
      const fields = Object.fromEntries(
        [...header.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
      );
      assert.equal(fields.id, "encoding-fixture");
      assert.equal(fields.ts, "1700000000");
      assert.equal(fields.nonce, "urlprobe");
      const host = wireHeaders[count].find((line) => /^host:/i.test(line));
      assert.equal(
        host?.split(": ").slice(1).join(": "),
        "127.0.0.1:" + address.port,
      );
      const normalized = [
        "hawk.1.header",
        fields.ts,
        fields.nonce,
        method,
        target,
        "127.0.0.1",
        String(address.port),
        "",
        "",
        "",
      ].join("\n");
      const expected = createHmac(
        signed.authentication.algorithm,
        "local-fixture-key",
      )
        .update(normalized)
        .digest("base64");
      assert.equal(
        fields.mac,
        expected,
        "Independent MAC from exact raw TCP target",
      );
      assert.notEqual(
        fields.mac,
        createHmac(signed.authentication.algorithm, "local-fixture-key")
          .update(normalized.replace(target, target + "&tampered=1"))
          .digest("base64"),
      );
    }
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "Default legacy encoding",
            "Toggle off/on persists across reload",
            "Raw TCP request target includes segment/query/API-key exactly once",
            "Send leaves saved source URL unchanged",
            "Independent Hawk SHA1/SHA256 MAC from raw TCP URL in legacy/standard modes with encoding on/off; modified target produces a different MAC",
          ],
          received,
          signatureCases: resources.slice(2).map((r) => ({
            type: r.authentication.type,
            method:
              r.authentication.signatureMethod ||
              r.authentication.algorithm ||
              r.authentication.service,
            mode: r.authentication.bodyMode,
            encoding: r.settingEncodeUrl,
            reservedQuery: r.parameters.some(
              (/** @type {any} */ p) =>
                p._openapiSerialization?.allowReserved === true,
            ),
            formStyleBody:
              r.body.mimeType === "application/x-www-form-urlencoded" &&
              r.body.params[0]._openapiSerialization.style !== "content",
            formContentBody:
              r.body.mimeType === "application/x-www-form-urlencoded" &&
              r.body.params[0]._openapiSerialization.style === "content",
            formStyleItemBody:
              r.body.mimeType === "application/x-www-form-urlencoded" &&
              r.body.params[0]._openapiSerialization.style !== "content" &&
              r.body.params[0]._openapiSerialization.formArrayItems === true,
            formWholeContentBody:
              r.body.mimeType === "application/x-www-form-urlencoded" &&
              r.body.params[0]._openapiSerialization.style === "content" &&
              !r.body.params[0]._openapiSerialization.formArrayItems,
            formTextContentBody:
              r.body.mimeType === "application/x-www-form-urlencoded" &&
              r.body.params[0]._openapiSerialization.mediaType ===
                'Text/Plain; charset="UTF-8"; note="a,b;c"',
          })),
        },
        null,
        2,
      ),
    );
  });
} finally {
  await new Promise((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve(null))),
  );
}
