/** Install the same listeners in browser DOM and the genuine plugin VM.
 * @param {any} body @param {any} box @param {any} status */
export function installEventCheckpoint(body,box,status){
 const rows=/** @type {any[]} */([]);
 let retained=/** @type {any} */(undefined);
 const observe=(/** @type {string} */ at,/** @type {any} */ event,/** @type {any} */ current)=>{
  rows.push({at,current:event.currentTarget===current,target:event.target===box,phase:event.eventPhase,path:event.composedPath().filter((/** @type {any} */ node)=>node===body||node===box).map((/** @type {any} */ node)=>node===box?'box':'body'),prevented:event.defaultPrevented,checked:box.checked,same:event===retained});status.textContent=JSON.stringify(rows);
 };
 box.addEventListener('click',async (/** @type {any} */ event)=>{retained=event;observe('before',event,box);await Promise.resolve();observe('microtask-one',event,box);await Promise.resolve();event.preventDefault();observe('microtask-two-cancelled',event,box);});
 box.addEventListener('click',(/** @type {any} */ event)=>observe('peer',event,box));body.addEventListener('click',(/** @type {any} */ event)=>observe('parent',event,body));
 return ()=>({current:retained.currentTarget===null,phase:retained.eventPhase,path:retained.composedPath().length,prevented:retained.defaultPrevented,target:retained.target===box,checked:box.checked});
}
