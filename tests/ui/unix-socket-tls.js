import assert from "node:assert/strict";
import { mkdir, stat, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-unix-socket-ui-probe/build-state.json";
assert.equal(process.platform,"win32","Windows AF_UNIX fixture");
const dir=resolve("artifacts/unix-socket-tls-ui-fixture/38340");
await mkdir(dir,{recursive:true});

const fixtureCommands=[["version"],["req","-x509","-newkey","ec","-pkeyopt","ec_paramgen_curve:P-256","-noenc","-keyout","artifacts/unix-socket-reference/ca.key","-out","artifacts/unix-socket-reference/ca.pem","-days","2","-subj","/CN=Insomnium local UDS fixture CA","-addext","basicConstraints=critical,CA:TRUE"],["req","-new","-newkey","ec","-pkeyopt","ec_paramgen_curve:P-256","-noenc","-keyout","artifacts/unix-socket-reference/server.key","-out","artifacts/unix-socket-reference/server.csr","-subj","/CN=uds-only.invalid"],["x509","-req","-in","artifacts/unix-socket-reference/server.csr","-CA","artifacts/unix-socket-reference/ca.pem","-CAkey","artifacts/unix-socket-reference/ca.key","-CAcreateserial","-out","artifacts/unix-socket-reference/server.pem","-days","2","-extfile","artifacts/unix-socket-reference/server.ext"]];
await Bun.write(join(dir,"server.ext"),"subjectAltName=DNS:uds-only.invalid\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\n");
for(const command of fixtureCommands){const args=command.map((/** @type {string} */ a)=>a.replace("artifacts/unix-socket-reference/",dir.replaceAll("\\","/")+"/"));const r=Bun.spawnSync(["C:/Program Files/Git/usr/bin/openssl.exe",...args]);assert.equal(r.exitCode,0,new TextDecoder().decode(r.stderr));}
for(const [src,dst] of [["server.pem","server.der"],["server.key","server-key.der"]]){const pem=await Bun.file(join(dir,src)).text();await Bun.write(join(dir,dst),Buffer.from(pem.replace(/-----[^\n]+-----/g,"").replace(/\s/g,""),"base64"));}

const socketPath=join(dir,"ui-"+process.pid+".sock").replaceAll("\\","/");
const exe=join(dir,"fixture-"+process.pid+".exe");
/** @type {Record<string,string|undefined>} */ const env={...process.env,CARGO_HOME:"D:/home/.cargo",RUSTUP_HOME:"D:/home/.rustup"};
const vc="C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023";
const sdk="C:/Program Files (x86)/Windows Kits/10",version="10.0.19041.0";
env.PATH=vc+"/bin/Hostx64/x64;"+sdk+"/bin/"+version+"/x64;D:/home/.cargo/bin;"+process.env.PATH;
env.LIB=vc+"/lib/x64;"+sdk+"/Lib/"+version+"/ucrt/x64;"+sdk+"/Lib/"+version+"/um/x64";
const deps="src-tauri/target/release/deps";
const args=["--edition=2021","-C","panic=abort","-C","lto=yes","--crate-name","unix_ui_fixture","-","-L","dependency="+deps,"-o",exe];
for(const name of ["uds_windows","serde_json","rustls"]){
 const files=await Array.fromAsync(new Bun.Glob("lib"+name+"-*.rlib").scan(deps));
 const candidates=await Promise.all(files.map(async f=>({f,t:(await stat(join(deps,f))).mtimeMs})));
 candidates.sort((a,b)=>b.t-a.t);
 assert.ok(candidates.length,"Build native release dependencies first");
 args.push("--extern",name+"="+join(deps,candidates[0].f));
}
const compiler=Bun.spawn(["D:/home/.cargo/bin/rustc.exe",...args],{env,stdin:"pipe",stdout:"pipe",stderr:"pipe"});
compiler.stdin.write("\nuse std::{io::{Read,Write},sync::Arc,time::Duration};\nfn main(){\n rustls::crypto::ring::default_provider().install_default().unwrap();\n let args:Vec<String>=std::env::args().collect();\n let cert=std::fs::read(&args[2]).unwrap();let key=std::fs::read(&args[3]).unwrap();\n let config=Arc::new(rustls::ServerConfig::builder().with_no_client_auth().with_single_cert(vec![rustls::pki_types::CertificateDer::from(cert)],rustls::pki_types::PrivateKeyDer::Pkcs8(key.into())).unwrap());\n let listener=uds_windows::UnixListener::bind(&args[1]).unwrap();\n std::thread::spawn(||{let mut s=String::new();let _=std::io::stdin().read_line(&mut s);std::process::exit(0);});\n println!(\"{}\",serde_json::json!({\"event\":\"ready\"}));\n for socket in listener.incoming(){\n  let socket=socket.unwrap();socket.set_read_timeout(Some(Duration::from_secs(10))).unwrap();\n  let mut stream=rustls::StreamOwned::new(rustls::ServerConnection::new(config.clone()).unwrap(),socket);\n  let mut h=Vec::new();let mut b=[0];let mut rejected=false;\n  while !h.ends_with(b\"\\r\\n\\r\\n\"){\n   match stream.read_exact(&mut b){Ok(())=>h.push(b[0]),Err(e)=>{println!(\"{}\",serde_json::json!({\"event\":\"rejected\",\"detail\":e.to_string(),\"httpBytes\":h.len()}));rejected=true;break;}}\n  }\n  if rejected {continue;}\n  println!(\"{}\",serde_json::json!({\"event\":\"request\",\"header\":String::from_utf8(h).unwrap(),\"sni\":stream.conn.server_name()}));\n  stream.write_all(b\"HTTP/1.1 200 OK\\r\\nContent-Type: text/plain\\r\\nContent-Length: 11\\r\\nConnection: close\\r\\n\\r\\nUDS TLS OK!\").unwrap();stream.flush().unwrap();\n }\n}\n");
compiler.stdin.end();
const compileError=await new Response(compiler.stderr).text();
assert.equal(await compiler.exited,0,compileError);
const fixture=Bun.spawn([exe,socketPath,join(dir,"server.der"),join(dir,"server-key.der")],{stdin:"pipe",stdout:"pipe",stderr:"pipe"});
/** @type {any[]} */ const events=[];
let remainder="";
const drain=(async()=>{const reader=fixture.stdout.getReader();const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;remainder+=decoder.decode(value,{stream:true});let i;while((i=remainder.indexOf("\n"))>=0){const line=remainder.slice(0,i).trim();remainder=remainder.slice(i+1);if(line)events.push(JSON.parse(line));}}})();
const errors=new Response(fixture.stderr).text();
try{
 await poll(async()=>events.some(e=>e.event==="ready"),"AF_UNIX fixture ready");

 const legacyPath=socketPath.replace(/^[A-Za-z]:/,"");
 const name="Unix TLS "+Date.now();
 const goodUrl="https://unix:"+legacyPath+":/uds-only.invalid/tls";
 const badUrl="https://unix:"+legacyPath+":/other.invalid/tls";
 await withNativeApp("unix-socket-tls",async({page,invoke,output})=>{
  const original=(await invoke("load_workspace")).settings;
  const setTls=async(/** @type {string} */ ca,/** @type {boolean} */ validate)=>{
   await page.getByRole("button",{name:"Preferences",exact:true}).first().click();
   const dialog=page.getByRole("region",{name:"Preferences",exact:true});
   await dialog.getByLabel("Validate TLS certificates",{exact:true}).setChecked(validate);
   const input=dialog.getByLabel("Custom CA (PEM)",{exact:true});
   await input.fill(ca);await input.blur();
   await poll(async()=>{const s=(await invoke("load_workspace")).settings;return s.caPem===ca&&s.validateCertificates===validate;},"TLS settings persisted");
   await dialog.getByRole("button",{name:"Close Preferences"}).click();await dialog.waitFor({state:"detached"});
  };
  const resources=[{_id:"wrk_tls",_type:"workspace",parentId:null,name,scope:"collection"},
   ...[["good",goodUrl],["wrong",badUrl]].map(([id,url])=>({_id:"req_"+id,_type:"request",parentId:"wrk_tls",name:name+" "+id,method:"GET",url,headers:[],parameters:[],body:{mimeType:""}}))];
  await page.getByRole("button",{name:"Import collection",exact:true}).click();
  const dialog=page.getByRole("dialog");await dialog.getByLabel("Import collection or cURL commands",{exact:true}).fill(JSON.stringify({resources}));
  await dialog.getByRole("button",{name:"Review import",exact:true}).click();await dialog.getByRole("button",{name:"Import",exact:true}).click();await dialog.waitFor({state:"detached"});
  const ca=await Bun.file(join(dir,"ca.pem")).text();
  /** @type {any[]} */ const cases=[];
  try{
   for(const [id,trusted,valid,success] of [["good",true,true,true],["wrong",true,true,false],["good",false,true,false],["good",false,false,true]]){
    await setTls(trusted?ca:"",Boolean(valid));await page.reload();
    await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"GET "+name+" "+id,exact:true}).click();
    const before=events.length;
    await page.getByRole("button",{name:"Send",exact:true}).click();
    await poll(async()=>events.length>before,"TLS fixture handshake/request");
    await poll(async()=>!(await page.getByRole("button",{name:"Cancel",exact:true}).count()),"TLS Send settled");
    const event=events[before];assert.equal(event.event,success?"request":"rejected");
    const text=await page.locator("body").innerText();
    if(success){assert.match(text,/UDS TLS OK!/);assert.equal(event.sni,"uds-only.invalid");assert.match(event.header,/host: uds-only.invalid\r\n/i);}
    else{assert.equal(event.httpBytes,0);assert.match(text,/error sending request/i);}
    cases.push({id,trusted,validate:valid,success,event});
   }
   const saved=(await invoke("load_workspace")).resources.find((/** @type {any} */ r)=>r.name===name+" good");assert.equal(saved.url,goodUrl);
   await writeFile(join(output,"acceptance.json"),JSON.stringify({cases},null,2));
  }finally{await setTls(original.caPem||"",original.validateCertificates);}
 });

}finally{
 fixture.stdin.write("stop\n");fixture.stdin.end();
 const timer=setTimeout(()=>fixture.kill(),2000);
 const exit=await fixture.exited;clearTimeout(timer);await drain;
 const stderr=await errors;
 await rm(socketPath,{force:true});
 assert.equal(exit,0,stderr);assert.equal(stderr,"");
}
