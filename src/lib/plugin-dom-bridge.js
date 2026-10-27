import {get} from "svelte/store";
import {createPluginDomDialogEndpoint,closePluginDomDialog,pluginDomDialog} from "./plugin-dom-dialog.js";
import {validatePluginDomCall,pluginEventHandlerTypes} from "./plugin-guest-dom.js";

let nodeSequence=0;
let eventSequence=0;
let fileSequence=0;
let transferSequence=0;
// Native identity survives listener callbacks/redispatch without retaining Events.
const nativeEventIds=new WeakMap(/** @type {[Event,number][]} */([]));
const tags=new Set("div span button input textarea label select option p ul ol li pre code strong em small section article header footer h1 h2 h3 table thead tbody tr td th br hr".split(" "));
const strings=new Set("textContent nodeValue value className id type placeholder title name".split(" "));
const booleans=new Set(["checked","disabled","multiple","draggable"]),numbers=new Set(["tabIndex"]);
const reads=new Set([...strings,...booleans,...numbers,"tagName","nodeType","nodeName","isConnected","childElementCount"]);
const relations=new Set("parentNode parentElement firstChild lastChild nextSibling previousSibling firstElementChild lastElementChild".split(" "));
const styles=new Set("color backgroundColor padding display fontSize fontWeight width height margin border borderRadius gap flexDirection alignItems justifyContent".split(" "));
const allowedAttribute=(/** @type {string} */ key)=>key.toLowerCase().startsWith('data-') || /^(aria-[a-z-]+|id|class|type|value|name|title|placeholder|disabled|checked|multiple|draggable|role|tabindex)$/i.test(key);
const cssProperties=new Set([...styles].map(key=>key.replace(/[A-Z]/g,value=>'-'+value.toLowerCase())));

/** Actual DOM graph with an explicit trusted owner and retained guest functions.
 * No app-document/window capability or host executable HTML is exposed.
 * @param {{purpose:'preview'|'send'|'action',signal:AbortSignal,current:()=>boolean,onError:(error:unknown)=>void,onClosed?:()=>void}} owner */
