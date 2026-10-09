import { schemaResourceEvidence } from "../helpers/openapi-schema-resource-contract.js";
const evidence = document.createElement("pre");
evidence.setAttribute("aria-label", "Schema resource contract evidence");
evidence.textContent = JSON.stringify(schemaResourceEvidence());
document.body.append(evidence);
