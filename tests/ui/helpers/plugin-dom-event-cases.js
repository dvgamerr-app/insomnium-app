/** Same independent probes execute on browser DOM and actual guest intrinsics.
 * @param {any} EventConstructor */
export function exerciseEventSurface(EventConstructor){
 const C=EventConstructor,failed=(/** @type {()=>any} */ run)=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}},e=new C('probe',{bubbles:true,cancelable:true,composed:true});
 const result={
  identity:{instance:e instanceof C,constructor:e.constructor===C,tag:Object.prototype.toString.call(e),name:C.name,length:C.length,own:Object.keys(e),json:JSON.stringify(e)},
  initial:{type:e.type,bubbles:e.bubbles,cancelable:e.cancelable,composed:e.composed,target:e.target,currentTarget:e.currentTarget,phase:e.eventPhase,prevented:e.defaultPrevented,returnValue:e.returnValue,cancelBubble:e.cancelBubble,trusted:e.isTrusted,path:e.composedPath(),time:typeof e.timeStamp,nonnegative:e.timeStamp>=0},
  constants:['NONE','CAPTURING_PHASE','AT_TARGET','BUBBLING_PHASE'].map(name=>[C[name],C.prototype[name],Object.getOwnPropertyDescriptor(C,name),Object.getOwnPropertyDescriptor(C.prototype,name)]),
  readonly:['type','target','currentTarget','eventPhase','bubbles','cancelable','composed','timeStamp','defaultPrevented','isTrusted'].map(name=>[name,Reflect.set(e,name,'invalid')]),
  receiver:['type','target','currentTarget','eventPhase','defaultPrevented','timeStamp'].map(name=>failed(()=>Object.getOwnPropertyDescriptor(C.prototype,name)?.get?.call({}))),
  methods:['preventDefault','stopPropagation','stopImmediatePropagation','composedPath','initEvent'].map(name=>[name,Object.getOwnPropertyDescriptor(C.prototype,name)?.enumerable,failed(()=>C.prototype[name].call({},'changed'))]),
  constructorRefusals:[failed(()=>new C()),failed(()=>new C(Symbol('type'))),failed(()=>new C('probe',true)),failed(()=>C('probe'))],
  trustDescriptor:{enumerable:Object.getOwnPropertyDescriptor(e,'isTrusted')?.enumerable,configurable:Object.getOwnPropertyDescriptor(e,'isTrusted')?.configurable,get:typeof Object.getOwnPropertyDescriptor(e,'isTrusted')?.get,set:typeof Object.getOwnPropertyDescriptor(e,'isTrusted')?.set,redefine:failed(()=>Object.defineProperty(e,'isTrusted',{value:true}))},
 };
 const voids=[typeof e.preventDefault(),typeof e.stopPropagation(),typeof e.stopImmediatePropagation()];e.cancelBubble=false;e.returnValue=true;
 const cancelled={prevented:e.defaultPrevented,returnValue:e.returnValue,cancelBubble:e.cancelBubble,voids};
 const stamp=e.timeStamp;e.initEvent('reset',false,false);const reset={type:e.type,bubbles:e.bubbles,cancelable:e.cancelable,composed:e.composed,trusted:e.isTrusted,prevented:e.defaultPrevented,cancelBubble:e.cancelBubble,returnValue:e.returnValue,target:e.target,phase:e.eventPhase,sameTimestamp:e.timeStamp===stamp};
 const passive=new C('uncancelable');passive.preventDefault();passive.returnValue=false;const uncancelable={prevented:passive.defaultPrevented,returnValue:passive.returnValue};
 const alias=new C('alias',{cancelable:true});alias.returnValue=false;alias.cancelBubble=true;const aliases={prevented:alias.defaultPrevented,returnValue:alias.returnValue,cancelBubble:alias.cancelBubble};
 return {...result,cancelled,reset,uncancelable,aliases};
}
