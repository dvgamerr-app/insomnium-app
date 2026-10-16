/** @typedef {{name:string,code:string,requestId?:string|null}} RunnerTest */
/** @typedef {{name:string,tests:RunnerTest[],suites?:RunnerSuite[]}} RunnerSuite */

/** Validate the complete suite tree before worker submission or VM allocation.
 * @param {RunnerSuite} suite */
export function runnerTestCount(suite) {
  let tests = 0, suites = 0;
  const ancestors = new Set();
  /** @param {RunnerSuite} current @param {number} depth */
  function visit(current, depth) {
    if (!current || typeof current.name !== "string" ||
        !Array.isArray(current.tests) ||
        (current.suites !== undefined && !Array.isArray(current.suites)) ||
        ancestors.has(current) || depth > 32 || ++suites > 1000)
      throw new Error("Invalid runner suite");
    ancestors.add(current);
    for (const test of current.tests) {
      if (!test || typeof test.name !== "string" || typeof test.code !== "string" ||
          (test.requestId != null && typeof test.requestId !== "string") || ++tests > 1000)
        throw new Error("Invalid runner suite");
    }
    for (const child of current.suites || []) visit(child, depth + 1);
    ancestors.delete(current);
  }
  visit(suite, 0);
  return tests;
}
