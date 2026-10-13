# XML formatter source/runtime preservation proposal

New artifact `artifacts/xml-formatter-preservation-map`, root read-only context de70deed3c40ca60247ccf4786a485548949c7ff. Frozen29 role-alert offer1a2db1f remains unchanged; no root product/script adoption or app change. No native/browser/build/profile/cache/toolchain operation, no new agent. Bun executed only source copying/inverse guards and pure XML model evaluation; no Worker, CDP, Tauri command or profiler ran.

## Exact source-derived cases (correcting prior prose)

Current original `tests/ui/xml-request-format.js` SHAe14191d567d0021f2eacf25ea1ab911a5d3b627d5c4bffac4bb35a7048abeaeb has **18** checks with `caseSet=all`:3 real formatting+6 controlled cancellations+6 controlled faults+3 real bundled-worker refusals. The3 refusals are malformed, empty and mixed text, **not size-limit rows**. This corrects prior frozen29 report's imprecise “malformed/limit” wording without overwriting its bytes. Proposed two role assertion sites execute **9** error cases. `cancellation` is6 checks, `workspace` is1; neither executes role error assertions or real-worker cases. CPU profiling is optional only on workspace mode; explicit responsiveness budget stays optional/current and is not changed.

`expected-cases.json` SHA2d933a7d0b52452cfd56e3b30c7d8792cc31b603cb217b7b8f12fbbc22853454 records complete case sets, not output subsets:

| Case | Source-derived exact display error | Evidence type |
| --- | --- | --- |
| error | Could not format XML | Controlled onerror; RequestEditor fail string |
| messageerror | Could not read formatted XML | Controlled onmessageerror; RequestEditor fail string |
| response-error | Owned XML response failure | Explicit saved Worker adapter message |
| timeout | XML formatting exceeded 3 seconds; original body retained | Held controlled Worker; original real3000ms timer scheduling observed, not a real hung-worker claim |
| construction | Error: Owned XML worker construction failure | Saved adapter constructor throw |
| post | Error: Owned XML worker post failure | Saved adapter postMessage throw |
| malformed | ParseError: Opening and ending tag mismatch: "item" != "root" | Pure actual xmlPrettify/@xmldom0.9.12 evaluation of `<root><item></root>`; native Worker still unexecuted |
| empty | ParseError: missing root element | Same pure locked model evaluation of empty source |
| mixed text | Error: Formatting would change XML text or attributes; original content retained | Current source content comparison/pure model evaluation |

Do not replace exact library expected strings with invented parser debug wording; bind actual worker/source/library before runtime. Size limits20Mi input/output UTF16 characters,100000nodes,96depth and invalid-indent policy remain implemented but **are not these3 scripted refusal cases**. Real formatting MIME cases are application/xml,text/xml,application/vnd.owned+xml;charset parameter as captured; expected formatted string, undo/redo, reload/native persistence/Git-resource roundtrip retained. Six cancellations: edit/tab/mime/request/unmount/workspace, one controlled post each, timer cleared/not fired, worker terminated, late text/error ignored, destination editor/other complete request retained. Full `all` expects6 real browser Worker instances (3 success+3 refusal); controlled instances are not real worker launches.

## Actual transitive runtime map

`runtime-map.json` SHAc445d66d3c3248a7d3ef01df7f932a334994d94b28357c93302b2c28c40ff3b8 pins14 selected source/lock files and closed static ESM edges. Original entry → xml-worker-control/native-app/model/cpu-profile/git-resources; native-app → native-profile-ownership; preservation additions → resource-manager-cases + cookie-native-git-inventory. Model/Git serialization uses yaml; harness packages include playwright-core and builtin node modules; compiled formatting uses @xmldom/xmldom. Builtin node imports execute under Bun, not Node processes.

App edge RequestEditor→new Worker(URL xml-format.worker,type module)→xml-prettify→@xmldom. Current f66 metadata has worker `_app/immutable/workers/xml-format.worker-tOePGq_i.js`,87052bytes,SHAfbcacf92e2ea2d2dc3eae3c72512ae6da980fe7e5382807943da38bab9628042. This is source/metadata binding, not a new asset-byte/native proof. Full compiled source1055+10/frontend49/public1963/private767/global777/appedbb-f66-cedadd authority remains distinct from14-file harness map. Future code/package/nonliteral imports must be captured, no duplicate-path omission/source-count fabrication.

Saved Worker adapter temporarily changes only owned XML Worker construction/timer observation in page via explicit helper. Every seed reload replaces that document; normal success/refusal rows run real bundled Worker. Timer observers preserve original delay/scheduling. CPU helper uses CDP Profiler/Debugger sampling and source receipt capture, no app function patch, and detaches in finally. None are executed here; no mock Tauri/IPC/backend/normal parser replacement is proposed. No request Send or actual Git initializer call occurs: encode/decodeGitResource is pure JS serialization.

## Full-preservation integration map for root review

