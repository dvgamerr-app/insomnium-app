# Migration documentation

| ไฟล์ | ใช้อ่านอะไร |
| --- | --- |
| [STATUS](STATUS.md) | งานที่ทำแล้ว งานค้าง และงานถัดไป |
| [PLAN](PLAN.md) | ลำดับส่งมอบและเกณฑ์จบ |
| [PARITY](PARITY.md) | โค้ด/ผลตรวจ/งานค้าง แยก23หมวด |
| [ACCEPTANCE](ACCEPTANCE.md) | 21 ชุดตรวจรับ แยกข้อที่ผ่านแล้ว/ยังต้องตรวจเป็นงานย่อย |

## ข้อกำหนดตามหัวข้อที่ยังใช้อยู่

- ข้อมูล: [COLLECTIONS](COLLECTIONS.md), [IMPORT-EXPORT](IMPORT-EXPORT.md), [RESPONSES](RESPONSES.md)
- Network: [HTTP](HTTP.md), [AUTHENTICATION](AUTHENTICATION.md), [TLS](TLS.md), [CURL-IMPORT](CURL-IMPORT.md)
- Protocols: [GRAPHQL](GRAPHQL.md), [GRPC](GRPC.md), [GRPC-SERVICE-CONFIG](GRPC-SERVICE-CONFIG.md)
- API tooling: [API-DESIGN](API-DESIGN.md)
- Plugin/template/runner: [PLUGINS](PLUGINS.md), [TEMPLATING](TEMPLATING.md), [RUNNER](RUNNER.md)
- Git/UI: [GIT](GIT.md), [DESIGN](DESIGN.md), [POST-MIGRATION-UX](POST-MIGRATION-UX.md)
- ตรวจรับ/ส่งมอบ: [UI-TESTING](UI-TESTING.md), [CI](CI.md), [LICENSES](LICENSES.md)

## หลักฐานเก่าที่ถอดออกจาก working docs

- [Build snapshot เดิม](https://github.com/dvgamerr-app/insomnium-app/blob/fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87/docs/migration/BUILD.json) — manifest/source hashes และ package hashes ของ releaseเก่า ไม่ใช่สถานะ build ปัจจุบัน
- [Legacy archive manifest เดิม](https://github.com/dvgamerr-app/insomnium-app/blob/fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87/docs/migration/archive-manifest.json) — รายการและ SHA256 สำหรับเทียบ legacy backup; เก็บข้อมูลเดิมใน Gitครบ
- อ่านแบบ offline ได้ด้วย `git show fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87:docs/migration/BUILD.json` และ `git show fd3a1f6540d7a5530a3a830fb7ee97539c6eeb87:docs/migration/archive-manifest.json`
- รายงานตรวจ/UI-debt/command transcripts เก่าที่ถอดก่อนหน้านี้ยังเรียกคืนจาก Git commit `c10061abcc38ac1d1e01d5f6459b1704e2c35217` ได้

อัปเดตไฟล์หลักและ topic ที่เกี่ยวข้องเมื่อจบเรื่อง ไม่สร้าง checkpoint document เพิ่มหรือคัด execution diary ลง docs
