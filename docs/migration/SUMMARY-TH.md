# สรุปสถานะย้าย Insomnium ไป Tauri

อัปเดต: 29 กันยายน 2026  
โปรเจกต์: `E:\insomnium`  
สถานะล่าสุด: **กำลังพัฒนา — ยังไม่เสร็จทั้งระบบ และยังไม่ผ่านการตรวจรับเพื่อใช้แทนเวอร์ชันเดิมทั้งหมด**

## ภาพรวม

เปลี่ยนโครงสร้างจาก Electron/React เป็น **Tauri 2 + Rust + Svelte JavaScript + Bun** แล้ว มีโค้ดสำหรับงานหลักและโปรโตคอลหลายส่วน พร้อมผลตรวจ compiler/build และการตรวจพฤติกรรมเฉพาะส่วน

สิ่งที่ยังต้องทำไม่ได้มีแค่เก็บรายละเอียด: ยังมี Collection Runner, Git sync, custom plugin runtime และความต่างจากพฤติกรรมเดิมหลายรายการ รวมถึงการเปิดแอปจริงตรวจ UI, IPC, เครือข่าย, การเก็บข้อมูล และ installer ล่าสุด

ไม่ระบุเปอร์เซ็นต์ความสำเร็จ เพราะแต่ละส่วนมีขนาดและระดับการตรวจไม่เท่ากัน และหลายส่วนมีโค้ดแล้วแต่ยังไม่ได้ตรวจใช้งานจริงครบวงจร

## 1. โครงสร้างและข้อกำหนดที่ทำแล้ว

- ใช้ Tauri 2 เป็น desktop shell และ Rust/Cargo เป็น native backend
- Frontend ใช้ Svelte + JavaScript ผ่าน SvelteKit/Vite; ใช้ Bun สำหรับ JavaScript tooling
- `package.json` ระบุ Bun 1.4.2 และ scripts ใช้ Bun; ไม่มี Node sidecar ตามแผน
- คงแนวหน้าตา Insomnium เดิม: sidebar, collection/environment, request tabs, URL/send row, response panes และสีหลักเดิม
- ย้ายโค้ด Electron/React เดิมไว้ที่ `_backup/legacy-electron/` และมี `/_backup/` ใน `.gitignore`
- ใช้ `E:\.dvgamerr-app\jirasync-hub-app` เป็น reference ของโครงสร้าง Tauri/Bun ตามบันทึก migration
- มีแผน, ตาราง parity, ประวัติการทำงาน, เอกสารราย subsystem และหลักฐาน build สำหรับทำต่อข้าม session
- การเปรียบเทียบหน้าตาจริงกับเวอร์ชันเดิมยังไม่ผ่านการตรวจรับครบ

## 2. ฟังก์ชันที่มี implementation แล้ว

คำว่า “มี implementation” ในตารางนี้หมายถึงมีโค้ดแล้ว ไม่ได้หมายความว่าผ่านการตรวจใช้งานจริงทั้งหมด

