<script>
  import { indexWorkspaces, workspaceFor } from "../../../src/lib/model.js";
  const seed = () => [
    {
      _id: "nested",
      _type: "request",
      parentId: "folder",
      body: { text: "original" },
    },
    { _id: "folder", _type: "request_group", parentId: "A" },
    { _id: "A", _type: "workspace", parentId: null },
    { _id: "B", _type: "workspace", parentId: null },
    { _id: "grpc", _type: "grpc_request", parentId: "B" },
    { _id: "ws", _type: "websocket_request", parentId: "A" },
    { _id: "env", _type: "environment", parentId: "A" },
    { _id: "subenv", _type: "environment", parentId: "env" },
  ];
  let resources = $state(/** @type {Record<string,any>[]} */ (seed()));
  const index = $derived(indexWorkspaces(resources));
  const memberships = $derived(Object.fromEntries(index));
  const requestsA = $derived(
    resources
      .filter(
        (r) =>
          ["request", "grpc_request", "websocket_request"].includes(r._type) &&
          index.get(r._id) === "A",
      )
      .map((r) => r._id),
  );
  const requestsB = $derived(
    resources
      .filter(
        (r) =>
          ["request", "grpc_request", "websocket_request"].includes(r._type) &&
          index.get(r._id) === "B",
      )
      .map((r) => r._id),
  );
  const environmentsA = $derived(
    resources
      .filter((r) => r._type === "environment" && index.get(r._id) === "A")
      .map((r) => r._id),
  );
  const rows = /** @type {Record<string,any>[]} */ ([]);
  function contracts() {
    const malformed = [
      { _id: "orphan", _type: "request", parentId: "missing" },
      { _id: "cycle-a", _type: "request_group", parentId: "cycle-b" },
      { _id: "cycle-b", _type: "request_group", parentId: "cycle-a" },
      { _id: "cycle-child", _type: "request", parentId: "cycle-a" },
      { _id: "self", _type: "request", parentId: "self" },
      { _id: "dup", _type: "request", parentId: "A" },
      { _id: "dup", _type: "workspace", parentId: null },
      { _id: "root-loop", _type: "workspace", parentId: "root-loop" },
    ];
    const normal = seed();
    const all = [...normal, ...malformed];
    const indexed = indexWorkspaces(all);
    const expected = {
      nested: "A",
      folder: "A",
      A: "A",
      B: "B",
      grpc: "B",
      ws: "A",
      env: "A",
      subenv: "A",
      orphan: "",
      "cycle-a": "",
      "cycle-b": "",
      "cycle-child": "",
      self: "",
      dup: "A",
      "root-loop": "root-loop",
    };
    for (const [id, owner] of Object.entries(expected))
      rows.push({
        name: id,
        expected: owner,
        actual: indexed.get(id),
        legacy: workspaceFor(all, id),
      });
    let random = 42;
    const graph = /** @type {Record<string,any>[]} */ ([]);
    for (let i = 0; i < 300; i++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      graph.push({
        _id: "graph-" + i,
        _type: i % 43 === 0 ? "workspace" : "request_group",
        parentId: "graph-" + (random % 320),
      });
    }
    const graphIndex = indexWorkspaces(graph);
    for (const r of graph)
      rows.push({
        name: r._id,
        actual: graphIndex.get(r._id),
        expected: workspaceFor(graph, r._id),
      });
    const count = 20000;
    let reads = 0;
    const deep = Array.from({ length: count }, (_, i) => ({
      get _id() {
        reads++;
        return "deep-" + i;
      },
      get _type() {
        reads++;
        return i === count - 1 ? "workspace" : "request_group";
      },
      get parentId() {
        reads++;
        return i === count - 1 ? null : "deep-" + (i + 1);
      },
    }));
    const started = performance.now();
    const deepIndex = indexWorkspaces(deep);
    rows.push({
      name: "deep-chain",
      actual: deepIndex.get("deep-0"),
      expected: "deep-19999",
      count,
      size: deepIndex.size,
      reads,
      readLimit: count * 5,
      elapsedMs: performance.now() - started,
    });
    return rows;
  }
  const evidence = contracts();
  /** @param {string} id @param {Record<string,any>} patch */
  function patch(id, patch) {
    const r = resources.find((r) => r._id === id);
    if (r) Object.assign(r, patch);
  }
</script>

<pre aria-label="Index contract evidence">{JSON.stringify(evidence)}</pre>
<pre aria-label="Reactive index evidence">{JSON.stringify({
    memberships,
    requestsA,
    requestsB,
    environmentsA,
  })}</pre>
<button onclick={() => patch("folder", { parentId: "B" })}>Move folder</button>
<button onclick={() => patch("env", { parentId: "B" })}>Move environment</button
>
<button onclick={() => patch("B", { _type: "request_group" })}
  >Change collection type</button
>
<button onclick={() => patch("B", { _type: "workspace" })}
  >Restore collection type</button
>
<button onclick={() => patch("nested", { _id: "renamed" })}
  >Rename resource ID</button
>
<button
  onclick={() =>
    resources.push({ _id: "added", _type: "request", parentId: "A" })}
  >Add request</button
>
<button
  onclick={() =>
    resources.splice(
      resources.findIndex((r) => r._id === "added"),
      1,
    )}>Remove request</button
>
<button onclick={() => (resources = seed())}>Replace resources</button>
<button onclick={() => patch("nested", { body: { text: "changed" } })}
  >Edit body</button
>
