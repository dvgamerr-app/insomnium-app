# สรุปสถานะ Insomnium → Tauri

อัปเดต 2026-09-30: เชื่อม native git_remote_fetch แล้ว ตรวจ saved binding/settings ก่อนและหลัง network พร้อม cancel/publication/reconciliation; Cargo และ helper/pipeline checks ผ่าน ยังไม่ได้ทดสอบ command IPC จริง ต้องต่อ JS client/workspace/UI และ saved Playwright

อัปเดต 2026-09-30: เพิ่ม fetch snapshot ผ่าน ref เดียวพร้อม manifest commit ที่เก็บ branch tips ให้ Git รักษา objects ผ่าน23 snapshot +17 import +15 real-pack assertions; ยังไม่เชื่อม native Fetch command/binding admission/UI และ recovery

อัปเดต 2026-09-30: native object importer ผ่าน17 assertions พร้อม15 real-pack regression โดย HEAD/refs/working edits เดิมไม่เปลี่ยน ยังเป็น primitive ที่ตรวจแยก ต้องเชื่อม snapshot publication และ Fetch command/UI ต่อ

อัปเดต 2026-09-30: ส่งมอบ staging ownership ให้ native consumer ได้แล้ว พร้อม allocator จาก Tauri app-data/UUID (ยังไม่เปิด Fetch IPC) ผ่าน58 assertions และ15 real-pack checks; ขั้นต่อไปตรวจ/import objects และเผยแพร่ snapshot ก่อนต่อ UI

อัปเดต 2026-09-30: parent จอง staging container และ ownership marker แล้ว งานล้มเหลว/timeout/cancel เก็บกวาดอัตโนมัติเมื่อยืนยัน worker จบ ผ่าน43 lifecycle/ownership assertions และ15 Git-pack assertions ผ่าน supervisor จริง ยังเหลือ app-data allocation, recovery, snapshot publication และ UI Fetch

อัปเดต 2026-09-30: เพิ่ม supervisor สำหรับ fetch แยก timeout จาก advertisement และตรวจ parent path/reparse points แล้ว Cargo checks +29 native assertions ผ่าน ยังต้องทำการจองพื้นที่ staging, cleanup/restart และเผยแพร่ผลเข้า repository หลักก่อนเปิด Fetch ใน UI

อัปเดต 2026-09-30: เพิ่ม native fetch ลง bare repository ชั่วคราว และตรวจด้วย Git pack จริงผ่าน15 assertions + advertisement regression14 assertions; Cargo checks ผ่าน ยังไม่เชื่อม Fetch กับ UI/repository หลัก ต้องทำ supervisor, path ownership, cancel/cleanup และเผยแพร่ snapshot ให้ recover ได้ก่อน ดู GIT-FETCH-STAGING.md ส่วน migration ทั้งหมดยังไม่เสร็จ

อัปเดต: 30 กันยายน 2026  
สถานะ: **กำลังดำเนินการ — โครงสร้างใหม่และฟีเจอร์หลักมีแล้ว แต่ยัง migrate ไม่ครบและยังไม่พร้อม release ทดแทนทุกฟีเจอร์**

เอกสารนี้สรุปจาก checkpoint ล่าสุดและ artifacts รวม Playwright native branch deletion acceptance รอบล่าสุด ข้อความ pending ใน checkpoint เก่าอาจถูกแทนด้วยงานที่เสร็จภายหลังแล้ว

## กติกา UI tests ล่าสุด

**ห้ามใช้ browser-use** ให้เขียน Playwright JavaScript เป็นไฟล์แยกตามเรื่อง ใช้ shared fixtures/helpers และรันด้วย Bun เมื่อตรวจเรื่องเดิมให้แก้หรือรัน scenario เดิมซ้ำ เจ้าของอนุญาตให้สร้าง UI test scripts ตามแนวทางนี้แล้ว

## ข้อตกลงที่ยืนยันแล้ว

