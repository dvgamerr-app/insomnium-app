import assert from "node:assert/strict";
import {withComponentFixture} from "./component-fixture.js";
import {cookieComponentAlias} from "./cookie-component-build.js";
import {ownedCookie,ownedWorkspaceId} from "../fixtures/cookie-component-transport.js";
import normalGeometry from "../fixtures/cookie-normal-geometry.json";
const schemeMessage="Cookie URL must use HTTP or HTTPS";
const limitMessage="Cookie exceeds the 8 KiB editor limit";
/** @param {import('playwright-core').Page} page @param {string} action @param {any} [value] */
async function control(page,action,value){return page.evaluate(({action,value})=>{
  const fixture=/** @type {any} */(window).__cookieComponent;
  if(!fixture||!["arm","reset","release","pause","resume"].includes(action))throw Error("Unowned cookie fixture action");
  return fixture[action](value);
},{action,value});}
/** Controlled CookieManager boundary. The shim never parses cookies or URLs. */
export async function runCookieComponent(){
  await withComponentFixture("cookie-manager-component",async(page,output)=>{
    const pageErrors=/** @type {string[]} */([]);page.on("pageerror",error=>pageErrors.push(String(error)));
    const failures=/** @type {Record<string,any>[]} */([]),profiles=/** @type {Record<string,any>[]} */([]);
    const dialog=page.getByRole("dialog",{name:"Cookies",exact:true});
    const url=()=>dialog.getByRole("textbox",{name:"Cookie URL",exact:true});
    const raw=()=>dialog.getByRole("textbox",{name:"Set-Cookie value",exact:true});
    async function submit(){const button=dialog.getByRole("button",{name:/^(Save|Add) cookie$/});await button.focus();await button.press("Enter");}
    const snapshot=async()=>JSON.parse(/** @type {string} */(await page.locator("output[data-cookie-probe]").getAttribute("data-cookie-probe")));
    const changes=(/** @type {any} */state)=>state.calls.filter((/** @type {any} */call)=>call.command==="change_cookie");
    async function open(){
      if(await dialog.count())await page.keyboard.press("Escape");
      await control(page,"reset");await page.getByRole("button",{name:"Open owned Cookies",exact:true}).click();
      await dialog.getByRole("button",{name:"Add cookie",exact:true}).waitFor();
      await page.waitForFunction(()=>!document.querySelector('dialog input[type="url"]')?.hasAttribute("disabled"));
    }
    const geometry=()=>dialog.evaluate(el=>{
      const box=(/** @type {Element} */node)=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,fontWeight:s.fontWeight,color:s.color,background:s.backgroundColor};};
      return {dialog:box(el),fields:[...el.querySelectorAll(".cookie-form .ui-field")].map(field=>{
        const input=/** @type {HTMLInputElement|HTMLTextAreaElement} */(field.querySelector("input,textarea"));
        const caption=field.tagName==="LABEL"?field:/** @type {Element} */(field.querySelector("label"));
        const textNodes=[...caption.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent?.trim());
        const captionGlyphRects=textNodes.map(node=>{const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
        return {field:box(field),control:box(input),caption:box(caption),captionGlyphRects,captionText:textNodes.map(node=>node.textContent).join("").trim(),gap:getComputedStyle(field).gap,id:input.id,invalid:input.getAttribute("aria-invalid"),description:input.getAttribute("aria-describedby")};
      })};
    });
    const bigRaw="owned="+"é".repeat(4094);
    assert.ok(Buffer.byteLength(bigRaw,"utf8")>8192&&bigRaw.length<8192,"Owned raw UTF8 bytes are distinct from JS string length");
    for(const theme of ["dark","light"])for(const width of [1440,900,760]){
      await page.setViewportSize({width,height:600});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await open();const valid=await geometry();
      const baseline=normalGeometry.find(p=>p.theme===theme&&p.width===width);
      assert.ok(baseline);
      assert.deepEqual(valid.dialog,baseline.dialog,"Normal entire dialog geometry/fonts/colors/background remain exact");
      for(let i=0;i<2;i++){
        assert.deepEqual(valid.fields[i].control,baseline.fields[i].control,"Normal control entire geometry/font/color/background remains exact");
        assert.deepEqual(valid.fields[i].field,baseline.fields[i].field,"Normal entire field geometry and style remains exact");
        assert.equal(valid.fields[i].gap,baseline.fields[i].gap);
        assert.equal(valid.fields[i].captionText,baseline.fields[i].captionText);
        assert.equal(valid.fields[i].caption.color,baseline.fields[i].captionColor);
        assert.equal(valid.fields[i].caption.background,baseline.fields[i].captionBackground);
        assert.equal(valid.fields[i].caption.fontWeight,"500","Approved existing explicit caption weight is the only normal visual change");
        assert.deepEqual(valid.fields[i].captionGlyphRects.map(r=>({x:r.x,y:r.y,height:r.height})),baseline.fields[i].captionGlyphRects.map(r=>({x:r.x,y:r.y,height:r.height})),"Caption glyph position/height unchanged; approved weight may change glyph width");
      }
      assert.equal(valid.fields.length,2);assert.notEqual(valid.fields[0].id,valid.fields[1].id);
      assert.ok(valid.dialog.x>=0&&valid.dialog.x+valid.dialog.width<=width);
      await url().fill("not-a-url");await raw().fill(ownedCookie.raw);
      const malformed=await url().evaluate(el=>({valid:/** @type {HTMLInputElement} */(el).validity.valid,typeMismatch:/** @type {HTMLInputElement} */(el).validity.typeMismatch}));
      assert.equal(malformed.typeMismatch,true);await submit();
      assert.equal(changes(await snapshot()).length,0,"Actual native HTML URL validation refuses malformed URL before callback");
      assert.equal(await url().evaluate(el=>el===document.activeElement),true);
      const cases=[];
      for(const spec of [
        {name:"scheme",url:"ftp://fixture.example.invalid/",raw:ownedCookie.raw,message:schemeMessage,field:0},
        {name:"utf8-limit",url:"https://fixture.example.invalid/",raw:bigRaw,message:limitMessage,field:1},
        {name:"combined-invalid",url:"ftp://fixture.example.invalid/",raw:bigRaw,message:limitMessage,field:1},
      ]){
        await open();await dialog.locator('button[title="Edit cookie"]').click();
        await url().fill(spec.url);await raw().fill(spec.raw);
        const nativeValidity=await url().evaluate(el=>({valid:/** @type {HTMLInputElement} */(el).validity.valid,typeMismatch:/** @type {HTMLInputElement} */(el).validity.typeMismatch}));
        assert.equal(nativeValidity.valid,true,"Scheme reaches controlled handler via actual HTML validity, not synthetic submit");
        const before=await snapshot();await control(page,"arm",{error:spec.message});await url().press("Enter");
        const inputEnterCalls=changes(await snapshot()).length-changes(before).length;
        if(inputEnterCalls===0)await submit();
        await Bun.write(output+"/cookie-progress.json",JSON.stringify({theme,width,case:spec.name,pageErrors,events:await page.locator("output[data-cookie-events]").getAttribute("data-cookie-events"),snapshot:await snapshot(),dom:await dialog.evaluate(el=>({buttons:[...el.querySelectorAll("button")].map(button=>({text:button.textContent,type:button.type,disabled:button.disabled,inForm:!!button.form})),forms:[...el.querySelectorAll("form")].map(form=>({valid:form.checkValidity(),html:form.outerHTML})),active:document.activeElement?.outerHTML}))},null,2));
        await dialog.getByRole("alert").filter({hasText:spec.message}).waitFor();
        const refused=await snapshot();assert.deepEqual(refused.jar,before.jar);assert.equal(refused.commits,before.commits);
        const submitted=changes(refused).at(-1)?.args;
        assert.deepEqual(submitted,{workspaceId:ownedWorkspaceId,url:spec.url,raw:spec.raw,previous:{domain:ownedCookie.domain,path:ownedCookie.path,name:ownedCookie.name},clear:false});
        const invalid=await geometry();
        const errorFeedback=await dialog.getByRole("alert").filter({hasText:spec.message}).evaluate(el=>{
          const rect=(/** @type {Element} */node)=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
          const ancestors=[];for(let parent=el.parentElement;parent;parent=parent.parentElement){const s=getComputedStyle(parent);if([s.overflowX,s.overflowY].some(v=>["auto","scroll","hidden","clip"].includes(v)))ancestors.push({tag:parent.tagName,class:parent.className,rect:rect(parent),overflowX:s.overflowX,overflowY:s.overflowY,scrollTop:parent.scrollTop,clientHeight:parent.clientHeight});}
          return {rect:rect(el),scroll:el.scrollWidth,client:el.clientWidth,font:getComputedStyle(el).font,color:getComputedStyle(el).color,ancestors};
        });
        assert.equal(errorFeedback.scroll,errorFeedback.client,"Refusal text has no horizontal overflow");
        assert.ok(errorFeedback.rect.bottom<=600);
        for(const ancestor of errorFeedback.ancestors)assert.ok(errorFeedback.rect.x>=ancestor.rect.x&&errorFeedback.rect.right<=ancestor.rect.right&&errorFeedback.rect.y>=ancestor.rect.y&&errorFeedback.rect.bottom<=ancestor.rect.bottom,"Local feedback fits existing scrollable clipping ancestor");
        await page.screenshot({path:output+`/${theme}-${width}-${spec.name}.png`});
        assert.equal(await url().count(),1);assert.equal(await raw().count(),1,"Exact names survive refused state");
        const field=invalid.fields[spec.field],other=invalid.fields[1-spec.field];
        if(field.invalid!=="true"||field.description!==field.id+"-error")failures.push({kind:"closed-cookie-error-unassociated",theme,width,case:spec.name,field});
        assert.equal(await dialog.getByRole("alert").count(),1,"No duplicate global alert for a local refusal");
        assert.equal(other.invalid,null,"Unrelated field is not marked by current refusal");
        if(spec.field===0)await url().fill("mailto:fixture@example.invalid");
        else await raw().fill(bigRaw+"x");
        assert.equal(await (spec.field===0?url():raw()).getAttribute("aria-invalid"),"true","Uncorrected authoritative condition keeps its own error");
        const corrected=spec.field===0?url():raw();await corrected.fill(spec.field===0?"https://fixture.example.invalid/":"owned=corrected; Path=/");
        const correctionAlert=await dialog.getByRole("alert").filter({hasText:spec.message}).count();
        if(correctionAlert)failures.push({kind:"closed-cookie-error-persists-after-correction",theme,width,case:spec.name});
        assert.deepEqual((await snapshot()).jar,before.jar,"Typing correction never changes jar");
        // Explicit successful outcome after fully valid correction; no parser implemented.
        await url().fill("https://fixture.example.invalid/");await raw().fill("owned=corrected; Path=/");
        const canned={...ownedCookie,raw:"owned=corrected; Path=/"};await control(page,"arm",{jar:[canned]});
        await dialog.getByRole("button",{name:"Save cookie",exact:true}).click();
        await dialog.getByRole("status").filter({hasText:"Cookies saved."}).waitFor();
        assert.equal(await dialog.getByRole("alert").count(),0);assert.equal(await url().inputValue(),"");assert.equal(await raw().inputValue(),"");
        assert.deepEqual((await snapshot()).jar,[canned]);assert.equal((await snapshot()).commits,1);
        cases.push({name:spec.name,controlledOutcome:true,nativeValidity,inputEnterCalls,submitted,invalid,errorFeedback,correctionAlert,corrected:await geometry()});
      }
      // A separate operation failure remains global when correcting a field-local error.
      await open();await dialog.locator('button[title="Edit cookie"]').click();
      await url().fill("https://fixture.example.invalid/");await raw().fill(bigRaw);
      await control(page,"arm",{error:limitMessage});await url().press("Enter");
      await dialog.getByRole("alert").filter({hasText:limitMessage}).waitFor();
      await control(page,"arm",{error:"Owned cookie disk failure"});await dialog.getByRole("button",{name:"Delete cookie owned",exact:true}).click();
      await dialog.getByRole("alert").filter({hasText:"Owned cookie disk failure"}).waitFor();
      assert.equal(await dialog.getByRole("alert").count(),2);
      await raw().fill(ownedCookie.raw);
      assert.equal(await dialog.getByRole("alert").count(),1);
      assert.equal(await dialog.getByRole("alert").filter({hasText:"Owned cookie disk failure"}).count(),1,"Local correction preserves unrelated global operation feedback");
      assert.equal(await raw().getAttribute("aria-invalid"),null);assert.equal((await snapshot()).commits,0);
      await control(page,"arm",{error:schemeMessage});await dialog.getByRole("button",{name:"Delete cookie owned",exact:true}).click();
      await dialog.getByRole("alert").filter({hasText:schemeMessage}).waitFor();
      assert.equal(await url().getAttribute("aria-invalid"),null,"Known message from non-form operation stays global");
      assert.equal(await raw().getAttribute("aria-invalid"),null);
      const globalCases=[];
      for(const message of ["Invalid cookie: owned header refusal","Owned cookie disk failure"]){
        await open();await url().fill("https://fixture.example.invalid/");await raw().fill(ownedCookie.raw);
        const before=await snapshot();await control(page,"arm",{error:message});await submit();
        await dialog.getByRole("alert").filter({hasText:message}).waitFor();
        assert.equal(await url().getAttribute("aria-invalid"),null);assert.equal(await raw().getAttribute("aria-invalid"),null);
        assert.deepEqual((await snapshot()).jar,before.jar);assert.equal((await snapshot()).commits,0);
        globalCases.push({message,state:await geometry()});
      }
      await open();await url().fill("ftp://fixture.example.invalid/");await raw().fill(ownedCookie.raw);
      await control(page,"arm",{error:schemeMessage,hold:true});await submit();
      await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-cookie-probe]')?.getAttribute("data-cookie-probe")||"{}").pending);
      assert.equal(await url().isDisabled(),true);assert.equal(await raw().isDisabled(),true);
      assert.equal(await dialog.getByRole("button",{name:"Saving…",exact:true}).isDisabled(),true);
      const busy=await geometry();await control(page,"release");await dialog.getByRole("alert").filter({hasText:schemeMessage}).waitFor();
      assert.equal(await url().isDisabled(),false);
      await page.keyboard.press("Escape");assert.equal(await dialog.count(),0);
      assert.equal(await page.getByRole("button",{name:"Open owned Cookies",exact:true}).evaluate(el=>el===document.activeElement),true);
      await open();assert.equal(await url().inputValue(),"");assert.equal(await raw().inputValue(),"");assert.equal(await dialog.getByRole("alert").count(),0);
      // New cookie creates a new form owner even while the old request is held.
      await dialog.locator('button[title="Edit cookie"]').click();await url().fill("ftp://fixture.example.invalid/");
      await control(page,"arm",{error:schemeMessage,hold:true});await url().press("Enter");
      await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-cookie-probe]')?.getAttribute("data-cookie-probe")||"{}").pending);
      await dialog.getByRole("button",{name:"New cookie",exact:true}).click();await control(page,"release");
      await page.waitForFunction(()=>!JSON.parse(document.querySelector('output[data-cookie-probe]')?.getAttribute("data-cookie-probe")||"{}").pending);
      assert.equal(await dialog.getByRole("alert").count(),0,"Old form refusal cannot annotate reset New cookie form");
      assert.equal(await url().inputValue(),"");assert.equal(await raw().inputValue(),"");
      // Actual component disposal still suppresses late refusal after Escape.
      await url().fill("ftp://fixture.example.invalid/");await raw().fill(ownedCookie.raw);
      await control(page,"arm",{error:schemeMessage,hold:true});await url().press("Enter");
      await page.waitForFunction(()=>JSON.parse(document.querySelector('output[data-cookie-probe]')?.getAttribute("data-cookie-probe")||"{}").pending);
      await page.keyboard.press("Escape");await control(page,"release");
      await page.waitForFunction(()=>!JSON.parse(document.querySelector('output[data-cookie-probe]')?.getAttribute("data-cookie-probe")||"{}").pending);
      assert.equal((await snapshot()).commits,0);await open();assert.equal(await dialog.getByRole("alert").count(),0);
      // Public actual work admission remains global and prevents any stand-in call.
      await url().fill("https://fixture.example.invalid/");await raw().fill(ownedCookie.raw);await control(page,"pause");
      await page.waitForFunction(()=>document.querySelector('output[data-cookie-probe]')?.getAttribute("data-cookie-phase")==="paused");
      const beforeAdmission=await snapshot();await submit();
      await dialog.getByRole("alert").filter({hasText:"Workspace operations are stopping."}).waitFor();
      assert.deepEqual(await snapshot(),beforeAdmission);assert.equal(await url().getAttribute("aria-invalid"),null);assert.equal(await raw().getAttribute("aria-invalid"),null);
      await control(page,"resume");await page.waitForFunction(()=>document.querySelector('output[data-cookie-probe]')?.getAttribute("data-cookie-phase")==="idle");
      await page.screenshot({path:output+`/${theme}-${width}.png`});
      profiles.push({theme,width,valid,malformed,cases,globalCases,busy,admissionNoInvoke:true,escapeFocus:true,reopenReset:true,normalGeometryExact:true,globalFeedbackPreserved:true,newOwnerLateRefusalSuppressed:true,disposeLateRefusalSuppressed:true});
      await page.keyboard.press("Escape");
    }
    await Bun.write(output+"/cookie-measurements.json",JSON.stringify({native:false,controlledComponent:true,combinedPrecedence:"preset captured Rust-order outcome; not execution of Rust validation",profiles,failures},null,2));
    assert.deepEqual(failures,[],"Closed cookie errors associate with their field and clear on correction");
  },{plugins:[cookieComponentAlias()]});
}
