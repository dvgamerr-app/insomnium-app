# UTF-8 text content parameters

Verified, 2026-10-09. Scalar UTF-8 text content parameter coverage, cookie regression and URL signing are accepted on the same frozen production build. Implementation topic b02386b and supporting helper e5b4cbb are committed; STATUS records the verified handoff. Full migration/UX/CSS remains incomplete.

## Behavior

Scalar text/plain content parameters now work in query, header, path and cookie. Legal MIME case and one UTF-8 charset retain their original media string. Existing application UTF-8 behavior for absent charset is preserved. Explicit non-UTF8, malformed/list/duplicate media and text compounds require review; byte encoders and arbitrary media representations remain outstanding.

Nullable editor values use JSON representation, keeping strings, null, false and zero distinct. Text strings serialize without JSON quotes. Nullable null omits query/header/cookie and substitutes an empty path value under the existing omission policy; JSON content still represents JSON null. Nonnullable raw inputs preserve literal null, empty strings and explicitly quoted text. Edited numeric/exponent lexemes remain exact. Query/path encode URI data; header controls and invalid Cookie octets are refused before network activity. Cookie content has no automatic quoting or URI encoding.

New canonical text cookies retain content style and original media metadata. Persisted old text/plain cookie style remains supported; saved resources are not automatically migrated. Shared editor help describes raw versus nullable text encoding. App layout and CSS remain unchanged.

## Official references

