import { dynamicSchemaEvidence } from "../helpers/openapi-dynamic-schema-contract.js";
const evidence = document.createElement("pre");
evidence.setAttribute("aria-label", "Dynamic schema contract evidence");
try {
  evidence.textContent = JSON.stringify(dynamicSchemaEvidence());
} catch (error) {
  evidence.textContent = JSON.stringify({
    passed: false,
    error: String(error),
  });
}
document.body.append(evidence);
