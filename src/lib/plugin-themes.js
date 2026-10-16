/** Stable IDs distinguish equal theme names from different packages.
 * @param {{plugin:string,definition:any}[]} themes */
export function pluginThemeOptions(themes){
  const seen=new Set();
  return themes.filter(item=>item.definition?.name).map(item=>({
    ...item,value:'plugin:'+encodeURIComponent(item.plugin)+':'+encodeURIComponent(item.definition.name),
    label:(item.definition.displayName||item.definition.name)+' · '+item.plugin,
  })).filter(item=>{if(seen.has(item.value))return false;seen.add(item.value);return true;});
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
    set(['green','method-get'],block?.foreground?.success);
    set(['success-fill'],block?.background?.success);
    set(['danger','method-delete'],block?.foreground?.danger);
    set(['danger-fill'],block?.background?.danger);
    set(['method-post'],block?.foreground?.warning);
    set(['method-put'],block?.foreground?.info);
    set(['line','ui-border'],block?.highlight?.default);
    set(['hover'],block?.highlight?.xs);
    set(['selected','focus-surface'],block?.highlight?.sm);
    return Object.entries(tokens).map(([key,value])=>'--'+key+':'+value+';').join('');
  };
  const root=declarations(theme);
  let css=':root:root{'+root+'}';
  const scopes={appHeader:'.app-header',dialog:'.modal',dialogHeader:'.modal-heading',dialogFooter:'.modal-actions',
    dropdown:'.ui-select-shell,.ui-select',editor:'.shared-code-editor',link:'a',pane:'.request-compose,.response-pane',
    paneHeader:'.request-heading,.response-status',sidebar:'.sidebar',sidebarHeader:'.sidebar-heading',sidebarList:'.request-tree',
    tooltip:'[role="tooltip"]'};
  for(const [name,selector] of Object.entries(scopes)){
    const rules=declarations(theme.styles?.[name]);
    if(rules)css+=selector+'{'+rules+'background-color:var(--bg);color:var(--text);}';
  }
  const backdrop=color(theme.styles?.overlay?.background?.default??theme.styles?.transparentOverlay?.background?.default);
  if(backdrop)css+='.modal::backdrop{background-color:'+backdrop+';}';
  if(typeof theme.rawCss==='string')css+='\n'+theme.rawCss;
  return css;
}
