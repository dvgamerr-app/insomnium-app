[← กลับ index](0-index.md)

# กฎการทำงาน

| Key | กฎ | เงื่อนไข / ข้อยกเว้น | Feature · MVP · Latest |
|---|---|---|---|
| BR-workspace-local-first | ไม่เพิ่ม app login, telemetry หรือ remote sync service | ปลายทาง request และ Git ที่ผู้ใช้เลือกยังอยู่ใน scope | Feature: Workspace · MVP: Migration · Latest: New |
| BR-resource-identity-topology | Resource IDs ต้องไม่ว่าง ไม่ซ้ำ และ parent topology ต้องถูกต้อง | ตรวจทั้ง import/load และ native save boundary | Feature: Storage · MVP: Migration · Latest: New |
| BR-storage-original-preservation | ไม่เขียนทับ malformed workspace หรือ pending Git journal ด้วยข้อมูลเริ่มต้น | Restore ต้องตรวจ backup และ identity ก่อนผู้ใช้ยืนยัน | Feature: Storage · MVP: Migration · Latest: New |
| BR-import-explicit-execution | Import ไม่รัน scripts/hooks/plugins ที่ติดมากับ source | การ execute ต้องมาจาก explicit operation ที่ได้รับอนุญาต | Feature: Import · MVP: Migration · Latest: New |
| BR-operation-owner-authority | Callback, dialog, network และ file result ใช้สิทธิ์ได้เฉพาะ live owner | Detached terminal cleanup แก้ DOM ที่ถือครองได้แต่ไม่มี store/helper privileges | Feature: Lifecycle · MVP: Migration · Latest: New |
| BR-auth-origin-precedence | รักษา manual Authorization precedence และ origin/proxy credential boundary | รายละเอียดแต่ละ scheme ใช้ AUTHENTICATION contract | Feature: Authentication · MVP: Migration · Latest: New |
| BR-git-working-changes | Git transition ต้อง drain writers และไม่ทับ working changes โดยไม่ตรวจ | Failure ที่เปลี่ยนสถานะแล้วต้องรักษา journal เพื่อ recovery | Feature: Git · MVP: Migration · Latest: New |
| BR-plugin-runtime-activation | คง QuickJS เป็น runtime หลักจน Bun ผ่าน activation gates ครบ | Bounded Windows receipts ไม่อนุญาตให้ถอด QuickJS โดยอัตโนมัติ | Feature: Plugins · MVP: Migration · Latest: New |
| BR-ui-migration-preservation | รักษา Insomnium UI/layout ระหว่าง migration | Shared controls ที่อนุญาตแล้วคงอยู่; redesign ที่เหลือเป็นระยะถัดไป | Feature: UI · MVP: Migration · Latest: New |
| BR-codegen-curl-only | Generate Code มีเฉพาะ cURL Linux และ cURL Windows PowerShell | OpenAPI request generation และ cURL import เป็นคนละฟีเจอร์ที่ยังคงอยู่ | Feature: Import/export · MVP: Migration · Latest: New |
| BR-template-removed-panels | ไม่นำ request-body Template preview panel และ Clear prompt values control กลับมา | Template engine, tags และ Send ยังอยู่ตาม scope | Feature: Templating · MVP: Migration · Latest: New |
| BR-migration-evidence-completion | ปิด migration เมื่อทุก parity/topic/platform/legal gate ผ่านหรือ owner นำออก | Build ผ่านหรือปิด P17/P18 ไม่ถือว่าทั้ง migration เสร็จ | Feature: Distribution · MVP: Migration · Latest: New |

อ้างอิง: [AGENTS](../AGENTS.md), [knowledge routing](../.claude/PROJECT-KNOWLEDGE.md), [storage validation](../src-tauri/src/storage.rs), [scope](migration/PARITY.md), [plugin contract](migration/PLUGINS.md)
