/** Same real DOM listener program in browser and actual guest VM.
 * @param {any} body @param {any} outer @param {any} inner @param {any} deep @param {any} status
 * @param {()=>Promise<any>} [wait] */
export function installEventNesting(body,outer,inner,deep,status,wait){
 const rows=/** @type {any[]} */([]),controls=[outer,inner,deep];
 const label=(/** @type {any} */ node)=>node===body?'body':node===outer?'outer':node===inner?'inner':node===deep?'deep':node===null?null:'foreign';
 const observe=(/** @type {string} */ at,/** @type {any} */ event)=>{rows.push({at,target:label(event.target),current:label(event.currentTarget),phase:event.eventPhase,path:event.composedPath().filter((/** @type {any} */ node)=>node===body||controls.includes(node)).map(label),trusted:event.isTrusted,prevented:event.defaultPrevented,checked:controls.map(control=>control.checked)});status.textContent=JSON.stringify(rows);};
 outer.addEventListener('click',async (/** @type {any} */ event)=>{observe('outer-before',event);if(wait)await wait();void Promise.resolve().then(()=>observe('outer-microtask',event));inner.click();observe('outer-after-inner',event);event.preventDefault();observe('outer-cancelled',event);});
 inner.addEventListener('click',(/** @type {any} */ event)=>{observe('inner-before',event);void Promise.resolve().then(()=>observe('inner-microtask',event));deep.click();observe('inner-after-deep',event);event.preventDefault();observe('inner-cancelled',event);});
 deep.addEventListener('click',(/** @type {any} */ event)=>{observe('deep-before',event);void Promise.resolve().then(()=>observe('deep-microtask',event));event.preventDefault();observe('deep-cancelled',event);});
 body.addEventListener('click',(/** @type {any} */ event)=>observe(label(event.target)+'-bubble',event));
}