- [OpenAPI content parameters](https://spec.openapis.org/oas/v3.2.1.html#fixed-fields-for-use-with-content): selected media representation, separate from schema style expansion.
- [HTTP field values](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5): header character constraints.
- [Cookie syntax](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.1): Cookie octets and explicit quoted values.
- [Playwright locator click](https://playwright.dev/docs/api/class-locator#locator-click) and [actionability](https://playwright.dev/docs/actionability): bounded Import completion with normal actionability checks.

## Accepted verification

- Fresh production release: build1791510352616, finished1791510732643, result0, fixtureHash12278268661298828977, production release profile. Build25432 terminal0; app source remained frozen through native verification. Build record: artifacts/native-recovery-copy-probe/build-state.json.
- Main artifact openapi-content-serialization-1791510748915: handle18882 terminal0/passed; independent-audit.json accepts295 groups:208 generated (52 per3.0.3/3.0.4/3.1.2/3.2.1),19 reviewed refusals,19 disabled-row recovery,4 scalar edits/help,4 exact numeric edits and41 retained JSON/runtime controls. Native37876 exit0/native-hidden/visiblefalse; owned processes/profile and listener52427 released. Four actual light760 parameter images inspected.
- Raw supplement openapi-content-serialization-1791516439448: handle63710 terminal0/passed, started03:27:19.462Z/finished03:41:51.091Z. Independent-audit.json accepts28 groups:16 generated (four raw cases per four versions), plus12 literal-null/empty/quoted edits with help/persistence/reload checks. Native50412 exit0/native-hidden/visiblefalse; scenario5708/owned native/profile process count0, listener58324 count0. All four raw light760 images inspected: complete help and aligned controls.
- Combined295+28 proves323 focused text groups. Generated cases cover all four versions; edit/review/disable runtime controls run once on the last version3.2.1. It does not prove each runtime control per version or unfiltered all-content/native-dark/platform acceptance. The main run loaded the pre-extension52text/118total fixture; its source hashes remain in loaded-source.json. It was neither restarted nor narrowed after adding the raw supplement.
- Current fixture122total/56text. Inline488 generated compositions pass376accepted112refused (text148accepted76refused), including runtime refusal after clearing request-level review. Git488 preserves complete parameter fields. Artifacts: openapi-text-content-inline.json and openapi-text-content-git.json under artifacts/playwright.
- Inline form/cookie regression252 passes201accepted51refused (195form57cookie), including new canonical cookie metadata. Direct48 controls cover compounds with review removed, MIME refusal, nullable versus literal-null, finite/exact numeric lexemes, Unicode URI goldens, header controls and old cookie style. Raw-edit48 comparisons cover four locations × four versions × three raw values. Artifacts: openapi-text-content-regression.json, openapi-text-content-direct.json, openapi-text-content-raw-edits.json.
- Saved design-system final44605 terminal0/passed:78 measured rows,13 per six dark/light1440/900/760 profiles. All four individual text-help dark/light760 row11/12 images inspected. Whole-region images can clip rows through the existing scroll container and are not evidence for unseen content. Shared browser launcher is fixed headless:true; native results use native-hidden.
- Latest bun run check terminal0:0errors0warnings after the URL Import persistence repair; earlier93523 also passed after the raw reload fix. Selected formatting/diff checks passed. Inventory sourceHashbfd7776bb65b7a506d706c6ded5703a158c1266e6063a9732b10ba5ad076c79e,663markup118tokens1719CSS declarations; no CSS change.

## Retained failures and corrections

Artifact1791515042339 failed at Import click15s before API Design/source generation. The owned workspace was persisted/selected, but source count0 proves no raw acceptance. Failure image inspected; native52324 exit0 and owned processes released. Shared generation helper now bounds only Import/dialog completion at60s, verifies the exact owned selected workspace, and scopes source persistence to that parent. No force, repeated click or blanket timeout expansion.

Artifact1791515819305 failed at the next raw Value1 fill15s after reload restored the default Body tab. Failure screenshot showed the selected query request and200 response with Body active. Native47980 exited0 and owned scenario/profile released; that PID was briefly reused by a compiler Bun process. The saved scenario now reselects the request and opens Query/Headers before each raw edit. The full corrected28-group retry supersedes this failure without reducing coverage or changing app source/build.

Initial compiler2 nullable-return errors and9 test-only JSDoc errors were fixed before accepted checks. Inline harness initially used the wrong analyzeSpec argument, omitted defaults and compared Cookie name case; corrected harnesses passed. Older472 inline/Git results (360accepted112refused;text132accepted76refused) are archived as .before-raw.json and are superseded by488. Intermediate headless16849/67741 passed;44605 provides the final individual help images.

URL failures are retained:1791518724482 failed Import click15s before wire acceptance (native44004/listener63816 released);1791518869751 passed Import but failed a redundant baseline click after reload (native51488/listener62767 released);1791519043761 failed the same redundant click in the signed loop after recording partial wire progress (native54068/listener55455 released). All native exits0/native-hidden/visiblefalse and all failure images were inspected. No partial run is treated as53/50 acceptance.

Saved URL Import now bounds only click/dialog completion at60s and checks the exact selected owned workspace/51request persistence. Its shared request selection function asserts method, persisted activeRequestId and rendered active row before/after reload for baseline and every signed case; real selection changes use normal clicks. No force/global timeout or coverage reduction. The older plain-query golden applies only to original cases; new text cases retain their full literal golden and all cryptographic checks. Formatting and compiler0/0 pass.

## Commands and remaining migration gates

Cookie regression22171 is terminal0/passed: artifact openapi-cookie-serialization-1791517344223 independently accepts55 groups:45generated (12/12/21),4edits and6jar/composition. Canonical text metadata assertions run for four cases per version. ownedJarRestored:true; native51412 exit0/native-hidden/visiblefalse; owned process/profile count0 and listener50074 count0.

URL artifact1791519298954/handle77518 is terminal0/passed:53 raw targets,50 independent runtime signature cases and5 retained checks. The independent artifact audit verifies counts, all four text-query targets and modes, and recomputes four OAuth1 HMAC-SHA1/SHA256 signatures from saved owned wire headers; modified messages produce different MACs. Native42636 exit0/native-hidden/visiblefalse; owned processes/profile and fixture listener55826 counts0. Exact start04:14:58.965Z/finish04:35:46.629Z. The four text cases retain Unicode, duplicate key, false and nullable omission goldens. Original signing regressions remain intact.

The URL golden records current ordinary-before-generated query order. This feature does not fix that transport order. Mixed manual/generated row-order preservation is REQUIRED in PARITY, alongside every original full migration gate.

PowerShell commands (run native scenarios sequentially):

    $env:INSOMNIUM_UI_BUILD_STATE="artifacts/native-recovery-copy-probe/build-state.json"
    $env:INSOMNIUM_OPENAPI_VERSIONS="3.0.3,3.0.4,3.1.2,3.2.1"
    $env:INSOMNIUM_OPENAPI_CONTENT_KIND="text" # accepted main fixture revision
    bun tests/ui/openapi-content-serialization.js
    $env:INSOMNIUM_OPENAPI_CONTENT_KIND="raw-text" # accepted supplemental revision
    bun tests/ui/openapi-content-serialization.js
    bun tests/ui/openapi-cookie-serialization.js
    bun tests/ui/url-encoding.js

The current focused text selection alone plans323 groups; raw-text selects28 and skips repeating already accepted41 JSON/46 nullable controls. Retained all|text|raw-text|json selectors and version selection do not replace the default all-content coverage.

Verified work is committed by topic after the final evidence audit; STATUS records commit, proof, remaining gates and no live feature handles. This interface has no callable /compact; provide the committed handoff and explicitly report the limitation before another feature. Every original PLAN/PARITY migration/media/schema/provider/saved-resource/platform/recovery/distribution/UX/CSS gate remains required. Non-UTF8 byte encoding, arbitrary media and text compounds, provider interoperability, saved-resource policy and schema validation remain outstanding. Hoppscotch-inspired redesign follows full migration; this feature preserves the current Insomnium UI.
