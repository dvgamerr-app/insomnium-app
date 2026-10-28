# ข้อกำหนด Insomnium

API client แบบ local-first สำหรับสร้าง ทดสอบ และจัดเก็บ API requests บน desktop โดยย้ายจาก Electron/React เป็น Tauri/Svelte และรักษา Insomnium UI เดิม

| สถานะ | MVP | อัปเดต | แหล่งข้อมูล |
|---|---|---|---|
| กำลังพัฒนาและตรวจรับ migration | Migration | 2026-10-27 | เอกสารใน repository และ working tree ที่ HEAD `fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87` |

## สารบัญ

| หน้า | เนื้อหา |
|---|---|
| [Workflow](1-workflow.md) | การใช้ request และการรักษาข้อมูล |
| [Architecture](2-architecture.md) | Desktop, runtime และ storage |
| [Functional requirements](3-functional-requirements.md) | ขอบเขตครบ 23 หมวด parity |
| [Business rules](4-business-rules.md) | กฎข้อมูล ความปลอดภัย และขอบเขต |
| [Non-functional requirements](5-non-functional-requirements.md) | ข้อกำหนดและวิธีตรวจที่วัดได้ |
| [Acceptance criteria](6-acceptance-criteria.md) | Given/When/Then ผูกกับ FR |
| [ข้อสมมติและความเสี่ยง](7-assumptions-risks.md) | ข้อจำกัดและสิ่งที่ต้องเตรียม |
| [Open Questions](8-open-questions.md) | คำถามที่ยังเปิดและคำตอบจากหลักฐาน |

## ผู้ใช้และ Scope

| ผู้ใช้ | หน้าที่ |
|---|---|
| ผู้พัฒนา API / ผู้ทดสอบ | สร้างและส่ง requests ตรวจ responses และรัน assertions |
| ผู้ดูแล collection | จัด environment, import/export และจัดการ Git |

| อยู่ใน scope | นอก scope |
|---|---|
| Desktop API client และ retained parity ทั้ง 23 หมวด | Login ของแอป, telemetry และ remote sync service ใหม่ |
| HTTP, GraphQL, WebSocket, SSE, gRPC, OpenAPI, runner, Git และ plugins | Generate Code ภาษาอื่นนอกจาก cURL Linux และ cURL Windows |
| รักษาข้อมูลเดิมและ UI เดิมระหว่าง migration | Request-body Template preview panel และ Clear prompt values control ที่ owner นำออก |
| Shared UI ที่อนุญาตและใช้อยู่แล้ว | UX redesign ระยะถัดไปก่อน migration ผ่านครบ |

## ระบบภายนอก

| ระบบ | ใช้ทำอะไร | Environment |
|---|---|---|
| API / OAuth / proxy / Git ที่ผู้ใช้กำหนด | ปลายทาง requests และ integrations | ใช้ local fixture หรือ nonprod ที่ได้รับอนุญาตในการตรวจ |
| OS และ WebView | Desktop window, dialogs, clipboard และไฟล์ | เครื่อง DEV ของแต่ละ platform |

## สถานะตรวจรับ

| ประเด็น | ข้อสรุป |
|---|---|
| Migration | ยังไม่ครบ; ปิดเฉพาะ P17 และ P18 ตาม [PARITY](migration/PARITY.md) |
| Plugin runtime | QuickJS เป็นค่าเริ่มต้น; Bun เป็น candidate จนผ่าน activation gates |
| Acceptance ในเอกสารนี้ | เป็นข้อกำหนดตรวจรับ; ไม่ใช่ผลรันใหม่และไม่แทน retained topic contracts |
| รายละเอียดเดิม | [ดัชนี migration](migration/README.md), [PLAN](migration/PLAN.md), [ACCEPTANCE](migration/ACCEPTANCE.md), [STATUS](migration/STATUS.md) |
| ฐานข้อมูล | ไม่มีฐานข้อมูลแบบตาราง; ใช้ JSON workspace และไม่สร้างหน้า Database |

## Open Questions

| OQ | ขาดอะไร | Owner | ต้องการภายใน |
|---|---|---|---|
| [OQ-docs-missing-contracts](8-open-questions.md#oq-docs-missing-contracts) | ต้นฉบับ UI contracts ที่ลิงก์ไว้แต่ไม่มีใน working tree | ผู้ดูแลเอกสาร | ก่อนตรวจรับ shared UI ที่อ้างเอกสารเหล่านี้ |

## อัปเดตล่าสุด

| วันที่ | Source | MVP | สรุป |
|---|---|---|---|
| 2026-10-27 | เอกสาร repository, source และ config ปัจจุบัน | Migration | สร้าง baseline requirement ภาษาไทยพร้อม acceptance และแยกผลตรวจเดิมจากงานค้าง |
