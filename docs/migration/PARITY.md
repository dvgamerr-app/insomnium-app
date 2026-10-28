# Feature parity — checklist รายละเอียด

อัปเดต 2026-10-27 · HEAD `fd3a1f65` + งานที่ยังไม่ commit · Goal **active**

- **โค้ดทำแล้ว** = มี implementation; ไม่ได้แปลว่าตรวจใช้งานจริงครบแล้ว
- **ตรวจผ่านแล้ว** = ผ่านเฉพาะเวอร์ชัน/แพลตฟอร์ม/กรณีในหลักฐาน ไม่อ้างว่าเป็นผลของ build ล่าสุดทุกข้อ
- **ยังค้าง** = ต้องทำหรือยืนยันเพิ่ม; ถ้ายังแยก missing code กับ missing verification ไม่ได้ จะระบุว่าไม่ยืนยัน ไม่เดาว่าเสร็จ
- หมวดที่ปิดครบคือ **P17 QUERY/custom operations** และ **P18 mixed query order**; เลข 2 คือจำนวนหมวดที่ปิด ไม่ใช่หมายเลขหมวดที่กำลังทำ
- เจ้าของให้เลื่อน **P21 Plugin/template/Bun** ไปทำเป็นหัวข้อสุดท้าย; งานถัดไปคือ P03/P10/P11 ข้อมูลและ recovery โดย QuickJS ยังเป็น default
- เกณฑ์รายกรณีเดิมยังอยู่ใน [ACCEPTANCE](ACCEPTANCE.md) และ topic contracts; เปลี่ยนรูปแบบรายงาน ไม่ได้ลด scope

## ภาพรวม23หมวด

จำนวนในตารางคือรายการย่อยใต้หัวข้อของแต่ละหมวด กดชื่อเพื่ออ่านcheckboxและหลักฐาน โค้ดแล้วกับตรวจผ่านอาจอ้างงานเดียวกัน จึงไม่บวกรวมเป็นเปอร์เซ็นต์โครงการ

