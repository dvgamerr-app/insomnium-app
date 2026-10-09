import { booleanSchemaEvidence } from "../helpers/openapi-boolean-schema-contract.js";
import { mount } from "svelte";
import BooleanReview from "./boolean-schema-review.svelte";
import "../../../src/lib/styles.css";
const evidence = document.createElement("pre");
evidence.setAttribute("aria-label", "Boolean schema contract evidence");
try {
  evidence.textContent = JSON.stringify(booleanSchemaEvidence());
} catch (error) {
  evidence.textContent = JSON.stringify({
    passed: false,
    error: String(error),
  });
}
document.body.append(evidence);
const host = document.createElement("div");
document.body.append(host);
mount(BooleanReview, { target: host });
