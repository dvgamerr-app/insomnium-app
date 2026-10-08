import assert from "node:assert/strict";
import { join } from "node:path";
import { poll } from "./native-app.js";
import { tlsPreferences } from "./tls-preferences.js";
import {
  certificateSettings,
  protocolCertificateCases,
} from "./certificate-settings.js";

/** @param {Pick<import('./native-app.js').ScenarioContext, 'page'|'invoke'|'output'>} context
 * @param {Awaited<ReturnType<typeof import('./client-certificate.js').clientCertificateFixture>>} fixture
 * @param {string} requestId */
export async function grpcReflectionCertificate(
  { page, invoke, output },
  fixture,
  requestId,
) {
  const setTls = tlsPreferences(page, invoke);
  const cases = /** @type {Array<Record<string,any>>} */ ([]);
  const fileCases = protocolCertificateCases(fixture);
  try {
    for (const [id, ca, host, identity, success, alpha] of [
      [
        "reflection-missing-identity",
        fixture.ca,
        "127.0.0.1",
        "",
        false,
        false,
      ],
      [
        "reflection-trusted-client",
        fixture.ca,
        "127.0.0.1",
        fixture.client.identity,
        true,
        false,
      ],
      [
        "reflection-ca-root-second",
        fixture.otherCa + fixture.ca,
        "127.0.0.1",
        fixture.client.identity,
        true,
        false,
      ],
      [
        "reflection-ca-root-first",
        fixture.ca + fixture.otherCa,
        "127.0.0.1",
        fixture.client.identity,
        true,
        false,
      ],
      [
        "reflection-host-mismatch",
        fixture.ca,
        "other.invalid",
        fixture.client.identity,
        false,
        false,
      ],
      [
        "reflection-untrusted-client",
        fixture.ca,
        "127.0.0.1",
        fixture.wrongClient.identity,
        false,
        false,
      ],
      [
        "reflection-untrusted-server",
        fixture.otherCa,
        "127.0.0.1",
        fixture.client.identity,
        false,
        false,
      ],
      [
        "reflection-malformed-ca",
        "-----BEGIN CERTIFICATE-----\n%%%\n-----END CERTIFICATE-----",
        "127.0.0.1",
        fixture.client.identity,
        false,
        false,
      ],
      [
        "reflection-malformed-identity",
        fixture.ca,
        "127.0.0.1",
        "invalid client identity",
        false,
        false,
      ],
      ...fixture.invalidServers.map((server) => [
        "reflection-server-" + server.id,
        fixture.ca,
        "127.0.0.1",
        fixture.client.identity,
        false,
        false,
      ]),
      [
        "reflection-recovered-client",
        fixture.ca,
        "127.0.0.1",
        fixture.client.identity,
        true,
        false,
      ],
      [
        "reflection-v1alpha-fallback",
        fixture.ca,
        "127.0.0.1",
        fixture.client.identity,
        true,
        true,
      ],
      ...fileCases.map((entry) => [
        "reflection-" + entry.id,
        fixture.ca,
        "127.0.0.1",
        entry.preTcp ? fixture.client.identity : "",
        entry.success,
        false,
      ]),
      [
        "reflection-collection-v1alpha",
        fixture.ca,
        "127.0.0.1",
        "",
        true,
        true,
      ],
    ]) {
      const label = String(id);
      const server = fixture.invalidServers.find(
        (server) => label === "reflection-server-" + server.id,
      );
      const url = (
        server
          ? server.grpcUrl
          : alpha
            ? fixture.grpcAlpha.url
            : fixture.grpc.url
      ).replace("https:", "grpcs:");
      await page
        .getByRole("textbox", { name: "gRPC server URL", exact: true })
        .fill(url);
      await page
        .getByRole("combobox", { name: "Proto source", exact: true })
        .selectOption("");
      await poll(async () => {
        const request = (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ r) => r._id === requestId,
        );
        return request.url === url && request.protoFileId === "";
      }, "reflection source persisted");
      await setTls(String(ca), String(host), String(identity));
      const fileCase = fileCases.find(
        (entry) => "reflection-" + entry.id === id,
      );
      if (fileCase) await certificateSettings(page, invoke, fileCase);
      if (id === "reflection-collection-v1alpha")
        await certificateSettings(page, invoke, {
          pfx: fixture.identityFiles.pfx,
          password: fixture.identityFiles.password,
        });
      await page.reload();
      const before = await invoke("load_workspace");
      const requestsBefore = fixture.grpcRequests.length;
      const eventsBefore = fixture.grpcEvents.length;
      const tcpBefore = fixture.grpcConnections.count;
      const rejectionsBefore = fixture.rejected.length;
      await page
        .getByRole("button", { name: "Load methods", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Load methods", exact: true })
        .waitFor();
      const methods = page.getByRole("combobox", {
        name: "gRPC method",
        exact: true,
      });
      if (success) {
        await poll(
          async () => !(await methods.isDisabled()),
          "reflected methods available",
        );
        assert.deepEqual(
          await methods
            .locator("option")
            .evaluateAll((options) =>
              options
                .map((o) => /** @type {HTMLOptionElement} */ (o).value)
                .filter(Boolean),
            ),
          [
            "/owned.Sample/Echo",
            "/owned.Sample/Watch",
            "/owned.Sample/Collect",
            "/owned.Sample/Chat",
            "/owned.Sample/Hold",
          ],
        );
        assert.deepEqual(
          await methods
            .locator('option[value^="/owned.Sample/"]')
            .allTextContents()
            .then((labels) => labels.map((label) => label.trim())),
          [
            "/Sample/Echo · Unary",
            "/Sample/Watch · Server streaming",
            "/Sample/Collect · Client streaming",
            "/Sample/Chat · Bidirectional",
            "/Sample/Hold · Server streaming",
          ],
          "Reflected client/server streaming flags must produce the correct UI method shapes",
        );
      } else {
        await page.locator(".inline-error").first().waitFor();
        assert.equal(
          await methods.isDisabled(),
          true,
          "TLS refusal exposes no usable reflected methods",
        );
      }
      const discovered = await invoke("load_workspace");
      assert.deepEqual(
        discovered.history,
        before.history,
        "Method discovery does not create call history",
      );
      assert.deepEqual(
        discovered.resources,
        before.resources,
        "Discovery preserves every resource before explicit method selection",
      );
      const requests = fixture.grpcRequests.slice(requestsBefore);
      const events = fixture.grpcEvents.slice(eventsBefore);
      const queries = events.filter((e) => e.event === "grpc-reflection");
      if (success) {
        await methods.selectOption({ label: "/Sample/Echo · Unary" });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].fingerprint, fixture.client.fingerprint);
        assert.equal(requests[0].cn, fixture.clientName);
        assert.equal(requests[0].authorized, true);
        assert.equal(requests[0].alpn, "h2");
        assert.equal(
          requests[0].url,
          `/grpc.reflection.${alpha ? "v1alpha" : "v1"}.ServerReflection/ServerReflectionInfo`,
        );
        assert.deepEqual(
          queries.map((q) => [q.kind, q.value]),
          [
            ["list-services", ""],
            ["file-containing-symbol", "owned.Sample"],
          ],
        );
        assert.equal(
          events.filter((e) => e.event === "grpc-reflection-unimplemented")
            .length,
          alpha ? 1 : 0,
        );
        if (alpha) {
          const fallback = events.find(
            (e) => e.event === "grpc-reflection-unimplemented",
          );
          assert.equal(fallback?.fingerprint, fixture.client.fingerprint);
          assert.equal(
            fallback?.url,
            "/grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
          );
        }
        await page
          .getByRole("tablist", { name: "gRPC request editor", exact: true })
          .getByRole("tab", { name: "Body", exact: true })
          .click();
        await page
          .locator(".CodeMirror")
          .first()
          .evaluate((el) => {
            /** @type {any} */ (el).CodeMirror.setValue(
              '{"name":"reflected request"}',
            );
          });
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ r) => r._id === requestId,
            )?.body?.text === '{"name":"reflected request"}',
          "reflected call body persisted",
        );
        const callBefore = await invoke("load_workspace");
        const callCount = fixture.grpcRequests.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ r) =>
                !callBefore.history.some(
                  (/** @type {any} */ old) => old._id === r._id,
                ) &&
                r.status === 0 &&
                r.connectionState === "closed",
            ),
          "Send uses reflected schema",
        );
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
        const after = await invoke("load_workspace");
        assert.deepEqual(after.resources, callBefore.resources);
        const fresh = after.history.filter(
          (/** @type {any} */ r) =>
            !callBefore.history.some(
              (/** @type {any} */ old) => old._id === r._id,
            ),
        );
        assert.equal(fresh.length, 1);
        const response = fresh[0];
        assert.deepEqual(
          response.events
            .filter((/** @type {any} */ e) => e.kind === "message")
            .map((/** @type {any} */ e) => JSON.parse(e.text)),
          [{ name: "owned mutual TLS gRPC response" }],
        );
        const called = fixture.grpcRequests.slice(callCount);
        assert.equal(
          called.length,
          1,
          "Cached reflected schema sends exactly one application RPC",
        );
        assert.equal(called[0].url, "/owned.Sample/Echo");
        assert.equal(called[0].fingerprint, fixture.client.fingerprint);
        const text = Buffer.from("reflected request");
        assert.deepEqual(called[0].bodyBytes, [
          ...Buffer.concat([
            Buffer.from([0, 0, 0, 0, text.length + 2, 10, text.length]),
            text,
          ]),
        ]);
        for (const old of after.history.filter(
          (/** @type {any} */ r) => r._id !== response._id,
        ))
          assert.deepEqual(
            old,
            callBefore.history.find(
              (/** @type {any} */ r) => r._id === old._id,
            ),
          );
        cases.push({ id: label, success, requests, events, called, response });
      } else {
        assert.equal(requests.length, 0);
        assert.equal(queries.length, 0);
        if (server) {
          assert.ok(
            fixture.grpcConnections.count > tcpBefore,
            "Reflection attempts invalid server TLS handshake",
          );
          const alert =
            server.id === "hostname" ? "BadCertificate" : "CertificateExpired";
          await poll(
            async () =>
              fixture.rejected
                .slice(rejectionsBefore)
                .some(
                  (event) =>
                    event.role === "grpc" &&
                    event.detail.includes("received fatal alert: " + alert),
                ),
            "Native reflection certificate alert " + server.id,
          );
        }
        if (label.includes("malformed") || fileCase?.preTcp)
          assert.equal(
            fixture.grpcConnections.count,
            tcpBefore,
            "Malformed reflection TLS refuses before TCP",
          );
        cases.push({
          id: label,
          success,
          requests,
          events,
          serverCertificate: server
            ? fixture.serverCertificates.find(
                (certificate) => certificate.id === server.id,
              )
            : undefined,
        });
      }
      assert.equal(fixture.sinkRequests.length, 0);
      await page.screenshot({ path: join(output, label + ".png") });
    }
    const saved = (await invoke("load_workspace")).history[0];
    const count = fixture.grpcRequests.length;
    await page.reload();
    assert.deepEqual(
      (await invoke("load_workspace")).history.find(
        (/** @type {any} */ r) => r._id === saved._id,
      ),
      saved,
    );
    assert.equal(
      fixture.grpcRequests.length,
      count,
      "Reload neither reflects nor sends automatically",
    );
    return cases;
  } finally {
    await Bun.write(
      join(output, "reflection-cases.json"),
      JSON.stringify(cases, null, 2),
    );
  }
}
