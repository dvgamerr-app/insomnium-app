<script>
  import RequestEditor from "../../../src/lib/components/RequestEditor.svelte";
  import { newRequest } from "../../../src/lib/model.js";
  import {
    encodeGitResource,
    decodeGitResource,
  } from "../../../src/lib/git-resources.js";
  let request = $state(
    newRequest("wrk_body_git", {
      _id: "req_body_git",
      body: {
        mimeType: "application/json",
        text: '{"query":"query { owned }","variables":"{}"}',
        params: [],
        extra: { retained: 42 },
      },
    }),
  );
  function seed(/** @type {string} */ kind) {
    /** @type {Record<string,any>} */
    const body = {
      mimeType: "application/json",
      text: '{"query":"query { owned }","variables":"{}"}',
      params: [],
      extra: { retained: 42 },
    };
    if (kind === "serialized")
      body._openapiSerialization = {
        style: "serialized",
        serializedLevel: "media",
        mediaType: "application/json",
      };
    if (kind === "curl")
      Object.assign(body, {
        curlFileMode: "binary",
        curlSegments: [],
        curlJoin: "",
        curlQuery: true,
        curlFilePrefix: "owned",
        base64: "YQ==",
        fileName: "owned.txt",
      });
    request = newRequest("wrk_body_git", { _id: "req_body_git", body });
  }
  const evidence = $derived.by(() => {
    const undefinedKeys = Object.keys(request.body).filter(
      (key) => request.body[key] === undefined,
    );
    try {
      const file = encodeGitResource(request);
      const restored = decodeGitResource(file.path, file.content);
      return JSON.stringify({
        passed: true,
        body: request.body,
        keys: Object.keys(request.body),
        undefinedKeys,
        restored,
      });
    } catch (error) {
      return JSON.stringify({
        passed: false,
        body: request.body,
        keys: Object.keys(request.body),
        undefinedKeys,
        error: String(error),
      });
    }
  });
</script>

<section aria-label="Request body Git compatibility">
  {#each ["ordinary", "serialized", "curl"] as kind}<button
      onclick={() => seed(kind)}>Seed {kind} body</button
    >{/each}
  <RequestEditor
    {request}
    onchange={(patch) => (request = { ...request, ...patch })}
  />
  <pre aria-label="Body Git evidence">{evidence}</pre>
</section>
