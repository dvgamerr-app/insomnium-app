import {
  certificateSettings,
  protocolCertificateCases,
} from "./helpers/certificate-settings.js";
import assert from "node:assert/strict";
import { connect } from "node:http2";
import { gunzipSync, inflateSync } from "node:zlib";
import { createClipboardPreserver } from "./helpers/clipboard-preservation.js";
import { respondToOwnedSaveDialog } from "./helpers/windows-save-dialog.js";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
  withNativeApp,
  poll,
  integrationProbeIdentifier,
  selectedNativeProbeIdentifier,
} from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { id, newRequest } from "../../src/lib/model.js";
import { clientCertificateFixture, grpcOutlierConfig } from "./helpers/client-certificate.js";
import { tlsPreferences } from "./helpers/tls-preferences.js";
import { grpcStreamCertificate } from "./helpers/grpc-stream-certificate.js";
import { grpcReflectionCertificate } from "./helpers/grpc-reflection-certificate.js";

assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
assert.ok(
  process.env.INSOMNIUM_UI_BUILD_STATE,
  "Explicit current native build required",
);
const message = "owned mutual TLS gRPC response";
const streamOnly = process.env.INSOMNIUM_GRPC_STREAM_ONLY === "1";
const closeMethod=process.env.INSOMNIUM_GRPC_CLOSE_METHOD;
const reopenAfterClose=process.env.INSOMNIUM_GRPC_CLOSE_REOPEN==='1';
assert.ok(!reopenAfterClose||closeMethod,"Reopen requires an explicit close shape");
assert.ok(!closeMethod || ["HoldUnary","Hold","Collect","Chat"].includes(closeMethod),"Explicit close RPC shape required");
const gzipTransferOnly = process.env.INSOMNIUM_GRPC_GZIP_TRANSFER_ONLY === "1";
const gzipExactOnly = gzipTransferOnly || process.env.INSOMNIUM_GRPC_GZIP_EXACT_ONLY === "1";
const gzipMembersOnly = gzipExactOnly || process.env.INSOMNIUM_GRPC_GZIP_MEMBERS_ONLY === "1";
const orcaWeights=process.env.INSOMNIUM_GRPC_ORCA_WEIGHTS||'';
const orcaNumeric=orcaWeights.startsWith('number-');
assert.ok(!orcaWeights||['control','weighted','swap','blackout','expiry','penalty','penalty0','blackout-exit','expiry-refresh','wiretype','gzip','deflate','number-zero','number-nan','number-infinity','number-negative'].includes(orcaWeights),'Select ORCA routing control or weighted focus');
const orcaInterval=process.env.INSOMNIUM_GRPC_ORCA_INTERVAL==='1';
const orcaError=process.env.INSOMNIUM_GRPC_ORCA_ERROR||'';
assert.ok(!orcaWeights||(!orcaInterval&&!orcaError),'ORCA routing focus is exclusive');
assert.ok(!orcaError||['unavailable','unimplemented','cancelled','backoff-cancel','live-cancel','malformed-proto','malformed-gzip','partial-gzip','members-gzip','limit-gzip-exact','limit-gzip-over','limit-frame-over'].includes(orcaError),'Select an owned ORCA error case');
const orcaOnly = !!orcaWeights || orcaInterval || !!orcaError || process.env.INSOMNIUM_GRPC_ORCA_ONLY === '1';
const outlierRecoveryOnly = process.env.INSOMNIUM_GRPC_OUTLIER_RECOVERY_ONLY === "1";
const outlierOnly = outlierRecoveryOnly || process.env.INSOMNIUM_GRPC_OUTLIER_ONLY === "1";
const initialOnly = process.env.INSOMNIUM_GRPC_INITIAL_STATUS_ONLY === "1";
const duplicatesOnly = initialOnly || process.env.INSOMNIUM_GRPC_DUPLICATES_ONLY === "1";
const statusNamesOnly = process.env.INSOMNIUM_GRPC_STATUS_NAMES_ONLY === "1";
const resolverHoldOnly = process.env.INSOMNIUM_GRPC_RESOLVER_HOLD_ONLY === "1";
const policyDeadlineOnly = process.env.INSOMNIUM_GRPC_POLICY_DEADLINE_ONLY === "1";
const deadlineOnly = process.env.INSOMNIUM_GRPC_DEADLINE_ONLY === "1";
const throttleResetOnly = process.env.INSOMNIUM_GRPC_THROTTLE_RESET_ONLY === "1";
const throttleResizeOnly = throttleResetOnly || process.env.INSOMNIUM_GRPC_THROTTLE_RESIZE_ONLY === "1";
const throttleOnly = throttleResizeOnly || process.env.INSOMNIUM_GRPC_THROTTLE_ONLY === "1";
const refusedOnly = process.env.INSOMNIUM_GRPC_REFUSED_ONLY === "1";
const emptyBudgetOnly = process.env.INSOMNIUM_GRPC_EMPTY_BUDGET_ONLY === "1";
const budgetOnly = emptyBudgetOnly || process.env.INSOMNIUM_GRPC_BUDGET_ONLY === "1";
const policyCancelOnly = process.env.INSOMNIUM_GRPC_POLICY_CANCEL_ONLY === "1";
const policyOnly = orcaOnly || outlierOnly || statusNamesOnly || resolverHoldOnly || policyDeadlineOnly || deadlineOnly || throttleOnly || budgetOnly || policyCancelOnly || process.env.INSOMNIUM_GRPC_POLICY_ONLY === "1";
const codecOnly = process.env.INSOMNIUM_GRPC_CODEC_ONLY === "1";
const numberOnly = !!closeMethod || gzipMembersOnly || duplicatesOnly || process.env.INSOMNIUM_GRPC_NUMBER_ONLY === "1";
const partialOnly = process.env.INSOMNIUM_GRPC_PARTIAL_ONLY === "1";
const overflowOnly = process.env.INSOMNIUM_GRPC_DECODED_OVERFLOW_ONLY === "1";
const validationDisabled =
  process.env.INSOMNIUM_GRPC_TLS_VALIDATION_OFF === "1";
