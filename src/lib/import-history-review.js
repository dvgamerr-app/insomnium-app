import { legacyPreferenceCandidate } from "./legacy-preferences.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { retainedHistory } from "./model.js";

/** Project the existing retention policy without evicting any saved user reply.
 * A detached signature makes Apply reject a review changed by background work.
 * @param {Record<string,any>} data
 * @param {{history?:Record<string,any>[],resources?:Record<string,any>[]}} review
 * @param {{preferences?:boolean}} [options] */
export function reviewImportedHistory(data, review, options = {}) {
  const preferences = options.preferences ? legacyPreferenceCandidate(review.resources || []) : null;
  const settingsPatch = preferences?.patch || {};
  const preferencesBlocked = preferences !== null && !preferences.canApply;
  /** @type {Record<string,any>[]} */ const existing = data.history || [];
  const candidates = review.history || [];
  const retained = retainedHistory([...existing, ...candidates], {...data.settings,...settingsPatch});
  const kept = new Set(retained.map((/** @type {Record<string,any>} */ entry) => entry._id));
  const missingExisting = existing.filter((entry) => !kept.has(entry._id));
  const accepted = candidates.filter((entry) => kept.has(entry._id));
  const excluded = candidates.filter((entry) => !kept.has(entry._id));
  const signature = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify({
    history: existing,
    maxHistory: data.settings.maxHistory,
    filterResponsesByEnv: data.settings.filterResponsesByEnv,
    ...(preferences ? {preferences: data.settings, settingsPatch} : {}),
  }))));
  return {
    signature,
    settingsPatch,
    preferencesBlocked,
    accepted,
    excluded,
    blocked: missingExisting.length > 0 || preferencesBlocked,
    warnings: [
      ...(preferences && !preferences.canApply ? ["Compatible preferences cannot be applied from this review."] : []),
      ...(missingExisting.length ? ["Existing saved history exceeds the current retention settings. Save or adjust it before importing; no existing reply will be removed by this import."] : []),
      ...(excluded.length ? [`${excluded.length} imported replies will remain as preserved response records, outside active history, because of the current history limit or 40 MiB history budget. Their loaded response files remain included in the collection export.`] : []),
    ],
  };
}

/** Shared import commit. Refuse collisions/retention loss before any mutation.
 * @param {Record<string,any>} data @param {{resources:Record<string,any>[],history?:Record<string,any>[]}} review
 * @param {{preferences?:boolean}} [options] */
export function applyImportedData(data,review,options = {}){
  const checked=reviewImportedHistory(data,review,options);
  if(checked.blocked)throw Error(checked.preferencesBlocked ? 'Compatible app preferences cannot be applied from this review.' : 'Import would remove existing saved history. Adjust retention before importing.');
  const ids=new Set(data.resources.map((/** @type {any} */r)=>r._id));
  for(const resource of review.resources){
    if(typeof resource._id!=='string'||!resource._id||ids.has(resource._id))throw Error('Import resource ID collision. Review the import again.');
    ids.add(resource._id);
  }
  data.resources.push(...review.resources);
  data.history.push(...checked.accepted);
  for(const meta of review.resources.filter(r=>r._type==='request_meta'))
    if(checked.accepted.some(entry=>entry._id===meta.activeResponseId&&entry.requestId===meta.parentId))
      data.responseSelections[meta.parentId]=meta.activeResponseId;
  Object.assign(data.settings,checked.settingsPatch);
  return checked;
}
