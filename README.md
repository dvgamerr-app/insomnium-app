# Insomnium — Tauri migration

API client แบบ local-first กำลังย้ายจาก Electron/React ไป Tauri 2 + Svelte 5 (JavaScript) โดยคง layout และสีหลักของ Insomnium เดิม

**สถานะ: ยังไม่ครบทุกฟีเจอร์ของระบบเดิม** ดูงานที่ทำแล้วและงานถัดไปใน [STATUS](docs/migration/STATUS.md) และ [feature parity](docs/migration/PARITY.md)

## เริ่มทำงาน

ใช้ Bun 1.4.2+, Rust stable, และ [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) สำหรับ OS นั้น บน Windows ต้องมี MSVC C++ Build Tools และ WebView2 และต้องมี libclang สำหรับ build native OS tag (ไม่ใช่ runtime dependency) ดู [วิธีเตรียม Clang](docs/migration/OS-TEMPLATE.md)

```powershell
bun install --frozen-lockfile
bun run desktop
```

`desktop` เปิด Tauri และเริ่ม frontend dev server ให้แล้ว ถ้าต้องการดูเฉพาะ frontend ใช้ `bun run dev` (browser preview มี CORS และใช้ storage แยกจาก desktop)

```powershell
bun run check
bun run build
bun run native:check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
bun run desktop:build
```

บน Linux `desktop:build` ใช้ build → สร้าง dependency config จาก executable → bundle สำหรับ Debian/RPM/AppImage: Debian ต้องมี `dpkg-shlibdeps` (package `dpkg-dev`) และ package metadata ของ library บนระบบ build เพื่อคำนวณ minimum versions จาก ELF ทุกครั้ง; RPM ต้องมี `rpmdeps` (Debian/Ubuntu: package `rpm`); AppImage ต้องมี `ldconfig`, GLES ที่ตรงกับสถาปัตยกรรมของ executable (Debian/Ubuntu: `libgles2`) และ license ของ library เพื่อรวม GLES ที่ WebKit โหลดตอน runtime ลงใน bundle โดยอัตโนมัติ รองรับ notice มาตรฐานของ Debian/Fedora หรือกำหนด `INSOMNIUM_GLES_LICENSE` ให้ชี้ไฟล์ notice ของ package ที่ใช้ ห้าม override destination `/usr/lib/libGLESv2.so.2` และ notice ที่ wrapper จัดการ

เลือกเฉพาะ Debian (ยังคงสร้าง dependencies ใหม่) ได้ด้วย `bun run desktop:build --bundles deb`; Windows/macOS ส่งคำสั่งต่อให้ Tauri ตามเดิม Linux wrapper รองรับ release/debug, target, features, JSON config และ Cargo `--locked`/`--offline`/`--frozen`; config แบบ JSON5/TOML หรือ Cargo profile/output แบบกำหนดเองให้ใช้ [ขั้นตอน manual ที่ต้องสร้าง metadata ใหม่](docs/migration/LINUX-DISTRIBUTION.md) ห้ามนำ config ที่สร้างจาก binary เก่ามาใช้ซ้ำ Cross-architecture runtime ยังไม่ผ่านการตรวจยืนยัน

JavaScript tooling ทุกคำสั่งใช้ Bun ไม่มี Node server หรือ sidecar ในแอป ใช้ TypeScript 6.0.x เฉพาะเครื่องมือตรวจ JavaScript ไม่ใช้ TypeScript 7 ไม่มี test scripts ใหม่

## ส่วนที่เริ่มย้ายแล้ว

- Shared editor: CodeMirror สำหรับ HTTP/gRPC/GraphQL, response, environment และ OpenAPI พร้อม search/folding, undo แยกตาม resource, environment completion, GraphQL schema/variable completion และ navigation; ตั้ง keymap/indent/wrapping ได้ ยังรอตรวจ WebView จริง ดู [editor migration](docs/migration/EDITOR-TEMPLATE-INVENTORY.md)

