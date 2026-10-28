[← กลับ index](0-index.md)

# ขั้นตอนการใช้งาน

## WF-request-send-response

Feature: Requests · MVP: Migration · Latest: New

| Actor | Trigger |
|---|---|
| ผู้พัฒนา API / ผู้ทดสอบ | กด Send หรือ Connect จาก request ที่เลือก |

```mermaid
flowchart TD
  request_editor[เลือกและแก้ request] --> render_context[Render environment และ template]
  render_context --> validate_request{ข้อมูลและ owner ถูกต้อง?}
  validate_request -->|ไม่ผ่าน| request_error[แสดง error]
  validate_request -->|ผ่าน| native_transport[ส่งด้วย native transport]
  native_transport --> response_history[แสดง response และ history]
  native_transport -->|Cancel หรือ owner สิ้นสุด| cancel_operation[ยกเลิกงานที่เป็นเจ้าของ]
  cancel_operation --> response_history
```

## WF-workspace-save-recovery

Feature: Storage · MVP: Migration · Latest: New

| Actor | Trigger |
|---|---|
| ผู้ใช้ | แก้ข้อมูล เปิดแอป หรือขอ restore backup |

```mermaid
flowchart TD
  workspace_load[โหลด workspace] --> validate_snapshot{Snapshot ถูกต้อง?}
  validate_snapshot -->|ผ่าน| workspace_edit[ใช้งานและแก้ข้อมูล]
  workspace_edit --> serialized_save[บันทึกผ่าน save queue]
  serialized_save --> atomic_file[เขียนไฟล์แบบ atomic]
  validate_snapshot -->|ไม่ผ่าน| preserve_source[รักษาไฟล์เดิมและแสดง error]
  preserve_source --> inspect_backup[ตรวจ backup โดยยังไม่เขียนทับ]
  inspect_backup --> confirm_restore[ผู้ใช้ยืนยัน restore ที่ตรวจ identity แล้ว]
  confirm_restore --> workspace_load
```

## WF-import-review-apply

Feature: Import · MVP: Migration · Latest: New

| Actor | Trigger |
|---|---|
| ผู้ดูแล collection | เลือกไฟล์ ข้อความ หรือ legacy directory เพื่อ import |

```mermaid
flowchart TD
  selected_source[เลือก source] --> parse_validate[Parse และตรวจรูปแบบ]
  parse_validate --> supported_import{รองรับและปลอดภัย?}
  supported_import -->|ไม่ผ่าน| import_refusal[แจ้งข้อจำกัดโดยไม่แก้ข้อมูลเดิม]
  supported_import -->|ผ่าน| import_review[ตรวจรายการและ diagnostics]
  import_review --> apply_import[เพิ่ม resources ตาม explicit action]
  apply_import --> persist_import[บันทึกโดยไม่รัน imported scripts]
```

## WF-git-transition-recovery

Feature: Git · MVP: Migration · Latest: New

| Actor | Trigger |
|---|---|
| ผู้ดูแล collection | เริ่ม Git operation ที่เปลี่ยน workspace |

```mermaid
flowchart TD
  git_action[เริ่ม Git operation] --> drain_writers[หยุดรับงานใหม่และ drain writers]
  drain_writers --> journal_transition[บันทึก transition journal]
  journal_transition --> apply_git[เปลี่ยน Git และ workspace]
  apply_git --> transition_result{สำเร็จ?}
  transition_result -->|ใช่| resume_writers[เปิดรับงานใหม่]
  transition_result -->|ไม่ใช่| retain_journal[รักษา journal และเข้าสู่ recovery]
  retain_journal --> recovery_review[ตรวจสถานะก่อนยืนยัน recovery]
```

## WF-plugin-load-retire

Feature: Plugins · MVP: Migration · Latest: New

| Actor | Trigger |
|---|---|
| ผู้ใช้ | Explicit Load plugin หรือ Unload/Cancel/ปิด owner |

```mermaid
flowchart TD
  explicit_load[Explicit Load] --> admission_check[ตรวจ source snapshot และสิทธิ์]
  admission_check --> bounded_session[เปิด isolated bounded session]
  bounded_session --> owned_callback[รัน tag hooks หรือ actions ตาม owner]
  owned_callback --> owner_end[Unload Cancel หรือ owner สิ้นสุด]
  owner_end --> revoke_privileges[ปฏิเสธงานใหม่และเพิกถอน helper privileges]
  revoke_privileges --> bounded_cleanup[ทำ detached cleanup ภายใน deadline]
  bounded_cleanup --> retire_session[คืนทรัพยากรและปิด session]
```
