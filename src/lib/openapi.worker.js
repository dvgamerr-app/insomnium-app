import { analyzeSpec, generateRequests } from "./openapi.js";
self.onmessage = (event) => {
  try {
    const analysis = analyzeSpec(event.data.spec);
    const resources = event.data.generate
      ? generateRequests(
          analysis,
          event.data.workspaceId,
          event.data.spec._id,
          event.data.serverOverride,
          event.data.exampleSelections,
        )
      : null;
    self.postMessage({ analysis, resources });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
