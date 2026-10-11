/** Run unchanged in the genuine guest VM and browser DOM.
 * @param {any} document @param {any} DOMStringMap @param {any} [captured] */
export function exerciseDomDataset(document,DOMStringMap,captured={define:Object.defineProperty,defines:Object.defineProperties,reflect:Reflect.defineProperty}){
 const element=document.createElement('div');element.setAttribute('data-first-key','first');
 const data=element.dataset;if(!data)return {missing:'HTMLElement.dataset'};
 const attempt=(/** @type {()=>any} */ fn)=>{try{return fn();}catch(error){const e=/** @type {any} */(error);return {name:e.name,code:e.code,dom:e instanceof DOMException};}};
 const result=/** @type {Record<string,any>} */({brand:[Object.prototype.toString.call(data),data instanceof DOMStringMap,data===element.dataset,DOMStringMap.name,DOMStringMap.length],initial:[data.firstKey,Object.keys(data),data.absent===undefined]});
 data.secondKey='ไทย😀';data.number=12;data.empty='';result.writes=[element.getAttribute('data-second-key'),element.getAttribute('data-number'),data.empty,Object.entries(data)];
 element.setAttribute('data-first-key','host');element.removeAttribute('data-number');result.live=[data.firstKey,data.number===undefined,'firstKey' in data,'number' in data];
 data.nullValue=null;data.undefinedValue=undefined;data.bigValue=1n;data.objectValue={toString(){return 'coerced';}};result.conversions=[data.nullValue,data.undefinedValue,data.bigValue,data.objectValue,attempt(()=>{data.symbolValue=Symbol();})];
 const symbol=Symbol('expando');data[symbol]={value:1};result.symbol=[data[symbol].value,Object.getOwnPropertySymbols(data).includes(symbol),element.hasAttribute('data-symbol')];
 data['__proto__']='owned proto';data.constructor='owned constructor';data.toString='owned tostring';result.collisions=[data.__proto__,data.constructor,data.toString,Object.getPrototypeOf(data)===DOMStringMap.prototype,Object.hasOwn(data,'__proto__')];
 result.deletion=[delete data.firstKey,data.firstKey===undefined,element.hasAttribute('data-first-key'),Reflect.deleteProperty(data,'missing')];
 result.definitions=[attempt(()=>captured.define(data,'definedKey',{value:'defined',configurable:false})===data),element.getAttribute('data-defined-key'),Object.getOwnPropertyDescriptor(data,'definedKey'),
  attempt(()=>captured.reflect(data,'reflectedKey',{value:'reflected',writable:false,enumerable:false,configurable:false})),element.getAttribute('data-reflected-key'),
  attempt(()=>captured.reflect(data,'accessor',{get:()=>1})),Object.hasOwn(data,'accessor')];
 result.accessorDefinitions=[attempt(()=>captured.define(data,'getter',{get:()=>1})===data),Object.hasOwn(data,'getter'),
  attempt(()=>captured.reflect(data,'absentDescriptor',{})),Object.hasOwn(data,'absentDescriptor'),attempt(()=>captured.define(data,'emptyDescriptor',{})===data),Object.hasOwn(data,'emptyDescriptor'),
  attempt(()=>captured.reflect(data,'writableOnly',{writable:true})),data.writableOnly];
 result.multi=[attempt(()=>captured.defines(data,{one:{value:'one'},two:{value:2}})===data),data.one,data.two];
 const before=Object.entries(data);result.invalid=[attempt(()=>{data['bad-name']='bad';}),attempt(()=>{data['bad name']='bad';}),attempt(()=>{data['bad/name']='bad';}),JSON.stringify(before)===JSON.stringify(Object.entries(data))];
 data['UPPER']='upper';data['dash-X']='dash';data['a.b:c_1']='punctuation';data['']='empty key';data['ไทย']='unicode';result.names=[element.getAttribute('data--u-p-p-e-r'),element.getAttribute('data-dash--x'),element.getAttribute('data-a.b:c_1'),element.getAttribute('data-'),element.getAttribute('data-ไทย'),Object.keys(data)];
 result.receiver=[attempt(()=>new DOMStringMap()),document.createTextNode('text').dataset===undefined,attempt(()=>Object.preventExtensions(data)),Reflect.set(element,'dataset',{})];
 return result;
}

/** Independent operation preserves the existing helper-call budget while checking every enumeration key and reflection edge.
 * @param {any} document @param {any} DOMStringMap @param {any} [captured] */
export function exerciseDomDatasetEdges(document,DOMStringMap,captured={define:Object.defineProperty,defines:Object.defineProperties,reflect:Reflect.defineProperty}){
 const element=document.createElement('div'),data=element.dataset;
 const attempt=(/** @type {()=>any} */ fn)=>{try{return fn();}catch(error){const e=/** @type {any} */(error);return {name:e.name,code:e.code,dom:e instanceof DOMException};}};
 const result=/** @type {Record<string,any>} */({});
 for(const key of ['secondKey','empty','nullValue','undefinedValue','bigValue','objectValue','__proto__','constructor','toString','definedKey','reflectedKey','absentDescriptor','emptyDescriptor','writableOnly','one','two','UPPER','dash-X','a.b:c_1','','ไทย'])data[key]=key;
 result.enumeration=Object.keys(data).map(key=>{const descriptor=Object.getOwnPropertyDescriptor(data,key);return [key,descriptor?.writable,descriptor?.enumerable,descriptor?.configurable];});
 const receiver={};result.alternateReceiver=[Reflect.set(data,'receiverKey','receiver value',receiver),data.receiverKey,receiver];
 const getter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element),'dataset')?.get;
 // The browser getter is inherited from HTMLElement; walk the actual chain.
 let prototype=Object.getPrototypeOf(element),datasetGetter=getter;
 while(prototype&&!datasetGetter){datasetGetter=Object.getOwnPropertyDescriptor(prototype,'dataset')?.get;prototype=Object.getPrototypeOf(prototype);}
 if(!datasetGetter)throw new Error('Missing dataset getter');const checkedGetter=datasetGetter;
 result.getterReceivers=[attempt(()=>checkedGetter.call({})),attempt(()=>checkedGetter.call(document.createTextNode('text')))];
 const unchanged=Object.entries(data);const order=/** @type {string[]} */([]);
 result.definitionConversion=[attempt(()=>captured.defines(data,{untouched:{get value(){order.push('first');return 'first';}},invalid:{get get(){order.push('second');return 1;}}})===data),order,JSON.stringify(unchanged)===JSON.stringify(Object.entries(data))];
 return result;
}
