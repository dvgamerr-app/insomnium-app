import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import { cookieComponentAlias } from "./helpers/cookie-component-build.js";
import { ownedCookie } from "./fixtures/cookie-component-transport.js";

process.env.INSOMNIUM_UI_RUN_LABEL ||= String(Date.now());
const legacyPreview=process.env.INSOMNIUM_LEGACY_COOKIE_PREVIEW==='1';
await withComponentFixture("cookie-manager-component", async (page, output) => {
  await page.getByRole("button", {name:"Open owned Cookies", exact:true}).click();
  const dialog = page.getByRole("dialog", {name:"Cookies", exact:true});
  const url = dialog.getByRole("textbox", {name:"Cookie URL", exact:true});
  const raw = dialog.getByRole("textbox", {name:"Set-Cookie value", exact:true});
  const cookie = {...ownedCookie, name:"ipv6", domain:"::1", path:"/api", secure:true, raw:"ipv6=value; Path=/api; Secure"};
  await page.evaluate((cookie) => /** @type {any} */ (window).__cookieComponent.arm({jar:[cookie]}), cookie);
  await url.fill("https://[::1]/api");
  await raw.fill(cookie.raw);
  await dialog.getByRole("button", {name:"Add cookie", exact:true}).click();
  await dialog.locator('button[title="Edit cookie"]').filter({hasText:"ipv6"}).click();
  assert.equal(await url.inputValue(), "https://[::1]/api");
  assert.equal(await url.evaluate((input) => /** @type {HTMLInputElement} */ (input).validity.valid), true);
  await page.evaluate((cookie) => /** @type {any} */ (window).__cookieComponent.arm({jar:[cookie]}), cookie);
  await dialog.getByRole("button", {name:"Save cookie", exact:true}).click();
  await page.waitForFunction(() => /** @type {any} */ (window).__cookieComponent.snapshot().commits === 2);
  const snapshot = await page.evaluate(() => /** @type {any} */ (window).__cookieComponent.snapshot());
  const lastChange = snapshot.calls.filter((/** @type {any} */ call) => call.command === "change_cookie").at(-1);
  assert.equal(lastChange.args.url, "https://[::1]/api");
  assert.deepEqual(lastChange.args.previous, {domain:"::1", path:"/api", name:"ipv6"});
  if(legacyPreview){
    const seed=async(/** @type {string[]} */ names)=>page.evaluate(names=>{
      /** @type {any} */(window).__cookieComponent.setLegacyCookies(names.map(key=>({key,value:'owned',domain:'fixture.example.invalid',path:'/',hostOnly:true})));
    },names);
    await seed(['before','rejected']);
    await dialog.locator('.legacy-cookie-import summary').click();
    await page.evaluate(()=>/** @type {any} */(window).__cookieComponent.arm({report:{imported:1,kept:0,replaced:0,expired:0,issues:[{index:1,message:'owned old rejection'}]}}));
    await dialog.getByRole('button',{name:'Preview restore',exact:true}).click();
    await dialog.getByRole('button',{name:'Restore 1 cookies',exact:true}).waitFor();
    await dialog.getByText(/owned old rejection/).waitFor();
    await seed(['after']);
    await dialog.getByRole('button',{name:'Restore 1 cookies',exact:true}).waitFor({state:'detached'});
    assert.equal(await dialog.getByText(/owned old rejection/).count(),0);
    await page.evaluate(()=>/** @type {any} */(window).__cookieComponent.arm({hold:true,error:'owned stale preview error'}));
    await dialog.getByRole('button',{name:'Preview restore',exact:true}).click();
    await page.waitForFunction(()=>/** @type {any} */(window).__cookieComponent.snapshot().pending);
    await seed(['changed-during-preview']);
    await page.evaluate(()=>/** @type {any} */(window).__cookieComponent.release());
    await page.waitForFunction(()=>!/** @type {any} */(window).__cookieComponent.snapshot().pending);
    assert.equal(await dialog.getByText('owned stale preview error',{exact:true}).count(),0);
  }
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Actual cookie editor with existing controlled transport; no native/network IO",ipv6EditAndSave:true,legacyPreviewOwnership:legacyPreview}, null, 2));
}, {plugins:[cookieComponentAlias({legacyPreview})]});
