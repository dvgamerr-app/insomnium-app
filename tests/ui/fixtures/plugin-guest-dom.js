import {installSyntheticDispatch,installSyntheticFocusInput,installSyntheticWheel} from '../helpers/plugin-dom-synthetic-cases.js';
import {exerciseEventSubclasses,observeNativeSubclass,exerciseOwnedFocus} from '../helpers/plugin-dom-event-subclass-cases.js';
import {mount,tick} from "svelte";
import {openPluginSession} from "../../../src/lib/plugin-session.js";
import {createPluginDomBridge} from "../../../src/lib/plugin-dom-bridge.js";
import PluginDomDialogHost from "../../../src/lib/components/PluginDomDialogHost.svelte";
import {exerciseDomCollections} from '../helpers/plugin-dom-collection-cases.js';
import {exerciseDomTokens} from '../helpers/plugin-dom-token-cases.js';
import {exerciseDomDataset,exerciseDomDatasetEdges} from '../helpers/plugin-dom-dataset-cases.js';
import {exerciseEventSurface} from '../helpers/plugin-dom-event-cases.js';
import {installEventCheckpoint} from '../helpers/plugin-dom-event-checkpoint-cases.js';
import {installEventHostWait} from '../helpers/plugin-dom-event-host-wait-cases.js';
import {installEventNesting} from '../helpers/plugin-dom-event-nesting-cases.js';
import {installListenerLifecycle} from '../helpers/plugin-dom-listener-lifecycle-cases.js';
const target=document.body.appendChild(document.createElement("div"));mount(PluginDomDialogHost,{target});
const source=`let snapshot={hides:0};
let checkpointState;
let retainedState;
const initializedSubclasses=(${exerciseEventSubclasses.toString()})(globalThis);
const initializedSurface=(${exerciseEventSurface.toString()})(Event);
const initializedEvent=new Event('module-load',{cancelable:true});
initializedEvent.preventDefault();
const initializedStamp=initializedEvent.timeStamp;
let initializationDomBlocked=false;
try{document.createElement('div');}catch{initializationDomBlocked=true;}
const privateClockHidden=!Object.hasOwn(globalThis,'__pluginEventClock');
const privateCheckpointsHidden=!Object.hasOwn(globalThis,'__pluginInstallEventCheckpoints')&&!Object.hasOwn(__pluginGuestDom,'beginEventCheckpoint')&&!Object.hasOwn(__pluginGuestDom,'finishEventCheckpoint');
const captured={define:Object.defineProperty,defines:Object.defineProperties,reflect:Reflect.defineProperty};
exports.templateTags=[{name:'dom',run(c,label){
  const body=document.createElement('div'),controls=document.createElement('div');
  controls.innerHTML='<button></button><input><span></span>';
  const button=controls.querySelector('button'),input=controls.querySelector('input'),status=controls.querySelector('span');
  button.textContent='Guest DOM click';input.setAttribute('aria-label','Guest DOM input');status.setAttribute('role','status');status.textContent='waiting';
  button.addEventListener('click',clicked);
  const textParent=document.createElement('div'),text=new Text('A😀B'),comment=new Comment('boundary');
  if(!(text instanceof CharacterData)||!(text instanceof Node)||text instanceof HTMLElement||text.nodeType!==Node.TEXT_NODE||text.length!==4||text.substringData(1,2)!=='😀')throw Error('Text brand or UTF16 data mismatch');
  text.replaceData(0,1,'ไทย');text.insertData(0,'<');text.appendData('>');text.deleteData(0,1);
  if(text.data!=='ไทย😀B>'||text.nodeValue!==text.data||text.textContent!==text.data)throw Error('CharacterData edit mismatch');
  textParent.append(text,comment,document.createTextNode('tail'));
  const suffix=text.splitText(3),textCopy=suffix.cloneNode();
  if(!(suffix instanceof Text)||!(textCopy instanceof Text)||textCopy.data!=='😀B>'||text.nextSibling!==suffix||suffix.wholeText!=='ไทย😀B>'||text.wholeText!==suffix.wholeText)throw Error('Text split/wholeText identity mismatch');
  textParent.normalize();
  if(textParent.firstChild!==text||text.data!=='ไทย😀B>'||suffix.parentNode!==null||suffix.data!=='😀B>'||comment.parentNode!==textParent||textParent.childNodes.length!==3)throw Error('Owned normalize identity/comment boundary mismatch');
  comment.data='changed';comment.appendData('!');
  if(!(comment instanceof CharacterData)||!(comment instanceof Comment)||comment.data!=='changed!'||comment.length!==8)throw Error('Comment data mismatch');
  let indexError=false,bigintError=false,symbolError=false;
  try{text.splitText(-1);}catch(error){indexError=error instanceof DOMException&&error.name==='IndexSizeError';}
  try{text.deleteData(0n,1);}catch(error){bigintError=error instanceof TypeError;}
  try{text.appendData(Symbol());}catch(error){symbolError=error instanceof TypeError;}
  if(!indexError||!bigintError||!symbolError||text.data!=='ไทย😀B>')throw Error('CharacterData refusal mutated text');
  const fragment=document.createDocumentFragment(),liveChildren=fragment.children;
  input.id='owned-fragment-input';fragment.append(button,input,status);
  if(!(fragment instanceof DocumentFragment)||!(fragment instanceof Node)||fragment instanceof HTMLElement||fragment.nodeType!==Node.DOCUMENT_FRAGMENT_NODE||fragment.nodeName!=='#document-fragment'||fragment.ownerDocument!==document)throw Error('Fragment brand/owner mismatch');
  if(liveChildren!==fragment.children||liveChildren.length!==3||fragment.firstElementChild!==button||fragment.lastElementChild!==status||fragment.childElementCount!==3||fragment.getElementById(input.id)!==input||fragment.querySelector('input')!==input||fragment.querySelectorAll('input')[0]!==input)throw Error('Fragment lookup/collection mismatch');
  if(body.appendChild(fragment)!==fragment||liveChildren.length||fragment.childNodes.length||button.parentNode!==body)throw Error('Fragment transfer did not preserve identity or empty source');
  const constructed=new DocumentFragment();constructed.prepend('ไทย');const clone=constructed.cloneNode(true);
  if(!(clone instanceof DocumentFragment)||clone===constructed||clone.textContent!=='ไทย'||constructed.textContent!=='ไทย')throw Error('Fragment constructor/clone mismatch');
  clone.replaceChildren();if(clone.childElementCount||clone.childNodes.length)throw Error('Fragment clear failed');
  body.style.padding='12px';
  const mutations=document.createElement('div'),member=document.createElement('span');
  if(mutations.append('tail')!==undefined)throw Error('append must return undefined');
  mutations.prepend(member,'head');member.after('after');member.before('before');member.replaceWith('replace');
  if(mutations.textContent!=='beforereplaceafterheadtail')throw Error('Variadic sibling order mismatch');
  mutations.replaceChildren(member,member,'<b>literal</b>',null,undefined,7);
  if(mutations.firstChild!==member||mutations.childNodes.length!==5||mutations.textContent!=='<b>literal</b>nullundefined7')throw Error('Variadic conversion/identity mismatch');
  let symbols=false;try{mutations.append(Symbol('invalid'));}catch(e){symbols=e instanceof TypeError;}
  if(!symbols||mutations.childNodes.length!==5)throw Error('Symbol conversion must refuse before mutation');
  mutations.replaceChildren();if(mutations.childNodes.length)throw Error('Empty replaceChildren must clear');
  mutations.innerHTML='<p style="color: red"><strong>markup &amp; text</strong><!--owned--></p>';
  const paragraph=mutations.querySelector('p'),strong=paragraph.querySelector('strong');
  strong.insertAdjacentHTML('beforebegin','<span>before</span>');strong.insertAdjacentHTML('AFTEREND','<em>after</em>');
  paragraph.insertAdjacentHTML('afterbegin','start');paragraph.insertAdjacentHTML('beforeend','end');
  if(paragraph.textContent!=='startbeforemarkup & textafterend'||!paragraph.outerHTML.includes('&amp;'))throw Error('HTML parsing/adjacent positions/serialization mismatch');
  const originalMarkup=mutations.innerHTML;let rejected=false;
  try{mutations.innerHTML='<p onclick="leaked=true">rejected</p>';}catch{rejected=true;}
  if(!rejected||mutations.innerHTML!==originalMarkup||mutations.querySelector('p')!==paragraph)throw Error('Rejected HTML must preserve the complete original tree');
  paragraph.outerHTML='<section>replacement</section>';
  if(paragraph.parentNode!==null||mutations.firstElementChild.tagName!=='SECTION'||mutations.textContent!=='replacement')throw Error('outerHTML replacement mismatch');
  const table=document.createElement('table');table.innerHTML='<tr><td>cell</td></tr>';
  if(table.querySelector('tbody td').textContent!=='cell')throw Error('HTML table context mismatch');
  const adjacent=document.createDocumentFragment(),anchor=document.createElement('div'),before=document.createElement('span'),after=document.createElement('span'),insideFirst=document.createElement('em'),insideLast=document.createElement('span');
  before.textContent='before';after.textContent='after';insideFirst.textContent='first';insideLast.textContent='last';
  if(anchor.insertAdjacentElement('beforebegin',before)!==null||anchor.insertAdjacentText('afterend','detached')!==undefined||before.parentNode!==null)throw Error('Detached adjacent insertion mismatch');
  adjacent.append(anchor);
  if(anchor.insertAdjacentElement('BEFOREBEGIN',before)!==before||anchor.insertAdjacentElement('afterend',after)!==after)throw Error('Adjacent Element return identity mismatch');
  anchor.insertAdjacentText('afterbegin','<head>');anchor.insertAdjacentText('beforeend','tail');
  anchor.insertAdjacentElement('afterbegin',insideFirst);anchor.insertAdjacentElement('beforeend',insideLast);
  anchor.insertAdjacentText('beforebegin','left');anchor.insertAdjacentText('afterend','right');
  if(adjacent.textContent!=='beforeleftfirst<head>taillastrightafter'||anchor.firstChild!==insideFirst||anchor.lastChild!==insideLast||anchor.querySelector('head')!==null)throw Error('Adjacent ordering or literal text mismatch');
  const adjacentBefore=anchor.outerHTML;let adjacentSyntax=false,adjacentType=false,adjacentSymbol=false;
  try{anchor.insertAdjacentText('invalid','no');}catch(error){adjacentSyntax=error instanceof DOMException&&error.name==='SyntaxError';}
  try{anchor.insertAdjacentElement('beforeend',document.createTextNode('no'));}catch(error){adjacentType=error instanceof TypeError;}
  try{anchor.insertAdjacentText('beforeend',Symbol());}catch(error){adjacentSymbol=error instanceof TypeError;}
  if(!adjacentSyntax||!adjacentType||!adjacentSymbol||anchor.outerHTML!==adjacentBefore)throw Error('Adjacent refusal changed the tree');
  if(!body.contains(button)||!body.contains(body)||body.contains(null)||button.contains(body)||!button.isSameNode(button)||button.isSameNode(input)||button.isEqualNode(null))throw Error('Owned Node relation mismatch');
  const equalCopy=mutations.cloneNode(true);
  if(equalCopy===mutations||!mutations.isEqualNode(equalCopy)||!(mutations.compareDocumentPosition(equalCopy)&Node.DOCUMENT_POSITION_DISCONNECTED))throw Error('Owned equality/disconnected position mismatch');
  if(body.compareDocumentPosition(button)!==(Node.DOCUMENT_POSITION_FOLLOWING|Node.DOCUMENT_POSITION_CONTAINED_BY)||button.compareDocumentPosition(input)!==Node.DOCUMENT_POSITION_FOLLOWING)throw Error('Owned document position mismatch');
  if(!button.matches('button')||!button.webkitMatchesSelector('button')||button.matches('input')||button.closest('div')!==body||button.closest('button')!==button||button.closest('section')!==null)throw Error('Owned Element selector mismatch');
  let badSelector=false,badNode=false;try{button.closest('[');}catch(error){badSelector=error instanceof DOMException&&error.name==='SyntaxError';}try{body.contains({});}catch(error){badNode=error instanceof TypeError;}
  if(!badSelector||!badNode)throw Error('Owned selector/Node argument refusal mismatch');
  const parent=button.parentNode===body,queried=body.querySelector('input')===input,style=body.style===body.style;
  let clicks=0;
  function clicked(event){if(event.target.closest('button')!==button||button.closest('dialog')!==null)throw Error('Delegation must retain owned identity and hide the dialog wrapper');status.textContent=label+':'+(++clicks)+':'+(this===button)+':'+(event.target===button)+':'+(event.currentTarget===button)+':'+c.app.getInfo().version;}
  button.addEventListener('click',clicked);button.addEventListener('click',clicked);
  input.addEventListener('input',function(event){status.textContent=input.value+':'+(this===input)+':'+(event.target===input);});
  const removed=()=>{status.textContent='leaked removed listener';};button.addEventListener('click',removed);button.removeEventListener('click',removed);
  const returned=c.app.dialog(label,body,{wide:true,onHide(){snapshot={hides:snapshot.hides+1,detached:!body.isConnected,version:c.app.getInfo().version};}});
  return {void:returned===undefined,parent,queried,style,element:body instanceof HTMLElement,node:body instanceof Node};
}}, {name:'state',run(){return snapshot;}},
{name:'invalid',run(c){const errors=[];
const rpc=(method,args)=>__pluginValueCodec.decode(__pluginDomSync(__pluginValueCodec.encode({method,args})));
const node=rpc('dom.create',['element','div']);
for(const fn of [()=>document.createElement('script'),()=>new HTMLElement(),()=>c.app.dialog('wrong',{}),()=>document.createElement('div').setAttribute('onclick','globalThis.leaked=true'),()=>document.createElement('div').innerHTML='<script>leaked=true</script>',()=>rpc('dom.get',[node.id,'ownerDocument']),()=>rpc('dom.get',[node.id,'__proto__']),()=>rpc('dom.node',[node.id,'eval',['leaked=true']]),()=>rpc('dom.get',[-1,'textContent'])]){try{fn();errors.push('leaked');}catch(e){errors.push(e.message);}}return errors;}},
{name:'collections',run(){return (${exerciseDomCollections.toString()})(document,typeof NodeList==='undefined'?null:NodeList,typeof HTMLCollection==='undefined'?null:HTMLCollection,captured);}},
{name:'collectiondialog',run(c){
  const body=document.createElement('div'),list=document.createElement('div'),first=document.createElement('span'),button=document.createElement('button'),status=document.createElement('span');
  first.id='first';first.textContent='first';list.appendChild(first);body.appendChild(list);button.textContent='Read retained collections';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);
  const live=list.children,nodes=list.childNodes,staticList=list.querySelectorAll('span');
  button.addEventListener('click',()=>{status.textContent=JSON.stringify({length:live.length,nodes:nodes.length,staticLength:staticList.length,identity:live===list.children,late:live.namedItem('late')===list.querySelector('#late'),first:staticList[0]===first,version:c.app.getInfo().version});});
  c.app.dialog('Retained collection dialog',body,{onHide:async()=>{await Promise.resolve();body.setAttribute('data-collection-cleanup',JSON.stringify({detached:!body.isConnected,length:live.length,nodes:nodes.length,staticLength:staticList.length}));}});return 'prepared';
}},{name:'tokens',run(){return (${exerciseDomTokens.toString()})(document,typeof DOMTokenList==='undefined'?null:DOMTokenList);}},
{name:'tokendialog',run(c){
  const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');body.className='original';
  const tokens=body.classList;button.textContent='Read retained tokens';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);
  button.addEventListener('click',()=>{tokens.add('callback');status.textContent=JSON.stringify({identity:tokens===body.classList,tokens:[...tokens],value:tokens.value});});
  c.app.dialog('Retained token dialog',body,{onHide:async()=>{await Promise.resolve();tokens.add('cleanup');body.setAttribute('data-token-cleanup',JSON.stringify({detached:!body.isConnected,tokens:[...tokens],value:tokens.value}));}});return 'prepared';
}},{name:'dataset',run(){return (${exerciseDomDataset.toString()})(document,typeof DOMStringMap==='undefined'?null:DOMStringMap,captured);}},
{name:'datasetedges',run(){return (${exerciseDomDatasetEdges.toString()})(document,typeof DOMStringMap==='undefined'?null:DOMStringMap,captured);}},
{name:'datasetdialog',run(c){
 const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');body.dataset.original='first';
 const data=body.dataset;button.textContent='Read retained dataset';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);
 button.addEventListener('click',()=>{data.callback='guest';status.textContent=JSON.stringify({identity:data===body.dataset,original:data.original,late:data.late,callback:data.callback});});
 c.app.dialog('Retained dataset dialog',body,{onHide:async()=>{await Promise.resolve();data.cleanup='done';body.setAttribute('data-dataset-cleanup',JSON.stringify({detached:!body.isConnected,original:data.original,late:data.late,callback:data.callback,cleanup:data.cleanup}));}});return 'prepared';
}}, {name:'eventcancelbaseline',run(c){
 const body=document.createElement('div'),checkbox=document.createElement('input'),status=document.createElement('span');checkbox.type='checkbox';checkbox.setAttribute('aria-label','Baseline event checkbox');status.setAttribute('role','status');body.appendChild(checkbox);body.appendChild(status);
 checkbox.addEventListener('click',event=>{try{event.preventDefault();status.textContent='cancelled';}catch(error){status.textContent=error.message;}});
 c.app.dialog('Baseline event cancellation',body);return 'prepared';
}}, {name:'clipboardevent',run(c,text){
 const body=document.createElement('div'),box=document.createElement('input'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Clipboard event checkbox');status.setAttribute('role','status');body.appendChild(box);body.appendChild(status);
 box.addEventListener('click',event=>{const before=c.app.clipboard.readText(),write=c.app.clipboard.writeText(text),after=c.app.clipboard.readText(),clear=c.app.clipboard.clear();event.preventDefault();status.textContent=JSON.stringify({before,after,write:typeof write,clear:typeof clear,prevented:event.defaultPrevented});});
 c.app.dialog('Clipboard event dialog',body);return 'prepared';
}}, {name:'eventsurface',run(c,initialized=false){if(initialized)return {surface:initializedSurface,stamp:initializedStamp,retained:initializedEvent instanceof Event&&initializedEvent.defaultPrevented&&initializedEvent.timeStamp===initializedStamp,initializationDomBlocked,privateClockHidden,privateCheckpointsHidden,later:new Event('callback').timeStamp};return (${exerciseEventSurface.toString()})(Event);}}, {name:'eventretained',run(c,read=false){
 if(read)return retainedState();
 const body=document.createElement('div'),box=document.createElement('input'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Retained Event checkbox');status.setAttribute('role','status');body.appendChild(box);body.appendChild(status);
 box.addEventListener('click',async function(event){
   const during={instance:event instanceof Event,tag:Object.prototype.toString.call(event),thisTarget:this===box,target:event.target===box,current:event.currentTarget===box,phase:event.eventPhase,trusted:event.isTrusted,composed:event.composed,own:Object.keys(event),targetWrite:Reflect.set(event,'target',body),phaseWrite:Reflect.set(event,'eventPhase',99),trustedWrite:Reflect.set(event,'isTrusted',false),path:event.composedPath().map(node=>node===box?'box':node===body?'body':'foreign')};event.preventDefault();during.prevented=event.defaultPrevented;during.returnValue=event.returnValue;await Promise.resolve();retainedState=()=>({current:event.currentTarget,phase:event.eventPhase,path:event.composedPath(),prevented:event.defaultPrevented,returnValue:event.returnValue,target:event.target===box});status.textContent=JSON.stringify({during});
 });c.app.dialog('Retained Event dialog',body);return 'prepared';
}}, {name:'eventidentity',run(c){
 const body=document.createElement('div'),box=document.createElement('input'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Shared Event checkbox');status.setAttribute('role','status');body.appendChild(box);body.appendChild(status);
 let first;const observations=[];
 box.addEventListener('click',event=>{const previous=first;first=event;event.ownerMark='first listener';event.preventDefault();observations.push({listener:'first',prevented:event.defaultPrevented,current:event.currentTarget===box,...(previous?{previousSame:event===previous}:{})});status.textContent=JSON.stringify(observations);});
 box.addEventListener('click',event=>{observations.push({listener:'second',same:event===first,mark:event.ownerMark,prevented:event.defaultPrevented,current:event.currentTarget===box});status.textContent=JSON.stringify(observations);});
 body.addEventListener('click',event=>{observations.push({listener:'parent',same:event===first,mark:event.ownerMark,prevented:event.defaultPrevented,current:event.currentTarget===body,target:event.target===box,phase:event.eventPhase});status.textContent=JSON.stringify(observations);});
 c.app.dialog('Shared Event identity dialog',body);return 'prepared';
}}, {name:'eventcheckpoint',run(c,read=false){
 if(read)return checkpointState();
 const body=document.createElement('div'),box=document.createElement('input'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Guest checkpoint checkbox');status.setAttribute('role','status');body.appendChild(box);body.appendChild(status);
 checkpointState=(${installEventCheckpoint.toString()})(body,box,status);c.app.dialog('Event checkpoint dialog',body);return 'prepared';
}}, {name:'eventhostwait',run(c){
 const body=document.createElement('div'),box=document.createElement('input'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Guest host wait checkbox');status.setAttribute('role','status');body.appendChild(box);body.appendChild(status);
 (${installEventHostWait.toString()})(body,box,status,()=>c.app.prompt('Held Event host provider'));
 const cpu=document.createElement('button'),budget=document.createElement('button'),asyncGuard=document.createElement('button');cpu.textContent='Waiting owner CPU guard';budget.textContent='Waiting owner helper guard';asyncGuard.textContent='Waiting owner async guard';body.appendChild(cpu);body.appendChild(budget);body.appendChild(asyncGuard);cpu.addEventListener('click',()=>{while(true){}});budget.addEventListener('click',()=>{for(let index=0;index<260;index++)c.app.getInfo();});asyncGuard.addEventListener('click',async()=>{await c.app.prompt('Held Event host provider');});
 c.app.dialog('Event host wait dialog',body);return 'prepared';
}}, {name:'eventforeignowner',run(){
 const button=document.createElement('button'),status=document.createElement('span');button.addEventListener('click',()=>{status.textContent='foreign executed';});return 'prepared';
}}, {name:'eventnesting',run(c,afterWait=false,duringInvoke=false){
 const body=document.createElement('div'),outer=document.createElement('input'),inner=document.createElement('input'),deep=document.createElement('input'),status=document.createElement('span');
 for(const [node,label] of [[outer,'outer'],[inner,'inner'],[deep,'deep']]){node.type='checkbox';node.setAttribute('aria-label','Guest nested '+label);body.appendChild(node);}status.setAttribute('role','status');body.appendChild(status);
 (${installEventNesting.toString()})(body,outer,inner,deep,status,afterWait?()=>c.app.prompt('Held Event host provider'):undefined);if(duringInvoke)outer.click();c.app.dialog('Event nesting dialog',body);return 'prepared';
}}, {name:'eventnestingguard',run(c,kind){
 const body=document.createElement('div'),outer=document.createElement('button'),inner=document.createElement('button'),status=document.createElement('span');outer.textContent='Nested guard outer';inner.textContent='Nested guard inner';status.setAttribute('role','status');body.appendChild(outer);body.appendChild(inner);body.appendChild(status);
 if(kind==='cpu'){
  inner.addEventListener('click',()=>{const before=new Event('clock').timeStamp;while(new Event('clock').timeStamp-before<1100){}status.textContent='inner-work-completed';});
  outer.addEventListener('click',()=>{inner.click();while(true){}});
 }else{
  const controls=[outer,...Array.from({length:8},()=>document.createElement('button'))];let count=0;
  for(let index=0;index<controls.length;index++){const node=controls[index];if(index)body.appendChild(node);node.textContent='Nested guard depth '+index;node.addEventListener('click',()=>{status.textContent=String(++count);controls[index+1]?.click();});}
 }
 c.app.dialog('Event nesting guard dialog',body);return 'prepared';
}}, {name:'listenerlifecycle',run(c,mode){
 const body=document.createElement('div'),box=document.createElement('input'),sibling=document.createElement('input'),status=document.createElement('span');box.type='checkbox';sibling.type='checkbox';box.setAttribute('aria-label','Guest lifecycle checkbox');sibling.setAttribute('aria-label','Guest lifecycle sibling');status.setAttribute('role','status');body.appendChild(box);body.appendChild(sibling);body.appendChild(status);
 (${installListenerLifecycle.toString()})(body,box,sibling,status,mode,mode==='self-host-wait'?()=>c.app.prompt('Held Event host provider'):undefined);c.app.dialog('Listener lifecycle dialog',body);return 'prepared';
}}, {name:'eventsubclasses',run(c,mode){if(mode==='initialized')return initializedSubclasses;if(mode==='surface')return (${exerciseEventSubclasses.toString()})(globalThis);const body=document.createElement('div'),input=document.createElement('input'),status=document.createElement('span');const peer=document.createElement('input');peer.setAttribute('aria-label','Guest subclass peer');input.setAttribute('aria-label','Guest subclass input');status.setAttribute('role','status');body.appendChild(input);body.appendChild(peer);body.appendChild(status);const rows=[];for(const type of ['click','keydown','keyup','wheel','focus','blur','focusin','focusout','beforeinput','input'])input.addEventListener(type,event=>{rows.push((${observeNativeSubclass.toString()})(event,globalThis,[input,peer]));status.textContent=JSON.stringify(rows);});c.app.dialog('Event subclass dialog',body);return {prepared:true,ownedFocus:(${exerciseOwnedFocus.toString()})(globalThis,[input,peer])};}}, {name:'syntheticdispatch',run(c,mode){const body=document.createElement('div'),box=document.createElement('input'),trigger=document.createElement('button'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Synthetic checkbox');trigger.textContent='Run synthetic dispatch';status.setAttribute('role','status');body.appendChild(box);body.appendChild(trigger);body.appendChild(status);const program=(mode.startsWith('wheel-')?(${installSyntheticWheel.toString()}):mode.startsWith('focus-input-')?(${installSyntheticFocusInput.toString()}):(${installSyntheticDispatch.toString()}))(globalThis,body,box,trigger,status);mode=mode.replace(/^(focus-input-|wheel-)/,'');c.app.dialog('Synthetic dispatch dialog',body);if(mode==='invoke')program.run();else trigger.addEventListener('click',async()=>{if(mode==='host-wait')await c.app.prompt('Held Event host provider');program.run();});return 'prepared';}}, {name:'syntheticwindowguard',run(c,mode){const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');button.textContent='Window guard';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);const spin=ms=>{const until=Date.now()+ms;while(Date.now()<until){}};button.addEventListener('owned:guard',async()=>{status.textContent='guard-prefix';if(mode==='cpu')spin(500);if(mode==='helpers')for(let i=0;i<240;i++)c.app.getInfo();await Promise.resolve();status.textContent='guard-continuation';if(mode==='cpu')spin(1000);if(mode==='helpers')for(let i=0;i<20;i++)c.app.getInfo();status.textContent='guard-finished';});button.addEventListener('owned:guard',()=>{if(mode==='cpu')spin(700);if(mode==='helpers')for(let i=0;i<10;i++)c.app.getInfo();status.textContent='guard-peer';});c.app.dialog('Synthetic window guard dialog',body);return 'prepared';}}];`;

