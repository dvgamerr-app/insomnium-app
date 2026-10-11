import assert from "node:assert/strict";

export const pluginAppInfoSource = `let ownedOldApp;
exports.templateTags.push({name:'ownedappinfo',run(c){
  const first=c.app.getInfo();first.version='guest-edit';
  const info=c.app.getInfo(),path=c.app.getPath('DeSkTop');
  let unknownPath;try{c.app.getPath('home');}catch(error){unknownPath=error.message;}
  ownedOldApp=c.app;
  return JSON.stringify({info,path,synchronous:!(info instanceof Promise)&&!(path instanceof Promise),
    frozen:Object.isFrozen(c.app)&&Object.isFrozen(c.app.clipboard),unknownPath});
}},{name:'ownedappstale',run(){try{return ownedOldApp.getInfo();}catch(error){return error.message;}}});`;

/** @param {{invoke:import('./native-app.js').NativeInvoke,output:string,body:(text:string)=>Promise<void>,send:(expected:string|null)=>Promise<void>,wire:any[]}} context */
export async function exercisePluginAppInfoNative({invoke,output,body,send,wire}) {
  const expected={info:{version:await invoke("plugin:app|version"),platform:await invoke("read_template_os",{function:"platform"})},
    path:await invoke("plugin:path|resolve_directory",{directory:18,path:null}),synchronous:true,frozen:true,unknownPath:"Unknown path name home"};
  assert.equal(typeof expected.path,"string");assert.ok(expected.path.length);
  await body("{% ownedappinfo %}");
  await send(JSON.stringify(expected));
  const actual=JSON.parse(wire.at(-1).body);assert.deepEqual(actual,expected);
  await body("{% ownedappstale %}");
  await send("Plugin app helper is no longer current");
  const checks=["Native c.app getInfo/getPath return synchronous detached values through actual owned renderer/worker/IPC",
    "Native current c.app and clipboard facade are frozen; unknown path denied before native operation",
    "Retained c.app from a previous native callback rejects after callback generation changes"];
  const evidence={status:"passed",checks,actual,staleError:wire.at(-1).body,clipboardTouched:false,
    limits:"Native app information/path and stale callback only; actual clipboard formats/dialog DOM/provider/concurrency remain required."};
  await Bun.write(output+"/app-info-acceptance.json",JSON.stringify(evidence,null,2));
  return evidence;
}
