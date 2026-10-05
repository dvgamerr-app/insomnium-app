import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-ntlm-ui-probe/build-state.json";
// Microsoft MS-NLMP 2.2.1.2: synthetic Type2, Unicode domain and terminated AV pairs.
// Proof oracle follows MS-NLMP 3.3.2 independently of the native SSPI implementation.
// This does not cover MIC, TLS binding, or a hosted provider.
const domain = Buffer.from("FIXTURE", "utf16le");
const av = Buffer.alloc(4 + domain.length + 4);
av.writeUInt16LE(2, 0);
av.writeUInt16LE(domain.length, 2);
domain.copy(av, 4);
const challenge = Buffer.alloc(56 + domain.length + av.length);
challenge.write("NTLMSSP\0");
challenge.writeUInt32LE(2, 8);
/** @param {number} at @param {number} size @param {number} offset */
function field(at, size, offset) {
  challenge.writeUInt16LE(size, at);
  challenge.writeUInt16LE(size, at + 2);
  challenge.writeUInt32LE(offset, at + 4);
}
field(12, domain.length, 56);
challenge.writeUInt32LE(0x00888205, 20);
Buffer.from("0123456789abcdef", "hex").copy(challenge, 24);
field(40, av.length, 56 + domain.length);
domain.copy(challenge, 56);
av.copy(challenge, 56 + domain.length);
/** @type {any[]} */ const received = [];
/** @type {string[]} */ const errors = [];
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const auth = req.headers.authorization || "";
    const entry = {
      path: req.url,
      body: Buffer.concat(chunks).toString(),
      port: req.socket.remotePort,
      type: 0,
      user: "",
      domain: "",
    };
    received.push(entry);
    if (req.url === "/manual") {
      assert.equal(auth, "Custom literal");
      res.end("manual-ok");
      return;
    }
    if (!auth) {
      res.writeHead(401, { "WWW-Authenticate": "NTLM", "Content-Length": "0" });
      res.end();
      return;
    }
    assert.ok(auth.startsWith("NTLM "), "Never substitute Basic or Negotiate");
    const token = Buffer.from(auth.slice(5), "base64");
    assert.equal(token.subarray(0, 8).toString(), "NTLMSSP\0");
    entry.type = token.readUInt32LE(8);
    if (entry.type === 1) {
      res.writeHead(401, {
        "WWW-Authenticate": "NTLM " + challenge.toString("base64"),
        "Content-Length": "0",
      });
      res.end();
      return;
    }
    assert.equal(entry.type, 3);
    /** @param {number} at */
    const text = (at) => {
      const size = token.readUInt16LE(at);
      const offset = token.readUInt32LE(at + 4);
      assert.ok(offset + size <= token.length);
      return token.subarray(offset, offset + size).toString("utf16le");
    };
    entry.domain = text(28);
    entry.user = text(36);
    assert.equal(entry.domain, "FIXTURE");
    assert.equal(entry.user, "fixture");
    assert.ok(
      token.readUInt16LE(20) > 16,
      "NTLM response includes proof and client blob",
    );
    const responseSize = token.readUInt16LE(20);
    const responseOffset = token.readUInt32LE(24);
    assert.ok(responseOffset + responseSize <= token.length);
    const response = token.subarray(
      responseOffset,
      responseOffset + responseSize,
    );
    assert.deepEqual(response.subarray(16, 18), Buffer.from([1, 1]));
    const ntHash = createHash("md4")
      .update(Buffer.from("synthetic:password", "utf16le"))
      .digest();
    const responseKey = createHmac("md5", ntHash)
      .update(Buffer.from(entry.user.toUpperCase() + entry.domain, "utf16le"))
      .digest();
    const expectedProof = createHmac("md5", responseKey)
      .update(
        Buffer.concat([challenge.subarray(24, 32), response.subarray(16)]),
      )
      .digest();
    assert.ok(
      timingSafeEqual(response.subarray(0, 16), expectedProof),
      "NTLMv2 proof validates the imported password",
    );
    const alteredProof = Buffer.from(expectedProof);
    alteredProof[0] ^= 1;
    assert.equal(
      timingSafeEqual(response.subarray(0, 16), alteredProof),
      false,
    );
    res.end("ntlm-proof-ok");
  } catch (error) {
    errors.push(String(error));
    res.writeHead(500);
    res.end("fixture assertion failed");
  }
});
await new Promise((resolve) =>
  server.listen(0, "127.0.0.1", () => resolve(undefined)),
);
try {
  await withNativeApp("curl-import-ntlm", async ({ page, invoke, output }) => {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = "http://127.0.0.1:" + address.port;
    const before = await invoke("load_workspace");
    await page
      .getByRole("button", { name: "Import collection", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Import collection or cURL commands", { exact: true })
      .fill(
        "curl --ntlm -u 'FIXTURE\\fixture:synthetic:password' -d replay-body '" +
          base +
          "/ntlm' --next --ntlm -u 'FIXTURE\\fixture:synthetic:password' -H 'Authorization: Custom literal' '" +
          base +
          "/manual'",
      );
    await dialog
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    await dialog.getByText("2 requests", { exact: true }).waitFor();
    assert.equal(received.length, 0);
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const oldIds = new Set(
      before.resources.map(/** @param {any} r */ (r) => r._id),
    );
    /** @type {any[]} */ let added = [];
    await poll(async () => {
      added = (await invoke("load_workspace")).resources.filter(
        /** @param {any} r */ (r) =>
          !oldIds.has(r._id) && r._type === "request",
      );
      return added.length === 2;
    }, "NTLM import persisted");
    assert.equal(received.length, 0);
    for (const request of added) {
      assert.equal(request.authentication.type, "ntlm");
      assert.equal(request.authentication.username, "FIXTURE\\fixture");
      assert.equal(request.authentication.password, "synthetic:password");
    }
    await page.reload();
    for (const request of added) {
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name: request.method + " " + request.url,
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () =>
          received.some((r) => r.path === new URL(request.url).pathname),
        "Native request",
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Send settled",
      );
    }
    assert.deepEqual(errors, []);
    const handshake = received.filter((r) => r.path === "/ntlm");
    assert.deepEqual(
      handshake.map((r) => r.type),
      [0, 1, 3],
    );
    assert.ok(handshake.every((r) => r.body === "replay-body"));
    assert.equal(
      handshake[1].port,
      handshake[2].port,
      "Type2 and Type3 use same TCP connection",
    );
    assert.equal(received.filter((r) => r.path === "/manual").length, 1);
    await page.reload();
    const final = await invoke("load_workspace");
    for (const request of added)
      assert.deepEqual(
        final.resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        ),
        request,
      );
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "Import and reload preserve explicit NTLM identity/password",
            "Native Type1/Type3 identity and connection binding",
            "POST body replay",
            "Manual Authorization suppresses NTLM",
            "No Basic fallback",
            "Independent Bun NTLMv2 password proof validation",
          ],
          limitation:
            "Fixture validates NTLMv2 password proof; MIC/TLS binding/hosted provider authentication remain outside this scenario",
          received,
        },
        null,
        2,
      ),
    );
  });
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(() => resolve(undefined)));
}