| ส่วน | สิ่งที่ทำแล้ว | สถานะที่ยังต้องระวัง |
| --- | --- | --- |
| Collections / folders / requests | สร้าง แก้ไข ลบ คัดลอก ย้าย เรียง และค้นหา; สลับ collection/request | ต้องตรวจ persistence และ workflow จริงครบ |
| HTTP / response / history | Native HTTP, body/header/status/timing, history, timeout และ cancellation | ต้องตรวจ UI → IPC → native → network จริง |
| Request body | JSON, text, XML, form-urlencoded, multipart และ binary | ต้องตรวจไฟล์และกรณีขอบเขตจริง |
| Authentication | Basic, Bearer, API key, Digest, OAuth1/2, PKCE, AWS IAM, Hawk, ASAP, NTLM และ netrc | มีผลตรวจเฉพาะส่วนหลายชุด; provider, WebView, TLS และบาง edge case ยังไม่ครบ |
| Environments / templates | Base/sub/folder inheritance, environment ต่อ collection, shared renderer, built-in tags, prompt และ response dependency | Custom plugins และความเทียบเท่าทั้งหมดของ legacy ยังไม่ครบ |
| Cookies | Native jar แยก collection, CRUD, persistence, send/store flags, preview/restore ข้อมูลเก่า, snapshot ต่อ request และ template rendering | Template source บางชนิดจาก legacy ยังนำเข้า native jar ไม่ได้ |
| Redirect / proxy / TLS | มีค่าตั้งต้นและ native handling, custom CA และ client certificate ตาม host | ต้องตรวจ proxy/certificate/redirect จริง |
| GraphQL | Query/variables/operation, GET/POST, introspection, schema import/browser/export, format/validation | Editor completion/navigation และ native/UI acceptance ยังมีงานค้าง |
| WebSocket | Connect/send/receive/close, text/binary/ping, headers/subprotocols, saved payloads/history และ Connect and send | ต้องตรวจการทำงานจริงและ legacy log parity |
| SSE | Incremental events, event ID/retry metadata, cancel/history และใช้เป็น response dependency ได้ | Live event history กับ raw response history ยังต้องปรับให้ตรงกัน |
| gRPC | Proto/reflection, unary/streaming, metadata/TLS, method groups, message editor และ shared rendering | Native wire/codec, UI/IPC/reload และรายละเอียด JSON ยังต้องตรวจครบ |
| Local data | Atomic save/backup และอ่าน legacy NeDB โดยไม่แก้ source | External assets และ recovery/migration จริงยังมีงานค้าง |
| Import/export | Insomnia, Postman, HAR, NeDB และ OpenAPI JSON/YAML พร้อมสร้าง requests | curl import และบาง advanced serialization ยังไม่ครบ |
| API design / OpenAPI | Source editor, import/export, operations/schema preview, structural validation และ local refs | Spectral/custom rules และ advanced serialization ยังไม่ครบ |
| Desktop integration | Dialogs, window state, single instance, icons และ shortcuts | Native menus และการตรวจ platform/UI ยังไม่ครบ |
| Packaging | เคย build Windows executable และ NSIS installer สำเร็จ | Installer ยังไม่ตรงกับ source ล่าสุด และยังไม่ผ่าน acceptance ครบ |

## 3. งานล่าสุดที่เสร็จในระดับ implementation

1. **Shared template renderer** เชื่อมกับ HTTP, response dependency ข้าม collection, GraphQL introspection, OAuth, WebSocket payload และ gRPC
2. **WebSocket Connect and send** render payload ก่อน handshake และส่งครั้งเดียวเมื่อ connection เปิด; รองรับ Stop และข้อผิดพลาด
3. **SSE response dependency** รอ body จบก่อนใช้ผลลัพธ์; ยกเลิกได้และมี timeout
4. **Browser preview** จำกัด response ระหว่างอ่านไว้ที่ 20 MiB โดยไม่คืนผลสำเร็จบางส่วนเมื่อเกินขนาด
5. **User-Agent** ส่ง suppression flag จาก frontend ถึง Rust และรักษา explicit header ที่เปิดใช้งาน
6. **Cookie isolation** แต่ละ request ใช้ snapshot แยกกัน รวมกลับเฉพาะ Set-Cookie ที่ได้รับ และไม่เขียน snapshot เก่าทับ jar ใหม่
7. **Cookie rendering** โหลด snapshot ก่อน render, ส่งผ่าน IPC, ตรวจ generation/ขนาด และ render key/value แยกจาก attribute
8. **OAuth Fetch/Refresh** ใช้ cookie snapshot ที่ render แล้ว; token preview และ saved-token adoption ไม่โหลด cookie เพิ่ม

Checkpoint ล่าสุดคือ **Explicit OAuth cookie rendering** ดูรายละเอียดใน [STATUS.md](STATUS.md)

## 4. ผลตรวจที่มีแล้ว และขอบเขตของหลักฐาน

