<script>
  import RequestEditor from "../../../src/lib/components/RequestEditor.svelte";
  import { newRequest } from "../../../src/lib/model.js";
  let request = $state(
    newRequest("wrk_bool_review", {
      _id: "req_bool_review",
      name: "Durable boolean review",
      url: "http://127.0.0.1/owned",
      _openapiSchemaIssues: [
        "Schema accepts no value for the requested request body sample.",
      ],
      body: { mimeType: "application/json", text: "null" },
    }),
  );
</script>

<section aria-label="Boolean schema review fixture">
  <RequestEditor
    {request}
    onchange={(patch) => (request = { ...request, ...patch })}
  />
  <pre aria-label="Boolean schema review evidence">{JSON.stringify(
      request,
    )}</pre>
</section>
