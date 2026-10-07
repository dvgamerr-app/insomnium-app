/** Validate display data against the exact native conflict descriptors.
 * Display data never authorizes a resolution or ref/workspace mutation.
 * @param {any} candidate */
export function validateMergeConflictContents(candidate) {
  const fileLimit = 256 * 1024, totalLimit = 2 * 1024 * 1024;
  const fullOid = (/** @type {any} */ value) => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
  const fail = () => { throw new Error("Native merge returned invalid conflict content."); };
  const objects = new Map();
  for (const conflict of candidate.conflicts) {
    if (!conflict || ![conflict.ancestor, conflict.ours, conflict.theirs].some(Boolean)) fail();
    for (const entry of [conflict.ancestor, conflict.ours, conflict.theirs].filter(Boolean)) {
      if (!fullOid(entry.oid) || !Array.isArray(entry.path) || !entry.path.length || entry.path.length > 4096 ||
          entry.path.some((/** @type {any} */ byte) => !Number.isInteger(byte) || byte < 1 || byte > 255) ||
          ![0o100644, 0o100755, 0o120000, 0o160000].includes(entry.mode)) fail();
      const gitlink = entry.mode === 0o160000;
      if (objects.has(entry.oid) && objects.get(entry.oid) !== gitlink) fail();
      objects.set(entry.oid, gitlink);
    }
  }
  if (!Array.isArray(candidate.conflictContents) || candidate.conflictContents.length !== objects.size) fail();
  const seen = new Set();
  let loaded = 0;
  for (const item of candidate.conflictContents) {
    if (!item || !objects.has(item.oid) || seen.has(item.oid)) fail();
    seen.add(item.oid);
    if (objects.get(item.oid)) {
      if (item.kind !== "gitlink" || item.size !== null || item.text !== null || item.previewHex !== null) fail();
      continue;
    }
    if (!Number.isSafeInteger(item.size) || item.size < 0) fail();
    if (item.kind === "text") {
      if (typeof item.text !== "string" || item.text.includes("\0") || item.previewHex !== null ||
          new TextEncoder().encode(item.text).length !== item.size || item.size > fileLimit) fail();
      loaded += item.size;
    } else if (item.kind === "binary") {
      if (item.text !== null || typeof item.previewHex !== "string" || !/^[0-9a-f]*$/.test(item.previewHex) ||
          item.previewHex.length !== Math.min(item.size, 128) * 2 || item.size > fileLimit) fail();
      loaded += item.size;
    } else if (item.kind === "tooLarge" || item.kind === "budgetExceeded") {
      if (item.text !== null || item.previewHex !== null ||
          (item.kind === "tooLarge" ? item.size <= fileLimit : item.size > fileLimit)) fail();
    } else fail();
    if (loaded > totalLimit) fail();
  }
}
