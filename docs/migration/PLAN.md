# Migration execution plan

ปรับแผน 2026-10-25 ตาม C:/Users/dvgamerr/.codex/AGENTS.md และคำสั่งให้ศึกษา Bun แทน QuickJS เป้าหมายยังเป็น migration ครบ scope ที่คงไว้หลัง owner ลด Generate Code เหลือ cURL Linux/Windows (2026-10-27)ใน [PARITY](PARITY.md), [ACCEPTANCE](ACCEPTANCE.md) และ topic contracts ไม่ตัด requirement หรือใช้ผลทดสอบเฉพาะส่วนปิดทั้งระบบ

เจ้าของให้เลื่อน P21 plugin/Bun ไปทำเป็นหัวข้อสุดท้ายหลังงาน migration หมวดอื่น โดยเริ่มงานข้อมูลและ recovery ต่อก่อน; R0/R8 ในตารางยังเป็นเกณฑ์ที่คงไว้ ไม่ใช่ลำดับทำก่อน R1 อีกต่อไป. QuickJS คงเป็น default และต้องรักษา sandbox จน Bun ผ่านทุก gate; ไม่ลด scope ของ P21

## หลักการทำงาน

- ตามคำสั่งแก้วิธีทำงาน: หนึ่งงานต้องส่งมอบ workflow ที่ผู้ใช้ทำได้ครบ ระบุผลก่อน/หลังและเกณฑ์รับให้ชัด; test ย่อยผ่านเพิ่มไม่ใช่การปิดงานใหม่
- คงหัวข้อที่เลือกจนแก้และตรวจรับครบ ห้ามหนีปัญหาที่รู้แล้วไปไล่ scenario ที่ผ่านง่าย; เปลี่ยนเรื่องได้เมื่อมี external blocker ที่ระบุได้หรือเจ้าของสั่ง
- อ่าน instructions/แผนครั้งเดียวต่อ scope ที่ไม่เปลี่ยน แล้วอ่านเฉพาะ source/evidence ที่เกี่ยวข้อง; ทุกการตรวจต้องตอบคำถามที่ใช้ตัดสิน implementation ไม่วนเก็บหลักฐานโดยไม่แก้
- รวม implementation ที่เกี่ยวข้องก่อนรัน checks/build ที่จำเป็น ใช้ผลเดิมที่ยังตรง source ได้; อัปเดตสรุปครั้งเดียวต่อ workflow ห้ามรายงานจำนวน test หรือสัดส่วนหมวดเป็นเปอร์เซ็นต์งานรวม
- งาน migration อยู่ในสถานะพักตามคำสั่งเจ้าของ; การแก้วิธีทำงานครั้งนี้ไม่ใช่การ resume และ P21 ยังอยู่ท้ายแผน
- ทำ workflow ให้ครบทีละเรื่อง มีงานพัฒนาเปิดพร้อมกันหนึ่งเรื่อง ใช้หลักฐานจาก source/caller/legacy ที่เกี่ยวข้องเลือกงาน ไม่เลือกเพราะเขียน test ง่ายหรือทำให้ receipt เขียว
- ก่อนแก้ ระบุปัญหาที่เห็นจริง, callers/tests/fixtures/config/exports ที่ต้องเปลี่ยน, ผลต่อข้อมูล/ผู้ใช้ และเงื่อนไขปิดงาน ใช้ implementation/helper/dependency เดิมก่อนเพิ่มของใหม่
- ตรวจความจำเป็นของ compatibility API จาก requirement และผู้เรียกจริง ไม่สร้าง browser/Node runtime ใหม่เพื่อไล่มาตรฐานครบทุก API รายการเดิมที่ยังหาที่มาไม่ได้ยังคงอยู่ใน backlog เพื่อทวน scope ไม่ลบเอง
- แก้ root cause ในชั้นร่วมครั้งเดียว เก็บ validation/error handling/security/accessibility และ calibration จริง ห้ามลดข้อกำหนดเพื่อให้ผ่าน test
- งานที่มี implementation แล้วให้ตรวจช่องว่าง acceptance ก่อนเขียนซ้ำ งานที่หลักฐานเก่าไม่ตรง source ให้ระบุว่าไม่ยืนยัน source ปัจจุบัน
- ปิดหนึ่งเรื่องแล้วอัปเดต STATUS/topic summary ครั้งเดียว เขียน state.md ใหม่สี่ส่วน ไม่เขียน diary ไม่สร้าง framework/ledger/เอกสารควบคุมงานเพิ่มเมื่อของเดิมพอ
- ไม่ stage/commit/publish จนกว่าเจ้าของสั่ง เมื่อสั่ง commit จึงแยก verified work ตามเรื่อง การ pause ยังมีผลจนเจ้าของ resume

