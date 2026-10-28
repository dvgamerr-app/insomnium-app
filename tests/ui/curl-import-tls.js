import assert from "node:assert/strict";
import { withNativeApp, poll, integrationProbeIdentifier, selectedNativeProbeIdentifier, resourceCrudProbeIdentifier } from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { withResourceProbePreserved, registerResourceProbeCollection, resourceSaved } from "./helpers/resource-manager-cases.js";
import { serveUntrustedGitTls } from "./helpers/git-untrusted-tls.js";

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE, "Explicit current native build required");
const identifier=selectedNativeProbeIdentifier(),isolated=identifier===resourceCrudProbeIdentifier;
const ownership={expectedIdentifier:identifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP};
const run=async()=>withResourceProbePreserved(async (capture) => {
  await withNativeApp("curl-import-tls", async ({page, invoke, output}) => {
    if (isolated) { await resourceSaved(page); await capture(); }
    const tls = await serveUntrustedGitTls(output);
    let expectedGlobal = false;
    const checks = /** @type {Record<string,any>[]} */ ([]);
    try {
      const original = await invoke("load_workspace");
      const data = structuredClone(original);
      data.settings.validateCertificates = false;
      await invoke("save_workspace", {data});
      await page.reload();
      const cases = [
        {name:"short-insecure",flags:"-k",validation:"off"},
        {name:"default-after-next",flags:"",validation:"on"},
        {name:"last-secure",flags:"--insecure --no-insecure",validation:"on"},
        {name:"last-insecure",flags:"--no-insecure --insecure",validation:"off"},
      ];
      const commands = cases.map(c => c.flags+" '"+tls.url+"/"+c.name+"'");
      await page.getByRole("button",{name:"Import collection",exact:true}).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Import collection or cURL commands",{exact:true}).fill("curl "+commands.join(" --next "));
      await dialog.getByRole("button",{name:"Review import",exact:true}).click();
      assert.equal(tls.state.requests,0,"Review never sends");
      await dialog.getByRole("button",{name:"Import",exact:true}).click();
      await dialog.waitFor({state:"detached"});
      const oldIds = new Set(original.resources.map((/** @type {any} */ r)=>r._id));
      let imported = /** @type {Record<string,any>} */ ({});
      await poll(async()=>{imported=await invoke("load_workspace");return imported.resources.filter((/** @type {any} */ r)=>!oldIds.has(r._id)&&r._type==="request").length===cases.length;},"TLS import persisted");
      for(const collection of imported.resources.filter((/** @type {any} */ r)=>!oldIds.has(r._id)&&r._type==="workspace")) registerResourceProbeCollection(collection._id,collection.name);
      const added = imported.resources.filter((/** @type {any} */ r)=>!oldIds.has(r._id)&&r._type==="request");
      await page.reload();
      /** @param {Record<string,any>} request @param {boolean} allowed */
      const send = async (request,allowed) => {
        const before = await invoke("load_workspace");
        const historyIds = new Set(before.history.map((/** @type {any} */ r)=>r._id));
        const requests = tls.state.requests;
        await page.getByRole("button",{name:"Send",exact:true}).click();
        let response = /** @type {Record<string,any>|undefined} */ (undefined);
        if(allowed) {
        await poll(async()=>{const current=await invoke("load_workspace");response=current.history.find((/** @type {any} */ r)=>r.requestId===request._id&&!historyIds.has(r._id));return !!response;},"Native TLS response persisted",60000);
        } else {
          const error=page.getByRole("region",{name:"Response",exact:true}).locator(".error-state pre");
          await error.waitFor();
          response={error:await error.innerText(),status:null};
          const history=(await invoke("load_workspace")).history;
          assert.deepEqual(history.filter((/** @type {any} */ row)=>historyIds.has(row._id)),before.history,"Earlier history remains unchanged");
          assert.ok(history.filter((/** @type {any} */ row)=>!historyIds.has(row._id)).every((/** @type {any} */ row)=>row.requestId===request._id&&row.status===0&&row.error),"TLS failure creates no successful response");
        }
        assert.ok(response);
        assert.equal(tls.state.requests,requests+(allowed?1:0),"Certificate refusal occurs before HTTP dispatch");
        if(allowed){assert.equal(response.status,503);assert.ok(!response.error);}
        else assert.ok(response.error,"Untrusted certificate remains refused");
        assert.equal((await invoke("load_workspace")).settings.validateCertificates,expectedGlobal,"Request setting never changes global preference");
        return response;
      };
      for(const c of cases){
        const url=tls.url+"/"+c.name;
        const request=added.find((/** @type {any} */ r)=>r.url===url);assert.ok(request);
        assert.equal(request.settingValidateCertificates,c.validation);
        await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"GET "+url,exact:true}).click();
        const response=await send(request,c.validation==="off");
        checks.push({kind:"import-option-order-next-and-secure-default",name:c.name,validation:c.validation,statusCode:response.status,error:response.error});
      }
      const request=added.find((/** @type {any} */ r)=>r.url.endsWith("/last-insecure"));assert.ok(request);
      await page.getByRole("tab",{name:"Settings",exact:true}).click();
      const preference=page.getByLabel("TLS certificate validation",{exact:true});
      assert.equal(await preference.inputValue(),"off");
      await preference.selectOption("on");
      await poll(async()=> (await invoke("load_workspace")).resources.find((/** @type {any} */ r)=>r._id===request._id).settingValidateCertificates==="on","Request TLS setting saved");
      await send(request,false);
      await preference.selectOption("global");
      await poll(async()=> (await invoke("load_workspace")).resources.find((/** @type {any} */ r)=>r._id===request._id).settingValidateCertificates==="global","Global inheritance saved");
      await page.reload();
      await page.getByRole("tab",{name:"Settings",exact:true}).click();
      assert.equal(await preference.inputValue(),"global");
      await send(request,true);
      checks.push({kind:"mounted-setting-on-and-inherited-global-reload",globalPreferenceUnchanged:true});
      const strictGlobal=await invoke("load_workspace");strictGlobal.settings.validateCertificates=true;expectedGlobal=true;
      await invoke("save_workspace",{data:strictGlobal});await page.reload();
      await page.getByRole("tab",{name:"Settings",exact:true}).click();
      await preference.selectOption("off");
      await poll(async()=> (await invoke("load_workspace")).resources.find((/** @type {any} */ r)=>r._id===request._id).settingValidateCertificates==="off","Explicit bypass saved under strict global");
      await send(request,true);
      checks.push({kind:"request-insecure-overrides-strict-global",globalPreferenceUnchanged:true});
      const control=Bun.spawn([Bun.which("curl")||"curl.exe","--max-time","15","--noproxy","*","-ks","-o","NUL","-w","%{http_code}",tls.url],{windowsHide:true,stdout:"pipe",stderr:"pipe"});
      const [code,stdout,stderr]=await Promise.all([control.exited,new Response(control.stdout).text(),new Response(control.stderr).text()]);
      assert.equal(code,0,stderr);assert.equal(stdout,"503");
      checks.push({kind:"actual-curl-insecure-control",statusCode:503});
      await Bun.write(output+"/acceptance.json",JSON.stringify({passed:true,checks,requests:tls.state.requests,testedGlobalValidation:[false,true],limits:"Owned untrusted Windows HTTPS fixture; no proxy/provider/other-platform acceptance"},null,2));
    } finally {tls.close();}
  }, ownership);
}, {...ownership,lazyCapture:isolated});
if(identifier===integrationProbeIdentifier)await preserveNativeProfile(run);else await run();