- Netrc: native file lookup และ Basic auth แยก credentials ตามปลายทาง redirect; ดู [ข้อกำหนดและข้อจำกัด](docs/migration/NETRC-COMPATIBILITY.md)
- หน้าตา Insomnium: collection sidebar, request tabs, URL/Send, request/response panes, dark/light theme, icon เดิม
- Collection/folder/request: สร้าง แก้ชื่อ ทำสำเนาทั้ง subtree ย้าย เรียง ลบ และค้นหา; environment create/rename/duplicate/delete และ inheritance
- HTTP ผ่าน Rust: methods, headers/query, JSON/text/XML/form/multipart/binary, basic/bearer/API key/Digest, GraphQL query + variables
- GraphQL: operation name, POST/GET, format/validate query และ variables, ดึง schema, import introspection JSON/SDL, ค้น type/field และ export SDL
- Digest Auth ฝั่ง native: HTTP/SSE/WebSocket, challenge/retry, auth-int, multipart replay และ UTF-8/NFC; credentials จำกัด origin เดิม
- OAuth1 ฝั่ง native: HMAC-SHA1/HMAC-SHA256/RSA-SHA1/PLAINTEXT พร้อมโหมด body แบบ RFC หรือ Insomnium เดิม; ดูข้อแตกต่างและผลตรวจใน [OAuth1 compatibility](docs/migration/OAUTH1-COMPATIBILITY.md)
- AWS IAM ฝั่ง native: Signature V4, session token, Host/region/service, body จริงและ redirect; ดูข้อแตกต่างและงานที่เหลือใน [AWS compatibility](docs/migration/AWS-COMPATIBILITY.md)
- ASAP ฝั่ง native: JWT/key/claims แบบ Insomnium และ Postman รองรับ RSA/PSS/ES256/384/512; native UI/provider acceptance ยังค้าง ดู [ASAP compatibility](docs/migration/ASAP-COMPATIBILITY.md)
- Hawk ฝั่ง native: SHA1/SHA256 พร้อมโหมด Insomnium เดิม, body จริง และ Postman; ดูผลตรวจและข้อจำกัดใน [Hawk compatibility](docs/migration/HAWK-COMPATIBILITY.md)
- Basic เลือก UTF-8/Latin-1, Bearer แก้ prefix ได้, API key รองรับ header/query/Cookie และ OpenAPI cookie auth; ดูงาน auth ที่ยังเหลือใน [Auth inventory](docs/migration/AUTH-INVENTORY.md)
- Response body/headers/cookies/timing/history, cancel, timeout, redirect, proxy, CA/client certificate settings
- Cookie manager แยกต่อ collection: เพิ่ม/แก้ไข/ลบ/ล้าง บันทึกแบบ atomic และรองรับ send/store cookie แยกกัน
- WebSocket: connect/send/receive/close, text/binary/ping และ saved payloads; SSE: incremental events, event ID และ retry metadata; มี log/filter/export/history และ cancel
- gRPC: unary/streaming ทั้งสี่แบบ, proto tree/import/edit/replace/refresh/delete, reflection, metadata, legacy JSON, Send/Commit และประวัติ; refresh รักษา ID/ไฟล์เดิมและตรวจ schema ก่อนบันทึก ยังรอตรวจ UI/IPC จริงและความเข้ากันได้บางกรณี ดู [gRPC compatibility](docs/migration/GRPC-COMPATIBILITY.md)
- Workspace บันทึกแบบ atomic และเก็บไฟล์ก่อนแก้ไขไว้หนึ่งชุดต่อ session; single-instance ป้องกันหลาย process เขียนทับกัน
- Import แบบเพิ่ม collection ใหม่จาก Insomnia JSON, Postman v2, HAR, OpenAPI JSON/YAML และ legacy NeDB; วาง cURL หรือเลือกไฟล์ .curl/.txt ผ่าน Review import ได้แล้ว (ยังเหลือ file/options/native acceptance ดู [cURL import](docs/migration/CURL-IMPORT.md)); export resource JSON
- API Design: แก้ไข/บันทึก spec, ตรวจโครงสร้าง, preview operations/schema, แนบไฟล์ $ref และสร้าง request ลง folder ใหม่; รายการที่แปลงไม่ครบต้องแก้ใน Settings ก่อนส่ง

รายการนี้เป็นสิ่งที่ implement แล้ว ไม่ใช่ผลรับรองทุก workflow ดูผลตรวจจริงใน STATUS

## ข้อมูลเดิมและการกู้คืน

Source เดิมทั้งหมดอยู่ที่ `_backup/legacy-electron/` และถูก gitignore แล้ว เก็บไว้สำหรับอ้างอิง/rollback อย่าใช้ `git clean -dfX` เพราะจะลบ backup

ตรวจความครบของ backup ได้ด้วย:

```powershell
bun docs/migration/archive.mjs verify
```

ฐานข้อมูลผู้ใช้เดิมนอก repo ไม่ถูกย้ายหรือแก้ไข ถ้าจะย้ายข้อมูล ให้ปิดแอปเดิมแล้วเลือก `insomnia.*.db` หลายไฟล์พร้อมกันใน Import หรือแปลงเป็น export ด้วย Bun:

```powershell
bun scripts/convert-legacy.mjs "C:\path\to\legacy-data" "E:\exports\insomnium-legacy.json"
```

คำสั่งอ่าน source อย่างเดียว, ไม่เขียนทับ output ที่มีอยู่ และไม่คัดลอก response body/certificate/proto ที่อ้างถึงไฟล์ภายนอก ผลลัพธ์นำเข้าใน UI ได้ ข้อมูลที่ยังไม่รองรับถูกเก็บไว้ แต่ไม่ได้หมายความว่าใช้งานฟีเจอร์นั้นได้แล้ว

