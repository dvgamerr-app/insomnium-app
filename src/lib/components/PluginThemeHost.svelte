<script>
  import {onMount,untrack} from 'svelte';
  import {workspace,pluginRegistry} from '../workspace.svelte.js';
  import {pluginThemeOptions,pluginThemeCss,pluginThemeScheme} from '../plugin-themes.js';
  /** @type {{onSchemeChange?:(scheme:string)=>void}} */
  let {onSchemeChange=()=>{}}=$props();
  let themes=$state(/** @type {ReturnType<typeof pluginThemeOptions>} */([]));
  let systemScheme=$state('default');
  onMount(()=>{
    const light=window.matchMedia('(prefers-color-scheme: light)'),dark=window.matchMedia('(prefers-color-scheme: dark)');
    const changed=()=>{systemScheme=light.matches?'light':dark.matches?'dark':'default';};
    changed();light.addEventListener('change',changed);dark.addEventListener('change',changed);
    return ()=>{light.removeEventListener('change',changed);dark.removeEventListener('change',changed);};
  });
  onMount(()=>pluginRegistry.subscribe(()=>{themes=pluginThemeOptions(pluginRegistry.captureThemes());}));
  $effect(()=>{
    const settings=workspace.data.settings;
    const requested=settings.autoDetectColorScheme===true&&systemScheme!=='default'
      ?settings[systemScheme==='light'?'lightTheme':'darkTheme']??systemScheme:settings.theme;
    const selected=themes.find(item=>item.value===requested);
    const scheme=selected?pluginThemeScheme(selected.definition.theme):requested==='light'?'light':'dark';
    document.documentElement.dataset.theme=scheme;
    untrack(()=>onSchemeChange(scheme));
    if(!selected)return;
    const style=document.createElement('style');
    style.dataset.pluginTheme=selected.value;
    style.textContent=pluginThemeCss(selected.definition.theme);
    const previousTheme=document.body.getAttribute('theme');
    document.body.setAttribute('theme',selected.definition.name);
    document.head.appendChild(style);
    return ()=>{style.remove();if(previousTheme===null)document.body.removeAttribute('theme');else document.body.setAttribute('theme',previousTheme);};
  });
</script>