- Tauri 2 / Rust backend; Svelte frontend ด้วย JavaScript; ใช้ Bun สำหรับ JavaScript tooling
- คงหน้าตาและ layout ของ Insomnium เดิม
- ใช้ E:\.dvgamerr-app\jirasync-hub-app เป็น reference แบบอ่านอย่างเดียว
- Legacy อยู่ใน `_backup/legacy-electron/`; `/_backup/` อยู่ใน .gitignore ห้ามลบ
- อ่าน official docs ก่อน implement/init และบันทึกลิงก์กับคำสั่งใน docs/migration
- ไม่ใช้ Node/npm/npx/pnpm/yarn/Python/pip; บน Windows ใช้ node_repl เป็น launcher เรียก Bun/โปรแกรมโดยตรงด้วย shell:false และ windowsHide:true
- ไม่สร้างหรือแก้ test scripts สำหรับฟีเจอร์ใหม่โดยไม่ได้รับคำขอ; ใช้ build/compiler checks และการตรวจตามขอบเขตที่อนุญาต

## ทำถึงไหนแล้ว

“มี implementation” ไม่ได้แปลว่าผ่านการตรวจครบทุกกรณีในแอปจริง

| ส่วน | ทำแล้ว | ยังเหลือ |
| --- | --- | --- |
| โครงสร้างและ backup | Tauri 2 + Svelte JavaScript + Bun, Rust backend และ legacy backup | CI และ platform matrix |
| UI และจัดการข้อมูล | Sidebar/collections/folders/requests, environments, tabs, response panes, themes, CRUD/copy/move/search | เทียบ UI/keyboard/resize/light-dark ทั้งแอปกับของเดิม |
| HTTP / body / history | Native transport, body หลัก, headers/status/timing/history, timeout/Stop | Encoding/redirect/network edges และ native acceptance ให้ครบ |
| Authentication / TLS | Basic/Bearer/API key, Digest, OAuth1/2/PKCE, AWS IAM, Hawk, ASAP, NTLM, netrc และ certificate settings | Provider จริง, login WebView, proxy/TLS/client certificates และ compatibility edges |
| Templates / environments / cookies | Isolated renderer, inheritance, built-in tags, prompt/dependencies, shared rendering และ cookie jar | Custom plugins, legacy cookie template source/lifecycle และ rendering edges |
| GraphQL / WebSocket / SSE / gRPC | Editors/transports หลัก, streaming/Stop, proto/reflection | Completion/navigation, native UI/IPC/reload และ stream/history parity |
| Storage / import / export | Atomic save/backup; Insomnia/Postman/HAR/NeDB/OpenAPI/cURL; native paste import ผ่านบาง flow | OS picker, legacy หลายไฟล์/external assets/recovery และ cURL options/files |
| API Design | OpenAPI editor/import/export/preview, structural validation/local refs และ request generation | Spectral/custom rules และ advanced serialization |
| Tests / Runner | Mocha/Chai ใน QuickJS worker, suite/test CRUD, JS editor, Run/Stop, shared sender และ saved results | Script/import/result/lifecycle compatibility ที่เหลือ |
| Git local | Setup/resume, staging/partial commit/history, create-and-switch/continue/forget, guarded delete, สลับ committed local branch และ journal/recovery | Unborn/detached/remote, fetch/pull/push/merge และ failure acceptance เพิ่มเติม |
| Desktop / packaging | Dialogs/window state/single instance/icons/shortcuts; เคย build Windows EXE/NSIS ผ่าน | Native menus, package ล่าสุด และ install/upgrade/uninstall |
| Custom plugin runtime | มีพื้นฐาน renderer และ built-in tags | ยังไม่ครบ runtime/compatibility ของ plugin เดิม |

## งานล่าสุด: Git checkout และ recovery

### มีโค้ดและเชื่อมแล้ว

- Frontend coordinator รอให้งานที่กำลังทำจบ/ยกเลิก บันทึก baseline และวางแผนรวมข้อมูลแบบ three-way ก่อน checkout
- Persistence queue บล็อกการแก้ข้อมูล/เริ่มงาน/save ระหว่าง transition และเมื่อยังต้อง recovery
- Native journal เก็บ before/after ตรวจ refs/HEAD ภายใต้ lock เปลี่ยน HEAD แล้วบันทึก workspace; load สามารถ recovery จาก journal
- ซ่อม active request/environment/tabs เฉพาะรายการที่ใช้ไม่ได้ และรักษา history ของ request ที่ไม่มีใน branch ปัจจุบัน
- Git dialog สลับ local branch ที่มี commit แล้วได้
- Recovery dialog แยกจากส่วน UI ที่ถูกล็อก; retained edits ต้องบันทึกสำเนาและ review snapshot ตรงกันก่อนยอมแทนที่

