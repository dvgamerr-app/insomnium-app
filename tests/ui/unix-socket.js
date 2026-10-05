import assert from "node:assert/strict";
import { mkdir, stat, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-unix-socket-ui-probe/build-state.json";
assert.equal(process.platform,"win32","Windows AF_UNIX fixture");
const dir=resolve("artifacts/unix-socket-ui-fixture");
await mkdir(dir,{recursive:true});
const socketPath=join(dir,"ui-"+process.pid+".sock").replaceAll("\\","/");
const exe=join(dir,"fixture-"+process.pid+".exe");
/** @type {Record<string,string|undefined>} */ const env={...process.env,CARGO_HOME:"D:/home/.cargo",RUSTUP_HOME:"D:/home/.rustup"};
const vc="C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023";
const sdk="C:/Program Files (x86)/Windows Kits/10",version="10.0.19041.0";
env.PATH=vc+"/bin/Hostx64/x64;"+sdk+"/bin/"+version+"/x64;D:/home/.cargo/bin;"+process.env.PATH;
env.LIB=vc+"/lib/x64;"+sdk+"/Lib/"+version+"/ucrt/x64;"+sdk+"/Lib/"+version+"/um/x64";
const deps="src-tauri/target/release/deps";
const args=["--edition=2021","-C","panic=abort","-C","lto=yes","--crate-name","unix_ui_fixture","-","-L","dependency="+deps,"-o",exe];
for(const name of ["uds_windows","serde_json"]){
 const files=await Array.fromAsync(new Bun.Glob("lib"+name+"-*.rlib").scan(deps));
 const candidates=await Promise.all(files.map(async f=>({f,t:(await stat(join(deps,f))).mtimeMs})));
 candidates.sort((a,b)=>b.t-a.t);
 assert.ok(candidates.length,"Build native release dependencies first");
 args.push("--extern",name+"="+join(deps,candidates[0].f));
}
const compiler=Bun.spawn(["D:/home/.cargo/bin/rustc.exe",...args],{env,stdin:"pipe",stdout:"pipe",stderr:"pipe"});
compiler.stdin.write("\nuse std::io::{Read,Write};\nuse std::time::Duration;\nfn main(){\n let path=std::env::args().nth(1).unwrap();\n let listener=uds_windows::UnixListener::bind(path).unwrap();\n std::thread::spawn(||{let mut s=String::new();let _=std::io::stdin().read_line(&mut s);std::process::exit(0);});\n println!(\"{}\",serde_json::json!({\"event\":\"ready\"}));\n for socket in listener.incoming(){\n  let mut socket=socket.unwrap();\n  socket.set_read_timeout(Some(Duration::from_secs(15))).unwrap();\n  let mut header=Vec::new();let mut b=[0];\n  while !header.ends_with(b\"\\r\\n\\r\\n\"){socket.read_exact(&mut b).unwrap();header.push(b[0]);assert!(header.len()<65536);}\n  let header=String::from_utf8(header).unwrap();\n  println!(\"{}\",serde_json::json!({\"event\":\"request\",\"header\":header}));\n  if header.starts_with(\"GET /stall \"){\n   let n=socket.read(&mut b).unwrap();\n   println!(\"{}\",serde_json::json!({\"event\":\"closed\",\"eof\":n==0}));\n  }else if header.starts_with(\"GET /sse \"){\n   socket.write_all(b\"HTTP/1.1 200 OK\\r\\nContent-Type: text/event-stream\\r\\nTransfer-Encoding: chunked\\r\\nConnection: close\\r\\n\\r\\n\").unwrap();\n   let data=\": keepalive\\n\\nid: uds-1\\nevent: update\\ndata: สวัสดี\\ndata: second line\\n\\n\".as_bytes();\n   for chunk in data.chunks(2){\n    write!(socket,\"{:X}\\r\\n\",chunk.len()).unwrap();socket.write_all(chunk).unwrap();socket.write_all(b\"\\r\\n\").unwrap();socket.flush().unwrap();\n   }\n   let n=socket.read(&mut b).unwrap();\n   println!(\"{}\",serde_json::json!({\"event\":\"sse_closed\",\"eof\":n==0}));\n  }else if header.starts_with(\"GET /same \"){\n   socket.write_all(b\"HTTP/1.1 302 Found\\r\\nLocation: /finish\\r\\nSet-Cookie: uds_session=fixture; Path=/\\r\\nContent-Length: 0\\r\\nConnection: close\\r\\n\\r\\n\").unwrap();\n  }else if header.starts_with(\"GET /cross \"){\n   socket.write_all(b\"HTTP/1.1 302 Found\\r\\nLocation: http://other.invalid/finish\\r\\nContent-Length: 0\\r\\nConnection: close\\r\\n\\r\\n\").unwrap();\n  }else{\n   socket.write_all(b\"HTTP/1.1 200 OK\\r\\nContent-Type: text/plain\\r\\nContent-Length: 11\\r\\nConnection: close\\r\\n\\r\\nUDS UI PASS\").unwrap();\n  }\n }\n}\n");
compiler.stdin.end();
const compileError=await new Response(compiler.stderr).text();
assert.equal(await compiler.exited,0,compileError);
const fixture=Bun.spawn([exe,socketPath],{stdin:"pipe",stdout:"pipe",stderr:"pipe"});
/** @type {any[]} */ const events=[];
let remainder="";
const drain=(async()=>{const reader=fixture.stdout.getReader();const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;remainder+=decoder.decode(value,{stream:true});let i;while((i=remainder.indexOf("\n"))>=0){const line=remainder.slice(0,i).trim();remainder=remainder.slice(i+1);if(line)events.push(JSON.parse(line));}}})();
const errors=new Response(fixture.stderr).text();
try{
 await poll(async()=>events.some(e=>e.event==="ready"),"AF_UNIX fixture ready");
 // Legacy syntax requires slash-rooted socket path; current drive matches the owned app cwd.
 const legacyPath=socketPath.replace(/^[A-Za-z]:/,"");
 const name="Unix socket "+Date.now();
 const url="http://unix:"+legacyPath+":/uds-only.invalid/ok?q=%2f";
 await withNativeApp("unix-socket",async({page,invoke,output})=>{
  /** @type {any[]} */ const resources=[{_id:"wrk_uds",_type:"workspace",parentId:null,name,scope:"collection"},
   ...[["ok",url],["stall","http://unix:"+legacyPath+":/uds-only.invalid/stall"]].map(([id,url])=>({_id:"req_"+id,_type:"request",parentId:"wrk_uds",name:name+" "+id,method:"GET",url,headers:[],parameters:[],body:{mimeType:""}}))];
  for(const id of ["same","cookie","cross","basic"]) resources.push({_id:"req_"+id,_type:"request",parentId:"wrk_uds",name:name+" "+id,method:"GET",url:"http://unix:"+legacyPath+":/uds-only.invalid/"+id,headers:[],parameters:[],body:{mimeType:""},authentication:id==="basic"?{type:"basic",username:"fixture",password:"local-password"}:{type:"bearer",token:"uds-fixture"}});
  resources.push({_id:"req_sse",_type:"request",parentId:"wrk_uds",name:name+" sse",method:"GET",responseMode:"sse",url:"http://unix:"+legacyPath+":/uds-only.invalid/sse",headers:[{name:"Accept",value:"text/event-stream"}],parameters:[],body:{mimeType:""},authentication:{type:"bearer",token:"uds-fixture"}});
  await page.getByRole("button",{name:"Import collection",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Import collection or cURL commands",{exact:true}).fill(JSON.stringify({resources}));
  await dialog.getByRole("button",{name:"Review import",exact:true}).click();
  await dialog.getByRole("button",{name:"Import",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  const select=(/** @type {string} */ id)=>page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"GET "+name+" "+id,exact:true}).click();
  await page.reload();await select("ok");
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await poll(async()=>events.some(e=>e.event==="request"),"native Unix socket request");
  await poll(async()=>!(await page.getByRole("button",{name:"Cancel",exact:true}).count()),"Send finished");
  assert.match(await page.locator("body").innerText(),/UDS UI PASS/);
  const request=events.find(e=>e.event==="request");
  assert.match(request.header,/^GET \/ok\?q=%2F HTTP\/1\.1\r\n/);
  assert.match(request.header,/host: uds-only.invalid\r\n/i);
  const saved=(await invoke("load_workspace")).resources.find((/** @type {any} */ r)=>r.name===name+" ok");
  assert.equal(saved.url,url);
  await select("stall");await page.getByRole("button",{name:"Send",exact:true}).click();
  await poll(async()=>events.filter(e=>e.event==="request").length===2,"stalled request reached socket");
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await poll(async()=>events.some(e=>e.event==="closed"&&e.eof),"Cancel closes native socket");
  await poll(async()=>!(await page.getByRole("button",{name:"Cancel",exact:true}).count()),"Cancel settled");
  await select("ok");await page.getByRole("button",{name:"Send",exact:true}).click();
  await poll(async()=>events.filter(e=>e.event==="request").length===3,"Send after Cancel");
  await poll(async()=>!(await page.getByRole("button",{name:"Cancel",exact:true}).count()),"second Send finished");
  assert.match(await page.locator("body").innerText(),/UDS UI PASS/);

  const settings=(await invoke("load_workspace")).settings;
  assert.equal(settings.useCookies,true,"Cookie fixture requires cookies enabled");
  assert.equal(settings.followRedirects,true,"Redirect fixture requires redirects enabled");
  /** @type {any[]} */ const routing=[];
  for(const id of ["same","cookie","cross","basic"]){
   await page.reload();await select(id);
   const before=events.filter(e=>e.event==="request").length;
   await page.getByRole("button",{name:"Send",exact:true}).click();
   const expected=(id==="same"||id==="cross")?2:1;
   await poll(async()=>events.filter(e=>e.event==="request").length===before+expected,"auth/cookie redirect wire");
   await poll(async()=>!(await page.getByRole("button",{name:"Cancel",exact:true}).count()),"routing Send settled");
   assert.match(await page.locator("body").innerText(),/UDS UI PASS/);
   const wire=events.filter(e=>e.event==="request").slice(before);
   const header=(/** @type {any} */ e,/** @type {string} */ key)=>e.header.split("\r\n").find((/** @type {string} */ line)=>line.toLowerCase().startsWith(key+":"))?.split(":").slice(1).join(":").trim();
   assert.equal(header(wire[0],"host"),"uds-only.invalid");
   if(id==="same"||id==="cross")assert.equal(header(wire[0],"authorization"),"Bearer uds-fixture");
   if(id==="same"){
    assert.equal(header(wire[1],"host"),"uds-only.invalid");
    assert.equal(header(wire[1],"authorization"),"Bearer uds-fixture");
    assert.equal(header(wire[1],"cookie"),"uds_session=fixture");
    assert.match(wire[1].header,/^GET \/finish HTTP\/1\.1/);
   }
   if(id==="cookie")assert.equal(header(wire[0],"cookie"),"uds_session=fixture");
   if(id==="cross"){
    assert.equal(header(wire[1],"host"),"other.invalid");
    assert.equal(header(wire[1],"authorization"),undefined);
    assert.equal(header(wire[1],"cookie"),undefined);
    assert.match(wire[1].header,/^GET \/finish HTTP\/1\.1/);
   }
   if(id==="basic")assert.equal(header(wire[0],"authorization"),"Basic "+Buffer.from("fixture:local-password").toString("base64"));
   const saved=(await invoke("load_workspace")).resources.find((/** @type {any} */ r)=>r.name===name+" "+id);
   assert.equal(saved.url,"http://unix:"+legacyPath+":/uds-only.invalid/"+id);
   routing.push({id,wire});
  }


  await page.reload();
  await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"SSE "+name+" sse",exact:true}).click();
  await page.getByRole("button",{name:"Connect",exact:true}).click();
  const stream=page.getByRole("region",{name:"Stream response",exact:true});
  const update=stream.locator(".stream-event").filter({hasText:"update"});
  await update.waitFor();await update.click();
  assert.equal(await stream.locator(".stream-event-body").innerText(),"สวัสดี\nsecond line");
  assert.match(await stream.innerText(),/ID: uds-1/);
  assert.equal(await stream.locator(".stream-event").filter({hasText:"keepalive"}).count(),0);
  const sseRequest=events.filter(e=>e.event==="request").at(-1);
  assert.match(sseRequest.header,/^GET \/sse HTTP\/1\.1/);
  assert.match(sseRequest.header,/accept: text\/event-stream\r\n/i);
  assert.match(sseRequest.header,/authorization: Bearer uds-fixture\r\n/i);
  await page.getByRole("button",{name:"Disconnect",exact:true}).click();
  await poll(async()=>events.some(e=>e.event==="sse_closed"&&e.eof),"Disconnect closes SSE socket");
  await poll(async()=>!(await page.getByRole("button",{name:"Disconnect",exact:true}).count()),"SSE disconnected");

  await writeFile(join(output,"acceptance.json"),JSON.stringify({url,events,routing},null,2));
 });
}finally{
 fixture.stdin.write("stop\n");fixture.stdin.end();
 const timer=setTimeout(()=>fixture.kill(),2000);
 const exit=await fixture.exited;clearTimeout(timer);await drain;
 const stderr=await errors;
 await rm(socketPath,{force:true});
 assert.equal(exit,0,stderr);assert.equal(stderr,"");
}
