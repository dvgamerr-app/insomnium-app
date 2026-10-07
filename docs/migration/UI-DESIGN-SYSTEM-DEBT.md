# UI/UX: รวม components และ design system ให้ใช้ร่วมกัน

2026-10-08 capability820aee4: fixed Field required context (previously decorative star only), native required inherited by5 controls/reactive optional/explicit false override, FilePicker Field error semantics, and actual Git author Preferences adoption of Field ID/required/busy ownership. Design-system native form submission contract and static dark/light1440/900/760 pass; fresh Windows production release1791407772794/1791408129110/result0 accepts native-theme1791408164309 (actual author browser validation before persistence IPC/full data preservation), Source Control and Push regressions. Current raw native-control inventory finds only specialized CodeEditor fallback outside primitives. This is one verified field semantics/adoption improvement; CSS tokens/literals/unused declaration and remaining workflow/interaction/full debt gates stay open. Exact evidence/limits/checkpoint in STATUS.

วันที่: 2026-10-05  
สถานะ: **บันทึกปัญหาและแผนแก้; ยังไม่ปิด debt**  
ฐานโค้ดของหลักฐานเดิม: `48030b1cffbd8ccb009992c306c81592dc18c92c`

## ปัญหาที่เจ้าของระบุ

UI/UX ดูเหมือนแต่ละส่วนแยกกันเขียน: บางจุดไม่ใช้ component กลาง, บางจุดสร้างรูปแบบใหม่, design system ไม่เป็นชุดเดียวกัน และเพิ่ม CSS ต่อกันโดยไม่แบ่งความรับผิดชอบให้ส่วนต่าง ๆ ใช้ร่วมกัน

เจ้าของเลือกให้ **บันทึกปัญหาและแผนแก้ใน docs** สำหรับงานนี้ การมี shared components อยู่ใน repository หรือเคย migrate controls จำนวนมาก ไม่เพียงพอที่จะถือว่าปัญหานี้แก้แล้ว ต้องย้าย consumers จริงและกำจัดความรับผิดชอบที่ซ้ำกันด้วย

เอกสารนี้เป็น architectural/UI debt เพิ่มเติมจาก [รีวิว repository](REVIEW-2026-10-05.md) ไม่ได้เปลี่ยนข้อพบเดิมทั้งสี่ให้เป็นงานที่แก้แล้ว และไม่อ้างว่าได้ทดสอบหน้าตาหรือ usability ใหม่

เจ้าของเคยยืนยัน **“บันทึกปัญหาและแผนแก้ใน docs”** ต่อมาได้สั่งแก้โค้ดโดยตรงสำหรับ SVG arrow ของ dropdown ทุกจุด, การจัดข้อความ method/protocol กลางช่อง และ hover เต็มปุ่ม ขอบเขตนี้ดำเนินการใน shared Select และ styling owners ดูผลตรวจและข้อจำกัดใน [STATUS.md](STATUS.md) งาน consolidation ทั้งระบบยังต้องแยกจาก snapshot ของรีวิวเดิม และไม่ถือว่าการมีไฟล์ใหม่หรือย้าย consumers แล้วเป็นหลักฐานว่าปิด debt ได้

## งานแก้ dropdown ตามคำสั่งล่าสุด

- SVG chevron เป็นค่าเริ่มต้นของ shared Select/Dropdown จึงใช้ร่วมกันที่ collection, environment, No Body/JSON body type, authentication, redirects และ response history; native listboxes ไม่เพิ่มลูกศร dropdown
- Method/protocol ใช้ padding สองด้านเท่ากันและจัดข้อความตรงกลางทั้งแนวนอน/แนวตั้ง; dropdown อื่นจัดข้อความกลางแนวตั้ง
- Hover เปลี่ยนพื้นผิวทั้ง control รวม padding และปุ่มชนิด ghost/plain/send แทนเปลี่ยนเฉพาะสีข้อความ
- Shared history variant จำกัดความกว้างของ shell และ select ร่วมกัน เพื่อไม่ให้ SVG หลุดออกไปจากช่อง response/stream/gRPC history
- Saved scenarios เพิ่มการตรวจลูกศรจริงใน DOM, native picker-icon ที่ซ่อน, base-select, ตำแหน่ง SVG และ hover จากมุม padding ทั้ง dark/light ดูหลักฐานล่าสุดใน STATUS; การแก้จุดเหล่านี้ยังไม่ปิดรายการ A1–A6 ทั้งหมด