assert.ok(!resolverHoldOnly || (!policyDeadlineOnly && !deadlineOnly && !throttleOnly && !budgetOnly && !policyCancelOnly),"Resolver hold focus is exclusive");
assert.ok(!outlierOnly || (!statusNamesOnly && !resolverHoldOnly && !policyDeadlineOnly && !deadlineOnly && !throttleOnly && !budgetOnly && !policyCancelOnly),"Outlier focus is exclusive");
assert.ok(!statusNamesOnly || (!resolverHoldOnly && !policyDeadlineOnly && !deadlineOnly && !throttleOnly && !budgetOnly && !policyCancelOnly),"Status-name focus is exclusive");
assert.ok(!policyDeadlineOnly || (!deadlineOnly && !throttleOnly && !budgetOnly && !policyCancelOnly),"Policy deadline focus is exclusive");
assert.ok(!deadlineOnly || (!throttleOnly && !budgetOnly && !policyCancelOnly),"Deadline focus is exclusive");
assert.ok(!throttleOnly || (!budgetOnly && !policyCancelOnly),"Throttle focus is exclusive");
assert.ok(!refusedOnly || (!policyOnly && !codecOnly && !numberOnly && !partialOnly && !overflowOnly && !validationDisabled),"Refused focus is exclusive and trusted");
assert.ok(!budgetOnly || !policyCancelOnly,"Budget and cancellation focuses are exclusive");
assert.ok(!policyOnly || (!codecOnly && !numberOnly && !partialOnly && !overflowOnly && !validationDisabled && process.env.GRPC_NODE_USE_ALTERNATIVE_RESOLVER==='true'), "Policy focus requires exclusive trusted alternative-DNS mode");
assert.ok(!codecOnly || (!numberOnly && !partialOnly && !overflowOnly && !validationDisabled), "Codec focus is exclusive and requires trusted TLS");
assert.ok(!numberOnly || (!partialOnly && !overflowOnly && !validationDisabled), "Number focus is exclusive and requires trusted TLS");
assert.ok(!partialOnly || (!overflowOnly && !validationDisabled), "Partial focus requires trusted TLS and exclusive focus");
assert.ok(!overflowOnly || !validationDisabled, "Overflow focus requires normal certificate validation");
await preserveNativeProfile(() =>
  withNativeApp(
    streamOnly ? "grpc-stream-admission" : orcaOnly ? "grpc-orca"+(orcaWeights?"-weights-"+orcaWeights:orcaInterval?"-interval":orcaError?"-"+orcaError:"") : closeMethod ? "grpc-os-close-"+closeMethod : gzipTransferOnly ? "grpc-gzip-transfer" : gzipExactOnly ? "grpc-gzip-exact" : gzipMembersOnly ? "grpc-gzip-members" : outlierRecoveryOnly ? "grpc-outlier-recovery" : outlierOnly ? "grpc-outlier" : initialOnly ? "grpc-initial-status" : duplicatesOnly ? "grpc-duplicate-headers" : statusNamesOnly ? "grpc-status-names" : resolverHoldOnly ? "grpc-resolver-hold" : policyDeadlineOnly ? "grpc-policy-deadline" : deadlineOnly ? "grpc-method-deadline" : throttleResetOnly ? "grpc-throttle-reset" : throttleResizeOnly ? "grpc-throttle-resize" : throttleOnly ? "grpc-retry-throttle" : refusedOnly ? "grpc-transparent-refused" : emptyBudgetOnly ? "grpc-replay-empty-budget" : budgetOnly ? "grpc-replay-budget" : policyCancelOnly ? "grpc-policy-cancel" : policyOnly ? "grpc-policy" : codecOnly ? "grpc-codec-error" : numberOnly ? "grpc-status-number" : partialOnly ? "grpc-partial-frame" : overflowOnly ? "grpc-decoded-overflow" : validationDisabled ? "grpc-validation-off" : "grpc-client-certificate",
    async ({ page, invoke, output, pid, requestNativeClose }) => {
      let nativeClosed=false;
      const fixture = await clientCertificateFixture(output, {
        grpc: true,
        fileIdentities: true,
        grpcPolicy: policyOnly,
        grpcOrca: orcaOnly,
        grpcOutlier: outlierOnly,
        grpcOutlierRecovery: outlierRecoveryOnly,
        grpcStatusNames: statusNamesOnly,
        grpcDeadline: deadlineOnly,
        grpcPolicyDeadline: policyDeadlineOnly,
        grpcResolverHold: resolverHoldOnly,
        grpcBudget: budgetOnly,
        grpcEmptyBudget: emptyBudgetOnly,
        grpcThrottle: throttleOnly,
        grpcThrottleResize: throttleResizeOnly,
        grpcThrottleReset: throttleResetOnly,
      });
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
                assert.equal(bytes[0], 2);
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
        // TLS needs an owned collection, not a filesystem Git repository.
        const data = await invoke("load_workspace");
        // This owned request runs 47 unary/error cases. Keep them within the
        // existing policy so preservation assertions do not expect evicted rows.
        data.settings.maxHistory = 100;
        const workspaceId = id("wrk"),
          environmentId = id("env");
        const placeholder = newRequest(workspaceId, {
          name: "Owned TLS placeholder",
        });
        data.resources.push(
          {
            _id: workspaceId,
            _type: "workspace",
            parentId: null,
            name: "Owned gRPC TLS",
            scope: "collection",
          },
          {
            _id: environmentId,
            _type: "environment",
            parentId: workspaceId,
            name: "Base Environment",
            data: {},
          },
          placeholder,
        );
        data.activeWorkspaceId = workspaceId;
        data.activeEnvironmentId = environmentId;
        data.activeRequestId = placeholder._id;
        data.openTabs = [placeholder._id];
        await invoke("save_workspace", { data });
        await page.reload();
        await page.locator(".new-request-menu summary").waitFor();
        await page.locator(".new-request-menu summary").click();
        await page
          .getByRole("button", { name: "gRPC Request", exact: true })
          .click();
        await page
          .getByRole("textbox", { name: "gRPC server URL", exact: true })
          .fill(fixture.grpc.url.replace("https:", "grpcs:"));
        await page
          .getByRole("tab", { name: "Proto Files", exact: true })
          .click();
        await page.getByLabel("Import files", { exact: true }).setInputFiles({
          name: "owned-mtls.proto",
          mimeType: "text/plain",
          buffer: Buffer.from(
            'syntax = "proto3"; package owned; message Input { string name = 1; } service Sample { rpc Echo (Input) returns (Input); rpc Watch (Input) returns (stream Input); rpc Collect (stream Input) returns (Input); rpc Chat (stream Input) returns (stream Input); rpc Hold (Input) returns (stream Input); rpc BadGzip (Input) returns (Input); rpc BadDeflate (Input) returns (Input); rpc Oversized (Input) returns (Input); rpc Oversized503 (Input) returns (Input); rpc DecodedOverflow (Input) returns (Input); rpc PartialMissing (Input) returns (Input); rpc PartialIdentity (Input) returns (Input); rpc PartialUnknown (Input) returns (Input); rpc Number17 (Input) returns (Input); rpc NumberNegative (Input) returns (Input); rpc NumberFraction (Input) returns (Input); rpc NumberNaN (Input) returns (Input); rpc NumberInfinity (Input) returns (Input); rpc NumberNegativeInfinity (Input) returns (Input); rpc NumberHex (Input) returns (Input); rpc NumberExponent (Input) returns (Input); rpc CodecMissing (Input) returns (Input); rpc CodecIdentity (Input) returns (Input); rpc CodecUnknown (Input) returns (Input); rpc RetryOnce (Input) returns (Input); rpc HedgeOnce (Input) returns (Input); rpc RetryCancel (Input) returns (Input); rpc HedgeCancel (Input) returns (Input); rpc BudgetExact (Input) returns (Input); rpc BudgetOver (Input) returns (Input); rpc BudgetEmptyExact (stream Input) returns (Input); rpc BudgetEmptyOver (stream Input) returns (Input); rpc RefusedOnce (Input) returns (Input); rpc RefusedTwice (Input) returns (Input); rpc RefusedAfterHeaders (Input) returns (Input); rpc DeadlineObject (Input) returns (Input); rpc DeadlineString (Input) returns (Input); rpc DeadlineEarlier (Input) returns (Input); rpc ThrottleDrain (Input) returns (Input); rpc ThrottleBlocked (Input) returns (Input); rpc ThrottleRecover (Input) returns (Input); rpc ThrottleRetry (Input) returns (Input); rpc ThrottleScaleSeed (Input) returns (Input); rpc ThrottleScaleUp (Input) returns (Input); rpc ThrottleScaleDown (Input) returns (Input); }'.replace('service Sample {',closeMethod?'service Sample { rpc HoldUnary (Input) returns (Input);':'service Sample {').replace(/}$/, statusNamesOnly || duplicatesOnly || outlierOnly || gzipMembersOnly ? (gzipMembersOnly ? (gzipExactOnly ? ['GzipExact','GzipExactOver'] : ['GzipMembers','GzipCorrupt','GzipTruncated','GzipJunk','GzipOverflow','GzipZeros','GzipZeroJunk','GzipZeroMember']) : outlierRecoveryOnly ? ['OutlierRecovery'] : outlierOnly ? ['OutlierDisabled','OutlierEnabled'] : statusNamesOnly ? ['RetryAscii','RetryUnicode','HedgeAscii','HedgeUnicode'] : initialOnly ? ['InitialPadded','InitialDuplicate','InitialInvalid'] : ['DuplicateHeaders','DuplicateTrailers']).map(method=>'rpc '+method+' (Input) returns (Input);').join(' ')+' }' : '}'),
          ),
        });
        await page
          .getByRole("button", { name: "Import 1 files", exact: true })
          .click();
        await page
          .getByRole("button", { name: "owned-mtls.proto", exact: true })
          .waitFor();
        const requestId = (await invoke("load_workspace")).activeRequestId;
        const fileCases = protocolCertificateCases(fixture);
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
          ...fileCases.map((entry) => [
            entry.id,
            entry.ca || fixture.ca,
            "127.0.0.1",
            entry.preTcp ? fixture.client.identity : "",
            entry.success,
          ]),
        ]) {
          if ((streamOnly || overflowOnly || partialOnly || numberOnly || codecOnly || policyOnly || refusedOnly) && id !== "trusted-client") continue;
          if (
            validationDisabled &&
            !["missing-identity", "malformed-ca"].includes(String(id))
          )
            continue;
          const expectedSuccess = validationDisabled
            ? id === "malformed-ca"
            : success;
          await setTls(
            String(ca),
            String(host),
            String(identity),
            !validationDisabled,
          );
          const fileCase = fileCases.find((entry) => entry.id === id);
          if (fileCase) await certificateSettings(page, invoke, fileCase);
          await page.reload();
          const server = fixture.invalidServers.find(
            (server) => id === "server-" + server.id,
          );
          const url = (server ? server.grpcUrl : fixture.grpc.url).replace(
            "https:",
            "grpcs:",
          );
          const input = page.getByRole("textbox", {
            name: "gRPC server URL",
            exact: true,
          });
          await input.fill(url);
          await input.blur();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ resource) => resource._id === requestId,
              )?.url === url,
            "Unary server certificate URL persisted",
          );
          await page
            .getByRole("button", { name: "Load methods", exact: true })
            .click();
          await page
            .getByRole("combobox", { name: "gRPC method", exact: true })
            .selectOption({ label: "/Sample/Echo · Unary" });
          await page
            .getByRole("tablist", { name: "gRPC request editor", exact: true })
            .getByRole("tab", { name: "Body", exact: true })
            .click();
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
          await page
            .getByRole("button", { name: "Send", exact: true })
            .waitFor();
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
          if (server) {
            assert.ok(
              fixture.grpcConnections.count > connections,
              "Native attempts invalid server TLS handshake",
            );
            const alert =
              server.id === "hostname"
                ? "BadCertificate"
                : "CertificateExpired";
            await poll(
              async () =>
                fixture.rejected
                  .slice(rejected)
                  .some(
                    (event) =>
                      event.role === "grpc" &&
                      event.detail.includes("received fatal alert: " + alert),
                  ),
              "Native gRPC certificate alert " + server.id,
            );
          }
          const received = response.events.filter(
            (/** @type {any} */ event) => event.kind === "message",
          );
          if (expectedSuccess) {
            assert.ok(response.headers.every((/** @type {[string,string]} */ row) => !["grpc-encoding", "grpc-accept-encoding"].includes(row[0])));
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
          if (
            !expectedSuccess &&
            (["malformed-ca", "malformed-identity"].includes(String(id)) ||
              fileCase?.preTcp)
          )
            assert.equal(
              fixture.grpcConnections.count,
              connections,
              "Malformed PEM refuses before TCP",
            );
          if (["missing-identity", "host-mismatch"].includes(String(id)))
            assert.ok(
              fixture.rejected
                .slice(rejected)
                .some((event) =>
                  /peer sent no certificates/i.test(event.detail),
                ),
            );
          if (fileCase?.caFile && !expectedSuccess && !fileCase.preTcp) {
            assert.ok(
              fixture.grpcConnections.count > connections,
              "Untrusted collection CA reaches TLS handshake",
            );
            await poll(
              async () =>
                fixture.rejected
                  .slice(rejected)
                  .some(
                    (event) =>
                      event.role === "grpc" &&
                      event.detail.includes("received fatal alert: UnknownCA"),
                  ),
              "Native unary collection CA trust refusal",
            );
          }
          assert.ok(!JSON.stringify(response).includes("BEGIN PRIVATE KEY"));
          assert.equal(fixture.sinkRequests.length, 0);
          assert.equal(fixture.connections.sink, 0);
          await page.screenshot({ path: join(output, String(id) + ".png") });
          cases.push({
            id,
            success: expectedSuccess,
            validateCertificates: !validationDisabled,
            response,
            requests: reached,
            connections: fixture.grpcConnections.count - connections,
            rejections: fixture.rejected.slice(rejected),
            serverCertificate: server
              ? fixture.serverCertificates.find(
                  (certificate) => certificate.id === server.id,
                )
              : undefined,
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
        if(closeMethod){
          const client=closeMethod==='Collect'||closeMethod==='Chat';
          const shape=closeMethod==='Collect'?'Client streaming':closeMethod==='Chat'?'Bidirectional':closeMethod==='Hold'?'Server streaming':'Unary';
          await page.getByRole('button',{name:'Load methods',exact:true}).click();
          await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+closeMethod+' · '+shape});
          const beforeClose=await invoke('load_workspace'),start=fixture.grpcEvents.length,requestStart=fixture.grpcRequests.length;
          const path='/owned.Sample/'+closeMethod;
          await page.getByRole('button',{name:client?'Connect':'Send',exact:true}).click();
          await poll(async()=>fixture.grpcEvents.slice(start).some(e=>e.event==='grpc-open'&&e.url===path),'Close target reached authenticated peer');
          if(client)await page.getByRole('button',{name:'Send message',exact:true}).click();
          await poll(async()=>fixture.grpcEvents.slice(start).some(e=>e.event==='grpc-message'&&e.url===path),'Close target has real protobuf payload');
          const commands=/** @type {string[]} */([]),pageErrors=/** @type {string[]} */([]);
          page.on('pageerror',e=>pageErrors.push(String(e)));
          page.on('request',r=>{const url=new URL(r.url());if(url.hostname==='ipc.localhost')commands.push(decodeURIComponent(url.pathname.slice(1)));});
          await invoke('load_workspace');await poll(async()=>commands.includes('load_workspace'),'Close IPC observer ready');commands.length=0;
          const nativeClose=await requestNativeClose();nativeClosed=true;
          await poll(async()=>fixture.grpcEvents.slice(start).some(e=>e.event==='grpc-cancelled'&&e.url===path),'WM_CLOSE cancels peer');
          const events=fixture.grpcEvents.slice(start),cancel=events.find(e=>e.event==='grpc-cancelled'&&e.url===path);
          assert.equal(cancel?.reason,'CANCEL');
          const frames=events.filter(e=>e.event==='grpc-message'&&e.url===path);assert.equal(frames.length,1);assert.deepEqual(frames[0].bytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);
          const requests=fixture.grpcRequests.slice(requestStart);assert.equal(requests.length,1);assert.equal(requests[0].fingerprint,fixture.client.fingerprint);assert.equal(requests[0].authorized,true);
          await Bun.write(join(output,'close-observations.json'),JSON.stringify({nativeClose,commands,events,requests,pageErrors},null,2));
          for(const command of ['cancel_http','save_workspace','plugin:window|destroy'])assert.ok(commands.includes(command),'Shutdown reaches '+command);
          assert.ok(commands.lastIndexOf('save_workspace')>commands.indexOf('cancel_http'));assert.ok(commands.indexOf('plugin:window|destroy')>commands.lastIndexOf('save_workspace'));
          const persisted=await Bun.file(join(process.env.APPDATA??'',integrationProbeIdentifier,'workspace-v1.json')).json();
          const fresh=persisted.history.filter((/** @type {any} */r)=>r.requestId===requestId&&!beforeClose.history.some((/** @type {any} */old)=>old._id===r._id));assert.equal(fresh.length,1);
          const response=fresh[0];assert.equal(response.status,1);assert.equal(response.connectionState,'closed');assert.deepEqual(response.events.filter((/** @type {any} */e)=>e.kind==='status').map((/** @type {any} */e)=>e.code),[1]);
          for(const old of beforeClose.history)assert.deepEqual(persisted.history.find((/** @type {any} */r)=>r._id===old._id),old);
          assert.deepEqual(persisted.resources,beforeClose.resources);assert.deepEqual(pageErrors,[]);
          let reopened=/** @type {Record<string,any>|undefined} */(undefined);
          if(reopenAfterClose){
            await withNativeApp('grpc-os-reopen-'+closeMethod,async ({page:resumedPage,invoke:resumedInvoke,output:resumedOutput,pid:resumedPid})=>{
              const countBefore=fixture.grpcRequests.length,connectionsBefore=fixture.grpcConnections.count;
              const resumed=await resumedInvoke('load_workspace');
              assert.deepEqual(resumed.history,persisted.history);assert.deepEqual(resumed.resources,persisted.resources);
              await resumedPage.getByRole('button',{name:'Send',exact:true}).waitFor();
              if(client)assert.equal(await resumedPage.getByRole('button',{name:'Send',exact:true}).isDisabled(),true,'Fresh schema has not loaded');
              assert.match(await resumedPage.locator('.grpc-response .status-badge').innerText(),/^1 /);
              await Bun.sleep(500);assert.equal(fixture.grpcRequests.length,countBefore,'Fresh process must not resend');assert.equal(fixture.grpcConnections.count,connectionsBefore,'Fresh process must not reconnect implicitly');
              await resumedPage.getByRole('button',{name:'Load methods',exact:true}).click();
              if(client)await resumedPage.getByRole('button',{name:'Connect',exact:true}).waitFor();
              await resumedPage.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/Echo · Unary'});
              const initial=await resumedInvoke('load_workspace');
              await resumedPage.getByRole('button',{name:'Send',exact:true}).click();
              await poll(async()=>(await resumedInvoke('load_workspace')).history.some((/** @type {any} */r)=>r.requestId===requestId&&r.status===0&&!initial.history.some((/** @type {any} */old)=>old._id===r._id)),'Fresh process explicit Send succeeds');
              await resumedPage.getByText(message,{exact:false}).first().waitFor();
              const completed=await resumedInvoke('load_workspace'),fresh=completed.history.filter((/** @type {any} */r)=>!initial.history.some((/** @type {any} */old)=>old._id===r._id));assert.equal(fresh.length,1);
              const reply=fresh[0];assert.equal(reply.status,0);assert.equal(reply.connectionState,'closed');assert.deepEqual(reply.events.filter((/** @type {any} */e)=>e.kind==='status').map((/** @type {any} */e)=>e.code),[0]);assert.deepEqual(reply.events.filter((/** @type {any} */e)=>e.kind==='message').map((/** @type {any} */e)=>JSON.parse(e.text)),[{name:message}]);
              const reached=fixture.grpcRequests.slice(countBefore);assert.equal(reached.length,1);assert.equal(reached[0].url,'/owned.Sample/Echo');assert.equal(reached[0].fingerprint,fixture.client.fingerprint);assert.equal(reached[0].authorized,true);assert.deepEqual(reached[0].bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);
              for(const old of persisted.history)assert.deepEqual(completed.history.find((/** @type {any} */r)=>r._id===old._id),old);
              await resumedPage.reload();await resumedPage.getByRole('button',{name:'Send',exact:true}).waitFor();await resumedPage.getByText(message,{exact:false}).first().waitFor();assert.deepEqual((await resumedInvoke('load_workspace')).history,completed.history);assert.equal(fixture.grpcRequests.length,countBefore+1,'Reload after recovery must not resend');
              await resumedPage.screenshot({path:join(resumedOutput,'recovered.png')});
              reopened={passed:true,pid:resumedPid,output:resumedOutput,quietMs:500,noImplicitRequest:true,noImplicitConnection:true,historyPreserved:true,priorCancelled:response._id,reply,requests:reached,reload:true};
              await Bun.write(join(resumedOutput,'acceptance.json'),JSON.stringify(reopened,null,2));
            });
          }
          await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,method:closeMethod,nativeClose,commands,events,requests,response,priorHistoryPreserved:true,resourcesPreserved:true,pageErrors,reopened,limits:reopenAfterClose?'Owned Windows WM_CLOSE, fresh native process restores history without implicit IO, explicit Echo succeeds and reload does not resend. Not crash/OS shutdown/other-platform/full migration acceptance.':'Owned Windows WM_CLOSE on one active RPC; not reopen/crash/OS shutdown/other-platform or full migration acceptance'},null,2));
          return;
        }
        if(refusedOnly) for(const [method,code,expected] of /** @type {[string,number,number][]} */ ([['RefusedOnce',0,2],['RefusedTwice',14,2],['RefusedAfterHeaders',14,1]])) {
          await page.getByRole('button',{name:'Load methods',exact:true}).click();
          await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
          const before=await invoke('load_workspace'),count=fixture.grpcRequests.length;
          await page.getByRole('button',{name:'Send',exact:true}).click();
          if(method==='RefusedAfterHeaders'){
            await page.getByRole('tablist',{name:'gRPC response tabs',exact:true}).getByRole('tab',{name:'Metadata',exact:true}).click();
            await page.getByText('x-owned-before-reset',{exact:true}).waitFor();
            await fixture.releaseRefusedHeaders();
          }
          await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id)&&row.connectionState==='closed'),'Refused completion '+method,15000);
          const response=(await invoke('load_workspace')).history.find((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id));
          assert.equal(response.status,code);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='status').length,1);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='message').length,code?0:1);
          if(code)assert.equal(response.statusText,'Stream refused by server');
          const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,expected);
          const text=Buffer.from('owned request'),payload=Buffer.concat([Buffer.from([10,text.length]),text]),frame=Buffer.concat([Buffer.from([0,0,0,0,payload.length]),payload]);
          for(const r of reached){assert.deepEqual(r.bodyBytes,[...frame]);assert.equal(r.fingerprint,fixture.client.fingerprint);}
          const attempts=fixture.grpcEvents.filter(e=>e.event==='grpc-refused-attempt'&&e.method===method);assert.deepEqual(attempts.map(e=>e.previous),Array(expected).fill(null));
          if(method==='RefusedAfterHeaders')assert.ok(response.headers.some((/** @type {any} */row)=>row[0]==='x-owned-before-reset'&&row[1]==='observed'));
          await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();
          assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+expected);
          cases.push({id:method,response,requests:reached,reload:true,attempts:expected,headersObserved:method==='RefusedAfterHeaders'});
        }
        if(initialOnly) for(const [method,raw] of [['InitialPadded','007'],['InitialDuplicate','0, 7'],['InitialInvalid','not-a-status']]) {
          await page.getByRole('button',{name:'Load methods',exact:true}).click();
          await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
          const before=await invoke('load_workspace'),count=fixture.grpcRequests.length;
          await page.getByRole('button',{name:'Send',exact:true}).click();
          await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id)&&row.connectionState==='closed'),'Initial-status completion');
          const response=(await invoke('load_workspace')).history.find((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id));
          assert.equal(response.status,0);assert.equal(response.statusText,'');
          const terminal=response.events.filter((/** @type {any} */e)=>e.kind==='status');assert.equal(terminal.length,1);assert.equal(terminal[0].code,0);
          assert.ok(response.headers.some((/** @type {any} */row)=>row[0]==='grpc-status'&&row[1]===raw));
          assert.ok(response.headers.some((/** @type {any} */row)=>row[0]==='grpc-message'&&row[1]==='initial%20%25'));
          assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='metadata').length,1);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='error').length,0);
          const received=response.events.filter((/** @type {any} */e)=>e.kind==='message');assert.equal(received.length,1);assert.deepEqual(JSON.parse(received[0].text),{name:message});
          assert.deepEqual(response.trailers,[['owned-trailer','complete']]);
          await page.locator('.grpc-message').filter({hasText:message}).waitFor();
          const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,1);assert.equal(reached[0].url,'/owned.Sample/'+method);assert.equal(reached[0].fingerprint,fixture.client.fingerprint);assert.deepEqual(reached[0].bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);
          await poll(async()=>fixture.grpcEvents.some(e=>e.event==='grpc-malformed-response'&&e.method===method),'Initial peer headers');
          const peer=fixture.grpcEvents.find(e=>e.event==='grpc-malformed-response'&&e.method===method);assert.equal(peer?.initialEndStream,false);assert.equal(peer?.terminalStatus,'0');
          await page.reload();await page.locator('.grpc-message').filter({hasText:message}).waitFor();assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+1);
          cases.push({id:method,response,requests:reached,peer,reload:true,rawStatus:raw});
        }
        if(duplicatesOnly&&!initialOnly) for(const method of ['DuplicateHeaders','DuplicateTrailers']) {
          await page.getByRole('button',{name:'Load methods',exact:true}).click();
          await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
          const before=await invoke('load_workspace'),count=fixture.grpcRequests.length;
          await page.getByRole('button',{name:'Send',exact:true}).click();
          await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id)&&row.connectionState==='closed'),'Duplicate-header terminal');
          const response=(await invoke('load_workspace')).history.find((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id));
          assert.equal(response.status,null);assert.equal(response.statusText,'duplicate first, duplicate second');
          assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='message').length,0);
          const terminal=response.events.filter((/** @type {any} */e)=>e.kind==='status');assert.equal(terminal.length,1);assert.equal(terminal[0].code,null);assert.equal(terminal[0].details,response.statusText);
          assert.equal(response.events.find((/** @type {any} */e)=>e.kind==='error').message,'NaN undefined: duplicate first, duplicate second');
          const expected=[['x-result','first, second'],['cookie','a=1; b=2'],['set-cookie','a=1'],['set-cookie','b=2'],['authorization','first'],['proof-bin','AP8='],['proof-bin','AA==']];
          for(const rows of method==='DuplicateTrailers'?[response.headers,response.trailers]:[response.trailers]){
            for(const row of expected)assert.ok(rows.some((/** @type {any} */actual)=>actual[0]===row[0]&&actual[1]===row[1]),JSON.stringify(row));
            assert.ok(!rows.some((/** @type {any} */row)=>row[0]==='x-prefix'||row[1]==='discarded'));
          }
          assert.deepEqual(response.trailers.filter((/** @type {any} */row)=>row[0]==='grpc-status-details-bin'),[['grpc-status-details-bin','AP8A']]);
          const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,1);assert.equal(reached[0].url,'/owned.Sample/'+method);assert.equal(reached[0].fingerprint,fixture.client.fingerprint);assert.deepEqual(reached[0].bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);
          await poll(async()=>fixture.grpcEvents.some(e=>e.event==='grpc-malformed-response'&&e.method===method),'Duplicate peer headers');
          const peer=fixture.grpcEvents.find(e=>e.event==='grpc-malformed-response'&&e.method===method);assert.deepEqual(peer?.statusRaw,['0','7']);
          await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+1);
          cases.push({id:method,response,requests:reached,peer,reload:true});
        }
        if (policyOnly) {
          await setTls(fixture.ca,'owned-policy.test',fixture.client.identity);
          assert.ok(fixture.grpc.policyUrl);
          const url=page.getByRole('textbox',{name:'gRPC server URL',exact:true});
          await url.fill(fixture.grpc.policyUrl);await url.blur();
          if(orcaOnly){
            if(orcaWeights){
              await page.getByRole('button',{name:'Load methods',exact:true}).click();
              await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/RetryOnce · Unary'});
              const recovery=['blackout-exit','expiry-refresh'].includes(orcaWeights),attemptsPerRpc=recovery?3:2;
              const samples=[];const count=fixture.grpcEvents.length,requestStart=fixture.grpcRequests.length;
              for(let index=0;index<32;index++){
                const previous=(await invoke('load_workspace')).history[0]?._id;
                const at=fixture.grpcEvents.length,requestAt=fixture.grpcRequests.length;
                await page.getByRole('button',{name:'Send',exact:true}).click();
                await poll(async()=>{const row=(await invoke('load_workspace')).history[0];return row&&row._id!==previous&&row.connectionState==='closed';},'Weighted routing RPC completed');
                await page.getByRole('button',{name:'Send',exact:true}).waitFor();
                const response=(await invoke('load_workspace')).history[0];assert.equal(response.status,0);assert.deepEqual(response.events.filter((/** @type {any} */e)=>e.kind==='message').map((/** @type {any} */e)=>JSON.parse(e.text)),[{name:message}]);assert.deepEqual(response.events.filter((/** @type {any} */e)=>e.kind==='status').map((/** @type {any} */e)=>e.code),[0]);
                const attempts=fixture.grpcEvents.slice(at).filter(e=>e.event==='grpc-policy-attempt'&&e.method==='RetryOnce');assert.equal(attempts.length,attemptsPerRpc);assert.deepEqual(attempts.map(e=>e.previous),recovery?[null,'1','2']:[null,'1']);assert.ok(attempts[1].atMillis-attempts[0].atMillis>=(orcaWeights==='expiry-refresh'?750:orcaWeights==='swap'?550:350));
                const requests=fixture.grpcRequests.slice(requestAt);assert.equal(requests.length,attemptsPerRpc);for(const r of requests){assert.equal(r.fingerprint,fixture.client.fingerprint);assert.deepEqual(r.bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);}
                const backoff=fixture.grpcEvents.slice(at).filter(e=>e.event==='grpc-policy-backoff');assert.deepEqual(backoff.map(e=>e.milliseconds),orcaWeights==='blackout-exit'?[400,800]:orcaWeights==='expiry-refresh'?[800,600]:[orcaWeights==='swap'?600:400]);
                const reports=fixture.grpcEvents.slice(at).filter(e=>e.event==='grpc-orca-report');
                if(orcaWeights==='swap')for(const endpoint of ['127.0.0.1','127.0.0.2']){
                  const updates=reports.filter(e=>e.endpoint===endpoint);assert.equal(updates.length,2);assert.deepEqual(updates.map(e=>e.phase),[0,1]);assert.equal(updates[0].attempt,updates[1].attempt,'Both reports use the same OOB subscription');
                  assert.ok(updates[1].atMillis-updates[0].atMillis>=190);assert.ok(updates[1].atMillis<attempts[1].atMillis,'Updated report precedes retry dispatch');
                  assert.deepEqual(updates.map(e=>Buffer.from(e.reportBytes).readDoubleLE(15)),endpoint==='127.0.0.2'?[0.05,0.5]:[0.5,0.05]);
                }
                if(orcaNumeric){
                  assert.equal(reports.length,3);
                  for(const endpoint of ['127.0.0.1','127.0.0.2']){
                    const updates=reports.filter(e=>e.endpoint===endpoint);assert.equal(updates.length,endpoint==='127.0.0.2'?2:1);assert.deepEqual(updates.map(e=>e.phase),endpoint==='127.0.0.2'?[0,1]:[0]);
                    for(const report of updates){const bytes=Buffer.from(report.reportBytes);assert.equal(bytes.length,23);assert.deepEqual([...bytes.subarray(0,6)],[0,0,0,0,18,49]);assert.equal(bytes[14],73);assert.equal(report.fingerprint,fixture.client.fingerprint);
                      const qps=bytes.readDoubleLE(6),utilization=bytes.readDoubleLE(15),updated=report.phase===1;
                      assert.equal(qps,updated?(orcaWeights==='number-zero'?0:orcaWeights==='number-infinity'?Infinity:orcaWeights==='number-negative'?-100:100):100);
                      if(updated&&orcaWeights==='number-nan')assert.ok(Number.isNaN(utilization));else assert.equal(utilization,endpoint==='127.0.0.2'?0.05:0.5);
                    }
                    if(endpoint==='127.0.0.2'){assert.equal(updates[0].attempt,updates[1].attempt,'Numeric update stays on the same OOB stream');assert.ok(updates[1].atMillis-updates[0].atMillis>=190);assert.ok(updates[1].atMillis<attempts[1].atMillis,'Numeric update arrives before retry');}
                  }
                }
                if(['blackout','expiry','penalty','penalty0','wiretype','gzip','deflate'].includes(orcaWeights)){
                  assert.equal(reports.length,2);
                  for(const endpoint of ['127.0.0.1','127.0.0.2']){
                    const report=reports.find(e=>e.endpoint===endpoint);assert.ok(report,'Report from '+endpoint);assert.equal(report.phase,0);assert.equal(report.fingerprint,fixture.client.fingerprint);
                    const frame=Buffer.from(report.reportBytes),compressed=['gzip','deflate'].includes(orcaWeights),penalty=orcaWeights.startsWith('penalty');
                    assert.equal(frame[0],compressed?1:0);assert.equal(frame.readUInt32BE(1),frame.length-5);
                    if(compressed){assert.equal(report.encoding,orcaWeights);assert.ok(report.acceptEncoding.split(',').map((/** @type {string} */x)=>x.trim()).includes(orcaWeights),'ORCA client advertises negotiated encoding');}
                    const payload=compressed?(orcaWeights==='gzip'?gunzipSync(frame.subarray(5)):inflateSync(frame.subarray(5))):frame.subarray(5);
                    const bytes=Buffer.concat([Buffer.from([0,0,0,0,payload.length]),payload]);assert.equal(bytes.length,penalty?32:23);assert.equal(bytes.readUInt32BE(1),penalty?27:18);assert.equal(bytes[5],orcaWeights==='wiretype'?48:49);assert.equal(bytes.readDoubleLE(6),100);assert.equal(bytes[penalty?23:14],orcaWeights==='wiretype'?72:73);assert.equal(bytes.readDoubleLE(penalty?24:15),endpoint==='127.0.0.2'?0.05:0.5);
                    if(penalty){assert.equal(bytes[14],57);assert.equal(bytes.readDoubleLE(15),endpoint==='127.0.0.2'?10000:0);}
                    const age=attempts[1].atMillis-report.atMillis;assert.ok(age>=0);if(orcaWeights==='blackout')assert.ok(age<1000,'Retry during1s blackout');if(orcaWeights==='expiry')assert.ok(age>=100,'Retry after100ms expiration');
                  }
                }
                if(recovery)for(const endpoint of ['127.0.0.1','127.0.0.2']){
                  const updates=reports.filter(e=>e.endpoint===endpoint);assert.equal(updates.length,orcaWeights==='expiry-refresh'?2:1);assert.deepEqual(updates.map(e=>e.phase),orcaWeights==='expiry-refresh'?[0,1]:[0]);
                  for(const report of updates){const bytes=Buffer.from(report.reportBytes);assert.equal(bytes.length,23);assert.equal(bytes.readUInt32BE(1),18);assert.equal(bytes[5],49);assert.equal(bytes.readDoubleLE(6),100);assert.equal(bytes[14],73);assert.equal(bytes.readDoubleLE(15),endpoint==='127.0.0.2'?0.05:0.5);assert.equal(report.fingerprint,fixture.client.fingerprint);}
                  const first=updates[0],last=updates[updates.length-1];
                  if(orcaWeights==='blackout-exit'){assert.ok(attempts[1].atMillis-first.atMillis<1000);assert.ok(attempts[2].atMillis-first.atMillis>=1000);}
                  else{assert.equal(first.attempt,last.attempt);assert.ok(attempts[1].atMillis-first.atMillis>=500);assert.ok(last.atMillis>attempts[1].atMillis);assert.ok(last.atMillis<attempts[2].atMillis);assert.ok(attempts[2].atMillis-last.atMillis<500);}
                }
                samples.push({index,attempts,response,requests,reports});
              }
              const reports=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-report');
              const high=samples.filter(x=>x.attempts[attemptsPerRpc-1].endpoint==='127.0.0.2').length,earlyHigh=samples.filter(x=>x.attempts[1].endpoint==='127.0.0.2').length;
              await Bun.write(join(output,'orca-routing-observations.json'),JSON.stringify({mode:orcaWeights,high,earlyHigh,total:samples.length,samples,reports,events:fixture.grpcEvents.slice(count),dns:fixture.dnsQueries},null,2));
              if(orcaNumeric){assert.equal(reports.length,96);if(['number-nan','number-negative'].includes(orcaWeights))assert.ok(high<=8,'Nonpositive/NaN weight must use fallback period: '+high+'/32');else assert.ok(high>=24,'Zero retains last-good weight; Infinity retains zero-period dominance: '+high+'/32');}
              else if(recovery){assert.equal(reports.length,orcaWeights==='expiry-refresh'?128:64);assert.ok(earlyHigh>=6&&earlyHigh<=26,'Early retry must ignore blackout/stale weights: '+earlyHigh+'/32');assert.ok(high>=24,'Later retry must admit valid weights: '+high+'/32');}
              else if(['blackout','expiry','penalty','penalty0','wiretype','gzip','deflate'].includes(orcaWeights)){
                assert.equal(reports.length,64);
                if(['gzip','deflate'].includes(orcaWeights))assert.ok(high>=24,'Compressed ORCA reports must retain endpoint2 load weight: '+high+'/32');
                else if(orcaWeights==='wiretype')assert.ok(high>=24,'Pinned decoder accepts scalar wire-type tags; endpoint2 must retain its load weight: '+high+'/32');
                else if(orcaWeights==='penalty')assert.ok(high<=8,'EPS penalty must demote endpoint2: '+high+'/32');
                else if(orcaWeights==='penalty0')assert.ok(high>=24,'Zero penalty must preserve utilization weight: '+high+'/32');
                else assert.ok(high>=6&&high<=26,'Blackout/expired weights must fall back to unweighted selection: '+high+'/32');
              }else if(orcaWeights==='swap'){
                assert.equal(reports.length,128);assert.ok(high<=8,'Live reversed 10:1 weights must favor endpoint1: endpoint2='+high+'/32');
                for(const r of reports){assert.equal(r.fingerprint,fixture.client.fingerprint);assert.equal(Buffer.from(r.reportBytes).readDoubleLE(6),100);}
              }else if(orcaWeights==='weighted'){
                for(const endpoint of ['127.0.0.1','127.0.0.2']){const report=reports.find(e=>e.endpoint===endpoint);assert.ok(report,'Load report from '+endpoint);assert.equal(Buffer.from(report.reportBytes).readDoubleLE(6),100);assert.equal(Buffer.from(report.reportBytes).readDoubleLE(15),endpoint==='127.0.0.2'?0.05:0.5);assert.equal(report.fingerprint,fixture.client.fingerprint);}
                assert.ok(high>=24,'Decoded 10:1 load weights must favor endpoint2: '+high+'/32');
              }else{assert.equal(reports.length,0);assert.ok(high>=6&&high<=26,'Unweighted control must exercise both endpoints: '+high+'/32');}
              const saved=await invoke('load_workspace'),attemptCount=fixture.grpcEvents.filter(e=>e.event==='grpc-policy-attempt').length;
              await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();await Bun.sleep(350);assert.deepEqual((await invoke('load_workspace')).history,saved.history);assert.equal(fixture.grpcRequests.length,requestStart+32*attemptsPerRpc);assert.equal(fixture.grpcEvents.filter(e=>e.event==='grpc-policy-attempt').length,attemptCount);
              await Bun.write(join(output,'orca-routing-acceptance.json'),JSON.stringify({passed:true,renderingMode:'native-hidden',mode:orcaWeights,high,earlyHigh,total:32,attemptsPerRpc,reload:true,quietMs:350,limits:'Bounded two-endpoint retry selection after real OOB fixed64 reports; stochastic counts, not exact distribution/all weight/race/platform acceptance'},null,2));return;
            }
            /** @type {any} */ let malformedReference=null;
            if(['malformed-proto','malformed-gzip','partial-gzip','members-gzip','limit-gzip-exact','limit-gzip-over','limit-frame-over'].includes(orcaError)){
              const require=createRequire(import.meta.url),grpcReference=require('../../artifacts/grpc-reflection-reference/node_modules/@grpc/grpc-js'),orca=require('../../artifacts/grpc-reflection-reference/node_modules/@grpc/grpc-js/build/src/orca.js');
              const descriptorClient=orca.createOrcaClient(/** @type {any} */({close(){}})),deserialize=(/** @type {any} */(descriptorClient.constructor)).service.StreamCoreMetrics.responseDeserialize;descriptorClient.close();
              const client=new grpcReference.Client(new URL(fixture.grpc.url).host,grpcReference.credentials.createSsl(Buffer.from(fixture.ca),Buffer.from(fixture.client.key),Buffer.from(fixture.client.certificate)),{'grpc.ssl_target_name_override':'localhost'});
              try{const metadata=new grpcReference.Metadata();metadata.set('x-owned-orca-reference','1');
                malformedReference=await new Promise((resolve)=>{const values=/** @type {any[]} */([]);const stream=client.makeServerStreamRequest('/xds.service.orca.v3.OpenRcaService/StreamCoreMetrics',(/** @type {Buffer} */v)=>v,deserialize,Buffer.from([10,5,16,128,132,175,95]),metadata,{deadline:new Date(Date.now()+5000)});stream.on('data',(/** @type {any} */v)=>values.push(v));stream.on('error',()=>{});stream.on('status',(/** @type {any} */status)=>resolve({code:status.code,details:status.details,values}));});
              }finally{client.close();}
              await Bun.write(join(output,'orca-malformed-reference.json'),JSON.stringify({mode:orcaError,runtime:'Bun '+Bun.version,version:require('../../artifacts/grpc-reflection-reference/node_modules/@grpc/grpc-js/package.json').version,result:malformedReference},null,2));
              const boundary=orcaError.startsWith('limit-')||orcaError==='members-gzip';
              if(boundary){assert.equal(malformedReference.code,['limit-gzip-over','limit-frame-over'].includes(orcaError)?8:0);assert.equal(malformedReference.values.length,malformedReference.code===0?1:0);if(malformedReference.code===0){assert.equal(malformedReference.values[0].rps_fractional,100);assert.equal(malformedReference.values[0].application_utilization,0.5);}}
              else{assert.ok([12,13].includes(malformedReference.code),'Reference must settle with peer or parser failure');assert.deepEqual(malformedReference.values,[]);}
            }
            const count=fixture.grpcEvents.length;
            const requestStart=fixture.grpcRequests.length;
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:orcaError||orcaInterval?'/Sample/Hold · Server streaming':'/Sample/Echo · Unary'});
            const before=await invoke('load_workspace');
            await page.getByRole('button',{name:'Send',exact:true}).click();
            if(orcaError||orcaInterval)await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-open'&&e.url==='/owned.Sample/Hold'),'Held foreground RPC active');
            else await poll(async()=>{const data=await invoke('load_workspace');return data.history.length>before.history.length&&data.history[0]?.status===0;},'Weighted OOB Echo success');
            if(orcaInterval){
              await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-goaway'),'Peer graceful GOAWAY');
              if(process.env.INSOMNIUM_GRPC_ORCA_GOAWAY_ONLY==='1'){
                await Bun.sleep(650);
                const current=await invoke('load_workspace'),fresh=current.history.filter((/** @type {any} */ row)=>!before.history.some((/** @type {any} */ old)=>old._id===row._id));
                const cancelVisible=await page.getByRole('button',{name:'Cancel',exact:true}).isVisible();
                await Bun.write(join(output,'goaway-state.json'),JSON.stringify({cancelVisible,fresh,events:fixture.grpcEvents.slice(count),dns:fixture.dnsQueries},null,2));
                assert.equal(cancelVisible,true,'Graceful GOAWAY must preserve active foreground RPC');
                await poll(async()=>fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt').length>=2,'OOB subscription reconnect after graceful GOAWAY',5000);
                await page.getByRole('button',{name:'Cancel',exact:true}).click();return;
              }

              await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-attempt'&&e.nanos===400000000),'Live interval400ms subscription after DNS refresh',45000);
              const attempts=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt');assert.equal(attempts[0].nanos,200000000);
              const latest=attempts[attempts.length-1];assert.ok(latest);assert.equal(latest.nanos,400000000);assert.equal(latest.seconds,0);
              assert.deepEqual(latest.requestBytes,[0,0,0,0,8,10,6,16,128,136,222,190,1]);
              for(const attempt of attempts)assert.equal(attempt.fingerprint,fixture.client.fingerprint);
              assert.ok(fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-close'&&e.nanos===200000000&&e.reset==='Ok(CANCEL)'),'Retired200ms OOB stream cancelled');
              assert.equal(await page.getByRole('button',{name:'Cancel',exact:true}).isVisible(),true,'Foreground Hold survived GOAWAY and config replacement');
              await page.getByRole('button',{name:'Cancel',exact:true}).click();
              await poll(async()=>{const data=await invoke('load_workspace');return data.history.length>before.history.length&&data.history[0]?.connectionState==='closed';},'Interval foreground cancelled');
              await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-close'&&e.attempt===latest.attempt&&e.reset==='Ok(CANCEL)'),'Replacement400ms OOB released before teardown');
              const saved=await invoke('load_workspace'),response=saved.history[0];assert.equal(response.status,1);
              const requests=fixture.grpcRequests.slice(requestStart);assert.equal(requests.length,1);assert.equal(requests[0].url,'/owned.Sample/Hold');assert.equal(requests[0].fingerprint,fixture.client.fingerprint);assert.deepEqual(requests[0].bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);
              await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();await Bun.sleep(350);
              assert.deepEqual((await invoke('load_workspace')).history,saved.history);assert.equal(fixture.grpcRequests.length,requestStart+1,'Reload must not resend');assert.equal(fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt').length,attempts.length,'No retired subscription after reload');
              await Bun.write(join(output,'orca-interval-acceptance.json'),JSON.stringify({passed:true,renderingMode:'native-hidden',attempts,events:fixture.grpcEvents.slice(count),dns:fixture.dnsQueries,response,requests,reload:true,quietMs:350,limits:'Single endpoint controlled DNS200→400ms OOB replacement, surviving foreground, explicit Cancel and reload; no decoded weight/distribution or full platform/lifecycle claim'},null,2));return;
            }
            if(orcaError){
              await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-attempt'),'Owned OOB error request');
              if(orcaError==='backoff-cancel'||orcaError==='live-cancel'){
                if(orcaError==='live-cancel')await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-report'),'Metrics stream alive before Cancel');
                const attemptsBefore=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt');assert.equal(attemptsBefore.length,1);assert.equal(attemptsBefore[0].status,orcaError==='backoff-cancel'?'14':null);
                for(const attempt of attemptsBefore){assert.equal(attempt.fingerprint,fixture.client.fingerprint);assert.deepEqual(attempt.requestBytes,[0,0,0,0,7,10,5,16,128,132,175,95]);}
                await page.getByRole('button',{name:'Cancel',exact:true}).click();
                await poll(async()=>{const data=await invoke('load_workspace');return data.history.length>before.history.length&&data.history[0]?.connectionState==='closed';},'Foreground lifecycle cancellation');
                await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-cancelled'&&e.url==='/owned.Sample/Hold'&&e.reason==='CANCEL'),'Foreground peer CANCEL');
                if(orcaError==='live-cancel')await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-close'&&e.reset==='Ok(CANCEL)'),'OOB stream CANCEL before host teardown');
                const response=(await invoke('load_workspace')).history[0];assert.equal(response.status,1);
                await Bun.sleep(orcaError==='backoff-cancel'?1350:350);
                const attempts=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt');assert.equal(attempts.length,1,'Retired owner must not resubscribe');
                assert.deepEqual((await invoke('load_workspace')).history[0],response,'No late terminal/history change');
                await Bun.write(join(output,'orca-error-acceptance.json'),JSON.stringify({passed:true,renderingMode:'native-hidden',mode:orcaError,attempts,quietMs:orcaError==='backoff-cancel'?1350:350,response,peerEvents:fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-cancelled'||e.event==='grpc-orca-close'),limits:'Explicit UI Cancel while ORCA retry is pending or OOB stream is live; observed before host teardown, not all owner/race/platform behavior'},null,2));return;
              }
              if(malformedReference){
                await Bun.sleep(1350);
                const attempts=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt'),malformed=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-malformed');
                const expected=[0,12].includes(malformedReference.code)?1:2;
                await Bun.write(join(output,'orca-malformed-observations.json'),JSON.stringify({mode:orcaError,reference:malformedReference,attempts,malformed,events:fixture.grpcEvents.slice(count)},null,2));
                assert.equal(attempts.length,expected,'ORCA retry/support branch must match pinned SDK terminal '+malformedReference.code);
                assert.equal(malformed.length,1);const boundary=orcaError.startsWith('limit-')||orcaError==='members-gzip';assert.equal(malformed[0].trailerStatus,boundary?0:12);assert.equal(malformed[0].fingerprint,fixture.client.fingerprint);
                if(boundary){const frame=Buffer.from(malformed[0].reportBytes);if(orcaError==='limit-frame-over'){assert.deepEqual([...frame],[0,0,64,0,1]);assert.match(malformedReference.details,/4194305 vs 4194304/);}else{assert.equal(frame[0],1);assert.equal(frame.readUInt32BE(1),frame.length-5);const decoded=gunzipSync(frame.subarray(5));assert.equal(decoded.length,orcaError==='members-gzip'?18:4194304+Number(orcaError==='limit-gzip-over'));assert.equal(malformed[0].decodedLength,decoded.length);assert.equal(decoded[0],49);assert.equal(decoded.readDoubleLE(1),100);assert.equal(decoded[9],73);assert.equal(decoded.readDoubleLE(10),0.5);if(orcaError==='limit-gzip-over')assert.match(malformedReference.details,/decompresses.*4194304/);}}
                for(const attempt of attempts){assert.equal(attempt.fingerprint,fixture.client.fingerprint);assert.deepEqual(attempt.requestBytes,[0,0,0,0,7,10,5,16,128,132,175,95]);}
                if(expected===2){assert.ok(attempts[1].atMillis-attempts[0].atMillis>=900);assert.ok(attempts[1].atMillis-attempts[0].atMillis<3000);assert.ok(fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-report'));}
                await page.getByRole('button',{name:'Cancel',exact:true}).click();
                await poll(async()=>{const data=await invoke('load_workspace');return data.history.length>before.history.length&&data.history[0]?.connectionState==='closed';},'Held malformed ORCA foreground cancelled');
                const response=(await invoke('load_workspace')).history[0];assert.equal(response.status,1);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='status').length,1);
                const saved=await invoke('load_workspace');await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();await Bun.sleep(350);assert.deepEqual((await invoke('load_workspace')).history,saved.history);assert.equal(fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt').length,expected);
                await Bun.write(join(output,'orca-malformed-acceptance.json'),JSON.stringify({passed:true,mode:orcaError,renderingMode:'native-hidden',reference:malformedReference,attempts,malformed,quietMs:1350,reload:true,afterReloadQuietMs:350,response},null,2));return;
              }
              if(orcaError==='unavailable')await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-report'),'OOB retry after backoff',5000);
              else await Bun.sleep(1350);
              const attempts=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-attempt');assert.equal(attempts.length,orcaError==='unavailable'?2:1);
              assert.equal(attempts[0].status,orcaError==='unavailable'?'14':orcaError==='unimplemented'?'12':'1');
              for(const attempt of attempts){assert.equal(attempt.fingerprint,fixture.client.fingerprint);assert.deepEqual(attempt.requestBytes,[0,0,0,0,7,10,5,16,128,132,175,95]);}
              const gapMs=attempts.length===2?attempts[1].atMillis-attempts[0].atMillis:null;
              if(gapMs!==null){assert.ok(gapMs>=900&&gapMs<3000,'Initial ORCA1000ms retry backoff');assert.equal(attempts[1].status,null);}
              await page.getByRole('button',{name:'Cancel',exact:true}).click();
              await poll(async()=>{const data=await invoke('load_workspace');return data.history.length>before.history.length&&data.history[0]?.connectionState==='closed';},'Held ORCA foreground Cancel complete');
              const response=(await invoke('load_workspace')).history[0];assert.equal(response.status,1);
              await Bun.write(join(output,'orca-error-acceptance.json'),JSON.stringify({passed:true,renderingMode:'native-hidden',mode:orcaError,attempts,gapMs,quietMs:orcaError==='unavailable'?0:1350,response,limits:'Owned initial OOB error/backoff/no-timer handling; not later update triggers, interval changes, multi-endpoint weight distribution or all lifecycle/platform behavior'},null,2));return;
            }
            await poll(async()=>fixture.grpcEvents.slice(count).some(e=>e.event==='grpc-orca-report'),'Authenticated OOB ORCA report');
            const reports=fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-report');
            assert.equal(reports.length,1);assert.equal(reports[0].seconds,0);assert.equal(reports[0].nanos,200000000);assert.equal(reports[0].fingerprint,fixture.client.fingerprint);
            assert.deepEqual(reports[0].requestBytes,[0,0,0,0,7,10,5,16,128,132,175,95]);
            const saved=await invoke('load_workspace'),response=saved.history[0];assert.equal(response.status,0);
            await Bun.sleep(450);assert.equal(fixture.grpcEvents.slice(count).filter(e=>e.event==='grpc-orca-report').length,1,'Held metrics stream must remain single');
            await Bun.write(join(output,'orca-acceptance.json'),JSON.stringify({passed:true,renderingMode:'native-hidden',reports,response,limits:'One authenticated weighted OOB subscription/report and Echo; not multi-endpoint weight distribution or all lifecycle/provider/platform behavior'},null,2));return;
          }
          if(outlierOnly) {
            const require=createRequire(import.meta.url);
            const grpc=require('../../artifacts/grpc-reflection-reference/node_modules/@grpc/grpc-js');
            const meta=require('../../artifacts/grpc-reflection-reference/node_modules/@grpc/grpc-js/package.json');assert.equal(meta.version,'1.14.4');
            const reference=[];
            for(const enforcement of outlierRecoveryOnly?[100]:[0,100]){
              const method=outlierRecoveryOnly?'OutlierReferenceRecovery':'OutlierReference'+(enforcement?'Enabled':'Disabled'),count=fixture.grpcRequests.length,connections=fixture.grpcConnections.count;
              const client=new grpc.Client(new URL(fixture.grpc.url).host,grpc.credentials.createSsl(Buffer.from(fixture.ca),Buffer.from(fixture.client.key),Buffer.from(fixture.client.certificate)),{'grpc.ssl_target_name_override':'localhost','grpc.service_config':JSON.stringify(grpcOutlierConfig(enforcement))});
              try{
                const text=Buffer.from('owned request'),payload=Buffer.concat([Buffer.from([10,text.length]),text]);
                const result=await new Promise(resolve=>client.makeUnaryRequest('/owned.Sample/'+method,(/** @type {Buffer} */value)=>value,(/** @type {Buffer} */value)=>value,payload,new grpc.Metadata(),{deadline:new Date(Date.now()+5000)},(/** @type {any} */error,/** @type {Buffer|undefined} */value)=>resolve({code:error?.code??0,details:error?.details??'',valueHex:value?.toString('hex')??null})));
                await Bun.write(join(output,'outlier-reference-progress.json'),JSON.stringify({method,result},null,2));
                await poll(async()=>fixture.grpcEvents.some(e=>e.event==='grpc-policy-attempt'&&e.method===method),'Reference attempts '+JSON.stringify(result),2000);
                const attempts=fixture.grpcEvents.filter(e=>e.event==='grpc-policy-attempt'&&e.method===method),requests=fixture.grpcRequests.slice(count);
                reference.push({enforcement,method,result,attempts,requests,connections:fixture.grpcConnections.count-connections,gapMs:attempts.length===2?attempts[1].atMillis-attempts[0].atMillis:null});
              }finally{client.close();}
            }
            await Bun.write(join(output,'outlier-reference.json'),JSON.stringify({version:meta.version,runtime:'Bun '+Bun.version,scope:'Actual pinned grpc-js client against the same owned mTLS peer, explicit matching service config',cases:reference},null,2));
            if(outlierRecoveryOnly){
              assert.equal(reference[0].result.code,0);assert.equal(reference[0].attempts.length,2);assert.equal(reference[0].connections,1);assert.ok(reference[0].gapMs!==null&&reference[0].gapMs>=1500&&reference[0].gapMs<3000,'Reference readmission after1600ms pushback');
            }else{
            assert.equal(reference[0].result.code,0);assert.equal(reference[0].attempts.length,2);assert.ok(reference[0].gapMs!==null&&reference[0].gapMs>=350&&reference[0].gapMs<1000,'Reference disabled follows400ms pushback');
            assert.ok(reference[1].result.code!==0||(reference[1].gapMs!==null&&reference[1].gapMs>=1000),'Reference enforcement must affect routing');
            }
            for(const expected of reference){
              const method=outlierRecoveryOnly?'OutlierRecovery':'Outlier'+(expected.enforcement?'Enabled':'Disabled');
              await page.getByRole('tablist',{name:'gRPC request editor',exact:true}).getByRole('tab',{name:'Settings',exact:true}).click();
              const deadline=page.getByRole('spinbutton',{name:'Call deadline (ms, 0 = none)',exact:true});await deadline.fill('5000');await deadline.blur();
              await poll(async()=> (await invoke('load_workspace')).resources.find((/** @type {any} */row)=>row._id===requestId)?.grpcDeadlineMs===5000,'Outlier deadline persisted');
              await page.getByRole('button',{name:'Load methods',exact:true}).click();await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
              const before=await invoke('load_workspace'),count=fixture.grpcRequests.length,connections=fixture.grpcConnections.count;
              await page.getByRole('button',{name:'Send',exact:true}).click();
              await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id)&&row.connectionState==='closed'),'Outlier native completion',10000);
              const response=(await invoke('load_workspace')).history.find((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id));
              assert.equal(response.status,expected.result.code);assert.equal(response.statusText,expected.result.details);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='status').length,1);
              const reached=fixture.grpcRequests.slice(count),attempts=fixture.grpcEvents.filter(e=>e.event==='grpc-policy-attempt'&&e.method===method);assert.equal(reached.length,expected.requests.length);assert.equal(attempts.length,expected.attempts.length);
              const gapMs=attempts.length===2?attempts[1].atMillis-attempts[0].atMillis:null;
              if(gapMs!==null)assert.ok(outlierRecoveryOnly?gapMs>=1500&&gapMs<3000:expected.enforcement?gapMs>=1000:gapMs>=350&&gapMs<1000,'Native ejection/pushback gap '+gapMs);
              if(outlierRecoveryOnly)assert.equal(fixture.grpcConnections.count-connections,1,'Re-admitted attempt reuses its TLS connection');
              for(const row of reached){assert.equal(row.url,'/owned.Sample/'+method);assert.equal(row.fingerprint,fixture.client.fingerprint);assert.deepEqual(row.bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);}
              assert.deepEqual(attempts.map(e=>e.previous),expected.attempts.map(e=>e.previous));
              const received=response.events.filter((/** @type {any} */e)=>e.kind==='message');assert.equal(received.length,expected.result.code===0?1:0);if(received.length)assert.deepEqual(JSON.parse(received[0].text),{name:message});
              await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+reached.length);
              cases.push({id:method,enforcement:expected.enforcement,response,requests:reached,attempts,gapMs,connections:fixture.grpcConnections.count-connections,reload:true});
            }
            assert.deepEqual(fixture.dnsQueries.filter(q=>q.type===16).map(q=>q.enforcementPercentage),outlierRecoveryOnly?[100]:[0,100]);
          }
          for (const method of (outlierOnly || resolverHoldOnly || policyDeadlineOnly || deadlineOnly || policyCancelOnly || budgetOnly || throttleOnly) ? [] : statusNamesOnly ? ['RetryAscii','RetryUnicode','HedgeAscii','HedgeUnicode'] : ['RetryOnce','HedgeOnce']) {
            const unicode=statusNamesOnly&&method.endsWith('Unicode'),expected=unicode?1:2;
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
            const before=await invoke('load_workspace'),count=fixture.grpcRequests.length;
            await page.getByRole('button',{name:'Send',exact:true}).click();
            await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */ row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */ old)=>old._id===row._id)&&row.connectionState==='closed'),'Policy completion '+method,15000);
            const response=(await invoke('load_workspace')).history.find((/** @type {any} */ row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */ old)=>old._id===row._id));
            assert.equal(response.status,unicode?14:0);assert.equal(response.events.filter((/** @type {any} */ e)=>e.kind==='message').length,unicode?0:1);
            const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,expected,'Configured attempts '+method);
            assert.ok(reached.every(row=>row.url==='/owned.Sample/'+method&&row.fingerprint===fixture.client.fingerprint));
            const text=Buffer.from('owned request'),payload=Buffer.concat([Buffer.from([10,text.length]),text]);
            const frame=Buffer.concat([Buffer.from([0,0,0,0,payload.length]),payload]);
            for(const row of reached)assert.deepEqual(row.bodyBytes,[...frame]);
            const attempts=fixture.grpcEvents.filter(e=>e.event==='grpc-policy-attempt'&&e.method===method);
            assert.deepEqual(attempts.map(e=>({attempt:e.attempt,previous:e.previous})),[{attempt:1,previous:null},{attempt:2,previous:'1'}].slice(0,expected));
            assert.equal(response.events.filter((/** @type {any} */ e)=>e.kind==='status').length,1);
            if(!unicode)assert.deepEqual(JSON.parse(response.events.find((/** @type {any} */ e)=>e.kind==='message').text),{name:message});
            if(statusNamesOnly)await page.waitForTimeout(550);
            await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();
            assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */ row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+expected);
            if(method==='HedgeOnce')await poll(async()=>fixture.grpcEvents.some(e=>e.event==='grpc-policy-cancel'&&e.reason==='CANCEL'),'Losing hedge reset');
            cases.push({id:method,success:!unicode,response,requests:reached,reload:true,...(statusNamesOnly?{configuredStatus:unicode?'unavaılable':'uNaVaIlAbLe',quietMs:550}:{})});
          }
          if(resolverHoldOnly) for(const mode of ['cancel','explicit','method']) {
            const early=mode!=='method',explicitMs=mode==='explicit'?650:0;
            await page.getByRole('tablist',{name:'gRPC request editor',exact:true}).getByRole('tab',{name:'Settings',exact:true}).click();
            const deadline=page.getByRole('spinbutton',{name:'Call deadline (ms, 0 = none)',exact:true});await deadline.fill(String(explicitMs));await deadline.blur();
            await poll(async()=> (await invoke('load_workspace')).resources.find((/** @type {any} */r)=>r._id===requestId)?.grpcDeadlineMs===explicitMs,'Resolver deadline persisted');
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/RetryCancel · Unary'});
            const before=await invoke('load_workspace'),count=fixture.grpcRequests.length,connections=fixture.grpcConnections.count,dnsBefore=fixture.dnsQueries.length,started=Date.now();
            await page.getByRole('button',{name:'Send',exact:true}).click();
            await poll(async()=>{const q=fixture.dnsQueries.slice(dnsBefore);return q.some(row=>row.type===16&&row.sentAt)&&q.some(row=>row.type===1);},'Owned pending TXT/address resolution');
            if(mode==='cancel')await page.getByRole('button',{name:'Cancel',exact:true}).click();
            await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */r)=>r.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===r._id)&&r.connectionState==='closed'),'Resolution terminal');
            const terminalAt=Date.now(),elapsedMs=terminalAt-started,response=(await invoke('load_workspace')).history.find((/** @type {any} */r)=>r.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===r._id));
            assert.equal(response.status,mode==='cancel'?1:4);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='status').length,1);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='message').length,0);
            assert.ok(early?elapsedMs<1500:elapsedMs>=2100&&elapsedMs<4000,'Resolution/deadline ordering '+mode+' '+elapsedMs);
            await page.waitForTimeout(1800);const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,early?0:1,'No late RPC after DNS address');assert.equal(fixture.grpcConnections.count,connections+(early?0:1),'Owned TLS connections');
            const queries=fixture.dnsQueries.slice(dnsBefore),held=queries.filter(q=>q.type===1);assert.ok(held.length);for(const q of held){assert.ok(q.receivedAt&&q.sentAt&&q.sentAt-q.receivedAt>=1490&&!q.sendError,'Actual held A reply');if(early)assert.ok(q.sentAt>terminalAt,'Address after terminal');}
            if(!early){assert.ok(held[0].sentAt&&terminalAt-held[0].sentAt>=600,'Method budget starts after address');const wire=/^(\d{1,8})([HMSmun])$/.exec(reached[0].timeout);assert.ok(wire);const units=/** @type {Record<string,number>} */({H:3600000,M:60000,S:1000,m:1,u:0.001,n:0.000001});const ms=Number(wire[1])*units[wire[2]];assert.ok(ms>500&&ms<=650);assert.equal(reached[0].fingerprint,fixture.client.fingerprint);assert.deepEqual(reached[0].bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);}
            await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */r)=>r._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+(early?0:1));
            cases.push({id:'resolver-'+mode,response,explicitMs,elapsedMs,terminalAt,quietMs:1800,dnsQueries:queries,requests:reached,connections:early?0:1,reload:true});
          }
          if(deadlineOnly) for(const [method,explicitMs,minMs,maxMs] of /** @type {[string,number,number,number][]} */ ([['DeadlineObject',0,650,800],['DeadlineString',0,850,1000],['DeadlineEarlier',600,300,600]])) {
            await page.getByRole('tablist',{name:'gRPC request editor',exact:true}).getByRole('tab',{name:'Settings',exact:true}).click();
            const deadline=page.getByRole('spinbutton',{name:'Call deadline (ms, 0 = none)',exact:true});
            await deadline.fill(String(explicitMs));await deadline.blur();
            await poll(async()=> (await invoke('load_workspace')).resources.find((/** @type {any} */r)=>r._id===requestId)?.grpcDeadlineMs===explicitMs,'Deadline setting persisted');
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
            const before=await invoke('load_workspace'),count=fixture.grpcRequests.length,started=Date.now();
            await page.getByRole('button',{name:'Send',exact:true}).click();
            await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */r)=>r.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===r._id)&&r.connectionState==='closed'),'Deadline terminal '+method,15000);
            const response=(await invoke('load_workspace')).history.find((/** @type {any} */r)=>r.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===r._id));
            assert.equal(response.status,4);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='status').length,1);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='message').length,0);
            const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,1);assert.equal(reached[0].url,'/owned.Sample/'+method);assert.equal(reached[0].fingerprint,fixture.client.fingerprint);
            const text=Buffer.from('owned request');assert.deepEqual(reached[0].bodyBytes,[0,0,0,0,text.length+2,10,text.length,...text]);
            const timeout=/^(\d{1,8})([HMSmun])$/.exec(reached[0].timeout);assert.ok(timeout,'Wire grpc-timeout present');
            const factor=/** @type {Record<string,number>} */({H:3600000,M:60000,S:1000,m:1,u:0.001,n:0.000001});const wireMs=Number(timeout[1])*factor[timeout[2]];
            assert.ok(wireMs>=minMs&&wireMs<=maxMs,method+' wire deadline '+wireMs);
            await poll(async()=>fixture.grpcEvents.some(e=>e.event==='grpc-cancelled'&&e.url==='/owned.Sample/'+method&&e.reason==='CANCEL'),'Deadline resets owned peer '+method);
            const elapsedMs=Date.now()-started;assert.ok(elapsedMs>=minMs&&elapsedMs<5000,'Bounded deadline completion '+elapsedMs);
            await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();
            assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */r)=>r._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+1);
            cases.push({id:method,explicitMs,wireMs,elapsedMs,response,requests:reached,reload:true});
          }
          if(throttleOnly) for(const [method,code,expected] of /** @type {[string,number,number][]} */ (throttleResetOnly ? [['ThrottleScaleSeed',14,1],['ThrottleScaleUp',14,3],['ThrottleScaleDown',14,2]] : throttleResizeOnly ? [['ThrottleScaleSeed',14,1],['ThrottleScaleUp',14,2],['ThrottleScaleDown',14,1]] : [['ThrottleDrain',14,2],['ThrottleBlocked',14,1],['ThrottleRecover',0,1],['ThrottleRetry',0,2]])) {
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
            const before=await invoke('load_workspace'),count=fixture.grpcRequests.length;
            await page.getByRole('button',{name:'Send',exact:true}).click();
            await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id)&&row.connectionState==='closed'),'Throttle completion '+method,15000);
            const response=(await invoke('load_workspace')).history.find((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id));
            assert.equal(response.status,code);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='status').length,1);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='message').length,code?0:1);
            if(code)assert.equal(response.statusText,'owned throttle failure');
            const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,expected,'Throttle attempt admission '+method);
            const text=Buffer.from('owned request'),payload=Buffer.concat([Buffer.from([10,text.length]),text]),frame=Buffer.concat([Buffer.from([0,0,0,0,payload.length]),payload]);
            for(const r of reached){assert.deepEqual(r.bodyBytes,[...frame]);assert.equal(r.fingerprint,fixture.client.fingerprint);}
            const attempts=fixture.grpcEvents.filter(e=>e.event==='grpc-throttle-attempt'&&e.method===method);assert.deepEqual(attempts.map(e=>e.previous),Array.from({length:expected},(_,i)=>i?String(i):null));
            await page.reload();await page.getByRole('button',{name:'Load methods',exact:true}).waitFor();
            assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+expected);
            cases.push({id:method,response,requests:reached,reload:true,attempts:expected});
          }
          if (budgetOnly) for (const [method,offset] of /** @type {[string,number][]} */ (emptyBudgetOnly ? [['BudgetEmptyExact',0],['BudgetEmptyOver',1]] : [['BudgetExact',0],['BudgetOver',1]])) {
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · '+(emptyBudgetOnly?'Client streaming':'Unary')});
            const name='A'.repeat(1048576-9+offset-(emptyBudgetOnly?5:0)),body=JSON.stringify({name});
            await page.locator('.CodeMirror').first().evaluate((el,value)=>{/** @type {any} */(el).CodeMirror.setValue(value);},body);
            await poll(async()=> (await invoke('load_workspace')).resources.find((/** @type {any} */r)=>r._id===requestId)?.body?.text===body,'Budget input persisted');
            const text=Buffer.from(name),varint=[];let size=text.length;do{const byte=size%128;size=Math.floor(size/128);varint.push(byte|(size?128:0));}while(size);
            const payload=Buffer.concat([Buffer.from([10,...varint]),text]),header=Buffer.alloc(5);header.writeUInt32BE(payload.length,1);
            const frame=Buffer.concat([header,payload,...(emptyBudgetOnly?[Buffer.alloc(5)]:[])]),sha=new Bun.CryptoHasher('sha256').update(frame).digest('hex');assert.equal(frame.length,1048576+offset);
            const before=await invoke('load_workspace'),count=fixture.grpcRequests.length,expected=offset?1:2;
            await page.getByRole('button',{name:emptyBudgetOnly?'Connect':'Send',exact:true}).click();
            if(emptyBudgetOnly){
              const send=page.getByRole('button',{name:'Send message',exact:true});
              await send.click();
              await poll(async()=>send.isEnabled(),'First stream message admitted');
              await page.locator('.CodeMirror').first().evaluate(el=>{/** @type {any} */(el).CodeMirror.setValue('{}');});
              await poll(async()=> (await invoke('load_workspace')).resources.find((/** @type {any} */r)=>r._id===requestId)?.body?.text==='{}','Empty stream message persisted');
              await send.click();await poll(async()=>send.isEnabled(),'Empty message admitted');
              await page.getByRole('button',{name:'Commit',exact:true}).click();
            }
            await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id)&&row.connectionState==='closed'),'Budget request completion '+method,15000);
            const response=(await invoke('load_workspace')).history.find((/** @type {any} */row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */old)=>old._id===row._id));
            assert.equal(response.status,offset?14:0);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='status').length,1);assert.equal(response.events.filter((/** @type {any} */e)=>e.kind==='message').length,offset?0:1);
            const reached=fixture.grpcRequests.slice(count);assert.equal(reached.length,expected);
            for(const r of reached){assert.equal(r.wireLength,frame.length);assert.equal(r.wireSHA256,sha);assert.deepEqual(r.frameHeader,[...header]);assert.equal(r.fingerprint,fixture.client.fingerprint);}
            const attempts=fixture.grpcEvents.filter(e=>e.event==='grpc-policy-attempt'&&e.method===method);assert.deepEqual(attempts.map(e=>e.previous),offset?[null]:[null,'1']);
            await page.reload();await page.getByRole('button',{name:emptyBudgetOnly?'Load methods':'Send',exact:true}).waitFor();
            assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+expected);
            cases.push({id:method,response,requests:reached,reload:true,emptyMessage:emptyBudgetOnly,wireLength:frame.length,wireSHA256:sha,attempts:expected});
          }
          if (policyCancelOnly || policyDeadlineOnly) for (const method of ['RetryCancel','HedgeCancel']) {
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
            const before=await invoke('load_workspace'),count=fixture.grpcRequests.length,expected=method==='RetryCancel'?1:2;
            await page.getByRole('button',{name:'Send',exact:true}).click();
            await poll(async()=>fixture.grpcRequests.filter(r=>r.url==='/owned.Sample/'+method).length===expected,'Owned active policy '+method);
            if(method==='RetryCancel')await poll(async()=>fixture.grpcEvents.some(e=>e.event==='grpc-policy-backoff'&&e.method===method),'Retry pushback received by peer');
            const cancelledAt=policyDeadlineOnly?undefined:Date.now();
            if(!policyDeadlineOnly)await page.getByRole('button',{name:'Cancel',exact:true}).click();
            await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */ row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */ old)=>old._id===row._id)&&row.connectionState==='closed'),'Cancelled policy terminal '+method);
            await page.getByRole('button',{name:'Send',exact:true}).waitFor();
            if(method==='HedgeCancel')await poll(async()=>fixture.grpcEvents.filter(e=>e.event==='grpc-policy-cancel'&&e.method===method&&e.reason==='CANCEL').length===2,'Both hedge peers cancelled');
            const quietMs=method==='RetryCancel'?900:500;
            await page.waitForTimeout(quietMs);assert.equal(fixture.grpcRequests.length,count+expected,'No attempt after cancellation timer '+method);
            const response=(await invoke('load_workspace')).history.find((/** @type {any} */ row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */ old)=>old._id===row._id));
            assert.equal(response.status,policyDeadlineOnly?4:1);assert.equal(response.events.filter((/** @type {any} */ e)=>e.kind==='status').length,1);
            assert.equal(response.events.filter((/** @type {any} */ e)=>e.kind==='message').length,0);
            const reached=fixture.grpcRequests.slice(count),text=Buffer.from('owned request'),payload=Buffer.concat([Buffer.from([10,text.length]),text]),frame=Buffer.concat([Buffer.from([0,0,0,0,payload.length]),payload]);
            for(const row of reached){assert.deepEqual(row.bodyBytes,[...frame]);assert.equal(row.fingerprint,fixture.client.fingerprint);}
            await page.reload();await page.getByRole('button',{name:'Send',exact:true}).waitFor();
            assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */ row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,count+expected);
            const wireBudgets=policyDeadlineOnly?reached.map(row=>{const value=/^(\d{1,8})([HMSmun])$/.exec(row.timeout);assert.ok(value,'Policy wire timeout');const units=/** @type {Record<string,number>} */({H:3600000,M:60000,S:1000,m:1,u:0.001,n:0.000001});return Number(value[1])*units[value[2]];}):[];
            if(policyDeadlineOnly){assert.ok(wireBudgets[0]>500&&wireBudgets[0]<=650,'First method budget');if(expected===2)assert.ok(wireBudgets[1]>0&&wireBudgets[1]<350&&wireBudgets[1]<wireBudgets[0]-250,'Hedge retains original deadline');}
            cases.push({id:method,cancelled:!policyDeadlineOnly,expired:policyDeadlineOnly,response,requests:reached,reload:true,cancelledAt,quietMs,wireBudgets});
          }
          if(throttleResizeOnly&&!throttleResetOnly)assert.deepEqual(fixture.dnsQueries.filter(q=>q.type===16).map(q=>({maxTokens:q.maxTokens,tokenRatio:q.tokenRatio})),[{maxTokens:4,tokenRatio:1},{maxTokens:8,tokenRatio:1},{maxTokens:4,tokenRatio:1}]);
          if(throttleResetOnly)assert.deepEqual(fixture.dnsQueries.filter(q=>q.type===16).map(q=>({present:q.throttlePresent,maxTokens:q.maxTokens})),[{present:true,maxTokens:4},{present:false,maxTokens:undefined},{present:true,maxTokens:4}]);
          assert.ok(fixture.dnsQueries.some(q=>q.type===16));assert.ok(fixture.dnsQueries.some(q=>q.type===1));
        }
        if (!validationDisabled && !policyOnly && !refusedOnly && !streamOnly) {
          // Extend the existing native transport scenario; preserve every TLS,
          // reflection and stream case and use the same owned mTLS peer.
          for (const [method, code, details] of /** @type {[string,number|null|undefined,string|undefined][]} */ ([
            ['GzipExact',0,''],['GzipExactOver',8,'Received message that decompresses to a size larger than 20971520'],['GzipMembers',0,''],['GzipCorrupt',13,'Failed to decompress gzip-encoded message'],['GzipTruncated',13,'Failed to decompress gzip-encoded message'],['GzipJunk',13,'Failed to decompress gzip-encoded message'],['GzipOverflow',8,'Received message that decompresses to a size larger than 20971520'],['GzipZeros',0,''],['GzipZeroJunk',0,''],['GzipZeroMember',0,''],
            ['CodecMissing',undefined,undefined],
            ['CodecIdentity',undefined,undefined],
            ['CodecUnknown',undefined,undefined],
            ['Number17',17,'owned number status'],
            ['NumberNegative',-1,'owned number status'],
            ['NumberFraction',7.5,'owned number status'],
            ['NumberNaN',null,'owned number status'],
            ['NumberInfinity',null,'owned number status'],
            ['NumberNegativeInfinity',null,'owned number status'],
            ['NumberHex',17,'owned number status'],
            ['NumberExponent',100,'owned number status'],
            ['PartialMissing',7,'owned partial denied'],
            ['PartialIdentity',7,'owned partial denied'],
            ['PartialUnknown',7,'owned partial denied'],
            ['BadGzip',13,'Failed to decompress gzip-encoded message'],
            ['BadDeflate',13,'Failed to decompress deflate-encoded message'],
            ['Oversized',8,'Received message larger than max (20971521 vs 20971520)'],
            ['Oversized503',14,'Received HTTP status code 503'],
            ['DecodedOverflow',8,'Received message that decompresses to a size larger than 20971520'],
          ])) {
            if (duplicatesOnly) continue;
            if (method.startsWith('Gzip') !== gzipMembersOnly) continue;
            if (gzipMembersOnly && method.startsWith('GzipExact') !== gzipExactOnly) continue;
            if (gzipTransferOnly && method!=='GzipExact') continue;
            if (overflowOnly && method !== 'DecodedOverflow') continue;
            if (partialOnly && !method.startsWith('Partial')) continue;
            if (numberOnly && !gzipMembersOnly && !method.startsWith('Number')) continue;
            if (codecOnly && !method.startsWith('Codec')) continue;
            const successfulGzip=gzipMembersOnly&&code===0;
            const exactText=method==='GzipExact'?'owned exact start '+ 'x'.repeat(20*1024*1024-11-18-16)+' owned exact end':'';
            const displayDetails=method==='GzipExact'?'owned exact start':successfulGzip?(method==='GzipMembers'?'gzip tail':message):details ?? 'undefined undefined: undefined';
            await page.getByRole('button',{name:'Load methods',exact:true}).click();
            await page.getByRole('combobox',{name:'gRPC method',exact:true}).selectOption({label:'/Sample/'+method+' · Unary'});
            const before=await invoke('load_workspace'), peerCount=fixture.grpcRequests.length;
            await page.getByRole('button',{name:'Send',exact:true}).click();
            await poll(async()=> (await invoke('load_workspace')).history.some((/** @type {any} */ row)=>row.requestId===requestId&&!before.history.some((/** @type {any} */ old)=>old._id===row._id)&&['closed','error'].includes(row.connectionState)), 'Malformed response settled '+method);
            await page.getByRole('button',{name:'Send',exact:true}).waitFor();
            const after=await invoke('load_workspace');
            const fresh=after.history.filter((/** @type {any} */ row)=>!before.history.some((/** @type {any} */ old)=>old._id===row._id));assert.equal(fresh.length,1);
            const response=fresh[0];assert.equal(response.status,code);
            const statuses=response.events.filter((/** @type {any} */ event)=>event.kind==='status');assert.equal(statuses.length,1);assert.equal(statuses[0].code,code);assert.equal(statuses[0].details,details);
            assert.equal(response.events.filter((/** @type {any} */ event)=>event.kind==='message').length,successfulGzip?1:0);
            assert.ok(response.headers.every((/** @type {[string,string]} */ row)=>!['grpc-encoding','grpc-accept-encoding'].includes(row[0])));
            const reached=fixture.grpcRequests.slice(peerCount);assert.equal(reached.length,1);assert.equal(reached[0].url,'/owned.Sample/'+method);assert.equal(reached[0].fingerprint,fixture.client.fingerprint);
            await poll(async()=>fixture.grpcEvents.some(event=>event.event==='grpc-malformed-response'&&event.method===method),'Malformed peer bytes '+method);
            const peer=fixture.grpcEvents.find(event=>event.event==='grpc-malformed-response'&&event.method===method);
            assert.ok(peer);
            if(gzipMembersOnly){
              const frame=Buffer.from(peer.bytes);assert.equal(frame[0],1);assert.equal(frame.readUInt32BE(1),frame.length-5);
              const raw=(/** @type {string} */value)=>{const text=Buffer.from(value);return Buffer.concat([Buffer.from([10,text.length]),text]);};
              if(method.startsWith('GzipExact')){const decoded=gunzipSync(frame.subarray(5));assert.equal(decoded.length,20*1024*1024+(method==='GzipExactOver'?1:0));assert.equal(decoded[0],10);if(successfulGzip){const text=JSON.parse(response.events.find((/** @type {any} */e)=>e.kind==='message').text).name;assert.equal(text,exactText);assert.equal(Buffer.byteLength(text),20*1024*1024-11);assert.equal(Buffer.byteLength(response.events.find((/** @type {any} */e)=>e.kind==='message').text),20*1024*1024);}}
              else if(successfulGzip){const expected=method==='GzipMembers'?Buffer.concat([raw(message),raw('gzip tail')]):raw(message);assert.deepEqual(gunzipSync(frame.subarray(5)),expected);assert.deepEqual(JSON.parse(response.events.find((/** @type {any} */e)=>e.kind==='message').text),{name:displayDetails});}
              else if(method==='GzipOverflow')assert.equal(gunzipSync(frame.subarray(5)).length,20*1024*1024+raw(message).length);
              else assert.throws(()=>gunzipSync(frame.subarray(5)));
              assert.deepEqual(reached[0].bodyBytes,[0,0,0,0,15,10,13,...Buffer.from('owned request')]);
            } else if (method === 'DecodedOverflow') {
              const frame=Buffer.from(peer.bytes);assert.equal(frame[0],1);assert.equal(frame.readUInt32BE(1),frame.length-5);assert.ok(frame.length<20971520);
              const decoded=gunzipSync(frame.subarray(5));assert.equal(decoded.length,20971521);assert.ok(decoded.every(byte=>byte===0));
            } else if (method.startsWith('Codec')) {
              assert.deepEqual(peer.bytes,[1,0,0,0,1,0]);
              assert.equal(Object.hasOwn(response,'status'),false);assert.equal(Object.hasOwn(response,'statusText'),false);
              assert.equal(Object.hasOwn(statuses[0],'code'),false);assert.equal(Object.hasOwn(statuses[0],'details'),false);
              assert.deepEqual(statuses[0].trailers,[]);
              assert.equal(response.events.find((/** @type {any} */ event)=>event.kind==='error')?.message,displayDetails);
            } else if (method.startsWith('Number')) {
              const expectedWire=({'Number17':'17','NumberNegative':'-1','NumberFraction':'7.5','NumberNaN':'NaN','NumberInfinity':'Infinity','NumberNegativeInfinity':'-Infinity','NumberHex':'0x11','NumberExponent':'1e2'})[method];
              assert.equal(peer.status,expectedWire);assert.deepEqual(peer.bytes,[]);
              assert.ok(statuses[0].trailers.some((/** @type {any} */ row)=>row[0]==='x-number'&&row[1]==='kept'));
              const callback=String(Number(expectedWire))+' undefined: '+details;
              assert.equal(response.events.find((/** @type {any} */ event)=>event.kind==='error')?.message,callback);
            } else if (method.startsWith('Partial')) {
              assert.deepEqual(peer.bytes,[1,0,0,0,7,10]);
              assert.ok(statuses[0].trailers.some((/** @type {any} */ row)=>row[0]==='x-partial'&&row[1]==='kept'));
            } else assert.deepEqual(peer.bytes,method.startsWith('Oversized')?[1,1,64,0,1]:[1,0,0,0,8,...Array(8).fill(255)]);
            const transfers=/** @type {Array<Record<string,any>>} */([]);
            const transferFull=async (/** @type {string} */ phase)=>{
              if(!gzipTransferOnly)return;
              const text=response.events.find((/** @type {any} */e)=>e.kind==='message').text;
              const expectedBytes=Buffer.byteLength(text),expectedHash=new Bun.CryptoHasher('sha256').update(text).digest('hex');
              const protection=createClipboardPreserver(),failures=/** @type {unknown[]} */([]);
              let captured=false,lease=/** @type {any} */(undefined),snapshot,observation,restoration,ownedReceipt;
              try{
                snapshot=protection.capture();captured=true;protection.assertUnchanged();
                lease=await invoke('begin_plugin_clipboard_probe',{expectedSequence:protection.sequence(),maxTextBytes:expectedBytes});
                assert.equal(lease.mutations,0);assert.equal(lease.maxTextBytes,expectedBytes);
                await page.getByRole('button',{name:'Copy gRPC message',exact:true}).click();
                await poll(async()=>{const r=await invoke('get_plugin_clipboard_probe',{token:lease.token});assert.equal(r.error,null);return r.mutations===1;},'Complete gRPC Copy receipt',120000);
                observation=await page.evaluate(async()=>{const value=await /** @type {any} */(window).__TAURI_INTERNALS__.invoke('plugin:clipboard-manager|read_text');const data=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',data);return{bytes:data.length,sha256:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')};});
                assert.equal(observation.bytes,expectedBytes);assert.equal(observation.sha256,expectedHash);
              }catch(error){failures.push(error);}finally{
                if(lease){try{const r=await invoke('get_plugin_clipboard_probe',{token:lease.token});protection.adoptOwnedReceipt(r,pid);ownedReceipt={sequence:r.sequence,owner:r.owner,mutations:r.mutations,maxTextBytes:r.maxTextBytes,error:r.error};}catch(error){failures.push(error);}try{await invoke('end_plugin_clipboard_probe',{token:lease.token});}catch(error){failures.push(error);}}
                if(captured){try{restoration=protection.restore();}catch(error){failures.push(error);}}
                try{protection.dispose();}catch(error){failures.push(error);}
                await Bun.write(join(output,phase+'-clipboard.json'),JSON.stringify({phase,expectedBytes,expectedHash,snapshot,observation,ownedReceipt,restoration,passed:!failures.length,errors:failures.map(String),plaintextLogged:false},null,2));
              }
              if(failures.length)throw new AggregateError(failures,'gRPC full Copy/restoration failed');
              const path=join(output,phase+'-grpc-response.json');
              const saving=respondToOwnedSaveDialog(pid,output,path);
              try{await page.getByRole('button',{name:'Save response',exact:true}).click();}finally{await saving;}
              let saved=/** @type {any} */(undefined);
              const expectedExport=Buffer.byteLength(JSON.stringify(response,null,2));
              await poll(async()=>{try{const file=Bun.file(path);if(!await file.exists()||file.size<expectedExport)return false;saved=await file.json();return true;}catch(error){const code=/** @type {NodeJS.ErrnoException} */(error).code;if(code==='EBUSY'||code==='ENOENT')return false;throw error;}},'Complete gRPC Save',120000);
              assert.deepEqual(saved,response);assert.equal(saved.events.find((/** @type {any} */e)=>e.kind==='message').text,text);
              const transfer={phase,copy:observation,restoration,export:{path,bytes:Bun.file(path).size,sha256:new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex')}};
              transfers.push(transfer);await Bun.write(join(output,phase+'-transfer.json'),JSON.stringify(transfer,null,2));
            };
            await page.getByText(displayDetails,{exact:false}).first().waitFor();
            await transferFull('terminal');
            await page.reload();await page.getByRole('button',{name:'Send',exact:true}).waitFor();await page.getByText(displayDetails,{exact:false}).first().waitFor();
            assert.deepEqual((await invoke('load_workspace')).history.find((/** @type {any} */ row)=>row._id===response._id),response);assert.equal(fixture.grpcRequests.length,peerCount+1,'Reload must not resend malformed RPC');
            for(const old of before.history)assert.deepEqual(after.history.find((/** @type {any} */ row)=>row._id===old._id),old);
            await transferFull('reload');
            await page.screenshot({path:join(output,method+'.png')});cases.push({id:method,success:successfulGzip,protocolError:!successfulGzip,response,requests:reached,reload:true,...(gzipTransferOnly?{transfers}:{})});
          }
        }
        let streaming = /** @type {Array<Record<string,any>>} */ ([]);
        if (!validationDisabled && !overflowOnly && !partialOnly && !numberOnly && !codecOnly && !policyOnly && !refusedOnly) {
          await certificateSettings(page, invoke, {
            pfx: fixture.identityFiles.pfx,
            password: fixture.identityFiles.password,
            caFile: fixture.caFiles.trusted,
          });
          await setTls(fixture.otherCa, "127.0.0.1", "");
          streaming = await grpcStreamCertificate(
            { page, invoke, output },
            fixture,
            requestId,
          );
          await certificateSettings(page, invoke, { disabled: true });
          await setTls(fixture.ca, "127.0.0.1", fixture.client.identity);
        }
        const reflection = (streamOnly || overflowOnly || partialOnly || numberOnly || codecOnly || policyOnly || refusedOnly) ? [] : await grpcReflectionCertificate(
          { page, invoke, output },
          fixture,
          requestId,
        );
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              passed: true,
              validateCertificates: !validationDisabled,
              checks: [
                "independent mandatory-mTLS HTTP2 check",
                ...cases.map((c) => c.id),
                "full response reload without resend",
                ...streaming.map((c) => c.id),
                ...reflection.map((c) => c.id),
              ],
              independent,
              cases,
              streaming,
              reflection,
              limits: streamOnly ? "Focused one trusted unary baseline and seven existing server/client/bidi commit/cancel/reconnect scenarios after admission cancellation fix. Retained-receiver backpressure is established by Rust regression, not direct native queue introspection. No full TLS/reflection/platform/migration replay." : gzipTransferOnly ? "Focused20MiB gRPC full Copy/Save before and after reload with complete clipboard/profile restoration, exact persisted export and no resend. No full transfer/platform/lifecycle claim." : gzipExactOnly ? "Focused valid protobuf at decoded20MiB and one-byte-over gzip: exact full body, status, authenticated request, history and reload/no resend; not full size/codec/platform acceptance." : gzipMembersOnly ? "Focused gzip concatenated members, corrupt/truncated later member, junk, zero padding/termination and aggregate decoded overflow: exact peer frames, body/status/error and durable reload; no full compression/platform claim." : outlierRecoveryOnly ? "Focused enforced single-endpoint ejection expiry: retry after1600ms/1s ejection succeeds on the same TLS connection, pinned client comparison, exact frames and durable reload. Prior400ms fail-fast control retained; not full timer/multiplier/multi-endpoint/ORCA/platform acceptance." : outlierOnly ? "Focused owned DNS outlier enforcement0/100 against actual pinned grpc-js reference, peer attempts/timing, metadata/body/status and durable reload. Multiple endpoints, live config changes, ORCA and full policy/platform scope remain open." : initialOnly ? "Focused non-END_STREAM initial status raw padded/duplicate/invalid strings remain metadata, final OK controls unary body/status, exact frames and durable reload. Outlier/ORCA live routing/ejection is not inferred." : duplicatesOnly ? "Focused duplicate HTTP2 headers/trailers coalesce before metadata admission: NaN status, decoded joined message, cookies/text/binary/single-value headers, exact frames and history/reload. No full policy/provider/platform claim." : statusNamesOnly ? "Focused ASCII mixed-case and dotless-i status validation versus retry/hedging matching: attempts2/1, exact frames, single terminal and history/reload/no late attempts; not full policy/platform acceptance." : resolverHoldOnly ? "Focused TXT-before-held-address ordering: Cancel/explicit deadline before A produce no late TLS/RPC; method deadline starts after address publication. Exact wire/terminal/history/reload; not NOT_STARTED readiness-grant or held OS resolver acceptance." : policyDeadlineOnly ? "Focused shared method deadline expiry during800ms retry pushback and two active400ms hedges; decreasing wire budgets, peer CANCEL, quiet timer window, durable status4/reload; not full race/platform acceptance." : deadlineOnly ? "Focused owned DNS TXT object/string method deadlines and earlier explicit call deadline, wire timeout/frame, peer CANCEL, single terminal and durable reload; extreme calendar, reflection, retry races and platforms remain open." : throttleResetOnly ? "Focused same-target throttle removal/re-addition over three owned DNS TXT revisions, attempts1/3/2 prove unthrottled middle call and fresh final bucket, exact frames/metadata and durable reload; in-flight updates and full throttle scope remain open." : throttleResizeOnly ? "Focused between-RPC DNS TXT throttle replacement maxTokens4/8/4 with proportional carryover, negative pushback seed, exact peer attempts and durable reload; not live in-flight config update acceptance." : throttleOnly ? "Focused shared-target DNS TXT retry throttling: exhaustion, blocked retry, successful token recovery and retry re-admission; exact frames/attempt metadata and durable reload, no full throttle/race/platform claim." : refusedOnly ? "Focused default transparent REFUSED_STREAM: one replay, second refusal terminal, no replay after UI-observed initial metadata; exact peer frames/attempt metadata, durable reload/no resend. No configured-policy/full matrix claim." : emptyBudgetOnly ? "Focused two-message client-stream replay boundary: empty protobuf frame contributes5bytes, exact aggregate1MiB retries and +1 commits; exact peer hash, durable sent/response history and reload/no resend. No unrelated budget matrix replay." : budgetOnly ? "Focused exact 1MiB and 1MiB+1 framed replay admission through native UI/IPC/DNS TXT, peer length/hash, attempt count and durable reload; trusted baseline only." : policyCancelOnly ? "Focused cancel during retry pushback and two concurrent open hedges: exact peer frames, CANCEL resets, single durable CANCELLED status, timer expiry without extra attempts and reload/no resend; trusted baseline only." : policyOnly ? "Focused DNS TXT configured pre-header retry and concurrent hedging with mTLS, owned loopback DNS, durable history/reload and losing hedge cancellation; no full policy/migration claim." : codecOnly ? "Focused complete compressed frames with missing/identity/unknown encoding omit code/details through native UI/history/reload and preserve exact undefined callback; one trusted unary baseline, no full matrix replay." : numberOnly ? "Focused eight grpc-status Number-domain values through native UI/history/reload with exact callbacks and independent peer wire strings; one trusted unary baseline. No full matrix replay or full migration claim." : partialOnly ? "Focused incomplete flag1 frames with missing/identity/unknown encoding preserve peer trailers7 through native UI, history and reload. One trusted unary baseline; no full matrix replay. Complete codec Error-domain parity remains open." : overflowOnly ? "Focused decoded gzip overflow through actual native UI/IPC with one trusted-client baseline; independent peer decompression proves20MiB+1. Existing99case receipt remains separate; no full matrix rerun." : validationDisabled
                ? "Focused existing missing-identity/malformed-CA call and reflection controls with global validation disabled, exact peer client fingerprint/protobuf response and reload/profile restoration. Default full trusted-mode cases remain unchanged; explicit request overrides, other TLS variants, deadline/platform/provider acceptance are separate gates."
                : "Actual Windows native unary/server/client/bidirectional gRPC and reflection v1/v1alpha fallback through persisted Preferences and UI, HTTP2 ALPN, server-observed peer fingerprint and exact protobuf bytes. Explicit Commit EOF, all three Cancel shapes produce actual RST_STREAM CANCEL, saved response/reconnect observed. Reflection TLS refusals and discovery-to-Send verified. CA-signed hostname/expired/future server refusal and successful recovery verified. No trust-store modification or network TLS-validation bypass; offline OpenSSL no_check_time isolates chain validity only. Arbitrary reflection graphs/errors, provider/proxy/legacy/platform remain separate gates.",
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
          if(!nativeClosed){
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
          }else await Bun.write(join(output,'settings-restored.json'),JSON.stringify({nativeClosed:true,restoration:'Outer complete profile preservation restores original settings after host exit'}));
        } finally {
          await fixture.close();
        }
      }
    },
    {allowNativeClose:!!closeMethod},
  ),
);
