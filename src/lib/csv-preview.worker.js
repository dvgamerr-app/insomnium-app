import Papa from "papaparse";

self.onmessage = (event) => {
  try {
    if (typeof event.data !== "string") throw new Error("CSV text is required.");
    const parsed = Papa.parse(event.data, {skipEmptyLines:true,dynamicTyping:false});
    self.postMessage({rows:parsed.data,warningCount:parsed.errors.length,
      warnings:parsed.errors.slice(0,10).map((error) => error.message)});
  } catch (error) {
    self.postMessage({error:String(error)});
  }
};
