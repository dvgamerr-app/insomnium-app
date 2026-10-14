import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { retainedHistory } from "./model.js";

/** Project the existing retention policy without evicting any saved user reply.
 * A detached signature makes Apply reject a review changed by background work.
 * @param {Record<string,any>} data
 * @param {{history?:Record<string,any>[]}} review */
export function reviewImportedHistory(data, review) {
  /** @type {Record<string,any>[]} */ const existing = data.history || [];
  const candidates = review.history || [];
  const retained = retainedHistory([...existing, ...candidates], data.settings);
  const kept = new Set(retained.map((/** @type {Record<string,any>} */ entry) => entry._id));
  const missingExisting = existing.filter((entry) => !kept.has(entry._id));
  const accepted = candidates.filter((entry) => kept.has(entry._id));
  const excluded = candidates.filter((entry) => !kept.has(entry._id));
  const signature = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify({
    history: existing,
    maxHistory: data.settings.maxHistory,
    filterResponsesByEnv: data.settings.filterResponsesByEnv,
  }))));
  return {
    signature,
    accepted,
    excluded,
    blocked: missingExisting.length > 0,
    warnings: [
      ...(missingExisting.length ? ["Existing saved history exceeds the current retention settings. Save or adjust it before importing; no existing reply will be removed by this import."] : []),
      ...(excluded.length ? [`${excluded.length} imported replies will remain as preserved response records, outside active history, because of the current history limit or 40 MiB history budget. Their loaded response files remain included in the collection export.`] : []),
    ],
  };
}
