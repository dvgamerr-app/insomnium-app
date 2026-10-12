import { schemaResourceEvidence } from "../helpers/openapi-schema-resource-contract.js";
import { sourceRangeEvidence } from "../helpers/openapi-source-range-contract.js";
const evidence = document.createElement("pre");
evidence.setAttribute("aria-label", "Schema resource contract evidence");
evidence.textContent = JSON.stringify({
  ...schemaResourceEvidence(),
  sourceRanges: sourceRangeEvidence(),
});
document.body.append(evidence);
