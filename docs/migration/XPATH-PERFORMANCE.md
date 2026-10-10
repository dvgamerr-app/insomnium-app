# XPath document ordering performance

Status: correction and scoped native performance/XML/JSON regressions verified (2026-10-10).

Preserved old20458ce2 native baseline49969/artifact1791605011929 exits1 while
native69892 exits0/native-hidden/visible:false. Its first4000sibling //item
selection fails with `Wide XPath failed: Response filter exceeded 3 seconds`.
Independent current-harness/old-executable/failure audit passes. Baseline input
bytes are asserted by the saved native Send helper; no separate failure wire
snapshot or successful baseline4000selection is claimed.

Fresh saved production25226 exits0, started1791605131747/finished1791605608287.
Build binding matches all466application/231scenario paths (697total), retained
old executable and fresh production release SHA256
`6f74492748f828bc4344e435e13b172bd99da100ff104e3ec7cb34ca5e34d8ca`.
Final compiler74025 exits0/0errors0warnings; saved headless workspace11 passes.

Native performance35348/artifact1791605621469 exits0, native67280 exits0/hidden.
Six groups/12real bundled workers/3HTTP Sends pass: ordered4000elements1678.1ms,
attributes1584.6ms, count1882.1ms, reversed union1721.7ms, reverse-axis1506.2ms
and10001flat match-count refusal1774.5ms. These measure UI submission/poll/CDP
completion, not pure evaluator CPU time. Independent literal ordering/full body/
base64/meta/current697source/build/retained baseline failure audit passes.

Current default XML80452/artifact1791605753209 exits0, native62936 exits0/hidden,
with36groups/58real workers/22Sends/six layouts. Current-source/executable,
literal outputs/payload/meta/history/cancellation/deadline/geometry audit passes;
flat10001siblings now hit actual10000-match refusal. Current dark/light760px
images inspected; app layout/CSS preserved. Current JSON62554/
artifact1791606363642 exits0, native54024 exits0/hidden, with26groups/11real
workers/21Sends. Its independent697-source/build/literal body/base64/meta/history/
destination/worker/deadline audit passes. Aggregate cleanup confirms owned
native69892/67280/62936/54024 and all four exact WebView profiles absent; all
feature scenario/build/compiler handles are terminal. Unrelated processes were
not terminated. Formatting and diff checks pass; commit checkpoint is in STATUS.

The prior native XML scenario proved flat10001siblings hit the worker3second
deadline. A Bun diagnostic took84222.954ms before the match-count refusal.
Inspection identifies repeated sibling scans in xmldom compareDocumentPosition,
called by XPath's ordered node-set AVL tree. The new shared selectXmlPath builds
one iterative preorder/subtree index for each immutable parsed document and
uses constant-time comparisons. Attribute order/owner bits match native behavior;
synthetic namespace/foreign nodes use the original method. Every own descriptor
is restored in finally, including parse/evaluation failures. No global prototype,
dependency, timeout, size/match limit or UI/CSS change. Response pane and template
response extraction use the same helper.

Bug regression command: `bun tests/xpath-select.js`. Current296result comparisons,
one matching upstream namespace refusal,14709native-position comparisons,
eleven method/content-restoration fixtures and four template checks pass. Flat
10001element/attribute refusals take about93/102ms under Bun; these are local
diagnostics, not native acceptance.

Saved native command: set `INSOMNIUM_XML_RESPONSE_PERFORMANCE=1`, then
`bun tests/ui/xml-response-filter.js`. The existing scenario delegates to a
feature helper for4000flat siblings: full ordered element/attribute outputs,
scalar count, reversed union and reverse-axis predicate;10001siblings must hit
the match-count limit before the existing3second deadline. Original HTTP response
body/base64/meta remain actual. Preserve old20458ce2 release in
`artifacts/native-xpath-baseline` before `bun tests/ui/build-recovery-copy-probe.js`.
Native baseline failure, fresh source/build binding and performance/default XML
are verified above. Relevant JSON regression and aggregate cleanup also pass.
Template checks are direct Bun regression, not full template Send
integration acceptance.

Source freeze: `bun artifacts/playwright/freeze-xpath-performance.mjs`.
Fresh build binding: `bun artifacts/playwright/bind-xpath-build.mjs`.
Independent native audits:
`bun artifacts/playwright/audit-xpath-performance.mjs artifacts/playwright/xml-response-filter-1791605621469` and
`bun artifacts/playwright/audit-xpath-xml-regression.mjs artifacts/playwright/xml-response-filter-1791605753209`.
Audit JSON lives inside each accepted artifact. Keep current source frozen
until the last native regression is terminal. JSON audit:
`bun artifacts/playwright/audit-xpath-json-regression.mjs artifacts/playwright/json-response-filter-1791606363642`.
Aggregate cleanup: `artifacts/playwright/xpath-performance-cleanup.json`.

Sources consulted: [XPath API](https://github.com/goto100/xpath),
[xmldom](https://github.com/xmldom/xmldom),
[DOM position bits](https://dom.spec.whatwg.org/#dom-node-comparedocumentposition).
Existing parser/XPath dependencies are reused; no generator is needed.

All XPath expressions/tree shapes/namespace mapping UI, template Send integration,
OS/accessibility/provider/platform/streaming and every original migration/shared
UI/UX/CSS requirement remain required. No whole migration or universal performance
claim. Commits by topic and compaction/handoff follow STATUS.
