/** Independent real DOM listener lifecycle oracle and guest program.
 * @param {any} body @param {any} box @param {any} sibling @param {any} status @param {string} mode
 * @param {()=>Promise<any>} [wait] */
export function installListenerLifecycle(body,box,sibling,status,mode,wait){
 const rows=/** @type {any[]} */([]);let calls=0;
 const observe=(/** @type {string} */ at,/** @type {any} */ event)=>{rows.push({at,calls,current:event.currentTarget===box?'box':event.currentTarget===sibling?'sibling':event.currentTarget===body?'body':event.currentTarget===null?null:'foreign',phase:event.eventPhase,trusted:event.isTrusted,prevented:event.defaultPrevented,checked:[box.checked,sibling.checked]});status.textContent=JSON.stringify(rows);};
 if(mode.startsWith('self')){
  const handler=async(/** @type {any} */ event)=>{calls++;observe('self-before',event);box.removeEventListener('click',handler);if(wait)await wait();await Promise.resolve();await Promise.resolve();event.preventDefault();observe('self-after-await',event);};box.addEventListener('click',handler);
 }else if(mode.includes('once')){
  const handler=(/** @type {any} */ event)=>{calls++;observe('once-before',event);if(mode==='readd-once'&&calls===1)box.addEventListener('click',handler,{once:true});if(calls===1)sibling.click();event.preventDefault();observe('once-after-nested',event);};box.addEventListener('click',handler,{once:true});
  sibling.addEventListener('click',(/** @type {any} */ event)=>{observe('sibling-before',event);box.click();event.preventDefault();observe('sibling-after-nested',event);});
 }else if(mode==='add-peer'){
  const added=(/** @type {any} */ event)=>observe('added-peer',event);box.addEventListener('click',(/** @type {any} */ event)=>{calls++;observe('adding-peer',event);if(calls===1)box.addEventListener('click',added);});
 }else if(mode==='passive'){
  box.addEventListener('click',async(/** @type {any} */ event)=>{calls++;event.preventDefault();observe('passive-before',event);await Promise.resolve();event.returnValue=false;observe('passive-after-await',event);},{passive:true});
 }else{
  const removed=(/** @type {any} */ event)=>observe('removed-must-not-run',event);box.addEventListener('click',(/** @type {any} */ event)=>{calls++;observe('remove-peer',event);box.removeEventListener('click',removed);});box.addEventListener('click',removed);
 }
 box.addEventListener('click',(/** @type {any} */ event)=>{event.preventDefault();observe('peer',event);});body.addEventListener('click',(/** @type {any} */ event)=>observe('bubble',event));
}
