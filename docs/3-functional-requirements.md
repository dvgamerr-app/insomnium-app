[← กลับ index](0-index.md)

# ข้อกำหนดการทำงาน

ทุกข้อเป็น Must ภายใน retained migration scope; ผลตรวจจริงและกรณีย่อยใช้ [PARITY](migration/PARITY.md) และ topic contract ที่อ้างอิง โดยไม่ลดเกณฑ์เดิม

| Key | หมวด | Parity |
|---|---|---|
| [FR-desktop-shell](#fr-desktop-shell) | Desktop | [P01](migration/PARITY.md#p01) |
| [FR-workspace-layout](#fr-workspace-layout) | UI | [P02](migration/PARITY.md#p02) |
| [FR-collection-resource-crud](#fr-collection-resource-crud) | Collections | [P03](migration/PARITY.md#p03) |
| [FR-http-send-history](#fr-http-send-history) | HTTP | [P04](migration/PARITY.md#p04) |
| [FR-request-body-modes](#fr-request-body-modes) | Bodies | [P05](migration/PARITY.md#p05) |
| [FR-auth-request-credentials](#fr-auth-request-credentials) | Authentication | [P06](migration/PARITY.md#p06) |
| [FR-environment-template-render](#fr-environment-template-render) | Templating | [P07](migration/PARITY.md#p07) |
| [FR-network-cookie-proxy](#fr-network-cookie-proxy) | Network | [P08](migration/PARITY.md#p08) |
| [FR-tls-certificate-policy](#fr-tls-certificate-policy) | TLS | [P09](migration/PARITY.md#p09) |
| [FR-storage-legacy-recovery](#fr-storage-legacy-recovery) | Storage | [P10](migration/PARITY.md#p10) |
| [FR-transfer-import-export](#fr-transfer-import-export) | Import/export | [P11](migration/PARITY.md#p11) |
| [FR-graphql-schema-execute](#fr-graphql-schema-execute) | GraphQL | [P12](migration/PARITY.md#p12) |
| [FR-websocket-session-messages](#fr-websocket-session-messages) | WebSocket | [P13](migration/PARITY.md#p13) |
| [FR-sse-stream-events](#fr-sse-stream-events) | SSE | [P14](migration/PARITY.md#p14) |
| [FR-grpc-schema-streams](#fr-grpc-schema-streams) | gRPC | [P15](migration/PARITY.md#p15) |
| [FR-openapi-spec-lint](#fr-openapi-spec-lint) | OpenAPI | [P16](migration/PARITY.md#p16) |
| [FR-openapi-custom-methods](#fr-openapi-custom-methods) | OpenAPI methods | [P17](migration/PARITY.md#p17) |
| [FR-query-ordered-serialization](#fr-query-ordered-serialization) | Query | [P18](migration/PARITY.md#p18) |
| [FR-runner-suite-assertions](#fr-runner-suite-assertions) | Runner | [P19](migration/PARITY.md#p19) |
| [FR-git-workspace-transitions](#fr-git-workspace-transitions) | Git | [P20](migration/PARITY.md#p20) |
| [FR-plugin-isolated-lifecycle](#fr-plugin-isolated-lifecycle) | Plugins | [P21](migration/PARITY.md#p21) |
| [FR-desktop-native-integrations](#fr-desktop-native-integrations) | Desktop integrations | [P22](migration/PARITY.md#p22) |
| [FR-release-package-evidence](#fr-release-package-evidence) | Distribution | [P23](migration/PARITY.md#p23) |

## FR-desktop-shell

Feature: Desktop · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เปิดแอปจาก package |
| ผลลัพธ์ | เปิด executable และ installer บน platform ที่รองรับ; เข้าหน้า workspace และใช้งาน native commands |
| Error | แจ้ง prerequisite หรือ startup error โดยไม่ทำข้อมูลหาย |
| อ้างอิง | [Contract](migration/CI.md) · [Parity](migration/PARITY.md#p01) · [AC-desktop-shell](6-acceptance-criteria.md#ac-desktop-shell) |

## FR-workspace-layout

Feature: UI · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เปลี่ยน theme หรือขนาดหน้าต่าง |
| ผลลัพธ์ | คง layout, light/dark, keyboard และ resize เดิม; เข้าถึง controls และ focus ได้ตาม DESIGN |
| Error | ไม่ให้ control สำคัญถูกบังหรือ focus สูญหาย |
| อ้างอิง | [Contract](migration/DESIGN.md) · [Parity](migration/PARITY.md#p02) · [AC-workspace-layout](6-acceptance-criteria.md#ac-workspace-layout) |

## FR-collection-resource-crud

Feature: Collections · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | จัด resources ใน workspace |
| ผลลัพธ์ | สร้าง แก้ ย้าย ทำสำเนา ลบ และเลือก collection/folder/request; ID และ parent topology ถูกต้องพร้อมบันทึก selection และ tabs |
| Error | ปฏิเสธ duplicate IDs หรือ parent ไม่ถูกต้อง |
| อ้างอิง | [Contract](migration/COLLECTIONS.md) · [Parity](migration/PARITY.md#p03) · [AC-collection-resource-crud](6-acceptance-criteria.md#ac-collection-resource-crud) |

## FR-http-send-history

Feature: HTTP · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | ส่ง HTTP request ไป local fixture |
| ผลลัพธ์ | ส่ง method, URL, query และ headers พร้อมดู response/history; แสดง status, headers, body และ request history ตาม context |
| Error | แสดง network error และ Cancel โดยไม่รับ late result ข้าม owner |
| อ้างอิง | [Contract](migration/HTTP.md) · [Parity](migration/PARITY.md#p04) · [AC-http-send-history](6-acceptance-criteria.md#ac-http-send-history) |

## FR-request-body-modes

Feature: Bodies · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เลือก body mode และไฟล์ที่อนุญาต |
| ผลลัพธ์ | ส่ง text, JSON, form, multipart และ binary ตาม body mode; ส่ง bytes, MIME, duplicate fields และชื่อไฟล์ตามที่กำหนด |
| Error | ปฏิเสธไฟล์หายหรือ body ไม่ถูกต้องก่อนส่ง |
| อ้างอิง | [Contract](migration/HTTP.md) · [Parity](migration/PARITY.md#p05) · [AC-request-body-modes](6-acceptance-criteria.md#ac-request-body-modes) |

## FR-auth-request-credentials

Feature: Authentication · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เลือก auth และส่ง request ไป nonprod fixture |
| ผลลัพธ์ | รองรับ auth ที่ retained รวม Basic/Bearer/API key/Digest/OAuth1/OAuth2/AWS/Hawk/ASAP/NTLM/netrc; ใช้ credentials และ signing ตาม scheme กับ manual Authorization precedence |
| Error | แจ้ง credential/provider/signing error โดยไม่ส่ง secret ผิด origin |
| อ้างอิง | [Contract](migration/AUTHENTICATION.md) · [Parity](migration/PARITY.md#p06) · [AC-auth-request-credentials](6-acceptance-criteria.md#ac-auth-request-credentials) |

## FR-environment-template-render

Feature: Templating · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | ส่ง request ที่อ้าง environment หรือ template |
| ผลลัพธ์ | Render environment และ built-in/custom tags ตาม collection/folder/request context; ใช้ค่าตาม precedence และ snapshot ของ operation |
| Error | แจ้ง missing value, render error หรือ Cancel โดยไม่ใช้ผลเก่า |
| อ้างอิง | [Contract](migration/TEMPLATING.md) · [Parity](migration/PARITY.md#p07) · [AC-environment-template-render](6-acceptance-criteria.md#ac-environment-template-render) |

## FR-network-cookie-proxy

Feature: Network · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | ส่ง request ผ่าน local redirect/proxy fixture |
| ผลลัพธ์ | ใช้ cookie jar, redirects และ proxy ตาม request/global settings; ส่ง cookies และ route ตาม policy โดยรักษา owner |
| Error | แจ้ง proxy/auth/redirect error และไม่เผย credentials ข้าม origin |
| อ้างอิง | [Contract](migration/AUTHENTICATION.md) · [Parity](migration/PARITY.md#p08) · [AC-network-cookie-proxy](6-acceptance-criteria.md#ac-network-cookie-proxy) |

## FR-tls-certificate-policy

Feature: TLS · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เชื่อม TLS fixture |
| ผลลัพธ์ | ตรวจ server certificate และใช้ CA/client certificate ตาม host และ settings; ใช้ policy และ identity ที่เลือกตรงปลายทาง |
| Error | ปฏิเสธ certificate ไม่ถูกต้องเมื่อเปิด validation |
| อ้างอิง | [Contract](migration/TLS.md) · [Parity](migration/PARITY.md#p09) · [AC-tls-certificate-policy](6-acceptance-criteria.md#ac-tls-certificate-policy) |

## FR-storage-legacy-recovery

Feature: Storage · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | บันทึก ปิด เปิดใหม่ หรือพบไฟล์เสีย |
| ผลลัพธ์ | บันทึก workspace และนำ legacy data เข้าโดยรักษาต้นฉบับ; โหลดข้อมูลที่ผ่าน validation และเสนอ backup recovery โดยตรวจ identity |
| Error | ไม่เขียนทับไฟล์เสียหรือ journal ที่รอ recovery อัตโนมัติ |
| อ้างอิง | [Contract](migration/IMPORT-EXPORT.md) · [Parity](migration/PARITY.md#p10) · [AC-storage-legacy-recovery](6-acceptance-criteria.md#ac-storage-legacy-recovery) |

## FR-transfer-import-export

Feature: Import/export · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | นำ JSON/YAML/HAR/Postman/OpenAPI/cURL หรือ legacy source ที่รองรับเข้า |
| ผลลัพธ์ | Import/export retained formats และ Generate Code เฉพาะ cURL Linux/Windows; รักษา request semantics และเพิ่มข้อมูลตาม explicit action |
| Error | แสดง diagnostics สำหรับรูปแบบไม่รองรับและไม่รัน imported scripts |
| อ้างอิง | [Contract](migration/IMPORT-EXPORT.md) · [Parity](migration/PARITY.md#p11) · [AC-transfer-import-export](6-acceptance-criteria.md#ac-transfer-import-export) |

## FR-graphql-schema-execute

Feature: GraphQL · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | โหลด schema หรือส่ง GraphQL ไป fixture |
| ผลลัพธ์ | แก้ query/variables, validate, introspect/import schema และส่ง operation; แสดง schema/completion/navigation และ response ตาม current context |
| Error | ยกเลิก stale schema/completion และแสดง parsing/network error |
| อ้างอิง | [Contract](migration/GRAPHQL.md) · [Parity](migration/PARITY.md#p12) · [AC-graphql-schema-execute](6-acceptance-criteria.md#ac-graphql-schema-execute) |

## FR-websocket-session-messages

Feature: WebSocket · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เชื่อม local WebSocket fixture |
| ผลลัพธ์ | Connect, ส่ง/รับข้อความ, Disconnect และดู history; รักษาลำดับ ข้อมูล payload และ session ownership |
| Error | แจ้ง connection/size error และหยุดงานเมื่อ owner สิ้นสุด |
| อ้างอิง | [Contract](migration/HTTP.md) · [Parity](migration/PARITY.md#p13) · [AC-websocket-session-messages](6-acceptance-criteria.md#ac-websocket-session-messages) |

## FR-sse-stream-events

Feature: SSE · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เริ่ม stream จาก local SSE fixture |
| ผลลัพธ์ | รับและแสดง events พร้อม raw data และ history; รักษา event order, accepted prefix และ bounded retention |
| Error | แจ้ง framing/size/network error และยกเลิก stream ของ owner |
| อ้างอิง | [Contract](migration/HTTP.md) · [Parity](migration/PARITY.md#p14) · [AC-sse-stream-events](6-acceptance-criteria.md#ac-sse-stream-events) |

## FR-grpc-schema-streams

Feature: gRPC · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เลือก service/method และเรียก local gRPC fixture |
| ผลลัพธ์ | ใช้ proto/reflection และ unary/client/server/bidi พร้อม metadata/trailers; ส่งและแสดง message/status ตาม Legacy หรือ ProtoJSON profile ที่เลือก |
| Error | ปฏิเสธ schema/message ที่ผิดหรือเกินขนาดและยกเลิก owned call |
| อ้างอิง | [Contract](migration/GRPC.md) · [Parity](migration/PARITY.md#p15) · [AC-grpc-schema-streams](6-acceptance-criteria.md#ac-grpc-schema-streams) |

## FR-openapi-spec-lint

Feature: OpenAPI · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เปิด spec พร้อม local refs/assets ที่เลือก |
| ผลลัพธ์ | แก้ import/export spec, preview, lint และสร้าง requests; แสดง diagnostics และสร้าง requests ตาม operation/schema |
| Error | ปฏิเสธ structural/reference/serialization error โดยไม่ทำข้อมูลเดิมหาย |
| อ้างอิง | [Contract](migration/API-DESIGN.md) · [Parity](migration/PARITY.md#p16) · [AC-openapi-spec-lint](6-acceptance-criteria.md#ac-openapi-spec-lint) |

## FR-openapi-custom-methods

Feature: OpenAPI methods · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | สร้าง request จาก operation ที่มี custom method |
| ผลลัพธ์ | รักษา QUERY/custom methods และ case ตาม OpenAPI 3.2; แยก fixed GET จาก custom get และรักษา metadata |
| Error | แจ้ง path/operation diagnostics ตาม retained contract |
| อ้างอิง | [Contract](migration/API-DESIGN.md) · [Parity](migration/PARITY.md#p17) · [AC-openapi-custom-methods](6-acceptance-criteria.md#ac-openapi-custom-methods) |

## FR-query-ordered-serialization

Feature: Query · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | ส่ง request ที่ผสม manual/generated query |
| ผลลัพธ์ | รักษาลำดับ manual/generated rows รวม duplicate, bare และ empty values; ได้ wire query และ signature ตาม row order และ encoding policy |
| Error | ปฏิเสธ input ที่ไม่ผ่าน validation ก่อนส่ง |
| อ้างอิง | [Contract](migration/HTTP.md) · [Parity](migration/PARITY.md#p18) · [AC-query-ordered-serialization](6-acceptance-criteria.md#ac-query-ordered-serialization) |

## FR-runner-suite-assertions

Feature: Runner · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | รัน suite กับ local API fixture |
| ผลลัพธ์ | รัน user-authored suite/assertions และ Stop/fresh run; แสดงผล assertions และบันทึกผลตาม test owner |
| Error | หยุด timers/requests/callbacks ของ run เดิมและแสดง script error |
| อ้างอิง | [Contract](migration/RUNNER.md) · [Parity](migration/PARITY.md#p19) · [AC-runner-suite-assertions](6-acceptance-criteria.md#ac-runner-suite-assertions) |

## FR-git-workspace-transitions

Feature: Git · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | ใช้ local repository และ remote fixture ที่อนุญาต |
| ผลลัพธ์ | รองรับ retained local/remote workflows พร้อม conflict review และ recovery; รักษา working changes และใช้ journal/drain ใน workspace transition |
| Error | ไม่ force overwrite และคง recovery เมื่อ I/O หรือ network ล้มเหลว |
| อ้างอิง | [Contract](migration/GIT.md) · [Parity](migration/PARITY.md#p20) · [AC-git-workspace-transitions](6-acceptance-criteria.md#ac-git-workspace-transitions) |

## FR-plugin-isolated-lifecycle

Feature: Plugins · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | โหลด plugin fixture และเรียก contribution |
| ผลลัพธ์ | Explicit Load/Unload tags/hooks/actions/themes ใน isolated runtime; ตรวจ source/owner/capability และคืนทรัพยากรตาม deadline |
| Error | ปฏิเสธ stale/unauthorized callbacks และ quarantine error โดยไม่ replay |
| อ้างอิง | [Contract](migration/PLUGINS.md) · [Parity](migration/PARITY.md#p21) · [AC-plugin-isolated-lifecycle](6-acceptance-criteria.md#ac-plugin-isolated-lifecycle) |

## FR-desktop-native-integrations

Feature: Desktop integrations · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เรียก native action หรือปิดและเปิดแอป |
| ผลลัพธ์ | ใช้ menus, shortcuts, dialogs, clipboard, window state และ single instance; ทำงานตรง selected owner พร้อม save/drain เมื่อปิด |
| Error | แจ้ง native error และไม่เขียนผลจาก chooser ที่หมดอายุ |
| อ้างอิง | [Contract](migration/DESIGN.md) · [Parity](migration/PARITY.md#p22) · [AC-desktop-native-integrations](6-acceptance-criteria.md#ac-desktop-native-integrations) |

## FR-release-package-evidence

Feature: Distribution · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| Actor | ผู้ใช้ desktop API client |
| เงื่อนไข | เตรียม package สำหรับ platform เป้าหมาย |
| ผลลัพธ์ | สร้างและตรวจ executable/installer/notices ที่ผูกกับ current source; มีผล build/runtime/install/recovery และ legal evidence ตรง artifact |
| Error | ไม่ประกาศ release/migration complete เมื่อ gate ใดยังไม่ผ่าน |
| อ้างอิง | [Contract](migration/CI.md) · [Parity](migration/PARITY.md#p23) · [AC-release-package-evidence](6-acceptance-criteria.md#ac-release-package-evidence) |
