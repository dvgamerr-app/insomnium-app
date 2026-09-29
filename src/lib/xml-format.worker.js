import { xmlPrettify } from "./xml-prettify.js";

self.onmessage = (event) => {
  try {
    self.postMessage({ text: xmlPrettify(event.data.text, event.data.indent) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
