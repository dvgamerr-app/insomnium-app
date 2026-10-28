# Acceptance — checklist ตรวจรับ

อัปเดต 2026-10-27 · [STATUS](STATUS.md) = งานล่าสุด · [PARITY](PARITY.md) = โค้ด/ผลตรวจ/งานค้างรายหมวด

- **ตรวจผ่านแล้ว**: `[x]` ยืนยันเฉพาะ source/platform/กรณีในหลักฐาน ไม่ได้ปิดทั้งชุด
- **ยังต้องตรวจ**: `[ ]` ยังไม่มีหลักฐานครบตามข้อนั้น แม้ implementation หรือบางกรณีจะผ่านแล้ว
- ติ๊กแต่ละข้อเมื่อมีผลตรวจตรงขอบเขต พร้อมลิงก์ receipt; ไม่ใช้จำนวน checkbox เป็นเปอร์เซ็นต์โครงการ
- ใช้ disposable profile/collection และ loopback/provider ที่ได้รับอนุญาต รักษาข้อมูลต้นฉบับและ secrets
- ใช้ saved scenario เดิมผ่าน Bun; browser เป็น headless และ native host เป็น native-hidden ห้าม browser-use
- Browser preview, mocked IPC และ direct executor ยืนยันได้เฉพาะชั้นนั้น ไม่แทน native UI/provider/platform
- รายการนี้แยกขั้นตอนเดิมให้อ่านและปิดทีละงาน; ข้อกำหนดละเอียดใน topic contracts ยังคงอยู่

## เลือกชุดตรวจ

จำนวนด้านล่างนับข้อย่อยในชุดนั้น; ขนาดงานต่างกัน และหนึ่งข้อผ่านอาจยืนยันได้เฉพาะบางกรณี ไม่ใช่เปอร์เซ็นต์ความสำเร็จของชุดหรือโครงการ