## Regression ที่ยืนยันจากรีวิว: Select svgArrow (P2 / R2)

- ตำแหน่งใน review comment: `src/lib/components/ui/Select.svelte:47` (รายงาน repository snapshot อ้างบรรทัด 49; เลขบรรทัดเปลี่ยนได้ตาม revision)
- บน Chromium/WebView2 ที่รองรับ `appearance: base-select` กฎ `appearance: none` ของ Select ที่มี SVG arrow มี specificity สูงกว่ากฎส่วนกลาง ทำให้ HTTP method และ Response mode ใช้ native popup แม้ `::picker(select)` ยังตั้งเป็น `base-select`
- ผลกระทบคือ dropdown สองจุดหลุดจาก themed picker และสูญเสีย popup styling ใน dark/light จึงไม่สอดคล้องกับ shared Select จุดอื่น
- แผนแก้: ให้ `appearance: none` ใช้เฉพาะ fallback; engine ที่รองรับต้องรักษา `base-select` และซ่อนลูกศรเดิมผ่าน `::picker-icon` ใน styling owner ของ Select แห่งเดียว
- เกณฑ์ปิด: saved scenario ต้องตรวจ computed appearance, popup theme, keyboard selection และการปิดด้วย Escape ของทั้งสอง consumers ใน dark/light พร้อมบันทึกขอบเขต fallback ที่ตรวจจริง การตรวจเฉพาะ SVG หรือ alignment ไม่เพียงพอ

