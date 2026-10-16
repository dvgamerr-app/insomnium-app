/** Stable IDs distinguish equal theme names from different packages.
 * @param {{plugin:string,definition:any}[]} themes */
export function pluginThemeOptions(themes){
  const seen=new Set();
  return themes.filter(item=>item.definition?.name).map(item=>({
    ...item,value:'plugin:'+encodeURIComponent(item.plugin)+':'+encodeURIComponent(item.definition.name),
    label:(item.definition.displayName||item.definition.name)+' · '+item.plugin,
  })).filter(item=>{if(seen.has(item.value))return false;seen.add(item.value);return true;});
}

// Archived base theme fills omitted groups, rather than borrowing unrelated
// Nocturne colors. Scoped blocks deliberately inherit their parent instead.
const baseTheme={
  background:{default:'#fff',success:'#75ba24',notice:'#d8c84d',warning:'#ec8702',danger:'#e15251',surprise:'#6030BF',info:'#20aed9'},
  foreground:{default:'#666',success:'#fff',notice:'#fff',warning:'#fff',danger:'#fff',surprise:'#fff',info:'#fff'},
  highlight:{default:'rgba(130, 130, 130, 1)',xxs:'rgba(130, 130, 130, 0.05)',xs:'rgba(130, 130, 130, 0.1)',sm:'rgba(130, 130, 130, 0.25)',md:'rgba(130, 130, 130, 0.35)',lg:'rgba(130, 130, 130, 0.5)',xl:'rgba(130, 130, 130, 0.8)'},
};
/** @param {any} value */
function channels(value){
  if(typeof value!=='string')return null;
  const hex=/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if(hex){const expanded=hex[1].length<5?[...hex[1]].map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(expanded.slice(i,i+2),16));}
  const rgb=/^rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)(?:\s*,\s*[\d.]+%?)?\s*\)$/i.exec(value);
  return rgb?rgb.slice(1,4).map(c=>Math.min(255,Number.parseFloat(c)*(c.endsWith('%')?2.55:1))):null;
}
/** Native controls and remaining base tokens should follow the theme surface.
 * @param {Record<string,any>} theme */
export function pluginThemeScheme(theme){
  const rgb=channels(theme.background?.default??baseTheme.background.default);
  return rgb&&(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000>=128?'light':'dark';
}

/** Map legacy theme blocks onto the current shared color tokens. Keep CSS as
 * text in one owned stylesheet so replacement/unload removes every override.
 * @param {Record<string,any>} theme */
export function pluginThemeCss(theme){
  /** @param {any} value */
  const color=value=>typeof value==='string'&&/^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%/+\-]+\))$/i.test(value)?value:null;
  /** @param {any} block */
  const declarations=block=>{
    /** @type {Record<string,string>} */const tokens={};
    /** @param {string[]} names @param {any} value */
    const set=(names,value)=>{const valid=color(value);if(valid)for(const name of names)tokens[name]=valid;};
    set(['bg','panel','raised','input','ui-surface','ui-popup'],block?.background?.default);
    set(['text','muted','faint'],block?.foreground?.default);
    set(['accent','accent-hover'],block?.background?.surprise);
    set(['accent-text','focus-border'],block?.foreground?.surprise);
    set(['green','method-get'],block?.background?.success);
    set(['on-success'],block?.foreground?.success);
    set(['success-fill'],block?.background?.success);
    set(['danger','method-delete'],block?.background?.danger);
    set(['on-danger'],block?.foreground?.danger);
    set(['on-accent'],block?.foreground?.surprise);
    set(['danger-fill'],block?.background?.danger);
    set(['method-post'],block?.background?.warning);
    set(['method-put'],block?.background?.info);
    set(['line','ui-border'],block?.highlight?.default);
    set(['hover'],block?.highlight?.xs);
    set(['selected','focus-surface'],block?.highlight?.sm);
    for(const [group,prefix] of [['background','color'],['foreground','color-font'],['highlight','hl']]){
      for(const [name,value] of Object.entries(block?.[group]??{})){
        if(!['default','success','notice','warning','danger','surprise','info','xxs','xs','sm','md','lg','xl'].includes(name))continue;
        const key=name==='default'?(group==='background'?'color-bg':prefix):prefix+'-'+name;
        set([key],value);
        const rgb=channels(value);if(rgb&&color(value))tokens[key+'-rgb']=rgb.join(', ');
      }
    }
    return Object.entries(tokens).map(([key,value])=>'--'+key+':'+value+';').join('');
  };
  const root=declarations({background:{...baseTheme.background,...theme.background},foreground:{...baseTheme.foreground,...theme.foreground},highlight:{...baseTheme.highlight,...theme.highlight}});
  let css=':root:root{'+root+'}';
  const scopes={appHeader:'.app-header',dialog:'.modal',dialogHeader:'.modal-heading',dialogFooter:'.modal-actions',
    dropdown:'.ui-select-shell,.ui-select',editor:'.shared-code-editor',link:'a',pane:'.request-compose,.response-pane',
    paneHeader:'.request-heading,.response-status',sidebar:'.sidebar',sidebarHeader:'.sidebar-heading',sidebarList:'.request-tree',
    tooltip:'[role="tooltip"]'};
  for(const [name,selector] of Object.entries(scopes)){
    const rules=declarations(theme.styles?.[name]??(['dropdown','tooltip'].includes(name)?theme.styles?.dialog:undefined));
    if(rules)css+=selector+'{'+rules+'background-color:var(--bg);color:var(--text);}';
  }
  const backdrop=color(theme.styles?.overlay?.background?.default??theme.styles?.transparentOverlay?.background?.default);
  if(backdrop)css+='.modal::backdrop{background-color:'+backdrop+';}';
  if(typeof theme.rawCss==='string')css+='\n'+theme.rawCss;
  return css;
}
