import { indexWorkspaces, workspaceFor } from "./model.js";
import { runnerTestCount } from "./runner-suite.js";

/** Resolve preserved script literals within the suite's imported collection.
 * Current collection IDs take precedence; foreign import aliases are never consulted.
 * @param {Record<string,any>[]} resources @param {string} collectionId @param {string} requestId */
export function runnerRequestId(resources, collectionId, requestId) {
  const owners = indexWorkspaces(resources);
  if (resources.some((r) => r._id === requestId && r._type === "request" &&
    owners.get(r._id) === collectionId)) return requestId;
  const matches = resources.filter((r) => r._type === "request" &&
    owners.get(r._id) === collectionId && Array.isArray(r._importRequestIds) &&
    r._importRequestIds.includes(requestId));
  if (matches.length > 1) throw new Error("Imported runner request ID is ambiguous: " + requestId);
  return matches[0]?._id || requestId;
}
/** @param {Record<string,any>[]} resources @param {string} suiteId @param {string|null} [testId] */
export function runnerSuite(resources, suiteId, testId = null) {
  const suite = resources.find(
    (r) => r._id === suiteId && r._type === "unit_test_suite",
  );
  const collectionId = suite && workspaceFor(resources, suiteId);
  if (!suite || !collectionId) throw new Error("Test suite no longer exists");
  /** @type {Record<string,any>[]} */ const tests = [];
  /** @type {{id:string,parentId:string}[]} */ const parents = [];
  const seen = new Set();
  /** @param {Record<string,any>} current @param {number} depth
   * @returns {import('./runner-suite.js').RunnerSuite} */
  function build(current, depth) {
    if (depth > 32 || seen.has(current._id)) throw new Error("Invalid runner suite hierarchy");
    seen.add(current._id);
    parents.push({id:current._id,parentId:current.parentId});
    const suites = resources.filter((r) => r._type === "unit_test_suite" && r.parentId === current._id)
      .map((child) => build(child, depth + 1));
    const ownTests = resources.filter((r) => r._type === "unit_test" &&
      r.parentId === current._id && (!testId || r._id === testId));
    tests.push(...ownTests);
    parents.push(...ownTests.map((test) => ({id:test._id,parentId:test.parentId})));
    return {
      name:String(current.name || "My Suite"),suites,
      tests:ownTests.map((test) => ({name:String(test.name || "My Test"),code:String(test.code || ""),requestId:test.requestId || null})),
    };
  }
  const tree = build(suite,0);
  runnerTestCount(tree);
  if (testId && !tests.length)
    throw new Error("Test no longer belongs to this suite");
  return {
    collectionId,
    suiteId,
    parents,
    testIds: tests.map((t) => t._id),
    suite: tree,
  };
}
/** Match the legacy insomnia.send response contract, including UTF-8 replacement/BOM.
 * @param {Record<string,any>} response */
export function runnerResponse(response) {
  const headers = response.headers?.length ? Object.fromEntries(
    (response.headers || []).map(
      (/** @type {[string,string]} */ [name, value]) => [
        String(name).toLowerCase(),
        String(value || ""),
      ],
    ),
  ) : [];
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
export function runnerSuites(resources, collectionId) {
  if (!collectionId) return [];
  const owners = indexWorkspaces(resources);
  return resources.filter(
    (r) => r._type === "unit_test_suite" && owners.get(r._id) === collectionId,
  );
}

/** @param {Record<string,any>[]} resources @param {string} collectionId */
export function selectedRunnerSuite(resources, collectionId) {
  const selected = resources.find(
    (r) => r._type === "workspace_meta" && r.parentId === collectionId,
  )?.activeUnitTestSuiteId;
  const suites = runnerSuites(resources, collectionId);
  return suites.find((r) => r._id === selected) || suites[0] || null;
}
