[← กลับ index](0-index.md)

# ข้อกำหนดคุณภาพ

| Key | หมวด | เป้าหมายที่วัดได้ | วิธีตรวจ / ขอบเขต | Feature · MVP · Latest |
|---|---|---|---|---|
| NFR-storage-durable-saves | ความทนทาน | ไม่มี acknowledged save สูญหายในกรณี save/drain/close/reopen ที่ retained contract กำหนด | Native lifecycle และ backup/journal recovery scenarios | Feature: Storage · MVP: Migration · Latest: New |
| NFR-security-no-stale-effects | ความปลอดภัย | ไม่มี late write, replay หรือ helper privilege ข้าม owner หลัง Cancel/Unload | Held callback และ negative ownership fixtures | Feature: Lifecycle · MVP: Migration · Latest: New |
| NFR-plugin-bounded-resources | ทรัพยากร | Bun candidate ไม่เกิน 4 sessions และเพดาน 128 MiB ตาม metric ใน contract | Native resource receipts ต้องผูก source/build/workload; ไม่ใช่ทั้งแอป RSS | Feature: Plugins · MVP: Migration · Latest: New |
| NFR-plugin-terminal-deadline | การยกเลิก | Terminal cleanup จบหรือถูกหยุดภายใน deadline 5 วินาทีเดิม | Normal/throw/CPU/wait และ detached cleanup ตาม PLUGINS | Feature: Plugins · MVP: Migration · Latest: New |
| NFR-grpc-message-bounds | Validation | จำกัด wire/rendered JSON message 20 MiB และ nesting 64 ตาม profile | Exact boundary, overflow และ framing tests ตาม GRPC | Feature: gRPC · MVP: Migration · Latest: New |
| NFR-ui-accessible-controls | Accessibility | Keyboard/focus/error description ใช้งานได้ครบ saved scenarios ที่เกี่ยวข้อง | Dark/light และขนาด 1440/900/760 ตาม scenario; ไม่อ้าง WCAG certification | Feature: UI · MVP: Migration · Latest: New |
| NFR-tooling-bun-only | การดูแลรักษา | JavaScript tooling ใช้ Bun โดยไม่มี Node/npm/yarn execution | ตรวจ commands/workflows; Rust ใช้ Cargo | Feature: Tooling · MVP: Migration · Latest: New |
| NFR-ui-headless-verification | การทดสอบ | Saved browser scenarios ใช้ launchUiBrowser แบบ headless เท่านั้น | Native scenarios hide owned window ก่อน CDP และรายงาน native-hidden | Feature: Verification · MVP: Migration · Latest: New |
| NFR-release-source-identity | การส่งมอบ | ทุกผล acceptance ระบุ source/build/platform/evidence และผล restoration | แยก compiler, browser, native, package และ legal evidence | Feature: Distribution · MVP: Migration · Latest: New |
| NFR-security-secret-boundary | ความปลอดภัย | ไม่มี secret values หรือ production details ในเอกสารและ receipts ที่เผยแพร่ | ใช้ fixture values และตรวจ log/export ตาม privacy contract | Feature: Security · MVP: Migration · Latest: New |
| NFR-vendor-restorable-sources | ความทำซ้ำได้ | Vendor restore ตรง pinned archive/tree checksums และไม่ทับ local edits | Offline/idempotence/corruption refusal ตาม vendor contract | Feature: Build · MVP: Migration · Latest: New |

อ้างอิง: [UI testing](migration/UI-TESTING.md), [headless policy](../tests/ui/HEADLESS.md), [plugins](migration/PLUGINS.md), [gRPC](migration/GRPC.md), [CI](migration/CI.md), [licenses](migration/LICENSES.md), [vendor](../tools/vendor/README.md)
