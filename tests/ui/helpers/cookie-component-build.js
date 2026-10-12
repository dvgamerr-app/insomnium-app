import {resolve} from "node:path";
/** Exact one-consumer alias. No __TAURI_INTERNALS__, IPC, networking or backend.
 * @returns {import('bun').BunPlugin} */
export function cookieComponentAlias(){
  const consumer=resolve("src/lib/components/CookieManager.svelte");
  return {name:"owned-cookie-component-core",setup(build){
    build.onResolve({filter:/^@tauri-apps\/api\/core$/},args=>{
      if(resolve(args.importer)!==consumer)return;
      return {path:resolve("tests/ui/fixtures/cookie-component-transport.js")};
    });
  }};
}
