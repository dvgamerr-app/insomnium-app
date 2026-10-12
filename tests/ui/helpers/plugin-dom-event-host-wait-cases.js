/** Shared independent browser/guest listener program.
 * @param {any} body @param {any} box @param {any} status @param {()=>Promise<any>} wait */
export function installEventHostWait(body,box,status,wait){
 const rows=/** @type {any[]} */([]);let retained=/** @type {any} */(undefined);
 const observe=(/** @type {string} */ at,/** @type {any} */ event,/** @type {any} */ target)=>{rows.push({at,same:event===retained,current:event.currentTarget===target,phase:event.eventPhase,path:event.composedPath().filter((/** @type {any} */ node)=>node===box||node===body).map((/** @type {any} */ node)=>node===box?'box':'body'),prevented:event.defaultPrevented,checked:box.checked});status.textContent=JSON.stringify(rows);};
 box.addEventListener('click',async (/** @type {any} */ event)=>{retained=event;observe('waiting',event,box);await wait();observe('resumed',event,null);});
 box.addEventListener('click',(/** @type {any} */ event)=>{event.preventDefault();observe('peer-cancelled',event,box);});body.addEventListener('click',(/** @type {any} */ event)=>observe('parent',event,body));
 return ()=>rows;
}