| กลุ่ม | หมวด/รายละเอียด | โค้ดแล้ว | ตรวจผ่าน | ค้าง | สถานะ |
| --- | --- | ---: | ---: | ---: | --- |
| Desktop/UI | [P01 Desktop shell / build](#p01) | 2 | 1 | 2 | มีส่วนผ่านแล้ว |
| Desktop/UI | [P02 UI layout / themes](#p02) | 2 | 1 | 2 | มีส่วนผ่านแล้ว |
| ข้อมูล/Environment | [P03 Collections / folders / request CRUD](#p03) | 2 | 8 | 3 | มีส่วนผ่านแล้ว |
| HTTP/Auth/Network | [P04 HTTP / response / history](#p04) | 2 | 4 | 3 | มีส่วนผ่านแล้ว |
| HTTP/Auth/Network | [P05 Request bodies](#p05) | 2 | 3 | 2 | มีส่วนผ่านแล้ว |
| HTTP/Auth/Network | [P06 Authentication](#p06) | 11 | 7 | 5 | มีส่วนผ่านแล้ว |
| ข้อมูล/Environment | [P07 Environment / templating](#p07) | 2 | 5 | 3 | มีส่วนผ่านแล้ว |
| HTTP/Auth/Network | [P08 Cookies / redirects / proxy](#p08) | 2 | 2 | 3 | มีส่วนผ่านแล้ว |
| HTTP/Auth/Network | [P09 TLS / certificates](#p09) | 2 | 2 | 2 | มีส่วนผ่านแล้ว |
| ข้อมูล/Environment | [P10 Local data / legacy migration](#p10) | 12 | 19 | 3 | มีส่วนผ่านแล้ว |
| ข้อมูล/Environment | [P11 Import / export](#p11) | 3 | 12 | 3 | มีส่วนผ่านแล้ว |
| Protocols | [P12 GraphQL](#p12) | 3 | 2 | 2 | มีส่วนผ่านแล้ว |
| Protocols | [P13 WebSocket](#p13) | 2 | 2 | 2 | มีส่วนผ่านแล้ว |
| Protocols | [P14 SSE](#p14) | 2 | 3 | 3 | มีส่วนผ่านแล้ว |
| Protocols | [P15 gRPC](#p15) | 5 | 6 | 4 | มีส่วนผ่านแล้ว |
| API design | [P16 API design / OpenAPI lint](#p16) | 3 | 2 | 3 | มีส่วนผ่านแล้ว |
| API design | [P17 OpenAPI 3.2 QUERY/custom operations](#p17) | 2 | 2 | 0 | ปิดครบ |
| API design | [P18 Mixed manual/generated query order](#p18) | 2 | 3 | 0 | ปิดครบ |
| Runner/Git/Plugin | [P19 Collection runner / assertions](#p19) | 2 | 2 | 2 | มีส่วนผ่านแล้ว |
| Runner/Git/Plugin | [P20 Git sync](#p20) | 4 | 2 | 3 | มีส่วนผ่านแล้ว |
| Runner/Git/Plugin | [P21 Plugin / template tag compatibility](#p21) | 25 | 31 | 5 | เลื่อนไปท้าย |
| Desktop/UI | [P22 Desktop integrations](#p22) | 2 | 2 | 3 | มีส่วนผ่านแล้ว |
| ส่งมอบ | [P23 CI / distribution / docs](#p23) | 4 | 2 | 4 | มีส่วนผ่านแล้ว |

<a id="p01"></a>

## P01 Desktop shell / build — ยังไม่ปิด

เกณฑ์เดิม: Native Tauri executable และ installer ด้วย Bun/Cargo · Legacy: `main, electron-builder.config.js`

**โค้ดทำแล้ว**

- [x] Tauri desktop shell และคำสั่ง build ด้วย Bun/Cargo
- [x] กำหนด executable/installer/resources ของแอป

**ตรวจผ่านแล้ว**

- [x] สร้าง Windows release executable และ NSIS installer แล้วตามเวอร์ชันใน CI

**ยังค้าง**

- [ ] ตรวจ launch/runtime ของแพ็กเกจที่ตรง source ปัจจุบัน
- [ ] ตรวจ build/runtime ของ target OS ที่ยังไม่มีหลักฐานตรงเวอร์ชัน; ดูรายละเอียดแยกในหมวด23

หลักฐาน/ขอบเขต: [CI](CI.md)

<a id="p02"></a>

## P02 UI layout / themes — ยังไม่ปิด

เกณฑ์เดิม: รักษา Insomnium layout, light/dark, keyboard และ resize · Legacy: `ui/css, ui/components, plugins/themes, screenshots/v0.1.png`

**โค้ดทำแล้ว**

- [x] Layout/themes และ shared UI controls ที่ใช้อยู่ในแอป
- [x] การปรับสี/ขนาด/keyboard ตาม source และ topic ที่ตรวจแล้ว

**ตรวจผ่านแล้ว**

- [x] Static และ Windows native dark/light/keyboard/width scenarios ตาม DESIGN

**ยังค้าง**

- [ ] ตรวจ visual/keyboard/resize ให้ครบ workflow ที่ยังค้าง
- [ ] ตรวจแพลตฟอร์มและ accessibility ที่ยังไม่มีหลักฐาน; ไม่ถือว่า redesign ปิดแล้ว

หลักฐาน/ขอบเขต: [DESIGN](DESIGN.md) · [UX scope](POST-MIGRATION-UX.md)

<a id="p03"></a>

## P03 Collections / folders / request CRUD — ยังไม่ปิด

เกณฑ์เดิม: Persist/switch/rename/duplicate/delete/reorder/search · Legacy: `models/workspace, request-group, request`

**โค้ดทำแล้ว**

- [x] Collection/folder/request CRUD, remembered selection, Pinned/Recent และ ownership
- [x] Index ID/ancestry ลดการค้นซ้ำใน selection, Git tab repair และ plugin export

**ตรวจผ่านแล้ว**

- [x] Native create/rename/switch/duplicate/root reorder/cancel-delete/delete-fallback/reload ตาม commit2870f40
- [x] ลบ runner suite ไล่ result และ descendants ใน collection เดียวกันจนหมด รวม test ใต้ result อีกชั้น; result ข้าม collection หรือมี reference ชี้ resource ผิดชนิดและลูกยังคงอยู่. แก้ shared deletion ให้ตรวจชนิด suite/test ก่อนตาม reference; model regression และ Windows native-hidden delete/reload ผ่านตาม [ผล](../../artifacts/playwright/runner-lifecycle-1793128565003/acceptance.json), [build](../../artifacts/native-runner-reference-types-20261028/build-state.json); host exit0/profile คืนครบ
- [x] ตรวจ destination และ request ที่กำลังทำงานก่อนสั่งหยุด runner เมื่อย้าย resource: Windows native-held runner และ manual request แสดง refusal โดย runner เดิมทำงานจบ; ย้ายสำเร็จภายหลังยังยกเลิก runner ที่เกี่ยวข้อง ตาม [ผล](../../artifacts/playwright/runner-lifecycle-1793125952344/acceptance.json), [ก่อนแก้](../../artifacts/playwright/runner-lifecycle-1793125781497/result.json); delete-running-request regression ผ่าน [ผล](../../artifacts/playwright/runner-lifecycle-1793125931428/acceptance.json), hosts exit0/profile คืนครบ
- [x] Imported private models14แบบถูกกันออก; references15จุด remap โดยไม่แก้ literal/foreign payload
- [x] Windows navigation/reopen กับ collection10,000requests และคืน profile เดิม
- [x] ค้นหา request ที่ไม่มี field จะไม่จับคู่ข้อความ `undefined` จาก field ที่หายไป; [headless source ปัจจุบัน](../../artifacts/playwright/collection-actions/depth.json) ตรวจ folder ลึก 64 ชั้น, search/collapse/reload, sort, selection และข้อมูล/history คงเดิม; [Windows native-hidden รุ่นก่อน](../../artifacts/playwright/collection-actions-native-1793127657895/depth.json), [build](../../artifacts/native-collection-search-20261028/build-state.json) ผ่าน, host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793127657867/result.json). Native source ปัจจุบันและ platform อื่นยังไม่ตรวจ
- [x] Windows native ลบ collection ขณะ HTTP request ค้าง: ยกเลิก request, ปฏิเสธ deleted-owner cookie access และ snapshot เก่าเมื่อสร้าง ID เดิมใหม่ โดยรักษา jar ของ collection อื่น ตาม [หลักฐาน](../../artifacts/cookie-retirement-native-20261026/verification.json)
- [x] Windows native-hidden ลบ SSE request ขณะ stream ทำงานและ write เก่ารอ filesystem replacement: stream ถูกยกเลิก, request/history ที่ลบไม่กลับมาหลัง write และ reload, request อื่นคงอยู่และไม่ reconnect ตาม [ผล](../../artifacts/playwright/workspace-recovery-live-sse-1793128640947/live-sse-delete-acceptance.json), [build](../../artifacts/native-runner-reference-types-20261028/build-state.json); host exit0/profile คืนครบ. ไม่ครอบคลุม cookie owner หรือ protocol อื่น

**ยังค้าง**

- [ ] ปิด resource-model/search/workflow variants ที่ยังค้างใน COLLECTIONS
- [ ] ตรวจ deleted-owner cookie variants และ callback drain หลังเปลี่ยน/ลบ resource นอกกรณี HTTP ที่ผ่านข้างต้น
- [ ] ตรวจ AT และแพลตฟอร์มที่ยังไม่มีหลักฐาน

หลักฐาน/ขอบเขต: [COLLECTIONS](COLLECTIONS.md) · [selection receipt](../../artifacts/collection-selection-index-20261027/verification.json)

<a id="p04"></a>

## P04 HTTP / response / history — ยังไม่ปิด

เกณฑ์เดิม: Native Send ไม่ติด CORS; status/body/headers/timing/history/cancellation · Legacy: `network/network, models/response`

**โค้ดทำแล้ว**

- [x] Native HTTP sender, response/history, Cancel และ persisted response selection
- [x] Original response headers, decompression, multipart response และ native Save/export ที่มี implementation

**ตรวจผ่านแล้ว**

- [x] Windows native-hidden current debug build ผ่าน seeded history6/body36/controls19, errors/Cancel,503/404/200 selection และ socket retirement54 ตาม [ผล](../../artifacts/playwright/response-history-native-1793122461819/manual-http-acceptance.json), [build](../../artifacts/native-git-opaque-refusal-20261028/build-state.json); host exit0/profile คืนครบ. Scenario รอ CodeMirror, ใช้ label timeout ปัจจุบันและไม่คลิกซ้ำหลัง reload; physical picker/OS-close/platform อื่นยังค้าง
- [x] Windows native-hidden เลือก HTTP/2 prior knowledge ผ่าน Settings, ส่ง GET ไป loopback h2c และ HTTPS ที่เชื่อถือ fixture CA, บันทึก response และ reload setting ก่อนส่งซ้ำ; HTTPS เจรจา ALPN h2 และ decode gzip ตาม [h2c](../../artifacts/playwright/response-history-native-1793123897917/http2-acceptance.json), [TLS](../../artifacts/playwright/response-history-native-1793123863394/http2-acceptance.json). Settings Automatic เจรจา h2 กับ HTTPS และ fallback เป็น HTTP/1.1 กับ server ที่รองรับ HTTP/1.1 ตาม [ผล](../../artifacts/playwright/response-history-native-1793123988060/http2-acceptance.json); hosts exit0/profile คืนครบ. ไม่ยืนยัน HTTP cleartext Upgrade แบบ cURL --http2 หรือ provider อื่น
- [x] Bounded native Save/Cancel, transfer decoding และ locked-target/retry ตาม RESPONSES; Windows native build ล่าสุดตรวจ automatic/explicit download, chooser Cancel/Save และ exact bytes ตาม [ผล](../../artifacts/playwright/response-download-native-1793122015812/download-acceptance.json), locked target รักษา bytes/response และ retry ตาม [ผล](../../artifacts/playwright/response-download-native-1793121883892/download-failure-acceptance.json). Root request actions ตรวจ scheduled run ถูกยกเลิกโดย manual run/history คงเดิมตาม [ผล](../../artifacts/playwright/request-action-ownership-native-1793121910427/action-acceptance.json); hosts exit0/profile คืนครบ
- [x] ป้องกันชื่อ Windows device `CONIN$`/`CONOUT$` ใน response filename: UI เติม `_` และ native validator ปฏิเสธชื่อเดิมรวมรูปที่มี extension โดยชื่อปกติที่มีข้อความต่อท้ายยังใช้ได้; Rust regression และ [headless Save](../../artifacts/playwright/response-charset-preview/result.json) ผ่าน. [Windows native-hidden](../../artifacts/playwright/response-download-native-1793136201841/result.json) ตรวจ Save dialog เสนอ `_CONIN$.bin`/`_CONOUT$.bin` และบันทึก bytes ถูกต้อง, host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793136201593/result.json). Scenario/helper เป็น test-only supplement หลัง [build](../../artifacts/native-resource-crud-audit-probe/postman-values-20261028/build-state.json); [Windows device-name reference](https://learn.microsoft.com/en-us/windows/win32/devnotes/rtlisdosdevicename_u)
- [x] Windows native-hidden HTML response preview ตรวจ sandbox, script ไม่รัน, parent DOM เข้าถึงไม่ได้, image/frame/refresh ไม่ถึง loopback, Source ตรงและ Raw คงหลัง reload ตาม [ผล](../../artifacts/playwright/response-history-native-1793136271150/html-preview-acceptance.json); host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793136270888/result.json). เป็น seeded response และ test-only supplement หลัง build; media/provider/platform/OS-close อื่นยังค้าง
- [x] Windows native-hidden PNG response preview ตรวจ sandbox/opaque origin, decode 512×512, data URL ตรงและ Raw reload รักษา Base64 ตาม [ผลหลังแก้ CSP](../../artifacts/playwright/response-history-native-1793137421134/image-preview-acceptance.json); host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793137420885/result.json). เป็น seeded PNG และ test-only supplement หลัง build; ภาพชนิดอื่น, decoder error และ platform ยังไม่ปิด
- [x] Windows native-hidden CSV response preview ตรวจ worker/table 208 แถว, pagination, quoted CRLF/Unicode, เลขเป็นข้อความและ markup ถูก escape พร้อม Source/Raw reload และ body เดิม ตาม [ผล](../../artifacts/playwright/response-history-native-1793137540914/csv-preview-acceptance.json); host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793137540666/result.json). เป็น seeded response และ test-only supplement หลัง build; malformed/large/platform อื่นยังค้าง
- [x] Windows native-hidden PDF response preview ตรวจ PDF สองหน้า, canvas/text/navigation/zoom, document action ไม่รัน, native Save bytes ตรงและ Raw reload ตาม [ผล](../../artifacts/playwright/response-history-native-1793137607819/pdf-preview-acceptance.json); host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793137607559/result.json), headless PDF regression ผ่าน. Fixture แยกใช้ร่วมกันหลัง build; password/decoder/platform อื่นยังค้าง
- [x] Windows native-hidden response UTF-32LE จาก history ที่เก็บข้อความเดิมแบบ lossy และจาก HTTP loopback จริงแสดง `AB`, native Save ได้ bytes เดิม และ reload ไม่แก้ record ตาม [ผล](../../artifacts/playwright/response-history-native-1793137711032/charset-preview-acceptance.json); host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793137710785/result.json). Test-only supplement หลัง build; charset/provider/platform อื่นยังค้าง
- [x] แก้ desktop CSP `media-src` ให้รองรับ `data:` สำหรับ audio preview โดยคง `self` และ sandbox เดิม; ก่อนแก้ [WebView ปฏิเสธ URL](../../artifacts/playwright/response-history-native-1793136688486/result.json). [Windows native-hidden](../../artifacts/playwright/response-history-native-1793137489312/audio-preview-acceptance.json) ผ่าน WAV metadata, no autoplay, คลิก control เล่นจนจบ, sandbox และ Raw reload; [HTML sandbox regression](../../artifacts/playwright/response-history-native-1793137447918/html-preview-acceptance.json) ผ่านรวมปฏิเสธ remote audio ก่อนถึง loopback, hosts exit0/profile คืนครบ ([audio](../../artifacts/playwright/resource-manager-restoration-1793137489066/result.json), [HTML](../../artifacts/playwright/resource-manager-restoration-1793137447670/result.json)). Fixtures เพิ่มหลัง [build](../../artifacts/native-resource-crud-audit-probe/audio-csp-20261028/build-state.json) source closure ผ่าน; อ้างอิง [CSP media-src fallback](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/media-src). เสียงจริงผ่านอุปกรณ์และ platform อื่นยังไม่ตรวจ
- [x] Multipart response จาก HTTP loopback รวม WAV part: [Windows native-hidden](../../artifacts/playwright/response-multipart-native-1793137866180/multipart-acceptance.json) และ headless ผ่าน preview metadata/no autoplay, กดเล่นและสลับ part แล้วกลับมาเริ่มใหม่แบบหยุดอยู่, Save part bytes ตรง, nested/transfer decoding และ Raw reload; host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793137865924/result.json). Fixture เป็น test-only supplement หลัง build; platform อื่นและเสียงออกจากอุปกรณ์จริงยังไม่ได้ตรวจ

**ยังค้าง**

- [ ] ปิด Send→response/history→Copy/Save→reload สำหรับ variants ที่ยังค้าง
- [ ] ตรวจ disk-full/permission/held cancellation/restart และ root request-action controls
- [ ] ตรวจ lifecycle/provider/platform ที่ระบุค้างใน HTTP/RESPONSES

หลักฐาน/ขอบเขต: [HTTP](HTTP.md) · [RESPONSES](RESPONSES.md)

<a id="p05"></a>

## P05 Request bodies — ยังไม่ปิด

เกณฑ์เดิม: JSON/text/XML/form-urlencoded/multipart/binary · Legacy: `models/request`

**โค้ดทำแล้ว**

- [x] รองรับ body6โหมดและ portable binary/multipart assets
- [x] Per-part MIME/headers/transfer encoding และ file admission ตาม contract

**ตรวจผ่านแล้ว**

- [x] Windows wire payload ของทั้ง6โหมด ครอบคลุม6CSS profiles และ file refusal/limits ตาม [ผล current debug](../../artifacts/playwright/response-history-native-1793122461819/manual-http-acceptance.json); file selection ใช้ setInputFiles ไม่ใช่ physical picker
- [x] Legacy assets8รายการ/native wire6กรณี/reader refusal5กรณี; chooser/export/reimport ตาม08ab0b3
- [x] Windows native-hidden binary และ multipart body: Cancel, เลือกไฟล์ผ่าน physical WebView2 chooser, Cancel การเลือกแทนที่โดยรักษาไฟล์เดิม แล้วเลือกไฟล์ใหม่และส่ง bytes ใหม่ตรง ก่อน reload ผ่าน [binary](../../artifacts/playwright/response-history-native-1793126654190/picker-acceptance.json), [multipart](../../artifacts/playwright/response-history-native-1793126638462/picker-acceptance.json); helper หา chooser ก่อนตรวจ process ลูก/profile เฉพาะ scenario และ Tauri owner โดยไม่พึ่ง fixed delay, hosts exit0/profile คืนครบ

**ยังค้าง**

- [ ] ตรวจ physical picker ของ body/file variants อื่นและ AT ที่ยังไม่ยืนยัน
- [ ] ตรวจ body/file workflows บนแพลตฟอร์มที่เหลือ; ไม่ต้องเขียน body modes ใหม่

หลักฐาน/ขอบเขต: [HTTP](HTTP.md) · [IMPORT-EXPORT](IMPORT-EXPORT.md)

<a id="p06"></a>

## P06 Authentication — ยังไม่ปิด

เกณฑ์เดิม: Basic/Bearer/API key/OAuth1/OAuth2/PKCE/Digest/AWS/Hawk/NTLM/netrc/ASAP ตาม inventory · Legacy: `network/*`

**โค้ดทำแล้ว**

- [x] Basic UTF8/Latin1, Bearer prefix, API key header/query/Cookie และ manual Authorization precedence
- [x] Digest สำหรับ HTTP/SSE/WebSocket รวม origin Authentication-Info/rspauth ก่อน content decoding
- [x] OAuth2 Client Credentials/Password/Refresh, token lifecycle และ NO_PREFIX
- [x] OAuth2 Authorization Code/PKCE และ Implicit token/ID-token/none callback; ID-token ใช้แบบ explicit ไม่ใช่ OpenID identity verification
- [x] Optional login window พร้อม remote/custom callback interception และ session rotation
- [x] OAuth1 signature4วิธี และ legacy/RFC body modes
- [x] AWS IAM header signing/editor/import
- [x] Hawk SHA1/SHA256 พร้อม signing3modes
- [x] ASAP legacy/Postman JWT พร้อม RSA/PSS/EC รวม ES512/P-521
- [x] NTLMv2 guarded HTTP/1/TLS-binding/editor และ proxy407
- [x] netrc discovery/parser/per-destination Basic

**ตรวจผ่านแล้ว**

- [x] Direct native/loopback/JS proofs ของ OAuth1/AWS/Hawk/ASAP และ NTLM ตาม AUTHENTICATION; ไม่ใช่ยืนยัน UI/provider ทุกกรณี
- [x] Windows native-hidden Auth UI แบบ Client Credentials: Fetch token ผ่าน loopback ด้วย Basic client credentials, Send ใช้ Bearer token, response บันทึกและ token พร้อมใช้หลัง reload; แก้ client ID ระหว่าง exchange ค้างแล้วปฏิเสธ token ที่มาทีหลังโดยรักษา token เดิม; ลบ request ระหว่าง exchange อีกครั้งแล้ว native ยกเลิก connection และ request/token ไม่กลับมาหลัง reload ตาม [ผล](../../artifacts/playwright/response-history-native-1793123675526/oauth-acceptance.json); host exit0/profile คืนครบ ไม่ใช่ browser/callback หรือ external provider
- [x] Windows NTLM proxy30groups: HTTP/HTTPS CONNECT, credential/certificate isolation, OAuth/SSE/WS และ cleanup
- [x] netrc45native cases
- [x] Origin Digest proof54Windows native groups รวม compression/trailers/redirect/stale และ HTTP/SSE/WS refusal
- [x] Windows native-hidden build หลังแก้ data/ownership ผ่าน proxy Digest HTTP/CONNECT, stale, no Basic downgrade, Basic/NTLM controls และ origin response-proof regression ตาม [ผล](../../artifacts/playwright/proxy-ntlm-1793126730713/acceptance.json), [build](../../artifacts/native-refused-move-20261028/build-state.json); host exit0/profile คืนครบ. ไม่ยืนยัน Proxy-Authentication-Info
- [x] ตรวจ Proxy-Authentication-Info แยกจาก origin Digest ตลอด encoded response body และ trailer ก่อนคืน connection; CONNECT ตรวจ proof ก่อนใช้ tunnel. Windows native-hidden ผ่าน SHA-256 auth-int ใน header/trailer, ปฏิเสธ proof ปลอมทั้ง HTTP และ CONNECT และตรวจ origin/proxy พร้อมกัน ตาม [ผล](../../artifacts/playwright/proxy-ntlm-1793127314254/proxy-proof-acceptance.json), [build](../../artifacts/native-proxy-proof-20261028-3/build-state.json); regression proxy Digest เดิมผ่านตาม [ผล](../../artifacts/playwright/proxy-ntlm-1793127341735/acceptance.json), profile คืนครบ. Rust unit test เพิ่มตรวจ body ถูกแก้, trailer ที่ประกาศแต่ไม่ส่ง และแยก origin header โดยยังไม่ได้ทดสอบกรณีเหล่านี้ผ่าน network จริง

**ยังค้าง**

- [ ] ตรวจ Digest Unicode/NFC/UI/IPC variants ที่ยังไม่มีหลักฐานปิด; origin proof ผ่านแล้วเฉพาะกรณีใน receipt
- [ ] ตรวจ proxy response proof variants นอกขอบเขตหลักฐานข้างต้น รวม nonce cache และ legacy encodings ที่ยังค้าง
- [ ] ตรวจ OAuth Authorize→browser/login-window→callback→token→Send ผ่าน UI/provider จริง
- [ ] ตรวจ callback/certificate/popup/cancel และ stale-owner publication ของ OAuth/login window
- [ ] ปิด legacy proxy schemes, auth edge cases และ provider/platform ที่เหลือ

หลักฐาน/ขอบเขต: [AUTHENTICATION](AUTHENTICATION.md) · [origin Digest proof](../../artifacts/digest-response-proof-20261027/verification.json)

<a id="p07"></a>

## P07 Environment / templating — ยังไม่ปิด

เกณฑ์เดิม: Base/sub/folder inheritance, variable rendering และ explicit legacy tag handling · Legacy: `models/environment, templating`

**โค้ดทำแล้ว**

- [x] Environment/folder inheritance, private/color/order/duplicate และ remembered selection
- [x] Render variables/tags กับ request owner; resource switches ไม่ควร publish ผลเก่า

**ตรวจผ่านแล้ว**

- [x] Windows authored property-order, subtree duplication, inherited variables/native Send ตาม6349100/eae4ac2
- [x] ย้ายและ duplicate environment ที่ sort key ใหญ่มากหรือห่างกันน้อยกว่าความละเอียดเลขได้ โดยจัดเลขของ collection เดียวกันใหม่เฉพาะเมื่อจำเป็น; direct regression ตรวจ collection อื่นไม่เปลี่ยน, headless UI/save/reload และ Windows native-hidden UI/save/reload ผ่าน [ผล native](../../artifacts/playwright/environment-order-native-1793125476443/acceptance.json), [build](../../artifacts/native-environment-order-20261028/build-state.json); host exit0/profile คืนครบ
- [x] สร้าง environment โดยวนหา sort key สูงสุดแทนการส่งรายการทั้งหมดเป็น arguments; regression กับ 1,000,000 รายการผ่านหลังเดิม stack overflow, headless scenario/compiler/build ผ่าน; ไม่ใช่ native หรือ performance acceptance สำหรับ workspace ขนาดดังกล่าว
- [x] แก้ property-order path ชนกันเมื่อชื่อ key มี `~|`: editor และ template ใช้ path ที่ escape แยกตำแหน่ง โดยยังอ่าน metadata แบบเดิม; direct assertions, headless environment save/reload/export/reimport ตาม [ผล](../../artifacts/playwright/template-tag-environment-order-portability/order-portability.json) และ [folder editor save](../../artifacts/playwright/resource-manager/folder-order.json) ผ่าน รวม `bun run check`/build. ยังไม่ตรวจ native สำหรับการแก้นี้
- [x] Held target-switch/edit capture, null/missing refusal, filtered deletion fallback และ unrelated deletion retaining response

**ยังค้าง**

- [ ] ตรวจ callers/protocols/imported-model variants ที่ยังค้าง
- [ ] ตรวจ native Git privacy และ callback drain ของ template/plugin owners
- [ ] ตรวจ provider/platform/AT ที่ยังไม่ยืนยัน; plugin runtime แยกในหมวด21

หลักฐาน/ขอบเขต: [TEMPLATING](TEMPLATING.md) · [PLUGINS](PLUGINS.md)

<a id="p08"></a>

## P08 Cookies / redirects / proxy — ยังไม่ปิด

เกณฑ์เดิม: Session isolation, persistence, cookie management และ redirect/proxy preferences · Legacy: `models/cookie-jar, network`

**โค้ดทำแล้ว**

- [x] Persistent cookie CRUD, collection isolation และแยก send/store policy
- [x] Redirect/proxy configuration และ legacy-cookie preview/restore

**ตรวจผ่านแล้ว**

- [x] มีผลตรวจ proxy407/redirect บางเส้นทางใน AUTHENTICATION; ไม่ถือว่าปิด cookie/native QA ทั้งหมวด
- [x] Windows native-hidden เปิดใช้ template cookie sources ผ่าน UI, reload และส่งไป loopback โดย dependency/scope ตรง; native jar และ SameSite เดิมคงอยู่, dependency วนซ้ำปฏิเสธก่อนส่ง และ Clear all ไม่คืน cookie เก่า ตาม [ผล](../../artifacts/playwright/cookie-template-native-1793128747042/acceptance.json), [build](../../artifacts/native-runner-reference-types-20261028/build-state.json); host exit0/profile คืนครบ. เป็น HTTP loopback ไม่ครอบคลุม HTTPS หรือ platform อื่น

**ยังค้าง**

- [ ] ตรวจ cookie CRUD/isolation/persistence ผ่าน native UI ให้ครบตาม contract
- [ ] ตรวจ cookie recovery/deleted-owner และ custom-cookie extensions ที่ยังค้าง
- [ ] ตรวจ redirect/proxy variants, cancel และ provider/platform ที่ยังขาด

หลักฐาน/ขอบเขต: [AUTHENTICATION](AUTHENTICATION.md) · [HTTP](HTTP.md)

<a id="p09"></a>

## P09 TLS / certificates — ยังไม่ปิด

เกณฑ์เดิม: Validation เป็นค่าเริ่มต้น, custom CA และ host-scoped client identity · Legacy: `models/ca-certificate, client-certificate`

**โค้ดทำแล้ว**

- [x] TLS validation/custom CA และ client identity ที่ผูกกับ host
- [x] Portable CA/PEM/key/PFX และการเลือก identity ใน HTTP/SSE/WSS/gRPC ตาม TLS

**ตรวจผ่านแล้ว**

- [x] Bounded Windows Open4/TLS59 ตามเวอร์ชันที่บันทึก
- [x] Portable activation/export/reimport เมื่อ source files เดิมใช้ไม่ได้ ตามddea70f/9180ac4

**ยังค้าง**

- [ ] ตรวจ current-source regression ของ matrix ที่การเปลี่ยน shared TLS/identity กระทบ
- [ ] ปิด provider/redirect/identity/OS-close/platform variants ที่เหลือใน TLS

หลักฐาน/ขอบเขต: [TLS](TLS.md) · [portable assets](IMPORT-EXPORT.md)

<a id="p10"></a>

## P10 Local data / legacy migration — ยังไม่ปิด

เกณฑ์เดิม: Atomic durable state; import legacy โดยไม่แก้ source หรือทำ resource หาย · Legacy: `common/database, models`

**โค้ดทำแล้ว**

- [x] Atomic save/session backup/recovery และ read-only NeDB parser
- [x] Legacy response body/timeline และ portable HTTP request/certificate assets
- [x] Compressed legacy SSE history activation และ Unix atomic storage permissions
- [x] Persistence queue จดจำ preparation/Svelte/JSON snapshot failure เพื่อปฏิเสธ transition จนมี save ใหม่สำเร็จ
- [x] จองลำดับ save ก่อน capture เพื่อไม่ให้ transition/save ที่ถูกเรียกซ้อนแซง
- [x] คำนวณ retained history และ response selections ให้สำเร็จก่อนเปลี่ยน state เพื่อป้องกัน partial trim เมื่อ preparation ล้ม
- [x] เตรียม history/selection แยกและใช้กับ state หลัง Svelte snapshot/JSON serialization ผ่าน เพื่อไม่ตัด history เมื่อ capture ล้ม
- [x] ใช้ history/selection ที่เตรียมไว้หลัง write สำเร็จและยังเป็น owner/revision เดิม เพื่อรักษาข้อมูลขณะ write ล้มหรือค้าง
- [x] ตรวจ source history/selection/resources/settings ก่อนใช้ผล write เก่า เพื่อไม่ทับ state ที่ถูกแทนระหว่างรอ write แม้ยังไม่มี save ใหม่
- [x] ตรวจสมาชิกและลำดับ history รวมค่า selection เพื่อไม่ทับการแก้ใน array/object เดิมระหว่าง write
- [x] ตรวจเนื้อหาของ history ที่จะถูกตัดก่อนใช้ผล write เก่า: [controlled recovery UI](../../artifacts/playwright/workspace-recovery-1793123262196/result.json) ตรวจ mutation และ snapshot failure; [Windows native-hidden](../../artifacts/playwright/workspace-recovery-live-sse-1793142518920/live-sse-retention-acceptance.json) ตรวจ live SSE เพิ่ม event ระหว่าง atomic replacement ค้างและ write ตัด history ตามงบ จากนั้นคืนพื้นที่และบันทึก event ได้ก่อน stream จบ, host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793142518676/result.json). เป็น test-only supplement หลัง build; OS shutdown และ platform อื่นยังค้าง
- [x] เพิ่ม imported history ทีละรายการเพื่อป้องกัน argument limit ใน shared helper; import ปัจจุบันเปิดใช้งาน history สูงสุด 100 รายการต่อ review

**ตรวจผ่านแล้ว**

- [x] Windows backup→failed commit cleanup/retry→reviewed recovery/relaunch
- [x] Windows native-hidden หยุด process ที่เป็นของ scenario ขณะ replacement ถูก oplock ค้าง: primary เดิมคงอยู่, staged write ยังอยู่, เปิด process ใหม่ได้และ save ใหม่สำเร็จโดยไม่ reconnect SSE ตาม [ก่อน restart](../../artifacts/playwright/workspace-recovery-live-sse-1793128605461/live-sse-crash-acceptance.json), [หลัง restart](../../artifacts/playwright/workspace-recovery-live-sse-crash-reopen-1793128606707/crash-reopen-acceptance.json), [build](../../artifacts/native-runner-reference-types-20261028/build-state.json); wrapper คืน profile ครบ. เป็นการ terminate process โดยตั้งใจ ไม่ใช่ power loss/OS shutdown และไม่ได้กู้การแก้ไขที่ยังเขียนไม่เสร็จ
- [x] Windows native-hidden ตรวจ primary ที่เป็น JSON แต่มี response header เสีย: ปฏิเสธ load/save, ยกเลิก review โดยไฟล์ไม่เปลี่ยน, กู้ backup ที่ตรวจแล้ว เก็บสำเนา primary เสีย และ save/relaunch โดย backup เดิมไม่เปลี่ยน ตาม [recovery](../../artifacts/playwright/workspace-recovery-invalid-history-1793127775503/acceptance.json), [relaunch](../../artifacts/playwright/workspace-recovery-invalid-history-reload-1793127776820/acceptance.json), [build](../../artifacts/native-collection-search-20261028/build-state.json); ทั้งสอง host exit0 และ wrapper ตรวจคืน profile ครบ. เป็นกรณี header หนึ่งรูปแบบ ไม่ใช่ OS-close หรือทุก platform
- [x] Legacy response compression/portable reimport พร้อม source/profile restoration; Windows native-hidden build หลังแก้ CRUD ตรวจ 16 response records, 10 active histories, 4 database files, gzip/default/refusal และ export/reimport/reload ตาม [ผล](../../artifacts/playwright/legacy-response-import-native-1793120322089/legacy-native-acceptance.json), [build](../../artifacts/native-runner-delete-20261027/build-state.json); host exit0/profile คืนครบ ไม่ได้ส่ง network
- [x] Windows native-hidden ตรวจ legacy SSE และ WebSocket scoped asset reader, picker, export/reimport/reload ตาม [SSE](../../artifacts/playwright/legacy-sse-import-native-1793135208146/legacy-sse-acceptance.json), [WebSocket](../../artifacts/playwright/legacy-websocket-import-native-1793135285573/legacy-websocket-acceptance.json); ใช้ [build ล่าสุด](../../artifacts/native-resource-crud-audit-probe/postman-empty-20261028/build-state.json), hosts exit0/profile คืนครบ ([SSE](../../artifacts/playwright/resource-manager-restoration-1793135207897/result.json), [WebSocket](../../artifacts/playwright/resource-manager-restoration-1793135285323/result.json)), ไม่มี stream connection. เพิ่ม test-only save selection metadata ก่อน baseline หลังรอบแรกของแต่ละ scenario assertion ไม่ตรง metadata ที่ UI บันทึก; ทั้งสองรอบแรก profile คืนครบ
- [x] Ordinary HTTP file assets และ certificate/key portability ตาม08ab0b3/9180ac4
- [x] Bun self-check ตรวจ capture failure หลัง save ที่ค้าง, flush/transition refusal, snapshot ตามเวลาสั่งและ valid save retry; recovery UI ฉีด preparation failure ตรวจ feedback/ไม่มี write/transition refusal/retry ผ่าน [ผล](../../artifacts/playwright/workspace-recovery-1793109589488/result.json)
- [x] Native Windows QuickJS debug build หลังแก้คิวผ่าน damaged/missing/fresh recovery, first-session backup และ reload; 7 hosts exit0/profile คืนครบ ตาม [ผล](../../artifacts/playwright/workspace-recovery-damaged-1793109820579/result.json), [build](../../artifacts/native-persistence-preparation-20261027/build-state.json); ไม่ใช่ native preparation-failure หรือ OS-close acceptance
- [x] Bun self-check ตรวจ reentrant transition/save, capture failure และลำดับ write; recovery UI headless ฉีด Svelte snapshot failure และ transition ซ้อน ตรวจ refusal/retry และ save ก่อน transition ผ่าน [ผล](../../artifacts/playwright/workspace-recovery-1793110114163/result.json); native build ล่าสุดผ่าน missing-backup recovery และ stream reload ตาม [ผล](../../artifacts/playwright/workspace-recovery-missing-1793110347739/result.json)
- [x] Native Windows UI save ขณะ primary ถูกล็อกปฏิเสธโดยรักษา primary/backup bytes; ปลดล็อกแล้ว retry/reload ผ่าน ตาม [ผล](../../artifacts/playwright/workspace-recovery-missing-1793110533566/locked-save.json); ไม่ใช่ disk-full หรือ OS-close
- [x] Native Windows WM_CLOSE ขณะ primary ถูกล็อกปฏิเสธ close และรักษา primary/backup; ปลดล็อกแล้ว WM_CLOSE/reload ผ่าน ตาม [ผล](../../artifacts/playwright/workspace-recovery-missing-1793110735737/locked-close.json); ไม่ใช่ OS shutdown/crash หรือ disk-full
- [x] Controlled recovery UI ตรวจ selection preparation failure รักษา history ทั้งสองรายการ/ไม่เขียน/retry และ normal retention/selection cleanup ผ่าน ตาม [ผล](../../artifacts/playwright/workspace-recovery-1793110983963/result.json)
- [x] Controlled recovery UI ตรวจ Svelte snapshot และ JSON serialization failure รักษา history/ไม่เขียน/retry รวม normal retention/reentrant transition ผ่าน [ผล](../../artifacts/playwright/workspace-recovery-1793111157070/result.json)
- [x] Controlled recovery UI ตรวจ failed/pending write รักษา history, retry และ save ซ้อนที่ข้อมูลใหม่ไม่ถูกทับ ผ่าน [ผล](../../artifacts/playwright/workspace-recovery-1793111417594/result.json); native build ล่าสุดผ่าน locked save/close/retry/reload ตาม [save](../../artifacts/playwright/workspace-recovery-missing-1793111716510/locked-save.json), [close](../../artifacts/playwright/workspace-recovery-missing-1793111727659/locked-close.json) โดยไม่ได้ฉีด history เกิน limit ใน native
- [x] Controlled recovery UI ตรวจ history ถูกแทนขณะ write ค้างโดยยังไม่เรียก save ใหม่ แล้ว write เก่าไม่ทับและ retry บันทึก history ใหม่ ผ่าน [ผล](../../artifacts/playwright/workspace-recovery-1793111853034/result.json)
- [x] Controlled recovery UI ตรวจเพิ่ม/สลับ history และแก้ selection ใน object เดิมระหว่าง write ค้าง พร้อม retry ผ่าน [ผล](../../artifacts/playwright/workspace-recovery-1793112143145/result.json)
- [x] Preview และ Windows native UI ตรวจ unsupported resource ซ้อนสองชนิดใต้ request ผ่าน import → reload → export → additive reimport → reload: รักษา payload รวม literal IDs และ remap parent/ID ของทั้งคู่; native ใช้ Save dialog จริง ตาม [ผล](../../artifacts/playwright/legacy-export-import-native-1793133218285/result.json), [build](../../artifacts/native-resource-crud-audit-probe/postman-variables-20261028/build-state.json) และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793133218033/result.json). Scenario เป็น test-only supplement หลัง build; variants/platform อื่นยังค้าง
- [x] Windows native-hidden ตรวจ embedded proto พร้อม transitive include สองชั้น ผ่าน import → export → additive reimport → reload ทั้งสองชุด compile และส่ง gRPC ไป loopback ได้ frame ตรงกัน ตาม [ผล](../../artifacts/playwright/legacy-export-import-native-1793140076727/import-acceptance.json); host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793140076487/result.json). Fixture เพิ่มหลัง build; variants อื่นยังค้าง
- [x] Controlled browser เรียก helper โดยตรงด้วย history 150,000 รายการ รักษาลำดับและ array เดิม ตาม [ผล](../../artifacts/playwright/workspace-recovery-1793118562332/result.json); เดิม helper เกิด RangeError หลังเพิ่ม resource แต่ fixture เกินเพดาน 100 ของ import ปัจจุบัน จึงไม่ใช่หลักฐานบั๊กใน UI import

**ยังค้าง**

- [ ] ปิด durability/OS-close/recovery บนแพลตฟอร์มที่เหลือ
- [ ] ปิด embedded proto/include, stream assets และ certificate/legacy variants ที่ยังค้างตาม IMPORT-EXPORT
- [ ] ตรวจ retained unsupported resources ชนิด/variants และ platform ที่เหลือ; ผลข้างต้นครอบคลุมโครงสร้างซ้อนหนึ่งกรณี

หลักฐาน/ขอบเขต: [IMPORT-EXPORT](IMPORT-EXPORT.md) · [atomic recovery](../../artifacts/atomic-cleanup-20261026/verification.json) · [legacy response](../../artifacts/legacy-response-compression-20261026/verification.json)

<a id="p11"></a>

## P11 Import / export — ยังไม่ปิด

เกณฑ์เดิม: Insomnia/Postman/HAR/OpenAPI/cURL และ explicit unsupported handling · Legacy: `plugins and common/import`

**โค้ดทำแล้ว**

- [x] Insomnia/Postman/HAR/NeDB และ OpenAPI JSON/YAML import/export/request generation
- [x] Review import, source selection และ portable body/certificate/history assets
- [x] cURL import และ Generate Code เฉพาะ cURL Linux/Windows

**ตรวจผ่านแล้ว**

- [x] Headless round-trip7กรณี และ64MiB+1 pre-read refusal; Windows file/folder/cancel/reload/export ตาม4818d7a
- [x] หลังแก้ validation ของ Postman environment ตรวจ regression import หกรูปแบบผ่าน preview UI review/apply/reload/export/reimport รวม embedded proto/include ตาม [ผล](../../artifacts/playwright/legacy-export-import/import-acceptance.json); ไม่ได้ตรวจ native compiler หรือ wire ในรอบนี้
- [x] Windows native-hidden ยกเลิก chooser และเลือก WSDL ที่ขาด XSD แล้วปฏิเสธโดย resources คงเดิม จากนั้นเลือก `.wsdl` และ `.xsd` พร้อมกัน, resolve include, ส่ง SOAP ไป loopback, export แล้ว reimport เฉพาะ collection ที่เลือกและส่งซ้ำด้วย body เดิม พร้อม reload/source ตาม [ผล](../../artifacts/playwright/wsdl-multifile-native-1793124677227/wsdl-acceptance.json); host exit0/profile คืนครบ เป็นกรณี include เดียว ไม่ปิด WSDL variants ทั้งหมด
- [x] Windows native-hidden legacy request assets: HTTP 6 sends และ SSE raw/multipart 2 sends ตรวจ bytes/reload, reader refusals 5 และ native export/UI reimport ตาม [HTTP](../../artifacts/playwright/legacy-request-import-native-1793121786698/request-import-evidence.json), [SSE](../../artifacts/playwright/legacy-request-import-native-1793121807571/request-import-evidence.json), [build](../../artifacts/native-git-opaque-refusal-20261028/build-state.json); hosts exit0/profile คืนครบ
- [x] Windows native-hidden import/export/reimport embedded proto กับ nested include และ compile/send ทั้ง original และ copy ผ่าน loopback ตาม [ผล](../../artifacts/playwright/legacy-export-import-native-1793127712132/import-acceptance.json); host exit0/profile คืนครบ เป็น bounded fixture
- [x] Portable certificate activation/export/reimport: Windows native-hidden หลังแก้ shared export ตรวจ PEM/encrypted key/PFX, HTTP/SSE/WSS/gRPC loopback mTLS, pre-TCP refusal และ reimport ตาม [ผล](../../artifacts/playwright/legacy-certificate-import-native-1793121040511/legacy-certificate-acceptance.json), [build](../../artifacts/native-git-export-refusal-20261028/build-state.json); host exit0/profile คืนครบ. Scenario รอ selection metadata save และตรวจ environment metadata ที่เปลี่ยนเมื่อสลับ collection; ไม่ใช่ provider/platform ทั้งหมด
- [x] cURL snippets text/binary/multipart สองแพลตฟอร์มรวม6กรณี
- [x] cURL import รองรับ `-q`/`--disable` โดยไม่อ่าน default config; Windows native ทดสอบ `-q` ร่วมกับ `--next`, file selection/reload และ Send เทียบ `curl.exe` ตาม [ผล](../../artifacts/playwright/curl-import-get-file-1793128209424/acceptance.json); host exit0/profile คืนครบ. `--no-disable` ยังปฏิเสธและ default config discovery ยังไม่รองรับ
- [x] Windows native-hidden cURL import `-G --data-urlencode` ไฟล์: ยกเลิกและเลือกไฟล์ผ่าน WebView chooser จริง, reload แล้วส่ง bytes 0–255 ตรงผล `curl.exe`; missing file และ raw-space refusal ไม่ส่ง network ตาม [ผล](../../artifacts/playwright/curl-import-get-file-1793127902030/acceptance.json), [build](../../artifacts/native-collection-search-20261028/build-state.json); host exit0/profile คืนครบ. รูปแบบไฟล์และ platform อื่นยังค้าง
- [x] Windows native-hidden cURL multipart header file: ยกเลิกและเลือกหนึ่งไฟล์ผ่าน WebView chooser จริง รักษา body เดิมเมื่อยกเลิก; เลือก header ทั้งสี่แล้วส่ง MIME ตรง `curl.exe` ยกเว้น boundary สุ่ม และ reload โดยไม่ส่งซ้ำ ตาม [ผล](../../artifacts/playwright/curl-import-part-header-files-1793127978546/part-header-files-acceptance.json); host exit0/profile คืนครบ. อีกสามไฟล์เลือกผ่านตัวทดสอบ ไม่ใช่ chooser จริง
- [x] Windows native-hidden HAR และ Hoppscotch multipart ที่ไม่มีไฟล์ปฏิเสธ Send ก่อน network; เลือกไฟล์ผ่าน chooser จริง แล้ว reload/Send/export/reimport/Send รักษา bytes และ filename ตาม [HAR](../../artifacts/playwright/legacy-export-import-native-1793128385828/har-missing-file-acceptance.json), [Hoppscotch](../../artifacts/playwright/legacy-export-import-native-1793128385828/hop-missing-file-acceptance.json) และ [ผล import/export](../../artifacts/playwright/legacy-export-import-native-1793128385828/import-acceptance.json); host exit0/profile คืนครบ. ยกเลิก chooser ตรวจใน HAR; formats/variants และ platform อื่นยังค้าง
- [x] Windows native-hidden regression หลัง shared export เปลี่ยน: import Postman environment/collection, ทำเครื่องหมาย Secret, export ผ่าน Save dialog และ reimport/reload; ค่า Secret และ provenance ที่รองรับถูกลบจากไฟล์ ข้อมูล live และ public ของ collection อื่นคงเดิม ตาม [ผล](../../artifacts/playwright/postman-secret-export-1793128697325/acceptance.json), [build](../../artifacts/native-runner-reference-types-20261028/build-state.json); host exit0/profile คืนครบ. ไม่ใช่การตรวจหาความลับทุกชนิดในไฟล์
- [x] Postman environment ปฏิเสธ `enabled` ที่มีค่าแต่ไม่ใช่ boolean ก่อน apply เพื่อไม่เปิดตัวแปรจากข้อความ `"false"`; direct controls และ UI preview ตรวจ rejection/ข้อมูลเดิม รวม import/export เดิมผ่านตาม [ผล](../../artifacts/playwright/postman-environment-import/result.json), `bun run check` และ build ผ่าน. ตรวจซ้ำบน [native-hidden](../../artifacts/playwright/postman-secret-export-1793132260975/acceptance.json) รวม Secret export/reimport แล้ว host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793132260729/result.json)
- [x] Postman collection/folder ปฏิเสธ variable list หรือ record ที่ผิดและรายการไม่มี key/id ก่อน apply แทนการข้ามตัวแปรเงียบ ๆ; [preview](../../artifacts/playwright/postman-environment-import/result.json) และ [Windows native-hidden](../../artifacts/playwright/postman-secret-export-1793133141281/acceptance.json) ตรวจ 8 กรณีและข้อมูลเดิม พร้อม regression Secret export/reimport; [build](../../artifacts/native-resource-crud-audit-probe/postman-variables-20261028/build-state.json) source closure ผ่าน, host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793133141038/result.json). `bun run check` และ build ผ่าน; อ้างอิง [Postman variable schema](https://github.com/postmanlabs/schemas/blob/develop/schemas/draft-07/v2.1.0/collection/variable.json). ไม่ใช่ OS-close หรือ platform อื่น
- [x] Postman collection/folder variable ปฏิเสธ key/id ที่เป็น object, array หรือ boolean ก่อน apply; numeric ID เดิมยังรองรับ. [Preview](../../artifacts/playwright/postman-environment-import/result.json) ตรวจ refusal และข้อมูลเดิม พร้อม import/export/reimport regression; check/build ผ่าน. [Windows native-hidden](../../artifacts/playwright/postman-secret-export-1793138646614/acceptance.json) ผ่าน, host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793138646373/result.json), [build](../../artifacts/native-resource-crud-audit-probe/postman-variable-types-20261028-attempt2/build-state.json) source closure ผ่าน; platform อื่นยังค้าง
- [x] Postman query ปฏิเสธ list/record/key/value ที่ผิดชนิดก่อน apply; [preview](../../artifacts/playwright/postman-environment-import/result.json) ตรวจ refusal และข้อมูลเดิม พร้อม regression, check/build และ direct null/disabled/fragment controls ผ่าน. อ้างอิง [Postman URL schema](https://github.com/postmanlabs/schemas/blob/develop/schemas/draft-07/v2.1.0/collection/url.json); [Windows native-hidden](../../artifacts/playwright/postman-secret-export-1793139371357/acceptance.json) ผ่าน, host exit0/[profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793139371115/result.json), [build](../../artifacts/native-resource-crud-audit-probe/postman-query-types-20261028/build-state.json) source closure ผ่าน; platform อื่นยังค้าง
- [x] Postman raw body ที่ไม่ใช่ข้อความปฏิเสธก่อน apply แทนการแปลงค่าบางชนิดเป็น body ว่าง; [preview](../../artifacts/playwright/legacy-export-import/import-acceptance.json) และ [native-hidden](../../artifacts/playwright/legacy-export-import-native-1793135105055/result.json) ตรวจ false, zero, object และข้อมูลเดิม พร้อม import regression; `bun run check` และ build ผ่าน, host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793135104813/result.json)
- [x] Postman form ปฏิเสธ field ที่ไม่มี key และ file ใน URL-encoded ก่อน apply; key ว่างถูกเก็บพร้อม flag และส่งต่อผ่าน composer สำหรับ URL-encoded/multipart แทนการข้าม. [Preview](../../artifacts/playwright/legacy-export-import/import-acceptance.json) และ [native-hidden](../../artifacts/playwright/legacy-export-import-native-1793135105055/result.json) ผ่าน import/reload/refusal/ข้อมูลเดิม และส่ง loopback ก่อนและหลัง export/reimport ทั้งสองโหมด; [build](../../artifacts/native-resource-crud-audit-probe/postman-empty-20261028/build-state.json) source closure ผ่าน, host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793135104813/result.json). [Postman runtime source](https://github.com/postmanlabs/postman-runtime/blob/develop/lib/requester/core-body-builder.js) ไม่กรอง key ว่างใน reducer; ยังไม่ได้รันเทียบ Postman จริงหรือ platform อื่น
- [x] Postman form แปลง scalar ที่ไม่ใช่ข้อความเป็นข้อความ และ multipart object เป็น JSON เพื่อไม่ให้ `false`/`0` กลายเป็นค่าว่าง; URL-encoded object ปฏิเสธก่อน apply. [Preview](../../artifacts/playwright/legacy-export-import/import-acceptance.json) และ [Windows native-hidden](../../artifacts/playwright/legacy-export-import-native-1793136010967/result.json) ผ่าน import/reload/refusal/ข้อมูลเดิม และส่ง loopback ก่อนและหลัง export/reimport; Bun ตรวจ composer เพิ่ม null, nested JSON, disabled และ source ไม่เปลี่ยน. [Build](../../artifacts/native-resource-crud-audit-probe/postman-values-20261028/build-state.json) source closure ผ่าน, host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793136010720/result.json). `bun run check` และ build ผ่าน; แนวทาง multipart อ้างอิง [Postman runtime source](https://github.com/postmanlabs/postman-runtime/blob/develop/lib/requester/core-body-builder.js). Postman runtime execution และ platform อื่นยังไม่ตรวจ
- [x] HAR import ปฏิเสธ header/query `disabled` ที่ไม่ใช่ boolean ก่อน apply เพื่อไม่ปิดข้อมูลจากข้อความ `"false"`; direct controls ตรวจ boolean ทั้งสองค่า และ scenario เดิมตรวจ refusal/ข้อมูลเดิมใน preview และ [Windows native-hidden](../../artifacts/playwright/legacy-export-import-native-1793132141143/import-acceptance.json); host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793132140908/result.json). อ้างอิง [HAR draft](https://w3c.github.io/web-performance/specs/HAR/Overview.html); `disabled` เป็น field ที่แอปรองรับเพิ่มเติม
- [x] HAR form parameter รักษา extension `disabled` แบบ boolean และปฏิเสธชนิดอื่นก่อน apply เพื่อไม่เปิดช่องที่ปิดไว้; [preview](../../artifacts/playwright/legacy-export-import/import-acceptance.json) และ [Windows native-hidden](../../artifacts/playwright/legacy-export-import-native-1793134122119/result.json) ผ่าน import/reload/refusal และ URL-encoded/multipart ส่ง loopback ก่อนและหลัง export/reimport โดยไม่มีค่าที่ปิด รวมไฟล์ที่ปิดและไม่ได้เลือกซึ่งไม่ขัดขวาง Send; [build](../../artifacts/native-resource-crud-audit-probe/har-disabled-20261028/build-state.json) source closure ผ่าน, host exit0 และ [profile คืนครบ](../../artifacts/playwright/resource-manager-restoration-1793134121877/result.json). Fixture ไฟล์เพิ่มหลัง build; `bun run check` และ build ผ่านก่อนเพิ่ม fixture. OS-close/platform อื่นยังค้าง
- [x] Hoppscotch import ปฏิเสธ file field ใน URL-encoded body ก่อน apply แทนการส่งค่าไฟล์ว่าง; scenario เดิมตรวจข้อความ/ข้อมูลเดิมและ regression import ใน preview และ Windows native-hidden ตามผลเดียวกันข้างต้น, `bun run check` และ build ผ่าน. การแยก URL-encoded กับ multipart อ้างอิง [HTML form submission](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#url-encoded-form-data)

**ยังค้าง**

- [ ] ตรวจ format/variant ที่ยังค้างใน IMPORT-EXPORT และ explicit unsupported diagnostics
- [ ] ปิด recovery/cancel และ external assets ที่ยังไม่มีผลปิด โดยเฉพาะ proto/include/stream variants
- [ ] ปิด cURL import options/file/native/provider/platform ที่ยังค้างใน CURL-IMPORT

หลักฐาน/ขอบเขต: [IMPORT-EXPORT](IMPORT-EXPORT.md) · [CURL-IMPORT](CURL-IMPORT.md) · [cURL snippets](../../artifacts/curl-only-20261027/verification.json)

<a id="p12"></a>

## P12 GraphQL — ยังไม่ปิด

เกณฑ์เดิม: Query/variables/schema/errors และ retained completion/navigation · Legacy: `ui/components, graphql deps`

**โค้ดทำแล้ว**

- [x] Query/variables/operation editor และ POST/GET
- [x] Manual introspection, JSON/SDL import, schema browser/export, formatting/validation และ response errors
- [x] Editor completion/navigation และ schema cache ownership ตาม contract

**ตรวจผ่านแล้ว**

- [x] Windows native editor15checks และ schema lifecycle/GET12checks
- [x] Bounded Ctrl+click navigation และ owner/cache corrections ตาม GRAPHQL

**ยังค้าง**

- [ ] ปิด rendering/completion/navigation variants ใน record-graphql-rendering
- [ ] ตรวจ stale schema fetch/queued editor callbacks/cancel/close และ provider/platform ที่ยังค้าง

หลักฐาน/ขอบเขต: [GRAPHQL](GRAPHQL.md)

<a id="p13"></a>

## P13 WebSocket — ยังไม่ปิด

เกณฑ์เดิม: Connect/send/receive/close, headers/subprotocols และ history · Legacy: `models/websocket-*, network`

**โค้ดทำแล้ว**

- [x] Text/binary/ping, headers/subprotocols, saved payloads และ durable history
- [x] Payload byte metrics, raw/timeline export และ cancellation ตาม HTTP

**ตรวจผ่านแล้ว**

- [x] Bounded Windows runtime6groups และ legacy NDJSON portability
- [x] Unicode/binary/cumulative payload metrics กับ history/reload ตาม stream metrics receipt

**ยังค้าง**

- [ ] ปิด control/fragmentation/compression/backpressure และ exact-byte variants ที่ยังค้าง
- [ ] ตรวจ mixed protocols, cancellation/close/reopen และ provider/platform ที่เหลือ

หลักฐาน/ขอบเขต: [HTTP](HTTP.md) · [legacy timeline](IMPORT-EXPORT.md)

<a id="p14"></a>

## P14 SSE — ยังไม่ปิด

เกณฑ์เดิม: Incremental events/cancellation และ retained history/export · Legacy: `models/request isEventStreamRequest`

**โค้ดทำแล้ว**

- [x] Incremental event delivery, cancellation, ACK/bounds/deadline และ raw suffix export
- [x] Standalone/legacy timeline portability และ compressed legacy history activation

**ตรวจผ่านแล้ว**

- [x] Windows runtime8groups + bounds/real-ACK8groups;20MiB refusals และ30second invocation deadline
- [x] Legacy raw/standalone timelines และ compressed histories ตาม receipt
- [x] Payload metrics/eviction/reload โดยไม่ทำ cumulative bytes ลดลง

**ยังค้าง**

- [ ] ตรวจ exact-boundary/large-valid events และ renderer-host suspension
- [ ] ปิด live compressed flush/truncation/multi-member/cancellation/limits ที่ยังค้างใน HTTP
- [ ] ตรวจ compressed/mixed/provider/platform variants ที่เหลือ

หลักฐาน/ขอบเขต: [HTTP](HTTP.md) · [IMPORT-EXPORT](IMPORT-EXPORT.md) · [compressed legacy](../../artifacts/legacy-sse-compression-20261027/verification.json)

<a id="p15"></a>

## P15 gRPC — ยังไม่ปิด

เกณฑ์เดิม: Proto/reflection, unary/streaming, metadata/TLS และ retained legacy compatibility · Legacy: `network/grpc, models/proto-*, grpc-request`

**โค้ดทำแล้ว**

- [x] Tonic transport, unary/client/server/bidi streaming, metadata/TLS และ cancellation
- [x] Proto tree/import/edit/replace/refresh/delete, reflection และ examples
- [x] Legacy protobuf.js-compatible JSON/object/map/Any/common-proto handling ตามรายการที่ลงโค้ดแล้ว
- [x] Receive status/metadata/compression/size boundaries และ shared response reader
- [x] Service config/retry/hedging/outlier/weighted/ORCA ตาม implementation inventory

**ตรวจผ่านแล้ว**

- [x] Original native64, legacy differential97, prior workspace75 และ method-group10ตามหลักฐานเดิม
- [x] Bounded reflection samples15native +5archived comparisons/independent wire decodes
- [x] Original Windows UI/IPC/reload, Proto36 และ nested NeDB proto→Rust Echo→export/reimport
- [x] Large20MiB Copy/Save/reload, gzip members/exact boundaries และ Windows close/reopen ตาม GRPC
- [x] ORCA subscription/report, initial UNAVAILABLE/UNIMPLEMENTED/CANCELLED และ backoff/live cancellation ตาม service config
- [x] Bounded declaration/lookup/Any/map/bytes/Number-domain/error/truncation controls ตามแต่ละ receipt

**ยังค้าง**

- [ ] ปิด JSON/object/map/Any/shared-editor และ parser variants ที่ยังค้างใน GRPC
- [ ] ปิด malformed/truncation/reset/drop ordering, rendering และ owner cancellation variants ที่เหลือ
- [ ] ปิด DNS/cache/retry/hedging/outlier/weighted/ORCA interval/replacement/multi-endpoint variants ที่เหลือ
- [ ] ตรวจ provider/platform/OS-close และ source/packaging identity ตาม acceptance เดิม

หลักฐาน/ขอบเขต: [GRPC](GRPC.md) · [service config](GRPC-SERVICE-CONFIG.md)

<a id="p16"></a>

## P16 API design / OpenAPI lint — ยังไม่ปิด

เกณฑ์เดิม: Edit/import/spec preview/lint และ request generation ตาม retained scope · Legacy: `models/api-spec, spectral deps`

**โค้ดทำแล้ว**

- [x] Persisted spec editor/import/export, operations/schema preview และ strict structural validation
- [x] Attached local refs และ request generation จาก query/header/form/body/selected assets
- [x] Exact example validation/sampler และ Spectral examples ตามcommit9b19379b

**ตรวจผ่านแล้ว**

- [x] Windows API import save/drain3กรณี ตาม2e04de6/production9638705 พร้อม durable state/profile restoration
- [x] Specific serialization/schema/example receipts ใน API-DESIGN; QUERY/mixed-query gates แยกหมวด17/18

**ยังค้าง**

- [ ] ปิด advanced serialization/refs/schema/example variants ที่ยังค้าง
- [ ] ตรวจ Spectral/custom rules และ cancellation/owner/native UI ที่ยังไม่ปิด
- [ ] ตรวจ external-reference/provider/platform ตาม API-DESIGN

หลักฐาน/ขอบเขต: [API-DESIGN](API-DESIGN.md)

<a id="p17"></a>

## P17 OpenAPI 3.2 QUERY/custom operations — ปิดแล้ว

เกณฑ์เดิม: Named QUERY/custom method gate เท่านั้น · Legacy: `src/lib/openapi.js, ApiDesign.svelte, tests/ui/openapi-methods.js`

**โค้ดทำแล้ว**

- [x] รักษา custom method case/metadata และแยก fixed GET ออกจาก custom get
- [x] Inherited/overridden parameters, path diagnostics และ duplicate operationIds

**ตรวจผ่านแล้ว**

- [x] Release1791530305299: native6exact methods/5JSON bodies และ query3.2.1/44groups
- [x] Direct12/Git12 บน3.2.0/3.2.1 และ11negative controls; native-hidden/exit0/audit/cleanup

**ยังค้าง**

- ไม่มีงานค้างใน named gate นี้; ข้อกำหนดนอกขอบเขตอยู่ในหมวดที่เกี่ยวข้อง

หลักฐาน/ขอบเขต: [record-openapi-methods](API-DESIGN.md#record-openapi-methods)

<a id="p18"></a>

## P18 Mixed manual/generated query order — ปิดแล้ว

เกณฑ์เดิม: Named query order/signature gate เท่านั้น · Legacy: `transport.js, template-url.js, tests/ui/url-encoding.js`

**โค้ดทำแล้ว**

- [x] รักษา row/array expansion order, duplicate names, empty/bare/blank-name values และ nullable omission
- [x] รักษา encoding/cURL context และ raw-query-preserving API-key append

**ตรวจผ่านแล้ว**

- [x] Release1791522146028: URL85targets/78signatures/7checks และ8legacy refusal/RFC recovery controls
- [x] Independent audit32mixed signatures/4API-key targets และ generated-query3.2.1/44groups
- [x] Direct8/boundary8/legacy52/style132/preflight82; native-hidden/exit0/cleanup

**ยังค้าง**

- ไม่มีงานค้างใน named gate นี้; ข้อกำหนดนอกขอบเขตอยู่ในหมวดที่เกี่ยวข้อง

หลักฐาน/ขอบเขต: [record-query-row-order](HTTP.md#record-query-row-order)

<a id="p19"></a>

## P19 Collection runner / assertions — ยังไม่ปิด

เกณฑ์เดิม: User-authored API tests/assertions ในแอป · Legacy: `models/unit-test*, network/unit-test-feature`

**โค้ดทำแล้ว**

- [x] Runtime/worker/shared sender/Tests UI และ suite/assertion execution
- [x] Timer ID/resource ownership และ Stop/cancel/fresh-run handling ที่แก้แล้ว

**ตรวจผ่านแล้ว**

- [x] Saved Windows runner-lifecycle: direct/detached/delegated callbacks, assertions, single-test persistence และ Stop/fresh run
- [x] Dark/light ที่1440/900/760 และ held-window close/reopen ตาม RUNNER
- [x] Preview nested suite 3 ชั้น: [export/reimport](../../artifacts/playwright/nocturne-workspace-nested-roundtrip/result.json) remap request และ resolve script ID เดิมใน collection ที่นำเข้ากลับ, ส่ง loopback/เก็บผล/reload; [alias กำกวม](../../artifacts/playwright/nocturne-workspace-nested-ambiguous/result.json) รายงาน failure โดยไม่ส่ง request. คืน localStorage ครบ; ไม่ใช่ native/provider/platform acceptance

**ยังค้าง**

- [ ] ตรวจ real Worker/native held replacement และ retained script/import compatibility
- [ ] ปิด runner lifecycle/provider/platform variants ที่ยังค้างใน inventory

หลักฐาน/ขอบเขต: [RUNNER](RUNNER.md)

<a id="p20"></a>

## P20 Git sync — ยังไม่ปิด

เกณฑ์เดิม: Existing local Git workflows หรือ approved replacement ตาม GIT · Legacy: `sync, models/git-repository`

**โค้ดทำแล้ว**

- [x] Local status/staging/commit/history/branches และ selected restore
- [x] Journaled full/scoped/shallow Fetch
- [x] Public Pull/local Merge พร้อม pinned content/conflict review, side/custom choices, recursive bases และ schema3recovery
- [x] Staged Clone, remote branch checkout และ non-force Push มี native commands และ frontend callers

**ตรวจผ่านแล้ว**

- [x] Bounded native Pull/Merge/conflict/recovery receipts ตาม GIT
- [x] Windows native Clone, remote checkout และ non-force Push ผ่านบาง workflow ตาม [GIT](GIT.md) เฉพาะ source/build และกรณีที่ระบุในหลักฐาน

**ยังค้าง**

- [ ] ปิด acceptance และ implementation variants ที่ยังขาดของ clone/remote checkout/non-force push ตาม GIT รวม fault/recovery/provider/platform; ผลเดิมไม่ยืนยัน current source ทั้งหมด
- [ ] ปิด Pull/network/process/I/O/provider/platform/path/history variants ที่เหลือ
- [ ] ตรวจ cancel/drain/recovery ไม่ทับ working changes และไม่เผย credentials ตาม GIT

หลักฐาน/ขอบเขต: [GIT](GIT.md)

<a id="p21"></a>

## P21 Plugin / template tag compatibility — ยังไม่ปิด

เกณฑ์เดิม: Explicit compatibility boundary; ไม่โหลด Node-only plugin แบบเงียบ ๆ · Legacy: `plugins, templating`

**โค้ดทำแล้ว**

- [x] Isolated renderer, built-in tags, prompt dialog และ Send-related host services
- [x] Bun candidate CJS/ESM/process/sandbox/admitted snapshot/registry repair
- [x] Owned DOM events, selected-file reads, native memory Blob/File และ Request/Response/FormData bridge
- [x] Native path/FD-backed FileReaderSync และ Blob/File part snapshots พร้อม size/deadline checks; private I/O VM คืนหลังจบ batch
- [x] Bounded reusable synchronous reply buffer และbudget error/Closed finalization ไม่panicค้างก่อนปิดsession
- [x] Bun callback/helper error messagesตรงlegacy worker; sharedUTF-8 formatterไม่เกิน8192bytes และnative IPC string errorsคืนเป็นErrorก่อนregistry quarantine
- [x] Retained Bun callbackใช้helper/sync providerของdialog owner แทนfield rendererที่หมดอายุหลังrequestจบ โดยคงcurrent/owner/callback guards
- [x] Bun terminal cleanupแยกสิทธิ์local DOMจากstore/helperที่เพิกถอน; logical closeหยุดงานใหม่ทันที รอcallbackลูกและonHideก่อนphysical retirement ภายใต้5วินาทีเดิม
- [x] Bunติดตั้งDOMExceptionตัวเดียวกับguest DOM factory ทำให้token/dataset exceptionsมีconstructor/brandตรงกันตามbootstrapเดิม
- [x] Bunเผยแพร่shared async FileReaderและเดินowner-bound DOM tasksระหว่างcallbackรอผล; admitted event frameยังมีสิทธิ์ตามlive DOM ownerหลังถอดlistener โดยคงcallback admission/owner revocation
- [x] Module initializationเดินlocal FileReader/DataTransfer tasksในcaptured no-owner context และรอก่อนCJS metadata โดยคงnative ESM/TLA
- [x] นับFileReader I/Oที่ค้างแยกจากrunnable tasks; initialization/callback drainรอจริง, full native readคงbacking fileและคืนNotReadableErrorเมื่ออ่านไม่ได้; internal hookไม่เผยแพร่ในQuickJS facade
- [x] ส่งinitialization errorเป็นnewline frame; nativeรับเฉพาะowned bounded errorหลังprocess exitภายในdeadlineเดิม และแยกprocess failureก่อนmetadataออกจากinvalid reply
- [x] Bunสร้างmemory Blob URLในWebViewผ่านbounded data-only transportตั้งแต่module initialization; lazy selected URLsผูกDOM owner ส่วนmemory URLsผูกVM พร้อมcached replay/ACKกันทำซ้ำเมื่อnative eventแทรก
- [x] Bun DOM listenerยอมรับnative AbortSignalโดยใช้captured native getters/listener methods; ถอดowned listenerผ่านresource transportโดยตรวจcallbackและownerเดิม แม้abortจากcallbackอื่นหรือไม่มีDOM grant
- [x] Bun signal subscriptionทนstopImmediatePropagationและตรวจsynthetic abort; guest listenerตรวจaborted stateก่อนdispatch/เพิ่มlistenerซ้ำ พร้อมdispose subscriptionที่หมดอายุระหว่างreentrant abort
- [x] Bun guest Event/EventTarget `instanceof` รู้จักnative Event/EventTarget โดยคงการตรวจsubclassเดิมและไม่เปลี่ยนnative AbortSignal/Request.signal
- [x] Guest EventTarget prototypeส่ง add/remove/dispatch ไปยังnative EventTarget receiver ผ่านcaptured Bun methods; guest-owned targetsคงเส้นทางเดิม
- [x] Guest-created Event มี native slot สำหรับ dispatch ผ่าน Bun signal พร้อม identity และ cancellation เดิม
- [x] MessageEventInit.userActivation อ่านตามลำดับ Chromium และปฏิเสธค่าที่ไม่มี owned facade; ค่าเริ่มต้นเป็น null
- [x] Guest Event prototype methods ส่ง native Event receiver ไป native intrinsic โดยตรวจ brand ก่อน
- [x] Guest Event getters/setters ส่ง native Event receiver ไป native intrinsic โดยตรวจ brand ก่อน
- [x] Event setters ใช้ captured methods ไม่เรียก method ที่ plugin override
- [x] FileReader สร้าง internal ProgressEvent ที่รักษา trusted state ใน Bun โดยไม่แก้ guest-created Event
- [x] Legacy Event initializer ปรับ native Event slot ให้ตรง type/cancelable ที่ guest เห็นก่อน native dispatch

**ตรวจผ่านแล้ว**

- [x] Bounded Windows native Bun registry/helper/store/event/File/Blob/cancel/deadline/sandbox flows ตาม receipts
- [x] Selected-file allocator และ Blob/Body memory peaks อยู่ใต้128MiBในกรณีที่ตรวจ
- [x] Native-hidden CJS/ESM path/FD/slice/composition54checks ผ่าน normal release และ debug18jobs peak133,419,008bytesใต้128MiB; source inputs1,587รายการคงเดิม
- [x] Bun workspace candidate ใช้ native UI Load CJS/ESM → tag/hooks → Send/history → Cancel/Unload → page reload/explicit Load:6HTTP requests, native callbacks6/6และQuickJS plugin workers0; แก้ registry/session bind ownerซ้ำ
- [x] แก้ combined DOM/File regression: debug18jobs + app workflow6jobs ผ่านบนbinaryเดียวกัน, peak130,494,464bytes<128MiB; errorจากbudget violationคืนprofile/ปิดเองได้
- [x] Native UI action4ชนิดจากESM plugin ผ่านJSON/HAR/privacy/raw/HTTP/file import และarguments/selection; native callbacks4/4สำเร็จ
- [x] Host helpers14checksผ่าน nested Send/Prompt/response/history/store/held cancellation/error quarantine/Load recovery รวมerrorไทยเกิน8KiB; CJS/ESM packages Loadผ่านและQuickJS plugin workers0
- [x] Native Bun editor/actions5กลุ่มและtheme UI/session cleanupหลังpage reloadผ่านบนbinaryเดียวกัน; คืนช่องสำรอง2และคงเพดาน4sessions ตาม [A21](ACCEPTANCE.md#a21)/[receipt](../../artifacts/bun-navigation-20261027/verification.json)
- [x] Windows Bun WM_CLOSEขณะheld store reply/idle→fresh process reopenรักษาworkspace/history/store/theme ไม่late write/replay พร้อม4ช่องว่างและexplicit Load→Send ตาม [restart receipt](../../artifacts/bun-restart-20261027/verification.json)
- [x] Bun native WebSocket payload/Disconnect helper3ข้อ, gRPC11ข้อครบ4stream modes/reflection/metadata/cancel, OAuth7ข้อและapp-info3ข้อผ่าน; รวม38checks/15jobsตาม [optional helpers receipt](../../artifacts/bun-optional-helpers-20261027/verification.json)
- [x] Bun dialogหลังHTTPจบ3ข้อ/nested response dependency4ข้อ/WebSocket-SSE completion-source-Cancel-error8ข้อผ่านบนnativeจริง รวม15checks/24HTTPrequests ตาม [dialog owner receipt](../../artifacts/bun-dom-owners-20261027/verification.json)
- [x] Terminal onHideครบ12actions: source/Unload/active/Abort/queued/normal Close/throw/CPU/wait; exactly-once detached cleanup, denied store/reopen และbounded failureผ่าน พร้อมDOM15checksและCJS/ESM session18jobs regression รวม34jobs peak124.69MiB<128MiB ตาม [terminal receipt](../../artifacts/bun-terminal-cleanup-20261027/verification.json)
- [x] NodeList/HTMLCollection: live/static/reflection28oracle groups, host mutation/retained callback/detached cleanupผ่าน3checks ตาม [collections receipt](../../artifacts/playwright/plugin-template-tags-1793093419171/dom-collections.json)
- [x] DOMTokenList: mutation/reflection/errors23oracle groups และretained classList/detached cleanupผ่าน3checks; DOMException instanceofตรงWebView ตาม [tokens receipt](../../artifacts/playwright/plugin-template-tags-1793093419171/dom-tokens.json)
- [x] DOMStringMap: dataset14+edge4oracle groups, host mutation/retained callback/detached cleanupผ่าน4checks ตาม [dataset receipt](../../artifacts/playwright/plugin-template-tags-1793093419171/dom-dataset.json); ทั้ง3กลุ่มและsession regressionรวม20jobsตาม [receipt](../../artifacts/bun-dom-state-20261027/verification.json)
- [x] Bun cookie jar/model helper4checksและnative persistence/restartผ่าน: cold model3/request2→unrelated write4/3→fresh process4/3; provider11กลุ่ม/12wireรวมstale snapshot refusalโดยไม่wire และclear→fresh processว่าง รวม5hosts exit0/profileคืนครบ ตาม [cookie receipt](../../artifacts/bun-cookie-helpers-20261027/verification.json) เป็นWindows loopback bounded proof; HTTPS/domain/proxy/platformยังค้างP08
- [x] CJS/ESM async FileReaderในcallback: WebView oracle34groups/formatผ่านmemory/selected131080bytes/owned listener admission/encoding/events/abort, foreign file denial/unawaited drain/owner lossไม่มีlate store write; reader2+existing session18jobsผ่านบนcurrent buildเดียว peak125.51MiB<128MiB/คืนprofileครบ ตาม [reader receipt](../../artifacts/bun-async-readers-final-20261027/verification.json)
- [x] Module readiness15กรณีสำเร็จผ่านCJS/ESM TLA/dependency/JSON interop/cycle/FileReader/DataTransferและdeferred initialization context; nativeไฟล์131080bytesรอก่อนmetadata/unawaited callbackและmissing-file refusalผ่าน ตาม [module receipt/reuse audit](../../artifacts/bun-module-readiness-debug3-20261027/verification.json) โดยsuccessful paths/fixturesตรงเดิมหลังแก้เฉพาะerror paths
- [x] Current native initialization refusals22กรณีผ่านauthored error/quota/CPU-wall/empty-process failure/import/syntax ภายใน4.975วินาที; current session18+reader2jobs peak124.07MiB<128MiB/3hosts exit0/full profiles restored และshared QuickJS55checksผ่าน ตาม [receipt](../../artifacts/bun-module-readiness-debug3-20261027/verification.json) กรณีจงใจใช้memoryเต็มถูกปฏิเสธและคืนงาน ไม่ใช่positive workload

- [x] Bun object URLsบนWindows CJS/ESM: memory9/selected12รายการต่อformatตรงWebView, module/inspection/native event/SDK replay, started-fetch/foreign denial/VM-DOM-cleanup lifetimeและquota guardsผ่าน; รวม22jobs peak124.30MiB<128MiB/profileคืนครบ ตาม [receipt](../../artifacts/bun-object-urls-20261027/verification.json)
- [x] Bun native signal listenerของEventTarget/FileReader/owned DOM และRequest.signalเทียบWebView CJS/ESM; abortข้ามowner/self-abortผ่าน พร้อมsession/object URL regression24jobs peak125.30MiB<128MiBและQuickJS regression ตาม [receipt](../../artifacts/bun-native-abort-listeners-20261027/verification.json)
- [x] Bun native signal listenerผ่านstopImmediatePropagation, synthetic abortและreentrant dispatch/เพิ่มlistenerซ้ำเทียบWebView CJS/ESM บน3ชนิดtarget; feature2+session18jobs peak125.81MiB<128MiB และQuickJS regression ตาม [receipt](../../artifacts/bun-abort-reentrant-20261027/verification.json)
- [x] Bun native signal/Request.signal/abort event `instanceof` ตรงWebView CJS/ESM รวมMouseEvent subclassและfalse positives; feature2+session18jobs peak125.42MiB<128MiB ตาม [receipt](../../artifacts/bun-signal-event-brands-20261027/verification.json)
- [x] Borrowed EventTarget add/remove/dispatchบนnative AbortSignalและRequest.signal กับnative EventตรงWebView CJS/ESM; duplicate/preventDefault/removeผ่าน feature2+session18jobs peak126.08MiB<128MiBและQuickJS regression ตาม [receipt](../../artifacts/bun-native-target-methods-20261027/verification.json)
- [x] Guest-created Event บน native signal/Request.signal เทียบ WebView CJS/ESM; feature2+session18jobs ผ่าน peak131,952,640bytes<128MiB และ QuickJS Abort/DOM เฉพาะส่วนผ่าน ตาม [ผล native](../../artifacts/playwright/plugin-bun-session-1793106502814/result.json)
- [x] QuickJS Event รวมผ่าน CJS/ESM headless หลังแก้ MessageEventInit.userActivation รวม null และ invalid values ตาม [ผล](../../artifacts/playwright/plugin-dom-event-subclasses/result.json); native Bun CJS/ESM ผ่าน null/invalid และ signal dispatch ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107121585/result.json)
- [x] Borrowed preventDefault/stopPropagation/stopImmediatePropagation/composedPath/initEvent บน native abort Event และ invalid receiver ผ่าน native CJS/ESM เทียบ WebView; QuickJS Event รวมผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107330848/result.json)
- [x] Borrowed Event getters 12 และ setters 2 บน native abort Event/invalid receiver ผ่าน native CJS/ESM เทียบ WebView; QuickJS Event รวมผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107608321/result.json)
- [x] Event setters ทำงานแม้ plugin override methods; native CJS/ESM เทียบ WebView และ QuickJS Event รวมผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107856096/result.json)
- [x] FileReader trusted event regression แก้แล้ว; native CJS/ESM เทียบ WebView และ QuickJS FileReader ผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793108333668/result.json) เก็บ [ผลล้ม](../../artifacts/playwright/plugin-bun-session-1793108207017/result.json)
- [x] Legacy MouseEvent/MessageEvent reinitialization แล้ว native signal dispatch ตรง WebView CJS/ESM; QuickJS Event รวมผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793108903418/result.json)

**ยังค้าง**

- [ ] ปิด FileReader variants, host-derived Event dispatch บน native signal และ AbortSignal composition/timeout นอกหลักฐาน; owned UserActivation facade หากมี caller
- [ ] ปิดmodule/importและasync owner/checkpoint variantsที่ยังค้างในretained inventory โดยคงsandbox
- [ ] ปิดresource/hardware/platformและhost-close/repair/restart variantsที่ยังค้างนอกbounded receipts
- [ ] ผ่านcurrent-source normal release/packaging/legal gatesก่อนdefault activation
- [ ] ย้ายcallers/fixtures/config/dependenciesเป็นBun และถอดQuickJSเมื่อactivation gatesครบ

หลักฐาน/ขอบเขต: [PLUGINS](PLUGINS.md) · [TEMPLATING](TEMPLATING.md) · [actions/helpers/diagnostics](../../artifacts/bun-actions-20261027/verification.json) · [reply-buffer/memory/teardown](../../artifacts/bun-worker-lifetime-20261027/verification.json) · [app workflow/previous failure](../../artifacts/bun-workflow-20261027/verification.json) · [Bun registry](../../artifacts/bun-registry-snapshot-20261027/verification.json) · [Bun files/body](../../artifacts/bun-native-blobs-20261027/verification.json) · [native file-backed read](../../artifacts/bun-native-file-sync-20261027/verification.json)

<a id="p22"></a>

## P22 Desktop integrations — ยังไม่ปิด

เกณฑ์เดิม: Menus/shortcuts/dialogs/clipboard/window-state/single-instance/icons · Legacy: `main`

**โค้ดทำแล้ว**

- [x] Dialogs, window-state, single-instance, icons และ keyboard shortcuts
- [x] Native clipboard/Save และ owned operation cancellation ตาม implementation

**ตรวจผ่านแล้ว**

- [x] Saved shortcut/focus/dialog/history scenarios และ native Copy/Save บางกรณี
- [x] Bounded Windows close/reopen ของ gRPC/runner/GraphQL ตาม topic receipts

**ยังค้าง**

- [ ] ตรวจ menus/native actions และ focus/keyboard lifecycle ที่ยังค้าง
- [ ] ตรวจ clipboard formats/chooser/provider/OS-close/cancel variants ที่ยังขาด
- [ ] ปิด window-state/single-instance และ desktop platform QA ตาม contract

หลักฐาน/ขอบเขต: [DESIGN](DESIGN.md) · [RESPONSES](RESPONSES.md) · [UI-TESTING](UI-TESTING.md)

<a id="p23"></a>

## P23 CI / distribution / docs — ยังไม่ปิด

เกณฑ์เดิม: Bun-only CI, platform builds และ run/migrate/recovery docs ที่ตรงจริง · Legacy: `.github, scripts, README`

**โค้ดทำแล้ว**

- [x] Bun-only CI/workflows และ desktop packaging wrapper
- [x] Spectral sidecar/notices preparation; Tauri hook ถูกถอดตามcommit9b3095c7 เตรียม inputs นอก hook
- [x] Pinned vendor restore พร้อม checksum/project overrides และคำแนะนำ run/migrate/recovery
- [x] เก็บ scope/evidence/remaining gates ใน STATUS/PARITY/topic documents

**ตรวจผ่านแล้ว**

- [x] Windows executable/installer และ bounded historical Linux/package receipts ตาม CI
- [x] Vendor offline restore475files และ cleanup frontend builds ตาม STATUS

**ยังค้าง**

- [ ] ปิด current-source CI/build/runtime/install/update/uninstall matrix ของ Windows/Linux/macOS ตามscope
- [ ] ปิด signing/package/runtime/source identity และ recovery ของ release ที่จะส่งมอบ
- [ ] ปิด notice coverage/source offers/embedded runtime texts/target linkage/license obligations ที่ยังไม่ยืนยัน
- [ ] ปรับ run/migrate/recovery docs ตามผลส่งมอบจริง; ไม่ใช้เอกสารแทน implementation/acceptance

หลักฐาน/ขอบเขต: [CI](CI.md) · [LICENSES](LICENSES.md) · [STATUS](STATUS.md)

## Scope ที่เจ้าของนำออกแล้ว

- [x] Generate Code ทุกภาษา/client ยกเว้น **cURL Linux** และ **cURL Windows (PowerShell)** — รวมการลบ SDK targets, dependency, tests และ plan gates ของภาษาเก่า
- [x] Request-body Template preview panel และ Clear prompt values control ตามคำสั่งเดิม; template engine/native tags/Send ยังอยู่ในscope
- Shared UI/Git/resizable work ที่ได้รับอนุญาตแล้วคงอยู่; UX redesign ส่วนที่ยัง deferred ใช้ลำดับใน [POST-MIGRATION-UX](POST-MIGRATION-UX.md)

## ลำดับปิดงานต่อไป

1. [ ] P03/P10/P11: ปิดข้อมูล/save/recovery/import/export/reload โดยไม่ทำข้อมูลหาย
2. [ ] P04–P09: ปิด HTTP/body/auth/environment/cookie/proxy/TLS workflow และ missing verification ที่ระบุ
3. [ ] P12–P16/P19/P20/P22: ปิดแต่ละ workflow ตาม [PLAN](PLAN.md); ไม่ replay ทั้ง matrix โดยไม่มีผลกระทบ
4. [ ] P23: ปิด platform/distribution/legal ที่ไม่ขึ้นกับ P21 และตรวจส่วนที่เปลี่ยนซ้ำหลัง P21
5. [ ] P21: ปิด retained plugin compatibility, resource/lifecycle/platform และ Bun activation gates เป็นหัวข้อสุดท้าย ก่อน audit ทุกหมวดเพื่อปิด migration

## วิธีอัปเดตและเกณฑ์ปิด

- เมื่อแก้checkboxในหมวด ให้ปรับจำนวนโค้ดแล้ว/ตรวจผ่าน/ค้างในตารางด้านบนให้ตรงกัน
- จบหนึ่งงานให้ติ๊กข้อที่ทำจริงและเพิ่มหลักฐานตรงขอบเขต; ถ้ายังไม่มีผลตรวจให้คงไว้ในยังค้าง
- ปิดหมวดเมื่อ implementation และหลักฐานครบ acceptance ของหมวดกับ retained topic contracts หรือมีคำสั่งเจ้าของนำข้อกำหนดนั้นออกอย่างชัดเจน
- ถ้าเกณฑ์รายกรณีอยู่ใน topic แต่ยังไม่แสดงเป็นข้อย่อยที่นี่ ให้แยกมาใต้งานค้างของหมวดเดิมก่อนลงมือ ไม่เติมคำว่า broader compatibility เพื่อค้างแถวโดยไม่บอกงาน
- ปัญหาเฉพาะ platform/provider ต้องระบุสิ่งที่ขาด ไม่หักล้างผล Windows ที่ผ่านแล้ว และไม่เปลี่ยน unavailable เป็นผ่าน
- งานปัจจุบันและหลักฐานล่าสุดดู [STATUS](STATUS.md); เอกสารนี้ไม่สั่ง resume Goal และไม่ให้เปอร์เซ็นต์รวมจากจำนวน checkbox
