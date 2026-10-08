import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { clientCertificateFixture } from "./helpers/client-certificate.js";
import { tlsPreferences } from "./helpers/tls-preferences.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp(
  "wss-multiple-client-certificates",
  async ({ page, invoke, output }) => {
    const original = (await invoke("load_workspace")).settings;
    const setTls = tlsPreferences(page, invoke);
    const fixture = await clientCertificateFixture(output, {
      fileIdentities: true,
      multipleIdentities: true,
    });
    const cases = [];
    const keys = [
      "caPem",
      "identityHost",
      "identityPem",
      "validateCertificates",
    ];
    await Bun.write(
      join(output, "tls-original.json"),
      JSON.stringify({
        settings: Object.fromEntries(keys.map((key) => [key, original[key]])),
      }),
    );
    try {
      assert.ok(fixture.rsaClient && fixture.secondClient);
      await fixture.verifyFixture();
      const independent = [];
      for (const server of fixture.algorithmServers) {
        /** @type {typeof fixture.client} */
        const client = server.id.startsWith("rsa")
          ? fixture.rsaClient
          : fixture.client;
        /** @type {Response} */
        const response = await fetch(
          server.url.replace("wss:", "https:") + "/fixture-check",
          {
            signal: AbortSignal.timeout(5000),
            tls: {
              ca: fixture.ca,
              cert: client.certificate,
              key: client.key,
              rejectUnauthorized: true,
            },
          },
        );
        assert.equal(response.status, 200);
        assert.equal(await response.text(), "owned mTLS response");
        const peer = fixture.requests.at(-1);
        const signature = fixture.signatures.at(-1);
        assert.equal(peer?.fingerprint, client.fingerprint);
        assert.equal(signature?.scheme, server.scheme);
        assert.equal(signature?.version, server.version);
        independent.push({ server: server.id, peer, signature });
      }
      await Bun.write(
        join(output, "independent-algorithm-validation.json"),
        JSON.stringify(independent, null, 2),
      );
      fixture.requests.length = 0;
      fixture.signatures.length = 0;
      for (const role in fixture.algorithmConnections)
        fixture.algorithmConnections[role] = 0;
      await setTls(fixture.ca, "127.0.0.1", fixture.client.identity);
      const ec = {
        cert: fixture.identityFiles.cert,
        key: fixture.identityFiles.key,
      };
      const rsa = { cert: fixture.rsaFiles.cert, key: fixture.rsaFiles.key };
      const second = fixture.secondFiles;
      const pfx = {
        pfx: fixture.identityFiles.pfx,
        passphrase: fixture.identityFiles.password,
      };
      const rsaPfx = {
        pfx: fixture.rsaFiles.pfx,
        passphrase: fixture.identityFiles.password,
      };
      /** @type {Array<{id:string,server:string,rows:Array<Record<string,any>>,fingerprint?:string,preTcp?:boolean,route?:string}>} */
      const matrix = [];
      for (const server of fixture.algorithmServers) {
        for (const reverse of [false, true])
          matrix.push({
            id: server.id + (reverse ? "-rsa-first" : "-ec-first"),
            server: server.id,
            rows: reverse ? [rsa, ec] : [ec, rsa],
            fingerprint: server.id.startsWith("rsa")
              ? fixture.rsaClient.fingerprint
              : fixture.client.fingerprint,
          });
      }
      for (const server of ["rsa13", "ec13"]) {
        matrix.push({
          id: server + "-independent-arrays",
          server,
          rows: [
            { cert: ec.cert },
            { cert: rsa.cert },
            { key: rsa.key },
            { key: ec.key },
          ],
          fingerprint: server.startsWith("rsa")
            ? fixture.rsaClient.fingerprint
            : fixture.client.fingerprint,
        });
        for (const reverse of [false, true])
          matrix.push({
            id: server + "-pfx-" + reverse,
            server,
            rows: reverse ? [rsaPfx, pfx] : [pfx, rsaPfx],
            fingerprint: server.startsWith("rsa")
              ? fixture.rsaClient.fingerprint
              : fixture.client.fingerprint,
          });
      }
      matrix.push(
        {
          id: "last-certificate-same-algorithm",
          server: "ec13",
          rows: [{ cert: ec.cert }, second],
          fingerprint: fixture.secondClient.fingerprint,
        },
        {
          id: "earlier-key-mismatch",
          server: "ec13",
          rows: [ec, second],
          preTcp: true,
        },
        {
          id: "final-key-mismatch",
          server: "ec13",
          rows: [{ cert: ec.cert }, { cert: second.cert, key: ec.key }],
          preTcp: true,
        },
        {
          id: "overwritten-missing-file",
          server: "ec13",
          rows: [{ cert: ec.cert + ".missing" }, ec],
          preTcp: true,
        },
        { id: "unsupported-requested-algorithm", server: "ec13", rows: [rsa] },
        {
          id: "issuer-hint-mismatch",
          server: "ec13",
          rows: [
            {
              cert: ec.cert.replace(/client\.pem$/, "wrong-client.pem"),
              key: ec.key.replace(/client\.key$/, "wrong-client.key"),
            },
            rsa,
          ],
        },
        {
          id: "disabled-missing-file",
          server: "rsa13",
          rows: [ec, rsa, { cert: ec.cert + ".missing", disabled: true }],
          fingerprint: fixture.rsaClient.fingerprint,
        },
        {
          id: "pfx-after-pem",
          server: "ec13",
          rows: [second, pfx],
          fingerprint: fixture.client.fingerprint,
        },
        {
          id: "multi-identity-cross-origin",
          server: "rsa13",
          rows: [ec, rsa],
          route: "/ws-redirect-port",
        },
      );
      for (const entry of matrix) {
        const server = fixture.algorithmServers.find(
          (row) => row.id === entry.server,
        );
        assert.ok(server);
        const name = "Multiple WSS " + entry.id + " " + Date.now();
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
                  _id: "wrk_multi",
                  _type: "workspace",
                  parentId: null,
                  name,
                  scope: "collection",
                },
                {
                  _id: "req_multi",
                  _type: "websocket_request",
                  parentId: "wrk_multi",
                  name,
                  url: server.url + (entry.route || "/ws"),
                  headers: [],
                  parameters: [],
                },
                ...entry.rows.map((row, index) => ({
                  _id: "crt_multi_" + index,
                  _type: "client_certificate",
                  parentId: "wrk_multi",
                  host: "127.0.0.1:*",
                  disabled: false,
                  isPrivate: true,
                  ...row,
                })),
              ],
            }),
          );
        await dialog
          .getByRole("button", { name: "Review import", exact: true })
          .click();
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        const select = () =>
          page
            .getByRole("complementary", { name: "Collections" })
            .getByRole("button", { name: "WS " + name, exact: true })
            .click();
        await select();
        await page.reload();
        await select();
        const before = await invoke("load_workspace");
        const count = fixture.requests.length;
        const tcp = fixture.algorithmConnections[server.id] || 0;
        const signatureCount = fixture.signatures.length;
        const rejectionCount = fixture.rejected.length;
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .click();
        const success = !!entry.fingerprint;
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ row) =>
                !before.history.some(
                  (/** @type {any} */ old) => old._id === row._id,
                ) && row.connectionState === (success ? "closed" : "error"),
            ),
          entry.id + " settled",
        );
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
        for (const old of after.history.filter(
          (/** @type {any} */ row) => row._id !== response._id,
        ))
          assert.deepEqual(
            old,
            before.history.find(
              (/** @type {any} */ row) => row._id === old._id,
            ),
          );
        const reached = fixture.requests.slice(count);
        const signatures = fixture.signatures.slice(signatureCount);
        const connections =
          (fixture.algorithmConnections[server.id] || 0) - tcp;
        if (success || entry.route) {
          assert.equal(reached.length, 1);
          assert.equal(reached[0].authorized, true);
          assert.equal(
            reached[0].fingerprint,
            entry.fingerprint || fixture.rsaClient.fingerprint,
          );
          assert.equal(reached[0].url, entry.route || "/ws");
          assert.equal(signatures.length, 1);
          assert.equal(signatures[0].scheme, server.scheme);
          assert.equal(signatures[0].version, server.version);
        } else assert.equal(reached.length, 0);
        const messages = response.events.filter(
          (/** @type {any} */ row) => row.kind === "message",
        );
        if (success) {
          assert.equal(response.status, 101);
          assert.equal(messages.length, 1);
          assert.equal(messages[0].data, "owned mutual TLS WSS message");
        } else {
          assert.equal(messages.length, 0);
          assert.ok(
            response.events.some(
              (/** @type {any} */ row) => row.kind === "error",
            ),
          );
        }
        if (entry.preTcp)
          assert.equal(
            connections,
            0,
            "Selected identity error refuses before TCP, despite valid global PEM",
          );
        else assert.ok(connections > 0);
        if (
          ["issuer-hint-mismatch", "unsupported-requested-algorithm"].includes(
            entry.id,
          )
        ) {
          await poll(
            async () =>
              fixture.rejected
                .slice(rejectionCount)
                .some((row) => /peer sent no certificates/i.test(row.detail)),
            "No identity matches server certificate request",
          );
          assert.equal(signatures.length, 0);
        }
        assert.equal(
          fixture.connections.sink,
          0,
          "No client identity crosses origin",
        );
        assert.equal(fixture.sinkRequests.length, 0);
        assert.ok(!JSON.stringify(response).includes("BEGIN PRIVATE KEY"));
        await page.reload();
        await select();
        assert.deepEqual(
          (await invoke("load_workspace")).history.find(
            (/** @type {any} */ row) => row._id === response._id,
          ),
          response,
        );
        if (!success)
          await page.locator(".stream-pane .status-badge.failure").waitFor();
        if (["earlier-key-mismatch", "pfx-after-pem"].includes(entry.id))
          await page.screenshot({ path: join(output, entry.id + ".png") });
        cases.push({
          id: entry.id,
          success,
          connections,
          requests: reached,
          signatures,
          state: response.connectionState,
        });
        await Bun.write(
          join(output, "cases.json"),
          JSON.stringify(cases, null, 2),
        );
      }
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            checks: cases.map((row) => row.id),
            cases,
            limits:
              "Actual Windows native WSS, TLS 1.2/1.3 mandatory peer verification and restricted client signature requests, persisted imported collection rows and explicit Connect. Multiple single-key PFX files; multi-key PFX containers and other algorithms/platforms remain separate gates.",
          },
          null,
          2,
        ),
      );
    } finally {
      try {
        await setTls(
          original.caPem || "",
          original.identityHost || "",
          original.identityPem || "",
          original.validateCertificates,
        );
        const restored = (await invoke("load_workspace")).settings;
        for (const key of keys) assert.equal(restored[key], original[key]);
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
