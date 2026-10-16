import {templateEditorRange} from './template-authoring.js';
import {templateVariablePath} from './template-variable-path.js';
/** Display-only marks use the existing preview session; editor text/history stay untouched.
 * @param {import('codemirror').Editor} editor
 * @param {()=>ReturnType<typeof import('./template-editor-session.svelte.js').createTemplateEditorSession>} factory
 * @param {boolean} json */
export function attachVariablePreview(editor,factory,json) {
  /** @type {import('codemirror').TextMarker[]} */let marks=[];
  /** @type {ReturnType<typeof setTimeout>|undefined} */let timer;
  /** @type {AbortController|undefined} */let controller;
  /** @type {ReturnType<typeof factory>|undefined} */let session;
  let disposed=false;
  function clear(){clearTimeout(timer);controller?.abort();session?.close();session=undefined;editor.operation(()=>{for(const mark of marks)mark.clear();marks=[];});}
  function schedule(){
    clear();if(disposed)return;
    const source=editor.getValue();if(!source.includes('{{'))return;
    timer=setTimeout(()=>{
      const operation=new AbortController();controller=operation;
      let owned;
      try{owned=factory();session=owned;}catch{return;}
      const current=()=>!disposed&&!operation.signal.aborted&&owned.isCurrent()&&editor.getValue()===source;
      const deadline=setTimeout(()=>{operation.abort();owned.close();},3000);
      void(async()=>{
        for(let index=source.indexOf('{{');index>=0;){
          const range=templateEditorRange(source,index+2,index+2,json);
          index=source.indexOf('{{',Math.max(index+2,range.end));
          if(!range.text.startsWith('{{')||!range.text.endsWith('}}'))continue;
          const key=range.text.slice(2,-2).trim();
          let root;try{root=templateVariablePath(key)[0];}catch{ /* Expressions use the renderer without attributing one variable owner. */ }
          try{
            const value=await owned.renderPreview(range.text,{signal:operation.signal,isCurrent:current});
            if(!current())return;
            const origin=root!==undefined&&owned.variableSources&&Object.hasOwn(owned.variableSources,root)?owned.variableSources[root]:undefined;
            const label=(origin?'{'+origin.name+'}: ':'')+value;
            const element=document.createElement('span');element.className='template-variable-preview';element.textContent=label; element.title=range.text;element.setAttribute('aria-label',key+': '+label);
            marks.push(editor.markText(editor.posFromIndex(range.start),editor.posFromIndex(range.end),{replacedWith:element,clearOnEnter:true}));
          }catch{if(!current())return;}
        }
      })().catch(()=>{}).finally(()=>{clearTimeout(deadline);owned.close();if(session===owned)session=undefined;});
    },200);
  }
  editor.on('change',schedule);editor.on('focus',schedule);schedule();
  return ()=>{disposed=true;editor.off('change',schedule);editor.off('focus',schedule);clear();};
}
