# UI components และ UX ใหม่ — หลัง migration

บันทึกคำสั่งเจ้าของ: 2026-09-30
สถานะ: **เจ้าของสั่งทำ shared UI, Git tab และ resizable panels โดยตรงเมื่อ 2026-10-05 จึงเริ่มขอบเขตนี้ทันที**

คำสั่งล่าสุดให้ปรับ design theme มีผลเหนือการเลื่อนงาน theme เดิม ชื่อธีมปัจจุบันคือ Nocturne ดู NOCTURNE-THEME.md และ STATUS.md งานนี้ไม่ถือว่า migration/parity เดิมเสร็จ และไม่ลดขอบเขตเดิม

## สิ่งที่ต้องทำ

- ออกแบบ reusable Svelte JavaScript components ใน `src/lib/components/ui/` สำหรับ input แต่ละชนิด ให้ปรับพฤติกรรมและหน้าตาจากจุดเดียว
- สำรวจ input ที่ใช้อยู่จริงก่อนกำหนด API: text, password, number, URL, search, textarea, select/combobox, checkbox, radio, switch และ file picker; แยก editor เฉพาะทางเท่าที่จำเป็น
- ใช้ field wrapper ร่วมกันสำหรับ label, description, validation/error, required/optional และสถานะ disabled/read-only/loading; รองรับ keyboard, focus และ accessibility
- รวม design tokens สำหรับสี typography spacing ขนาดและ states; แยก logic ของฟีเจอร์ออกจาก UI primitives
- เปลี่ยนหน้าที่ใช้งานให้เรียก shared components เพื่อให้การแก้จุดเดียวมีผลจริง ไม่ทิ้งชุด component ที่ไม่ได้ใช้

## UX

คำสั่งล่าสุดให้ใช้ชื่อธีม Nocturne และออกแบบหน้าตาของเราเอง โดยอ้างอิงลำดับการทำงาน Source Control ของ VS Code ได้ แต่ไม่คัดลอก design ดู NOCTURNE-WORKSPACE.md

เริ่มจากสำรวจ workflow ของ collection/request, environment, auth, send/response, history, import/export และ Git แล้วออกแบบ navigation, information hierarchy และ interaction ใหม่ โดยรักษาความสามารถและข้อมูลจาก migration

## ลำดับงาน

1. คำสั่งล่าสุดอนุญาต Git/shared UI/resize ก่อน migration จบ; ขอบเขต parity เดิมยังคงอยู่
2. อ่าน docs และศึกษา reference ผ่านแหล่งข้อมูลที่อนุญาต ห้ามใช้ browser-use
3. ทำ inventory ของ UI/input และเสนอ UX flows พร้อม component API/design tokens
4. Implement shared components และนำไปใช้ตาม workflow
5. ตรวจด้วย saved Playwright JavaScript scenarios แยกตามเรื่อง รันด้วย Bun; เรื่องเดิมแก้/รันไฟล์เดิมซ้ำ
6. บันทึกผล accessibility, keyboard, validation, theme/resize และ regression ของ workflow

ข้อกำหนด Bun-only / Svelte JavaScript / ห้าม browser-use ยังคงใช้ ห้ามนำเฟสนี้ไปลดขอบเขต migration เดิมหรืออ้างว่า migration เสร็จก่อนตรวจครบ ระหว่าง migration ยังยึด Insomnium UI/layout ตามข้อตกลงเดิม การออกแบบ UX ใหม่เริ่มภายหลังตามลำดับที่เจ้าของสั่ง
