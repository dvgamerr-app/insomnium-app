import assert from "node:assert/strict";
import { readFile, readdir, lstat, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { withNativeApp, poll, probeIdentifier } from "./native-app.js";
import { knownWindowsApplicationData } from "./native-profile-ownership.js";
import { withResourceProbePreserved, registerResourceProbeCollection } from "./resource-manager-cases.js";
import { newRequest } from "../../../src/lib/model.js";
import { readCookieGitMetadata, inventoryCookieGit, cookieGitMetadataSha256 } from "./cookie-native-git-inventory.js";

export const cookieNativeSourceSha256 = "588d4d2040c2a3fb5772cee0d586ff0ac1066e22a343c18709851fd3568aef87";
export const cookieNativeLayoutKeys = ["nocturne:split:workspace-left", "nocturne:split:request-response", "nocturne:split:design", "insomnium.requestResponseSplit.v1", "insomnium.apiSourcePreviewSplit.v1"];
export const cookieNativeLargeRaw = "owned=" + "é".repeat(4094);
const scheme = "Cookie URL must use HTTP or HTTPS", limit = "Cookie exceeds the 8 KiB editor limit";
const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");

/** Pure receipt validation; scripted initiation is not trusted keyboard evidence.
 * @param {any} receipt @param {'new'|'close'} kind */
export function assertCookiePendingUiReceipt(receipt,kind){
  assert.equal(receipt.initiation,"scripted-requestSubmit-and-click");
  assert.equal(receipt.kind,kind);assert.equal(receipt.submitCount,1);
  assert.equal(receipt.submitDefaultPrevented,true);assert.equal(typeof receipt.submitTrusted,"boolean");
  assert.equal(receipt.actionCount,1);assert.equal(receipt.actionTrusted,false);
  assert.equal(receipt.pending.urlDisabled,true);assert.equal(receipt.pending.rawDisabled,true);
  assert.equal(receipt.pending.saveDisabled,true);assert.equal(receipt.pending.saveText,"Saving…");
  assert.equal(receipt.pending.alerts,0);
  if(kind==="new"){
    assert.equal(receipt.after.connected,true);assert.equal(receipt.after.url,"");assert.equal(receipt.after.raw,"");
    assert.equal(receipt.after.urlDisabled,true);assert.equal(receipt.after.rawDisabled,true);
    assert.equal(receipt.after.saveDisabled,true);assert.equal(receipt.after.saveText,"Saving…");assert.equal(receipt.after.alerts,0);
  }else assert.equal(receipt.after.connected,false,"Actual modal subtree removed before reply publication");
}

/** Host-observed passive event order; no physical Rust entry/timing inference.
 * @param {any[]} events @param {string} id */
export function assertCookiePendingUiOrder(events,id){
  const selected=events.filter(event=>event.id===id);
  for(const phase of ["pending-ui","post-action","protocol-response"])assert.equal(selected.filter(event=>event.phase===phase).length,1);
  const order=(/** @type {string} */ phase)=>selected.find(event=>event.phase===phase).order;
  assert.ok(order("pending-ui")<order("post-action"));
  assert.ok(order("post-action")<order("protocol-response"),"Require observed checkpoint before passive protocol reply; no timing fallback");
}

/** Read-only filesystem evidence; never adopts/deletes unknown files.
 * @param {string} root */
async function inventory(root) {
  const result = /** @type {Record<string,string>} */ ({});
  const walk = async (/** @type {string} */ path, /** @type {string} */ prefix) => {
    const info = await lstat(path);
    assert.ok(!info.isSymbolicLink());
    assert.equal(resolve(await realpath(path)).toLowerCase(), resolve(path).toLowerCase());
    if (info.isDirectory()) {
      for (const name of (await readdir(path)).sort()) await walk(join(path,name),prefix ? prefix+"/"+name : name);
    } else {
      assert.ok(info.isFile());
      assert.ok(Object.keys(result).length < 10000 && info.size <= 256*1024*1024, "Bound read-only fixture inventory");
      result[prefix] = hash(await readFile(path));
    }
  };
  try { await walk(root,""); } catch (error) { if (/** @type {any} */ (error).code !== "ENOENT") throw error; }
  return result;
}

/** Root launches only after auditing a fresh app with the exact Cookie source.
 * No IPC result replacement, fetch/global Tauri patch, HTTP service or cookie parser. */
export async function runCookieNativeFields() {
  assert.equal(process.platform,"win32");
  assert.equal(process.env.INSOMNIUM_COOKIE_NATIVE_SOURCE_SHA256,cookieNativeSourceSha256,"Explicit current-source authorization required");
  const expectedExe = process.env.INSOMNIUM_COOKIE_NATIVE_EXE_SHA256;
  assert.match(expectedExe ?? "",/^[a-f0-9]{64}$/);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,"Explicit fresh build record required; no default candidate");
  const build = await Bun.file(/** @type {string} */ (process.env.INSOMNIUM_UI_BUILD_STATE)).json();
  assert.equal(build.status,"finished"); assert.equal(build.result.code,0); assert.equal(build.identifier,probeIdentifier);
  const exe=resolve(build.artifact); assert.ok(exe.startsWith(resolve("artifacts")+"\\"));
  assert.equal(hash(await readFile(exe)),expectedExe);
  assert.equal(new TextEncoder().encode(cookieNativeLargeRaw).byteLength,8194);
  assert.ok(process.env.INSOMNIUM_COOKIE_NATIVE_GIT_BASELINE,"Explicit reviewed Git metadata required");
  assert.equal(process.env.INSOMNIUM_COOKIE_NATIVE_GIT_BASELINE_SHA256,cookieGitMetadataSha256);
  await withResourceProbePreserved(async () => {
    await withNativeApp("cookie-native-fields",async ({page,invoke,output}) => {
      page.setDefaultTimeout(60000);
      const profile=join(knownWindowsApplicationData(),probeIdentifier);
      const originalCookies=await inventory(join(profile,"cookies"));
      assert.equal(Object.keys(originalCookies).length,654,"Bind current full baseline; review any inventory change");
      assert.ok(process.env.INSOMNIUM_COOKIE_NATIVE_GIT_BASELINE,"Explicit reviewed Git metadata required");
      const gitRoot=join(profile,"git-v1"),gitPin=await readCookieGitMetadata(gitRoot,/** @type {string} */(process.env.INSOMNIUM_COOKIE_NATIVE_GIT_BASELINE),/** @type {string} */(process.env.INSOMNIUM_COOKIE_NATIVE_GIT_BASELINE_SHA256));
      const gitBefore=await inventoryCookieGit(gitRoot,gitPin);
      const layout=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),cookieNativeLayoutKeys);
      const original=await invoke("load_workspace"), suffix=crypto.randomUUID().replaceAll("-","");
      const workspaceId="wrk_cnf_"+suffix, requestId="req_cnf_"+suffix, name="Owned native Cookie "+suffix;
      assert.ok(!original.resources.some((/** @type {any} */ row)=>row._id===workspaceId));
      const data=structuredClone(original);
      data.resources.push({_id:workspaceId,_type:"workspace",parentId:null,name,scope:"collection"},newRequest(workspaceId,{_id:requestId,name:"Cookie field probe",url:"https://cookie-field.example.invalid/"}));
      data.activeWorkspaceId=workspaceId;data.activeRequestId=requestId;data.activeEnvironmentId="";data.openTabs=[requestId];
      registerResourceProbeCollection(workspaceId,name);
      for(const extension of [".json",".previous.json"]){
        const path=join(profile,"cookies",workspaceId+extension);
        assert.equal(await Bun.file(path).exists(),false,"Owned cookie filename must be absent before any mutation");
      }
      const rows=/** @type {Record<string,any>[]} */ ([]);
      const pending=/** @type {Promise<void>[]} */ ([]), traceErrors=/** @type {string[]} */ ([]);
      const pendingUiRows=/** @type {Record<string,any>[]} */ ([]),pendingUiEvents=/** @type {Record<string,any>[]} */ ([]);
      const pendingUiRequests=/** @type {WeakMap<import('playwright-core').Request,string>} */(new WeakMap());
      let pendingUiId="";
      const checkpointName="__cookiePendingUi_"+crypto.randomUUID().replaceAll("-","");
      await page.exposeFunction(checkpointName,(/** @type {any} */ event)=>{
        if(!pendingUiId||event.id!==pendingUiId||!["pending-ui","post-action"].includes(event.phase)){traceErrors.push("Unowned pending UI checkpoint");return;}
        pendingUiEvents.push({...event,order:pendingUiEvents.length});
      });
      const requests=/** @type {Map<import('playwright-core').Request,Record<string,any>>} */ (new Map());
      let commandUrl="";
      const onRequest=(/** @type {import('playwright-core').Request} */ request)=>{
        if(request.url()!==commandUrl)return;
        try { const args=request.postDataJSON(); assert.equal(args.workspaceId,workspaceId);requests.set(request,{args,issued:Date.now()}); }
        catch(error){traceErrors.push(String(error));}
      };
      const onResponse=(/** @type {import('playwright-core').Response} */ response)=>{
        const row=requests.get(response.request());if(!row)return;
        pending.push((async()=>{try{row.ok=(await response.headerValue("Tauri-Response"))==="ok";row.value=await response.json();row.settled=Date.now();}catch(error){traceErrors.push(String(error));}})());
      };
      const onPendingUiRequest=(/** @type {import('playwright-core').Request} */ request)=>{
        if(pendingUiId&&request.url()===commandUrl)pendingUiRequests.set(request,pendingUiId);
      };
      const onPendingUiResponse=(/** @type {import('playwright-core').Response} */ response)=>{
        const id=pendingUiRequests.get(response.request());
        if(id&&response.url()===commandUrl&&requests.has(response.request()))pendingUiEvents.push({id,phase:"protocol-response",order:pendingUiEvents.length});
      };
      const dialog=page.getByRole("dialog",{name:"Cookies",exact:true});
      const url=()=>dialog.getByRole("textbox",{name:"Cookie URL",exact:true});
      const raw=()=>dialog.getByRole("textbox",{name:"Set-Cookie value",exact:true});
      const disk=async()=>({current:await Bun.file(join(profile,"cookies",workspaceId+".json")).text(),previous:await Bun.file(join(profile,"cookies",workspaceId+".previous.json")).exists()?await Bun.file(join(profile,"cookies",workspaceId+".previous.json")).text():null});
      const snapshot=()=>invoke("snapshot_request_cookies",{workspaceId,includeExpired:true});
      async function open(){await page.getByRole("button",{name:"Cookies",exact:true}).click();await poll(async()=>!(await url().isDisabled()),"Real jar loaded");}
      async function marked(/** @type {'url'|'raw'} */ field,/** @type {string} */ message){
        const target=field==="url"?url():raw(), other=field==="url"?raw():url();
        const id=await target.getAttribute("id");assert.ok(id);
        assert.equal(await target.getAttribute("aria-invalid"),"true");
        assert.equal(await target.getAttribute("aria-describedby"),id+"-error");
        assert.equal(await dialog.locator('[id="'+id+'-error"]').innerText(),message);
        assert.notEqual(await other.getAttribute("aria-invalid"),"true");
        assert.equal(await dialog.getByRole("alert").count(),1);
        const bounds=await dialog.locator('[id="'+id+'-error"]').evaluate(el=>{
          const rect=el.getBoundingClientRect();const clips=[];
          for(let parent=el.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if([style.overflowY,style.overflowX].some(value=>["auto","scroll","hidden","clip"].includes(value))){const box=parent.getBoundingClientRect();clips.push({top:box.top,bottom:box.bottom,left:box.left,right:box.right});}}
          return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,clips};
        });
        assert.ok(bounds.top>=0&&bounds.bottom<=600,"Actual native local feedback fits viewport");
        for(const clip of bounds.clips)assert.ok(bounds.top>=clip.top&&bounds.bottom<=clip.bottom&&bounds.left>=clip.left&&bounds.right<=clip.right,"Actual feedback fits every clipping ancestor");
      }
      try {
        await invoke("save_workspace",{data});await page.reload();
        await page.waitForFunction(id=>/** @type {HTMLSelectElement|null} */(document.querySelector('[aria-label="Collection"]'))?.value===id,workspaceId);
        // Owned real seed proves previous-key removal is rolled back on every refusal.
        await invoke("change_cookie",{workspaceId,url:"https://cookie-field.example.invalid/",raw:"owned=seed; Path=/; HttpOnly",previous:null,clear:false});
        const ownedJar=await invoke("list_cookies",{workspaceId});assert.equal(ownedJar.length,1);
        const key={domain:ownedJar[0].domain,path:ownedJar[0].path,name:ownedJar[0].name};
        assert.equal(key.name,"owned");
        commandUrl=await page.evaluate(()=>/** @type {any} */(window).__TAURI_INTERNALS__.convertFileSrc("change_cookie","ipc"));
        page.on("request",onRequest);page.on("response",onResponse);
        page.on("response",onPendingUiResponse);
        page.on("request",onPendingUiRequest);
        // Fail closed if WebView2/custom protocol lacks passive request evidence.
        const probeCount=requests.size;
        await invoke("change_cookie",{workspaceId,url:"ftp://cookie-field.example.invalid/",raw:"owned=probe; Path=/",previous:key,clear:false}).then(()=>assert.fail("Real scheme must reject"),error=>assert.equal(String(error).includes(scheme),true));
        await poll(async()=>requests.size===probeCount+1,"Passive native protocol observation required");
        await Promise.all(pending);assert.deepEqual(traceErrors,[]);
        for(const theme of ["dark","light"]){
          const themed=await invoke("load_workspace");themed.settings.theme=theme;await invoke("save_workspace",{data:themed});await page.reload();
          await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
          commandUrl=await page.evaluate(()=>/** @type {any} */(window).__TAURI_INTERNALS__.convertFileSrc("change_cookie","ipc"));
          for(const width of [1440,900,760]){
            await page.setViewportSize({width,height:600});await open();
            const geometry=await dialog.evaluate(el=>{
              const box=(/** @type {Element} */node)=>{const rect=node.getBoundingClientRect(),style=getComputedStyle(node);return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,font:style.font,color:style.color,background:style.backgroundColor};};
              return {dialog:box(el),fields:[...el.querySelectorAll(".cookie-form .ui-field")].map(node=>({box:box(node),gap:getComputedStyle(node).gap})),controls:[...el.querySelectorAll(".cookie-form input,.cookie-form textarea")].map(box)};
            });
            assert.equal(geometry.fields.length,2);for(const field of geometry.fields)assert.equal(field.gap,"7px");
            for(const [kind,origin,value,field,message] of /** @type {[string,string,string,'url'|'raw',string][]} */([
              ["scheme","ftp://cookie-field.example.invalid/","owned=refused; Path=/","url",scheme],
              ["UTF8-limit","https://cookie-field.example.invalid/",cookieNativeLargeRaw,"raw",limit],
              ["combined-byte-precedence","ftp://cookie-field.example.invalid/",cookieNativeLargeRaw,"raw",limit],
            ])){
              await dialog.locator(".cookie-detail").filter({hasText:"owned"}).click();
              await url().fill(origin);await raw().fill(value);
              const before={jar:await snapshot(),disk:await disk()}, count=requests.size;
              const submit=dialog.getByRole("button",{name:"Save cookie",exact:true});await submit.focus();await submit.press("Enter");
              await dialog.getByRole("alert").waitFor();await marked(field,message);
              await poll(async()=>[...requests.values()].slice(count).some(row=>row.settled),"Actual native refusal settled");
              await Promise.all(pending);assert.deepEqual(traceErrors,[]);assert.equal(requests.size,count+1);
              const actual=[...requests.values()][count];assert.equal(actual.ok,false);assert.equal(actual.value,message);
              assert.deepEqual(actual.args,{workspaceId,url:origin,raw:value,previous:key,clear:false});
              assert.deepEqual({jar:await snapshot(),disk:await disk()},before,"Real live jar, generation and disk exactly unchanged");
              if(field==="url")await url().fill("mailto:still-invalid@example.invalid");else await raw().fill(value+"x");
              await marked(field,message);
              if(field==="url")await url().fill("https://cookie-field.example.invalid/");else await raw().fill("owned=corrected; Path=/");
              assert.notEqual(await (field==="url"?url():raw()).getAttribute("aria-invalid"),"true");assert.equal(await dialog.getByRole("alert").count(),0);
              assert.equal(requests.size,count+1,"Correction does not submit");
              rows.push({theme,width,kind,field,message,request:actual,jarUnchanged:true,diskUnchanged:true});
            }
            await url().fill("not a URL");await raw().fill("owned=html; Path=/");const before=requests.size;
            assert.equal(await url().evaluate(el=>/** @type {HTMLInputElement} */(el).validity.typeMismatch),true);
            await dialog.getByRole("button",{name:"Save cookie",exact:true}).click();
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
            assert.equal(requests.size,before,"Native HTML malformed URL produces no IPC");
            await url().fill("ftp://cookie-field.example.invalid/");await url().focus();await url().press("Enter");
            await dialog.getByRole("alert").waitFor();await marked("url",scheme);
            assert.equal(requests.size,before+1,"Trusted Input Enter exactly one native change");
            await dialog.getByRole("button",{name:"New cookie",exact:true}).click();
            assert.equal(await url().inputValue(),"");assert.equal(await raw().inputValue(),"");assert.equal(await dialog.getByRole("alert").count(),0);
            await page.keyboard.press("Escape");assert.equal(await dialog.count(),0);
            assert.equal(await page.getByRole("button",{name:"Cookies",exact:true}).evaluate(el=>el===document.activeElement),true);
            rows.push({theme,width,kind:"HTML-Enter-New-Escape",htmlNoInvoke:true,inputEnter:1,geometry});
            // Additive cases: actual command, no sleeps/spins/response interception.
            for(const kind of /** @type {('new'|'close')[]} */(["new","close"])){
              await open();await dialog.locator(".cookie-detail").filter({hasText:"owned"}).click();
              const origin="ftp://cookie-field.example.invalid/",value="owned=pending-ui; Path=/";
              await url().fill(origin);await raw().fill(value);
              const before={jar:await snapshot(),disk:await disk()},count=requests.size;
              pendingUiId=theme+"-"+width+"-"+kind;
              const actualReply=page.waitForResponse(response=>response.url()===commandUrl&&response.request().postDataJSON()?.workspaceId===workspaceId&&response.request().postDataJSON()?.raw===value,{timeout:60000});
              void actualReply.catch(()=>{}); // Retain cleanup on an earlier strict-check failure.
              const receipt=await dialog.evaluate(async(el,{kind,id,name})=>{
                const input=/** @type {HTMLInputElement} */(el.querySelector('.cookie-form input[type="url"]'));
                const textarea=/** @type {HTMLTextAreaElement} */(el.querySelector(".cookie-form textarea"));
                const form=input.form,save=/** @type {HTMLButtonElement} */(el.querySelector('button[type="submit"]'));
                const action=/** @type {HTMLButtonElement} */(kind==="new"?[...el.querySelectorAll("button")].find(button=>button.textContent?.trim()==="New cookie"):el.querySelector('[aria-label="Close dialog"]'));
                if(!form||!save||!action||action.disabled||save.disabled||!form.checkValidity())throw Error("Actual valid owned edit required");
                let submit=/** @type {SubmitEvent|null} */(null),click=/** @type {MouseEvent|null} */(null),submitCount=0,actionCount=0;
                const onSubmit=(/** @type {SubmitEvent} */ event)=>{submit=event;submitCount++;};
                const onClick=(/** @type {MouseEvent} */ event)=>{click=event;actionCount++;};
                form.addEventListener("submit",onSubmit);action.addEventListener("click",onClick);
                const state=()=>({connected:el.isConnected,url:input.value,raw:textarea.value,urlDisabled:input.disabled,rawDisabled:textarea.disabled,saveDisabled:save.disabled,saveText:save.textContent?.trim(),alerts:el.querySelectorAll('[role="alert"]').length});
                try{
                  form.requestSubmit(save);
                  await Promise.resolve(); // One existing Svelte render checkpoint, no macrotask delay.
                  const pending=state();
                  if(!pending.urlDisabled||!pending.rawDisabled||!pending.saveDisabled||pending.saveText!=="Saving…")throw Error("No observed pending UI; refuse race acceptance: "+JSON.stringify(pending));
                  const host=/** @type {any} */(window);void host[name]({id,phase:"pending-ui",pending});
                  action.click();
                  await Promise.resolve(); // One checkpoint for actual reset/unmount.
                  const after=state();void host[name]({id,phase:"post-action",after});
                  return {id,kind,initiation:"scripted-requestSubmit-and-click",submitCount,submitDefaultPrevented:(/** @type {SubmitEvent|null} */(submit))?.defaultPrevented,submitTrusted:(/** @type {SubmitEvent|null} */(submit))?.isTrusted,actionCount,actionTrusted:(/** @type {MouseEvent|null} */(click))?.isTrusted,pending,after};
                }finally{form.removeEventListener("submit",onSubmit);action.removeEventListener("click",onClick);}
              },{kind,id:pendingUiId,name:checkpointName});
              await Bun.write(output+"/cookie-pending-ui-progress.json",JSON.stringify({receipt,events:pendingUiEvents,rows:pendingUiRows},null,2));
              assertCookiePendingUiReceipt(receipt,kind);
              await actualReply;
              await Promise.all(pending);assert.deepEqual(traceErrors,[]);
              assert.equal(requests.size,count+1);assert.ok([...requests.values()][count]?.settled,"Actual native refusal body settled");
              assertCookiePendingUiOrder(pendingUiEvents,pendingUiId);
              const actual=[...requests.values()][count];assert.equal(actual.ok,false);assert.equal(actual.value,scheme);
              assert.deepEqual(actual.args,{workspaceId,url:origin,raw:value,previous:key,clear:false});
              assert.deepEqual({jar:await snapshot(),disk:await disk()},before,"Pending UI action cannot commit jar/disk on real refusal");
              if(kind==="new")await dialog.locator('.cookie-form input[type="url"]:not([disabled])').waitFor({state:"visible"});else await open();
              assert.equal(await url().inputValue(),"");assert.equal(await raw().inputValue(),"");
              for(const control of [url(),raw()])assert.notEqual(await control.getAttribute("aria-invalid"),"true");
              assert.equal(await dialog.getByRole("alert").count(),0);assert.equal(await dialog.getByRole("status").count(),0);
              pendingUiRows.push({theme,width,kind,receipt,request:actual,jarUnchanged:true,diskUnchanged:true,staleFeedbackSuppressed:true,physicalRustEntryObserved:false});
              pendingUiId="";await page.keyboard.press("Escape");assert.equal(await dialog.count(),0);
            }
          }
        }
        await Promise.all(pending);assert.deepEqual(traceErrors,[]);
        await Bun.write(output+"/cookie-native-fields.json",JSON.stringify({native:true,renderingMode:"native-hidden",workspaceId,key,rows,requests:[...requests.values()],unexecuted:["entered-response New-owner race","entered-response modal-disposal race"],limits:"No response delay/replacement. Deterministic entered race needs separately reviewed real transport timing mechanism; controlled component proof does not close native race."},null,2));
        assert.equal(pendingUiRows.length,12);
        const originalReplies=[...requests].filter(([request])=>!pendingUiRequests.has(request)).map(([,row])=>row);
        assert.equal(rows.length,24);assert.equal(originalReplies.length,25);assert.equal(requests.size,37);
        await Bun.write(output+"/cookie-native-pending-ui.json",JSON.stringify({native:true,initiation:"scripted",rows:pendingUiRows,events:pendingUiEvents,originalCaseCount:rows.length,originalReplies,supplementalReplyCount:12,limits:"Observed UI await and checkpoint-before-passive-reply/publication only; physical Rust entry/reply production and trusted keyboard race remain unobserved."},null,2));
      } finally {
        page.off("response",onPendingUiResponse);
        page.off("request",onPendingUiRequest);
        await Bun.write(output+"/cookie-native-pending-ui-trace.json",JSON.stringify({rows:pendingUiRows,events:pendingUiEvents,complete:pendingUiRows.length===12,active:pendingUiId},null,2));
        await page.removeExposedFunction(checkpointName);
        await Promise.all(pending);page.off("request",onRequest);page.off("response",onResponse);
        await Bun.write(output+"/cookie-native-trace.json",JSON.stringify({workspaceId,rows,requests:[...requests.values()],traceErrors,complete:rows.length===24,nativeExecuted:true},null,2));
        if(await dialog.count())await page.keyboard.press("Escape");
        const after=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),cookieNativeLayoutKeys);
        await page.evaluate(values=>{for(const [key,value]of Object.entries(values)){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}},layout);
        assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),cookieNativeLayoutKeys),layout);
        assert.deepEqual(await inventoryCookieGit(gitRoot,gitPin),gitBefore,"No original Git files mutated");
        const finalCookies=await inventory(join(profile,"cookies"));for(const [file,sha]of Object.entries(originalCookies))assert.equal(finalCookies[file],sha);
        const current=await invoke("load_workspace"),ids=new Set(original.resources.map((/** @type {any} */row)=>row._id));
        assert.deepEqual(current.resources.filter((/** @type {any} */row)=>ids.has(row._id)),original.resources,"Every original resource payload unchanged");
        assert.deepEqual(current.history,original.history,"All original history unchanged");
        await Bun.write(output+"/cookie-native-preservation.json",JSON.stringify({workspaceId,registeredName:name,baselineCookies:originalCookies,gitBefore,layout,after,current3:cookieNativeLayoutKeys.slice(0,3),legacy2:cookieNativeLayoutKeys.slice(3),outerRestorationRequired:true},null,2));
      }
    });
  });
}
