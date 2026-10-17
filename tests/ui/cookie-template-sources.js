import assert from 'node:assert/strict';
import {withComponentFixture} from './helpers/component-fixture.js';
import {cookieComponentAlias} from './helpers/cookie-component-build.js';

process.env.INSOMNIUM_UI_RUN_LABEL ||= String(Date.now());
if(process.env.INSOMNIUM_COOKIE_TEMPLATE_NATIVE==='1'){
  const {runCookieTemplateNative}=await import('./helpers/cookie-template-native.js');
  await runCookieTemplateNative();
}else await withComponentFixture('cookie-manager-component',async(page,output)=>{
  await page.evaluate(()=>/** @type {any} */(window).__cookieComponent.enablePersistence());
  await page.getByRole('button',{name:'Open owned Cookies',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Cookies',exact:true});
  await dialog.locator('summary').filter({hasText:'Template cookie sources'}).click();
  const editor=dialog.getByRole('textbox',{name:'Template cookie sources JSON',exact:true});
  const source={key:'{{ name }}',value:'{{ token }}',domain:'{{ host }}',path:'/'};
  const active=async()=>(await page.evaluate(()=>/** @type {any} */(window).__cookieComponent.resources()))
    .filter((/** @type {any} */resource)=>resource._activeTemplateCookieSource===true);
  const save=async(/** @type {any[]} */cookies)=>{
    await editor.fill(JSON.stringify(cookies));
    assert.equal(await dialog.getByRole('button',{name:/^Save \d+ template sources$/}).count(),0);
    await dialog.getByRole('button',{name:'Preview template sources',exact:true}).click();
    await page.evaluate(()=>/** @type {any} */(window).__cookieComponent.arm({jar:[]}));
    await dialog.getByRole('button',{name:`Save ${cookies.length} template sources`,exact:true}).click();
    await page.waitForFunction(count=>/** @type {any} */(window).__cookieComponent.resources()
      .filter((/** @type {any} */resource)=>resource._activeTemplateCookieSource===true)
      .flatMap((/** @type {any} */resource)=>resource.cookies).length===count,cookies.length);
    await dialog.getByRole('status').filter({hasText:'Template cookie sources saved.'}).waitFor();
  };
  await save([source]);
  assert.equal((await active())[0].cookies[0].value,'{{ token }}');
  await save([{...source,value:'{{ replacement }}'}]);
  assert.equal((await active())[0].cookies[0].value,'{{ replacement }}');
  await dialog.getByRole('button',{name:'Clear all…',exact:true}).click();
  await page.evaluate(()=>/** @type {any} */(window).__cookieComponent.arm({jar:[]}));
  await dialog.getByRole('button',{name:'Confirm clear',exact:true}).click();
  await page.waitForFunction(()=>!/** @type {any} */(window).__cookieComponent.resources()
    .some((/** @type {any} */resource)=>resource._activeTemplateCookieSource===true));
  assert.deepEqual(await active(),[]);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Open owned Cookies',exact:true}).click();
  assert.equal(await dialog.locator('summary').filter({hasText:'Template cookie sources (0 active)'}).count(),1);
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,
    scope:'Mounted source preview/save/edit and Clear all with controlled native mutation and actual preview persistence; no native/network claim'},null,2));
},{plugins:[cookieComponentAlias({templates:true})]});