| การตรวจ | ผลล่าสุดที่บันทึกไว้ | ยังไม่พิสูจน์อะไร |
| --- | --- | --- |
| Svelte check | 0 errors / 0 warnings | ความถูกต้องของ UI และ workflow จริงทั้งหมด |
| Vite production build | ผ่าน | การทำงานใน Tauri WebView จริง |
| Cargo check / fmt / clippy | ผ่านหลังการแก้ native ล่าสุด | พฤติกรรมเครือข่ายและ platform จริงทุกกรณี |
| Inline frontend / mocked IPC checks | ผ่านหลาย milestone; ล่าสุด OAuth/cookie 25 assertions | ไม่ใช่ end-to-end native/provider test |
| Native cookie probe | ล่าสุด structured snapshot/provider 17 assertions ผ่าน | ไม่ใช่การเปิด desktop app ตรวจทั้งระบบ |
| Windows executable / NSIS | มี build checkpoint สำเร็จ | ไม่ใช่ package ของ source ล่าสุด |

จำนวน assertions แต่ละ milestone มีการตรวจซ้ำ จึงไม่ควรนำมาบวกเป็นจำนวน test ที่ไม่ซ้ำหรือใช้แทนเปอร์เซ็นต์ความสำเร็จ

บันทึก installer ล่าสุดใน [BUILD.json](BUILD.json) คือ **28 กันยายน 2026 เวลา 04:01 UTC**  
**Source ปัจจุบันใหม่กว่า installer นี้** ต้อง build และตรวจรับใหม่ก่อนแจกใช้งาน

รายงานนี้อ่านหลักฐานและไฟล์ปัจจุบันเพื่อสรุปสถานะ ไม่ได้รันชุด build/acceptance ใหม่ทั้งระบบในรอบสรุปนี้

## 5. งานที่ยังเหลือ

### A. ฟีเจอร์ที่ยังไม่ครบ

- [ ] Collection Runner และ user-authored assertions/API tests
- [ ] Git sync / workflow เดิมที่เกี่ยวข้อง
- [ ] Custom plugin runtime และความเข้ากันได้กับ plugins เดิม
- [ ] curl import
- [ ] Spectral/custom OpenAPI rules และ advanced serialization
- [ ] GraphQL completion/navigation และรายละเอียด editor ที่ยังค้าง
- [ ] Native menus และ desktop integration ที่ยังไม่ครบ
- [ ] Legacy external assets และกรณี migration/recovery ที่ยังไม่รองรับ

### B. ความต่างของพฤติกรรมที่กำลังเก็บ

- [ ] Cookie template จาก legacy ที่ native CookieStore ยังแทนไม่ได้ เช่น template ในชื่อ/domain/path/expiry บางรูปแบบ
- [ ] ออกแบบการเก็บ แก้ ลบ และ clear cookie template source อย่างชัดเจน
- [ ] ห้ามนำ retained Restore records มาทับ jar ทุก Send เพราะจะทำให้ cookie ที่ลบแล้วกลับมา
- [ ] URL/query/path encoding และพฤติกรรม legacy ที่ยังไม่เทียบครบ
- [ ] Live SSE event history กับ completed raw HTTP response history
- [ ] Auth, redirect, cookie, cancellation และ stream lifecycle edge cases ที่ยังค้างตามเอกสารแต่ละส่วน
- [ ] Custom cookie extensions และข้อจำกัดของ native cookie representation

### C. การตรวจรับจริงที่ยังต้องทำ

- [ ] เปิด Tauri app และเปรียบเทียบหน้าตา/interaction กับ Insomnium เดิม
- [ ] ตรวจ light/dark, keyboard, resize, editor, dialogs และ window lifecycle
- [ ] ตรวจ HTTP/GraphQL/WebSocket/SSE/gRPC ผ่าน UI และ IPC จริง
- [ ] ตรวจ OAuth login/callback/provider, proxy, TLS และ client certificates
- [ ] ตรวจ User-Agent/cookie/redirect บนเครือข่ายจริง
- [ ] ตรวจ import/export, save/reload, backup/recovery และข้อมูล legacy ตัวอย่าง
- [ ] ตรวจ native WebView/CSP, error handling และปิดแอประหว่างมีงานค้าง
- [ ] ตรวจตามทุก acceptance item ใน PARITY; compiler ผ่านอย่างเดียวไม่เพียงพอ

