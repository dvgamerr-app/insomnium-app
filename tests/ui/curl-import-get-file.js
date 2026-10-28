import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll, selectedNativeProbeIdentifier, integrationProbeIdentifier, resourceCrudProbeIdentifier } from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { withResourceProbePreserved, registerResourceProbeCollection, resourceSaved } from "./helpers/resource-manager-cases.js";
import { respondToOwnedOpenDialog } from "./helpers/windows-open-dialog.js";
import { serveUntrustedGitTls } from "./helpers/git-untrusted-tls.js";
import { curlResources } from "../../src/lib/curl-import.js";
import { initialData } from "../../src/lib/model.js";
import { prepareRequest } from "../../src/lib/transport.js";

// Exercise the importer/composer boundary before starting an expensive native host.
for (const [command, expected] of [
  ["curl -q -G --data-binary 'name=ไทย' 'http://127.0.0.1:4444/wire'", 'http://127.0.0.1:4444/wire?name=ไทย'],
  ["curl -q 'http://127.0.0.1:4444/a/%2e%2e/b?q=%2F'", 'http://127.0.0.1:4444/a/%2e%2e/b?q=%2F'],
]) {
  const resources = curlResources(command), data = initialData(); data.resources.push(...resources);
  const request = resources.find(row => row._type === 'request'); assert.ok(request);
  const rawUrl = prepareRequest(data, request, 'raw-compose-check').rawUrlBase64;
  assert.ok(rawUrl);
  assert.equal(Buffer.from(rawUrl, 'base64').toString(), expected);
}
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-get-ui-probe/build-state.json";
const methodToggles = process.env.INSOMNIUM_CURL_METHOD_TOGGLES === "1";
const physicalPicker = process.env.INSOMNIUM_CURL_PHYSICAL_PICKER === "1";
/** @type {any[]} */ const received = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(r) {
    const bytes = new Uint8Array(await r.arrayBuffer());
    received.push({
      method: r.method,
      path: new URL(r.url).pathname + new URL(r.url).search,
      bodyBytes: bytes.byteLength,
      bodyBase64: Buffer.from(bytes).toString("base64"),
      type: r.headers.get("content-type"),
    });
    return new Response("", { status: 200 });
  },
});
/** @type {any} */ let wire;
try {
  // Capture the request line before an HTTP parser normalizes the target.
  const rawTargets = /** @type {Buffer[]} */ ([]);
  const pending = /** @type {Map<import('bun').Socket<undefined>,Buffer>} */ (new Map());
  wire = Bun.listen({hostname:"127.0.0.1",port:0,socket:{
    open(socket){pending.set(socket,Buffer.alloc(0));},
    data(socket,bytes){
      const value=Buffer.concat([pending.get(socket) || Buffer.alloc(0),bytes]);pending.set(socket,value);
      assert.ok(value.length<65536,"Bounded request header");
      const end=value.indexOf("\r\n\r\n");if(end<0)return;
      const line=value.subarray(0,value.indexOf("\r\n"));
      const first=line.indexOf(32),last=line.lastIndexOf(32);assert.ok(first>0&&last>first);
      rawTargets.push(Buffer.from(line.subarray(first+1,last)));
      pending.delete(socket);socket.end("HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    },
    close(socket){pending.delete(socket);},
  }});
  try {
    const child=Bun.spawn(["curl.exe","-q","-sS","--noproxy","*","--max-time","5","-G","--data-binary","name=ไทย",`http://127.0.0.1:${wire.port}/wire`],{stdout:"pipe",stderr:"pipe"});
    const [out,err,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
    assert.equal(code,0,err||out);assert.equal(rawTargets.length,1);
    assert.deepEqual(rawTargets[0],Buffer.from("/wire?name=ไทย"));
    if (process.env.INSOMNIUM_CURL_WIRE_CAPTURE_ONLY === "1") {
      const percent = Bun.spawn(["curl.exe","-q","-sS","--noproxy","*","--max-time","5","-G","--data-binary","name=%2f",`http://127.0.0.1:${wire.port}/wire`],{stdout:"pipe",stderr:"pipe"});
      const [percentOut,percentErr,percentCode]=await Promise.all([new Response(percent.stdout).text(),new Response(percent.stderr).text(),percent.exited]);
      assert.equal(percentCode,0,percentErr||percentOut);
      assert.deepEqual(rawTargets[1],Buffer.from("/wire?name=%2F"));
      const fixturePath=join("artifacts","playwright","curl-raw-target-fixture.bin");
      await Bun.write(fixturePath,Buffer.from([0x71,0x3d,0xff,0x80,0x00,0x7a]));
      const binary=Bun.spawn(["curl.exe","-q","-sS","--noproxy","*","--max-time","5","-G","--data-binary","@"+fixturePath,`http://127.0.0.1:${wire.port}/wire`],{stdout:"pipe",stderr:"pipe"});
      const [binaryOut,binaryErr,binaryCode]=await Promise.all([new Response(binary.stdout).text(),new Response(binary.stderr).text(),binary.exited]);
      assert.equal(binaryCode,0,binaryErr||binaryOut);
      assert.deepEqual(rawTargets[2],Buffer.concat([Buffer.from('/wire?q='),Buffer.from([0xff,0x80])]));
      await Bun.write(fixturePath,Buffer.from('q=a#frag?x%2f'));
      const special=Bun.spawn(["curl.exe","-q","-sS","--noproxy","*","--max-time","5","-G","--data-binary","@"+fixturePath,`http://127.0.0.1:${wire.port}/wire`],{stdout:"pipe",stderr:"pipe"});
      const [specialOut,specialErr,specialCode]=await Promise.all([new Response(special.stdout).text(),new Response(special.stderr).text(),special.exited]);
      assert.equal(specialCode,0,specialErr||specialOut);
      assert.deepEqual(rawTargets[3],Buffer.from('/wire?q=a'),'Fragment is not part of the request target');
      await Bun.write(fixturePath,Buffer.from([0x71,0x3d,0xff,0x80]));
      const proxy=Bun.spawn(["curl.exe","-q","-sS","--proxy",`http://127.0.0.1:${wire.port}`,"--noproxy","","--max-time","5","-G","--data-binary","@"+fixturePath,'http://owned.invalid/wire'],{stdout:"pipe",stderr:"pipe"});
      const [proxyOut,proxyErr,proxyCode]=await Promise.all([new Response(proxy.stdout).text(),new Response(proxy.stderr).text(),proxy.exited]);
      assert.equal(proxyCode,0,proxyErr||proxyOut);
      assert.deepEqual(rawTargets[4],Buffer.concat([Buffer.from('http://owned.invalid/wire?q='),Buffer.from([0xff,0x80])]));
      await Bun.write(join("artifacts","playwright","curl-raw-target-capture.json"),JSON.stringify({passed:true,targets:rawTargets.map(target=>target.toString('hex')),scope:'curl.exe HTTP/1 direct and HTTP proxy loopback; no application or native profile'},null,2));
    }
  } finally {}
  if (process.env.INSOMNIUM_CURL_WIRE_CAPTURE_ONLY !== "1") {
  const identifier=selectedNativeProbeIdentifier(),isolated=identifier===resourceCrudProbeIdentifier;
  const ownership={expectedIdentifier:identifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP};
  const run = async () => withResourceProbePreserved(async (capture) => {
  await withNativeApp(
    "curl-import-get-file",
    async ({ page, invoke, output, pid }) => {
      if (isolated) { await resourceSaved(page); await capture(); }
      if (process.env.INSOMNIUM_CURL_WIRE_NATIVE === "1") {
        assert.ok(wire);const url=`http://127.0.0.1:${wire.port}/wire`;
        const before=await invoke("load_workspace"),oldIds=new Set(before.resources.map((/** @type {any} */ row)=>row._id));
        await page.getByRole("button",{name:"Import collection",exact:true}).click();const dialog=page.getByRole("dialog");
        await dialog.getByLabel("Import collection or cURL commands",{exact:true}).fill(`curl -q -G --data-binary 'name=ไทย' '${url}'`);
        await dialog.getByRole("button",{name:"Review import",exact:true}).click();await dialog.getByRole("button",{name:"Import",exact:true}).click();await dialog.waitFor({state:"detached"});
        /** @type {any[]} */ let added=[];await poll(async()=>{const data=await invoke("load_workspace");added=data.resources.filter((/** @type {any} */ row)=>!oldIds.has(row._id));return added.some((/** @type {any} */ row)=>row._type==="request");},"Wire fixture persisted");
        for(const row of added.filter((/** @type {any} */ row)=>row._type==="workspace"))registerResourceProbeCollection(row._id,row.name);
        const request=added.find((/** @type {any} */ row)=>row._type==="request");assert.ok(request);
        await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"GET "+request.url,exact:true}).click();
        await page.getByRole("button",{name:"Send",exact:true}).click();await poll(()=>Promise.resolve(rawTargets.length===2),"App wire target received");
        await poll(async()=>!(await page.getByRole("button",{name:"Cancel",exact:true}).count()),"Wire send settled");
        await Bun.write(join(output,"wire-comparison.json"),JSON.stringify({curl:rawTargets[0].toString("hex"),app:rawTargets[1].toString("hex"),equal:rawTargets[0].equals(rawTargets[1])},null,2));
        assert.deepEqual(rawTargets[1],rawTargets[0],"Native request target must match curl bytes");
        const binaryUrl = url.replace('/wire', '/wire-binary');
        const binaryPath = join(output, 'raw-query.bin');
        await Bun.write(binaryPath, Buffer.from([0x71, 0x3d, 0xff, 0x80, 0x25, 0x32, 0x66, 0, 0x7a]));
        const ids = new Set((await invoke('load_workspace')).resources.map((/** @type {any} */ row) => row._id));
        await page.getByRole('button', {name:'Import collection', exact:true}).click();
        const binaryDialog = page.getByRole('dialog');
        await binaryDialog.getByLabel('Import collection or cURL commands', {exact:true}).fill(`curl -q -G --data-binary '@missing.bin' '${binaryUrl}'`);
        await binaryDialog.getByRole('button', {name:'Review import', exact:true}).click();
        await binaryDialog.getByRole('button', {name:'Import', exact:true}).click(); await binaryDialog.waitFor({state:'detached'});
        /** @type {any[]} */ let binaryAdded = [];
        await poll(async () => { binaryAdded = (await invoke('load_workspace')).resources.filter((/** @type {any} */ row) => !ids.has(row._id)); return binaryAdded.some((/** @type {any} */ row) => row._type === 'request'); }, 'Binary import persisted');
        for (const row of binaryAdded.filter((/** @type {any} */ row) => row._type === 'workspace')) registerResourceProbeCollection(row._id, row.name);
        const binaryRequest = binaryAdded.find((/** @type {any} */ row) => row._type === 'request');
        await page.getByRole('complementary', {name:'Collections'}).getByRole('button', {name:'GET ' + binaryUrl, exact:true}).click();
        await page.getByRole('button', {name:'Send', exact:true}).click();
        await page.getByText('Error: Select the file for cURL body segment “missing.bin”.', {exact:true}).waitFor();
        await page.getByLabel('File for body part 1', {exact:true}).setInputFiles(binaryPath);
        await poll(async () => typeof (await invoke('load_workspace')).resources.find((/** @type {any} */ row) => row._id === binaryRequest._id).body.curlSegments[0].base64 === 'string', 'Binary selection saved');
        await page.getByRole('button', {name:'Send', exact:true}).click();
        await poll(async () => rawTargets.length === 3 && !(await page.getByRole('button', {name:'Cancel', exact:true}).count()), 'Native raw binary send settled');
        const comparison = Bun.spawn(['curl.exe', '-q', '-sS', '--noproxy', '*', '--max-time', '5', '-G', '--data-binary', '@' + binaryPath, binaryUrl], {stdout:'pipe', stderr:'pipe'});
        const [out, err, code] = await Promise.all([new Response(comparison.stdout).text(), new Response(comparison.stderr).text(), comparison.exited]);
        assert.equal(code, 0, err || out);
        assert.deepEqual(rawTargets[2], rawTargets[3], 'Selected non-UTF-8 bytes, percent escape and NUL handling match curl');
        const documentPath = join(output, 'reference.json');
        const document = '{"type":"string"}';
        await Bun.write(documentPath, document);
        await assert.rejects(invoke('read_openapi_files', {paths:[documentPath], existingCount:0, existingBytes:0}), /Select the API document/);
        const chooser = respondToOwnedOpenDialog(pid, output, documentPath, 'file', '.json');
        void chooser.catch(() => {});
        const selection = invoke('plugin:dialog|open', {options:{multiple:false,filters:[{name:'API documents',extensions:['json']}]}});
        await chooser; assert.equal(await selection, documentPath);
        assert.deepEqual(await invoke('read_openapi_files', {paths:[documentPath], existingCount:31, existingBytes:8 * 1024 * 1024 - Buffer.byteLength(document)}), [{name:'reference.json', contents:document}]);
        for (const budget of [{existingCount:32,existingBytes:0}, {existingCount:31,existingBytes:8 * 1024 * 1024 - Buffer.byteLength(document) + 1}])
          await assert.rejects(invoke('read_openapi_files', {paths:[documentPath], ...budget}), /Reference files exceed 32 files or 8 MiB/);
        const tls = await serveUntrustedGitTls(output);
        try {
          const rawRequest = (/** @type {string} */ target, /** @type {Record<string,any>} */ options = {}) => ({
            id:'raw-tls-' + crypto.randomUUID(), workspaceId:request.parentId, method:'GET', url:target,
            rawUrlBase64:Buffer.from(target).toString('base64'), headers:[], timeoutMs:5000,
            followRedirects:true, validateCertificates:true, useCookies:false, sendCookies:false,
            storeCookies:false, proxyDisabled:true, ...options,
          });
          await assert.rejects(invoke('send_http', {request:rawRequest(tls.url)}), error => /certificate|SSL|TLS|schannel/i.test(String(error && typeof error === 'object' && 'message' in error ? error.message : error)));
          assert.equal(tls.state.requests, 0, 'Untrusted TLS refuses before HTTP dispatch');
          assert.equal((await invoke('send_http', {request:rawRequest(tls.url, {validateCertificates:false})})).status, 503);
          assert.equal((await invoke('send_http', {request:rawRequest('http://owned.invalid/proxy?q=%2F', {validateCertificates:false,proxyDisabled:false,proxy:tls.url.replace('/repo.git','')})})).status, 503);
          assert.equal(tls.state.requests, 2, 'Native HTTPS destination and HTTPS proxy reached the owned TLS fixture');
        } finally { tls.close(); }
        await Bun.write(join(output, 'wire-comparison.json'), JSON.stringify({passed:true, targets:rawTargets.map(target=>target.toString('hex')), scope:'native-hidden UI import, file selection and Send versus curl.exe; UTF-8 and binary queries'}, null, 2));
        return;
      }
      const pickerReceipts = [];
      const all = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
      const cases = methodToggles ? [
        { name: "get-off", args: ["-G", "--no-get", "--data-binary", "@FILE", "-d", "tail=2", "--url-query", "keep=1"], bytes: all, method: "POST" },
        { name: "get-on", args: ["--no-get", "-G", "--data-urlencode", "field@FILE", "-d", "tail=2", "--url-query", "ignored=1"], bytes: all, method: "GET" },
        { name: "explicit-get", args: ["--no-head", "-G", "--data-urlencode", "field@FILE", "-d", "tail=2"], bytes: Buffer.from("space #value"), method: "GET" },
        { name: "head-repeat", args: ["-I", "-I", "-G", "--data-urlencode", "field@FILE", "-d", "tail=2"], bytes: Buffer.from("space #value"), method: "HEAD" },
        { name: "next-reset", args: ["--data-binary", "@FILE", "-d", "tail=2"], bytes: all, method: "POST" },
        { name: "explicit-get-repeat", args: ["--no-head", "--no-head", "-G", "--no-get", "-G", "--data-urlencode", "field@FILE", "-d", "tail=2"], bytes: all, method: "GET" },
        { name: "patch-body", args: ["-G", "--no-get", "-X", "PATCH", "--data-binary", "@FILE", "-d", "tail=2"], bytes: all, method: "PATCH" },
      ] : [
        {
          name: "encoded",
          args: [
            "-G",
            "--data-urlencode",
            "field@FILE",
            "-d",
            "tail=2",
            "--url-query",
            "ignored=1",
          ],
          bytes: all,
          method: "GET",
        },
        {
          name: "head",
          args: ["-G", "-I", "--data-urlencode", "field@FILE"],
          bytes: Buffer.from("space #value"),
          method: "HEAD",
        },
        {
          name: "patch",
          args: ["-G", "-X", "PATCH", "--data-binary", "@FILE"],
          bytes: Buffer.from("a=1&b=%2f"),
          method: "PATCH",
        },
        {
          name: "nul",
          args: ["-G", "--data-binary", "@FILE"],
          bytes: Buffer.from([65, 0, 66]),
          method: "GET",
        },
        {
          name: "invalid",
          args: ["-G", "--data-binary", "@FILE"],
          bytes: Buffer.from("raw space"),
          method: "GET",
        },
      ];
      const base = "http://127.0.0.1:" + server.port;
      const urlFor = (/** @type {string} */ name) =>
        base + "/" + name + "?old=1#fragment";
      const before = await invoke("load_workspace"),
        oldIds = new Set(
          before.resources.map(/** @param {any} r */ (r) => r._id),
        );
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      if (methodToggles) {
        const refusalUpload = join(output, "refused-upload.bin");
        await writeFile(refusalUpload, "owned upload");
        const refused = [["-I", "--no-head"], ["--no-head", "-I"],
          ["--no-head", "-d", "x=1"], ["--no-head", "-F", "x=1"],
          ["--no-head", "-T", "missing.bin"]];
        for (const args of refused) {
          await dialog.getByLabel("Import collection or cURL commands", { exact: true })
            .fill("curl " + args.map(value => "'" + value + "'").join(" ") + " '" + base + "/refused'");
          await dialog.getByRole("button", { name: "Review import", exact: true }).click();
          await dialog.getByRole("alert").filter({ hasText: /Conflicting cURL|cURL file uploads cannot/ }).waitFor();
          assert.equal(await dialog.getByRole("button", { name: "Import", exact: true }).count(), 0);
          assert.deepEqual((await invoke("load_workspace")).resources, before.resources);
          const child = Bun.spawn(["curl.exe", "-q", "-sS", "--noproxy", "*", "--max-time", "2", ...args.map(value => value === "missing.bin" ? refusalUpload : value), base + "/refused"], { stdout: "pipe", stderr: "pipe" });
          const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
          assert.equal(code, 2, err || out);
          assert.equal(received.length, 0, "Both import and curl refuse method conflicts before dispatch");
        }
      }
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(
          cases
            .map(
              (c, index) =>
                (methodToggles && index ? "" : "curl -q ") +
                c.args
                  .map((x) => "'" + x.replace("FILE", "missing.bin") + "'")
                  .join(" ") +
                " '" +
                urlFor(c.name) +
                "'",
            )
            .join(methodToggles ? " --next " : "\n"),
        );
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog.getByText(`${cases.length} requests`, { exact: true }).waitFor();
      assert.equal(received.length, 0);
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      /** @type {any[]} */ let added = [];
      await poll(async () => {
        added = (await invoke("load_workspace")).resources.filter(
          /** @param {any} r */ (r) =>
            !oldIds.has(r._id) && r._type === "request",
        );
        return added.length === cases.length;
      }, "GET file requests saved");
      const imported = await invoke("load_workspace");
      for (const collection of imported.resources.filter((/** @type {any} */ r) => !oldIds.has(r._id) && r._type === "workspace"))
        registerResourceProbeCollection(collection._id, collection.name);
      for (const c of cases) {
        const url = urlFor(c.name),
          request = added.find((r) => r.url === (c.name === "get-off" ? url.replace("#fragment", "&keep=1#fragment") : url));
        assert.ok(request);
        const savedUrl = request.url;
        assert.equal(request.method, c.method);
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: c.method + " " + savedUrl, exact: true })
          .click();
        /** @type {number} */ const count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .getByText(
            "Error: Select the file for cURL body segment “missing.bin”.",
            { exact: true },
          )
          .waitFor();
        assert.equal(received.length, count);
        const path = join(output, c.name + (physicalPicker && c === cases[0] ? ".json" : ".bin"));
        await writeFile(path, c.bytes);
        const input = page.getByLabel("File for body part 1", { exact: true });
        if (physicalPicker && c === cases[0]) {
          let chooser = respondToOwnedOpenDialog(pid, output, null, "file", ".json", { webview: true });
          void chooser.catch(() => {}); await input.click(); pickerReceipts.push(await chooser);
          assert.equal(received.length, count, "Cancelled picker sends nothing");
          chooser = respondToOwnedOpenDialog(pid, output, path, "file", ".json", { webview: true });
          void chooser.catch(() => {}); await input.click(); pickerReceipts.push(await chooser);
        } else await input.setInputFiles(path);
        /** @type {any} */ let selected;
        await poll(async () => {
          selected = (await invoke("load_workspace")).resources.find(
            /** @param {any} r */ (r) => r._id === request._id,
          );
          return typeof selected.body.curlSegments[0].base64 === "string";
        }, "GET file selection persisted");
        const encoded = selected.body.curlSegments[0].base64;
        await page.reload();
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: c.method + " " + savedUrl, exact: true })
          .click();
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (c.name === "invalid") {
          await page
            .getByText(
              /URL.*(?:malformed|invalid|rejected)|(?:malformed|invalid).*URL/i,
            )
            .waitFor();
          assert.equal(received.length, count);
        } else {
          await poll(
            async () => received.length === count + 1,
            "Native GET file request",
          );
          await poll(
            async () =>
              !(await page
                .getByRole("button", { name: "Cancel", exact: true })
                .count()),
            "GET file Send settled",
          );
        }
        const p = Bun.spawn(
          [
            "curl.exe",
            "-q",
            "-sS",
            "--noproxy",
            "*",
            "--max-time",
            "5",
            ...c.args.map((x) => x.replace("FILE", path)),
            url,
          ],
          { stdout: "pipe", stderr: "pipe" },
        );
        const [out, err, code] = await Promise.all([
          new Response(p.stdout).text(),
          new Response(p.stderr).text(),
          p.exited,
        ]);
        if (c.name === "invalid") {
          assert.equal(code, 3, err || out);
          assert.equal(received.length, count);
        } else {
          assert.equal(code, 0, err || out);
          assert.equal(received.length, count + 2);
          assert.deepEqual(received[count], received[count + 1]);
          /** @type {boolean} */ const sendsBody = methodToggles && ["get-off", "next-reset", "patch-body"].includes(c.name);
          /** @type {Buffer} */ const expectedBody = sendsBody ? Buffer.concat([c.bytes, Buffer.from("&tail=2")]) : Buffer.alloc(0);
          assert.equal(received[count].bodyBytes, expectedBody.length);
          assert.equal(received[count].bodyBase64, expectedBody.toString("base64"));
          assert.equal(received[count].type, sendsBody ? "application/x-www-form-urlencoded" : null);
        }
        const persisted = (await invoke("load_workspace")).resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        );
        assert.equal(persisted.body.curlSegments[0].base64, encoded);
        assert.equal(
          persisted.url,
          savedUrl,
          "Send does not append query into saved source URL",
        );
      }
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            pickerReceipts,
            focus: methodToggles ? "GET/HEAD reset flags" : "original GET-file cases",
            checks: methodToggles ? ["GET last-wins and compatible HEAD/explicit GET selectors control actual native method and query/body bytes",
              "--next resets both flag families", "Native file selection/reload and exact all256byte bodies match curl8.21.0",
              "url-query retained only with GET disabled", "Explicit PATCH body preserved",
              "Missing selections refuse before network; review/import never send", "Saved source URL/bytes unchanged"] : [
              "Missing file prevents network",
              "Mounted selection/reload/native Send matches curl",
              "URL-encoded all256byte file with literal and ignored url-query",
              "HEAD and explicit PATCH preserve method/no body",
              "Binary NUL truncation and raw-space refusal match curl",
              "Saved URL/bytes unchanged after Send",
            ],
            received,
          },
          null,
          2,
        ),
      );
    },
    ownership,
  );
  }, { ...ownership, lazyCapture: isolated });
  if (selectedNativeProbeIdentifier() === integrationProbeIdentifier) await preserveNativeProfile(run);
  else await run();
  }
} finally {
  wire?.stop(true);
  server.stop(true);
}