### ตรวจผ่านแอป Tauri จริงแล้ว ตามขอบเขตหลักฐาน

- สลับ main → target และกลับ; HEAD และ persisted resources ตรงกัน
- รักษา local edit ที่ไม่ conflict, private/foreign resources, tabs ที่ยังใช้ได้ และ history หลัง reload
- ปฏิเสธ conflicting deletion โดยไม่ทำ local edit หาย
- Native ref-lock failure ก่อนสร้าง journal เปิด recovery dialog ที่กด Retry ได้; ปลด fixture lock แล้ว Retry สำเร็จ
- มีหลักฐาน 16 assertions ใน [native acceptance](../../artifacts/native-checkout-ui-probe/acceptance.json)

### Fix ล่าสุดและ build ที่ค้างจากรอบก่อน

พบข้อความ conflict หายจาก Git dialog หลัง reload; แก้ source แล้วและ compiled-handler checks ผ่าน

**Native recheck build จบสำเร็จแล้ว (exit code 0)** จาก [build-state.json](../../artifacts/native-checkout-ui-recheck/build-state.json) ใช้เวลาประมาณ 5 นาที 6 วินาที ไม่ต้องเริ่ม build เดิมซ้ำเพียงเพราะ checkpoint เก่าระบุว่ากำลังรัน

Executable: `artifacts/native-checkout-ui-recheck/insomnium-checkout-probe.exe`  
Identity: `app.insomnium.probe.checkout20260929`

**ตรวจ fix ผ่านแอปจริงแล้ว:** ข้อความ conflict คงอยู่หลัง staging reload, HEAD ยังเป็น main และ local edit อยู่ครบหลัง fresh-document reload; ตรวจ screenshot แล้ว และ probe ปิดด้วย code 0 รวม 5 assertions ใน [conflict recheck](../../artifacts/native-checkout-ui-recheck/conflict-recheck.json) Build นี้เป็น probe แยก identity ไม่ใช่ production release

## Native post-HEAD failure/recovery ล่าสุด

ผ่าน 18 assertions โดยใช้ Tauri IPC จริงและ JS client/planner จริง: บล็อกการเขียน workspace ด้วย Windows sharing handle, ยืนยัน HEAD เปลี่ยนแต่ before workspace/journal ยังอยู่, save ถูกปฏิเสธ, recovery ยังล้มเหลวขณะถือ handle และสำเร็จหลังปลด handle พร้อมรักษา history/local edit จากนั้น fresh-document reload แสดง target ถูกต้อง หลักฐาน [post-head-ipc.json](../../artifacts/native-checkout-ui-recheck/post-head-ipc.json)

Probe ปิดด้วย code 0 แล้ว; fixture อยู่ target และไม่มี pending journal ยังไม่ใช่การตรวจ mounted coordinator เมื่อเกิด failure, fresh-process/crash recovery, OS picker หรือ OS-close lifecycle

## Startup recovery ผ่าน process ใหม่

ผ่าน 18 assertions: สร้าง pending journal จาก native failure จริงใน target → main, ปิด process แรกขณะยังถือ sharing handle แล้วปลด handle และเปิดใหม่ Startup กู้ข้อมูล main เองโดยไม่ได้เรียก recovery IPC จาก probe รักษา local edit/history/private/foreign ครบ และปิดทั้งสอง process ด้วย code 0 หลักฐาน [startup-recovery.json](../../artifacts/native-checkout-ui-recheck/startup-recovery.json)

เป็นการปิดหลัง native คืน error แล้ว ยังไม่ใช่ crash ระหว่าง transaction หรือ stale-lock acceptance

## Native create-branch retry ล่าสุด

เพิ่ม optional operationId และตรวจหลักฐาน creation reflog/source/author/tip ภายใต้ lock ก่อนยอมรับ retry โดยไม่เขียน ref ซ้ำ Cargo fmt/check/clippy และ actual-source assertions 14 ข้อผ่าน ดู [ผลตรวจ](../../artifacts/git-create-retry-check/probe-state.json)

Checkpoint เดิมนี้ถูกต่อยอดเป็น durable frontend intent และ create-and-switch UI พร้อม native acceptance ด้านล่างแล้ว หากหลักฐานหาย/ไม่ตรงจะปฏิเสธแทนการเขียนทับ branch