/** @type {Awaited<ReturnType<typeof openPluginSession>>|undefined} */let session;
const controller=new AbortController(),errors=/** @type {string[]} */([]),records=/** @type {{terminated:boolean}[]} */([]);
const bridges=/** @type {ReturnType<typeof createPluginDomBridge>[]} */([]);
/** @type {{read:string,write:string,clear:string}|undefined} */let eventClipboard;
/** @type {ReturnType<typeof operation>|undefined} */let checkpointOperation;
/** @type {((value:any)=>void)|undefined} */let releasePrompt;
let heldPromptCalls=0;
let foreignMutations=0;
let eventInfoCalls=0;
const eventEntryErrors=/** @type {string[]} */([]);
const nestedForeignGuards=/** @type {{error:string,mutations:number}[]} */([]);
const retainedCallbacks=/** @type {{label:string,callback:import('../../../src/lib/plugin-session.js').PluginDomCallback}[]} */([]);
/** @param {string} label @param {'send'|'preview'} [purpose] */
function operation(label,purpose="send") {
  const bridge=createPluginDomBridge({purpose,signal:controller.signal,current:()=>!!session&&!session.isClosed(),onError:error=>errors.push(String(error))});bridges.push(bridge);
  const current=()=>!controller.signal.aborted&&!!session&&!session.isClosed(),helperCall=async(/** @type {{method:string,args:any[]}} */ call)=>{if(label==='event-host-wait'&&call.method==='app.prompt'&&call.args[0]==='Held Event host provider'&&current()){heldPromptCalls++;return new Promise(resolve=>{releasePrompt=resolve;});}throw Error('Unexpected helper call');},syncCall=Object.assign(async()=>({version:label,platform:'win32'}),{eventCall:(/** @type {{method:string,args:any[]}} */ call)=>{if(!current())throw Error('Invalid controlled live event provider');if(call.method==='app.getInfo'){if(label==='event-host-wait'||label==='synthetic-window-guard')eventInfoCalls++;return {kind:'value',value:{version:label,platform:'win32'}};}const key=call.method==='app.clipboard.readText'?'read':call.method==='app.clipboard.writeText'?'write':call.method==='app.clipboard.clear'?'clear':undefined;if(!key||!eventClipboard)throw Error('Invalid controlled live event provider');return {kind:'native',url:eventClipboard[key],method:key==='read'?'GET':'POST'};}});
  const domCallbacks={retain(/** @type {import('../../../src/lib/plugin-session.js').PluginDomCallback} */ callback,/** @type {number} */ id){retainedCallbacks.push({label,callback});bridge.domCallbacks.retain(Object.freeze({...callback,invokeEvent:(/** @type {any[]} */ args)=>{if(!callback.invokeEvent)throw Error('Missing real native callback');try{return callback.invokeEvent(args);}catch(error){eventEntryErrors.push(String(error));throw error;}}}),id);}};
  const domCall=(/** @type {Parameters<typeof bridge.call>[0]} */ call)=>{
    if(['event-nesting','event-host-wait'].includes(label)&&call.method==='dom.node'&&call.args[1]==='click'){
      const foreign=retainedCallbacks.find(row=>row.label==='foreign-event-owner')?.callback;
      if(foreign?.invokeEvent){try{foreign.invokeEvent([]);nestedForeignGuards.push({error:'leaked',mutations:foreignMutations});}catch(error){nestedForeignGuards.push({error:String(error),mutations:foreignMutations});}}
    }
    const result=bridge.call(call);if(label==='foreign-event-owner'&&call.method==='dom.set'&&call.args[2]==='foreign executed')foreignMutations++;return result;
  };
  return {signal:controller.signal,isCurrent:current,helperCall,syncCall,domCallbacks,domCall,
    domOwner:{current,helperCall,syncCall,domCallbacks,domCall,dispose:bridge.dispose}};
}
/** @type {any} */(window).__pluginGuestDom={
  errors,records,
  eventSurface(){return session?.invoke('templateTags',12,[],operation('event-surface'));},
  eventInitialized(){return session?.invoke('templateTags',12,[true],operation('event-initialized'));},
  eventRetained(){return session?.invoke('templateTags',13,[],operation('event-retained'));},
  eventRetainedAfter(){return session?.invoke('templateTags',13,[true],operation('event-retained-after'));},
  eventIdentity(){return session?.invoke('templateTags',14,[],operation('event-identity'));},
  eventCheckpoint(){checkpointOperation=operation('event-checkpoint');return session?.invoke('templateTags',15,[],checkpointOperation);},
  eventCheckpointState(){return session?.invoke('templateTags',15,[true],checkpointOperation);},
  eventHostWait(){return session?.invoke('templateTags',16,[],operation('event-host-wait'));},
  promptState(){return {calls:heldPromptCalls,waiting:!!releasePrompt};},
  releasePrompt(){const release=releasePrompt;releasePrompt=undefined;release?.('owned provider result');},
  prepareForeignEventOwner(){return session?.invoke('templateTags',17,[],operation('foreign-event-owner'));},
  attemptForeignEventEntry(){const callback=retainedCallbacks.find(row=>row.label==='foreign-event-owner')?.callback;if(!callback?.invokeEvent)throw Error('Missing retained foreign owner callback');try{callback.invokeEvent([]);return {error:'leaked',mutations:foreignMutations};}catch(error){return {error:String(error),mutations:foreignMutations};}},
  eventGuardState(){return {infoCalls:eventInfoCalls,entryErrors:eventEntryErrors,closed:session?.isClosed()??false};},
  nestedForeignGuards(){return nestedForeignGuards;},
  eventNesting(/** @type {boolean} */ afterWait=false,/** @type {boolean} */ duringInvoke=false){return session?.invoke('templateTags',18,[afterWait,duringInvoke],operation(afterWait?'event-host-wait':'event-nesting'));},
  eventNestingGuard(/** @type {string} */ kind){return session?.invoke('templateTags',19,[kind],operation('event-nesting-guard'));},
  syntheticWindowGuard(/** @type {string} */ mode){return session?.invoke('templateTags',23,[mode],operation('synthetic-window-guard'));},
  syntheticDispatch(/** @type {string} */ mode){return session?.invoke('templateTags',22,[mode],operation(mode.replace(/^(focus-input-|wheel-)/,'')==='host-wait'?'event-host-wait':'synthetic-dispatch'));},
  async syntheticTypedGuards(){
    const one=operation('typed event guards'),two=operation('foreign typed event guards'),owned=one.domCall({method:'dom.create',args:['element','input']}),foreign=two.domCall({method:'dom.create',args:['element','span']});
    const packet={syntheticId:1,interface:'InputEvent',type:'input',bubbles:true,cancelable:true,composed:false,defaultPrevented:false,stopped:false,immediate:false,viewOwned:false,data:null,inputType:'',isComposing:false,dataTransfer:null};
    const refuse=(/** @type {any} */ target,/** @type {any} */ value)=>{try{one.domCall({method:'dom.dispatch',args:[target,value]});return 'leaked';}catch(error){return String(error);}};
    try{
      const malformed=[{data:{}},{inputType:1},{isComposing:0},{dataTransfer:{}},{targetRanges:[{}]},{interface:'UnknownEvent'}].map(change=>refuse(owned.id,{...packet,...change}));
      const related=refuse(owned.id,{...packet,interface:'FocusEvent',relatedTarget:foreign.id}),target=refuse(foreign.id,{...packet,interface:'FocusEvent'});
      await one.domOwner.dispose();const retired=refuse(owned.id,packet);return {malformed,related,target,retired};
    }finally{await one.domOwner.dispose();await two.domOwner.dispose();}
  },

  async syntheticWheelGuards(){
    const one=operation('wheel event guards'),two=operation('foreign wheel event guards'),owned=one.domCall({method:'dom.create',args:['element','input']}),foreign=two.domCall({method:'dom.create',args:['element','span']});
    const packet={syntheticId:1,interface:'WheelEvent',type:'wheel',bubbles:true,cancelable:true,composed:false,defaultPrevented:false,stopped:false,immediate:false,viewOwned:false,deltaX:0,deltaY:0,deltaZ:0,deltaMode:0,momentum:false,wheelDeltaX:0,wheelDeltaY:0};
    const refuse=(/** @type {any} */ target,/** @type {any} */ value)=>{try{one.domCall({method:'dom.dispatch',args:[target,value]});return 'leaked';}catch(error){return String(error);}};
    try{
      const malformed=[{deltaX:'1'},{deltaY:Infinity},{deltaZ:NaN},{deltaMode:-1},{momentum:1},{wheelDeltaX:1.5},{wheelDeltaY:1e30},{interface:'UnknownEvent'}].map(change=>refuse(owned.id,{...packet,...change}));
      const related=refuse(owned.id,{...packet,interface:'WheelEvent',relatedTarget:foreign.id}),target=refuse(foreign.id,{...packet,interface:'WheelEvent'});
      await one.domOwner.dispose();const retired=refuse(owned.id,packet);return {malformed,related,target,retired};
    }finally{await one.domOwner.dispose();await two.domOwner.dispose();}
  },
  eventSubclasses(/** @type {string} */ mode){return session?.invoke('templateTags',21,[mode],operation('event-subclasses'));},
  listenerLifecycle(/** @type {string} */ mode){return session?.invoke('templateTags',20,[mode],operation(mode==='self-host-wait'?'event-host-wait':'listener-lifecycle'));},
  staleLifecycleCallback(/** @type {string} */ mode){const rows=retainedCallbacks.filter(row=>row.label===(mode==='self-host-wait'?'event-host-wait':'listener-lifecycle')),callback=rows[mode==='remove-peer'?1:0]?.callback;if(!callback?.invokeEvent)throw Error('Missing lifecycle callback');try{callback.invokeEvent([]);return 'leaked';}catch(error){return String(error);}},
  clipboardProvider(/** @type {{read:string,write:string,clear:string}} */ urls){eventClipboard={...urls};},
  clipboardEvent(/** @type {string} */ text){return session?.invoke('templateTags',11,[text],operation('clipboard-event'));},
  async open(/** @type {string} */ url,/** @type {'commonjs'|'module'} */ format='commonjs'){
    session?.close();await tick();const entry=format==='module'?'main.mjs':'main.cjs';
    session=await openPluginSession({name:"owned-guest-dom",entry,format,files:{[entry]:format==='module'?source.replace('exports.templateTags=','export const templateTags='):source}},
      {signal:controller.signal,isCurrent:()=>true,createWorker:()=>{const worker=new Worker(url,{type:"module"}),record={terminated:false};records.push(record);const terminate=worker.terminate.bind(worker);worker.terminate=()=>{record.terminated=true;terminate();};return worker;}});
  },
  show(/** @type {string} */ label,/** @type {'send'|'preview'} */ purpose="send"){return session?.invoke("templateTags",0,[label],operation(label,purpose));},
  state(){return session?.invoke("templateTags",1);},
  invalid(){return session?.invoke("templateTags",2,[],operation("invalid"));},
  collectionOracle(){return exerciseDomCollections(document,NodeList,HTMLCollection);},
  collections(){return session?.invoke('templateTags',3,[],operation('collections'));},
  tokenOracle(){return exerciseDomTokens(document,DOMTokenList);},
  tokens(){return session?.invoke('templateTags',5,[],operation('tokens'));},
  datasetOracle(){return exerciseDomDataset(document,DOMStringMap);},
  dataset(){return session?.invoke('templateTags',7,[],operation('dataset'));},
  datasetEdgesOracle(){return exerciseDomDatasetEdges(document,DOMStringMap);},
  datasetEdges(){return session?.invoke('templateTags',8,[],operation('dataset edges'));},
  datasetDialog(){return session?.invoke('templateTags',9,[],operation('retained dataset'));},
  eventCancelBaseline(){return session?.invoke('templateTags',10,[],operation('event cancellation baseline'));},
  datasetGuards(){
    const one=operation('dataset guards'),two=operation('foreign dataset guards'),owned=one.domCall({method:'dom.create',args:['element','div']}),text=one.domCall({method:'dom.create',args:['text','text']});
    const errors=[];
    for(const args of [[owned.id,'eval',[]],[owned.id,'__proto__',[]],[owned.id,'set',['key',1]],[owned.id,'set',{}],[owned.id,'read',['key']],[text.id,'read',[]],[-1,'read',[]]]){
      try{one.domCall({method:'dom.dataset',args});errors.push('leaked');}catch(error){errors.push(String(error));}
    }
    try{two.domCall({method:'dom.dataset',args:[owned.id,'read',[]]});errors.push('leaked');}catch(error){errors.push(String(error));}
    return errors;
  },
  datasetBudget(){
    const graph=operation('dataset budget'),owned=graph.domCall({method:'dom.create',args:['element','div']});
    const value='x'.repeat(8*1024*1024-3);graph.domCall({method:'dom.dataset',args:[owned.id,'set',['key',value]]});
    try{graph.domCall({method:'dom.dataset',args:[owned.id,'set',['key','changed']]});return 'leaked';}catch(error){return {error:String(error),unchanged:graph.domCall({method:'dom.dataset',args:[owned.id,'read',[]]})[0][1]===value};}
  },
  tokenDialog(){return session?.invoke('templateTags',6,[],operation('retained tokens'));},
  tokenGuards(){
    const one=operation('token guards'),two=operation('foreign token guards'),owned=one.domCall({method:'dom.create',args:['element','div']}),text=one.domCall({method:'dom.create',args:['text','text']});
    const errors=[];
    for(const args of [[owned.id,'eval',[]],[owned.id,'__proto__',[]],[owned.id,'toggle',['x','false']],[owned.id,'add',{}],[owned.id,'read',['x']],[text.id,'read',[]],[-1,'read',[]]]){
      try{one.domCall({method:'dom.tokens',args});errors.push('leaked');}catch(error){errors.push(String(error));}
    }
    try{two.domCall({method:'dom.tokens',args:[owned.id,'read',[]]});errors.push('leaked');}catch(error){errors.push(String(error));}
    return errors;
  },
  tokenBudget(){
    const graph=operation('token budget'),owned=graph.domCall({method:'dom.create',args:['element','div']});
    graph.domCall({method:'dom.tokens',args:[owned.id,'set',['x'.repeat(8*1024*1024)]]});
    try{graph.domCall({method:'dom.tokens',args:[owned.id,'add',['y']]});return 'leaked';}catch(error){return {error:String(error),unchanged:graph.domCall({method:'dom.tokens',args:[owned.id,'value',[]]}).length===8*1024*1024};}
  },
  collectionDialog(){return session?.invoke('templateTags',4,[],operation('retained collection'));},
  collectionGuards(){
    const one=operation('collection guard'),two=operation('foreign collection guard'),owned=one.domCall({method:'dom.create',args:['element','div']});
    const errors=[];
    for(const args of [[owned.id,'parentNode',null],[owned.id,'tag',{}],[owned.id,'children','wrong'],[-1,'children',null]]){
      try{one.domCall({method:'dom.collection',args});errors.push('leaked');}catch(error){errors.push(String(error));}
    }
    try{two.domCall({method:'dom.collection',args:[owned.id,'children',null]});errors.push('leaked');}catch(error){errors.push(String(error));}
    return errors;
  },
  budget(){
    const graph=operation("budget"),value=graph.domCall({method:"dom.create",args:["element","div"]});
    const chunk="x".repeat(1024*1024);
    for(let i=0;i<8;i++)graph.domCall({method:"dom.set",args:[value.id,"textContent",chunk]});
    let refusal='';try{graph.domCall({method:"dom.set",args:[value.id,"textContent","x"]});}
    catch(error){refusal=String(error);}
    if(!refusal.includes('DOM text limit exceeded'))throw Error('Original text budget refusal missing');
    const rejects=(/** @type {()=>unknown} */ call,/** @type {string} */ message)=>{
      try{call();}catch(error){if(String(error).includes(message))return;throw error;}
      throw Error('Expected quota refusal: '+message);
    };
    const tree=operation('clone node budget'),root=tree.domCall({method:'dom.create',args:['element','div']});
    const markup='<span></span>'.repeat(1023);
    tree.domCall({method:'dom.node',args:[root.id,'markup',['innerHTML',markup]]});
    const copied=tree.domCall({method:'dom.node',args:[root.id,'cloneNode',[true]]});
    rejects(()=>tree.domCall({method:'dom.node',args:[root.id,'cloneNode',[false]]}),'DOM node limit exceeded');
    rejects(()=>tree.domCall({method:'dom.set',args:[root.id,'textContent','replacement']}),'DOM node limit exceeded');
    if(tree.domCall({method:'dom.get',args:[root.id,'innerHTML']})!==markup||tree.domCall({method:'dom.collection',args:[copied.id,'childNodes',null]}).length!==1023)throw Error('Clone quota refusal changed original tree or lost descendants');
    const textGraph=operation('shallow text copy budget'),text=textGraph.domCall({method:'dom.create',args:['text','😀'.repeat(1024*1024)]});
    textGraph.domCall({method:'dom.node',args:[text.id,'cloneNode',[false]]});
    rejects(()=>textGraph.domCall({method:'dom.node',args:[text.id,'cloneNode',[false]]}),'DOM text limit exceeded');
    const inputGraph=operation('attribute and dirty-value copy budget'),input=inputGraph.domCall({method:'dom.create',args:['element','input']});
    const name='data-copy',half='x'.repeat(2*1024*1024);
    inputGraph.domCall({method:'dom.attribute',args:[input.id,'setAttribute',name,half.slice(name.length)]});
    inputGraph.domCall({method:'dom.set',args:[input.id,'value',half]});
    const copiedInput=inputGraph.domCall({method:'dom.node',args:[input.id,'cloneNode',[false]]});
    rejects(()=>inputGraph.domCall({method:'dom.set',args:[copiedInput.id,'value','x']}),'DOM text limit exceeded');
    if(inputGraph.domCall({method:'dom.get',args:[copiedInput.id,'value']})!==half)throw Error('Refused copy write changed retained input value');
    return refusal;
  },
  close(){for(const bridge of bridges)bridge.dispose();session?.close();controller.abort();},
};
