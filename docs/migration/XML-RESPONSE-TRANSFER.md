# XML response Copy/Save boundaries

The saved XML response scenario has a focused transfer mode. It exercises the mounted production Tauri response pane through a real HTTP Send and bundled XPath workers. The shared transfer adapter captures clipboard text, save-dialog options and file-write bytes; unrelated native IPC passes through unchanged. JSON tools uses the same adapter and retains its previous acceptance schema.

```powershell
bun run check
$env:INSOMNIUM_XML_RESPONSE_TRANSFER = '1'
bun tests/ui/xml-response-filter.js
Remove-Item Env:INSOMNIUM_XML_RESPONSE_TRANSFER
$env:INSOMNIUM_JSON_RESPONSE_TOOLS = '1'
bun tests/ui/json-response-filter.js
Remove-Item Env:INSOMNIUM_JSON_RESPONSE_TOOLS
```

XML checks cover element, text, scalar and empty XPath outputs; Copy receives the displayed result while Save receives the original UTF-8 response bytes. Raw and cleared Pretty have separate literal Copy expectations. Cancel produces no write. Clipboard and file-write refusals appear as alerts; successful retries clear them. Response history/body/base64 remains unchanged. Fetch and the clipboard descriptor are restored in finally and asserted after the scenario.

Artifacts include `copy-save-boundary.json`, `transfer-acceptance.json` and native `result.json`. Source freeze `artifacts/playwright/xml-transfer-source-freeze.json` binds 466 unchanged application files and 233 scenario files to executable SHA256 `6f74492748f828bc4344e435e13b172bd99da100ff104e3ec7cb34ca5e34d8ca`; no application or CSS change is involved.

This controlled transfer boundary does not prove actual OS clipboard, file picker, filesystem permissions or other platform behavior. Non-UTF-8/binary XML bodies, streaming, namespace mapping UI, accessibility, template Send integration and all other migration/UX gates remain required. Native hosts use `native-hidden`; browser scenarios retain shared `headless: true`.

XML session61262 completed with terminal0. Artifact `xml-response-filter-1791607405462` records8groups/8real workers/1HTTP Send, native32968 exit0/native-hidden/visible:false. Independent audit verifies699source paths, executable identity, literal8copies/7dialogs/6write payloads of original68bytes, durable response/meta and adapter restoration. Initial audit-only expected counts9groups/5workers were corrected to the scenario's actual8groups/8workers; no scenario failure or rerun occurred.

JSON tools93753 completed with terminal0. Artifact `json-response-filter-1791607507000` records9groups/3HTTP Sends/six dark-light1440/900/760 layouts, native53076 exit0/native-hidden/visible:false. Independent audit verifies original152byte write payloads, unchanged literal/body/base64, adapter restoration and raw control geometry. Current760dark/light screenshots were inspected; controls fit. Compiler0errors/0warnings and source/executable recheck pass. `artifacts/playwright/xml-transfer-cleanup.json` verifies both owned native PIDs and exact WebView profiles absent. Initial cleanup query matched its own PowerShell command text; restricting profile checks to WebView2 processes fixes that observation error without terminating any process. No live feature handles remain.
