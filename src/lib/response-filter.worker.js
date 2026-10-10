import { filterTemplateResponse } from "./template-response-filter.js";
import { filterJsonResponse } from "./response-filter.js";
import { filterXmlResponse } from "./xml-response-filter.js";
import { xmlPrettify } from "./xml-prettify.js";

self.onmessage = (event) => {
  try {
    const { body, path, kind, namespaces } = event.data;
    if (kind === "template") {
      self.postMessage({ text: filterTemplateResponse(body, path) });
      return;
    }
    if (kind === "xml") {
      const selected = path.trim()
        ? filterXmlResponse(body, path, namespaces)
        : body;
      try {
        self.postMessage({ text: xmlPrettify(selected) });
      } catch (error) {
        self.postMessage({ text: selected, warning: String(error) });
      }
    } else self.postMessage({ text: filterJsonResponse(body, path) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
