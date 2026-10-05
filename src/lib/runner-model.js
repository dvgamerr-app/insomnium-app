import { workspaceFor } from "./model.js";
/** @param {Record<string,any>[]} resources @param {string} suiteId @param {string|null} [testId] */
export function runnerSuite(resources, suiteId, testId = null) {
  const suite = resources.find(
    (r) => r._id === suiteId && r._type === "unit_test_suite",
  );
  const collectionId = suite && workspaceFor(resources, suiteId);
  if (!suite || !collectionId) throw new Error("Test suite no longer exists");
  const tests = resources.filter(
    (r) =>
      r._type === "unit_test" &&
      r.parentId === suiteId &&
      (!testId || r._id === testId),
  );
  if (testId && !tests.length)
    throw new Error("Test no longer belongs to this suite");
  return {
    collectionId,
    suiteId,
    testIds: tests.map((t) => t._id),
    suite: {
      name: String(suite.name || "My Suite"),
      tests: tests.map((t) => ({
        name: String(t.name || "My Test"),
        code: String(t.code || ""),
        requestId: t.requestId || null,
      })),
    },
  };
}
/** Match the legacy insomnia.send response contract, including UTF-8 replacement/BOM.
 * @param {Record<string,any>} response */
export function runnerResponse(response) {
  const headers = Object.fromEntries(
    (response.headers || []).map(
      (/** @type {[string,string]} */ [name, value]) => [
        String(name).toLowerCase(),
        String(value || ""),
      ],
    ),
  );
  return {
    status: response.status,
    statusMessage: response.statusText,
    data:
      typeof response.bodyBase64 === "string"
        ? new TextDecoder("utf-8", { ignoreBOM: true }).decode(
            Uint8Array.from(atob(response.bodyBase64), (c) => c.charCodeAt(0)),
          )
        : String(response.body ?? ""),
    headers,
    responseTime: response.elapsedMs,
  };
}
/** Read both historical parent shapes; new records also identify their suite explicitly.
 * @param {Record<string,any>[]} resources @param {string} collectionId @param {string} suiteId */
export function latestRunnerResult(resources, collectionId, suiteId) {
  return (
    resources
      .filter(
        (r) =>
          r._type === "unit_test_result" &&
          (r.parentId === suiteId ||
            (r.parentId === collectionId &&
              (!r.unitTestSuiteId || r.unitTestSuiteId === suiteId))),
      )
      .sort(
        (a, b) =>
          (b.modified || b.created || 0) - (a.modified || a.created || 0),
      )[0] || null
  );
}

/** @param {Record<string,any>[]} resources @param {string} collectionId */
export function selectedRunnerSuite(resources, collectionId) {
  const selected = resources.find(
    (r) => r._type === "workspace_meta" && r.parentId === collectionId,
  )?.activeUnitTestSuiteId;
  const suites = resources.filter(
    (r) => r._type === "unit_test_suite" && r.parentId === collectionId,
  );
  return suites.find((r) => r._id === selected) || suites[0] || null;
}
