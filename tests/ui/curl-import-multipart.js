import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  withNativeApp,
  poll,
  selectedNativeProbeIdentifier,
  integrationProbeIdentifier,
} from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
} from "./helpers/resource-manager-cases.js";
const encodingMode = process.env.INSOMNIUM_CURL_PART_ENCODING === "1";
const partHeaderFilesMode = process.env.INSOMNIUM_CURL_PART_HEADER_FILES === "1";
if (encodingMode || partHeaderFilesMode) {
  assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
  assert.ok(
    process.env.INSOMNIUM_UI_BUILD_STATE,
    "Explicit current build required",
  );
}
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-file-content-fix-ui-probe/build-state.json";
const refererMode = process.env.INSOMNIUM_CURL_REFERER === "1";
/** @type {{type:string,contentTypePresent:boolean,accept:string|null,referer:string|null,path:string,body:Buffer}[]} */ const received =
  [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(r) {
    received.push({
      type: r.headers.get("content-type") || "",
      contentTypePresent: r.headers.has("content-type"),
      accept: r.headers.get("accept"),
      referer: r.headers.get("referer"),
      path: new URL(r.url).pathname,
      body: Buffer.from(await r.arrayBuffer()),
    });
    if (refererMode && new URL(r.url).pathname.endsWith("/start"))
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL(r.url).pathname.replace(/\/start$/, "/finish"),
        },
      });
    return Response.json({ ok: true });
  },
});
try {
  const run = async () =>
    withResourceProbePreserved(
      async () => {
        await withNativeApp(
          partHeaderFilesMode ? "curl-import-part-header-files" : encodingMode
            ? "curl-import-multipart-encoding"
            : "curl-import-multipart",
          async ({ page, invoke, output }) => {
            const initial = await invoke("load_workspace");
            const registered = new Set(
              initial.resources.map((/** @type {any} */ r) => r._id),
            );
            const registerImportedCollections = async () => {
              const data = await invoke("load_workspace");
              for (const row of data.resources) {
                if (row._type !== "workspace" || registered.has(row._id))
                  continue;
                registerResourceProbeCollection(row._id, row.name);
                registered.add(row._id);
              }
            };
            if (partHeaderFilesMode) {
              const url=`http://127.0.0.1:${server.port}/part-header-files`;
              const command=`curl '${url}' -F 'text=value;headers="X-First: before";headers=@"one; ไทย.txt";headers="X-Middle:  middle  ";headers=<two.txt;headers="X-Last: after"' -F 'bundle=(;headers=@group.txt' -F 'inner=value;headers=@child.txt' -F '=)'`;
              await page.getByRole("button",{name:"Import collection",exact:true}).click();
              const dialog=page.getByRole("dialog");await dialog.getByLabel("Import collection or cURL commands").fill(command);
              await dialog.getByRole("button",{name:"Review import",exact:true}).click();
              await dialog.getByRole("button",{name:"Import",exact:true}).click();await dialog.waitFor({state:"detached"});await registerImportedCollections();
              await page.locator(".tree-request").filter({hasText:url}).click();
              const load=()=>invoke("load_workspace");
              /** @type {any} */ let request;
              await poll(async()=>{request=(await load()).resources.find((/** @type {any} */row)=>row._type==="request"&&row.url===url);return !!request;},"Imported header-file request persisted");
              const originalBody=structuredClone(request.body);
              await page.getByRole("button",{name:"Send",exact:true}).click();
              await page.getByText("Select all multipart header files before sending.",{exact:false}).first().waitFor();
              assert.equal(received.length,0);
              for (const details of await page.locator("details.multipart-options").all()) {
                if(!await details.evaluate(el=>/** @type {HTMLDetailsElement} */(el).open))await details.locator("summary").click();
              }
              const first=page.getByLabel("Part header file for text 2",{exact:true});
              await first.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from([255])});
              await page.getByRole("alert").filter({hasText:"Select a UTF-8 multipart header file."}).waitFor();
              assert.equal(await first.getAttribute("aria-invalid"),"true");
              assert.deepEqual((await load()).resources.find((/** @type {any} */row)=>row._id===request._id).body,originalBody);
              const inputs=[
                {label:"Part header file for text 4",name:"two.txt",text:" folded\r\nX-Duplicate: b\r\nX-Empty:\r\n"},
                {label:"Part header file for text 2",name:"one; ไทย.txt",text:"# ignored\r\n continuation  \t\r\nX-File:  first\r\nX-Duplicate: a\n"},
                {label:"Part header file for bundle 1",name:"group.txt",text:"X-Group:  yes  \r\n"},
                {label:"Part header file for inner 1",name:"child.txt",text:"X-Child:  child\r\n"},
              ];
              for(const item of inputs){
                await page.getByLabel(item.label,{exact:true}).setInputFiles({name:item.name,mimeType:"text/plain",buffer:Buffer.from(item.text)});
                await poll(async()=>{
                  const current=(await load()).resources.find((/** @type {any} */row)=>row._id===request._id);
                  const parent=item.name==="group.txt"?current.body.params[1]:item.name==="child.txt"?current.body.params[1].params[0]:current.body.params[0];
                  return !parent._curlPartHeaderSources||parent._curlPartHeaderSources.some((/** @type {any} */s)=>s.fileName===item.name&&s.text===item.text);
                },"Selected multipart header snapshot persisted");
                await Bun.write(join(output,item.name),item.text);
              }
              request=(await load()).resources.find((/** @type {any} */row)=>row._id===request._id);
              assert.equal(request.body.params[0]._curlPartHeaderSources,undefined);
              assert.equal(request.body.params[0].partHeaders,"X-First: before continuation\nX-File:  first\nX-Duplicate: a\nX-Middle:  middle   folded\nX-Duplicate: b\nX-Empty:\nX-Last: after");
              await page.reload();await page.getByRole("button",{name:"Send",exact:true}).click();
              await poll(()=>Promise.resolve(received.length===1),"Actual native multipart header-file Send");
              await poll(async()=>(await load()).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.status===200),"Successful native response persisted");
              const native=received[0];
              const forms=[`text=value;headers="X-First: before";headers=@"${join(output,"one; ไทย.txt")}";headers="X-Middle:  middle  ";headers=<"${join(output,"two.txt")}";headers="X-Last: after"`,`bundle=(;headers=@"${join(output,"group.txt")}"`,`inner=value;headers=@"${join(output,"child.txt")}"`,"=)"];
              const curl=Bun.spawn(["curl.exe","--silent","--show-error","--noproxy","*",...forms.flatMap(form=>["-F",form]),url],{stdout:"pipe",stderr:"pipe"});assert.equal(await curl.exited,0);assert.equal(received.length,2);
              /** @param {{type:string,body:Buffer}} record */
              const canonical=record=>{
                let body=record.body.toString("latin1");const first=/boundary=(?:"([^"]+)"|([^;\s]+))/.exec(record.type);assert.ok(first);
                const boundaries=[first[1]||first[2],...Array.from(body.matchAll(/boundary=(?:"([^"]+)"|([^;\s\r\n]+))/g),m=>m[1]||m[2])];
                for(const [index,boundary]of [...new Set(boundaries)].entries())body=body.replaceAll(boundary,"BOUNDARY"+index);return Buffer.from(body,"latin1");
              };
              assert.deepEqual(canonical(native),canonical(received[1]),"Native/curl MIME differs only in random boundaries");
              await Bun.write(join(output,"native-multipart.bin"),native.body);await Bun.write(join(output,"curl-multipart.bin"),received[1].body);
              await page.reload();await page.getByRole("button",{name:"Send",exact:true}).waitFor();
              await poll(async()=>await page.getByLabel("Request URL",{exact:true}).inputValue()===url,"Reloaded header-file request mounted");
              for(const details of await page.locator("details.multipart-options").all())if(!await details.evaluate(el=>/** @type {HTMLDetailsElement} */(el).open))await details.locator("summary").click();
              assert.equal(await page.getByLabel("Part headers for text",{exact:true}).inputValue(),request.body.params[0].partHeaders);
              assert.deepEqual((await load()).resources.find((/** @type {any} */row)=>row._id===request._id).body,request.body);assert.equal(received.length,2);
              await page.screenshot({path:join(output,"part-header-files.png")});
              await Bun.write(join(output,"part-header-files-acceptance.json"),JSON.stringify({passed:true,renderingMode:"native-hidden",missingFileRefusal:true,invalidUtf8PreservesBody:true,associatedFieldError:true,orderedOutOfOrderSelection:true,nestedGroupAndChild:true,rawHeaderWhitespace:true,selectedFiles:4,nativeRequests:1,curlRequests:1,exactMimeExceptBoundaries:true,reload:true,noImplicitResend:true},null,2));return;
            }
            if (refererMode) {
              const original = await invoke("load_workspace");
              try {
                for (const [label, options, initial, auto] of [
                  [
                    "static",
                    "-e 'https://initial.invalid/'",
                    "https://initial.invalid/",
                    false,
                  ],
                  [
                    "auto",
                    "-e 'https://initial.invalid/;auto'",
                    "https://initial.invalid/",
                    true,
                  ],
                  [
                    "signer-auto",
                    "--digest -u fixture:secret -e ';auto'",
                    null,
                    true,
                  ],
                ]) {
                  const base = `http://127.0.0.1:${server.port}/${label}/start`,
                    url = base + "#fragment";
                  await page
                    .getByRole("button", {
                      name: "Import collection",
                      exact: true,
                    })
                    .click();
                  const dialog = page.getByRole("dialog");
                  await dialog
                    .getByLabel("Import collection or cURL commands")
                    .fill(`curl -L ${options} '${url}'`);
                  await dialog
                    .getByRole("button", { name: "Review import", exact: true })
                    .click();
                  await dialog
                    .getByRole("button", { name: "Import", exact: true })
                    .click();
                  await dialog.waitFor({ state: "detached" });
                  await registerImportedCollections();
                  await page
                    .locator(".tree-request")
                    .filter({ hasText: url })
                    .click();
                  await page
                    .getByRole("tab", { name: "Settings", exact: true })
                    .click();
                  assert.equal(
                    await page
                      .getByRole("combobox", {
                        name: "Redirect Referer",
                        exact: true,
                      })
                      .inputValue(),
                    auto ? "on" : "off",
                  );
                  const count = received.length;
                  await page
                    .getByRole("button", { name: "Send", exact: true })
                    .click();
                  await poll(
                    async () => received.length === count + 2,
                    "Redirect pair received",
                  );
                  await page
                    .getByRole("button", { name: "Send", exact: true })
                    .waitFor();
                  const pair = received.slice(count);
                  assert.equal(pair[0].referer, initial);
                  assert.equal(pair[1].referer, auto ? base : initial);
                  assert.equal(pair[1].path, `/${label}/finish`);
                }
                await Bun.write(
                  join(output, "referer-acceptance.json"),
                  JSON.stringify(
                    {
                      passed: true,
                      nativeMode: "native-hidden",
                      checks: [
                        "actual imported Request Settings",
                        "static initial header survives redirect",
                        "automatic previous URL replaces initial header",
                        "auto-only native signer redirect",
                        "fragments omitted",
                      ],
                    },
                    null,
                    2,
                  ),
                );
              } finally {
                await invoke("save_workspace", { data: original });
                await page.reload();
                await page
                  .locator('button[aria-label="Preferences"]')
                  .waitFor();
              }
              return;
            }
            if (process.env.INSOMNIUM_CURL_HEADERS === "1") {
              const original = await invoke("load_workspace");
              try {
                for (const [label, options, present] of [
                  [
                    "custom",
                    "-H 'Content-Type: multipart/magic; charset=utf-8' -F 'field=value'",
                    true,
                  ],
                  ["empty", "-H 'Content-Type;' -F 'field=value'", true],
                  ["suppressed", "-H 'Content-Type:' -F 'field=value'", false],
                  [
                    "json",
                    "-H 'Content-Type:' -H 'Accept:' --json '{}'",
                    false,
                  ],
                ]) {
                  const url = `http://127.0.0.1:${server.port}/${label}`;
                  await page
                    .getByRole("button", {
                      name: "Import collection",
                      exact: true,
                    })
                    .click();
                  const dialog = page.getByRole("dialog");
                  await dialog
                    .getByLabel("Import collection or cURL commands")
                    .fill(`curl '${url}' ${options}`);
                  await dialog
                    .getByRole("button", { name: "Review import", exact: true })
                    .click();
                  await dialog
                    .getByRole("button", { name: "Import", exact: true })
                    .click();
                  await dialog.waitFor({ state: "detached" });
                  await registerImportedCollections();
                  await page
                    .locator(".tree-request")
                    .filter({ hasText: url })
                    .click();
                  const count = received.length;
                  await page
                    .getByRole("button", { name: "Send", exact: true })
                    .click();
                  await poll(
                    async () => received.length === count + 1,
                    "Native header request received",
                  );
                  await page
                    .getByRole("button", { name: "Send", exact: true })
                    .waitFor();
                  const actual = received.at(-1);
                  assert.ok(actual);
                  assert.equal(actual.contentTypePresent, present);
                  if (label === "custom") {
                    assert.match(
                      actual.type,
                      /^multipart\/magic; charset=utf-8; boundary=/,
                    );
                    const boundary = actual.type.split("boundary=")[1];
                    assert.ok(
                      actual.body
                        .toString()
                        .startsWith("--" + boundary + "\r\n"),
                    );
                    assert.ok(
                      actual.body
                        .toString()
                        .endsWith("--" + boundary + "--\r\n"),
                    );
                  } else assert.equal(actual.type, "");
                  if (label === "json") {
                    assert.equal(actual.body.toString(), "{}");
                    assert.equal(actual.accept, null);
                  } else
                    assert.ok(
                      actual.body
                        .toString()
                        .includes('name="field"\r\n\r\nvalue\r\n'),
                    );
                }
                await Bun.write(
                  join(output, "headers-acceptance.json"),
                  JSON.stringify(
                    {
                      passed: true,
                      checks: [
                        "custom multipart MIME matches actual body boundary",
                        "explicit empty Content-Type preserved",
                        "multipart default header suppressed",
                        "JSON Accept/Content-Type suppressed with body unchanged",
                      ],
                      nativeMode: "native-hidden",
                    },
                    null,
                    2,
                  ),
                );
              } finally {
                await invoke("save_workspace", { data: original });
                await page.reload();
                await page
                  .locator('button[aria-label="Preferences"]')
                  .waitFor();
              }
              return;
            }
            const before = await invoke("load_workspace"),
              oldIds = new Set(
                before.resources.map(/** @param {any} r */ (r) => r._id),
              );
            if (process.env.INSOMNIUM_CURL_NESTED === "1") {
              assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
              const url = `http://127.0.0.1:${server.port}/nested`;
              await page.getByRole("button", {name:"Import collection",exact:true}).click();
              const dialog = page.getByRole("dialog");
              await dialog.getByLabel("Import collection or cURL commands").fill(
                `curl '${url}' -F 'message=(;type=multipart/alternative' -F '=plain' -F '=html;type=text/html' -F '=)' -F 'files=@first.bin,second.bin'`);
              await dialog.getByRole("button", {name:"Review import",exact:true}).click();
              await dialog.getByRole("button", {name:"Import",exact:true}).click();
              await dialog.waitFor({state:"detached"});
              await registerImportedCollections();
              await page.locator(".tree-request").filter({hasText:url}).click();
              const children = page.locator("fieldset.multipart-options");
              await children.first().getByRole("textbox", {name:"Value 1",exact:true}).fill("edited plain");
              const bytes = Buffer.from([0, 255, 13, 10]);
              const files = page.locator(".kv-editor input[type=file]");
              await files.nth(0).setInputFiles({name:"first.bin",mimeType:"application/octet-stream",buffer:bytes});
              await files.nth(1).setInputFiles({name:"second.bin",mimeType:"application/octet-stream",buffer:Buffer.from("second")});
              /** @type {any} */ let request;
              await poll(async () => {
                const saved = await invoke("load_workspace");
                request = saved.resources.find((/** @type {any} */ r) => !oldIds.has(r._id) && r._type === "request");
                return request?.body?.params?.[1]?.params?.[1]?.base64 === Buffer.from("second").toString("base64");
              }, "Nested selected uploads persisted");
              assert.equal(request.body.params[0].params[0].value, "edited plain");
              assert.equal(request.body.params[0].params[0].name, null);
              await page.reload();
              await page.getByRole("button", {name:"Send",exact:true}).click();
              await poll(async () => received.length === 1, "Nested MIME arrived at native peer");
              await poll(async () => !(await page.getByRole("button", {name:"Cancel",exact:true}).count()), "Nested send settled");
              const wire = received[0].body.toString("latin1");
              assert.match(wire, /Content-Type: multipart\/alternative; boundary=/);
              assert.match(wire, /Content-Type: multipart\/mixed; boundary=/);
              assert.ok(wire.includes("edited plain\r\n"));
              assert.ok(wire.includes("Content-Type: text/html\r\n\r\nhtml"));
              assert.ok(received[0].body.includes(bytes));
              assert.ok(wire.includes('Content-Disposition: attachment; filename="first.bin"'));
              assert.ok(!wire.includes('name="null"'));
              const saved = await invoke("load_workspace");
              assert.deepEqual(saved.resources.find((/** @type {any} */ r) => r._id === request._id).body, request.body);
              await page.screenshot({path:join(output,"nested-multipart.png")});
              await writeFile(join(output,"acceptance.json"), JSON.stringify({status:"passed",nativeMode:"native-hidden",nested:true,checks:["Import and edit unnamed child", "Select two nested files", "Reload exact tree and selected bytes", "Actual native Send preserves nested MIME and binary payload"]},null,2));
              return;
            }
            const url = "http://127.0.0.1:" + server.port + "/multipart";
            await page
              .getByRole("button", { name: "Import collection", exact: true })
              .click();
            const dialog = page.getByRole("dialog");
            await dialog
              .getByLabel("Import collection or cURL commands")
              .fill(
                "curl '" +
                  url +
                  (encodingMode
                    ? "' -F 'upload=@missing.bin;type=application/x-insomnium-fixture;filename=sent.bin;encoder=base64;headers=\"X-Owned: first\";headers=\"X-Owned: second\"' -F 'note=hello;type=text/x-note;encoder=quoted-printable' -F 'named=world;filename=;encoder=7bit' --form-string 'literal=@stay;type=not-metadata;encoder=base64' -F 'contents=<source.bin;filename=ignored.bin;encoder=8bit' -F 'typed=<source.bin;filename=ignored.bin;type=text/x-fixture;encoder=binary'"
                    : "' -F 'upload=@missing.bin;type=application/x-insomnium-fixture;filename=sent.bin' -F 'note=hello;type=text/x-note' -F 'named=world;filename=' --form-string 'literal=@stay;type=not-metadata' -F 'contents=<source.bin;filename=ignored.bin' -F 'typed=<source.bin;filename=ignored.bin;type=text/x-fixture'"),
              );
            await dialog
              .getByRole("button", { name: "Review import", exact: true })
              .click();
            await dialog
              .getByRole("button", { name: "Import", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            /** @type {any} */ let saved;
            /** @type {any} */ let request;
            await poll(async () => {
              saved = await invoke("load_workspace");
              request = saved.resources.find(
                /** @param {any} r */ (r) =>
                  !oldIds.has(r._id) && r._type === "request",
              );
              return !!request;
            }, "Multipart import persisted");
            await registerImportedCollections();
            await page
              .locator(".tree-request")
              .filter({ hasText: url })
              .click();
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await page
              .getByText(
                "Error: Select the file again for multipart field “upload”",
                { exact: true },
              )
              .waitFor();
            assert.equal(
              received.length,
              0,
              "Imported paths are not read implicitly",
            );
            const file = page.locator(".kv-editor input[type=file]").nth(0);
            const options = page.locator(".multipart-options").first();
            await options.locator("summary").click();
            if (encodingMode) {
              const encoding = options.getByRole("combobox", {
                name: "Transfer encoding for upload",
                exact: true,
              });
              assert.equal(await encoding.inputValue(), "base64");
              await encoding.selectOption("binary");
              await encoding.selectOption("base64");
              const headers = options.getByRole("textbox", {
                name: "Part headers for upload",
                exact: true,
              });
              assert.equal(
                await headers.inputValue(),
                "X-Owned: first\nX-Owned: second",
              );
              await headers.fill(
                "X-Owned: first\nX-Owned: second\nX-Edited: mounted",
              );
            }
            for (const label of [
              "Send file contents without a filename",
              "Override sent filename",
            ]) {
              assert.equal(
                await options
                  .getByRole("checkbox", { name: label, exact: true })
                  .evaluate((el) => {
                    const field = el.closest(".ui-field");
                    if (!field)
                      throw new Error("Multipart inline Field missing");
                    return getComputedStyle(field).display;
                  }),
                "flex",
                "Native multipart uses shared inline Field layout",
              );
            }
            assert.equal(
              await options
                .getByRole("textbox", {
                  name: "Content-Type for upload",
                  exact: true,
                })
                .evaluate((el) => {
                  const field = el.closest(".ui-field");
                  if (!field)
                    throw new Error("Multipart stacked Field missing");
                  return getComputedStyle(field).display;
                }),
              "grid",
            );
            await page.screenshot({
              path: output + "/multipart-shared-fields.png",
            });
            await file.setInputFiles({
              name: "first.bin",
              mimeType: "application/octet-stream",
              buffer: Buffer.from("first"),
            });
            await poll(async () => {
              const d = await invoke("load_workspace");
              return (
                d.resources.find(
                  /** @param {any} r */ (r) => r._id === request._id,
                ).body.params[0].fileName === "first.bin"
              );
            }, "First file persisted");
            const bytes = Buffer.from([0, 1, 2, 13, 10, 127, 128, 255]);
            await file.setInputFiles({
              name: "replacement.bin",
              mimeType: "application/octet-stream",
              buffer: bytes,
            });
            await poll(async () => {
              const d = await invoke("load_workspace");
              request = d.resources.find(
                /** @param {any} r */ (r) => r._id === request._id,
              );
              return request.body.params[0].fileName === "replacement.bin";
            }, "Replacement persisted");
            assert.equal(
              request.body.params[0].base64,
              bytes.toString("base64"),
            );
            assert.equal(request.body.params[0].fileNameOverride, "sent.bin");
            assert.equal(
              request.body.params[0].contentTypeOverride,
              "application/x-insomnium-fixture",
            );
            await page
              .locator(".kv-editor input[type=file]")
              .nth(1)
              .setInputFiles({
                name: "content.bin",
                mimeType: "application/octet-stream",
                buffer: bytes,
              });
            await poll(async () => {
              const d = await invoke("load_workspace");
              request = d.resources.find(
                /** @param {any} r */ (r) => r._id === request._id,
              );
              return request.body.params[4].base64 === bytes.toString("base64");
            }, "File-content field persisted");
            assert.equal(request.body.params[4].fileContent, true);
            await page
              .locator(".kv-editor input[type=file]")
              .nth(2)
              .setInputFiles({
                name: "typed.bin",
                mimeType: "application/octet-stream",
                buffer: bytes,
              });
            await poll(async () => {
              const d = await invoke("load_workspace");
              request = d.resources.find(
                /** @param {any} r */ (r) => r._id === request._id,
              );
              return request.body.params[5].base64 === bytes.toString("base64");
            }, "Typed file-content field persisted");
            assert.equal(request.body.params[5].fileNameOverride, undefined);
            await page.reload();
            await page
              .locator(".tree-request")
              .filter({ hasText: url })
              .click();
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await poll(
              async () => received.length === 1,
              "Native multipart arrived",
            );
            await poll(
              async () =>
                !(await page
                  .getByRole("button", { name: "Cancel", exact: true })
                  .count()),
              "Multipart send settled",
            );
            const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(
              received[0].type,
            );
            assert.ok(boundary);
            const sections = received[0].body
              .toString("latin1")
              .split("--" + (boundary[1] || boundary[2]))
              .slice(1, -1);
            assert.equal(sections.length, 6);
            const parts = sections.map((section) => {
              const split = section.indexOf("\r\n\r\n");
              return {
                headers: section.slice(2, split).toLowerCase(),
                body: Buffer.from(section.slice(split + 4, -2), "latin1"),
              };
            });
            assert.match(
              parts[0].headers,
              /name="upload"; filename="sent.bin"/,
            );
            assert.match(
              parts[0].headers,
              /content-type: application\/x-insomnium-fixture/,
            );
            assert.deepEqual(
              parts[0].body,
              encodingMode ? Buffer.from(bytes.toString("base64")) : bytes,
            );
            if (encodingMode) {
              assert.ok(
                parts[0].headers.includes("x-owned: first\r\nx-owned: second"),
              );
              assert.ok(parts[0].headers.includes("x-edited: mounted"));
              for (const [index, name] of [
                [0, "base64"],
                [1, "quoted-printable"],
                [2, "7bit"],
                [4, "8bit"],
                [5, "binary"],
              ])
                assert.ok(
                  parts[Number(index)].headers.includes(
                    "content-transfer-encoding: " + name,
                  ),
                );
            }
            assert.match(parts[1].headers, /name="note"/);
            assert.ok(!parts[1].headers.includes("filename="));
            assert.match(parts[1].headers, /content-type: text\/x-note/);
            assert.equal(parts[1].body.toString(), "hello");
            assert.match(parts[2].headers, /name="named"; filename=""/);
            assert.equal(parts[2].body.toString(), "world");
            assert.equal(
              parts[3].body.toString(),
              "@stay;type=not-metadata" +
                (encodingMode ? ";encoder=base64" : ""),
            );
            assert.match(parts[4].headers, /name="contents"/);
            assert.ok(!parts[4].headers.includes("filename="));
            assert.ok(!parts[4].headers.includes("content-type:"));
            assert.deepEqual(parts[4].body, bytes);
            assert.match(parts[5].headers, /name="typed"/);
            assert.ok(!parts[5].headers.includes("filename="));
            assert.ok(
              parts[5].headers.includes("content-type: text/x-fixture"),
            );
            assert.deepEqual(parts[5].body, bytes);
            await page.reload();
            const final = await invoke("load_workspace");
            assert.deepEqual(
              final.resources.find(
                /** @param {any} r */ (r) => r._id === request._id,
              ).body,
              request.body,
            );
            await writeFile(
              join(output, "acceptance.json"),
              JSON.stringify(
                {
                  status: "passed",
                  encodingMode,
                  checks: [
                    "Import does not read path; missing file prevents network",
                    "Actual input file selection and replacement preserve explicit MIME/filename",
                    "Reload persists exact binary bytes",
                    "Native multipart preserves file bytes, text MIME, empty filename and form-string literal",
                    "Actual native multipart part options retain shared inline checkbox and stacked input Field layouts",
                    "File-content fields omit filename despite modifier, preserve exact bytes and explicit MIME",
                    "Second reload preserves multipart body",
                  ],
                },
                null,
                2,
              ),
            );
          },
        );
      },
      { expectedIdentifier: selectedNativeProbeIdentifier() },
    );
  if (selectedNativeProbeIdentifier() === integrationProbeIdentifier)
    await preserveNativeProfile(run);
  else await run();
} finally {
  server.stop(true);
}
