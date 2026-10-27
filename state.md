# สถานะงาน

## ทำแล้ว

- ตาม owner: vendor เป็น generated/ignored; เอา404ไฟล์ออกจากindexโดยเก็บไฟล์จริงครบ เก็บ68overrides/reference + pinned manifest และเพิ่ม prepare:vendor ใน build/dev/native commands
- Clean offline restore11โฟลเดอร์/475ไฟล์ตรงทุกไบต์; build/Windows metadata/packaging identityผ่าน รายละเอียด artifacts/vendor-restore-20261027/verification.json ไม่มี test script ใหม่

- ตาม owner2026-10-27 ลบ Generate Code ภาษา/client อื่นทั้งหมด เหลือ cURL Linux/Windows พร้อม code/tests/dependency/PLAN/PARITY/topic scope; หลักฐาน artifacts/curl-only-20261027/verification.json
- Compiler0errors0warnings/build และ scenario เดิม headless ผ่าน actual cURL text/binary/multipart สองแพลตฟอร์ม; ไม่ดาวน์โหลด runtime ไม่สร้าง scenario file

- ปิด named Native Bun Blob/File memory + owned-file Body workflow: ใช้ native byte stores หลัง validation เดิม ไม่สร้าง runtime/worker/process ใหม่
- Response/Request/FormData ส่ง bytes/MIME/ชื่อไฟล์ถูกต้อง; selected metadata0reads/compositesยังlazy อ่านผ่าน64KiB owner bridge เดิม
- CJS require กับ static/dynamic ESM buffer ใช้ constructor เดียวกัน; Request getter อ่านครั้งเดียวและรักษา receiver
- Native CJS/ESM เทียบ42Blob groups และ memory/selected Body oracle ตรง WebView; alias6ต่อformat/foreign3ต่อformatผ่าน รวม File/event/helper/registry/nested/cancel/deadline/sandbox เดิม
- Debug18job peaks max110538752bytes (105.4MiB) ต่ำกว่า128MiB; release551.270s/appc67b60cd/runtime56fb2048 ผ่าน1904frozen inputs
- Host279840 native-hidden/exit0 คืนโปรไฟล์เดิมครบ ไม่มี owned process ค้าง; compiler0errors/warnings และ QuickJS42groups ผ่าน
- หลักฐาน artifacts/bun-native-blobs-20261027/verification.json และ topic.diff; ไม่มี scenario file/dependency/download ใหม่

## กำลังทำ

- Goal ครบ ./docs ถูกเจ้าของ pause; งานลด Generate Code และ vendor restore ตามคำสั่งใหม่เสร็จแล้ว; R0/full Bun activation/migration ยังไม่ครบ Default ยัง QuickJS
- PARITY ปิด2/23หมวด =8.7%ของแถว ไม่ใช่เปอร์เซ็นต์แรงงานหรือโครงการรวม ไม่มี baseline ที่ใช้คำนวณแบบนั้นได้
- HEAD875d3f8e+dirty; คำสั่ง ignore vendor รอบนี้เอาเฉพาะ404vendor filesออกจากindex; ไม่ stageงานอื่น/commit/publish
- Native ล่าสุด artifacts/bun-native-blobs-20261027/candidate/build-state.json; debug2/build-state.json; ไม่มี live handles

## ต้องทำต่อ

- Native file-backed Blob ที่อ่านแบบ synchronous ยัง fail closed: ต้องเชื่อม bounded native reader ก่อนเปิดรับ path นี้; native async read/constructor ยังทำงานตามปกติ
- เชื่อม async FileReader/object URLs และ native AbortSignal/EventTarget ตาม plugin inventory/callers ที่ต้องใช้จริง ก่อนเปลี่ยน default/ถอด QuickJS
- Broader async event bursts/subclasses/providers/cancellation/resource/platform/OS-close/legal/packaging และทุก PLAN/PARITY gate ยังอยู่ครบ
- งาน selected File allocator และ owned click/checkpoint/retirement ปิดก่อนหน้าแล้ว ใช้ receipt เดิม ไม่เพิ่ม budget/--smol/chunk-GC หรือ replay ชุดเขียวโดยไม่มีเหตุ
- Digest proxy proof/nonce cache/legacy encodings และ retained workflows อื่นตาม docs ยังต้องทำ

## ปัญหาและข้อจำกัด

- Automatic approval review ปฏิเสธ recursive cleanup ของ artifacts/vendor-restore-20261027/{clean,fetch-check}: blocked by policy; สำเนายังอยู่ ไม่ retry/เปลี่ยนวิธีลบ

- Unfiltered all-platform Cargo metadata --offline ขาด combine4.6.9; Windows-filtered locked/offlineผ่าน ไม่ได้ดาวน์โหลดแก้ unrelated cache

- /compact เรียกผ่าน interface นี้ไม่ได้; ไฟล์นี้เป็น handoff ไม่อ้างว่า compact แล้ว
- เก็บ failed manifest refusal (เพิ่ม module ใน producer+native whitelist แล้ว), CSP-after-await oracle และชื่อ exception ที่คาดผิด; product guards/CSP ไม่ลด
- Eager Array.from diagnostic พบ invalid infinite sequence แล้วหยุดเฉพาะ owned probe; โค้ดจริงกลับมาใช้ per-item validation เดิมและ42groupsผ่าน
- Policy-rejected cleanup ก่อนหน้าไม่ retry; .local ไม่อยู่แล้วตาม filesystem ปัจจุบัน รอบนี้ถอน dependency ของ snippet ที่ถูกนำออกแบบ offline
- Docker cache insomnium-current-build-ca6a7fe5 ยัง stopped; whole macOS offline check เดิมขาด pin-utils0.1.1
