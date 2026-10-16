/** Read NeDB append-only files without loading NeDB (which compacts files on load).
 * Sources: seald/nedb lib/persistence.js + legacy common/database.ts.
 * @param {{name: string, text: string}[]} files
 */
export function parseLegacyFiles(files) {
  /** @type {Record<string, any>[]} */
  const resources = [];
  for (const file of files) {
    /** @type {Map<string, {record:Record<string, any>,line:number}>} */
    const records = new Map();
    const lines = file.text.replace(/^\uFEFF/, "").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      let record;
      try {
        record = JSON.parse(lines[i]);
      } catch {
        throw new Error(
          `${file.name}, line ${i + 1}: invalid JSON. Import stopped; the source was not changed.`,
        );
      }
      if (!record || typeof record !== "object" || Array.isArray(record))
        throw new Error(`${file.name}, line ${i + 1}: expected a legacy record object. Import stopped; the source was not changed.`);
      if (record.$$indexCreated || record.$$indexRemoved) continue;
      if (typeof record._id !== "string" || !record._id)
        throw new Error(`${file.name}, line ${i + 1}: missing record ID`);
      if (record.$$deleted === true) records.delete(record._id);
      else records.set(record._id, {record, line:i + 1});
    }
    for (const {record, line} of records.values()) {
      const originalType =
        record.type || file.name.match(/insomnia\.(.+)\.db$/)?.[1];
      if (typeof originalType !== "string" || !originalType.trim())
        throw new Error(`${file.name}, line ${line}: cannot identify legacy model type. Import stopped; the source was not changed.`);
      const type = originalType
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .replace(/^web_socket/, "websocket");
      resources.push({
        ...record,
        _type: type,
        _legacySource: { fileName: file.name, record: structuredClone(record) },
      });
    }
  }
  return { _type: "export", __export_format: 4, resources };
}
