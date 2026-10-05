<script>
  import GlyphHome from "@lucide/svelte/icons/house";
  import GlyphPlus from "@lucide/svelte/icons/plus";
  import GlyphMinus from "@lucide/svelte/icons/minus";
  import GlyphBranch from "@lucide/svelte/icons/git-branch";
  import GlyphRefresh from "@lucide/svelte/icons/refresh-cw";
  import GlyphSearch from "@lucide/svelte/icons/search";
  import GlyphFolder from "@lucide/svelte/icons/folder";
  import GlyphChevron from "@lucide/svelte/icons/chevron-right";
  import GlyphDown from "@lucide/svelte/icons/chevron-down";
  import GlyphClose from "@lucide/svelte/icons/x";
  import GlyphSend from "@lucide/svelte/icons/send";
  import GlyphSettings from "@lucide/svelte/icons/settings";
  import GlyphClock from "@lucide/svelte/icons/clock";
  import GlyphCode from "@lucide/svelte/icons/code-xml";
  import GlyphCopy from "@lucide/svelte/icons/copy";
  import GlyphTrash from "@lucide/svelte/icons/trash-2";
  import GlyphDownload from "@lucide/svelte/icons/download";
  import GlyphUpload from "@lucide/svelte/icons/upload";
  import GlyphGlobe from "@lucide/svelte/icons/globe";
  import GlyphCookie from "@lucide/svelte/icons/cookie";
  import GlyphMoon from "@lucide/svelte/icons/moon";
  import GlyphSun from "@lucide/svelte/icons/sun";
  import GlyphCheck from "@lucide/svelte/icons/check";
  import GlyphMore from "@lucide/svelte/icons/ellipsis";
  import GlyphFile from "@lucide/svelte/icons/file-text";
  import GlyphPlay from "@lucide/svelte/icons/play";
  import GlyphStop from "@lucide/svelte/icons/square";
  import GlyphHelp from "@lucide/svelte/icons/circle-help";
  import GlyphLoader from "@lucide/svelte/icons/loader-circle";
  import GlyphArrowUp from "@lucide/svelte/icons/arrow-up";
  import GlyphArrowDown from "@lucide/svelte/icons/arrow-down";
  import GlyphDot from "@lucide/svelte/icons/dot";
  /** @type {{name:string,size?:number,class?:string}} */
  let { name, size = 18, class: className = "" } = $props();
  /** @type {Record<string,typeof GlyphHome>} */
  const icons = {
    home: GlyphHome,
    plus: GlyphPlus,
    minus: GlyphMinus,
    branch: GlyphBranch,
    refresh: GlyphRefresh,
    search: GlyphSearch,
    folder: GlyphFolder,
    chevron: GlyphChevron,
    down: GlyphDown,
    close: GlyphClose,
    send: GlyphSend,
    settings: GlyphSettings,
    clock: GlyphClock,
    code: GlyphCode,
    copy: GlyphCopy,
    trash: GlyphTrash,
    download: GlyphDownload,
    upload: GlyphUpload,
    globe: GlyphGlobe,
    cookie: GlyphCookie,
    moon: GlyphMoon,
    sun: GlyphSun,
    check: GlyphCheck,
    more: GlyphMore,
    file: GlyphFile,
    play: GlyphPlay,
    stop: GlyphStop,
    help: GlyphHelp,
    loader: GlyphLoader,
    arrowUp: GlyphArrowUp,
    arrowDown: GlyphArrowDown,
    dot: GlyphDot,
  };
  const Glyph = $derived(icons[name] || GlyphFile);
</script>

<Glyph
  {size}
  strokeWidth={1.65}
  class={className}
  aria-hidden="true"
  focusable="false"
/>
