[← กลับ index](0-index.md)

# เกณฑ์ตรวจรับ

เกณฑ์นี้ยังไม่ได้รันในรอบเขียนเอกสาร; ต้องตรวจกรณีย่อยตาม [ACCEPTANCE](migration/ACCEPTANCE.md) และ topic contracts เพิ่มเติมก่อนปิดหมวด

## AC-desktop-shell

Feature: Desktop · MVP: Migration · Latest: New

[FR-desktop-shell](3-functional-requirements.md#fr-desktop-shell)

```gherkin
@FR-desktop-shell @AC-desktop-shell @Migration
Feature: Desktop
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Desktop ตาม retained contract
    When เปิดแอปจาก package
    Then เข้าหน้า workspace และใช้งาน native commands
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Desktop ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง prerequisite หรือ startup error โดยไม่ทำข้อมูลหาย
```

## AC-workspace-layout

Feature: UI · MVP: Migration · Latest: New

[FR-workspace-layout](3-functional-requirements.md#fr-workspace-layout)

```gherkin
@FR-workspace-layout @AC-workspace-layout @Migration
Feature: UI
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ UI ตาม retained contract
    When เปลี่ยน theme หรือขนาดหน้าต่าง
    Then เข้าถึง controls และ focus ได้ตาม DESIGN
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ UI ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ไม่ให้ control สำคัญถูกบังหรือ focus สูญหาย
```

## AC-collection-resource-crud

Feature: Collections · MVP: Migration · Latest: New

[FR-collection-resource-crud](3-functional-requirements.md#fr-collection-resource-crud)

```gherkin
@FR-collection-resource-crud @AC-collection-resource-crud @Migration
Feature: Collections
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Collections ตาม retained contract
    When จัด resources ใน workspace
    Then ID และ parent topology ถูกต้องพร้อมบันทึก selection และ tabs
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Collections ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ปฏิเสธ duplicate IDs หรือ parent ไม่ถูกต้อง
```

## AC-http-send-history

Feature: HTTP · MVP: Migration · Latest: New

[FR-http-send-history](3-functional-requirements.md#fr-http-send-history)

```gherkin
@FR-http-send-history @AC-http-send-history @Migration
Feature: HTTP
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ HTTP ตาม retained contract
    When ส่ง HTTP request ไป local fixture
    Then แสดง status, headers, body และ request history ตาม context
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ HTTP ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แสดง network error และ Cancel โดยไม่รับ late result ข้าม owner
```

## AC-request-body-modes

Feature: Bodies · MVP: Migration · Latest: New

[FR-request-body-modes](3-functional-requirements.md#fr-request-body-modes)

```gherkin
@FR-request-body-modes @AC-request-body-modes @Migration
Feature: Bodies
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Bodies ตาม retained contract
    When เลือก body mode และไฟล์ที่อนุญาต
    Then ส่ง bytes, MIME, duplicate fields และชื่อไฟล์ตามที่กำหนด
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Bodies ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ปฏิเสธไฟล์หายหรือ body ไม่ถูกต้องก่อนส่ง
```

## AC-auth-request-credentials

Feature: Authentication · MVP: Migration · Latest: New

[FR-auth-request-credentials](3-functional-requirements.md#fr-auth-request-credentials)

```gherkin
@FR-auth-request-credentials @AC-auth-request-credentials @Migration
Feature: Authentication
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Authentication ตาม retained contract
    When เลือก auth และส่ง request ไป nonprod fixture
    Then ใช้ credentials และ signing ตาม scheme กับ manual Authorization precedence
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Authentication ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง credential/provider/signing error โดยไม่ส่ง secret ผิด origin
```

## AC-environment-template-render

Feature: Templating · MVP: Migration · Latest: New

[FR-environment-template-render](3-functional-requirements.md#fr-environment-template-render)

```gherkin
@FR-environment-template-render @AC-environment-template-render @Migration
Feature: Templating
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Templating ตาม retained contract
    When ส่ง request ที่อ้าง environment หรือ template
    Then ใช้ค่าตาม precedence และ snapshot ของ operation
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Templating ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง missing value, render error หรือ Cancel โดยไม่ใช้ผลเก่า
```

## AC-network-cookie-proxy

Feature: Network · MVP: Migration · Latest: New

[FR-network-cookie-proxy](3-functional-requirements.md#fr-network-cookie-proxy)

```gherkin
@FR-network-cookie-proxy @AC-network-cookie-proxy @Migration
Feature: Network
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Network ตาม retained contract
    When ส่ง request ผ่าน local redirect/proxy fixture
    Then ส่ง cookies และ route ตาม policy โดยรักษา owner
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Network ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง proxy/auth/redirect error และไม่เผย credentials ข้าม origin
```

## AC-tls-certificate-policy

Feature: TLS · MVP: Migration · Latest: New

[FR-tls-certificate-policy](3-functional-requirements.md#fr-tls-certificate-policy)

```gherkin
@FR-tls-certificate-policy @AC-tls-certificate-policy @Migration
Feature: TLS
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ TLS ตาม retained contract
    When เชื่อม TLS fixture
    Then ใช้ policy และ identity ที่เลือกตรงปลายทาง
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ TLS ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ปฏิเสธ certificate ไม่ถูกต้องเมื่อเปิด validation
```

## AC-storage-legacy-recovery

Feature: Storage · MVP: Migration · Latest: New

[FR-storage-legacy-recovery](3-functional-requirements.md#fr-storage-legacy-recovery)

```gherkin
@FR-storage-legacy-recovery @AC-storage-legacy-recovery @Migration
Feature: Storage
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Storage ตาม retained contract
    When บันทึก ปิด เปิดใหม่ หรือพบไฟล์เสีย
    Then โหลดข้อมูลที่ผ่าน validation และเสนอ backup recovery โดยตรวจ identity
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Storage ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ไม่เขียนทับไฟล์เสียหรือ journal ที่รอ recovery อัตโนมัติ
```

## AC-transfer-import-export

Feature: Import/export · MVP: Migration · Latest: New

[FR-transfer-import-export](3-functional-requirements.md#fr-transfer-import-export)

```gherkin
@FR-transfer-import-export @AC-transfer-import-export @Migration
Feature: Import/export
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Import/export ตาม retained contract
    When นำ JSON/YAML/HAR/Postman/OpenAPI/cURL หรือ legacy source ที่รองรับเข้า
    Then รักษา request semantics และเพิ่มข้อมูลตาม explicit action
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Import/export ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แสดง diagnostics สำหรับรูปแบบไม่รองรับและไม่รัน imported scripts
```

## AC-graphql-schema-execute

Feature: GraphQL · MVP: Migration · Latest: New

[FR-graphql-schema-execute](3-functional-requirements.md#fr-graphql-schema-execute)

```gherkin
@FR-graphql-schema-execute @AC-graphql-schema-execute @Migration
Feature: GraphQL
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ GraphQL ตาม retained contract
    When โหลด schema หรือส่ง GraphQL ไป fixture
    Then แสดง schema/completion/navigation และ response ตาม current context
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ GraphQL ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ยกเลิก stale schema/completion และแสดง parsing/network error
```

## AC-websocket-session-messages

Feature: WebSocket · MVP: Migration · Latest: New

[FR-websocket-session-messages](3-functional-requirements.md#fr-websocket-session-messages)

```gherkin
@FR-websocket-session-messages @AC-websocket-session-messages @Migration
Feature: WebSocket
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ WebSocket ตาม retained contract
    When เชื่อม local WebSocket fixture
    Then รักษาลำดับ ข้อมูล payload และ session ownership
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ WebSocket ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง connection/size error และหยุดงานเมื่อ owner สิ้นสุด
```

## AC-sse-stream-events

Feature: SSE · MVP: Migration · Latest: New

[FR-sse-stream-events](3-functional-requirements.md#fr-sse-stream-events)

```gherkin
@FR-sse-stream-events @AC-sse-stream-events @Migration
Feature: SSE
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ SSE ตาม retained contract
    When เริ่ม stream จาก local SSE fixture
    Then รักษา event order, accepted prefix และ bounded retention
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ SSE ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง framing/size/network error และยกเลิก stream ของ owner
```

## AC-grpc-schema-streams

Feature: gRPC · MVP: Migration · Latest: New

[FR-grpc-schema-streams](3-functional-requirements.md#fr-grpc-schema-streams)

```gherkin
@FR-grpc-schema-streams @AC-grpc-schema-streams @Migration
Feature: gRPC
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ gRPC ตาม retained contract
    When เลือก service/method และเรียก local gRPC fixture
    Then ส่งและแสดง message/status ตาม Legacy หรือ ProtoJSON profile ที่เลือก
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ gRPC ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ปฏิเสธ schema/message ที่ผิดหรือเกินขนาดและยกเลิก owned call
```

## AC-openapi-spec-lint

Feature: OpenAPI · MVP: Migration · Latest: New

[FR-openapi-spec-lint](3-functional-requirements.md#fr-openapi-spec-lint)

```gherkin
@FR-openapi-spec-lint @AC-openapi-spec-lint @Migration
Feature: OpenAPI
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ OpenAPI ตาม retained contract
    When เปิด spec พร้อม local refs/assets ที่เลือก
    Then แสดง diagnostics และสร้าง requests ตาม operation/schema
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ OpenAPI ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ปฏิเสธ structural/reference/serialization error โดยไม่ทำข้อมูลเดิมหาย
```

## AC-openapi-custom-methods

Feature: OpenAPI methods · MVP: Migration · Latest: New

[FR-openapi-custom-methods](3-functional-requirements.md#fr-openapi-custom-methods)

```gherkin
@FR-openapi-custom-methods @AC-openapi-custom-methods @Migration
Feature: OpenAPI methods
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ OpenAPI methods ตาม retained contract
    When สร้าง request จาก operation ที่มี custom method
    Then แยก fixed GET จาก custom get และรักษา metadata
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ OpenAPI methods ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง path/operation diagnostics ตาม retained contract
```

## AC-query-ordered-serialization

Feature: Query · MVP: Migration · Latest: New

[FR-query-ordered-serialization](3-functional-requirements.md#fr-query-ordered-serialization)

```gherkin
@FR-query-ordered-serialization @AC-query-ordered-serialization @Migration
Feature: Query
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Query ตาม retained contract
    When ส่ง request ที่ผสม manual/generated query
    Then ได้ wire query และ signature ตาม row order และ encoding policy
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Query ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ปฏิเสธ input ที่ไม่ผ่าน validation ก่อนส่ง
```

## AC-runner-suite-assertions

Feature: Runner · MVP: Migration · Latest: New

[FR-runner-suite-assertions](3-functional-requirements.md#fr-runner-suite-assertions)

```gherkin
@FR-runner-suite-assertions @AC-runner-suite-assertions @Migration
Feature: Runner
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Runner ตาม retained contract
    When รัน suite กับ local API fixture
    Then แสดงผล assertions และบันทึกผลตาม test owner
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Runner ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then หยุด timers/requests/callbacks ของ run เดิมและแสดง script error
```

## AC-git-workspace-transitions

Feature: Git · MVP: Migration · Latest: New

[FR-git-workspace-transitions](3-functional-requirements.md#fr-git-workspace-transitions)

```gherkin
@FR-git-workspace-transitions @AC-git-workspace-transitions @Migration
Feature: Git
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Git ตาม retained contract
    When ใช้ local repository และ remote fixture ที่อนุญาต
    Then รักษา working changes และใช้ journal/drain ใน workspace transition
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Git ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ไม่ force overwrite และคง recovery เมื่อ I/O หรือ network ล้มเหลว
```

## AC-plugin-isolated-lifecycle

Feature: Plugins · MVP: Migration · Latest: New

[FR-plugin-isolated-lifecycle](3-functional-requirements.md#fr-plugin-isolated-lifecycle)

```gherkin
@FR-plugin-isolated-lifecycle @AC-plugin-isolated-lifecycle @Migration
Feature: Plugins
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Plugins ตาม retained contract
    When โหลด plugin fixture และเรียก contribution
    Then ตรวจ source/owner/capability และคืนทรัพยากรตาม deadline
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Plugins ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ปฏิเสธ stale/unauthorized callbacks และ quarantine error โดยไม่ replay
```

## AC-desktop-native-integrations

Feature: Desktop integrations · MVP: Migration · Latest: New

[FR-desktop-native-integrations](3-functional-requirements.md#fr-desktop-native-integrations)

```gherkin
@FR-desktop-native-integrations @AC-desktop-native-integrations @Migration
Feature: Desktop integrations
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Desktop integrations ตาม retained contract
    When เรียก native action หรือปิดและเปิดแอป
    Then ทำงานตรง selected owner พร้อม save/drain เมื่อปิด
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Desktop integrations ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then แจ้ง native error และไม่เขียนผลจาก chooser ที่หมดอายุ
```

## AC-release-package-evidence

Feature: Distribution · MVP: Migration · Latest: New

[FR-release-package-evidence](3-functional-requirements.md#fr-release-package-evidence)

```gherkin
@FR-release-package-evidence @AC-release-package-evidence @Migration
Feature: Distribution
  Scenario: ได้ผลตามข้อกำหนด
    Given เตรียม fixture และ context สำหรับ Distribution ตาม retained contract
    When เตรียม package สำหรับ platform เป้าหมาย
    Then มีผล build/runtime/install/recovery และ legal evidence ตรง artifact
  Scenario: รักษาขอบเขตเมื่อทำงานไม่สำเร็จ
    Given เตรียม failure fixture สำหรับ Distribution ตาม retained contract
    When เริ่ม operation ที่เกิด failure หรือผิดเงื่อนไข
    Then ไม่ประกาศ release/migration complete เมื่อ gate ใดยังไม่ผ่าน
```