| ชุด | เรื่อง | ผ่าน | ค้าง | PARITY |
| --- | --- | ---: | ---: | --- |
| [A01](#a01) | Desktop/collection/environment/HTTP/storage | 1 | 17 | P01–P10/P22 |
| [A02](#a02) | GraphQL | 1 | 8 | P12 |
| [A03](#a03) | WebSocket/SSE | 1 | 9 | P13/P14 |
| [A04](#a04) | Import/export/legacy/cookies | 3 | 13 | P03/P08/P10/P11 |
| [A05](#a05) | Install/platform/release | 1 | 5 | P01/P23 |
| [A06](#a06) | API Design/OpenAPI/cURL | 3 | 11 | P11/P16/P17/P18 |
| [A07](#a07) | Digest | 1 | 9 | P06 |
| [A08](#a08) | OAuth1 / NO_PREFIX | 1 | 6 | P06 |
| [A09](#a09) | OAuth2 token exchange | 1 | 10 | P06 |
| [A10](#a10) | OAuth2 Authorization Code/PKCE | 1 | 8 | P06 |
| [A11](#a11) | OAuth2 Implicit | 1 | 7 | P06 |
| [A12](#a12) | Legacy login window | 1 | 7 | P06/P22 |
| [A13](#a13) | Basic/Bearer/API key | 1 | 4 | P06 |
| [A14](#a14) | Manual Authorization precedence | 1 | 5 | P06 |
| [A15](#a15) | AWS IAM | 1 | 6 | P06 |
| [A16](#a16) | Hawk | 1 | 4 | P06 |
| [A17](#a17) | ASAP | 1 | 4 | P06 |
| [A18](#a18) | NTLM | 1 | 4 | P06/P08 |
| [A19](#a19) | netrc | 1 | 3 | P06 |
| [A20](#a20) | gRPC | 4 | 9 | P15 |
| [A21](#a21) | Bun plugin activation | 35 | 7 | P21 |

เกณฑ์อื่นที่ยังต้องปิดใน PARITY ใช้ checklist ของ topic โดยตรง: [runner P19](PARITY.md#p19) → [RUNNER](RUNNER.md), [Git P20](PARITY.md#p20) → [GIT](GIT.md), [templates P07/P21](TEMPLATING.md), [response P04](RESPONSES.md), [TLS/proxy P09](TLS.md), [desktop/accessibility P02/P22](DESIGN.md), [legal P23](LICENSES.md) ไม่ได้ตัดออกเพราะไม่มีชุด A แยก

<a id="a01"></a>

## A01 Desktop/collection/environment/HTTP/storage

**ตรวจผ่านแล้ว**

- [x] Windows CRUD/body/theme/Cancel/storage บางกรณีตาม [PARITY](PARITY.md#p03); ยังไม่ใช่ผล workflow รวมทั้งชุด

**ยังต้องตรวจ**

- [ ] เทียบ UI กับ `_backup/legacy-electron/screenshots/v0.1.png` ที่ 1440×900/900×600 และ dark/light; header/sidebar/tabs/editor/response ไม่ถูกตัด
- [ ] สร้าง nested collection/folder, rename, duplicate subtree, ย้ายข้าม collection และ reorder siblings
- [ ] Delete ยืนยัน subtree; ปฏิเสธย้ายเข้า self/descendant และลบ collection สุดท้าย
- [ ] สลับ tabs/collections, filter แล้วเปิดใหม่; ค่าและ selection ถูกบันทึก
- [ ] สร้าง/rename/duplicate/delete sub environments; base/sub/folder inheritance รักษา overrides
- [ ] ใช้ nested variables ใน URL/query/body/auth; missing/circular variable หยุดก่อนส่ง
- [ ] Native Send ไป local echo ครบ GET, POST JSON, URL-encoded duplicate keys, multipart text/file, binary และ GraphQL query/variables
- [ ] Basic/Bearer/API key ส่งค่าตรง; disabled headers/params ไม่ถูกส่ง และ unsupported imported auth ไม่ถูกข้ามเงียบ ๆ
- [ ] Response 200/204/400/500 แสดง headers/repeated Set-Cookie, bytes/download, timings และ history selection ตรง
- [ ] Cancel delayed response, timeout stalled response, refused connection แล้ว Send ใหม่; ไม่ค้าง sending/ไม่ publish response เก่าทับ
- [ ] Redirect on/off และ cookies แยก collection; add/edit/delete/clear, expiry, host-only/path และ reload ตรง
- [ ] Cookie send-only/store-only, corrupt jar rejection และ failed-save warning; edit/clear ขณะ request ค้างไม่ถูก late cookies เติมกลับ
- [ ] TLS trusted/default invalid-cert refusal, custom CA, client cert exact hostname และ identity-active cross-origin redirect refusal
- [ ] Proxy/TLS settings บันทึกและ reload ได้
- [ ] Native import/export/response dialogs อ่าน/บันทึกไฟล์ที่เลือก; Cancel ไม่เปลี่ยน state
- [ ] Atomic storage บนข้อมูลสำเนา: invalid JSON ไม่เขียนทับ, เก็บไฟล์ก่อนหน้า, แสดง save failure และ close รอ saves
- [ ] เปิด app instance ที่สองแล้ว focus instance แรก

หลักฐาน/เกณฑ์ละเอียด: [COLLECTIONS](COLLECTIONS.md) · [HTTP](HTTP.md) · [IMPORT-EXPORT](IMPORT-EXPORT.md)

<a id="a02"></a>

## A02 GraphQL

**ตรวจผ่านแล้ว**

- [x] Windows native editor 15 checks, schema lifecycle/GET 12 checks และ Ctrl+click เฉพาะกรณีใน [GRAPHQL](GRAPHQL.md)

**ยังต้องตรวจ**

- [ ] Local endpoint: POST/GET query, variables, operation names, repeated URL params, environment และ auth/proxy/TLS/cookies; GET ไม่มี body และ mutation ใช้ POST
- [ ] Explicit schema fetch ไม่เปลี่ยน query/variables/operation/response/history; HTTP/auth/introspection/JSON/GraphQL errors แสดงชัด
- [ ] Cancel และ app close ขณะ fetch; เปลี่ยน endpoint/headers/auth/settings/environment แล้วทิ้งผลที่ไม่ตรงและขอ refresh
- [ ] สลับ request/เปิด Schema ไม่เรียก network อัตโนมัติ
- [ ] Import wrapped/raw introspection JSON และ SDL; invalid/>20 MiB ไม่แทน schema ที่ยังดี
- [ ] Search types/fields, descriptions/deprecations/defaults, export SDL, clear/cache eviction/restart ไม่ลบ request data
- [ ] Format/multi-operation selection และ validate missing fields/required variables/types พร้อม locations/partial errors; ไม่แก้ query/variables และไม่อ้าง server custom-scalar validation
- [ ] Keyboard schema import/search/list, completion/hover/navigation, resize และ dark/light ตาม UI เดิม

หลักฐาน/เกณฑ์ละเอียด: [GRAPHQL](GRAPHQL.md)

<a id="a03"></a>

## A03 WebSocket/SSE

**ตรวจผ่านแล้ว**

- [x] Windows WS 6 groups, SSE 8 + ACK/bounds 8 groups และ legacy timeline/payload metrics ตาม [HTTP](HTTP.md)/[IMPORT-EXPORT](IMPORT-EXPORT.md)

**ยังต้องตรวจ**

- [ ] WS loopback: connect auth/query/headers/subprotocol; ส่ง text/JSON/binary/ping และรับ text/binary/ping/pong/close
- [ ] WS fragmented messages, close reasons และ download รักษา bytes เดิม
- [ ] Save/rename/duplicate/import payloads; สลับ request ไม่ส่ง payload/เปิด connection อัตโนมัติ; environment/invalid JSON/base64 ถูกต้อง
- [ ] SSE GET/POST, multiline data, ID/type/retry, split UTF-8, initial BOM, CR/LF/CRLF, comments และ EOF; ไม่ reconnect/replay อัตโนมัติ
- [ ] Cancel connect/handshake/read/send, reconnect และ close active streams; final events/history บันทึกก่อนปิด และเปิดใหม่เป็น disconnected
- [ ] Stream proxy/TLS/client cert/auth และ collection cookie send/store ผ่าน native endpoints
- [ ] Fast stream/slow UI: ACK คุม IPC; filter/follow/copy/export/history ยังใช้ได้
- [ ] ตรวจ retention 1,000 events/8 MiB, large newest event, 20 MiB frame/event rejection และ 40 MiB history budget
- [ ] Preview แสดง native-only; imported legacy Accept:text/event-stream เลือก SSE แต่ explicit HTTP override ได้

หลักฐาน/เกณฑ์ละเอียด: [HTTP](HTTP.md) · [IMPORT-EXPORT](IMPORT-EXPORT.md)

<a id="a04"></a>

## A04 Import/export/legacy/cookies

**ตรวจผ่านแล้ว**

- [x] Portable HTTP binary/multipart activation เฉพาะกรณีที่ `11e9b96`/`08ab0b3`
- [x] Reviewed portable CA/key/PFX activation เฉพาะกรณีที่ `ddea70f`/`9180ac4`
- [x] Compressed legacy SSE ตาม [IMPORT-EXPORT](IMPORT-EXPORT.md); ยังไม่ปิดทุก format/variant

**ยังต้องตรวจ**

- [ ] Import Insomnia ซ้ำสองครั้ง; IDs เป็น additive และ references ยังถูกต้อง
- [ ] Postman nested folders: inherited auth, variables, duplicate/disabled queries, path variables, disabled bodies และ multipart multiple files
- [ ] เก็บ script-dependent requests และ block จน migrate; HAR เก็บ headers/body/arbitrary metadata
- [ ] Legacy NeDB สำเนา: latest update ชนะ, tombstone ลบ, index metadata ถูกข้าม, malformed line หยุด import; source hashes ไม่เปลี่ยน
- [ ] Export รักษา Workspace/Environment/RequestGroup/Request/WebSocketRequest/GrpcRequest และ unknown resource types
- [ ] ปิด ordinary HTTP body/certificate variants, proto references และ full export compatibility ที่เหลือจาก bounded proofs ข้างบน
- [ ] Reject parent cycles/orphan trees ก่อนเพิ่ม resources; unknown types ยัง export ได้
- [ ] Restore imported cookies: Preview ไม่แก้ jar/file; default keep-existing และ explicit overwrite เปลี่ยนเฉพาะ name/domain/path เดียวกัน
- [ ] รักษา expiry/Max-Age/creation/session/secure/httpOnly/SameSite/domain/host-only/IPv6/path และ source records/files
- [ ] Duplicate cookie keys ที่ last record หมดอายุไม่ฟื้นค่าเก่า; missing dates/custom extensions/partitioned cookies และ native rejections มีรายงาน
- [ ] Retry restore, write failure, corrupt jar, close/reopen และ delayed responses รักษา conflict policy/ผลบันทึก
- [ ] Empty upload ได้, >20 MiB error; history count/40 MiB serialized budget ไม่ทำ displayed response หาย
- [ ] ตรวจสำเนา representative real exports ก่อนอ้าง full compatibility; ไม่ใช้ข้อมูลต้นฉบับเป็น fixture

หลักฐาน/เกณฑ์ละเอียด: [IMPORT-EXPORT](IMPORT-EXPORT.md) · [PARITY P11](PARITY.md#p11)

<a id="a05"></a>

## A05 Install/platform/release

**ตรวจผ่านแล้ว**

- [x] Windows executable/installer builds และ historical platform receipts ตาม [CI](CI.md); ไม่ใช่ install/runtime/release ครบ

**ยังต้องตรวจ**

- [ ] Install Windows NSIS ใน disposable environment; launch/offline startup/WebView2 handling และรักษาข้อมูลเดิม
- [ ] Uninstall Windows แล้วตรวจ data-preservation policy
- [ ] macOS build/runtime/package บน host ของแพลตฟอร์มนั้น
- [ ] Linux build/runtime/package บน host ของแพลตฟอร์มนั้น
- [ ] ปิดทุก TODO/PARTIAL ใน PARITY หรือมี owner scope removal ชัดเจนก่อนประกาศ migration complete

หลักฐาน/เกณฑ์ละเอียด: [CI](CI.md) · [LICENSES](LICENSES.md)

<a id="a06"></a>

## A06 API Design/OpenAPI/cURL

**ตรวจผ่านแล้ว**

- [x] QUERY/custom operations ปิด named gate [P17](PARITY.md#p17)
- [x] Mixed manual/generated query order ปิด named gate [P18](PARITY.md#p18)
- [x] API import save/drain บางกรณีตาม [API-DESIGN](API-DESIGN.md)

**ยังต้องตรวจ**

- [ ] Design dark/light, resize, keyboard source/preview/diagnostics; production CSP เริ่ม native module Worker ได้ และ cancel/timeout ไม่ค้าง editor
- [ ] Create/import YAML/JSON, rename/edit/export/reopen รักษา source/attached files
- [ ] Legacy api_spec เปิดใน owning collection; global import เพิ่ม design collection และเปิด Design
- [ ] Validate required fields, duplicate operation IDs/YAML keys, missing path params, recursive schemas และ unresolved refs; source ไม่เปลี่ยนและ edit ยกเลิก preview/generation เก่า
- [ ] Attach nested relative refs, rename/remove แล้วแสดง failure; ไม่มี network/automatic local reads; count/size limits และ 15s cancellation ตรง
- [ ] Generate new folder สองครั้งได้ IDs แยกและไม่แก้ requests เดิม
- [ ] Native echo ยืนยัน server precedence/override/variables, scalar path/query/header, JSON/form/multipart/binary และ auth placeholders
- [ ] Complex serialization, XML/non-JSON, missing Swagger host และ unsupported auth แสดง Settings issues/block Send จนแก้หรือ acknowledge
- [ ] OpenAPI acknowledgement ไม่ล้าง Postman script blockers; provenance รอด export/import/collection duplicate
- [ ] Descriptions เป็น plain text; validate/preview/generate ไม่ execute markup/scripts หรือส่ง request อัตโนมัติ
- [ ] ปิด Spectral/custom rules/advanced variants ที่เหลือตาม API-DESIGN; Generate Code คงเฉพาะ cURL Linux/Windows

หลักฐาน/เกณฑ์ละเอียด: [API-DESIGN](API-DESIGN.md) · [CURL-IMPORT](CURL-IMPORT.md)

<a id="a07"></a>

## A07 Digest

**ตรวจผ่านแล้ว**

- [x] Origin Authentication-Info/rspauth ผ่าน Windows native 54 groups ตาม [origin proof](../../artifacts/digest-response-proof-20261027/verification.json)

**ยังต้องตรวจ**

- [ ] Native Auth: literal/environment credentials, enable/disable, save/reopen และ legacy/Postman import; manual override ใช้ A14 และ preview หยุดก่อน request
- [ ] HTTP/GraphQL/SSE/WS ผ่าน Tauri IPC: MD5/SHA-256/SHA-512-256/session, auth/auth-int, combined headers, escaped realm/opaque
- [ ] UTF8/userhash, decomposed NFC, username*, escaped Unicode และ malformed/unsupported challenges ผ่าน application UI/IPC
- [ ] Replay JSON/form/binary/multipart รักษา bytes/boundary, empty body, encoded path/query และ 20 MiB cap; response/history ไม่ซ้ำจาก 401/stale retry
- [ ] Wrong credentials จบหลัง authenticated response; stale=true retry อีกครั้งเดียว; ไม่มี Basic fallback และ unsupported session/no-qop/proxy แสดง error
- [ ] Redirect on/off, 307 preservation, 302 POST/303 conversion, limit 10, cookies และ original-origin credential scope
- [ ] Cross-origin ไม่รับ Digest/manual cookies; client-cert redirect restriction ยังทำงาน
- [ ] Cancel challenge/retry/body และ close stream handshake; total HTTP timeout ครอบคลุมทุก attempt แต่ handshake timeout ไม่หยุด established stream
- [ ] Native cookie flush/reload/proxy/TLS และ broader provider/platform; legacy non-UTF8 headers/nonce cache/proxy response-proof ยังต้องปิด

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md) · [origin proof scope](AUTHENTICATION.md#origin-digest-response-proof--2026-10-27)

<a id="a08"></a>

## A08 OAuth1 / NO_PREFIX

**ตรวจผ่านแล้ว**

- [x] Direct implementation/native/loopback ตาม [OAuth1](AUTHENTICATION.md#record-oauth1-compatibility); rendered UI/provider ยังไม่ครบ

**ยังต้องตรวจ**

- [ ] Native Auth HMAC-SHA1/HMAC-SHA256/RSA-SHA1/PLAINTEXT; environment, fixed/generated nonce/time; PEM/unsupported algorithm error ก่อนส่ง
- [ ] Legacy import มี/ไม่มี Hash Body และ duplicate/disabled form fields; visible legacy mode รักษา source/export credentials/hash metadata และมี explicit RFC switch
- [ ] Ambiguous query/property แสดงวิธีแก้; Postman inherited token → Token key และ form mode เป็น RFC
- [ ] Unsupported Postman URL/body placement/options block จนเปลี่ยนเอง; re-export รักษา original source
- [ ] Real-provider HTTP/GraphQL/SSE/WS: same-origin re-sign, cross-origin removal, cancel/timeout, cookies/proxy/TLS และ reload ผ่าน UI/Tauri IPC
- [ ] OAuth2 NO_PREFIX ส่ง raw validated token; prefix อื่นทำงานเดิม พร้อม expiry/ID-token consent

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-oauth1-compatibility)

<a id="a09"></a>

## A09 OAuth2 token exchange

**ตรวจผ่านแล้ว**

- [x] Direct native loopback 20 cases, JS และ compiled Svelte/mock IPC ตาม [AUTHENTICATION](AUTHENTICATION.md)

**ยังต้องตรวจ**

- [ ] Native Auth/local provider: Client Credentials, Password, Refresh และ Basic/body client credentials
- [ ] Scope/audience/resource/Origin/proxy/custom CA/exact-host cert และ collection cookie send/store ตรง
- [ ] Fetch token รักษา resource response/history; Send/introspection/Connect acquire/refresh ก่อนใช้ Authorization และไม่เก็บ token body ใน history
- [ ] Token-endpoint ID token แยกจาก access token; Implicit ID-token use ต้อง explicit option/visible credential label
- [ ] Expiry valid/unknown/zero, rotation, refresh ไม่มี replacement refresh token; invalid_grant block โดยไม่ลอง grant อื่น
- [ ] Clear ลบเฉพาะ active copy; restart ยืนยัน atomic persistence
- [ ] เปลี่ยน environment/credentials/auth/origin/network ขณะ pending แล้วทิ้งผล/ไม่ส่ง resource; Cancel/delete/close drain โดยไม่บันทึก late result
- [ ] กดสองครั้งไม่สร้าง concurrent token requests
- [ ] Imported tokens ไม่ bound จน review/adopt; Fetch/Clear รักษา source; duplicate request/folder/collection ไม่ copy token; malformed token แสดง error
- [ ] Postman prefix/manual override, query-token/MAC refusal จนแก้; preview reject OAuth ก่อน fetch

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md)

<a id="a10"></a>

## A10 OAuth2 Authorization Code/PKCE

**ตรวจผ่านแล้ว**

- [x] Direct builder/token exchange, configured state/exact redirect corrections ตาม [AUTHENTICATION](AUTHENTICATION.md); ยังไม่ใช่ rendered browser/Tauri IPC

**ยังต้องตรวจ**

- [ ] Actual native app/local provider: OS browser launch, exact redirect/wait status, callback และ code exchange ด้วย exact redirect_uri/S256 verifier
- [ ] Plain PKCE และ disabled PKCE แยกจาก S256
- [ ] Random/configured state, expected issuer, IPv4/localhost/IPv6/static query และ occupied port; wrong state/host/path/duplicate/mixed params ไม่กิน waiting attempt
- [ ] Remote/custom system-browser redirects รักษา registered URI/แสดง manual instructions; รับเฉพาะ matching final URL
- [ ] Bad paste ยังแก้ได้; valid denial คง error แม้ command race; form_post/OS deep-link automation ยังต้องปิด
- [ ] Cancel/delete/app close ระหว่าง setup/wait/exchange drain listener/manual registration/connections/UI; ไม่มี stale credential save/resource send
- [ ] Five-minute browser deadline แยก token timeout; Send/introspection/Connect รอ token และ refresh ภายหลังไม่เปิด browser ซ้ำ
- [ ] Native reload/persistence และ system-browser/collection-cookie isolation; direct/mock proof ไม่แทน actual browser/channels/manual command/UI

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md)

<a id="a11"></a>

## A11 OAuth2 Implicit

**ตรวจผ่านแล้ว**

- [x] Direct callback/validation และ compiled mock IPC ตาม [AUTHENTICATION](AUTHENTICATION.md); actual browser/relay/provider ยังไม่ผ่านทั้งชุด

**ยังต้องตรวจ**

- [ ] Native/disposable provider: token/id_token/id_token token/none, response modes, scope/audience/resource, exact redirect/state/issuer และ fresh nonce
- [ ] ID-only ต้อง explicit credential selection; combined default access_token; ไม่อ้าง OpenID identity verification
- [ ] Actual browser fragment → nonce-CSP callback page → clear fragment → same-origin POST; IPv4/localhost/IPv6/static query/CSP/occupied port ถูกต้อง
- [ ] Relay failure/manual fallback, five-minute/cancel/close cleanup; form_post/remote/deep-link interception ยังต้องปิด
- [ ] Wrong secret/Origin/state/nonce/path, oversized URL/body, duplicate/mixed response, malformed ID token ไม่ save; invalid callback รอต่อ แต่ valid denial จบ attempt
- [ ] Initial Implicit ไม่ต้อง token URL แต่ refresh ต้องมี; none ไม่ save token/ไม่ automatic Send
- [ ] Cancel/stale settings ไม่ save late token; history ไม่มี token; reload/export credentialKind/imported ID-token explicit consent ตรง

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md)

<a id="a12"></a>

## A12 Legacy login window

**ตรวจผ่านแล้ว**

- [x] Direct navigation/profile และ compiled mock IPC ตาม [AUTHENTICATION](AUTHENTICATION.md); actual WebView/command denial/session reload ยังไม่ครบ

**ยังต้องตรวจ**

- [ ] Login window Code/PKCE/Implicit รองรับ remote/custom/loopback redirects; capture navigation/redirect/unreachable/fragment ก่อน destination load
- [ ] Code/token ไม่ปรากฏใน logs/titles/window-state/history
- [ ] Wrong callback รอพร้อม warning; valid denial จบ; manual fallback และ user close/cancel/timeout/delete/main close ไม่มี orphan window/creation-completion race
- [ ] Separate shared cookies รอด restart; Fresh login session หมุนเฉพาะ profile นี้และรักษา API tokens
- [ ] Concurrent login/reset restrictions/platform profile storage ตรง
- [ ] ทุก application command จาก login window ถูกปฏิเสธ แม้ navigate ไป local app content; main-window commands ยังใช้ได้ ต้องตรวจ actual IPC
- [ ] Popup guidance/callback-only popup, downloads, OS client cert และ legacy certificate/validateAuthSSL differences

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md)

<a id="a13"></a>

## A13 Basic/Bearer/API key

**ตรวจผ่านแล้ว**

- [x] Direct preparation/native header echoes ตาม [auth inventory](AUTHENTICATION.md#record-auth-inventory); UI/reload/provider ทั้งชุดยังค้าง

**ยังต้องตรวจ**

- [ ] Basic ISO-8859-1 accented credentials เทียบ UTF8 default; Bearer prefix/environment และ import/export/reload
- [ ] API-key Cookie กับ existing/disabled Cookie rows, cookie send off/on, response storage, same/cross-origin, SSE/WS/provider; preview refuse explicit Cookie ก่อนส่ง
- [ ] Manual Authorization ชนะ Basic/Bearer/API-key headers แต่ API-key query ยังอยู่
- [ ] Generated OpenAPI apiKey in:cookie ใช้ environment ผ่าน native UI/IPC/reload

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-auth-inventory)

<a id="a14"></a>

## A14 Manual Authorization precedence

**ตรวจผ่านแล้ว**

- [x] Compiled workspace/native-core ตาม [auth inventory](AUTHENTICATION.md#record-auth-inventory); actual WebView/native lifecycle ยังไม่ครบ

**ยังต้องตรวจ**

- [ ] Digest/OAuth1/OAuth2 manual Authorization มี empty/mixed-case/environment names และ duplicate rows; preserve โดยไม่ generated signing/challenge
- [ ] HTTP/GraphQL/SSE/WS ไม่ acquire/refresh/open login เมื่อมี manual auth
- [ ] Explicit Fetch/Refresh ยังจัดการ token แต่ไม่ใส่ resource headers ใน token request
- [ ] Disable/remove manual header คืน signing/refresh; manual 401 ไม่ Digest retry; follow-off คงเดิม; same-origin retain/cross-origin remove
- [ ] Native UI/reload/cookies/TLS/proxy/provider ครบตามข้างบน

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-auth-inventory)

<a id="a15"></a>

## A15 AWS IAM

**ตรวจผ่านแล้ว**

- [x] Direct wire/signature 34 cases และ prior-auth 14 regressions ตาม [AWS compatibility](AUTHENTICATION.md#record-aws-compatibility); ยังไม่ใช่ AWS provider acceptance

**ยังต้องตรวจ**

- [ ] Original Auth layout/masked fields/enabled/environment/persistence/reload/Insomnia-Postman import และ manual Authorization replacement notice
- [ ] HTTP/GraphQL/SSE/WS, temporary token, exact UTF8/binary/multipart, S3 path/query, explicit region/service และ custom Host
- [ ] Same-origin re-sign/cross-origin token removal; provider success/error/expired credentials, cancel/timeout
- [ ] TLS/HTTP2/proxy/client cert/persistent cookies; real mutation ใช้ endpoint ที่ owner อนุญาตเท่านั้น
- [ ] Imported query signing/malformed settings มี explicit signed-header action; presigned URL ใช้ได้เมื่อ IAM disabled; CodeCommit GIT แสดง unsupported
- [ ] เทียบ unusual legacy aws4 path/query; loopback signature ไม่ปิด account/provider gate

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-aws-compatibility)

<a id="a16"></a>

## A16 Hawk

**ตรวจผ่านแล้ว**

- [x] Direct native protocol/wire ตาม [Hawk compatibility](AUTHENTICATION.md#record-hawk-compatibility); payload validation เป็น request hash

**ยังต้องตรวจ**

- [ ] Native UI/IPC fields, default SHA256/masked key, legacy/Postman import, environment/reload และ signing ทั้ง 3 modes
- [ ] Manual/disabled precedence, fixed/generated timestamp/nonce, ext/Oz และ malformed-input errors
- [ ] HTTP/GraphQL/SSE/WS, exact binary/multipart, Host/port/Content-Type, redirect re-sign/body conversion/cross-origin stripping, cancel/deadline/history
- [ ] Provider ext parsing, TLS/HTTP2/proxy/client cert/persistent cookies และ unusual legacy URL/Postman serialization; request payload proof ไม่ยืนยัน response-auth

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-hawk-compatibility)

<a id="a17"></a>

## A17 ASAP

**ตรวจผ่านแล้ว**

- [x] Direct signature/wire ตาม [ASAP compatibility](AUTHENTICATION.md#record-asap-compatibility); UI/reload/provider/OS ยังไม่ครบ

**ยังต้องตรวจ**

- [ ] Native Auth disposable key, legacy/Postman mode, environment issuer/audience/key; Send/introspection/SSE/WS ผ่าน real Tauri IPC
- [ ] Claims/key ID/data URI, PEM editor/reload, ES512 P-521 PKCS8/SEC1 และ wrong-curve/malformed errors
- [ ] Manual/disabled bypass และไม่มี token resource persistence
- [ ] Same-origin reuse/cross-origin stripping, TLS/proxy/cookies/cancel/settings changes; source import/export รักษา unknown auth fields

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-asap-compatibility)

<a id="a18"></a>

## A18 NTLM

**ตรวจผ่านแล้ว**

- [x] Direct HTTP/TLS และ Windows proxy407/CONNECT 30 groups ตาม [NTLM compatibility](AUTHENTICATION.md#record-ntlm-compatibility)

**ยังต้องตรวจ**

- [ ] Rendered Auth/environment credentials/domain/UPN/manual/disabled/reload; Type3 workstation ยังต้องปิด
- [ ] Real IIS/AD authentication และ WS/SSE ผ่าน Tauri IPC; cancel/deadlines/TLS/custom CA/client cert/proxy/persistent cookies
- [ ] Original-origin redirects/closed-connection error; ไม่ส่ง Type3 บน replacement connection
- [ ] NTLMv1/LM, unusual certificate/username และ broader provider/platform; bounded proxy proof ไม่ปิดทุกกรณี

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-ntlm-compatibility) · [PARITY P06](PARITY.md#p06)

<a id="a19"></a>

## A19 netrc

**ตรวจผ่านแล้ว**

- [x] Native loopback 45 cases ตาม [netrc compatibility](AUTHENTICATION.md#record-netrc-compatibility); packaged home/UI/provider ยังไม่ครบ

**ยังต้องตรวจ**

- [ ] Disposable synthetic .netrc/_netrc: HTTP/GraphQL/SSE/WS ผ่าน real Tauri IPC, disabled/manual override, cancel/reload และ history/export/errors ไม่มี credentials
- [ ] Packaged HOME precedence/USERPROFILE fallback, missing/unreadable file, Windows fallback และ Unix home lookup; ไม่อ่าน credential file จริงของผู้ใช้เป็น fixture
- [ ] TLS/proxy/persistent cookies และ redirect destination-specific/default/partial/empty entries; ไม่ยืม credentials จาก source host ไป destination อื่น

หลักฐาน/เกณฑ์ละเอียด: [AUTHENTICATION](AUTHENTICATION.md#record-netrc-compatibility)

<a id="a20"></a>

## A20 gRPC

**ตรวจผ่านแล้ว**

- [x] Native 64 cases, legacy differential 97 และ frontend/workspace 75 พร้อม native compiler validation ตาม [GRPC](GRPC.md)
- [x] Bounded Windows original UI/IPC/reload และ [Proto36](GRPC.md#record-current-proto36-native-acceptance)
- [x] Nested NeDB → Rust Echo → export/reimport ตาม [embedded proto root correction](GRPC.md#current-embedded-proto-root-correction) ที่ `5c02667`
- [x] Copy/Save/reload และ receive/ORCA เฉพาะกรณีใน [GRPC](GRPC.md)/[service config](GRPC-SERVICE-CONFIG.md)

**ยังต้องตรวจ**

- [ ] Legacy JSON/Svelte grpc_request/proto_file/proto_directory รักษา bodies/hierarchy/method selection และ layout เดิม
- [ ] Additive imports/nested tree/file replacement/directory refresh รักษา IDs/absent old files; confirmed subtree delete
- [ ] Invalid schema/cancel/concurrent changes/source editing/method discovery/environment/reload และ remaining JSON/method/example/editor variants
- [ ] Unary/server/client/bidi ผ่าน IPC: Send/repeated messages/Commit half-close/cancel/deadline/method-context change/close/shutdown/late events
- [ ] ACK คุม delivery; error ไม่ทิ้ง stale sender/registry
- [ ] Reflection v1/v1alpha/local hierarchy/stale schema, binary-text metadata, initial-trailing metadata/errors/saved responses
- [ ] Custom CA/client identity และ real providers/platforms
- [ ] Response defaults/WKT/bytes/oneof/longs/enums/invalid-coerced input, shared-editor/imported-model variants และ native-only preview guidance ที่ยังเหลือ
- [ ] Retained DNS/cache/retry/hedging/outlier/weighted/ORCA/provider/platform gates ที่เหลือใน service config

หลักฐาน/เกณฑ์ละเอียด: [GRPC](GRPC.md) · [service config](GRPC-SERVICE-CONFIG.md) · [PARITY P15](PARITY.md#p15)

<a id="a21"></a>

## A21 Bun plugin activation

**ตรวจผ่านแล้ว**

- [x] Native candidate registry/events/files/Blob/Body/sandbox บาง workflow ตาม [PLUGINS](PLUGINS.md); default ยัง QuickJS
- [x] Path/FD-backed FileReaderSync, slices และ Blob/File composition: CJS/ESM 54 checks ผ่าน Windows debug/normal release; debug peak 127.24 MiB ใต้ 128 MiB ตาม [receipt](../../artifacts/bun-native-file-sync-20261027/verification.json)
- [x] Windows native UI CJS/ESM Load → tag/request-response hooks → Send/history → Cancel/Unload → page reload/explicit Load ผ่าน6HTTP requests; callbacks6/6, QuickJS plugin workers0 ตาม [workflow receipt](../../artifacts/bun-workflow-20261027/verification.json)
- [x] แก้ reply-buffer/memory/teardown: debug DOM/File18sessions + workflow6sessions ผ่าน, peak124.45MiB<128MiB; budget failureส่งerror/Closedและปิดเองได้ ตาม [receipt](../../artifacts/bun-worker-lifetime-20261027/verification.json)
- [x] Bun native UI action request/folder/collection/document จากESM plugin ผ่านJSON/HAR export/privacy และraw/HTTP/file import; native callbacks4/4 ตาม [receipt](../../artifacts/bun-actions-20261027/verification.json)
- [x] Bun host helpers14checksผ่าน Prompt/nested Send/response/history/store/held cancellation และquarantine/explicit Load recovery; errorไทยถูกจำกัด8192UTF-8bytesโดยไม่ทำprotocolเสีย ตาม [receipt](../../artifacts/bun-actions-20261027/verification.json)
- [x] Native Bun template-tag editor: arguments8ชนิด/metadata/Unicode, action/store/Send, held-action Cancel/draft edit, Prompt Clear และenvironment editor ผ่าน5กลุ่มบนbinaryที่แก้navigationแล้ว ตาม [editor acceptance](../../artifacts/playwright/plugin-template-editor-1793088810591/acceptance.json)
- [x] Native Bun themes: Preferences/manual selection/raw CSS/light-dark media/Unload/ค่าที่บันทึกและเลือกกลับหลังpage reload ผ่าน ตาม [theme acceptance](../../artifacts/playwright/plugin-template-tags-1793088776483/theme-acceptance.json)
- [x] แก้sessionเก่าค้างหลังpage reload: คืนช่องสำรองครบ2ช่องหลังLoad2plugins และปฏิเสธช่องที่5ตามเพดานเดิม; started leaseยังยึดช่องจนcleanupเสร็จและnavigationไม่เปิดstateที่ปิดแล้ว ตาม [receipt](../../artifacts/bun-navigation-20261027/verification.json); เก็บ [failureก่อนแก้](../../artifacts/playwright/plugin-template-tags-1793087887412/result.json)
- [x] Windows WM_CLOSEขณะBunรอผลอ่านstoreออกเองได้; เปิดprocessใหม่รักษาworkspace/history/store/theme ไม่มีlate write/Send replay ได้ช่องว่าง4ช่องก่อนexplicit Load→Sendและปิดidle sessionsผ่านWM_CLOSE ตาม [restart receipt](../../artifacts/bun-restart-20261027/verification.json)
- [x] Bun WebSocket payload helper: initial/connected messagesเรียกsaved HTTP helperจริง; DisconnectยกเลิกPromptโดยไม่ส่งเพิ่ม และSendปกติฟื้นcatalogได้โดยไม่Load ตาม [optional helpers receipt](../../artifacts/bun-optional-helpers-20261027/verification.json)
- [x] Bun gRPC helpers11ข้อ: schema/unary/client/server/bidi/metadata/reflection, connection/message Prompt Cancel และautomatic recovery ผ่านnative7calls/30child HTTP ตาม [gRPC receipt](../../artifacts/playwright/plugin-template-tags-1793089712825/grpc-helper-acceptance.json)
- [x] Bun OAuth helpers7ข้อ: Fetch token/adopt imported token/resource Send/Cancel/automatic recovery รักษาsourceและtoken ไม่wire leak ตาม [OAuth receipt](../../artifacts/playwright/plugin-template-tags-1793089712825/oauth-helper-acceptance.json)
- [x] Bun synchronous app getInfo/getPathตรงnative API; facade frozen/unknown path denied/previous callback stale helper rejected ตาม [app-info receipt](../../artifacts/playwright/plugin-template-tags-1793089712825/app-info-acceptance.json)
- [x] Retained Bun dialog callbackใช้dialog-owner providersหลังroot renderจบ; HTTP/nested response dependency/WebSocket-SSE completion-source-Cancel-errorรวม15checksผ่าน ตาม [dialog owner receipt](../../artifacts/bun-dom-owners-20261027/verification.json)
- [x] Terminal onHide12actionsผ่านexactly-once detached cleanup/denied revoked store-helper/reopen/bounded throw-CPU-wait; queued descendantsจบก่อนcleanupและsessionปิดเชิงตรรกะทันที ตาม [terminal receipt](../../artifacts/bun-terminal-cleanup-20261027/verification.json)
- [x] NodeList/HTMLCollection28oracle groups พร้อมhost mutation/retained callback/detached cleanupผ่านnative3checks ตาม [collections](../../artifacts/playwright/plugin-template-tags-1793093419171/dom-collections.json)
- [x] DOMTokenList23oracle groups/DOMException branding/retained classList/detached cleanupผ่านnative3checks ตาม [tokens](../../artifacts/playwright/plugin-template-tags-1793093419171/dom-tokens.json)
- [x] DOMStringMap dataset14+edge4oracle groups/host mutation/retained callback/detached cleanupผ่านnative4checks ตาม [dataset](../../artifacts/playwright/plugin-template-tags-1793093419171/dom-dataset.json); existing CJS/ESM session regressionยังผ่านตาม [receipt](../../artifacts/bun-dom-state-20261027/verification.json)
- [x] Bun cookie helper4checks: modelเก็บexpired record/requestกรอง, host-only/domain/path/secure/httpOnly fieldsและguest mutationไม่แก้ไฟล์; native cold read/write/fresh processและprovider11กลุ่ม/12wireผ่าน รวม5hosts exit0/full profileคืนครบ ตาม [cookie receipt](../../artifacts/bun-cookie-helpers-20261027/verification.json) คงHTTPS/domain/proxy/platform gatesในP08และA01
- [x] Bun async FileReaderในlive callback: CJS/ESMเทียบWebView34oracle groups/format, selected131080bytes/owned listener removal/events/encoding/abort, foreign denial/unawaited drain/owner lossไม่มีlate writeผ่าน; existing session18jobsยังผ่าน รวม20jobs peak125.51MiB<128MiB/profileคืนครบ ตาม [reader receipt](../../artifacts/bun-async-readers-final-20261027/verification.json) ขอบเขตcallback; module initializationแยกข้อถัดไป
- [x] Module readiness15positive casesผ่านCJS/ESM/TLA/interop/cycle/FileReader/DataTransfer, no-owner initialization contextและnative disk131080bytes/unawaited read/missing-file error ตาม [module receipt](../../artifacts/bun-module-readiness-debug3-20261027/verification.json) มีbyte/source auditยืนยันreuseเฉพาะsuccessful pathsที่ไม่เปลี่ยน ไม่เปลี่ยนสถานะwhole runเก่าที่failed
- [x] Current native refusal22casesผ่านauthored initialization errors/quota/CPU-wall/process failure/import/syntaxภายใน4.975วินาที; current session18+reader2jobs peak124.07MiB<128MiB/profileคืนครบ และQuickJS55checksผ่าน ตาม [receipt](../../artifacts/bun-module-readiness-debug3-20261027/verification.json) คงresource/platform/activation gatesนอกขอบเขต

- [x] Bun object URLsบนWindows CJS/ESM: memory9/selected12รายการต่อformatเทียบWebView, module/inspection/native events/SDK replayครั้งเดียว, revoke/foreign/started-fetch/VM-DOM-cleanup lifetimeและbyte-handle guardsผ่าน; feature4+session18jobs peak124.30MiB<128MiB/profileคืนครบ ตาม [receipt](../../artifacts/bun-object-urls-20261027/verification.json)
- [x] Native AbortSignal listener optionsในBun CJS/ESM: EventTarget/FileReader/owned DOM, Request.signal, already-aborted/duplicate/once/private getter, abortข้ามownerและself-abortเทียบWebView; session/object URL regression24jobs peak125.30MiB<128MiB และQuickJS regression/profileคืนครบ ตาม [receipt](../../artifacts/bun-native-abort-listeners-20261027/verification.json)
- [x] Signal listenerไม่ถูกstopImmediatePropagationขัดขวาง; synthetic abortและreentrant dispatch/เพิ่มlistenerซ้ำตรงWebViewทั้ง3target/CJS/ESM; feature2+session18jobs peak125.81MiB<128MiBและQuickJS regression/profileคืนครบ ตาม [receipt](../../artifacts/bun-abort-reentrant-20261027/verification.json)
- [x] Native Bun AbortSignal, Request.signalและabort event ผ่าน `instanceof EventTarget` / `instanceof Event` ตรงWebView CJS/ESM โดยไม่มองnative eventเป็นMouseEventหรือรับplain objects; feature2+session18jobs peak125.42MiB<128MiB/profileคืนครบ ตาม [receipt](../../artifacts/bun-signal-event-brands-20261027/verification.json)
- [x] Borrowed EventTarget add/remove/dispatch บนnative signalและRequest.signal ใช้native EventตรงWebView CJS/ESM รวมduplicate/preventDefault/remove; feature2+session18jobs peak126.08MiB<128MiB/QuickJS regression/profileคืนครบ ตาม [receipt](../../artifacts/bun-native-target-methods-20261027/verification.json)
- [x] Guest-created Event dispatch ผ่าน native signal/Request.signal เทียบ WebView CJS/ESM; feature2+session18jobs ผ่าน และ QuickJS Abort/DOM เฉพาะส่วนผ่าน ตาม [ผล native](../../artifacts/playwright/plugin-bun-session-1793106502814/result.json)
- [x] QuickJS Event รวมผ่าน CJS/ESM หลังแก้ MessageEventInit.userActivation ค่า null/invalid ตาม [ผล](../../artifacts/playwright/plugin-dom-event-subclasses/result.json); native Bun signal ผ่านกรณีเดียวกันตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107121585/result.json)
- [x] Borrowed Event prototype methods 5 เมธอดบน native abort Event และ invalid receiver ผ่าน native CJS/ESM เทียบ WebView พร้อม QuickJS Event รวม ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107330848/result.json)
- [x] Borrowed Event getters 12 และ setters 2 บน native abort Event/invalid receiver ผ่าน native CJS/ESM เทียบ WebView พร้อม QuickJS Event รวม ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107608321/result.json)
- [x] Event setters ทำงานแม้ plugin override methods; native CJS/ESM เทียบ WebView และ QuickJS Event รวมผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793107856096/result.json)
- [x] FileReader internal ProgressEvent `isTrusted` ตรง WebView; native CJS/ESM และ QuickJS FileReader ผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793108333668/result.json)
- [x] Legacy MouseEvent/MessageEvent reinitialization แล้ว native signal dispatch ตรง WebView CJS/ESM; QuickJS Event รวมผ่าน ตาม [ผล](../../artifacts/playwright/plugin-bun-session-1793108903418/result.json)

**ยังต้องตรวจ**

- [ ] ปิด retained plugin inventory ที่เหลือนอกเหนือ saved CJS/ESM workflow ข้างบน โดยคง filesystem/network/secret/owner restrictions
- [ ] File/Blob/body combinations, async FileReader/Abort/event variantsนอกหลักฐานที่ retained plugin เรียกจริงครบหรือ fail ตามสัญญา; ตรวจ host-derived Event dispatch บน native signal
- [ ] Cancel/Unload revoke callbacks/drain work และrepairรักษาstateโดยไม่replay ครบretained inventory
- [ ] ปิดnative restart/close variantsที่เหลือในretained inventory/platform; Windows held-store/idle user-closeข้างบนไม่ยืนยันทุกกรณี
- [ ] Host close และ CPU/wall/memory/call/depth gates ครบตาม retained scope
- [ ] Compatibility/security/resource/packaging ผ่านครบก่อน default activation
- [ ] ย้าย callers/fixtures/config/dependencies เป็น Bun และถอด QuickJS; ไม่เพิ่ม fallback/product option ที่ไม่ได้ขอ

หลักฐาน/เกณฑ์ละเอียด: [PLUGINS](PLUGINS.md) · [PARITY P21](PARITY.md#p21)

## เกณฑ์บันทึกผลและปิดงาน

- [ ] ระบุ source/binary identity, platform, scenario/ขั้นตอน, ผลและ receipt ที่ย้อนตรวจได้
- [ ] Fail/cancel ไม่ทำข้อมูลหาย/เผย secrets/ทิ้ง stale callback หรือ process; คืน profile/clipboard/fixtures ตาม helper เดิม
- [ ] จบเรื่องแล้วติ๊กข้อที่ผ่านใน PARITY/ACCEPTANCE และสรุป STATUS ครั้งเดียว; ไม่เขียน diary/สร้าง scenario ซ้ำ/รันชุดเขียวซ้ำโดยไม่มีเหตุ
- [ ] ปิดชุดเมื่อเกณฑ์ของชุดและ topic contracts ครบ หรือมี owner scope removal ชัดเจน; ค้างข้อไหนระบุข้อนั้น
