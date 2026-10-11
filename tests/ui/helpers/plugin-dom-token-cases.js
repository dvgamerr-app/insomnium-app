/** Runs unchanged against browser DOM and the genuine guest owned DOM.
 * @param {any} document @param {any} DOMTokenList */
export function exerciseDomTokens(document,DOMTokenList){
  const element=document.createElement('div');element.className=' a  b a\tไทย😀 ';
  const tokens=element.classList;
  if(!tokens)return {missing:'Element.classList'};
  const attempt=(/** @type {()=>any} */ fn)=>{try{return fn();}catch(error){const e=/** @type {any} */(error);return {name:e.name,code:e.code};}};
  const result=/** @type {Record<string,any>} */({brand:[Object.prototype.toString.call(tokens),tokens instanceof DOMTokenList,tokens===element.classList],initial:[tokens.length,[...tokens],tokens.value,String(tokens),tokens.item(99),tokens[99]===undefined]});
  tokens.add('c','a','c');result.add=[element.className,[...tokens]];
  tokens.remove('b','absent');result.remove=[element.className,[...tokens]];
  result.toggle=[tokens.toggle('c'),tokens.toggle('c'),tokens.toggle('c',false),tokens.toggle('c',true),tokens.toggle('c',true),element.className];
  result.replace=[tokens.replace('a','c'),tokens.replace('absent','z'),[...tokens],element.className];
  element.setAttribute('class','later later\nlast');result.live=[[...tokens],tokens.length,tokens[0],tokens.contains('later')];
  tokens.value=' raw  raw\tlast ';result.value=[element.className,tokens.value,[...tokens]];
  const before=element.className;
  result.validation=[attempt(()=>tokens.add('valid','')),element.className===before,attempt(()=>tokens.remove('raw','bad token')),element.className===before,
    attempt(()=>tokens.toggle('')),attempt(()=>tokens.contains('bad\ttoken')),attempt(()=>tokens.replace('raw','')),attempt(()=>tokens.supports('x'))];
  result.conversion=[attempt(()=>tokens.contains()),attempt(()=>tokens.toggle()),attempt(()=>tokens.replace('raw')),attempt(()=>tokens.item()),attempt(()=>tokens.add(Symbol())),attempt(()=>tokens.item(1n))];
  tokens.add({toString(){return 'coerced';}});result.coercion=[tokens.contains('coerced'),tokens.contains('RAW'),tokens.item(4294967296)===tokens.item(0)];
  const seen=/** @type {any[]} */([]);tokens.forEach((/** @type {any} */ value,/** @type {number} */ index,/** @type {any} */ list)=>seen.push([value,index,list===tokens]));
  result.iteration=[seen,[...tokens.keys()],[...tokens.entries()],tokens[Symbol.iterator]===tokens.values];
  result.reflection=[Reflect.set(tokens,'0','replacement'),tokens[0],Reflect.defineProperty(tokens,'0',{value:'replacement',configurable:false}),tokens[0],attempt(()=>Object.defineProperty(tokens,'0',{value:'replacement'})),Object.getOwnPropertyDescriptor(tokens,'0')];
  result.receivers=[attempt(()=>DOMTokenList.prototype.contains.call({},'x')),attempt(()=>new DOMTokenList()),document.createTextNode('text').classList===undefined];
  result.optionalForce=[tokens.toggle('undefined-force',undefined),tokens.contains('undefined-force'),tokens.toggle('undefined-force',undefined),tokens.contains('undefined-force')];
  element.classList='forwarded';result.forwarding=[tokens===element.classList,tokens.value,[...tokens]];
  const empty=document.createElement('div');empty.classList.add();result.emptyMutation=[empty.hasAttribute('class'),empty.classList.value];
  try{tokens.add('');}catch(error){const e=/** @type {any} */(error);result.exceptionBrand=[e instanceof DOMException,e instanceof Error,Object.prototype.toString.call(e),e.code];}
  const exception=new DOMException('message','SyntaxError');result.exception=[exception.name,exception.message,exception.code,String(exception),Object.getPrototypeOf(DOMException)===Function.prototype,
    Reflect.set(exception,'name','changed'),Reflect.set(exception,'code',99),new DOMException('-','-').code];
  result.constants=Object.entries(DOMException).filter(([key])=>key.endsWith('_ERR')).map(([key,value])=>[key,value,DOMException.prototype[/** @type {'SYNTAX_ERR'} */(key)]]);
  result.methodShape=[DOMTokenList.name,DOMTokenList.length,...['item','add','remove','contains','toggle','replace','supports','toString'].map(key=>DOMTokenList.prototype[key].length)];
  result.stringifierReceiver=attempt(()=>DOMTokenList.prototype.toString.call({value:'spoof'}));
  Object.defineProperty(tokens,'value',{value:'shadow',configurable:true});result.stringifierShadow=String(tokens);delete tokens.value;
  return result;
}
