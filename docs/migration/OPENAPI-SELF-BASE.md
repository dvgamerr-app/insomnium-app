# OpenAPI3.2 declared document bases

Implementation, headless checks and fresh native acceptance pass.
Full migration and UX/CSS remain active.

[OpenAPI3.2.1 document identity](https://spec.openapis.org/oas/v3.2.1.html#openapi-object)
and [base URI rules](https://spec.openapis.org/oas/v3.2.1.html#establishing-the-base-uri)
require API-description references to use the declared $self when present.
Relative declarations resolve against the containing document URI.

Before this fix, a specification retrieved as https://retrieval.example/api.yaml
with $self:https://canonical.example/docs/api.yaml and externalValue:bytes.bin
looked up https://retrieval.example/bytes.bin. The asset attached as
https://canonical.example/docs/bytes.bin was missed. Retained reproduction:
artifacts/playwright/openapi-self-base-before.json.

Description filesystem identities now use the root OpenAPI3.2 $self. Attached
complete OpenAPI documents also use their own declarations; fragmentary objects
retain their attachment URI. Reference preparation and typed external-example
binding share those identities. Canonical document collisions refuse instead
of ambiguously choosing a document. API server URL handling is separate.

Root-relative example attachment names and asset refresh use the same declared
base as externalValue. Invalid/incomplete source can still prepare attachments
using its filename base; analysis must successfully parse/validate it before
generation. Non-OpenAPI literal $self fields do not alter document identity.
Source text and attached file text are preserved.

Saved commands:

```powershell
bun run check
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/build-recovery-copy-probe.js
```

Compiler0errors0warnings and headless8byte checks/44controls pass, retaining
168serialized checks/11controls/8signing controls plus mounted editor/body-Git.
14new controls cover both3.2.0/3.2.1 absolute/relative root declarations, attached
documents with absolute/relative declarations, incorrect retrieval-base shadow
bytes, canonical identity collisions, asset refresh, incomplete author source
and literal roles. Retained named108checks/28controls/6profiles also pass; independent
openapi-self-headless-audit.json verifies current668 hashes and exact base literals.
Initial inline reproduction brace syntax was corrected
before collecting evidence; no mutation occurred from that failed command.

The existing saved native external scenario now uses a root declaration,
an attached complete OpenAPI document with a distinct relative $self, and
relative external values from that referenced document. It retains actual
local/HTTP attachments, three request groups, loading/management controls,
bounded source/preview geometry, typed worker literals, source/ref persistence
and reload. Acceptance must use a freshly built frozen source release.

openapi-self-source-freeze.json records462app/206scenario raw-byte hashes at
base7e47a68. Fresh production probe handle64344 reached actualterminal0,
started1791577573621/finished1791577948614/native52888/fixtureHash9384957238430302815.
Executable SHA-256 ad385f02e704915d43b5411246d3f99444c5ac763e5544a9a91737bb414630b6.
All668 source hashes matched after build. Native3.2.1 handle66175/artifact1791577977014 reached actualterminal0,
native21416exit0/native-hidden/visible:false, finished20:36:13.224Z. Independent
self-independent-audit.json passes3wire groups/4loading/4management/2worker literal/
12layout profiles/source/ref/canonical Git and current668/executable identity.
Owned21416/profile/listener60827 absent; self-cleanup-audit.json passedtrue.
Actual light760x600 image inspected; no arbitrary viewport/platform claim.
Native3.2.0 handle64918/artifact1791578201212 also reached actualterminal0,
native18244exit0/native-hidden/visible:false, finished20:39:55.097Z. Same3wire groups,
12layout profiles/4loading/4management/2worker literals/source/ref/canonical Git and
current668/executable audit pass. Owned18244/profile/listener61848 absent. Actual
dark760x960 image inspected. Both handles terminal0; no live feature handles.
Aggregate openapi-self-final-audit.json passedtrue combines6groups24layout profiles,
8loading8management4worker literals plus headless/source/build/Git/wire audits.
Fresh read-only aggregate cleanup returns0owned/0profiles/0listeners. No app/scenario
edits during build/acceptance. Do not reuse previous native build59214 for this
application change.

Still required: schema $id/anchors/dynamic
references, broader URI/fragment/charset/resource policies, nonUTF8/all parameter
locations and all original provider/platform/migration/UX/CSS gates. This does
not prove full URI/OpenAPI interoperability. /compact is unavailable in this
interface; STATUS records exact live handles and next steps.