export function createPluginDomBridge(owner) {
  owner=Object.freeze({...owner});
  const endpoint=createPluginDomDialogEndpoint(owner);
  owner.signal.throwIfAborted();if(!owner.current())throw Error("Plugin DOM owner changed");
  const nodes=new Map(/** @type {[number,Node][]} */([])),ids=new WeakMap(/** @type {[Node,number][]} */([]));
  const callbacks=new Map(/** @type {[number,import('./plugin-session.js').PluginDomCallback][]} */([]));
  const syntheticTokens=new WeakMap();
  const retainedEvents=new Map();
  const eventFinalizer=new FinalizationRegistry(({id,reference})=>{if(retainedEvents.get(id)===reference)retainedEvents.delete(id);});
  const rememberEvent=(/** @type {number} */ id,/** @type {Event} */ event)=>{if(retainedEvents.get(id)?.deref()===event)return;const reference=new WeakRef(event);retainedEvents.set(id,reference);eventFinalizer.register(event,{id,reference});};
  const events=new Map(/** @type {[number,Event][]} */([]));
  const inputRangeEvents=new Map(/** @type {[number,InputEvent][]} */([]));
  const files=new Map(),fileIds=new WeakMap(),fileLists=new Map(),fileListIds=new WeakMap(),fileReads=new Set();
  const objectURLs=new Set(),objectURLListeners=new Set(/** @type {((urls:string[])=>void)[]} */([]));
  const transfers=new Map(),transferIds=new WeakMap(),transferTypeIds=new WeakMap(),transferItems=new Map(),stringReads=new Map(),guestFiles=new Map();
  const describeTransfer=(/** @type {DataTransfer|null} */value,/** @type {Event} */event)=>{
    if(value===null)return null;let id=transferIds.get(value);
    if(!id){if(transfers.size>=2048)throw Error('Plugin DataTransfer handle limit exceeded');id=++transferSequence;transferIds.set(value,id);transfers.set(id,{value,persistent:!event.isTrusted||event instanceof InputEvent,event:new WeakRef(event)});}
    else if(!transfers.get(id).persistent&&event.isTrusted)transfers.get(id).event=new WeakRef(event);
    return id;
  };
  const describeItem=(/** @type {DataTransferItem|null} */item,/** @type {number} */transfer)=>{
    if(!item)return null;if(transferItems.size>=2048)throw Error('Plugin DataTransferItem handle limit exceeded');const id=++transferSequence;transferItems.set(id,{item,transfer});return {id,kind:item.kind,type:item.type};
  };
  const decodeParts=(/** @type {any[]} */values)=>{
    if(!Array.isArray(values)||values.length>2048)throw Error('Invalid owned Blob parts');const parts=[];
    for(const part of values){
      if(part&&Object.keys(part).join(',')==='bytes'&&part.bytes instanceof ArrayBuffer){chargeBytes(part.bytes.byteLength);parts.push(part.bytes);}
      else if(part&&Object.keys(part).sort().join(',')==='id,offset,size'&&Number.isSafeInteger(part.id)&&files.has(part.id)&&Number.isSafeInteger(part.offset)&&part.offset>=0&&Number.isSafeInteger(part.size)&&part.size>=0&&part.offset<=files.get(part.id).size&&part.size<=files.get(part.id).size-part.offset)parts.push(files.get(part.id).slice(part.offset,part.offset+part.size));
      else throw Error('Invalid owned File export part');
    }
    return parts;
  };
  const decodeFile=(/** @type {any} */packet)=>{
    if(packet&&Object.keys(packet).join(',')==='reference'){if(!Number.isSafeInteger(packet.reference)||!files.has(packet.reference))throw Error('Unknown owned File export reference');return files.get(packet.reference);}
    if(!packet||Object.keys(packet).sort().join(',')!=='lastModified,name,parts,token,type'||!Number.isSafeInteger(packet.token)||packet.token<=0||typeof packet.name!=='string'||typeof packet.type!=='string'||!Number.isFinite(packet.lastModified)||!Array.isArray(packet.parts)||packet.parts.length>2048)throw Error('Invalid owned File export');
    if(!guestFiles.has(packet.token)&&guestFiles.size>=2048)throw Error('Plugin File export limit exceeded');
    charge(packet.name+packet.type);const parts=decodeParts(packet.parts);
    if(guestFiles.has(packet.token))return guestFiles.get(packet.token);
    const file=new File(parts,packet.name,{type:packet.type,lastModified:packet.lastModified});guestFiles.set(packet.token,file);return file;
  };
  const describeFile=(/** @type {File|null} */file)=>{
    if(file===null)return null;
    let id=fileIds.get(file);if(!id){if(files.size+fileLists.size>=2048)throw Error('Plugin File handle limit exceeded');id=++fileSequence;fileIds.set(file,id);files.set(id,file);}
    return {id,name:file.name,size:file.size,type:file.type,lastModified:file.lastModified,relativePath:file.webkitRelativePath};
  };
  const describeFileList=(/** @type {FileList|null} */list)=>{
    if(list===null)return null;let id=fileListIds.get(list);if(!id){if(files.size+fileLists.size>=2048)throw Error('Plugin File handle limit exceeded');id=++fileSequence;fileListIds.set(list,id);fileLists.set(id,list);}
    return {id,files:Array.from(list,describeFile)};
  };
  const propertyHandlers=new Map();
  const listeners=/** @type {{node:Node,type:string,id:number,capture:boolean,listener:EventListener}[]} */([]);
  let disposed=false,closing=false;
  let hideDone=Promise.resolve();
  /** @type {Promise<void>|undefined} */let disposal;
  let textBytes=0;
  /** @param {number} bytes */
  const chargeBytes=bytes=>{
    const total=textBytes+bytes;
    if(total>8*1024*1024)throw Error("Plugin DOM text limit exceeded");
    textBytes=total;
  };
  /** Conservative cumulative write budget also bounds orphaned data retained by IDs.
   * @param {string} value */
  const charge=value=>chargeBytes(new TextEncoder().encode(value).byteLength);
  const check=()=>{owner.signal.throwIfAborted();if(disposed || closing || !owner.current())throw Error("Plugin DOM owner changed");};
  const node=(/** @type {number} */ id)=>{const value=nodes.get(id);if(!value)throw Error("Unknown owned DOM node");return value;};
  /** @param {Node|null} value @param {boolean} [admit] */
  const describe=(value,admit=false)=>{
    if(value===null)return null;
    let id=ids.get(value);
    if(!id) {
      if(!admit)return null;
      if(nodes.size>=2048)throw Error("Plugin DOM node limit exceeded");
      id=++nodeSequence;ids.set(value,id);nodes.set(id,value);
    }
    return {id,nodeType:value.nodeType};
  };
  const decodeRanges=(/** @type {any} */ranges)=>{
    if(!Array.isArray(ranges))throw Error('Invalid owned synthetic InputEvent target ranges');
    for(const range of ranges)if(!(range&&typeof range==='object'&&!Array.isArray(range)&&Object.keys(range).sort().join(',')==='endContainer,endOffset,startContainer,startOffset'&&['startContainer','endContainer'].every(key=>Number.isSafeInteger(range[key])&&range[key]>0)&&['startOffset','endOffset'].every(key=>Number.isInteger(range[key])&&range[key]>=0&&range[key]<=0xffffffff)))throw Error('Invalid owned synthetic InputEvent target ranges');
    return ranges.map(range=>new StaticRange({...range,startContainer:node(range.startContainer),endContainer:node(range.endContainer)}));
  };
  const describeRanges=(/** @type {InputEvent} */event)=>InputEvent.prototype.getTargetRanges.call(event).map(range=>{
    if(!ids.has(range.startContainer)||!ids.has(range.endContainer))throw Error('InputEvent target ranges require owned Nodes');
    return {startContainer:describe(range.startContainer),startOffset:range.startOffset,endContainer:describe(range.endContainer),endOffset:range.endOffset};
  });
  /** Reserve the complete copy before allocating it, including attributes and
   * dirty input/textarea values which clone even without child nodes.
   * @param {Node} source @param {boolean} deep */
  const cloneOwned=(source,deep)=>{
    const pending=[source];let count=0,bytes=0;
    const account=(/** @type {string} */ value)=>{
      bytes+=new TextEncoder().encode(value).byteLength;
      if(textBytes+bytes>8*1024*1024)throw Error('Plugin DOM text limit exceeded');
    };
    while(pending.length){
      const value=pending.pop();if(!value)continue;
      if(nodes.size+(++count)>2048)throw Error('Plugin DOM node limit exceeded');
      if(value.nodeValue!==null)account(value.nodeValue);
      if(value instanceof Element)for(const attribute of Array.from(value.attributes))account(attribute.name+attribute.value);
      if(value instanceof HTMLInputElement||value instanceof HTMLTextAreaElement)account(value.value);
      if(deep)pending.push(...Array.from(value.childNodes));
    }
    chargeBytes(bytes);
    const copy=source.cloneNode(deep),copies=[copy];
    while(copies.length){const value=copies.pop();if(!value)continue;describe(value,true);copies.push(...Array.from(value.childNodes));}
    return copy;
  };
  /** Parse in the template contents' inert owner document, validate the entire
   * result, then admit it. No parsed node reaches active UI before validation.
   * @param {string} context @param {string} markup */
  const parseMarkup=(context,markup)=>{
    const bytes=new TextEncoder().encode(markup).byteLength;
    if(textBytes+bytes>8*1024*1024)throw Error('Plugin DOM text limit exceeded');
    let tokens=0;for(const character of markup)if(character==='<'&&++tokens>8192)throw Error('Plugin DOM markup parse limit exceeded');
    const template=document.createElement('template');
    const holder=template.content.ownerDocument.createElement(context);
    if(holder.ownerDocument.defaultView)throw Error('Unexpected active markup document');
    holder.innerHTML=markup;
    const pending=Array.from(holder.childNodes),admitted=/** @type {Node[]} */([]);
    while(pending.length){
      const value=pending.pop();if(!value)continue;
      if(nodes.size+admitted.length>=2048)throw Error('Plugin DOM node limit exceeded');
      if(value.nodeType===1){
        const element=/** @type {HTMLElement} */(value);
        if(element.namespaceURI!=='http://www.w3.org/1999/xhtml'||!tags.has(element.localName))throw Error('Unsupported DOM markup element');
        for(const attribute of Array.from(element.attributes)){
          if(attribute.name==='style'){
            if(/url\s*\(|@import|expression\s*\(/i.test(attribute.value))throw Error('Unsupported DOM style value');
            for(const declaration of attribute.value.split(';').filter(value=>value.trim())){
              const colon=declaration.indexOf(':'),name=declaration.slice(0,colon).trim().toLowerCase();
              if(colon<0||!cssProperties.has(name)||!element.style.getPropertyValue(name))throw Error('Unsupported DOM markup style');
            }
          }else if(!allowedAttribute(attribute.name))throw Error('Unsupported DOM markup attribute');
        }
      }else if(![3,8].includes(value.nodeType))throw Error('Unsupported DOM markup node');
      admitted.push(value);pending.push(...Array.from(value.childNodes));
    }
    const serialized=holder.innerHTML;
    charge(new TextEncoder().encode(serialized).byteLength>bytes?serialized:markup);
    for(const value of admitted)describe(value,true);
    const fragment=holder.ownerDocument.createDocumentFragment();
    while(holder.firstChild)fragment.appendChild(holder.firstChild);
    return fragment;
  };
  const callback=(/** @type {number} */ id)=>{const value=callbacks.get(id);if(!value)throw Error("Unknown owned DOM callback");return value;};
  const report=(/** @type {unknown} */ error)=>{if(!disposed&&!owner.signal.aborted)owner.onError(error);};
  const dispose=()=>{
    if(disposal)return disposal;
    closing=true;const releasedURLs=[...objectURLs];for(const url of releasedURLs)URL.revokeObjectURL(url);objectURLs.clear();for(const listener of objectURLListeners)listener(releasedURLs);objectURLListeners.clear();clearInterval(timer);owner.signal.removeEventListener("abort",dispose);
    for(const row of listeners)row.node.removeEventListener(row.type,row.listener,row.capture);
    for(const row of propertyHandlers.values())row.node['on'+row.type]=null;propertyHandlers.clear();
    const active=get(pluginDomDialog);
    if(active && ids.has(active.body))closePluginDomDialog(active.id);
    disposal=hideDone.finally(async()=>{
      await Promise.allSettled([...fileReads]);
      disposed=true;
      for(const value of callbacks.values())value.release();
      callbacks.clear();nodes.clear();retainedEvents.clear();inputRangeEvents.clear();files.clear();fileLists.clear();transfers.clear();transferItems.clear();stringReads.clear();guestFiles.clear();listeners.length=0;textBytes=0;
    });
    return disposal;
  };
  const timer=setInterval(()=>{try{check();}catch{dispose();}},100);
  owner.signal.addEventListener("abort",dispose,{once:true});
  const result=Object.freeze({
    dispose,
    objectURLs:Object.freeze({
      release(/** @type {string} */url){if(!objectURLs.delete(url))return false;URL.revokeObjectURL(url);return true;},
      subscribe(/** @type {(urls:string[])=>void} */listener){check();objectURLListeners.add(listener);return ()=>objectURLListeners.delete(listener);},
    }),
    hasDialog(){const active=get(pluginDomDialog);return !!active&&ids.has(active.body);},
    domCallbacks:Object.freeze({retain(/** @type {import('./plugin-session.js').PluginDomCallback} */ value,/** @type {number} */ id){check();callbacks.set(id,value);}}),
    /** @param {{method:string,args:any[]}} operation */
    call(operation,cleanup=false) {
      if(cleanup){if(disposed)throw Error("Plugin DOM cleanup already finished");}
      else check();
      const {method,args}=validatePluginDomCall(operation);
      if(method==='dom.url.create'){
        const packet=args[0];if(cleanup||closing||args.length!==1||!packet||Object.keys(packet).sort().join(',')!=='parts,type'||typeof packet.type!=='string')throw Error('Invalid owned Blob URL');
        if(objectURLs.size>=2048)throw Error('Plugin object URL handle limit exceeded');charge(packet.type);const blob=new Blob(decodeParts(packet.parts),{type:packet.type}),url=URL.createObjectURL(blob);objectURLs.add(url);return {url};
      }
      if(method==='dom.transfer.string.read'){
        if(cleanup||closing||args.length!==1||!Number.isSafeInteger(args[0])||!stringReads.has(args[0]))throw Error('Unknown owned DataTransfer string read');
        const ticket=stringReads.get(args[0]);stringReads.delete(args[0]);return ticket;
      }
      if(method==='dom.transfer'){
        if(cleanup||closing)throw Error('Owned DataTransfer handles have retired');
        const [id,action,values]=args;if(args.length!==3||!Array.isArray(values))throw Error('Invalid owned DataTransfer operation');
        if(action==='create'){
          if(id!==null||values.length!==1||!Array.isArray(values[0])||values[0].length+transferItems.size>2048||transfers.size>=2048)throw Error('Invalid owned DataTransfer creation');
          const value=new DataTransfer();
          for(const row of values[0]){if(row&&row.kind==='string'&&Object.keys(row).sort().join(',')==='kind,text,type'&&typeof row.type==='string'&&typeof row.text==='string'){charge(row.text+row.type);value.items.add(row.text,row.type);}else if(row&&row.kind==='file'&&Object.keys(row).sort().join(',')==='file,kind')value.items.add(decodeFile(row.file));else throw Error('Invalid owned DataTransfer item');}
          const transfer=++transferSequence;transfers.set(transfer,{value,persistent:true});transferIds.set(value,transfer);
          return {id:transfer,items:Array.from(value.items,item=>({item:describeItem(item,transfer),file:item.kind==='file'?describeFile(item.getAsFile()):null})),files:describeFileList(value.files)};
        }
        if(!Number.isSafeInteger(id)||!transfers.has(id))throw Error('Unknown owned DataTransfer');
        const state=transfers.get(id),value=state.value;
        try{
          if(action==='count'&&values.length===0)return value.items.length;
          if(action==='types'&&values.length===0){const types=value.types;if(!transferTypeIds.has(types))transferTypeIds.set(types,++transferSequence);return {id:transferTypeIds.get(types),types:Array.from(types)};}
          if(action==='files'&&values.length===0)return describeFileList(value.files);
          if(action==='item'&&values.length===1&&Number.isInteger(values[0])&&values[0]>=0&&values[0]<=0xffffffff)return describeItem(value.items[values[0]]??null,id);
          if(action==='get'&&values.length===1&&['dropEffect','effectAllowed'].includes(values[0]))return value[values[0]];
          if(action==='set'&&values.length===2&&['dropEffect','effectAllowed'].includes(values[0])&&typeof values[1]==='string'){value[values[0]]=values[1];return undefined;}
          if(action==='getData'&&values.length===1&&typeof values[0]==='string')return value.getData(values[0]);
          if(action==='setData'&&values.length===2&&values.every(part=>typeof part==='string')){
            const format=values[0].replace(/[A-Z]/g,c=>c.toLowerCase()),type=format==='text'?'text/plain':format==='url'?'text/uri-list':format;
            if(value.items.length>=2048&&!Array.from(value.items).some((/** @type {DataTransferItem} */item)=>item.kind==='string'&&item.type===type))throw Error('Plugin DataTransfer item limit exceeded');
            charge(values.join(''));value.setData(values[0],values[1]);return undefined;
          }
          if(action==='clearData'&&values.length<=1&&values.every(part=>typeof part==='string')){value.clearData(...values);return undefined;}
          if(action==='clear'&&values.length===0){value.items.clear();return undefined;}
          if(action==='remove'&&values.length===1&&Number.isInteger(values[0])&&values[0]>=0&&values[0]<=0xffffffff){value.items.remove(values[0]);return undefined;}
          if(action==='addString'&&values.length===2&&values.every(part=>typeof part==='string')){if(transferItems.size>=2048||value.items.length>=2048)throw Error('Plugin DataTransferItem handle limit exceeded');charge(values.join(''));return {item:describeItem(value.items.add(values[0],values[1]),id),file:null};}
          if(action==='addFile'&&values.length===1){if(transferItems.size>=2048||value.items.length>=2048)throw Error('Plugin DataTransferItem handle limit exceeded');const file=decodeFile(values[0]);if(!fileIds.has(file)&&files.size+fileLists.size>=2048)throw Error('Plugin File handle limit exceeded');const item=value.items.add(file);return {item:describeItem(item,id),file:item?describeFile(file):null};}
          if(action==='image'&&values.length===3&&Number.isSafeInteger(values[0])&&values.slice(1).every(position=>Number.isInteger(position)&&position>=-2147483648&&position<=2147483647)){const element=node(values[0]);if(!(element instanceof Element))throw Error('An owned drag image Element is required');value.setDragImage(element,values[1],values[2]);return undefined;}
          if(['itemKind','itemType','itemFile','itemString'].includes(action)&&values.length===1&&Number.isSafeInteger(values[0])){
            const owned=transferItems.get(values[0]);if(!owned||owned.transfer!==id)throw Error('Unknown owned DataTransferItem');const item=owned.item;
            if(action==='itemKind')return item.kind;if(action==='itemType')return item.type;if(action==='itemFile'){const file=item.getAsFile();return file?describeFile(file):null;}
            const event=state.event?.deref();if(item.kind!=='string'||!state.persistent&&(!event||event.eventPhase===0||event.isTrusted&&event instanceof DragEvent&&!['dragstart','drop'].includes(event.type)))return null;
            if(stringReads.size>=64||fileReads.size>=64)throw Error('Plugin DataTransfer string read limit exceeded');const ticket=++transferSequence;
            const read=new Promise((resolve,reject)=>item.getAsString((/** @type {string} */text)=>{try{check();resolve({text});}catch(error){reject(error);}}));stringReads.set(ticket,read);fileReads.add(read);read.then(()=>fileReads.delete(read),()=>fileReads.delete(read));return ticket;
          }
        }catch(error){if(error instanceof DOMException)return {error:{name:error.name,message:error.message}};throw error;}
        throw Error('Invalid owned DataTransfer member');
      }
      if(method==='dom.file.read'||method==='dom.file.read-sync'){
        if(cleanup||closing)throw Error('Owned File reads have retired');
        const [id,offset,length]=args,file=files.get(id);
        if(args.length!==3||!Number.isSafeInteger(id)||id<=0||!file||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(length)||length<0||length>65536||offset>file.size||length>file.size-offset)throw Error('Invalid owned File read');
        if(method==='dom.file.read-sync')return file.slice(offset,offset+length);
        if(fileReads.size>=64)throw Error('Plugin File read limit exceeded');
        const read=(async()=>{try{const bytes=await file.slice(offset,offset+length).arrayBuffer();check();if(bytes.byteLength!==length)throw new DOMException('The File changed during reading','NotReadableError');return {bytes};}catch(error){check();if(error instanceof DOMException)return {error:{name:error.name,message:error.message}};throw error;}})();
        fileReads.add(read);read.then(()=>fileReads.delete(read),()=>fileReads.delete(read));return read;
      }
      if(method==='dom.files'){
        if(cleanup||closing)throw Error('Owned File handles have retired');
        const [action,id,value]=args;if(args.length!==3||!Number.isSafeInteger(id)||id<=0)throw Error('Invalid owned FileList operation');
        if(action==='read'){if(value!==null||!fileLists.has(id))throw Error('Unknown owned FileList');return describeFileList(fileLists.get(id));}
        const input=node(id);if(!(input instanceof HTMLInputElement))throw Error('An owned file input is required');
        if(action==='get'&&value===null)return describeFileList(input.files);
        if(action==='set'&&(value===null||Number.isSafeInteger(value)&&fileLists.has(value))){input.files=value===null?null:fileLists.get(value);return undefined;}
        throw Error('Invalid owned FileList operation');
      }
      if(method==='dom.ranges'){
        const [action,value]=args;if(args.length!==2)throw Error('Invalid owned InputEvent ranges operation');
        if(action==='create'){
          if(cleanup||closing)throw Error('Owned InputEvent ranges have retired');
          if(inputRangeEvents.size>=2048)throw Error('Plugin InputEvent range limit exceeded');
          const ranges=decodeRanges(value);charge(JSON.stringify(value));
          try{const event=new InputEvent('',{targetRanges:ranges}),id=++eventSequence;inputRangeEvents.set(id,event);return {id};}
          catch(error){if(error instanceof DOMException)return {error:{name:error.name,message:error.message}};throw error;}
        }
        if(!Number.isSafeInteger(value)||value<=0)throw Error('Invalid owned InputEvent range handle');
        const event=action==='read'?inputRangeEvents.get(value):action==='event'?retainedEvents.get(value)?.deref():null;
        if(action==='event'&&!event)return [];
        if(!(event instanceof InputEvent))throw Error('Unknown owned InputEvent range handle');
        return describeRanges(event);
      }
      if(method==='dom.event-late'){
        if(cleanup||closing)throw Error('Owned native Event has retired');
        const [id,control]=args,event=retainedEvents.get(id)?.deref();
        if(!Number.isSafeInteger(id)||(control==='unloadReturnValue'?args.length!==3||typeof args[2]!=='string':args.length!==2||!['preventDefault','stopPropagation','stopImmediatePropagation'].includes(control)))throw Error('Invalid late owned Event control');
        if(!event)return undefined;
        if(event.eventPhase!==0||event.target&&!ids.has(event.target))throw Error('Late Event does not belong to this idle owned graph');
        if(control==='unloadReturnValue'){if(!(event instanceof BeforeUnloadEvent))throw Error('Invalid owned BeforeUnloadEvent control');charge(args[2]);event.returnValue=args[2];return event.returnValue;}
        event[control]();return event.defaultPrevented;
      }
      if(method==='dom.event'){
        const [id,control]=args,event=events.get(id);
        if(!event||(control==='unloadReturnValue'?args.length!==3||typeof args[2]!=='string':args.length!==2||!['preventDefault','stopPropagation','stopImmediatePropagation'].includes(control)))throw Error('Unknown or retired owned DOM event');
        if(control==='unloadReturnValue'){if(!(event instanceof BeforeUnloadEvent))throw Error('Invalid owned BeforeUnloadEvent control');charge(args[2]);event.returnValue=args[2];return event.returnValue;}
        /** @type {any} */(event)[control]();return event.defaultPrevented;
      }
      if(cleanup && (closing || owner.signal.aborted || !owner.current()) && !["dom.get","dom.set","dom.node","dom.attribute","dom.style","dom.query","dom.collection","dom.tokens","dom.dataset"].includes(method))throw Error("Plugin DOM cleanup cannot create UI or callbacks");
      if(method==="dom.create") {
        if(args.length!==2 || typeof args[1]!=="string")throw Error("Invalid DOM creation");
        if(args[0]==="fragment"&&args[1]==="")return describe(document.createDocumentFragment(),true);
        if(args[0]==="text"){charge(args[1]);return describe(document.createTextNode(args[1]),true);}
        if(args[0]==="comment"){charge(args[1]);return describe(document.createComment(args[1]),true);}
        if(args[0]!=="element" || !tags.has(args[1].toLowerCase()))throw Error("Unsupported DOM element");
        return describe(document.createElement(args[1]),true);
      }
      if(method==="dom.dialog") {
        if(args.length!==3 || typeof args[0]!=="string" || !args[2] || typeof args[2]!=="object")throw Error("Invalid DOM dialog");
        const body=node(args[1]);if(!(body instanceof HTMLElement))throw Error("Dialog requires an HTML element");
        const {onHide,...flags}=args[2];const hidden=onHide===null?undefined:callback(onHide);
        endpoint.dialog(args[0],body,{...flags,onHide:()=>{
          callbacks.delete(onHide);
          hideDone=hidden?(hidden.invokeOnHide?hidden.invokeOnHide(operation=>result.call(operation,true)):hidden.invoke()).catch(error=>owner.onError(error)).finally(()=>{hidden.release();}):Promise.resolve();
          void hideDone.finally(()=>owner.onClosed?.());
        }});
        if(owner.purpose==="preview" && hidden){callbacks.delete(onHide);hidden.release();}
        return undefined;
      }
      const target=/** @type {any} */(node(args[0]));
      if(method==='dom.dataset'){
        if(args.length!==3||!(target instanceof HTMLElement)||!Array.isArray(args[2]))throw Error('Invalid DOM dataset call');
        const [_,action,values]=args;
        if(action==='read'&&values.length===0)return Object.entries(target.dataset);
        if(action==='delete'&&values.length===1&&typeof values[0]==='string'){delete target.dataset[values[0]];return undefined;}
        if(action!=='set'||values.length!==2||values.some(value=>typeof value!=='string'))throw Error('Unsupported DOM dataset action');
        charge(values[0]+values[1]);
        try{target.dataset[values[0]]=values[1];return undefined;}
        catch(error){if(error instanceof DOMException)return {exception:{name:error.name,message:error.message}};throw error;}
      }
      if(method==='dom.tokens'){
        if(args.length!==3||!(target instanceof Element)||!Array.isArray(args[2])||args[2].length>4096)throw Error('Invalid DOM token call');
        const [_,action,values]=args,list=target.classList;
        if(['read','value'].includes(action)&&values.length===0)return action==='read'?Array.from(list):list.value;
        if(action==='set'&&values.length===1&&typeof values[0]==='string'){charge(values[0]);list.value=values[0];return undefined;}
        const valid=(['add','remove'].includes(action)&&values.every(value=>typeof value==='string'))||
          action==='contains'&&values.length===1&&typeof values[0]==='string'||
          action==='replace'&&values.length===2&&values.every(value=>typeof value==='string')||
          action==='toggle'&&(values.length===1||values.length===2)&&typeof values[0]==='string'&&(values.length===1||typeof values[1]==='boolean');
        if(!valid)throw Error('Unsupported DOM token action');
        if(action!=='contains')charge(list.value+' '+values.filter(value=>typeof value==='string').join(' '));
        return /** @type {any} */(list)[action](...values);
      }
      if(method==='dom.collection'){
        if(args.length!==3)throw Error('Invalid DOM collection');
        const [_,kind,filter]=args;
        if(!['children','childNodes','tag','class'].includes(kind)||(['tag','class'].includes(kind)?typeof filter!=='string':filter!==null))throw Error('Invalid DOM collection filter');
        if(kind!=='childNodes'&&!(target instanceof Element) && !(kind==='children'&&target instanceof DocumentFragment))throw Error('Element collection requires an owned parent');
        const values=kind==='tag'?target.getElementsByTagName(filter):kind==='class'?target.getElementsByClassName(filter):target[kind];
        return Array.from(values).map(value=>{
          const descriptor=describe(/** @type {Node} */(value),true);
          return kind==='childNodes'?descriptor:{...descriptor,elementId:/** @type {Element} */(value).id,name:/** @type {Element} */(value).getAttribute('name')||''};
        });
      }
      if(method==="dom.get") {
        if(args.length!==2)throw Error("Invalid DOM read");
        const key=args[1];
        if(['innerHTML','outerHTML'].includes(key)&&target instanceof Element){const value=key==='innerHTML'?target.innerHTML:target.outerHTML;if(new TextEncoder().encode(value).byteLength>8*1024*1024)throw Error('Plugin DOM markup read limit exceeded');return value;}
        if(reads.has(key))return target[key];
        if(relations.has(key))return describe(target[key],!["parentNode","parentElement","nextSibling","previousSibling"].includes(key));
        if(key==="children" || key==="childNodes")return Array.from(target[key]||[]).map(value=>describe(/** @type {Node} */(value),true));
        throw Error("Unsupported DOM property");
      }
      if(method==="dom.set") {
        if(args.length!==3)throw Error("Invalid DOM write");
        const [_,key,value]=args;
        if(!(strings.has(key)&&typeof value==="string" || booleans.has(key)&&typeof value==="boolean" || numbers.has(key)&&Number.isFinite(value)))throw Error("Unsupported DOM property value");
        if(key==='textContent'&&(target instanceof Element||target instanceof DocumentFragment)){
          if(value&&nodes.size>=2048)throw Error('Plugin DOM node limit exceeded');
          charge(value);
          const text=value?target.ownerDocument.createTextNode(value):null;
          if(text)describe(text,true);
          target.replaceChildren(...(text?[text]:[]));return undefined;
        }
        if(typeof value==="string")charge(value);
        target[key]=value;return undefined;
      }
      if(method==='dom.dispatch'){
        if(cleanup||closing)throw Error('Plugin DOM cleanup cannot dispatch events');
        if(args.length!==2||!args[1]||typeof args[1]!=='object')throw Error('Invalid owned synthetic Event');
        const packet=args[1],constructors=/** @type {Record<string,any>} */ ({DragEvent,Event,UIEvent,MouseEvent,KeyboardEvent,PointerEvent,WheelEvent,FocusEvent,InputEvent,CompositionEvent,TextEvent,AnimationEvent,TransitionEvent,DeviceOrientationEvent,DeviceMotionEvent,BeforeUnloadEvent,CloseEvent,ProgressEvent,HashChangeEvent,ErrorEvent,MessageEvent,StorageEvent,SubmitEvent,CustomEvent});
        if(!Number.isSafeInteger(packet.syntheticId)||packet.syntheticId<=0||typeof packet.type!=='string'||packet.type.length>1024||!Object.hasOwn(constructors,packet.interface)||!['bubbles','cancelable','composed','defaultPrevented','stopped','immediate','viewOwned'].every(key=>typeof packet[key]==='boolean'))throw Error('Invalid owned synthetic Event');
        if(['AnimationEvent','TransitionEvent'].includes(packet.interface)&&(typeof packet[packet.interface==='AnimationEvent'?'animationName':'propertyName']!=='string'||typeof packet.pseudoElement!=='string'||typeof packet.elapsedTime!=='number'||!Number.isFinite(packet.elapsedTime)))throw Error('Invalid owned synthetic '+packet.interface);
        const nullableFinite=(/** @type {any} */ value)=>value===null||typeof value==='number'&&Number.isFinite(value);
        if(packet.interface==='DeviceOrientationEvent'&&(typeof packet.absolute!=='boolean'||!['alpha','beta','gamma'].every(key=>nullableFinite(packet[key]))))throw Error('Invalid owned synthetic DeviceOrientationEvent');
        if(packet.interface==='DeviceMotionEvent'){
          const vector=(/** @type {any} */ value,/** @type {string[]} */ keys)=>value===null||value&&typeof value==='object'&&!Array.isArray(value)&&keys.every(key=>Object.hasOwn(value,key)&&nullableFinite(value[key]))&&Object.keys(value).length===keys.length;
          if(typeof packet.interval!=='number'||!Number.isFinite(packet.interval)||!vector(packet.acceleration,['x','y','z'])||!vector(packet.accelerationIncludingGravity,['x','y','z'])||!vector(packet.rotationRate,['alpha','beta','gamma']))throw Error('Invalid owned synthetic DeviceMotionEvent');
        }
        if(packet.interface==='BeforeUnloadEvent'&&typeof packet.unloadReturnValue!=='string')throw Error('Invalid owned synthetic BeforeUnloadEvent');
        if(packet.interface==='CloseEvent'&&(typeof packet.wasClean!=='boolean'||typeof packet.reason!=='string'||!Number.isInteger(packet.code)||packet.code<0||packet.code>65535))throw Error('Invalid owned synthetic CloseEvent');
        if(packet.interface==='ProgressEvent'&&(typeof packet.lengthComputable!=='boolean'||!['loaded','total'].every(key=>typeof packet[key]==='number'&&Number.isFinite(packet[key]))))throw Error('Invalid owned synthetic ProgressEvent');
        if(packet.interface==='HashChangeEvent'&&(!['oldURL','newURL'].every(key=>typeof packet[key]==='string')))throw Error('Invalid owned synthetic HashChangeEvent');
        if(packet.interface==='ErrorEvent'&&(!['message','filename'].every(key=>typeof packet[key]==='string')||!['lineno','colno'].every(key=>Number.isInteger(packet[key])&&packet[key]>=0&&packet[key]<=0xffffffff)||Object.hasOwn(packet,'error')))throw Error('Invalid owned synthetic ErrorEvent');
        if(packet.interface==='StorageEvent'&&(!['key','oldValue','newValue'].every(key=>packet[key]===null||typeof packet[key]==='string')||typeof packet.url!=='string'||packet.storageArea!==null))throw Error('Invalid owned synthetic StorageEvent');
        if(packet.interface==='MessageEvent'&&(!['origin','lastEventId'].every(key=>typeof packet[key]==='string')||typeof packet.sourceOwned!=='boolean'||['data','source','ports'].some(key=>Object.hasOwn(packet,key))))throw Error('Invalid owned synthetic MessageEvent');
        if((packet.interface==='CompositionEvent'||packet.interface==='TextEvent')&&typeof packet.data!=='string')throw Error('Invalid owned synthetic '+packet.interface);
        if(packet.interface==='InputEvent'&&(!(packet.data===null||typeof packet.data==='string')||typeof packet.inputType!=='string'||typeof packet.isComposing!=='boolean'||!(packet.dataTransfer===null||Number.isSafeInteger(packet.dataTransfer)&&transfers.has(packet.dataTransfer))))throw Error('Invalid owned synthetic InputEvent');
        if(packet.rangesId!==undefined&&(packet.interface!=='InputEvent'||!Number.isSafeInteger(packet.rangesId)||!inputRangeEvents.has(packet.rangesId)))throw Error('Unknown owned InputEvent range handle');
        if(packet.interface==='WheelEvent'&&(!['deltaX','deltaY','deltaZ'].every(key=>typeof packet[key]==='number'&&Number.isFinite(packet[key]))||!Number.isInteger(packet.deltaMode)||packet.deltaMode<0||packet.deltaMode>0xffffffff||typeof packet.momentum!=='boolean'||!['wheelDeltaX','wheelDeltaY'].every(key=>Number.isInteger(packet[key])&&packet[key]>=-2147483648&&packet[key]<=2147483647)))throw Error('Invalid owned synthetic WheelEvent');
        if(packet.interface==='DragEvent'&&!(packet.dataTransfer===null||Number.isSafeInteger(packet.dataTransfer)&&transfers.has(packet.dataTransfer)))throw Error('Invalid owned synthetic DragEvent');
        charge(JSON.stringify(packet));const init={...packet,view:packet.viewOwned?target.ownerDocument.defaultView:null,relatedTarget:packet.relatedTarget===undefined?null:node(packet.relatedTarget),submitter:packet.submitter===undefined?null:node(packet.submitter)};
        if(packet.interface==='DragEvent'||packet.interface==='InputEvent')init.dataTransfer=packet.dataTransfer===null?null:transfers.get(packet.dataTransfer).value;
        delete init.syntheticId;delete init.interface;delete init.type;
        if(packet.interface==='InputEvent')init.targetRanges=decodeRanges(packet.targetRanges===undefined?[]:packet.targetRanges);
        if(packet.interface==='MessageEvent')Object.assign(init,{source:packet.sourceOwned?target.ownerDocument.defaultView:null,ports:[]});
        if(packet.interface==='DeviceMotionEvent')for(const key of ['acceleration','accelerationIncludingGravity','rotationRate'])if(init[key]===null)delete init[key];
        const event=['TextEvent','BeforeUnloadEvent'].includes(packet.interface)?target.ownerDocument.createEvent(packet.interface):new constructors[packet.interface](packet.type,init);if(packet.interface==='TextEvent')event.initTextEvent(packet.type,init.bubbles,init.cancelable,init.view,init.data);if(event instanceof BeforeUnloadEvent){event.initEvent(packet.type,init.bubbles,init.cancelable);event.returnValue=packet.unloadReturnValue;}syntheticTokens.set(event,packet.syntheticId);
        if(packet.defaultPrevented)event.preventDefault();if(packet.immediate)event.stopImmediatePropagation();else if(packet.stopped)event.stopPropagation();
        try{const result=target.dispatchEvent(event);return {result,defaultPrevented:event.defaultPrevented,...(event instanceof BeforeUnloadEvent?{unloadReturnValue:event.returnValue}:{})};}finally{if(packet.rangesId!==undefined)inputRangeEvents.delete(packet.rangesId);}
      }
      if(method==="dom.node") {
        if(args.length!==3 || !Array.isArray(args[2]))throw Error("Invalid DOM method");
        const [_,name,values]=args;let result;
        if(name==='characterData'){
          if(!(target instanceof CharacterData)||!values.length)throw Error('CharacterData requires an owned text or comment node');
          const [action,...parameters]=values;
          const unsigned=(/** @type {any} */ value)=>Number.isInteger(value)&&value>=0&&value<=4294967295;
          if(action==='data'&&parameters.length===0)return target.data;
          if(action==='length'&&parameters.length===0)return target.length;
          if(action==='wholeText'&&target instanceof Text&&parameters.length===0){
            for(const direction of /** @type {('previousSibling'|'nextSibling')[]} */(['previousSibling','nextSibling'])){
              let sibling=target[direction];
              while(sibling instanceof Text){if(!ids.has(sibling))throw Error('Text sibling is outside the owned DOM');sibling=sibling[direction];}
            }
            return target.wholeText;
          }
          try{
            if(action==='splitText'&&target instanceof Text&&parameters.length===1&&unsigned(parameters[0])){
              const offset=parameters[0];
              if(offset>target.length)throw new DOMException('Offset exceeds text length','IndexSizeError');
              if(target.parentNode&&!ids.has(target.parentNode))throw Error('Text parent is outside the owned DOM');
              if(nodes.size>=2048)throw Error('Plugin DOM node limit exceeded');
              chargeBytes(new TextEncoder().encode(target.data.slice(0,offset)).byteLength+new TextEncoder().encode(target.data.slice(offset)).byteLength);
              return describe(target.splitText(offset),true);
            }
            if(action==='substringData'&&parameters.length===2&&parameters.every(unsigned))return target.substringData(parameters[0],parameters[1]);
            let offset=0,count=target.length,text='';
            if(action==='data'&&parameters.length===1&&typeof parameters[0]==='string')text=parameters[0];
            else if(action==='appendData'&&parameters.length===1&&typeof parameters[0]==='string'){offset=target.length;count=0;text=parameters[0];}
            else if(action==='insertData'&&parameters.length===2&&unsigned(parameters[0])&&typeof parameters[1]==='string'){offset=parameters[0];count=0;text=parameters[1];}
            else if(action==='deleteData'&&parameters.length===2&&parameters.every(unsigned)){offset=parameters[0];count=parameters[1];}
            else if(action==='replaceData'&&parameters.length===3&&unsigned(parameters[0])&&unsigned(parameters[1])&&typeof parameters[2]==='string'){offset=parameters[0];count=parameters[1];text=parameters[2];}
            else throw Error('Unsupported CharacterData operation');
            if(offset>target.length)throw new DOMException('Offset exceeds character data length','IndexSizeError');
            charge(target.data.slice(0,offset)+text+target.data.slice(offset+count));
            target.replaceData(offset,count,text);return undefined;
          }catch(error){if(error instanceof DOMException)return {exception:{name:error.name,message:error.message}};throw error;}
        }
        if(name==='normalize'&&values.length===0){
          const pending=[target];let bytes=0;
          while(pending.length){
            const parent=pending.pop();if(!parent)continue;
            let run='';let count=0;
            const account=()=>{if(count>1)bytes+=new TextEncoder().encode(run).byteLength;run='';count=0;};
            for(const child of Array.from(parent.childNodes)){
              if(!ids.has(child))throw Error('Normalize descendant is outside the owned DOM');
              if(child instanceof Text){run+=child.data;count++;}else{account();pending.push(child);}
            }
            account();
          }
          chargeBytes(bytes);target.normalize();return undefined;
        }
        if(['contains','isSameNode','isEqualNode','compareDocumentPosition'].includes(name)){
          if(values.length!==1||(values[0]===null?name==='compareDocumentPosition':!Number.isSafeInteger(values[0])))throw Error('Invalid owned Node comparison');
          return target[name](values[0]===null?null:node(values[0]));
        }
        if(name==='matches'||name==='closest'){
          if(!(target instanceof Element)||values.length!==1||typeof values[0]!=='string')throw Error('Invalid owned Element selector');
          try{
            if(name==='matches')return target.matches(values[0]);
            // Native closest retains the original selector scoping root. Never
            // turn an unowned wrapper/document ancestor into a guest capability.
            const found=target.closest(values[0]);
            return found&&ids.has(found)?describe(found):null;
          }catch(error){if(error instanceof DOMException)return {exception:{name:error.name,message:error.message}};throw error;}
        }
        if(name==='insertAdjacentElement'||name==='insertAdjacentText'){
          if(!(target instanceof Element)||values.length!==2||typeof values[0]!=='string')throw Error('Invalid owned adjacent insertion');
          const textInsertion=name==='insertAdjacentText';
          if(textInsertion?typeof values[1]!=='string':!Number.isSafeInteger(values[1]))throw Error('Invalid adjacent insertion value');
          const element=textInsertion?null:node(values[1]);
          if(element&&!(element instanceof Element))throw Error('Adjacent insertion requires an owned Element');
          const placement=values[0].toLowerCase();
          if(!['beforebegin','afterbegin','beforeend','afterend'].includes(placement))return {exception:{name:'SyntaxError',message:'Invalid adjacent insertion position'}};
          const sibling=placement==='beforebegin'||placement==='afterend',parent=target.parentNode;
          if(sibling&&!parent)return textInsertion?undefined:null;
          if(sibling&&parent&&!ids.has(parent))throw Error('Plugin DOM sibling parent is not owned');
          try{
            if(element instanceof Element)return describe(target.insertAdjacentElement(/** @type {InsertPosition} */(placement),element));
            if(nodes.size>=2048)throw Error('Plugin DOM node limit exceeded');
            charge(values[1]);
            const text=target.ownerDocument.createTextNode(values[1]);describe(text,true);
            if(sibling){if(!parent)throw Error('The element has no parent');parent.insertBefore(text,placement==='beforebegin'?target:target.nextSibling);}
            else target.insertBefore(text,placement==='afterbegin'?target.firstChild:null);
            return undefined;
          }catch(error){if(error instanceof DOMException)return {exception:{name:error.name,message:error.message}};throw error;}
        }
        if(name==='markup'||name==='insertAdjacentHTML'){
          if(!(target instanceof Element)||values.length!==2||values.some(value=>typeof value!=='string'))throw Error('Invalid DOM markup operation');
          const [position,markup]=values;
          if(name==='markup'&&!['innerHTML','outerHTML'].includes(position))throw Error('Invalid DOM markup property');
          const placement=name==='markup'?(position==='innerHTML'?'contents':'replace'):position.toLowerCase();
          if(!['contents','replace','beforebegin','afterbegin','beforeend','afterend'].includes(placement))return {exception:{name:'SyntaxError',message:'Invalid insertAdjacentHTML position'}};
          const sibling=['replace','beforebegin','afterend'].includes(placement),parent=target.parentNode;
          if(sibling&&!parent){if(placement==='replace')return undefined;return {exception:{name:'NoModificationAllowedError',message:'The element has no parent'}};}
          if(sibling&&parent&&!ids.has(parent))throw Error('Plugin DOM sibling parent is not owned');
          const context=sibling?parent:target;
          const fragment=parseMarkup(context instanceof Element?context.localName:'body',markup);
          if(placement==='contents')target.replaceChildren(fragment);
          else if(placement==='replace')target.replaceWith(fragment);
          else if(placement==='beforebegin'||placement==='afterend'){
            if(!parent)throw Error('The element has no parent');
            parent.insertBefore(fragment,placement==='beforebegin'?target:target.nextSibling);
          }
          else target.insertBefore(fragment,placement==='afterbegin'?target.firstChild:null);
          return undefined;
        }
        if(['append','prepend','replaceChildren','before','after','replaceWith'].includes(name)) {
          const parentMethod=['append','prepend','replaceChildren'].includes(name);
          if(values.length>2048 || (parentMethod ? !(target instanceof Element || target instanceof DocumentFragment) : !(target instanceof Element || target instanceof Text)))throw Error('Invalid variadic DOM method');
          // Sibling mutations may only operate inside this bridge's graph. The
          // mounted dialog wrapper is host UI, even when its body is owned.
          if(!parentMethod&&target.parentNode&&!ids.has(target.parentNode))throw Error('Plugin DOM sibling parent is not owned');
          const converted=values.map(value=>{
            if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1)throw Error('Invalid variadic DOM argument');
            if(Object.hasOwn(value,'node')&&Number.isSafeInteger(value.node))return node(value.node);
            if(Object.hasOwn(value,'text')&&typeof value.text==='string')return value.text;
            throw Error('Invalid variadic DOM argument');
          });
          if(!parentMethod&&!target.parentNode)return undefined;
          const added=converted.filter(value=>typeof value==='string');
          if(nodes.size+added.length>2048)throw Error('Plugin DOM node limit exceeded');
          for(const value of added)charge(value);
          const children=converted.map(value=>{
            if(typeof value!=='string')return value;
            const text=document.createTextNode(value);describe(text,true);return text;
          });
          try{target[name](...children);return undefined;}
          catch(error){if(error instanceof DOMException)return {exception:{name:error.name,message:error.message}};throw error;}
        }
        if(name==='getElementById'&&target instanceof DocumentFragment&&values.length===1&&typeof values[0]==='string')result=target.getElementById(values[0]);
        else if(["appendChild","removeChild"].includes(name)&&values.length===1)result=target[name](node(values[0]));
        else if(name==="insertBefore"&&values.length===2)result=target.insertBefore(node(values[0]),values[1]===null?null:node(values[1]));
        else if(name==="replaceChild"&&values.length===2)result=target.replaceChild(node(values[0]),node(values[1]));
        else if(name==="cloneNode"&&values.length===1&&typeof values[0]==="boolean")result=cloneOwned(target,values[0]);
        else if(["remove","focus","blur","click"].includes(name)&&values.length===0)result=target[name]();
        else throw Error("Unsupported DOM method");
        return result instanceof Node?describe(result,true):undefined;
      }
      if(method==="dom.attribute") {
        const [_,name,key,value]=args;
        if(typeof key!=="string" || !allowedAttribute(key))throw Error("Unsupported DOM attribute");
        if(name==="setAttribute"&&args.length===4&&typeof value==="string"){charge(key+value);return target.setAttribute(key,value);}
        if(["getAttribute","removeAttribute","hasAttribute"].includes(name)&&args.length===3)return target[name](key);
        throw Error("Invalid DOM attribute call");
      }
      if(method==="dom.query") {
        if(args.length!==3 || typeof args[1]!=="string" || typeof args[2]!=="boolean")throw Error("Invalid DOM selector");
        return args[2]?Array.from(target.querySelectorAll(args[1])).map(value=>describe(/** @type {Node} */(value),true)):describe(target.querySelector(args[1]),true);
      }
      if(method==="dom.style") {
        const [_,action,key,value]=args;
        if(!styles.has(key))throw Error("Unsupported DOM style");
        if(action==="get"&&args.length===3)return target.style[key];
        if(action!=="set" || args.length!==4 || typeof value!=="string" || /url\s*\(|@import|expression\s*\(/i.test(value))throw Error("Unsupported DOM style value");
        charge(value);target.style[key]=value;return undefined;
      }
      if(method==='dom.handler'){
        if(args.length!==3||!pluginEventHandlerTypes.includes(args[1])||!(target instanceof HTMLElement))throw Error('Invalid owned property event handler');
        const key=args[0]+':'+args[1],previous=propertyHandlers.get(key);
        if(args[2]===null){/** @type {any} */(target)['on'+args[1]]=null;if(previous){callbacks.delete(previous.id);previous.callback.release();propertyHandlers.delete(key);}return undefined;}
        const handler=callback(args[2]);if(previous?.id===args[2])return undefined;
        // Reuse exactly the same native packet/lease path as ordinary listeners.
        result.call({method:'dom.listen',args:[args[0],args[1],args[2],{capture:false,once:false,passive:false}]});
        const row=listeners.pop();if(!row)throw Error('Missing owned property wrapper');target.removeEventListener(row.type,row.listener,false);
        if(previous){callbacks.delete(previous.id);previous.callback.release();}
        /** @type {any} */(target)['on'+args[1]]=row.listener;propertyHandlers.set(key,{node:target,type:args[1],id:args[2],callback:handler});return undefined;
      }
      if(method==="dom.listen") {
        if(listeners.length>=4096)throw Error("Plugin DOM listener limit exceeded");
        const [_,type,id,options]=args;const fn=callback(id);
        if(args.length!==4 || (typeof type!=='string'||type.length>1024) || !options || typeof options.capture!=="boolean" || typeof options.once!=="boolean")throw Error("Invalid DOM listener");
        const row={node:target,type,id,capture:options.capture,listener:/** @type {EventListener} */(()=>{})};
        row.listener=event=>{
          try{check();}catch{dispose();return;}
          let refusedMessage=false;
          let refusedRanges=false;
          const refusedStorage=event instanceof StorageEvent&&Object.getOwnPropertyDescriptor(StorageEvent.prototype,'storageArea')?.get?.call(event)!==null;
          const subclass=/** @type {Record<string,any>} */ ({ownedView:event instanceof UIEvent&&event.view===target.ownerDocument?.defaultView,interface:event instanceof PointerEvent?'PointerEvent':event instanceof WheelEvent?'WheelEvent':event instanceof DragEvent?'DragEvent':event instanceof MouseEvent?'MouseEvent':event instanceof KeyboardEvent?'KeyboardEvent':event instanceof FocusEvent?'FocusEvent':event instanceof InputEvent?'InputEvent':event instanceof CompositionEvent?'CompositionEvent':event instanceof TextEvent?'TextEvent':event instanceof AnimationEvent?'AnimationEvent':event instanceof TransitionEvent?'TransitionEvent':event instanceof DeviceOrientationEvent?'DeviceOrientationEvent':event instanceof DeviceMotionEvent?'DeviceMotionEvent':event instanceof BeforeUnloadEvent?'BeforeUnloadEvent':event instanceof CloseEvent?'CloseEvent':event instanceof ProgressEvent?'ProgressEvent':event instanceof SubmitEvent?'SubmitEvent':event instanceof HashChangeEvent?'HashChangeEvent':event instanceof ErrorEvent?'ErrorEvent':event instanceof MessageEvent?'MessageEvent':event instanceof StorageEvent?'StorageEvent':event instanceof UIEvent?'UIEvent':event instanceof CustomEvent?'CustomEvent':'Event'});
          if(event instanceof InputEvent){const ranges=InputEvent.prototype.getTargetRanges.call(event);refusedRanges=ranges.some(range=>!ids.has(range.startContainer)||!ids.has(range.endContainer));if(!refusedRanges)subclass.targetRanges=ranges.map(range=>({startContainer:describe(range.startContainer),startOffset:range.startOffset,endContainer:describe(range.endContainer),endOffset:range.endOffset}));}
          if(event instanceof DragEvent||event instanceof InputEvent)subclass.dataTransfer=describeTransfer(event.dataTransfer,event);
          if(event instanceof BeforeUnloadEvent)subclass.unloadReturnValue=event.returnValue;
          if(event instanceof ErrorEvent&&!syntheticTokens.has(event))subclass.error=Object.getOwnPropertyDescriptor(ErrorEvent.prototype,'error')?.get?.call(event);
          if(event instanceof MessageEvent){
            const source=Object.getOwnPropertyDescriptor(MessageEvent.prototype,'source')?.get?.call(event),ports=Object.getOwnPropertyDescriptor(MessageEvent.prototype,'ports')?.get?.call(event);
            subclass.sourceOwned=source!==null&&source===target.ownerDocument.defaultView;refusedMessage=ports.length!==0||source!==null&&!subclass.sourceOwned;
            if(!refusedMessage&&!syntheticTokens.has(event))subclass.data=Object.getOwnPropertyDescriptor(MessageEvent.prototype,'data')?.get?.call(event);
          }
          if(event instanceof DeviceMotionEvent)for(const key of ['acceleration','accelerationIncludingGravity','rotationRate']){const vector=event[/** @type {'acceleration'|'accelerationIncludingGravity'|'rotationRate'} */(key)];subclass[key]=vector===null?null:Object.fromEntries((key==='rotationRate'?['alpha','beta','gamma']:['x','y','z']).map(axis=>[axis,/** @type {any} */(vector)[axis]]));}
          if(event instanceof SubmitEvent&&event.submitter&&ids.has(event.submitter))subclass.submitter=describe(event.submitter);
          if((event instanceof MouseEvent||event instanceof FocusEvent)&&event.relatedTarget instanceof Node&&ids.has(event.relatedTarget))subclass.relatedTarget=describe(event.relatedTarget);
          if(event instanceof StorageEvent)subclass.storageArea=null;
          for(const key of ['oldValue','newValue','url','origin','lastEventId','message','filename','lineno','colno','alpha','beta','gamma','absolute','interval','wasClean','reason','animationName','propertyName','elapsedTime','pseudoElement','lengthComputable','loaded','total','oldURL','newURL','deltaX','deltaY','deltaZ','deltaMode','momentum','wheelDeltaX','wheelDeltaY','data','inputType','pageX','pageY','detail','screenX','screenY','clientX','clientY','ctrlKey','altKey','shiftKey','metaKey','button','buttons','movementX','movementY','key','code','location','repeat','isComposing','charCode','keyCode','which','pointerId','width','height','pressure','tangentialPressure','tiltX','tiltY','twist','pointerType','isPrimary'])if(key in event&&!(event instanceof MessageEvent&&key==='data'))subclass[key]=/** @type {any} */(event)[key];
          if(event instanceof MouseEvent||event instanceof KeyboardEvent)for(const [name,key] of [['AltGraph','modifierAltGraph'],['CapsLock','modifierCapsLock'],['Fn','modifierFn'],['NumLock','modifierNumLock'],['ScrollLock','modifierScrollLock'],['Symbol','modifierSymbol']])subclass[key]=event.getModifierState(name);
          let eventId=nativeEventIds.get(event);
          if(eventId===undefined){eventId=++eventSequence;nativeEventIds.set(event,eventId);}
          const packet={eventId,windowCheckpoint:!event.isTrusted,...(syntheticTokens.has(event)?{syntheticId:syntheticTokens.get(event)}:{}),type:event.type,target:describe(/** @type {Node} */(event.target),true),currentTarget:describe(target),bubbles:event.bubbles,cancelable:event.cancelable,composed:event.composed,defaultPrevented:event.defaultPrevented,cancelBubble:event.cancelBubble,eventPhase:event.eventPhase,isTrusted:event.isTrusted,timeStamp:event.timeStamp,path:event.composedPath().filter(node=>node instanceof Node&&ids.has(node)).map(node=>describe(/** @type {Node} */(node))),passive:!!options.passive,...subclass};
          const release=()=>{if(options.once){callbacks.delete(id);fn.release();const index=listeners.indexOf(row);if(index>=0)listeners.splice(index,1);}};
          rememberEvent(eventId,event);events.set(eventId,event);
          try{if(refusedRanges)throw Error('InputEvent target ranges require owned Nodes');if(refusedStorage)throw Error('StorageEvent requires an owned Storage');if(refusedMessage)throw Error('MessageEvent requires an owned source and no MessagePorts');void (fn.invokeEvent?fn.invokeEvent([packet]):fn.invoke([packet])).catch(report).finally(release);}
          catch(error){report(error);release();}
          finally{events.delete(eventId);}
        };
        target.addEventListener(type,row.listener,options);listeners.push(row);return undefined;
      }
      if(method==="dom.unlisten") {
        const [_,type,id,capture]=args,index=listeners.findIndex(row=>row.node===target&&row.type===type&&row.id===id&&row.capture===capture);
        if(index>=0){const [row]=listeners.splice(index,1);row.node.removeEventListener(type,row.listener,capture);callbacks.get(id)?.release();callbacks.delete(id);}
        return undefined;
      }
      throw Error("Unsupported plugin DOM operation");
    },
  });
  return result;
}