## ลำดับส่งมอบและเกณฑ์ปิด

เริ่ม R1 แล้วทำหมวดอื่นที่ไม่ใช่ P21 ตามลำดับและ dependency ที่เกี่ยวข้อง; งาน runner/template ที่ไม่ใช่ P21 ทำต่อได้. ทำ R0 และส่วน plugin ของ R8 เป็นหัวข้อสุดท้ายก่อน audit ปิด migration; ตรวจ distribution ที่ Bun เปลี่ยนซ้ำหลัง P21. ถ้าติดภายนอกให้เลือกงานอิสระถัดไปโดยคงเกณฑ์เดิมไว้

| ลำดับ | ชุดงาน | สิ่งที่ต้องส่งมอบและเกณฑ์ปิด | ขอบเขตที่อ้างอิง |
| --- | --- | --- | --- |
| R0 | คืน baseline และตัดสิน runtime | แยก accepted/unfinished ใน dirty tree; จัดการ FileReaderSync ที่ค้างและ compiler error โดยไม่ทิ้งงานอื่น; พิสูจน์ Bun ตาม gate ด้านล่าง แล้วเลือก runtime เส้นทางเดียวสำหรับ migration | [PLUGINS](PLUGINS.md), [RUNNER](RUNNER.md), [UI tests](UI-TESTING.md) |
| R1 | ข้อมูลและการกู้คืน | CRUD/duplicate/delete/reorder/search, ownership, atomic save/backup/recovery, imported models/assets และ close/drain ทำงานครบ; error/cancel/crash ไม่ทำลายข้อมูลเดิม; export→import→reload พิสูจน์ข้อมูล/ความลับตาม policy | [Collections](COLLECTIONS.md), [Import/export](IMPORT-EXPORT.md), [Responses](RESPONSES.md) |
| R2 | HTTP workflow หลัก | environment/inheritance/tags → body/auth → native Send → response/history → Copy/Save → reload ครบ; ทุก body mode, cancellation/redirect/error และ resource switch ไม่มี stale publication | [HTTP](HTTP.md), [Responses](RESPONSES.md), [Templating](TEMPLATING.md), [cURL](CURL-IMPORT.md) |
| R3 | Auth, cookies, proxy และ TLS | ตรวจทุก retained scheme/provider flow, OAuth browser/callback, cookie isolation/save/recovery, proxy/redirect และ CA/client identity ผ่าน native workflow จริง รวม refusal และ cancellation | [Authentication](AUTHENTICATION.md), [TLS](TLS.md), [Acceptance](ACCEPTANCE.md) |
| R4 | gRPC ครบ workflow | proto/import/reflection/example/editor → unary/stream ทั้งสี่รูปแบบ → status/metadata/history/Copy/Save/reopen; ปิด JSON/object/map/Any และ receive/compression ข้อที่ค้าง พร้อม DNS/service-config/cache/retry/hedging/outlier/weighted/ORCA/calendar/provider/platform ตามสัญญาเดิม | [gRPC](GRPC.md), [Service config](GRPC-SERVICE-CONFIG.md) |
| R5 | WebSocket และ SSE | connect/send/receive/control/fragmentation/compression/ACK/backpressure → durable history/large Copy/Save → Cancel/close/reopen; exact bytes, no implicit replay และ auth/proxy/TLS/cookies ตามสัญญาเดิม | [HTTP](HTTP.md), [Responses](RESPONSES.md), [Import/export](IMPORT-EXPORT.md) |
| R6 | GraphQL | query/variables/operation GET/POST, schema fetch/import/cache/export, completion/hover/navigation/format/errors ผ่าน workflow จริง; stale fetch/queued editor callbacks/cancel/close ถูก owner | [GraphQL](GRAPHQL.md), [Acceptance](ACCEPTANCE.md) |
| R7 | OpenAPI, cURL และ code generation | edit/import/lint/refs/schema/serialization/examples → generate request → wire/export; ครบ retained formats, custom operations/query order, Spectral/custom rules, selected binary/MIME assets และ cURL Linux (POSIX shell) และ cURL Windows (PowerShell) เท่านั้น; ภาษา/client อื่นถูกเจ้าของนำออกจาก scope รวม code/tests/runtime gates | [API design](API-DESIGN.md), [cURL](CURL-IMPORT.md), [Import/export](IMPORT-EXPORT.md) |
| R8 | Plugin, template และ runner | ใช้ runtime ที่ R0 เลือก รัน plugin/tag/hook/action/store/dialog และ suite/assertion จริงครบตาม inventory; Node modules/DOM bridge/async owner/limits/cancel/unload/repair/restart ไม่ข้ามสิทธิ์หรือเปลี่ยนข้อมูล; ปิด compatibility ที่ค้างตามสัญญาเดิม | [Plugins](PLUGINS.md), [Templating](TEMPLATING.md), [Runner](RUNNER.md) |
| R9 | Git ครบวงจร | clone/status/stage/commit/branches/fetch/pull/merge/conflict/remote checkout/non-force push รวม recovery/process drain/provider/path/history/privacy; ตรวจของที่มีแล้วก่อนเพิ่ม implementation | [Git](GIT.md), [Import/export](IMPORT-EXPORT.md) |
| R10 | Desktop และ accessibility | menus/shortcuts/dialogs/clipboard/window state/single-instance/OS-close, keyboard/focus/screen-reader/theme/resize และ actual picker/drag/provider ผ่าน workflow ที่เกี่ยวข้อง; รักษา Insomnium layout ระหว่าง migration | [Design](DESIGN.md), [UI tests](UI-TESTING.md), [Acceptance](ACCEPTANCE.md) |
| R11 | Distribution, legal และ platform | current-source Windows/Linux/macOS build/runtime/install/update/uninstall/CI/signing ตาม scope, notices/source offers/linkage/license ครบ; exact package/source/runtime identity และ recovery ผ่านก่อนประกาศ release | [CI](CI.md), [Licenses](LICENSES.md), [BUILD.json](https://github.com/dvgamerr-app/insomnium-app/blob/fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87/docs/migration/BUILD.json), [archive manifest](https://github.com/dvgamerr-app/insomnium-app/blob/fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87/docs/migration/archive-manifest.json) |
| R12 | ตรวจปิด migration และ UX | audit ทุก requirement/acceptance ในเอกสารกับ source และหลักฐานตรง scope; ไม่มี missing/partial/unverified หรือ owner removal ที่ยังไม่ชัด จึงปิด migration; ทำ shared inputs/UX ที่ยังค้างตามคำสั่งเจ้าของหลัง gate ที่เกี่ยวข้อง | [PARITY](PARITY.md), [ACCEPTANCE](ACCEPTANCE.md), [UX](POST-MIGRATION-UX.md) |

R1–R3 เป็นฐานข้อมูล/ownership/network ร่วมของ R4–R9 ส่วน R6/R7/R9 ที่ไม่กระทบ blocker สามารถหยิบมาปิดก่อน R4 ได้ R10/R11 ตรวจล่วงหน้าทันทีเมื่อเปลี่ยน lifecycle/native/dependency/packaging ไม่สะสมปัญหาไปท้ายโครงการ งาน shared UI/Git/resize ที่เจ้าของอนุญาตไว้ยังอยู่ใน scope; ไม่เริ่ม redesign เพิ่มจากแผนนี้เอง

## R0: ใช้ Bun โดยตรงแทน QuickJS

เมื่อกลับมาทำ P21 ให้พิสูจน์ Bun sidecar ตาม gate นี้ ใช้ Bun version ที่ project pin อยู่ ไม่ติดตั้ง runtime/dependency ใหม่เพื่อการศึกษาครั้งนี้; ระหว่างนี้ใช้ QuickJS เดิม

| เรื่อง | หลักฐานปัจจุบัน / งานที่ต้องพิสูจน์ |
| --- | --- |
| รัน JavaScript โดยตรง | Bun1.4.2 ที่ติดตั้งรัน CommonJS+Buffer และ ESM/top-level await ผ่าน; AsyncLocalStorage รักษา owner ผ่าน Promise และ timer ของสองงานพร้อมกันได้ |
| หยุดงาน/ทรัพยากร | Current Windows native-hidden session ผ่าน CPU/wall/sync deadline และ cleanup; fixed I/O pool2 แก้ cold async-I/O crash ภายใต้ single-child/128MiB เดิม พร้อม uninstrumented peaks124219392/116219904 และ original early FFI assertions ([receipt](../../artifacts/bun-memory-allocation-20261026/verification.json)); broader workloads/hardware/platform calibration และ OS-close ยังเปิด |
| เชื่อม Tauri | ใช้ native process supervisor/stdio/validation ที่มีใน Spectral เป็นแบบอย่าง และ existing plugin codec/session contracts; ไม่สร้าง generic RPC framework หรือระบบ daemon ใหม่ |
| Packaging | Bun --compile บรรจุ runtime ใน executable ได้ และ Tauri รองรับ external binaries; ต้องพิสูจน์ signed/package identity, legal/linkage และ target OS จริงก่อนแทน runtime เดิม |
| Web/DOM | Bun ที่ติดตั้งมี EventTarget, AbortSignal, streams, Blob/File, MessageChannel/Port; ไม่มี document/window/FileReader/FileReaderSync/DataTransfer/Range จึงยังต้องใช้ actual WebView DOM bridge เฉพาะสิ่งที่ plugins ต้องใช้ |
| สิทธิ์และ isolation | Bun child อ่านไฟล์ได้โดยตรง; แยก process หรือ node:vm ไม่ได้พิสูจน์ sandbox ต้องคง policy untrusted code/ไฟล์/เครือข่าย/secret/owner และ host-side authorization เดิม โดยไม่แอบเปลี่ยนให้ plugin เป็น trusted |
| Compatibility จริง | เลือก plugin/tag/hook/runner จาก inventory เดิมและ dependency ที่ใช้อยู่ พิสูจน์ CJS/ESM/module resolution, retained state/store, async owner, helper I/O, synchronous DOM cancellation/checkpoints, Cancel/unload/host close และ repair/restart ผ่าน saved scenario เดิม |
| ตัดสินใจ | เมื่อ gates ข้างบนครบ ให้ย้าย caller/fixture/build/config/exports เป็น topic เดียว แล้วลบ QuickJS/dependency/polyfill ที่หมดผู้เรียกหลัง regression ผ่าน; ไม่เก็บสอง runtime เป็น product option/fallback โดยไม่มีความต้องการ ถ้ายังไม่ผ่าน ระบุ requirement ที่ขาดและงานแก้จริงก่อนเปลี่ยน ไม่สร้าง polyfill ต่อแบบไม่มี caller |

หลักฐานการศึกษา: [bun-runtime-research.json](../../artifacts/replan-20261025/bun-runtime-research.json) เป็น inline self-check ไม่ใช่ production integration acceptance การลอง import จาก raw data URL ไม่ได้ named export ตามที่คาด จึงไม่ใช้ผลนั้นอ้าง module loading; explicit ESM/TLA ใน child CLI ผ่าน ไม่มีการเปลี่ยน product runtime ในรอบวางแผน

เอกสารทางการ: [Bun executables](https://bun.com/docs/bundler/executables), [subprocess/IPC](https://bun.com/docs/runtime/child-process), [Workers](https://bun.com/docs/runtime/workers), [Node compatibility](https://bun.com/docs/runtime/nodejs-compat), [node:vm security boundary](https://bun.com/reference/node/vm), [Tauri sidecars](https://v2.tauri.app/develop/sidecar/). บางหน้า reference กับ compatibility matrix อธิบาย feature ต่างกัน จึงยึดผล version ที่ pin สำหรับข้อที่ทดสอบแล้ว และเปิดข้อที่ยังไม่ทดสอบไว้

## วงรอบพัฒนาและตรวจรับ

1. เลือกหนึ่ง deliverable จากตาราง เขียนขอบเขต/เกณฑ์ปิดสั้น ๆ จาก requirement จริง แยก missing code, missing verification และ external blocker ใช้หลักฐานเดิมได้เมื่อ source/dependency/platform ยังตรงกัน
2. อ่าน callers/fixtures/config/exports แล้วทำ smallest complete change ใช้ helper/platform/dependency เดิม แก้ tests เดิมเฉพาะ behavior ที่เปลี่ยน ไม่เพิ่ม abstraction/options/config เพื่ออนาคต
3. รัน compiler และ check เฉพาะผลกระทบ: frontend ใช้ bun run check/build; Rust ใช้ Cargo ที่เกี่ยวข้อง; behavior ใช้ saved Playwright scenario เดิมแบบ headless และ native-hidden เมื่อจำเป็น ต้องมี check ของ non-trivial logic
4. รวมการแก้ runtime/transport ที่เกี่ยวข้องเป็น topic ที่ตรวจรับได้ก่อน normal native build หนึ่งชุด ใช้ binary/source identity เดียวกันรัน scenario ที่ได้รับผลกระทบ ไม่ rebuild ทุก API ย่อย และไม่ใช้ binary เก่ายืนยัน source ใหม่
5. รัน native/provider/OS/packaging/legal gates ที่ requirement ต้องการจริง; ขยาย regression เฉพาะเมื่อแก้ shared code พบ failure หรือมีข้อสงสัยใหม่ ห้ามลดการตรวจข้อมูลสูญหาย/security/accessibility/calibration เพื่อประหยัดเวลา
6. ปิดด้วย outcome, command/exit, source/build identity, coverage/remaining gates, profile restoration และ process closure ตาม helper เดิม; update STATUS/topic/state ครั้งเดียว เก็บ log ใน artifacts ไม่คัด transcript ลงแผน

ไม่สร้าง scenario ซ้ำ ไม่ replay matrix ที่ยังเขียวและไม่มีผลกระทบ ไม่ดาวน์โหลด/cache ซ้ำ ตรวจของที่มีใน .local ก่อนและลบเมื่อหมดความจำเป็น ถ้า approval review ปฏิเสธให้บันทึก blocker ไม่ลองลบผ่านวิธีอื่น

## การวัดความคืบหน้าและเกณฑ์จบ

- PARITY 23 แถวมีขนาดไม่เท่ากัน; VERIFIED2/23=8.7% เป็นเพียงสัดส่วนแถวที่ปิด ไม่ใช่เปอร์เซ็นต์ effort หรือ migration ทั้งโครงการ ห้ามใช้จำนวน commit/บรรทัด/test/receipt เป็น % เสร็จ
- ตอนเริ่มแต่ละชุด R ให้ผูก acceptance ที่ค้างกับ code และหลักฐานใน topic เดิม ระบุ implemented/unverified/missing/blocked ให้ครบ ไม่เปิดงาน audit เอกสารอย่างไม่มีจุดจบ
- รายงานจำนวน acceptance ที่ปิด/คงเหลือในขอบเขตที่มีรายการครบ พร้อม blocker และสิ่งที่ส่งมอบจริง ถ้าจะรายงาน % รวม ต้องมี baseline ทุก requirement, denominator/น้ำหนักที่เปิดเผย และหลักฐานตรงกันก่อน; ขณะนี้ยังไม่มี baseline แบบนั้น จึงไม่ให้ % รวม/วันจบจากการเดา
- ปิด R หนึ่งชุดได้เมื่อเกณฑ์ของชุดนั้นและ retained contracts ที่เกี่ยวข้องครบ ไม่ใช้เพียง compiler/ตัวอย่าง Windows บางกรณีแทน full scope ปิด migration ได้เมื่อทุก PARITY/topic/acceptance/platform/legal gate ผ่านหรือเจ้าของนำออกอย่างชัดเจนเท่านั้น

## งานถัดไปและ blockers

| รายการ | การกระทำถัดไป |
| --- | --- |
| FileReaderSync/resource baseline | [Reply-buffer/memory/teardown](../../artifacts/bun-worker-lifetime-20261027/verification.json) ปิดnamed Windows regressionแล้ว: reused bounded buffer, budget error/Closedไม่panicค้าง, debug18DOM/File+6workflow jobs peak124.45MiB<128MiB. ถัดไปปิดremaining workload/hardware/native restart/OS-close/platform gates; ไม่ใช้ผลนี้ปิดทุกresource case |
| Bun migration | Actions/helpers/editor/themes/reload/Windows user-close→reopenและprotocol/OAuth/gRPC/app helpersผ่านตาม [A21](ACCEPTANCE.md#a21); ถัดไปnative dialog owner/nested/stream/terminal callbacksและcookie/provider helpers รวมclose/resource/platform/activation gatesที่เหลือ คง4sessionsเดิม; FileReader/object URLยังไม่มีcallerในarchived coreที่ตรวจ จึงคงbacklogและไม่เพิ่มAPIจากรายชื่ออย่างเดียว |
| Cross-owner QuickJS waits | installed FFI ไม่มี Promise-job owner hook; temporary global capability swap ไม่เพียงพอต่อ async/await ต้องใช้ runtime ที่มี provenance/authorization ที่พิสูจน์ได้ ไม่ปิด guard เพื่อให้ test ผ่าน |
| Platform/provider/legal | ใช้เครื่อง/provider/credentials/toolchain ที่ตรง gate และมีสิทธิ์ก่อน verify; อย่าเปลี่ยน unavailable เป็น done การรอภายนอกไม่ขวางงานอิสระอื่น |

[STATUS](STATUS.md) เป็นสถานะปัจจุบัน, [state.md](../../state.md) เป็น handoff สี่ส่วน, [README](README.md) เป็นดัชนี topic, [snapshot BUILD.json](https://github.com/dvgamerr-app/insomnium-app/blob/fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87/docs/migration/BUILD.json)/[snapshot archive-manifest.json](https://github.com/dvgamerr-app/insomnium-app/blob/fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87/docs/migration/archive-manifest.json) เป็นหลักฐาน version เดิม ไม่แก้ให้ดูเหมือนเป็น release ใหม่ Interface นี้เรียก /compact ไม่ได้ จึงรายงานข้อจำกัดตรง ๆ ไม่มีการ commit/publish โดยอัตโนมัติ
