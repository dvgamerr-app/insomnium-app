/** Component-only picker control. No credentials, OS dialog or IPC. */
const events=/** @type {any[]} */([]);let plan=/** @type {{kind:string,held:boolean,long?:boolean}} */({kind:'cancel',held:false}),pending=/** @type {(()=>void)|null} */(null);
export const isTauri=()=>true;
/** @param {{kind:string,held:boolean,long?:boolean}} value */
export function arm(value){if(pending)throw Error('Picker still pending');if(!['select','cancel','reject'].includes(value.kind))throw Error('Closed picker case');plan={...value};}
/** @param {any} options */
export function open(options){events.push({options:structuredClone(options),plan:structuredClone(plan),entered:Date.now()});const outcome=()=>{if(plan.kind==='reject')throw Error('Owned dialog refusal'+(plan.long?': '+ 'owned operation explanation '.repeat(24):''));return plan.kind==='select'?'/owned/selected.pem':null;};if(!plan.held)return Promise.resolve().then(outcome);return new Promise((resolve,reject)=>{pending=()=>{try{resolve(outcome());}catch(error){reject(error);}finally{pending=null;}};});}
export function release(){if(!pending)throw Error('No owned pending picker');pending();}
export const snapshot=()=>({events:structuredClone(events),pending:!!pending});