### D. การส่งมอบ

- [ ] Build executable/NSIS ใหม่จาก source ล่าสุด
- [ ] ตรวจติดตั้ง เปิดใช้งาน อัปเกรด และถอนการติดตั้ง
- [ ] ทำ Bun-only CI และ platform build/acceptance matrix
- [ ] ตรวจ README, run/migrate/recovery instructions ให้ตรงกับ release ที่ส่งจริง
- [ ] อัปเดต BUILD fingerprint และหลักฐาน package
- [ ] ปิด parity ทุกข้อ หรือมีการยืนยันจากเจ้าของให้นำออกจาก scope ก่อนประกาศ migration เสร็จ

## 6. ลำดับงานแนะนำจากจุดนี้

1. ปิดการออกแบบและ implementation ของ legacy cookie template source โดยรักษา semantics การลบ/แก้ไข
2. เก็บ URL encoding, SSE raw history และ transport/rendering parity ที่ค้าง
3. เปิดแอปจริงตรวจ flow หลักและ UI เพื่อค้นหาปัญหาที่ mocked checks มองไม่เห็น
4. ทำ feature gaps: runner/assertions, Git, plugins, curl และ OpenAPI/editor/desktop ส่วนที่เหลือ
5. ตรวจ acceptance ทั้งระบบและแก้ผลกระทบระหว่าง subsystem
6. ทำ CI/platform checks, build installer ล่าสุด, ตรวจ package และอัปเดตคู่มือส่งมอบ

งานข้อ 3 ควรเริ่มควบคู่กับการเก็บ parity ไม่ควรรอจนเขียนทุกฟีเจอร์ครบจึงตรวจแอปจริงครั้งแรก

## 7. ไฟล์สำหรับทำต่อข้าม session

| ไฟล์ | ใช้ทำอะไร |
| --- | --- |
| [STATUS.md](STATUS.md) | อ่าน checkpoint ล่าสุดก่อนเริ่มงาน |
| [PLAN.md](PLAN.md) | แผน ลำดับงาน ข้อกำหนด และคำสั่ง |
| [PARITY.md](PARITY.md) | ตรวจความครบกับระบบเดิมและ acceptance |
| [COOKIE-RENDERING.md](COOKIE-RENDERING.md) | งาน cookie ปัจจุบันและข้อจำกัดของ legacy source |
| [MANUAL-OAUTH-RENDERING.md](MANUAL-OAUTH-RENDERING.md) | OAuth rendering และ Fetch/Refresh |
| [DEPENDENT-RESPONSES.md](DEPENDENT-RESPONSES.md) | Response dependency / SSE completion |
| [WEBSOCKET-RENDERING.md](WEBSOCKET-RENDERING.md) | Payload rendering และ Connect and send |
| [GRPC-RENDERING.md](GRPC-RENDERING.md) | gRPC shared renderer |
| [USER-AGENT.md](USER-AGENT.md) | Native header suppression |
| [BUILD.json](BUILD.json) | หลักฐาน source และ package ของ build ที่เคยทำ |

บางแถวสรุปใน PARITY และข้อความ checkpoint เก่ายังกล่าวถึงงานที่แก้ในภายหลังแล้ว ให้ใช้ checkpoint ล่าสุดและเอกสาร subsystem ประกอบ ไม่ใช้ข้อความเก่าเพียงแถวเดียวตัดสินว่างานยังค้างหรือเสร็จแล้ว

การทำต่อยังต้องใช้ Bun/JavaScript, รักษา Svelte JavaScript และ UI เดิม, อ่าน official docs ก่อน implementation, ไม่ลบ `_backup` และอัปเดต STATUS เมื่อจบ milestone หรือพบปัญหา
