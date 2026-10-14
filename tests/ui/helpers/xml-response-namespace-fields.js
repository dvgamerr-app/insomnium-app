import assert from "node:assert/strict";import {poll} from "./native-app.js";
/** @param {{page:import("playwright-core").Page,pane:import("playwright-core").Locator,saved:()=>Promise<Record<string,any>>,output:string,requestId:string}} context */
export async function verifyNamespaceNativeFields({page,pane,saved,output,requestId}) {
  const checks = /** @type {Record<string,any>[]} */ ([]);
  const failures = /** @type {Record<string,any>[]} */ ([]);
  const snapshot = async () => {const s=await saved();return {namespaces:JSON.parse(JSON.stringify(s.meta.responseXPathNamespaces??{})),rawResponse:s.response.body,response:s.response,filter:s.meta.responseFilter,filterHistory:s.meta.responseFilterHistory,extra:s.meta.extra};};
  const trigger = pane.getByRole("button", {name:"Namespaces",exact:true});
  const open = async () => {
    await trigger.click();
    const dialog = page.getByRole("dialog", {name:"XPath namespaces",exact:true});
    await dialog.waitFor();
    return dialog;
  };
  const setRows = async (/** @type {{prefix:string,uri:string}[]} */ rows) => {
    const dialog = await open();
    for(let i=await dialog.getByRole("button",{name:/^Remove namespace /}).count();i>0;i--)
      await dialog.getByRole("button",{name:"Remove namespace "+i,exact:true}).click();
    for(let i=0;i<rows.length;i++) {
      await dialog.getByRole("button",{name:"Add namespace",exact:true}).click();
      await dialog.getByLabel("Namespace prefix "+(i+1),{exact:true}).fill(rows[i].prefix);
      await dialog.getByLabel("Namespace URI "+(i+1),{exact:true}).fill(rows[i].uri);
    }
    return dialog;
  };
  const original=await snapshot(),viewport=page.viewportSize(),originalTheme=await page.evaluate(()=>document.documentElement.dataset.theme);
  const saveRows=async (/** @type {{prefix:string,uri:string}[]} */ rows)=>{const dialog=await setRows(rows);await dialog.getByRole("button",{name:"Save namespaces",exact:true}).click();await dialog.waitFor({state:"detached"});const expected=Object.fromEntries(rows.map(r=>[r.prefix.trim(),r.uri.trim()]));await poll(async()=>JSON.stringify(Object.entries((await snapshot()).namespaces).sort())===JSON.stringify(Object.entries(expected).sort()),"Native durable namespace map",60000);};
  await saveRows([{prefix:"n",uri:"urn:one"},{prefix:"m",uri:"urn:two"},{prefix:"p",uri:"urn:three"}]);
  try {for(const theme of ["dark","light"]) for(const width of [1440,900,760,560]) {
    await page.setViewportSize({width,height:600});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const initial=await snapshot();
    let dialog=await open();
    await dialog.locator(".hint").click();
    await page.mouse.move(0,0);
    const metrics=await dialog.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,client:el.clientWidth,
        rows:[...el.querySelectorAll(".namespace-row")].map(row=>({columns:getComputedStyle(row).gridTemplateColumns,gap:getComputedStyle(row).gap})),
        labels:[...el.querySelectorAll("label")].map(label=>({text:label.childNodes[0]?.textContent?.trim(),gap:getComputedStyle(label.parentElement?.classList.contains("ui-field")?label.parentElement:label).gap,font:getComputedStyle(label).font})),
        controls:[...el.querySelectorAll("input,button")].map(c=>{const b=c.getBoundingClientRect(),s=getComputedStyle(c);return {name:c.getAttribute("aria-label")||c.textContent,x:b.x,y:b.y,width:b.width,height:b.height,color:s.color,background:s.backgroundColor,font:s.font};})};
    });
    assert.ok(metrics.left>=0&&metrics.right<=width);
    assert.ok(metrics.scroll<=metrics.client+1);
    for(const label of metrics.labels) assert.equal(label.gap,"6px");
    for(const row of metrics.rows) {
      assert.equal(row.gap,"6px");
      assert.equal(row.columns.split(" ").length,width<=600?1:3);
    }
    checks.push({kind:"geometry",theme,width,metrics});
    await dialog.locator(".namespace-row").nth(0).locator("label").nth(0).click();
    assert.equal(await dialog.getByRole("textbox",{name:"Namespace prefix 1",exact:true}).evaluate(el=>el===document.activeElement),true,"Compact label click focuses exact numbered input");
    await dialog.getByLabel("Namespace URI 1",{exact:true}).fill("urn:cancelled");
    await dialog.press("Escape");
    await dialog.waitFor({state:"detached"});
    assert.deepEqual(await snapshot(),initial);
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    checks.push({kind:"escape-no-save-focus",theme,width});
    for(const [rows,message,target] of [
      [[{prefix:"n",uri:"urn:one"},{prefix:"n",uri:"urn:two"}],"unique","Namespace prefix 2"],
      [[{prefix:"bad:name",uri:"urn:x"}],"without a colon","Namespace prefix 1"],
      [[{prefix:"n",uri:""}],"Namespace URI","Namespace URI 1"],
      [[{prefix:"xml",uri:"urn:x"}],"reserved","Namespace prefix 1"],
    ]) {
      dialog=await setRows(/** @type {{prefix:string,uri:string}[]} */(rows));
      const submit=dialog.getByRole("button",{name:"Save namespaces",exact:true});
      await submit.focus(); await submit.press("Enter");
      await poll(async()=>await dialog.getByRole("alert").filter({hasText:/** @type {string} */(message)}).count()>0,"Authoritative namespace field error");
      assert.deepEqual(await snapshot(),initial);
      const control=dialog.getByRole("textbox",{name:/** @type {string} */(target),exact:true});
      const state=await control.evaluate(el=>({id:el.id,invalid:el.getAttribute("aria-invalid"),describedby:el.getAttribute("aria-describedby"),focus:document.activeElement?.getAttribute("aria-label")||document.activeElement?.textContent}));
      const row=/** @type {Record<string,any>} */ ({kind:"association",theme,width,message,target,state,aria:await control.ariaSnapshot()});
      checks.push(row);
      if(state.invalid!=="true"||!state.describedby) failures.push(row);
      if(state.invalid === "true") {
        assert.ok(state.id);
        assert.equal(state.describedby,state.id+"-error");
        const affected = message === "unique" ? ["Namespace prefix 1","Namespace prefix 2"]
          : message === "reserved" ? ["Namespace prefix 1","Namespace URI 1"] : [target];
        assert.equal(await dialog.getByRole("alert").count(),affected.length,"Only authoritative local field alerts");
        const errorIds=[];row.affected=[];
        for(const name of affected) {
          const field=dialog.getByRole("textbox",{name:/** @type {string} */(name),exact:true});
          const id=await field.getAttribute("id");
          assert.equal(await field.getAttribute("aria-invalid"),"true");
          assert.equal(await field.getAttribute("aria-describedby"),id+"-error");
          errorIds.push(id+"-error");row.affected.push({name,id,invalid:await field.getAttribute("aria-invalid"),describedby:await field.getAttribute("aria-describedby"),text:await dialog.locator('[id="'+id+'-error"]').innerText()});
          assert.ok((await dialog.locator('[id="'+id+'-error"]').innerText()).includes(/** @type {string} */(message)));
        }
        assert.equal(new Set(errorIds).size,affected.length,"Each affected field has a distinct exact error ID");
        if(message === "Namespace URI") {
          await dialog.getByLabel("Namespace prefix 1",{exact:true}).fill("bad:name");
          assert.equal(await control.getAttribute("aria-invalid"),"true","An independently invalid URI survives another field correction");
        }
        const count=await dialog.getByRole("button",{name:/^Remove namespace /}).count();
        for(let i=1;i<=count;i++) {
          await dialog.getByLabel("Namespace prefix "+i,{exact:true}).fill("corrected"+i);
          await dialog.getByLabel("Namespace URI "+i,{exact:true}).fill("urn:corrected:"+i);
        }
        assert.equal(await dialog.getByRole("alert").count(),0,"Corrected fields remove their descriptions");
        assert.equal(await dialog.locator('[aria-invalid="true"]').count(),0);
        assert.equal(await dialog.locator('input[aria-describedby]').count(),0);
        assert.deepEqual(await snapshot(),initial,"Correction alone does not save");
      }
      await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    }
    dialog=await open();
    for(const [index,key] of [[2,"Enter"],[2,"Space"],[1,"Enter"]]) {
      const remove=dialog.getByRole("button",{name:"Remove namespace "+index,exact:true});
      await remove.focus(); await remove.press(/** @type {string} */(key));
      const active=await page.evaluate(()=>({tag:document.activeElement?.tagName,name:document.activeElement?.getAttribute("aria-label")||document.activeElement?.textContent?.trim(),inDialog:!!document.activeElement?.closest("dialog")}));
      const row={kind:"focused-removal",theme,width,index,key,remaining:await dialog.getByRole("button",{name:/^Remove namespace /}).count(),active};
      checks.push(row);
      if(!active.inDialog) failures.push(row);
      if(active.inDialog) assert.equal(active.name,row.remaining?"Remove namespace "+Math.min(Number(index),row.remaining):"Add namespace");
    }
    assert.equal(await dialog.getByRole("button",{name:/^Remove namespace /}).count(),0);
    await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    dialog=await setRows(Array.from({length:32},(_,i)=>({prefix:"n"+i,uri:"urn:"+i})));
    assert.equal(await dialog.getByRole("button",{name:"Add namespace",exact:true}).isDisabled(),true);
    assert.equal(await dialog.getByRole("textbox").count(),64);
    for(let i=1;i<=32;i++) {
      assert.equal(await dialog.getByRole("textbox",{name:"Namespace prefix "+i,exact:true}).count(),1);
      assert.equal(await dialog.getByRole("textbox",{name:"Namespace URI "+i,exact:true}).count(),1);
    }
    checks.push({kind:"32-cap",theme,width,controls:64,names:await dialog.getByRole("textbox").evaluateAll(items=>items.map(el=>el.getAttribute("aria-label")))});
    await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    assert.deepEqual(await snapshot(),initial);
    dialog=await open();const first=await dialog.getByLabel("Namespace prefix 1",{exact:true}).inputValue(),uri="urn:native:"+theme+":"+width;await dialog.getByLabel("Namespace prefix 1",{exact:true}).fill(" "+first+" ");await dialog.getByLabel("Namespace URI 1",{exact:true}).fill(" "+uri+" ");await dialog.getByRole("button",{name:"Save namespaces",exact:true}).press("Enter");await dialog.waitFor({state:"detached"});const expected={...initial.namespaces,[first]:uri};await poll(async()=>{const map=(await snapshot()).namespaces;return Object.entries(expected).every(([k,v])=>map[k]===v);},"Native field map saved",60000);const beforeReload=await snapshot();await page.reload();await trigger.waitFor();const reloaded=await snapshot();assert.deepEqual(reloaded.namespaces,expected);assert.deepEqual(reloaded.response,initial.response);assert.equal(reloaded.filter,initial.filter);assert.deepEqual(reloaded.filterHistory,initial.filterHistory);assert.deepEqual(reloaded.extra,initial.extra);checks.push({kind:"native-save-reload",theme,width,expected,beforeReload,reloaded,viewportMode:"CDP-emulated",physicalWidthClaim:false});
  }}finally{const dialog=page.getByRole("dialog",{name:"XPath namespaces",exact:true});if(await dialog.count())await dialog.getByRole("button",{name:"Cancel",exact:true}).click();await saveRows(Object.entries(original.namespaces).map(([prefix,uri])=>({prefix,uri})));if(viewport)await page.setViewportSize(viewport);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,originalTheme);}
  const restored=await snapshot();assert.deepEqual(restored.namespaces,original.namespaces);assert.deepEqual(restored.response,original.response);await Bun.write(output+"/namespace-native-field-acceptance.json",JSON.stringify({passed:true,native:true,checks,failures,requestId,restored,callbackRefusalNative:false,physicalWidthClaim:false},null,2));assert.deepEqual(failures,[]);
}
