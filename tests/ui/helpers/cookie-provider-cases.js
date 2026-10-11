import assert from "node:assert/strict";
import {join} from "node:path";

/** Native HTTP cookie policy on the existing scenario-owned collection/files.
 * @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string,workspaceId:string,target:string}} context */
export async function assertCookieProviderCases({page,invoke,output,workspaceId,target}) {
  const wire = /** @type {{path:string,cookie:string|null}[]} */ ([]);
  const server = Bun.serve({hostname:"127.0.0.1",port:0,fetch(request) {
    const path = new URL(request.url).pathname;
    wire.push({path,cookie:request.headers.get("cookie")});
    const headers = new Headers();
    if(path==="/receive") headers.append("Set-Cookie","response=received; Path=/; HttpOnly");
    if(path==="/ignore") headers.append("Set-Cookie","ignored=not-stored; Path=/");
    if(path==="/disabled") headers.append("Set-Cookie","disabled=not-stored; Path=/");
    if(path==="/redirect/transient") {
      headers.append("Set-Cookie","transient=hop; Path=/child");
      headers.set("Location","/child/redirect-end");
      return new Response(null,{status:302,headers});
    }
    return new Response("owned-cookie-provider",{headers});
  }});
  const base="http://127.0.0.1:"+server.port;
  const rows = /** @type {any[]} */ ([]);
  const snapshot = async (includeExpired=false) => invoke("snapshot_request_cookies",{workspaceId,includeExpired});
  const change = async (/** @type {any} */ args) => invoke("change_cookie",{workspaceId,url:base+"/child/seed",raw:null,previous:null,clear:false,...args});
  const keys = (/** @type {any} */ jar) => jar.cookies.map((/** @type {any} */ c)=>c.key).sort();
  const pairs = (/** @type {string|null} */ header) => header ? header.split(";").map(p=>p.trim()).sort() : [];
  const request = (/** @type {string} */ path,/** @type {any} */ options={}) => ({id:"owned-cookie-"+crypto.randomUUID(),workspaceId,
      method:"GET",url:base+path,headers:[],timeoutMs:15000,followRedirects:true,validateCertificates:true,
      useCookies:true,sendCookies:true,storeCookies:false,...options});
  const send = async (/** @type {string} */ path,/** @type {any} */ options={}) => {
    const response=await invoke("send_http",{request:request(path,options)});
    assert.equal(response.status,200);
    assert.equal(Buffer.from(response.bodyBase64,"base64").toString(),"owned-cookie-provider");
    await Bun.write(join(output,"cookie-provider-wire.json"),JSON.stringify(wire,null,2));
  };
  const record = async (/** @type {string} */ name) => {
    const model=await snapshot(true),normal=await snapshot();
    const persisted=JSON.parse(await Bun.file(target).text());
    rows.push({name,model,normal,persisted,wireCount:wire.length});
    await Bun.write(join(output,"cookie-provider-observations.json"),JSON.stringify({workspaceId,rows,wire},null,2));
    return {model,normal,persisted};
  };
  try {
    await change({clear:true});
    for(const raw of ["root=live-root; Path=/; HttpOnly","child=live-child; Path=/child",
      "secure=secret; Path=/; Secure","dead=gone; Path=/; Max-Age=1"])
      await change({raw});
    await change({url:"http://example.test/",raw:"foreign=other; Path=/"});
    const deadline=Date.now()+5000;
    while(keys(await snapshot()).includes("dead")) {assert.ok(Date.now()<deadline,"Native expiry must settle");await Bun.sleep(50);}
    const seeded=await record("seed-expired-model");
    assert.deepEqual(keys(seeded.model),["child","dead","foreign","root","secure"]);
    assert.deepEqual(keys(seeded.normal),["child","foreign","root","secure"]);
    assert.equal(seeded.persisted.length,5);

    for(const [path,expected] of /** @type {[string,string[]][]} */ ([
      ["/child/a",["child=live-child","root=live-root"]],
      ["/childish",["root=live-root"]], ["/",["root=live-root"]],
    ])) {await send(path);assert.deepEqual(pairs(wire.at(-1)?.cookie??null),[...expected,"secure=secret"].sort());}
    await send("/child/snapshot",{cookieSnapshot:await snapshot(true)});
    assert.deepEqual(pairs(wire.at(-1)?.cookie??null),["child=live-child","root=live-root","secure=secret"]);
    await record("scope-expiry-secure-loopback-and-model-snapshot-filter");

    await send("/receive",{sendCookies:false,storeCookies:true});
    assert.equal(wire.at(-1)?.cookie,null);
    const received=await record("send-off-store-on-response-write");
    assert.equal(received.persisted.length,6);assert.ok(keys(received.model).includes("dead"));
    assert.ok(keys(received.model).includes("response"));
    await send("/ignore",{storeCookies:false});
    assert.deepEqual(pairs(wire.at(-1)?.cookie??null),["response=received","root=live-root","secure=secret"]);
    assert.ok(!keys((await record("store-off")).model).includes("ignored"));
    const beforeDisabled=await Bun.file(target).text();
    await send("/disabled",{useCookies:false,sendCookies:true,storeCookies:true});
    assert.equal(wire.at(-1)?.cookie,null);
    assert.equal(await Bun.file(target).text(),beforeDisabled);
    assert.ok(!keys((await record("cookies-disabled")).model).includes("disabled"));

    const start=wire.length;
    await send("/redirect/transient",{storeCookies:false});
    assert.equal(wire.length,start+2);
    assert.deepEqual(pairs(wire[start].cookie),["response=received","root=live-root","secure=secret"]);
    assert.deepEqual(pairs(wire[start+1].cookie),["child=live-child","response=received","root=live-root","secure=secret","transient=hop"]);
    assert.ok(!keys((await record("redirect-local-cookie-without-persistence")).model).includes("transient"));
    await send("/explicit",{headers:[["Cookie","manual=owned"]]});
    assert.deepEqual(pairs(wire.at(-1)?.cookie??null),["manual=owned"]);
    await record("explicit-cookie-header");

    const stale=await snapshot(),beforeReject=wire.length;
    await change({raw:"root=replaced; Path=/; HttpOnly",previous:{domain:"127.0.0.1",path:"/",name:"root"}});
    const staleFailure=await page.evaluate(async(request)=>{
      try {await /** @type {any} */ (window).__TAURI_INTERNALS__.invoke("send_http",{request});return {ok:true,error:null};}
      catch(error){return {ok:false,error};}
    },request("/stale",{cookieSnapshot:stale}));
    await Bun.write(join(output,"cookie-provider-stale.json"),JSON.stringify(staleFailure,null,2));
    assert.equal(staleFailure.ok,false);
    assert.match(JSON.stringify(staleFailure.error),/Cookie jar changed while preparing/);
    assert.equal(wire.length,beforeReject);
    await send("/replacement");
    assert.deepEqual(pairs(wire.at(-1)?.cookie??null),["response=received","root=replaced","secure=secret"]);
    await record("replace-and-stale-generation-refusal");
    await change({previous:{domain:"127.0.0.1",path:"/",name:"dead"}});
    const deleted=await record("delete-expired-entry");
    assert.ok(!keys(deleted.model).includes("dead"));assert.equal(deleted.persisted.length,5);
    await change({clear:true});
    const cleared=await record("clear-all");
    assert.deepEqual(cleared.model.cookies,[]);assert.deepEqual(cleared.normal.cookies,[]);assert.deepEqual(cleared.persisted,[]);
    await send("/cleared");assert.equal(wire.at(-1)?.cookie,null);
    await record("clear-wire");
    await Bun.write(join(output,"cookie-provider-result.json"),JSON.stringify({status:"passed",workspaceId,rows,wire,
      limits:"Owned loopback HTTP is treated as secure by cookie_store. Non-loopback insecure exclusion, HTTPS transmission, domain suffix on real subdomains, equal-path ordering, concurrent/provider/proxy/platform cases remain required."},null,2));
  } finally {server.stop(true);}
}