Workspace ใหม่อยู่ใน app data directory ของ `app.insomnium.desktop`: `workspace-v1.json` และ `workspace-v1.previous.json` กรณีกู้คืน ให้ปิดแอป สำรองทั้งสองไฟล์ก่อน แล้วคัดลอกไฟล์ previous ที่ตรวจสอบแล้วมาแทน workspace ปัจจุบัน Export จาก UI เป็น resource export ไม่รวม settings/history; สำรอง workspace file และโฟลเดอร์ `cookies/` หากต้องการเก็บทั้งหมด

## ข้อจำกัดที่ยังต้องทำต่อ

gRPC, OAuth callback/provider compatibility และ advanced auth, template tags, GraphQL editor completion, Spectral/custom OpenAPI lint และ advanced serialization, collection runner, Git sync และ plugin compatibility ยังไม่ครบ Cookies เก็บใน app data `cookies/<collection-id>.json` รวม session cookie และมี `.previous.json` ก่อนแก้ไขในแต่ละ session; cookie เดิมจาก legacy ย้ายได้ที่ Cookies → Restore cookies from imported collections หลังดู preview โดยคง expiry เดิมและเลือกวิธีจัดการรายการซ้ำ; custom extensions/partitioned cookies ยังต้องจัดการตาม error ที่แสดง Response/upload limit 20 MiB, saved-history budget 40 MiB, response text decode เป็น UTF-8; bytes ต้นฉบับยังอยู่ใน base64 ข้อมูล credential อยู่ใน local JSON ยังไม่มี OS vault

WebSocket/SSE ใช้ได้เฉพาะ desktop และยังรอทดสอบ runtime; SSE ต้องกด Connect ใหม่เอง ไม่มี automatic retry, WebSocket ไม่ negotiate compression ขนาด message/frame/SSE event สูงสุด 20 MiB; log เก็บ 1,000 events / 8 MiB โดยเก็บ event ล่าสุดที่ใหญ่กว่างบไว้ครบหนึ่งรายการ ไม่ได้นำเข้าไฟล์ log ภายนอกของแอปเดิม

Postman scripts และ auth/template ที่ยังไม่รองรับจะไม่ถูก execute และจะแจ้ง error ก่อนส่ง request แทนการเปลี่ยนความหมายของ request โดยเงียบ ๆ

OAuth 2 ตอนนี้รองรับ Client Credentials, Password แบบเดิม และ Refresh Token บน desktop: ตั้งค่าใน Auth แล้วกด Fetch token หรือ Send เพื่อขอ/refresh อัตโนมัติ Token ที่ import ต้องเลือกใช้กับค่าปัจจุบันก่อน และไม่ถูก copy เมื่อ duplicate request Authorization Code/PKCE เปิด system browser และรับ loopback callback หรือวาง callback URL สำหรับ remote/custom redirect ได้แล้ว และเลือก Login window เพื่อจับ remote/custom callback แบบเดิมพร้อมเริ่ม login session ใหม่ได้ แต่ยังรอตรวจ UI/IPC จริง; Implicit รับ token จาก fragment ผ่าน loopback หรือ manual paste ได้แล้ว รวม id_token และ none โดยการใช้ ID token เป็น API credential ต้องเลือกเอง และไม่ได้ตรวจยืนยัน OpenID identity Token เก็บแบบ plaintext ใน workspace และรวมอยู่ใน export; token response ไม่ลงประวัติ request

## ทำต่อข้าม session

อ่านตามลำดับ: [AGENTS.md](AGENTS.md) → [STATUS](docs/migration/STATUS.md) → [PLAN](docs/migration/PLAN.md) → [PARITY](docs/migration/PARITY.md)

[Design/architecture](docs/migration/DESIGN.md) · [เอกสารและคำสั่งที่ใช้](docs/migration/COMMANDS.md)

ใช้ข้อความนี้ใน session ใหม่:

> ทำ migration E:\insomnium ต่อ อ่าน AGENTS.md และ docs/migration/STATUS.md, PLAN.md, PARITY.md ก่อน ทำ next action และอัปเดตสถานะทุก milestone ใช้ Bun เท่านั้น, Svelte JavaScript, คง UI เดิม, ไม่สร้าง test scripts ใหม่ และค้น official docs ก่อน implementation

MIT — ดู [LICENSE](LICENSE) ซึ่งเก็บลิขสิทธิ์เดิมครบถ้วน

NTLMv2 ฝั่ง native ใช้ connection เดิมระหว่าง challenge พร้อม TLS channel binding; ตรวจขอบเขตและงานที่ยังค้างใน [NTLM compatibility](docs/migration/NTLM-COMPATIBILITY.md).