ข้อพบนี้มาจากการรีวิว commit ล่าสุดและ source ที่เกี่ยวข้อง ไม่ใช่การรับรอง design หรือ technical debt ทั้งระบบ และรอบรีวิวเดิมไม่ได้ทดสอบ UI จริงหรือแก้ไฟล์ ดูหลักฐานและข้อจำกัดใน [R2 ของรายงานรีวิว](REVIEW-2026-10-05.md#r2--รักษา-themed-picker-เมื่อเปิด-svgarrow)

## หลักฐานจาก snapshot ก่อน consolidation

รายการ A1–A6 และจำนวน markup ด้านล่างอ้างอิงฐานโค้ดเดิม ไม่ใช่ inventory ใหม่ของ working tree หลัง refactor ต้องสำรวจซ้ำก่อนรับงาน

### A1 — CSS ของ controls ยังมีเจ้าของมากกว่าหนึ่งแห่ง

[styles.css](../../src/lib/styles.css) มี 1,597 บรรทัดตามการแยกบรรทัดของไฟล์ ณ snapshot นี้ และรวมทั้ง tokens, native element styles, shell, API Design, GraphQL, key/value editor, streaming, response, forms, cookies และ responsive rules อยู่ไฟล์เดียว

ในไฟล์นี้มี `button`, `input`, `select`, `textarea` rules, `.primary-button`, `.secondary-button`, `.danger-button`, `.icon-button`, `.text-button`, `.form-panel` และ `.modal-actions` ขณะ [controls.css](../../src/lib/components/ui/controls.css) ก็กำหนด shared control variants/states และ modal presentation อยู่แล้ว ตัวอย่างการเป็นเจ้าของซ้ำคือ button size/padding/weight และ variant surfaces; `.modal-actions` มี declarations จากทั้งสองไฟล์

การรวม declarations ผ่าน cascade อาจตั้งใจในบางจุด แต่ตอนนี้การแก้ control ต้องรู้ทั้ง legacy/general rules กับ shared rules จึงเสี่ยงเพิ่ม override แทนการแก้ component ต้นทาง R2 เรื่อง Select appearance ในรายงานรีวิวเป็นตัวอย่างที่ยืนยันแล้วของผลกระทบจาก specificity ที่ข้ามส่วนกัน

### A2 — Tokens และมาตรวัดยังแยกเป็นหลายชุด

- `styles.css` กำหนด theme/syntax/method colors, `--radius: 4px` และ `--control-height: 32px`
- `controls.css` กำหนด `--ui-radius: 8px`, `--ui-height: 34px`, control surfaces/borders/popup/shadows และ light overrides
- [button-config.css](../../src/lib/components/ui/button-config.css) กำหนด button dimensions, spacing, typography และ radius อีกชุด
- Feature styles ยังมี literal spacing/typography เช่น Git heading `14px 18px`, runner toolbar `10px` และ gRPC message `14px`

การมี semantic tokens หลายประเภทหรือไฟล์ tokens หลายไฟล์ไม่ใช่ bug ในตัวเอง ปัญหาคือยังไม่มี ownership/mapping ที่ชัดเจนว่า scale ไหนเป็น foundation, ตัวไหนเป็น alias ของ component และ literal ไหนเป็นข้อยกเว้นที่จำเป็น การรวมระบบไม่ได้หมายความว่าทุก control ต้องมีขนาดหรือ radius เท่ากัน

### A3 — Shared Field ยังไม่ได้ใช้ทั่วระบบ

[Field.svelte](../../src/lib/components/ui/Field.svelte) มี label, required marker, description และ error แต่พบ usage ใน application เพียง **2 ตำแหน่งใน GitPanel** สำหรับ author name/email

Settings, auth, cookies, resource forms และ environment editor ยังประกอบ label/help/error ผ่าน `.form-panel`, `.name-label`, `.checkbox-label` หรือ markup เฉพาะหน้าเอง ทำให้ required/error/description และการเชื่อม `aria-describedby` ต้องจัดการซ้ำ และการปรับ form UX จาก Field กลางยังไม่มีผลทั่วระบบ

Field ปัจจุบันยังไม่ได้ทำให้การเชื่อม description/error กับ control เป็นอัตโนมัติ ผู้เรียกต้องกำหนด id และ attributes ให้ตรงกัน จึงต้องกำหนด contract ก่อนย้าย consumers ไม่เพียงครอบ markup เดิมด้วย component

### A4 — Control patterns บางประเภทไม่มี shared component ที่ใช้จริง

นับ static markup ใน `.svelte` นอก `components/ui` พบ:

| รายการ                             | จำนวนตำแหน่งใน source | หมายเหตุ                                                         |
| ---------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Native `<button>`                  | 20                    | รวม tabs, navigation, selectable rows และ segmented choices      |
| Native `<input>`                   | 34                    | 22 checkbox และ 12 file input                                    |
| `<Field>`                          | 2                     | อยู่ใน GitPanel เท่านั้น                                         |
| Feature components ที่มี `<style>` | 13                    | ต้องแยก feature layout ที่เหมาะสมออกจาก primitive styling ที่ซ้ำ |

ตัวเลขเป็นจำนวน markup sites ไม่ใช่จำนวน controls ที่ render หลัง `{#each}` และ **native markup ไม่ใช่ข้อผิดพลาดทุกตำแหน่ง** เช่น CodeMirror textarea เป็น editor integration ที่มีเหตุผลเฉพาะ สิ่งที่ต้องทำคือกำหนด shared contract ให้ patterns ที่ซ้ำ และบันทึกข้อยกเว้นที่จำเป็น

| Pattern                                  | Consumers ที่ต้องพิจารณาย้าย                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Editor/result tabs                       | RequestEditor, ResponsePane, StreamPane, GrpcPane, ApiDesign                                                                     |
| Segmented/view choices                   | GraphqlEditor Query/Schema, ResponsePane Pretty/Raw, stream selection controls                                                   |
| Checkbox                                 | Preferences, request/auth settings, OAuth/Hawk/OAuth1, key/value rows, cookie restore, Git recovery, gRPC auto-scroll            |
| File picker                              | Main import, ApiDesign source/refs, GraphQL schema, proto files/directory, request binary/multipart/cURL body, WebSocket payload |
| Labeled fields                           | Preferences, auth, cookies, environments, resources, Git author/remote forms                                                     |
| Toolbar/section/empty/error presentation | Request, GraphQL, response/stream/gRPC, API Design, Git, runner                                                                  |

หลาย tabs ใช้ `.editor-tabs` ร่วมกันอยู่แล้ว แต่ markup, selected state และ semantics ยังเขียนแยก การย้ายไป shared component ต้องรักษาพฤติกรรมที่แตกต่าง เช่น editor tabs, sent-message list และ mode toggle ไม่ควรบังคับให้ทุกอย่างเป็น tablist โดยไม่ตรวจ interaction

### A5 — Modal ใช้ presentation ร่วมบางส่วน แต่ lifecycle ยังแยกกัน

[Modal.svelte](../../src/lib/components/ui/Modal.svelte) ดูแล native dialog, Escape, heading/close button และ focus restoration ขณะที่ [TemplatePromptDialog.svelte](../../src/lib/components/TemplatePromptDialog.svelte) และ [GitRecovery.svelte](../../src/lib/components/GitRecovery.svelte) มี native dialog lifecycle ของตนเอง

Prompt ต้องผูก FIFO queue, active ID, abort และ completion; recovery มีข้อจำกัดการปิดและการยืนยันที่สำคัญ จึงไม่ควรย้ายทั้งสองเข้า generic Modal โดยสูญเสีย behavior แต่ควรใช้ dialog shell/focus/presentation contract ร่วม แล้วคง feature policies ไว้ใน feature adapter

### A6 — การโหลด styles และเอกสาร ownership ยังไม่ป้องกันการเขียนซ้ำ

[+page.svelte](../../src/routes/+page.svelte) import fonts, `styles.css` แล้ว `controls.css` ตามลำดับ การรักษาลำดับนี้เป็นส่วนหนึ่งของ cascade ปัจจุบัน แต่ยังไม่มี application style entry ที่แสดง dependency order และ owners ของแต่ละ layer อย่างชัดเจน

[UI README](../../src/lib/components/ui/README.md) ระบุว่า controls.css เป็นเจ้าของ controls และให้ feature layout อยู่กับ feature stylesheet แต่ source ยังมี ownership ซ้ำตาม A1 และยังไม่มี contract ครอบคลุม checkbox/file picker/tabs/form fields ทั้งระบบ การบันทึกว่าเคย migrate 253 controls จึงยังใช้เป็นเกณฑ์ปิด architectural debt นี้ไม่ได้

## เป้าหมายหลังแก้

1. มี design system เดียวที่อธิบาย foundations, semantic tokens, component variants/states และ composition patterns ได้
2. Primitive แต่ละชนิดมีเจ้าของ styling/behavior ชัดเจน Consumers ใช้ public props/variants แทนสร้างรูปแบบใหม่หรือ override internals
3. Feature CSS ดูแล layout และรายละเอียดเฉพาะ domain; common field, toolbar, tabs, dialog, feedback และ picker ใช้ pattern กลาง
4. แบ่ง stylesheet ตาม responsibility และโหลดผ่าน entry เดียวที่มีลำดับชัดเจน ไม่ย้ายกอง CSS ไปหลายไฟล์โดยยังมี duplicate ownership
5. ปรับ token/component จุดเดียวแล้ว consumers ที่เกี่ยวข้องเปลี่ยนสอดคล้องกันจริง พร้อมรักษา theme, keyboard, native bindings และข้อมูลเดิม

งานนี้เน้นรวม architecture และ UX consistency หน้าตาหรือ workflow ใหม่ที่เกินจากการรวมระบบต้องแยก scope ให้ชัดก่อน implementation Full migration parity ยังเป็นข้อกำหนดเดิม

## โครงสร้างที่เสนอ

โครงสร้างนี้เป็นเป้าหมายของแผนจาก snapshot เดิม; สถานะไฟล์ที่สร้างหรือย้ายระหว่าง consolidation ให้ตรวจจาก source และ STATUS:

```text
src/lib/styles/
  index.css                 # import order ของ application
  tokens/
    foundation.css          # spacing, typography, shape, motion scales
    theme.css               # dark/light semantic colors และ surfaces
  base.css                  # reset, inherited fonts, native baseline
  shell.css                 # application chrome/navigation layout
  features/                 # layout เฉพาะ request/response/graphql/etc.
src/lib/components/ui/
  Button / Input / Select / Textarea / Field
  Checkbox / FilePicker / Tabs / SegmentedControl
  DialogShell / Modal
  Toolbar / Section / EmptyState / Feedback
  styles/                   # styles ที่ primitive/pattern เป็นเจ้าของ
```

ชื่อและจำนวน components ต้องอิง inventory ที่ใช้จริง ให้ขยาย component เดิมก่อนสร้าง abstraction ใหม่ หาก pattern ไม่ได้แชร์ behavior/structure จริง ให้คง scoped feature component ไว้พร้อมเหตุผล ไม่สร้าง component กลางที่ไม่มี consumers

## แผนดำเนินการตามลำดับ

### 1. ทำ ownership inventory และ baseline

- ระบุทุก primitive/pattern, consumer, variant, styling owner และ feature exception เริ่มจากตาราง A4 แล้วตรวจ bindings/events จริง
- จัดประเภท CSS: foundation, primitive, shared pattern, shell, feature layout และ compatibility bridge
- เก็บ baseline ของ saved theme/workspace scenarios ที่ widths 1440/900/760 และทั้ง light/dark ก่อนย้าย ตรวจ product behavior ที่ scenario ครอบคลุมจริง
- บันทึกข้อบกพร่องที่มีอยู่แล้วแยกจาก regression ของการย้าย เช่น R2 themed select เพื่อไม่ตีความ baseline pass ว่าไม่มีปัญหา

### 2. รวม foundations และ style entry

- กำหนด semantic mapping ของ theme, surfaces, border, text, spacing, type, radius, sizes และ interaction states
- ย้าย tokens ไป owners ที่ชัดเจน และใช้ compatibility aliases เฉพาะช่วงย้าย ระบุ consumers ที่ยังใช้และเกณฑ์ลบแต่ละ alias
- แยก styles.css ตามหน้าที่ผ่าน application entry เดียว รักษา cascade order ระหว่าง migration และตรวจ styles หลัง build
- เปลี่ยน feature literals ที่เป็น shared design values ให้ใช้ tokens; domain dimensions เช่น editor min-size หรือ graph geometry ต้องมีเหตุผลรองรับ

### 3. กำจัด primitive styling ที่ซ้ำ

- ทำ Button/Input/Select/Textarea ให้เป็นเจ้าของ surface, variants และ hover/focus/disabled/read-only/invalid states
- ตรวจและลบ rules เก่าที่ซ้ำหลังย้าย consumers ห้ามใช้ specificity หรือ `!important` เพิ่มเพื่อกลบ ownership ที่ชนกัน
- แก้ R2 svgArrow ในเจ้าของ Select เดียว พร้อมตรวจ picker และ native fallback
- Feature overrides ที่ยังจำเป็นต้องเป็น layout contract เช่น full-width, compact placement หรือ fill-parent ไม่เปลี่ยน colors/states ของ primitive เอง

### 4. ย้าย specialized controls และ fields

- Checkbox: checked/indeterminate, native change event, controlled value และ bindable value, disabled/invalid, label/help/error
- FilePicker: native file input, keyboard activation, accessible label, multiple/directory flags, file reset/reselect และ callbacks ที่เดิมใช้; validation/byte limits อยู่ที่ feature policy หรือ helper เดิม
- Field: stable IDs, label/required, description/error association, disabled/read-only/loading contract และ accessibility ในทั้งสองธีม
- ย้าย preferences/auth/request/cookie/resource/environment/Git forms ให้ใช้จริง ตรวจ form submission, event.currentTarget และ numeric bindings ไม่เปลี่ยนจาก native semantics

### 5. รวม repeated compositions และ dialog shell

- ย้าย editor/result tabs และ segmented choices ให้ใช้ component contract ร่วม Selected state/keyboard/ARIA ต้องเหมาะกับชนิด navigation และสัมพันธ์กับ panel ที่แสดง
- รวม toolbar, section heading, empty/error/loading presentation ที่มีโครงสร้างซ้ำ โดยคง domain actions/data ไว้กับ feature
- แชร์ dialog presentation/focus/Escape ผ่าน shell หรือ composition โดยรักษา prompt queue/abort และ recovery lock/confirmation policies รวมถึง focus restoration
- ย้ายทีละ workflow แล้วลบ markup/styles เก่าของ workflow นั้นทันที ไม่ทิ้งระบบเก่าและใหม่ให้เลือกใช้คู่กัน

### 6. ตรวจ adoption และปิด debt ด้วยหลักฐาน

- สแกน consumers และ CSS อีกครั้ง ทุก raw control/shared selector ที่เหลือต้องมี owner และเหตุผลบันทึกไว้
- แก้/รัน saved scenarios เดิมสำหรับ behavior เดิม แยก scenario ใหม่เฉพาะส่วนที่ไม่มี coverage ตามข้อยกเว้นที่เจ้าของอนุญาต ใช้ Bun เท่านั้น
- บันทึก actual check/build/scenario results และส่วนที่ยังไม่ตรวจลง STATUS ไม่อ้าง historical passes เป็น verification ใหม่
- อัปเดต UI README ให้ API, style ownership, extension rules และ examples ตรงกับ implementation หลังย้าย

## รายการงานที่ต้องติดตาม

| งาน                        | ปัญหาที่แก้                                       | ผลลัพธ์ที่ต้องตรวจรับ                                                                 |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R2 — Select picker         | Dropdown หลุดธีมจาก specificity                   | Themed picker และ fallback ถูกต้องตาม engine; HTTP method/Response mode ผ่าน scenario |
| A1/A6 — CSS ownership      | Global/component rules ซ้ำและ import order ไม่ชัด | Entry เดียว, owner ชัด, ลบ declarations ซ้ำ                                           |
| A2 — Foundations           | Tokens/scales และค่ารายหน้าคนละชุด                | Mapping กลาง; เปลี่ยน token แล้ว consumers เปลี่ยนร่วมกัน                             |
| A3/A4 — Component adoption | สร้าง controls/fields/tabs ซ้ำราย feature         | Public contracts, consumers จริง และรายการข้อยกเว้นพร้อมเหตุผล                        |
| A5 — Dialog composition    | Presentation/focus/lifecycle เขียนแยก             | Shell ร่วม; prompt queue/abort และ recovery lock ยังถูกต้อง                           |
| Verification/documentation | มี components แต่ยังยืนยันความสอดคล้องไม่ได้      | Inventory หลังย้าย, saved scenarios, check/build และ README/STATUS ตรง source         |

สถานะทุกงานยังไม่ถือว่าปิดในเอกสารรอบนี้ ให้บันทึกหลักฐานของ implementation แยกจากข้อพบเดิม และทำเครื่องหมายผ่านเฉพาะเกณฑ์ที่ตรวจจริง

## Checklist สำหรับปิด debt

### Current source audit — 2026-10-07

The earlier single-entry claim was contradicted by `+page.svelte`: it imported both `styles.css` and the standalone `ui/controls.css`. The second import and both obsolete wrapper entries (`ui/controls.css`, unused `ui/button-config.css`) are now removed. Application styling follows `styles.css` → `styles/index.css`; the saved component fixture already uses that same ordered entry. Compiled application CSS decreased from 57,787 to 54,038 bytes. This size comparison is supporting evidence of the removed entry, not visual acceptance by itself.

TabButton now owns selected presentation from aria-selected, with ten redundant consumer expressions removed. Saved design-system reproduction failed before this fix and passes afterward, including string/boolean selection, horizontal/vertical keyboard behavior and accent/selected token propagation. The original scope and the remaining checklist are unchanged.

All twelve feature/editor scoped style blocks were inspected. Their remaining ownership boundaries and concrete follow-up are:

| Scoped owner | Retained responsibility / remaining work |
| --- | --- |
| CodeEditor | CodeMirror engine DOM, syntax, completion/lint/documentation popup placement. Editor/lint font uses font-size-12; information radius uses radius-group; information/lint shadows use editor-popup-shadow. Completion popup/option padding follows space-2/space-4 and editor-completion-shadow preserves upstream2/3/5/.2 (1a73fad); current native GraphQL17 accepts network-schema and local-SDL dark/light overrides/restoration with unchanged defaults. Retain engine placement/max bounds, relative90% completion font and3/2px completion radii as upstream adapter geometry; this does not close every editor interaction/platform/debt gate. |
| GitPanel | Change/history/commit graph layout and selection of domain rows. Graph geometry and row layout retained; redundant button-radius declarations removed and mono status follows font-size-11 (c4ad941). Current native Source Control1791412051562 passes14 groups, including default11px/0px and token14px/7px propagation/restoration in both themes plus existing workflows/widths. This accepts these ownership changes; full CSS/debt/workflow acceptance remains open. |
| GitRecovery | Shared Field inline align=start now owns wrapped checkbox alignment/dimensions; feature gap/top margin retained. Dark/light shared geometry and native locked-dialog/retry pass. Actual retained-copy OS picker and reviewed-choice workflow acceptance remains open. |
| GitRemotePanel | Remote sections and bounded advertisement list layout; no primitive interaction override found. |
| GrpcPane | Method placement, response log/time/metadata layout. Hints use shared compact Feedback; message typography now follows font-size-12/font-mono, native token propagation/dark-light streaming acceptance passes. |
| KeyValueEditor | Multipart details margins now use foundation tokens with original3/9/24/6px sizes. Removed block override of shared Field inline/stacked layout; actual native checkbox/input layout and byte/metadata Send accepted. Feature retains only details placement/cursor responsibility. |
| OAuthEditor | Token panel/action layout and long-text wrapping; retain domain layout. |
| ProtoManager | Proto tree/source/preview/remove-confirm layout. Fixed scoped layout reaching shared Button (native flexGrow0 before,1 after); removed redundant background/border and adopted compact Feedback. Fresh native full-surface hover/source/removal acceptance passes. Baseline hover already passed; no reproduced hover defect claimed. |
| ResponsePane | Filter-row sizing and history placement; only control layout overrides found. |
| RunnerPane | Suite/test/result layout and domain pass/fail colors. Duplicate test-list flex removed; retained shared list/results sizing and domain Field/Select placement. Native runner lifecycle/Stop/reload/fresh run/dark-light widths pass. |
| RunnerSidebar | Suite row layout and parent selection surface; redundant zero button-radius declaration removed. Native runner lifecycle and both themes/widths pass. |
| SettingsPanel | Settings view, sidebar, section/grid layout; selected tab presentation is now shared, sidebar width remains a domain layout contract. |

Next implementation order for this debt: remaining token/literal/unused declaration cleanup, then remaining interaction/validation/native workflow coverage. Keep CodeMirror and domain graphs/tables as explicit adapters rather than forcing them into generic primitives. Native acceptance is tracked in STATUS; full migration priority also includes the missing selected Git restore UI.

2026-10-07 evidence update: current application has one ordered style entry (`src/lib/styles.css` → `styles/index.css`) and the shared-control consumer inventory/API/ownership is now recorded in `src/lib/components/ui/README.md`. Static scan finds only CodeEditor's engine-owned textarea as raw form/button markup outside `ui`. Current `bun tests/ui/design-system.js` passes shared field associations, numeric/checkbox bindings, file reselect and dialog/tab contracts. Settings theme/workspace scenarios also pass. Historical counts above remain the original review snapshot. Scoped feature CSS audit, remaining token/alias cleanup and broader native/workflow acceptance remain open; do not mark all checklist items complete from these narrower checks.

- [ ] มี inventory และ owner สำหรับ tokens, primitives, compositions และ feature exceptions
- [ ] Application style entry มีลำดับชัดเจน; styles ของแต่ละส่วนอยู่กับ owner ที่ตรงหน้าที่
- [ ] ลบ shared control declarations ที่ซ้ำกับ legacy/global styles และไม่มี variant colors/states ที่ feature แอบกำหนดเอง
- [ ] Checkbox/file picker/fields/tabs/dialog patterns มี public contract และ consumers จริงครบตาม inventory หรือ exception ที่อธิบายได้
- [ ] การปรับ shared token/component จุดเดียวมีผลกับ consumers ที่เกี่ยวข้องโดยไม่ต้อง patch รายหน้า
- [ ] Theme/width, keyboard/focus/Escape, validation/help/error, file reselect, checked/numeric bindings และ modal lifecycle ผ่าน saved scenarios ที่ครอบคลุมเรื่องนั้น
- [ ] `bun run check` และ `bun run build` ผ่าน; native acceptance สำหรับส่วนที่แตะ Tauri behavior มีหลักฐานตรงกับ build ที่ทดสอบ
- [ ] ไม่เหลือ scaffolds ที่ไม่มี adoption, obsolete CSS หรือ compatibility aliases ที่พ้นช่วงย้ายแล้ว
- [ ] UI README และ STATUS ตรงกับ source และระบุ remaining gaps โดยไม่ทำเครื่องหมาย full migration complete

## การตรวจในงานบันทึกเดิม

อ่าน source ของ shared primitives, styles และ feature consumers; ใช้ `rg` และ inline `bun -e` เพื่อทำ markup inventory ไม่มีการแก้ source, สร้าง components, เปลี่ยน CSS, รันทดสอบ UI หรือ build ใหม่ ตัวเลขและตำแหน่งเป็น static snapshot ไม่ใช่ usability measurement

ก่อน implementation ต้องอ่านเอกสารทางการและบันทึก commands/references ตาม AGENTS.md แหล่งอ้างอิงที่เปิดอ่านระหว่างเตรียมแผนนี้:

- [Svelte bindable props](https://svelte.dev/docs/svelte/$bindable)
- [Svelte style directives](https://svelte.dev/docs/svelte/style)
- [CSS import order](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@import)

ห้ามใช้ browser-use หรือ ad-hoc browser automation การตรวจ UI ต้องใช้ saved Playwright JavaScript scenarios/helpers ตาม [POST-MIGRATION-UX.md](POST-MIGRATION-UX.md) และ AGENTS.md
