import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { clientCertificateFixture } from "./helpers/client-certificate.js";
import { tlsPreferences } from "./helpers/tls-preferences.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp(
  "http-client-certificate",
  async ({ page, invoke, output }) => {
    const fixture = await clientCertificateFixture(output);
    const original = (await invoke("load_workspace")).settings;
    const name = "Client certificate " + Date.now();
    const payload = "owned native mutual TLS payload " + crypto.randomUUID();
    const checks = [];
    /** @type {Array<Record<string,any>>} */ const cases = [];
    const setTls = tlsPreferences(page, invoke);
    try {
      await fixture.verifyFixture();
      checks.push(
        "independent fixture client verifies server trust and server observes authorized pinned client CN/fingerprint",
      );
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(
          JSON.stringify({
            resources: [
              {
                _id: "wrk_mtls",
                _type: "workspace",
                parentId: null,
                name,
                scope: "collection",
              },
              {
                _id: "req_mtls",
                _type: "request",
                parentId: "wrk_mtls",
                name,
                method: "POST",
                url: fixture.primary.url + "/success",
                headers: [],
                parameters: [],
                body: { mimeType: "text/plain", text: payload },
              },
            ],
          }),
        );
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      const select = () =>
        page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "POST " + name, exact: true })
          .click();
      await select();
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
          "host-mismatch",
          fixture.ca,
          "other.invalid",
          fixture.client.identity,
          false,
        ],
        [
          "ca-bundle-required-root-second",
          fixture.otherCa + "\n" + fixture.ca,
          "127.0.0.1",
          fixture.client.identity,
          true,
        ],
        [
          "ca-bundle-required-root-first",
          fixture.ca + "\n" + fixture.otherCa,
          "127.0.0.1",
          fixture.client.identity,
          true,
        ],
        [
          "malformed-ca",
          "-----BEGIN CERTIFICATE-----\n%%%\n-----END CERTIFICATE-----",
          "127.0.0.1",
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
          "malformed-identity",
          fixture.ca,
          "127.0.0.1",
          "invalid client identity",
          false,
        ],
        ...fixture.invalidServers.map((server) => [
          "server-" + server.id,
          fixture.ca,
          "127.0.0.1",
          fixture.client.identity,
          false,
        ]),
        [
          "recovered-client",
          fixture.ca,
          "127.0.0.1",
          fixture.client.identity,
          true,
        ],
        [
          "cross-origin-redirect",
          fixture.ca,
          "127.0.0.1",
          fixture.client.identity,
          false,
        ],
      ]) {
        await setTls(String(ca), String(host), String(identity));
        await page.reload();
        await select();
        const server = fixture.invalidServers.find(
          (server) => id === "server-" + server.id,
        );
        const url = server
          ? server.httpUrl + "/success"
          : id === "cross-origin-redirect"
            ? fixture.primary.url + "/redirect"
            : fixture.primary.url + "/success";
        const urlInput = page.getByRole("textbox", {
          name: "Request URL",
          exact: true,
        });
        await urlInput.fill(url);
        await urlInput.blur();
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.some(
              (/** @type {any} */ r) =>
                r.name === name && r._type === "request" && r.url === url,
            ),
          "mTLS request URL persisted",
        );
        const before = await invoke("load_workspace");
        const count = fixture.requests.length;
        const connectionsBefore = server
          ? fixture.connections[
              /** @type {keyof typeof fixture.connections} */ (server.id)
            ]
          : fixture.connections.primary;
        const rejectedBefore = fixture.rejected.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (success)
          await poll(
            async () =>
              (await invoke("load_workspace")).history.some(
                (/** @type {any} */ row) =>
                  !before.history.some(
                    (/** @type {any} */ old) => old._id === row._id,
                  ),
              ) || (await page.locator(".error-state").isVisible()),
            "mTLS response history persisted " + id,
          );
        else await page.locator(".error-state").waitFor();
        await poll(
          async () =>
            !(await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()),
          "mTLS Send settled",
        );
        const after = await invoke("load_workspace");
        assert.deepEqual(
          after.resources,
          before.resources,
          "TLS Send preserves all request resources",
        );
        const fresh = after.history.filter(
          (/** @type {any} */ row) =>
            !before.history.some(
              (/** @type {any} */ old) => old._id === row._id,
            ),
        );
        assert.equal(
          fresh.length,
          success ? 1 : 0,
          "Successful Send persists once; connection failures preserve history",
        );
        const reached = fixture.requests.slice(count);
        if (server) {
          assert.ok(
            fixture.connections[
              /** @type {keyof typeof fixture.connections} */ (server.id)
            ] > connectionsBefore,
            "Native connects to invalid server before certificate refusal",
          );
          assert.equal(reached.length, 0);
          const alert =
            server.id === "hostname" ? "BadCertificate" : "CertificateExpired";
          await poll(
            async () =>
              fixture.rejected
                .slice(rejectedBefore)
                .some(
                  (event) =>
                    event.role === server.id &&
                    event.detail === "received fatal alert: " + alert,
                ),
            "Native certificate alert observed " + server.id,
          );
        }
        if (success || id === "cross-origin-redirect") {
          assert.equal(reached.length, 1);
          assert.equal(reached[0].authorized, true);
          assert.equal(reached[0].cn, fixture.clientName);
          assert.equal(reached[0].fingerprint, fixture.client.fingerprint);
          assert.equal(reached[0].method, "POST");
          assert.equal(reached[0].body, payload);
        } else
          assert.equal(
            reached.length,
            0,
            "Rejected TLS must not deliver HTTP payload",
          );
        const text = await page.locator("body").innerText();
        if (success) {
          assert.equal(fresh[0].status, 200);
          assert.match(text, /owned mTLS response/);
        } else {
          assert.match(text, /Could not send request/);
          assert.deepEqual(
            after.history,
            before.history,
            "Connection failure preserves exact persisted history",
          );
          assert.equal(fixture.sinkRequests.length, 0);
          assert.equal(fixture.connections.sink, 0);
        }
        if (["missing-identity", "host-mismatch"].includes(String(id)))
          assert.ok(
            fixture.rejected
              .slice(rejectedBefore)
              .some((event) => /peer sent no certificates/i.test(event.detail)),
          );
        if (["malformed-identity", "malformed-ca"].includes(String(id)))
          assert.equal(
            fixture.connections.primary,
            connectionsBefore,
            "Invalid PEM must fail before connecting",
          );
        const tabs = page.getByRole("tablist", {
          name: "Response view",
          exact: true,
        });
        await tabs.getByRole("tab", { name: "Timeline", exact: true }).click();
        const log = await page
          .getByRole("log", { name: "Connection log", exact: true })
          .innerText();
        if (success) {
          assert.match(log, /verification: chain and host name checked/);
          assert.match(log, /client certificate on/);
        }
        if (id === "cross-origin-redirect")
          assert.match(
            log,
            /Client certificate redirect to a different origin was blocked/,
          );
        assert.ok(
          !log.includes("BEGIN PRIVATE KEY") &&
            !log.includes(fixture.client.identity),
        );
        await page.screenshot({ path: join(output, String(id) + ".png") });
        await tabs.getByRole("tab", { name: "Preview", exact: true }).click();
        cases.push({
          id,
          success,
          status: fresh[0]?.status || null,
          requests: reached,
          sinkRequests: fixture.sinkRequests.length,
          sinkConnections: fixture.connections.sink,
          connections:
            (server
              ? fixture.connections[
                  /** @type {keyof typeof fixture.connections} */ (server.id)
                ]
              : fixture.connections.primary) - connectionsBefore,
          serverCertificate: server
            ? fixture.serverCertificates.find(
                (certificate) => certificate.id === server.id,
              )
            : undefined,
          rejections: fixture.rejected.slice(rejectedBefore),
          historyBefore: before.history.length,
          historyAfter: after.history.length,
          historyLimit: after.settings.maxHistory,
        });
        checks.push(
          String(id) +
            ": native TLS outcome, request resources preserved and no implicit duplicate Send",
        );
      }
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            checks,
            cases,
            limits:
              "Owned Windows native HTTP mTLS fixture and custom app CA; CA-signed hostname/expired/future server refusal and successful recovery verified; no OS trust-store changes or network TLS-validation bypass. Offline OpenSSL no_check_time isolates chain validity only. Independent positive checks validate both listeners; cross-origin destination has zero observed TCP connections/HTTP requests. Git/provider/proxy/other-platform TLS remain separate gates.",
          },
          null,
          2,
        ),
      );
    } finally {
      try {
        const tabs = page.getByRole("tablist", {
          name: "Response view",
          exact: true,
        });
        if (await tabs.count()) {
          await tabs
            .getByRole("tab", { name: "Timeline", exact: true })
            .click();
          const log = page.getByRole("log", {
            name: "Connection log",
            exact: true,
          });
          if (await log.count())
            await Bun.write(
              join(output, "last-network-log.txt"),
              await log.innerText(),
            );
        }
        await Bun.write(
          join(output, "partial-cases.json"),
          JSON.stringify(cases, null, 2),
        );
      } catch (error) {
        await Bun.write(join(output, "diagnostic-error.txt"), String(error));
      }
      try {
        await setTls(
          original.caPem || "",
          original.identityHost || "",
          original.identityPem || "",
          original.validateCertificates,
        );
        const restored = (await invoke("load_workspace")).settings;
        for (const key of [
          "caPem",
          "identityHost",
          "identityPem",
          "validateCertificates",
        ])
          assert.equal(
            restored[key],
            original[key],
            "TLS preference restored: " + key,
          );
        await Bun.write(
          join(output, "settings-restored.json"),
          JSON.stringify({
            restored: true,
            keys: [
              "caPem",
              "identityHost",
              "identityPem",
              "validateCertificates",
            ],
          }),
        );
      } finally {
        await fixture.close();
      }
    }
  },
);
