# OpenAPI raw binary request bodies

Valid OAS 3.0 `image/png` with a string schema and `format: binary` previously
generated an octet-stream body, losing its selected Content-Type. A schema-less
raw file in OAS 3.1+ also went through the example sampler instead of a file
selection contract.

Generated raw binary bodies now preserve their selected `mimeType` and carry
`binary: true`. A shared `isBinaryBody` predicate connects the existing native
file picker, late-selection guard, upload/template separation and request
transport. Bytes come from the selected file; examples and external file paths
are not read as local files. Send refuses before a file is selected. The body
editor shows Binary File with the actual Content-Type through shared Feedback.
Choosing another body type clears the explicit binary mode. Manual Content-Type
headers keep their existing precedence over the inferred media type.

OAS 3.0 binary schemas use the existing format convention. OAS 3.1/3.2 schema-less
non-text/non-JSON/non-XML/non-form media use raw file bodies (including image,
PDF, octet-stream and custom concrete media). Modern format alone is not a
transfer encoding declaration. Existing cURL file modes and octet-stream body
representation remain compatible. No native backend or dependency changes.

## References and commands

- [OAS 3.0 file uploads and specific media types](https://spec.openapis.org/oas/v3.0.3.html#considerations-for-file-uploads)
- [OAS 3.1 schema-less binary file bodies](https://spec.openapis.org/oas/v3.1.2.html#considerations-for-file-uploads)

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-binary-body.js
bun tests/ui/curl-import-file-body.js
bun tests/ui/curl-import-mixed-body.js
```

Reusable saved cases cover seven OAS 3.0 and four each OAS 3.1/3.2 concrete media
bodies (15), with actual worker generation, empty-selection refusal, all 256
byte values independent of browser file MIME, exact wire Content-Type, resource
preservation and reload without resend. The native scenario additionally covers
manual header precedence and switching to Text without sending cached file bytes.
Inline source checks cover generation, preparation, upload/template separation,
stale-body refusal and 15 Git YAML round trips. Eight additional modern format
and invalid/stale-selection controls pass. Final compiler58610 returns0/0;
format/diff and headless design-system65886 pass.

Fresh production release1791478485955/finished1791479037902/result0,
fixture hash10572976255433141081 accepts native binary1791479046614:
21 groups (9 OAS3.0.3,6 OAS3.1.2,6 OAS3.2.1). Same-release cURL file1791479287906
accepts5 modes/4 checks and mixed-body1791479337589 accepts6 checks, including
overlapping file reads, latest selection, conversion/reload and body-type reset.
Sequence71237 terminal0. All three terminal native results passed,
native-hidden/visiblefalse/exit0 (PIDs50268/51520/14260). Owned loopback servers
close in finally. The actual OAS3.0.3 and3.2.1 light760 images were inspected:
retained Content-Type and existing file-picker layout remain readable. This is
Windows viewport evidence, not all-theme/OS-dialog/platform acceptance. Exact
history, errors, release and remaining gates are retained in STATUS.

Other body media, media negotiation/ranges, base64/contentEncoding transformations,
multipart arrays/encoding/headers, form serialization, complete schema validation,
required/optional body policy, Swagger, external examples, platform/provider and
every original migration/UX/PLAN/PARITY gate remain required. This feature does
not close full OpenAPI or UI debt.
