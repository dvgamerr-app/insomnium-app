/** Runs unchanged against a browser DOM and the genuine guest DOM.
 * @param {any} document @param {any} NodeList @param {any} HTMLCollection @param {any} [captured] */
export function exerciseDomCollections(document,NodeList,HTMLCollection,captured={define:Object.defineProperty,defines:Object.defineProperties,reflect:Reflect.defineProperty}){
  const root=document.createElement('div'),text=document.createTextNode('text');
  const a=document.createElement('input'),nested=document.createElement('div'),b=document.createElement('input'),c=document.createElement('input');
  a.id='first';a.name='firstName';a.className='match';b.id='nested';b.className='match';c.id='last';c.name='lastName';c.className='match';
  root.appendChild(text);root.appendChild(a);nested.appendChild(b);root.appendChild(nested);
  const elements=root.children,nodes=root.childNodes,selected=root.querySelectorAll('input');
  const result=/** @type {Record<string,any>} */({
    brands:[Object.prototype.toString.call(elements),Object.prototype.toString.call(nodes),Object.prototype.toString.call(selected)],
    sameObject:[elements===root.children,nodes===root.childNodes,selected!==root.querySelectorAll('input')],
    constructors:!!NodeList&&!!HTMLCollection&&nodes instanceof NodeList&&selected instanceof NodeList&&elements instanceof HTMLCollection,
  });
  root.appendChild(c);
  result.liveAppend=[elements.length,nodes.length,elements[2]===c,nodes[3]===c];
  result.staticQuery=[selected.length,selected[0]===a,selected[1]===b,root.querySelectorAll('input').length];
  root.removeChild(a);root.insertBefore(c,nested);
  result.liveReorder=[elements.length,nodes.length,elements[0]===c,elements[1]===nested,nodes[0]===text,nodes[1]===c];
  if(typeof nodes.item!=='function'||typeof elements.namedItem!=='function'){result.members='missing';return result;}
  const thrown=(/** @type {()=>any} */ fn)=>{try{fn();return 'missing';}catch(error){return /** @type {Error} */(error).name;}};
  result.items=[nodes.item(0)===text,nodes.item(4294967296)===text,nodes.item(-1)===null,nodes[999]===undefined,elements.item(999)===null,thrown(()=>nodes.item())];
  result.named=[elements.namedItem('last')===c,elements.last===c,elements.lastName===c,elements.namedItem('')===null,elements.namedItem('first')===null,nodes.last===undefined];
  c.id='renamed';c.name='newName';
  result.namedMutation=[elements.last===undefined,elements.lastName===undefined,elements.renamed===c,elements.newName===c];
  const tag=typeof root.getElementsByTagName==='function'?root.getElementsByTagName('input'):null;
  const classes=typeof root.getElementsByClassName==='function'?root.getElementsByClassName('match'):null;
  if(!tag||!classes){result.members='missing descendant collections';return result;}
  root.appendChild(a);b.className='other';
  result.descendants=[tag.length,tag[0]===c,tag[1]===b,tag[2]===a,classes.length,classes[0]===c,classes[1]===a,root.getElementsByTagName('*').length];
  result.iterable=[Array.from(nodes).length,[...elements].length,[...selected].length,[...nodes.keys()],Array.from(nodes.entries(),(/** @type {any[]} */ entry)=>entry[0]),nodes.values().next().value===text];
  const seen=/** @type {any[]} */([]);nodes.forEach(/** @this {any} */function(/** @type {any} */ value,/** @type {number} */ index,/** @type {any} */ list){seen.push([index,value===list[index],this===root,list===nodes]);},root);result.forEach=seen;
  result.properties=[Object.keys(elements),Object.keys(nodes),Object.getOwnPropertyDescriptor(elements,'renamed')?.enumerable,Object.getOwnPropertyDescriptor(elements,'0')?.writable,
    Reflect.set(elements,'0',a),Reflect.deleteProperty(elements,'0'),thrown(()=>Object.preventExtensions(elements))];
  const collision=document.createElement('input');collision.id='length';root.appendChild(collision);
  result.collisions=[typeof elements.length==='number',elements.namedItem('length')===collision,typeof elements.item==='function',thrown(()=>NodeList.prototype.item.call({},0)),thrown(()=>new NodeList()),thrown(()=>new HTMLCollection())];
  const live=root.childNodes.values();live.next();const extra=document.createElement('span');root.appendChild(extra);result.iteratorMutation=[Array.from(live).at(-1)===extra];
  result.readOnly=nodes[0]===text&&elements[0]===c;
  result.nodeKinds=[text.children===undefined,text.childNodes.length,text.childNodes===text.childNodes,text.childNodes instanceof NodeList];
  result.conversions=[thrown(()=>elements.namedItem()),thrown(()=>elements.namedItem(Symbol())),thrown(()=>nodes.item(1n)),thrown(()=>root.getElementsByTagName()),thrown(()=>root.getElementsByClassName(Symbol()))];
  result.definitions=[Reflect.defineProperty(nodes,'0',{value:a}),nodes[0]===text,Reflect.set(nodes,'length',999),nodes.length];
  const define=(/** @type {PropertyDescriptor} */ descriptor)=>{try{return Reflect.defineProperty(nodes,'0',descriptor);}catch(error){return /** @type {Error} */(error).name;}};
  result.descriptors=[define({value:a,configurable:false}),define({get:()=>a}),define({value:a,writable:true}),nodes[0]===text,Reflect.set(elements,'renamed',a),elements.renamed===c];
  const apply=(/** @type {()=>any} */ fn)=>{try{return fn();}catch(error){return /** @type {Error} */(error).name;}};
  result.captured=[apply(()=>captured.define(nodes,'0',{value:a,configurable:false})===nodes),
    apply(()=>captured.reflect(nodes,'0',{value:a,configurable:false})),
    apply(()=>captured.defines(nodes,{'0':{value:a,configurable:false}})===nodes),nodes[0]===text];
  result.throwingDefinitions=[apply(()=>captured.define(nodes,'0',{value:a})===nodes),apply(()=>captured.define(nodes,'0',{value:a,configurable:true})===nodes),
    apply(()=>captured.define(nodes,'0',{get:()=>a})===nodes),apply(()=>captured.define(elements,'renamed',{value:a})===elements),
    apply(()=>captured.reflect(elements,'renamed',{value:a})),apply(()=>captured.reflect(elements,'renamed',{value:a,configurable:false}))];
  const order=/** @type {string[]} */([]),descriptor=new Proxy({value:a,configurable:false},{has(target,key){order.push('has:'+String(key));return Reflect.has(target,key);},get(target,key){order.push('get:'+String(key));return Reflect.get(target,key);}});
  result.descriptorConversion=[apply(()=>captured.reflect(nodes,{[Symbol.toPrimitive](/** @type {string} */ hint){order.push('key:'+hint);return '0';}},descriptor)),order,
    apply(()=>captured.reflect(nodes,'0',{value:a,get:()=>a})),apply(()=>captured.reflect(nodes,'0',{get:1})),apply(()=>captured.reflect(nodes,'0',null))];
  const key=Symbol('expando');captured.define(nodes,key,{value:7,configurable:true});
  captured.define(nodes,'expando',{value:1,writable:true,enumerable:true,configurable:true});captured.define(nodes,'expando',{value:2});
  result.expandos=[nodes[key],Object.getOwnPropertyDescriptor(nodes,'expando'),apply(()=>captured.defines(nodes,{unapplied:{value:3},bad:{get:1}})),Object.hasOwn(nodes,'unapplied')];
  captured.define(nodes,'fixed',{value:4});
  result.partialDefinitions=[apply(()=>captured.defines(nodes,{earlier:{value:5},fixed:{value:6}})),nodes.earlier,nodes.fixed];
  const ordinary={},spoof=Object.create(NodeList.prototype);
  captured.define(ordinary,'0',{value:9});captured.define(spoof,'0',{value:9});
  result.ordinary=[captured.reflect(ordinary,'0',{value:10}),apply(()=>captured.define(ordinary,'0',{value:10})),
    Object.getOwnPropertyDescriptor(ordinary,'0'),captured.reflect(spoof,'0',{value:10}),Object.getOwnPropertyDescriptor(spoof,'0'),
    apply(()=>captured.reflect(null,'0',{value:1})),apply(()=>Object.freeze(nodes)),apply(()=>Object.seal(nodes))];
  root.removeChild(text);result.removalAfterDefinition=[nodes[0]===c,Object.getOwnPropertyDescriptor(nodes,'0')?.configurable];
  result.intrinsicShape=[captured.define,captured.defines,captured.reflect].map((/** @type {any} */ fn)=>[fn.name,fn.length,Object.hasOwn(fn,'prototype'),apply(()=>Reflect.construct(fn,[{},'x',{value:1}]))]);
  return result;
}