| Order | Minimal required boundary / concrete evidence |
| --- | --- |
| 1 prelaunch authority | Root-only serial operator; exact source/harness/declared supplement/fresh output; actual current relative schema/current/emitted/private/notices/sidecar/exe/parent acceptance before/after. No app running/native build; afterProto36 explicitrelease. Existingedbb/f66 is valid only for unchanged original/no-role-negative purpose; it does **not** contain proposed role attr. Positive role acceptance needs reviewed new source/assets/app binding. |
| 2 physical baseline | Actual KnownFolder fixed profile, ordinary nonlink contained paths. Capture all protected656incl654cookie files/workspace buffers/store file-set and bytes plus whole pinned13783 Git before app start. No APPDATA guess or directory-name-only Git proof. Root owns approved metadata fdcb53 and original43resources20history expectations; fresh current baseline must match. |
| 3 ONE outer preserver | Exactly one withResourceProbePreserved wraps native withNativeApp. Native helper hides owned window before CDP. Facade validates actual native directory14/PID/image/creation/retained process observation; captures original load resources/history/layout5 before body. No transport/invoke substitution; do not nest another wrapper. |
| 4 before FIRST mutation | Original entry adds collection locally then saves BEFORE any request seed. Add awaited registerXmlFixture immediately before that FIRST save, not afterseed/afterrestore. Validate exact fresh workspaceId/requestId/otherRequestId absent from captured actual originalIDs, suffix consistency/name/one fixture; registerResourceProbeCollection requires active wrapper. Persist durable exact IDs/name/before-save receipt before invoking original save. Local appended JSON is not persisted until that original invoke. |
| 5 original workflow | Same seed removes/recreates only owned2request IDs inside registered workspace; no logical user-resource/history mutation. Capture actual changed workspace/registered persisted ID+name BEFORE byte restoration. Full18/6/1 map chosen explicitly, same actual parser/content, quotas, backend load/save, unforced UI behavior and old assertions. Future auditor verifies exact named cases/messages/flags/errorroles/cancellation timer/late suppression/native data/other request. Distinguish plain script labels from measured actual roles. |
| 6 callback finally | Always attempt restore exact current3+legacy2 split-size keys and verify/write layout receipt before owned app closes, preserving original scenario error plus restoration errors. No broad globalstorage fault injection; no raw body rewriting for cleanup. |
| 7 owned exit + preserver | Await native result0/hidden/not deliberate force, retained actualPID wait signaled/closed/nohosts/observed descendants; only then existing outer preserver restores exact original buffers/cookies/store. Selective cookie cleanup only newly absent-before registered exact ID/name-bound ordinary unchanged owned file; unknown/unbound file retained and failed gate. No original/user Git deletion/quarantine: XML fixture adds no Git repository. |
| 8 postexit auditor/release | Attempt ALL independent current authority/fullGit/protected/resource/history/layout/harness/exit audits even after scenario failure. Retain failure/evidence, no falsegreen from onlyexit0 or names. Root records independent case+liveFS audits and explicit separate profile-release; old heldclaim remains immutable, no agent-generated authorization. |

Historical `artifacts/run-native-xml-current-full-v1.mjs` SHA313a40d4e822faff7166371b7b0d7a08ab14c279e142ccf75d312aa70d6f495b actually launches **xml-response-filter.js**, not formatter, and preserves only2buffers +Git directory names. It is not a sufficient current request-formatter preservation driver and is not reused as proof. Reuse reviewed modern Proto36/current relative-authority/physical-observer mechanisms as source building blocks, adapted only after concrete root review, rather than copying the old absolute-field closure.

## Reviewable entry-only source sketches

Two NEW nonrunnable entry proposals keep all assertions/body and current imports/data unchanged except declared root-URL/native-facade rebasing and ONE awaited before-first-save registry hook:

| Variant | Baseline | Proposed SHA256 |
| --- | --- | --- |
| Original visual/no-role baseline | e14191... | 1fab908c5c5b1ef8705c47c7496e923e6381796fd5e79d378a369fb195c1ca25 |
| Existing frozen29 role-positive scenario | 92ccedf... | cac479bbf6974a0917cd59e0d0190f8dfa1bcf34b25ba9c9fc00eb1bf3882166 |

Whole RAW inverse for each passes. Proposed `xml-preserved.mjs` facade/operator/binding is deliberately **not implemented/supplied**, so neither entry is runnable. Future registry export must be the captured actual-context mechanism above; it cannot just trust timestamp prefix or silently no-op. On currentf66 the role-positive version would stop at first controlled-fault role assertion after9 completed success/cancel rows; no full18/9negative observed claim is made here. Running original baseline and then positive fresh generation is root's decision, not a request for additional user permission.

Initial preparation rejected a CRLF-only source-token comparison against actual LF baseline before any candidate/native mutation; original attempt/refusal retained, corrected comparison normalizes only source token detection while all RAW hashes/inverses stay exact. Frozen29/report unchanged; this report explicitly supersedes its refusal-case prose. Pure XML model evaluation is not native UI, Worker, timing, AT or OS acceptance. Root reviews map/hook/authority/profile-restoration source before implementation/runtime. No scope removed from original fullgRPC/provenance/quarantine/fullmigration/UI/AT/platform. Handles:none/profile unclaimed. Topic/STATUS handoff; `/compact` unavailable explicitly.
