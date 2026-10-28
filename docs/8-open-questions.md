[← กลับ index](0-index.md)

# คำถามและข้อสรุป

## Open

### OQ-docs-missing-contracts

Feature: Documentation · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| สถานะ | Open |
| ขาด | ต้นฉบับ `docs/migration/FILLED-FOREGROUND.md` และ `docs/migration/FIELD-DESCRIPTIONS.md` ที่ UI README อ้างแต่ไม่มีใน working tree |
| Block | FR-workspace-layout และ AC-workspace-layout เฉพาะเกณฑ์ UI ที่พึ่งรายละเอียดเอกสารเหล่านี้ |
| ถาม | จะกู้เอกสารต้นฉบับหรือแทนลิงก์ด้วย retained contract ใดที่ครอบคลุมเกณฑ์เดิม? |
| ตอบขั้นต่ำ | ต้นฉบับที่ตรวจสอบได้หรือตำแหน่ง contract ทดแทนที่ owner ยืนยัน |
| Owner | ผู้ดูแลเอกสาร |
| ต้องการภายใน | ก่อนตรวจรับ shared UI ที่อ้างเอกสารเหล่านี้ |
| เปิดเมื่อ | 2026-10-27 |
| หลักฐาน | `src/lib/components/ui/README.md` และรายการไฟล์ใน repository |

## Resolved

### OQ-storage-database-kind

Feature: Storage · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| สถานะ | Resolved |
| คำถาม | ต้องสร้าง DBML ของระบบใหม่หรือไม่? |
| คำตอบ | ไม่ต้อง เพราะ `storage.rs` บันทึก JSON workspace และ `persistence.js` แยก preview localStorage โดยไม่มีตารางฐานข้อมูล |
| เปิดเมื่อ | 2026-10-27 |
| ปิดเมื่อ | 2026-10-27 |

### OQ-plugin-default-runtime

Feature: Plugins · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| สถานะ | Resolved |
| คำถาม | เปลี่ยน runtime หลักเป็น Bun แล้วหรือยัง? |
| คำตอบ | ยัง; STATUS และ candidate adapter ยืนยัน QuickJS เป็นค่าเริ่มต้นจน activation gates ครบ |
| เปิดเมื่อ | 2026-10-27 |
| ปิดเมื่อ | 2026-10-27 |

### OQ-ui-redesign-sequence

Feature: UI · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| สถานะ | Resolved |
| คำถาม | ต้อง redesign UI ระหว่าง migration รอบนี้หรือไม่? |
| คำตอบ | รักษา UI เดิมและ shared work ที่อนุญาต; redesign ที่เหลือรอ migration ครบตาม AGENTS และ POST-MIGRATION-UX |
| เปิดเมื่อ | 2026-10-27 |
| ปิดเมื่อ | 2026-10-27 |

### OQ-git-clone-availability

Feature: Git · MVP: Migration · Latest: New

| หัวข้อ | รายละเอียด |
|---|---|
| สถานะ | Resolved |
| คำถาม | ข้อความ clone ค้างใน PARITY หมายความว่าไม่มีโค้ดหรือไม่? |
| คำตอบ | ไม่ใช่; มี native Clone command และ staged Clone contract แล้ว แต่ยังต้องปิด implementation/acceptance variants ตาม P20 |
| เปิดเมื่อ | 2026-10-27 |
| ปิดเมื่อ | 2026-10-27 |