## Create-and-switch UI ล่าสุด

มี durable intent prepared/submitted/created, native verify-only resume และ UI Create/Continue/Forget แล้ว รักษา operation ID ข้าม session และไม่สร้าง ref ที่หายไปซ้ำอัตโนมัติ Frontend/Cargo checks ผ่าน พร้อม coordinator 31 ข้อและ native 18 ข้อ ตรวจ UI จริงผ่านไฟล์ Playwright ตามขอบเขตด้านล่างแล้ว

Native build artifacts/native-create-ui-probe/build-state.json จบ code 0 แล้ว และสาม Playwright scenarios ผ่านตามขอบเขตด้านล่าง

## Playwright UI scenarios ผ่านแล้ว

Native build จบ code 0 และรันไฟล์ Playwright ด้วย Bun ผ่านทั้ง 3 เรื่อง: create-and-switch/reload, resume pending intent และปฏิเสธ operation ไม่ตรงพร้อม Forget โดยไม่ลบ branch ดูวิธีรันซ้ำใน [tests/ui/README.md](../../tests/ui/README.md) และไฟล์ tests/ui/git-create-and-switch.js, git-create-resume.js, git-create-forget.js

ใช้ playwright-core 1.63.0 กับ WebView2 ของ native probe ไม่มี browser-use รอบแรกแก้ fixture ให้มี workspace metadata ครบแล้วรัน scenario เดิมซ้ำผ่าน ผลอยู่ artifacts/playwright ไม่ได้อ้างว่าเป็น lost IPC reply/crash/OS picker/full visual acceptance

## Branch deletion ล่าสุด

Native build ใหม่จบ code 0 แล้ว และ Playwright ผ่านทั้ง 3 เรื่อง รวม 13 checks: ลบ merged branch/รักษา HEAD และข้อมูล/reload, ปฏิเสธ unmerged และ stale target tip, ปฏิเสธเมื่อ HEAD เปลี่ยนหลังเปิด dialog และต้องกดใหม่หลัง reload จึงลบ merged ancestor ได้

หลักฐานอยู่ใน artifacts/playwright/:

- git-delete-branch-1790768615482
- git-delete-unmerged-1790768566676
- git-delete-stale-session-1790768580216

แต่ละโฟลเดอร์มี result.json และ acceptance.json; ทุก probe ปิด code 0 ไม่มี build ค้างจาก milestone นี้ แก้ selector ในสคริปต์รอบแรกและเพิ่มการรอโหลด Git session ก่อนตรวจว่า branch หายแล้ว ไม่ได้แก้ app source รอบนี้ Svelte check ผ่าน 0 errors / 0 warnings

ใช้ไฟล์ tests/ui/git-delete-branch.js, git-delete-unmerged.js และ git-delete-stale-session.js รันซ้ำตาม [README](../../tests/ui/README.md) ไม่มี browser-use ผลนี้ยังไม่ครอบคลุม remote/crash/OS-close/full visual parity

## ผลตรวจที่ยืนยันจาก artifacts

| ชุดตรวจ | ผล | ขอบเขต |
| --- | --- | --- |
| Frontend ล่าสุด | Prettier, Svelte sync/check และ Vite build จบ code 0 | [state](../../artifacts/checkout-ui-check/state.json) |
| Checkout coordinator | 34 assertions ผ่าน | โมดูลจริง แต่ mock native/storage boundaries |
| Compiled Svelte handlers | 11 assertions ผ่าน รวม conflict text หลัง reload | Mock dialog/filesystem/IPC; ไม่ใช่ OS picker จริง |
| Native selection/journal | Cargo fmt/check/clippy ผ่าน; standalone probe compile/run code 0 | Rust probe ไม่แทนการตรวจ Tauri UI ทั้งระบบ |
| Native checkout UI รอบก่อน | 16 assertions ผ่าน พร้อม defect ที่แก้ source แล้ว | รวม switch/reload/conflict และ pre-journal ref-lock recovery |
| Native recheck build/UI | Build code 0; acceptance 5 ข้อผ่าน | Conflict ใน dialog, HEAD/local edit/reload และปิด probe; ยังไม่ใช่ post-HEAD failure acceptance |

