[← กลับ index](0-index.md)

# ข้อสมมติและความเสี่ยง

| Key | ประเภท | รายละเอียด | Owner | ต้องการภายใน | สถานะ | การรับมือ | Feature · MVP · Latest |
|---|---|---|---|---|---|---|---|
| AS-requirements-retained-contracts | สมมติ | เอกสารชุดนี้เป็น baseline สรุปและไม่ตัดกรณีย่อยจาก topic contracts เดิม | ผู้ดูแล requirements | ทุกครั้งที่เปลี่ยน scope | ใช้อยู่ | ผูกทุก FR กับ parity และ contract | Feature: Requirements · MVP: Migration · Latest: New |
| AS-delivery-no-new-deadline | สมมติ | ยังไม่มีวันส่งมอบหรือ performance SLA ใหม่ที่ owner ยืนยัน | Owner | ก่อนวางแผนส่งมอบ | ยังไม่กำหนด | ไม่สร้างวันที่หรือ latency target ขึ้นเอง | Feature: Delivery · MVP: Migration · Latest: New |
| RSK-worktree-concurrent-changes | เสี่ยง | Working tree มี source/docs เปลี่ยนจาก HEAD จึงไม่ใช่ immutable release snapshot | ผู้พัฒนา | ก่อนตรวจรับ release | Open | เก็บ HEAD และตรวจ identity ของ artifact แยกกัน | Feature: Verification · MVP: Migration · Latest: New |
| RSK-plugin-incomplete-activation | เสี่ยง | Bun ยังมี DOM collections/tokens/dataset และ compatibility gates ค้าง | ผู้พัฒนา runtime | ก่อน activation | Open | คง QuickJS และใช้รายการ P21 ที่เจาะจง | Feature: Plugins · MVP: Migration · Latest: New |
| RSK-platform-evidence-coverage | เสี่ยง | Windows bounded evidence ไม่ยืนยัน Linux/macOS หรือ provider variants | ผู้ดูแลตรวจรับ | ก่อนปิดแต่ละ platform gate | Open | ใช้ platform/provider ที่ตรงและไม่เปลี่ยน unavailable เป็นผ่าน | Feature: Distribution · MVP: Migration · Latest: New |
| RSK-document-stale-links | เสี่ยง | บางลิงก์ UI contracts ไม่มีไฟล์ปลายทางใน working tree | ผู้ดูแลเอกสาร | ก่อนตรวจรับ UI ที่เกี่ยวข้อง | Open | ติดตาม OQ-docs-missing-contracts และไม่สร้างผลตรวจทดแทน | Feature: Documentation · MVP: Migration · Latest: New |
| DEP-native-build-toolchains | พึ่งพา | ต้องมี Rust/Tauri prerequisites และ OS WebView/toolchain ที่ตรง platform | ผู้ดูแลเครื่อง DEV | ก่อน build/native scenario | ต้องตรวจตามเครื่อง | ใช้ README และ CI contract | Feature: Desktop · MVP: Migration · Latest: New |
| DEP-provider-nonprod-fixtures | พึ่งพา | Provider acceptance ต้องมี local fixture หรือ nonprod ที่ได้รับอนุญาตพร้อมวิธีขอ credentials | ผู้ดูแล integration | ก่อน provider acceptance | ต้องเตรียมตาม gate | ใช้ environment เดียวที่เหมาะสมและไม่บันทึก secret | Feature: Integration · MVP: Migration · Latest: New |
| DEP-release-legal-provenance | พึ่งพา | Notice coverage, source offers และ target linkage ยังต้องตรวจตรง package | ผู้ดูแล release | ก่อนส่งมอบ | Open | ตรวจ LICENSES และ retained P23 gates | Feature: Legal · MVP: Migration · Latest: New |
