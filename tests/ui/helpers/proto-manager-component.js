import assert from "node:assert/strict";
import {resolve,sep,join} from "node:path";
import {lstat,realpath} from "node:fs/promises";
import {createHash} from "node:crypto";
import {withComponentFixture} from "./component-fixture.js";
import {measureProtoPendingFields} from "./proto-pending-fields.js";

/** Source alias only; no API/transport/provider behavior replacement. */
async function sourcePlugin(){
  const root=resolve(process.env.INSOMNIUM_PROTO_MEASURE_SOURCE_ROOT??"src/lib");
  assert.ok(root===resolve("src/lib")||root.startsWith(resolve("artifacts")+sep));
  const info=await lstat(root);assert.ok(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
  if(root!==resolve("src/lib")){
    assert.ok(process.env.INSOMNIUM_PROTO_MEASURE_MANIFEST);
    const hashes=await Bun.file(/** @type {string} */(process.env.INSOMNIUM_PROTO_MEASURE_MANIFEST)).json();
    for(const [path,expected]of Object.entries(hashes)){assert.ok(path.startsWith("src/lib/")&&!path.includes(".."));const actual=createHash("sha256").update(new Uint8Array(await Bun.file(join(root,path.slice(8))).arrayBuffer())).digest("hex");assert.equal(actual,expected,"Frozen source mismatch: "+path);}
  }
  const importer=new Set([resolve("tests/ui/fixtures/proto-manager-component.js"),resolve("tests/ui/fixtures/proto-manager-component.svelte")]);
  const paths={"components/ProtoManager.svelte":"components/ProtoManager.svelte","workspace.svelte.js":"workspace.svelte.js","model.js":"model.js","styles/index.css":"styles/index.css"};
  return {name:"proto-measure-real-source",setup(/** @type {import('bun').PluginBuilder} */build){build.onResolve({filter:/^\.\.\/\.\.\/\.\.\/src\/lib\//},args=>{assert.ok(importer.has(resolve(args.importer)));const key=args.path.slice("../../../src/lib/".length);assert.ok(Object.hasOwn(paths,key));return {path:join(root,paths[/** @type {keyof typeof paths} */(key)])};});}};
}
/** @param {import('playwright-core').Page} page @param {string} action @param {any[]} [args] */
async function control(page,action,args=[]){return page.evaluate(async({action,args})=>{const host=/** @type {any} */(window);if(!host.__protoMeasurement||!["reset","snapshot","select","replaceData","show","switchTab","release"].includes(action))throw Error("Unknown fixture action");return host.__protoMeasurement[action](...args);},{action,args});}

export async function runProtoComponentMeasurement(){
  const plugin=await sourcePlugin();
  await withComponentFixture("proto-manager-component",async(page,output)=>{
    const errors=/** @type {string[]} */([]);page.on("pageerror",error=>errors.push(String(error)));
    await page.locator('output[data-proto-ready="true"]').waitFor({state:"attached"});
    assert.equal(await page.evaluate(()=>"__TAURI_INTERNALS__" in window),false,"Actual browser fallback, no Tauri alias");
    const panel=page.getByRole("main",{name:"Owned Proto measurement",exact:true});
    const picker=()=>panel.getByLabel("Import files",{exact:true});
    const source='syntax = "proto3"; package owned; message Imported { string value = 1; }';
    const results=/** @type {any[]} */([]),failures=/** @type {any[]} */([]);
    const snap=()=>control(page,"snapshot");
    async function quiet(){assert.equal(await panel.getByRole("alert").count(),0);assert.equal(await panel.getByRole("status").count(),0);assert.equal(await panel.getByRole("textbox",{name:"Proto path 1",exact:true}).count(),0);}
    async function reset(){await control(page,"reset");await picker().waitFor({state:"attached"});await quiet();}
    /** @param {string} token */
    async function held(token){
      await picker().evaluate((el,{token,source})=>{const host=/** @type {any} */(window),file=host.__protoMeasurement.hold(new File([source],"held.proto",{type:"text/plain"}),token),transfer=new DataTransfer();transfer.items.add(file);const input=/** @type {HTMLInputElement} */(el);input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));},{token,source});
      await panel.getByRole("button",{name:"Cancel",exact:true}).waitFor();
      const state=await snap();assert.equal(state.reads.at(-1).reads,1,"Controlled File instance actually read");
      return {state,inputId:await picker().getAttribute("id")};
    }
    /** @param {string} token @param {boolean} reject */
    async function settled(token,reject){await control(page,"release",[token,reject]);await page.waitForFunction(token=>JSON.parse(/** @type {string} */(document.querySelector("output[data-proto-state]")?.getAttribute("data-proto-state"))).reads.find((/** @type {any} */r)=>r.token===token)?.settled,token);}
    const record=async(/** @type {any} */entry)=>{results.push(entry);await Bun.write(output+"/proto-measurement.json",JSON.stringify({native:false,controlledFileInstance:true,results,failures,errors},null,2));};
    for(const theme of ["dark","light"])for(const width of [1440,900,760]){
      await page.setViewportSize({width,height:600});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await reset();
      const geometry=await panel.evaluate(el=>{const box=(/** @type {Element} */node)=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor};};return {panel:box(el),controls:[...el.querySelectorAll("label.ui-file-picker,input[aria-label],textarea")].map(node=>({id:node.id,name:node.getAttribute("aria-label")??node.textContent,box:box(node)}))};});
      await record({theme,width,kind:"normal",geometry,parentKey:"request._id",tabRemoval:true});
      await page.screenshot({path:output+"/proto-"+theme+"-"+width+"-normal.png"});
      // Normal valid import uses native File.text and actual browser persistence.
      const before=await snap();await picker().setInputFiles({name:"imported.proto",mimeType:"text/plain",buffer:Buffer.from(source)});
      await panel.getByRole("textbox",{name:"Proto path 1",exact:true}).waitFor();assert.equal(await panel.getByRole("textbox",{name:"Proto path 1",exact:true}).inputValue(),"imported.proto");
      assert.deepEqual((await snap()).data,before.data,"Read preview is not a saved import");
      await panel.getByRole("button",{name:"Import 1 files",exact:true}).click();
      await panel.getByRole("status").filter({hasText:"Proto files imported."}).waitFor();
      const imported=await snap();assert.equal(imported.data.resources.filter((/** @type {any} */r)=>r._type==="proto_file").length,3);
      assert.equal(imported.data.resources.find((/** @type {any} */r)=>r.name==="imported.proto").protoText,source);
      await page.waitForFunction(()=>{const host=/** @type {any} */(window),state=host.__protoMeasurement.snapshot();return state.persisted&&JSON.parse(state.persisted).resources.some((/** @type {any} */r)=>r.name==="imported.proto");});
      const filename=panel.getByRole("textbox",{name:"Proto filename",exact:true});await filename.fill("invalid/name.proto");await filename.press("Tab");
      await panel.getByRole("alert").waitFor();assert.equal(await filename.inputValue(),"imported.proto");assert.equal(await filename.getAttribute("aria-invalid"),null,"Rolled-back current filename is valid");
      assert.equal((await snap()).data.resources.find((/** @type {any} */r)=>r.name==="imported.proto").protoText,source);
      await filename.fill("renamed.proto");await filename.press("Tab");assert.equal(await panel.getByRole("alert").count(),0);
      await page.waitForFunction(()=>{const host=/** @type {any} */(window),state=host.__protoMeasurement.snapshot();return state.persisted&&JSON.parse(state.persisted).resources.some((/** @type {any} */r)=>r.name==="renamed.proto");});
      await record({theme,width,kind:"valid-import-rename",realFileText:true,browserPersisted:true,invalidRenameRefused:true});
      await reset();const invalidBefore=await snap();await picker().setInputFiles({name:"path.proto",mimeType:"text/plain",buffer:Buffer.from(source)});
      const path=panel.getByRole("textbox",{name:"Proto path 1",exact:true});await path.waitFor();await path.fill("../bad.proto");
      await panel.getByRole("button",{name:"Import 1 files",exact:true}).click();const pathError=panel.getByRole("alert");await pathError.waitFor();
      assert.equal(await pathError.innerText(),"Error: Invalid or duplicate proto filename: ../bad.proto");
      assert.deepEqual((await snap()).data.resources,invalidBefore.data.resources);assert.equal((await snap()).persisted,invalidBefore.persisted);
      const association={invalid:await path.getAttribute("aria-invalid"),description:await path.getAttribute("aria-describedby"),id:await path.getAttribute("id"),error:await pathError.innerText()};
      await page.screenshot({path:output+"/proto-"+theme+"-"+width+"-invalid-path.png"});
      await path.fill("corrected.proto");const correctionNoticePersists=await pathError.count()===1;
      await panel.getByRole("button",{name:"Import 1 files",exact:true}).click();await panel.getByRole("status").filter({hasText:"Proto files imported."}).waitFor();assert.equal(await panel.getByRole("alert").count(),0);
      await record({theme,width,kind:"invalid-preview-path-correction",refusedWithoutSave:true,association,correctionNoticePersists,correctedRetryImports:true});
      await reset();const sizeBefore=await snap();await picker().setInputFiles({name:"large.proto",mimeType:"text/plain",buffer:Buffer.alloc(2*1024*1024+1,120)});
      await panel.getByRole("alert").waitFor();assert.equal(await panel.getByRole("alert").innerText(),"Error: Proto sources exceed 2 MiB per file or 8 MiB combined.");
      assert.deepEqual((await snap()).data.resources,sizeBefore.data.resources);assert.equal((await snap()).persisted,sizeBefore.persisted);assert.equal(await picker().inputValue(),"");
      await record({theme,width,kind:"per-file-size-refusal",bytes:2*1024*1024+1,noSave:true,inputReset:true});
      await reset();await picker().setInputFiles({name:"changed.proto",mimeType:"text/plain",buffer:Buffer.from(source)});await path.waitFor();await control(page,"replaceData");const scopeBefore=await snap();
      await panel.getByRole("button",{name:"Import 1 files",exact:true}).click();await panel.getByRole("alert").waitFor();assert.equal(await panel.getByRole("alert").innerText(),"Error: Workspace or request changed. Select the proto files again.");
      assert.deepEqual((await snap()).data.resources,scopeBefore.data.resources);assert.equal((await snap()).persisted,scopeBefore.persisted);
      await record({theme,width,kind:"completed-preview-data-replacement",actualApplyGuard:true,noSave:true,feedback:"feature-global context refusal"});
      await reset();const replaceBefore=await snap();await panel.locator('input[type="file"][title="Replace seed.proto"]').setInputFiles({name:"seed.proto",mimeType:"text/plain",buffer:Buffer.from(source)});await path.waitFor();
      await panel.getByRole("button",{name:"Validate and update",exact:true}).click();await panel.getByRole("alert").waitFor();assert.equal(await panel.getByRole("alert").innerText(),"Error: Open the desktop app to use gRPC and server reflection.");
      assert.deepEqual((await snap()).data.resources,replaceBefore.data.resources);assert.equal((await snap()).persisted,replaceBefore.persisted);
      await path.fill("backend-edited.proto");assert.equal(await panel.getByRole("alert").innerText(),"Error: Open the desktop app to use gRPC and server reflection.");assert.equal(await path.getAttribute("aria-invalid"),null,"Backend availability is not a current filename error");
      await record({theme,width,kind:"real-browser-replace-fallback",native:false,backendNotInvoked:true,noSave:true,heldNativeValidation:"OPEN"});
      for(const [kind,reject] of /** @type {[string,boolean][]} */([
        ["request-A-B-success",false],["request-A-B-rejection",true],["flushed-ABA-rejection",true],
        ["data-replacement-success",false],["data-replacement-rejection",true],["unmount-remount-success",false],["unmount-remount-rejection",true],
        ["tab-removal-rejection",true],["cancel-success",false],["cancel-rejection",true],["owned-current-rejection",true],
      ])){
        await reset();const token=theme+"-"+width+"-"+kind,{state:baseline,inputId}=await held(token);
        let cancellationFocus=/** @type {Record<string,any>|null} */(null);
        if(kind.startsWith("request-A-B")||kind.startsWith("flushed-ABA")){await control(page,"select",["req_proto_measure_b"]);assert.equal(await picker().count(),0,"Production new GrpcPane starts on Body");if(kind.startsWith("flushed-ABA"))await control(page,"select",["req_proto_measure_a"]);await control(page,"switchTab",[true]);assert.notEqual(await picker().getAttribute("id"),inputId,"Production keyed instance actually replaced");}
        else if(kind.startsWith("data-replacement"))await control(page,"replaceData");
        else if(kind.startsWith("unmount")){await control(page,"show",[false]);assert.equal(await picker().count(),0);await control(page,"show",[true]);assert.notEqual(await picker().getAttribute("id"),inputId);}
        else if(kind.startsWith("tab-removal")){await control(page,"switchTab",[false]);assert.equal(await picker().count(),0);await control(page,"switchTab",[true]);assert.notEqual(await picker().getAttribute("id"),inputId);}
        else if(kind.startsWith("cancel")){const cancel=panel.getByRole("button",{name:"Cancel",exact:true});await cancel.focus();assert.equal(await cancel.evaluate(el=>el===document.activeElement),true);await cancel.press("Enter");cancellationFocus=await page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,label:document.activeElement?.getAttribute("aria-label")}));assert.equal(cancellationFocus?.id,inputId,"Keyboard Cancel restores exact originating picker");if(cancellationFocus?.tag==="BODY")failures.push({theme,width,kind:"cancel-keyboard-focus",action:kind,actual:cancellationFocus,expected:"connected surviving control after focused Cancel removal"});}
        const beforeRelease=await snap();
        await settled(token,reject);
        await picker().waitFor({state:"attached"});
        const after=await snap();assert.deepEqual(after.data.resources,baseline.data.resources,"Owned read may not mutate saved resources");assert.deepEqual(after.data.history,baseline.data.history);
        assert.equal(after.persisted,beforeRelease.persisted,"Read settlement does not save; actual request navigation may persist");
        if(kind==="owned-current-rejection"){
          const feedback=panel.getByRole("alert");await feedback.waitFor();const actual=await feedback.innerText();assert.equal(actual,"Error: Owned File.text rejection "+token);
          await record({theme,width,kind,visibleOwnedError:actual,description:await picker().getAttribute("aria-describedby"),invalid:await picker().getAttribute("aria-invalid"),fieldVsGlobal:"feature-global current File read error"});
        }else{await quiet();await record({theme,width,kind,staleSuppressed:true,controlledReadRejected:reject,inputReset:await picker().inputValue()==="",resourcesUnchanged:true,persistedUnchanged:true,cancellationFocus});}
      }
      // Same-task controlled retirement happens before discard's tick resolves.
      // Actual DOM click, no transport substitution; these are scripted race controls.
      for (const retirement of ["elsewhere","request","data","unmount","tab","new-operation"]) {
        await reset();const token=theme+"-"+width+"-retire-"+retirement;
        const {state:baseline,inputId}=await held(token);assert.ok(inputId,"Originating picker has stable ID");
        const cancel=panel.getByRole("button",{name:"Cancel",exact:true});await cancel.focus();
        await cancel.evaluate((el,{retirement,source,token,inputId})=>{
          const host=/** @type {any} */(window),input=document.getElementById(inputId);
          /** @type {HTMLElement} */(el).click();
          if(retirement==="elsewhere")/** @type {HTMLElement} */(document.querySelector("header button")).focus();
          else if(retirement==="request")void host.__protoMeasurement.select("req_proto_measure_b");
          else if(retirement==="data")void host.__protoMeasurement.replaceData();
          else if(retirement==="unmount")void host.__protoMeasurement.show(false);
          else if(retirement==="tab")void host.__protoMeasurement.switchTab(false);

          else {const next=host.__protoMeasurement.hold(new File([source],"next.proto"),token+"-next"),transfer=new DataTransfer();transfer.items.add(next);const file=/** @type {HTMLInputElement} */(input);file.files=transfer.files;file.dispatchEvent(new Event("change",{bubbles:true}));}
        },{retirement,source,token,inputId});
        const focus=await page.evaluate(()=>({id:document.activeElement?.id,tag:document.activeElement?.tagName,text:document.activeElement?.textContent}));
        assert.notEqual(focus.id,inputId,"Retired/disabled/new-owner operation must not restore old picker");
        if(retirement==="elsewhere")assert.equal(focus.text,"Select request A");
        await settled(token,true);
        if(retirement==="new-operation"){assert.equal(await panel.getByRole("button",{name:"Cancel",exact:true}).count(),1);await settled(token+"-next",false);await panel.getByRole("textbox",{name:"Proto path 1",exact:true}).waitFor();assert.equal(await panel.getByRole("textbox",{name:"Proto path 1",exact:true}).inputValue(),"next.proto");}
        const after=await snap();assert.deepEqual(after.data.resources,baseline.data.resources);assert.deepEqual(after.data.history,baseline.data.history);
        await record({theme,width,kind:"cancel-focus-retirement",retirement,focus,scriptedSameTask:true,oldPickerNotFocused:true,resourcesUnchanged:true});
      }
      await measureProtoPendingFields({page,panel,picker,reset,snap,record,failures,source,theme,width});
    }
    assert.deepEqual(errors,[]);
    const summary={status:failures.length?"failed":"passed",measurementComplete:true,native:false,profiles:6,results:results.length,failures,limits:"Keyed component/browser persistence and owned File.text controls; no native schema validation/OS read faults/held backend apply-remove acceptance."};
    await Bun.write(output+"/proto-summary.json",JSON.stringify(summary,null,2));
    await Bun.write(output+"/result.json",JSON.stringify(summary,null,2));
    assert.equal(failures.length,0);
  },{plugins:[plugin]});
}
