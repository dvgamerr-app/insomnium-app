import assert from "node:assert/strict";
import { connect } from "node:http2";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { clientCertificateFixture } from "./helpers/client-certificate.js";
import { tlsPreferences } from "./helpers/tls-preferences.js";
import { grpcStreamCertificate } from "./helpers/grpc-stream-certificate.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const message = "owned mutual TLS gRPC response";
await withNativeApp(
  "grpc-client-certificate",
  async ({ page, invoke, output }) => {
    const fixture = await clientCertificateFixture(output, { grpc: true });
    const original = (await invoke("load_workspace")).settings;
    const setTls = tlsPreferences(page, invoke);
    const cases = /** @type {Array<Record<string,any>>} */ ([]);
    try {
      await fixture.verifyFixture();
      const session = connect(fixture.grpc.url, {
        ca: fixture.ca,
        cert: fixture.client.certificate,
        key: fixture.client.key,
        rejectUnauthorized: true,
      });
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error("gRPC fixture self-check timeout")),
            5000,
          );
          session.once("error", reject);
          const request = session.request({
            ":method": "POST",
            ":path": "/owned.Sample/Echo",
            "content-type": "application/grpc",
            te: "trailers",
          });
          const chunks = /** @type {Buffer[]} */ ([]);
          let status = "";
          request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          request.on("trailers", (headers) => {
            status = String(headers["grpc-status"]);
          });
          request.once("error", reject);
          request.once("end", () => {
            clearTimeout(timer);
            try {
              assert.equal(status, "0");
              const bytes = Buffer.concat(chunks);
              assert.equal(bytes[0], 0);
              assert.equal(bytes.readUInt32BE(1), bytes.length - 5);
              assert.equal(bytes[5], 10);
              assert.equal(bytes[6], Buffer.byteLength(message));
              assert.equal(bytes.subarray(7).toString(), message);
              resolve(null);
            } catch (error) {
              reject(error);
            }
          });
          request.end(Buffer.from([0, 0, 0, 0, 0]));
        });
      } finally {
        session.destroy();
      }
      await poll(
        async () => fixture.grpcRequests.length === 1,
        "independent authenticated HTTP/2 fixture",
      );
      assert.equal(
        fixture.grpcRequests[0].fingerprint,
        fixture.client.fingerprint,
      );
      assert.equal(fixture.grpcRequests[0].cn, fixture.clientName);
      assert.equal(fixture.grpcRequests[0].alpn, "h2");
      const independent = structuredClone(fixture.grpcRequests[0]);
      fixture.grpcRequests.length = 0;
      fixture.grpcConnections.count = 0;
      await gitCollection({ page, invoke });
      await page.locator(".new-request-menu summary").click();
      await page
        .getByRole("button", { name: "gRPC Request", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "gRPC server URL", exact: true })
        .fill(fixture.grpc.url.replace("https:", "grpcs:"));
      await page.getByRole("tab", { name: "Proto Files", exact: true }).click();
      await page.getByLabel("Import files", { exact: true }).setInputFiles({
        name: "owned-mtls.proto",
        mimeType: "text/plain",
        buffer: Buffer.from(
          'syntax = "proto3"; package owned; message Input { string name = 1; } service Sample { rpc Echo (Input) returns (Input); rpc Watch (Input) returns (stream Input); rpc Collect (stream Input) returns (Input); rpc Chat (stream Input) returns (stream Input); rpc Hold (Input) returns (stream Input); }',
        ),
      });
      await page
        .getByRole("button", { name: "Import 1 files", exact: true })
        .click();
      await page
        .getByRole("button", { name: "owned-mtls.proto", exact: true })
        .waitFor();
      const requestId = (await invoke("load_workspace")).activeRequestId;
      for (const [id, ca, host, identity, success] of [
        ["missing-identity", fixture.ca, "127.0.0.1", "", false],
        [
          "trusted-client",
          fixture.ca,
          "127.0.0.1",
          fixture.client.identity,
          true,
        ],
        [
          "ca-bundle-required-root-second",
          fixture.otherCa + fixture.ca,
          "127.0.0.1",
          fixture.client.identity,
          true,
        ],
        [
          "ca-bundle-required-root-first",
          fixture.ca + fixture.otherCa,
          "127.0.0.1",
          fixture.client.identity,
          true,
        ],
        [
          "host-mismatch",
          fixture.ca,
          "other.invalid",
          fixture.client.identity,
          false,
        ],
        [
          "untrusted-client",
          fixture.ca,
          "127.0.0.1",
          fixture.wrongClient.identity,
          false,
        ],
        [
          "untrusted-server",
          fixture.otherCa,
          "127.0.0.1",
          fixture.client.identity,
          false,
        ],
        [
          "malformed-ca",
          "-----BEGIN CERTIFICATE-----\n%%%\n-----END CERTIFICATE-----",
          "127.0.0.1",
          fixture.client.identity,
          false,
        ],
        [
          "malformed-identity",
          fixture.ca,
          "127.0.0.1",
          "invalid client identity",
          false,
        ],
        [
          "recovered-client",
          fixture.ca,
          "127.0.0.1",
          fixture.client.identity,
          true,
        ],
      ]) {
        await setTls(String(ca), String(host), String(identity));
        await page.reload();
        await page
          .getByRole("button", { name: "Load methods", exact: true })
          .click();
        await page
          .getByRole("combobox", { name: "gRPC method", exact: true })
          .selectOption({ label: "/Sample/Echo · Unary" });
        await page.getByRole("tab", { name: "Body", exact: true }).click();
        await page
          .locator(".CodeMirror")
          .first()
          .evaluate((el) => {
            /** @type {any} */ (el).CodeMirror.setValue(
              '{"name":"owned request"}',
            );
          });
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ r) => r._id === requestId,
            )?.body?.text === '{"name":"owned request"}',
          "gRPC body persisted",
        );
        const before = await invoke("load_workspace");
        const count = fixture.grpcRequests.length;
        const connections = fixture.grpcConnections.count;
        const rejected = fixture.rejected.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ row) =>
                row.requestId === requestId &&
                !before.history.some(
                  (/** @type {any} */ old) => old._id === row._id,
                ) &&
                ["closed", "error"].includes(row.connectionState),
            ),
          "gRPC TLS call settled " + id,
        );
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
        const after = await invoke("load_workspace");
        assert.deepEqual(after.resources, before.resources);
        const fresh = after.history.filter(
          (/** @type {any} */ row) =>
            !before.history.some(
              (/** @type {any} */ old) => old._id === row._id,
            ),
        );
        assert.equal(fresh.length, 1);
        const response = fresh[0];
        assert.equal(response.protocol, "grpc");
        for (const old of after.history.filter(
          (/** @type {any} */ row) => row._id !== response._id,
        ))
          assert.deepEqual(
            old,
            before.history.find(
              (/** @type {any} */ row) => row._id === old._id,
            ),
          );
        const reached = fixture.grpcRequests.slice(count);
        const received = response.events.filter(
          (/** @type {any} */ event) => event.kind === "message",
        );
        if (success) {
          assert.equal(response.connectionState, "closed");
          assert.equal(response.status, 0);
          assert.equal(reached.length, 1);
          assert.equal(reached[0].cn, fixture.clientName);
          assert.equal(reached[0].fingerprint, fixture.client.fingerprint);
          assert.equal(reached[0].authorized, true);
          assert.equal(reached[0].alpn, "h2");
          assert.equal(reached[0].method, "POST");
          assert.equal(reached[0].url, "/owned.Sample/Echo");
          const text = Buffer.from("owned request");
          assert.deepEqual(reached[0].bodyBytes, [
            ...Buffer.concat([
              Buffer.from([0, 0, 0, 0, text.length + 2, 10, text.length]),
              text,
            ]),
          ]);
          assert.equal(received.length, 1);
          assert.deepEqual(JSON.parse(received[0].text), { name: message });
          assert.ok(
            response.headers.some(
              (/** @type {any} */ row) =>
                row[0] === "owned-metadata" && row[1] === "authenticated",
            ),
          );
          assert.ok(
            response.trailers.some(
              (/** @type {any} */ row) =>
                row[0] === "owned-trailer" && row[1] === "complete",
            ),
          );
          await page
            .locator(".grpc-message")
            .filter({ hasText: message })
            .waitFor();
        } else {
          assert.equal(reached.length, 0);
          assert.equal(received.length, 0);
          assert.ok(
            response.connectionState === "error" ||
              (response.status != null && response.status !== 0),
            "TLS refusal must retain error or nonzero gRPC status",
          );
          assert.ok(
            response.events.some(
              (/** @type {any} */ e) =>
                e.kind === "error" || (e.kind === "status" && e.code !== 0),
            ),
          );
        }
        if (["malformed-ca", "malformed-identity"].includes(String(id)))
          assert.equal(
            fixture.grpcConnections.count,
            connections,
            "Malformed PEM refuses before TCP",
          );
        if (["missing-identity", "host-mismatch"].includes(String(id)))
          assert.ok(
            fixture.rejected
              .slice(rejected)
              .some((event) => /peer sent no certificates/i.test(event.detail)),
          );
        assert.ok(!JSON.stringify(response).includes("BEGIN PRIVATE KEY"));
        assert.equal(fixture.sinkRequests.length, 0);
        assert.equal(fixture.connections.sink, 0);
        await page.screenshot({ path: join(output, String(id) + ".png") });
        cases.push({
          id,
          success,
          response,
          requests: reached,
          connections: fixture.grpcConnections.count - connections,
          rejections: fixture.rejected.slice(rejected),
        });
      }
      const saved = (await invoke("load_workspace")).history.find(
        (/** @type {any} */ r) => r.requestId === requestId,
      );
      const count = fixture.grpcRequests.length;
      await page.reload();
      await page
        .locator(".grpc-message")
        .filter({ hasText: message })
        .waitFor();
      assert.deepEqual(
        (await invoke("load_workspace")).history.find(
          (/** @type {any} */ r) => r._id === saved._id,
        ),
        saved,
      );
      assert.equal(
        fixture.grpcRequests.length,
        count,
        "Reload does not send another RPC",
      );
      const streaming = await grpcStreamCertificate(
        { page, invoke, output },
        fixture,
        requestId,
      );
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            checks: [
              "independent mandatory-mTLS HTTP2 check",
              ...cases.map((c) => c.id),
              "full response reload without resend",
              ...streaming.map((c) => c.id),
            ],
            independent,
            cases,
            streaming,
            limits:
              "Actual Windows native unary/server/client/bidirectional gRPC through persisted Preferences and Send/Connect, HTTP2 ALPN, server-observed peer fingerprint and exact protobuf bytes. Explicit Commit EOF, all three Cancel shapes produce actual RST_STREAM CANCEL, saved response/reconnect observed. No trust-store modification/TLS bypass. Reflection TLS, provider/proxy/legacy/platform remain separate gates.",
          },
          null,
          2,
        ),
      );
    } finally {
      try {
        await Bun.write(
          join(output, "partial-cases.json"),
          JSON.stringify(cases, null, 2),
        );
        await setTls(
          original.caPem || "",
          original.identityHost || "",
          original.identityPem || "",
          original.validateCertificates,
        );
        const restored = (await invoke("load_workspace")).settings;
        const keys = [
          "caPem",
          "identityHost",
          "identityPem",
          "validateCertificates",
        ];
        for (const key of keys)
          assert.equal(restored[key], original[key], "Restore " + key);
        await Bun.write(
          join(output, "settings-restored.json"),
          JSON.stringify({ restored: true, keys }),
        );
      } finally {
        await fixture.close();
      }
    }
  },
);