หลักฐานเพิ่มเติม: [coordinator](../../artifacts/checkout-ui-check/coordinator-probe.json), [handlers](../../artifacts/checkout-ui-check/component-probe.json), [Cargo checks](../../artifacts/native-selection-check/state.json), [native probe](../../artifacts/native-selection-check/probe-state.json)

Runner เคยผ่าน native flow ทั้งผลผ่าน/ล้ม, cookie round-trip, Stop และ reload รวม sendRequest callback fix; paste Import ผ่าน invalid input/review/cancel/additive apply/reload ตาม [Runner acceptance](NATIVE-RUNNER-ACCEPTANCE.md) และ [Import UI](IMPORT-UI.md) ยังไม่ใช่ acceptance ครบทุก parity item

## แผน Git remote จาก source เดิม

ตรวจ URL/settings/provider credentials/clone/fetch/pull/push/merge แล้ว และบันทึกขั้นตอนพร้อมเกณฑ์ตรวจรับใน [GIT-REMOTE.md](GIT-REMOTE.md) พบว่า journal ปัจจุบันใช้ได้กับการเปลี่ยน branch แต่ยังใช้กับ pull/merge ที่เลื่อน commit ของ branch เดิมไม่ได้ ต้องเพิ่ม journal แบบมี version และตรวจ old/new OID ก่อนเชื่อม workflow นี้

ขั้นถัดไปคือ settings/auth และอ่านรายการ branch จาก remote ตามด้วย fetch แล้วจึง advance-ref journal/pull/merge/clone/push ตามลำดับ เพิ่ม native command อ่าน advertised branches แล้ว Cargo checks และ 14 assertions กับ loopback fixture ผ่าน เพิ่ม worker timeout/cancel แล้วและ Cargo checks + 14 lifecycle assertions ผ่าน ดู [GIT-REMOTE-LIFECYCLE.md](GIT-REMOTE-LIFECYCLE.md) ตรวจผ่าน native app/IPC ด้วย saved Playwright แล้ว: 7 checks รวม timeout จริง 30021ms, cancel/pre-cancel, Git dialog ยังตอบสนองและข้อมูลไม่เปลี่ยน หลักฐาน artifacts/playwright/git-remote-lifecycle-1790769998943 ยังเหลือ remote settings/Stop UI, provider จริง และ fetch/pull/push acceptance

## เหลืออะไรและควรทำตามลำดับไหน

1. **ปิด acceptance ของ checkout/recovery**
   - ตรวจ conflict text ใน native Git dialog แล้ว; ขั้นถัดไปคือ failure/recovery ด้านล่าง
   - ตรวจ native OS save picker/retained-copy/review ทั้ง cancel, write failure และ success
   - ผ่าน workspace write failure หลัง HEAD เปลี่ยนผ่าน Tauri IPC แล้ว; ผ่าน fresh-process startup recovery แล้ว; ต่อ mounted failure coordinator และ abrupt interruption
   - ตรวจ IPC outcome ไม่แน่นอน, process interruption/stale locks และการปิดแอประหว่างมีงาน
   - หมายเหตุ: post-HEAD file-sharing failure ผ่าน Tauri IPC แล้ว แต่การลอง override Tauri invoke ไม่สำเร็จ จึงยังห้ามนับว่า lost-reply scenario ผ่าน

2. **ทำ Git branch/remote ให้ครบ**
   - Create-and-switch/continue/forget และ guarded delete ผ่าน native Playwright แล้ว; ต่อ remote settings/auth/clone/fetch/pull/push/merge ตาม legacy inventory และ official docs
   - Unborn/detached/remote branches
   - Remote authentication, fetch/pull/push, merge/conflict และ rollback
   - ตรวจ local/private/foreign data ไม่สูญหายทุก transition

3. **ปิดช่องว่าง compatibility**
   - Custom plugin runtime
   - Runner script/import/result/lifecycle
   - Legacy cookie template source และ edit/delete/clear/restore
   - URL/query/path encoding และ SSE raw response history
   - cURL mixed files/options/config/form
   - OpenAPI Spectral/custom rules/serialization และ GraphQL completion/navigation
   - Legacy external assets/recovery และ native menus

