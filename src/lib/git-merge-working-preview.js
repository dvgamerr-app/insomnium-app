import { snapshotGitCollection } from "./git-collection.js";
import { decodeGitResource, parseGitResourcePath } from "./git-resources.js";

/** Detached public-record previews; protected/private/foreign records get no content.
 * Bounds limit display copies, not the full reconciliation or chosen resource.
 * @param {any[]} resources @param {string} workspaceId
 * @param {{path:string,content:string}[]} baseFiles @param {{path:string,content:string}[]} incomingFiles
 * @param {{id:string,reason:string}[]} conflicts */
export function workingConflictPreviews(resources, workspaceId, baseFiles, incomingFiles, conflicts) {
  if (!conflicts.length) return [];
  /** @param {{path:string,content:string}[]} files */
  const index = files => new Map(files.flatMap(file => {
    const path = parseGitResourcePath(file.path);
    return path ? [[path.id, file]] : [];
  }));
  const base = index(baseFiles), incoming = index(incomingFiles);
  const local = index(snapshotGitCollection(resources, workspaceId).files);
  let remaining = 2 * 1024 * 1024;
  /** @param {{path:string,content:string}|undefined} file */
  function preview(file) {
    if (!file) return { present:false, content:null, omitted:false };
    const size = new TextEncoder().encode(file.content).length;
    if (size > 256 * 1024 || size > remaining) return { present:true, content:null, omitted:true };
    remaining -= size;
    return { present:true, content:file.content, omitted:false };
  }
  return conflicts.map(conflict => {
    if (conflict.reason !== "local-and-incoming-changed") return { ...conflict, name:conflict.id };
    const prior = base.get(conflict.id), now = local.get(conflict.id), next = incoming.get(conflict.id);
    const file = now || next || prior;
    const record = file ? decodeGitResource(file.path, file.content) : null;
    const name = typeof record?.name === "string" && record.name ? record.name.slice(0,200) : conflict.id;
    return { ...conflict, name, preview:{ base:preview(prior), local:preview(now), incoming:preview(next) } };
  });
}
