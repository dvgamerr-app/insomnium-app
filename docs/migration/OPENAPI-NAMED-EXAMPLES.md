# OpenAPI named example selection

Verified selection scope below; the full original migration and UX/UI/CSS goal
remains active.

API Design exposes named example choices per effective request parameter and
body media type, using shared Field/Select/Toolbar controls. Choices belong to
the document resource, keyed by path, method, additional-operation identity and
parameter location/name (case folded for headers). A request records only its
chosen example provenance. Generation uses shallow copies of the example maps;
shared resolved references and authored source text stay unchanged.

Default behavior still selects the first example under the preferred body MIME.
Changing MIME resets the named choice to that MIME's default. An empty example
name has a distinct encoded option. Unavailable saved choices produce Field
feedback and block generation until corrected or globally reset. The worker
captures preferences and rejects a result if those preferences changed while
generation was pending. Choice metadata is limited to 10000 entries or 1 MiB.

Official documentation consulted before implementation:
[OpenAPI 3.2.1 Example Object](https://spec.openapis.org/oas/v3.2.1.html#example-object),
[Parameter Object](https://spec.openapis.org/oas/v3.2.1.html#parameter-object) and
[Media Type Object](https://spec.openapis.org/oas/v3.2.1.html#media-type-object).
Named Example Objects differ from schema example arrays. The existing
dataValue/value, serializedValue and explicit external asset representation
selectors remain responsible for request representation.

Saved commands and current evidence:

- `bun tests/ui/openapi-named-examples.js`: headless 84 generation/composition/Git
  checks and 28 specific refusal controls. Four versions 3.0.3/3.1.0/3.2.0/3.2.1
  cover effective path/query/header/cookie choices, component-ref isolation,
  content examples, exact external body bytes, MIME changes and empty/prototype/
  numeric names. Modern versions additionally cover 12 serialized cases each.
  Lowercase additional get and custom-METHOD preserve separate choices, source
  identities and method casing without changing the shared parameter source.
- The same scenario mounts the actual ApiExampleChoices component and shared
  controls in six dark/light 1440/900/760 profiles, testing choices, MIME reset,
  disabled controls, accessible stale-choice errors, correction and reset.
  Artifacts: `artifacts/playwright/openapi-named-examples`.
- `bun tests/ui/openapi-serialized-contract.js`: retained serialized/editor/
  external/body-Git scenario passes. `bun run check`: zero errors/warnings.
- `bun tests/ui/openapi-named-example.js`: saved native scenario passes across
  all four versions. Its cases use actual API Design choices,
  worker generation, IPC persistence/reload, transport bytes/header/query capture
  and Git round trips. Modern versions also send chosen serialized JSON and
  whole-query examples. It uses the shared native-hidden helper.
- `bun tests/ui/build-recovery-copy-probe.js`: required fresh production-profile
  isolated build before native acceptance. App/scenario files must stay frozen
  throughout the build and acceptance; require the same process terminal0.

Fresh build59214 reached terminal0/start1791572626421/finish1791573002345,
production release profile, embedded fixture hash5230209974452422699. Frozen
source record `openapi-named-source-freeze.json` base0b2b435 includes462app and
207scenario SHA-256 hashes. They match throughout all current runs. Build record:
`artifacts/playwright/openapi-named-build.json`.

Native artifacts under `artifacts/playwright/openapi-named-example-`:

| Version | Artifact suffix | Scenario handle | Native PID | Fixture port | Requests |
| ------- | --------------- | --------------- | ---------- | ------------ | -------- |
| 3.2.1   | 1791573014945   | 35302           | 60036      | 58581        | 6        |
| 3.2.0   | 1791573191991   | 15017           | 25732      | 56510        | 6        |
| 3.1.0   | 1791573389510   | 25283           | 58464      | 53375        | 4        |
| 3.0.3   | 1791573577866   | 76244           | 55856      | 57444        | 4        |

All actual scenario handles reached terminal0/native-hidden/visible:false/native
exit0, totaling20 requests and24 dark/light 1440/900/760 native control profiles.
Per-run `independent-audit.json` checks method/target/base64/SHA-256/header/cookie,
source/preferences/assets/Git/provenance/reset and frozen source/build identity.
`cleanup-audit.json` confirms each owned native PID/profile/listener is absent.
Final `openapi-named-final-audit.json` passedtrue combines these with headless
84/28/6 and retained serialized and layout24 acceptance. No live feature handles.

Inspected actual native3.2.1 light760/dark1440 and3.2.0/3.1.0/3.0.3 dark760 images,
plus controlled light760. This verifies those images, not every UI surface or
arbitrary viewport. Static inventory sourcec3f9e7b599843b9a3e308b0abe137e96831b7783c003556ab1138201335817dd:
58Svelte/681shared/117tokens/1728CSS declarations, +9 shared sites/no new raw or
style owner. Static inventory does not prove full runtime ownership/accessibility.

Retained failures: the baseline always generated first despite a second choice.
The expanded fixture initially threw before rendering evidence; compiler typing
was corrected and failure evidence is now rendered explicitly. Git canonical
key ordering exposed an order-sensitive comparator; the saved comparator now
compares sorted object members and retains array order. The body composer returns
text in body and external binary in bodyBase64; the serialized test was corrected
to inspect the corresponding field. A proposed arbitrary 80px minimum rejected
an otherwise fitting 78px selector; acceptance checks shared control minimum40px
and viewport bounds. The actual failure image and light760 controls were inspected.

These fixtures do not prove arbitrary viewport or all OpenAPI precision/media/
schema/resource handling. Additional/custom selection identity is verified in
headless generation; native custom-selection/stale-source and simultaneous
parameter/media example precedence cases still need further acceptance, alongside
further external locations,
non-UTF8, URI/base/fragment policy and broader original parity/UX/CSS/provider/
platform/distribution gates remain required until separately evidenced. No full
migration completion claim.
