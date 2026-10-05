<script>
  /** @type {{ name: string, size?: number }} */
  let { name, size = 18 } = $props();
  /** @type {Record<string, string>} */
  const paths = {
    home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    branch: "M6 6v12M18 6v3a6 6 0 0 1-6 6H6M9 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    refresh: "M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2",
    search: "m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    folder: "M3 7h7l2 2h9v11H3zM3 7V4h6l3 3",
    chevron: "m9 5 7 7-7 7",
    down: "m6 9 6 6 6-6",
    close: "m6 6 12 12M6 18 18 6",
    send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
    clock: "M12 7v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
    code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
    copy: "M9 9h12v12H9zM15 6V3H3v12h3",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
    upload: "M12 16V4m-5 5 5-5 5 5M3 16v5h18v-5",
    globe:
      "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0M2 12h20M12 2c-6 6-6 14 0 20 6-6 6-14 0-20",
    cookie:
      "M21 11a6 6 0 0 1-8-8A9 9 0 1 0 21 11M8 9h.01M7 15h.01M13 16h.01M13 11h.01",
    moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
    check: "m5 12 4 4L19 6",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    file: "M14 2H4v20h16V8l-6-6v6h6M8 13h8m-8 4h5",
    play: "m8 4 12 8-12 8z",
    stop: "M5 5h14v14H5z",
    help: "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.65"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] || paths.file} /></svg
>