4. **ตรวจรับทั้งระบบและ UI เดิม**
   - ทุก protocol ผ่าน UI/native รวม Stop/reload/error handling
   - Provider จริง, redirects/proxy/TLS/client certificates
   - Import/export/OS picker/backup/recovery และ legacy หลายไฟล์
   - Light/dark, keyboard/focus, resize, editors/dialogs และ window close lifecycle

5. **เตรียม production release**
   - Bun-only CI และ platform matrix
   - Build EXE/NSIS จาก source ล่าสุด
   - ตรวจ install/launch/upgrade/uninstall
   - อัปเดต README, migration/recovery guide และ BUILD fingerprint
   - ปิดทุก parity item หรือให้เจ้าของระบุรายการที่ตัดออกจาก scope

## เริ่มต่อใน session ใหม่

1. อ่าน [STATUS.md](STATUS.md), [PLAN.md](PLAN.md), [PARITY.md](PARITY.md) และเอกสารนี้ โดยใช้ checkpoint ใหม่สุดเมื่อข้อความขัดกัน
2. อ่าน [GIT-INVENTORY.md](GIT-INVENTORY.md) และ [CHECKOUT-TRANSACTION.md](CHECKOUT-TRANSACTION.md)
3. Native conflict-message และ post-HEAD write-failure IPC acceptance ผ่านแล้วและ probe ปิดแล้ว; ผ่าน fresh-process startup recovery แล้ว; ต่อ mounted failure coordinator, retained-copy OS picker/review และ interruption/stale locks
4. Build สำหรับ saved Playwright ล่าสุดอยู่ที่ `artifacts/native-delete-ui-probe/build-state.json` และจบ code 0 แล้ว ใช้ helpers ที่ตรวจ probe identity และสร้าง fixture แยกต่อ scenario รันทีละไฟล์ ไม่ใช้ browser-use หรือ ad-hoc UI automation ตรวจข้อมูลจริงก่อนใช้ fixture เก่า
5. จุดโค้ดหลัก: `src/lib/git-checkout.js`, `git-workspace.js`, `workspace.svelte.js`, `components/GitPanel.svelte`, `components/GitRecovery.svelte`, `src-tauri/src/git_journal.rs` และ `storage.rs`
6. อ่าน official docs ก่อนแก้ subsystem; หลัง milestone/failure/decision อัปเดต STATUS พร้อมหลักฐาน/ข้อจำกัด/ขั้นถัดไป และทำให้สรุปนี้ตรงกัน

## ข้อจำกัดก่อนเรียกว่างานเสร็จ

- Full migration ยังไม่เสร็จ ไม่ประเมินเปอร์เซ็นต์จากจำนวนไฟล์หรือ assertions
- [BUILD.json](BUILD.json) เป็น production package เมื่อ 28 กันยายน 2026 เวลา 04:01 UTC ซึ่งเก่ากว่า source ปัจจุบัน
- Probe executable ใช้ identity สำหรับตรวจรับ ห้ามแจกแทน production package
- Artifacts ถูก Git ignore; session/เครื่องใหม่ต้องตรวจว่าหลักฐานและ fixture ยังอยู่

## Remote client ล่าสุด

เพิ่ม client และ workspace wrapper สำหรับส่ง cancel, รอ native completion และปฏิเสธผลเก่าหลังเปลี่ยน collection/settings แล้ว ตรวจผ่าน 10 client + 6 wrapper assertions แบบ mock boundaries และ frontend build/Svelte check ยังต้องเพิ่ม remote settings/connection/Stop controls และตรวจ mounted UI ด้วย saved Playwright; ยังไม่ใช่ remote workflow ครบ

## Remote settings UI ล่าสุด

เพิ่ม Save remote settings, Read remote branches, Stop และ provider token fields ใน Git dialog เดิมแล้ว มี URL normalization และบันทึก settings locally; portable export ตัด Git credentials ออก แต่ import ยังอ่าน settings เดิมได้ 15 model/export assertions และ frontend check/build ผ่าน

Native build จบ code 0 แล้ว และ tests/ui/git-remote-settings.js ผ่าน 8 checks บนแอปจริง รวม save/read/reload/auth error/Stop/เปลี่ยน URL/ปิด dialog โดยข้อมูลคงเดิม หลักฐาน artifacts/playwright/git-remote-settings-1790770895847 แอปปิด code 0 ยังเหลือ provider จริง, fetch/pull/merge/clone/push และ parity อื่น
