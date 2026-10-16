/** @param {Record<string,any>|undefined} response */
export function responseMime(response) {
  return String(response?.headers?.find(
    (/** @type {string[]} */ header) => header[0].toLowerCase() === "content-type",
  )?.[1] || "").split(";", 1)[0].trim().toLowerCase();
}

/** Match the legacy viewer's JSON-first and first100byte HTML doctype detection.
 * The declared MIME remains available independently for headers and downloads.
 * @param {Record<string,any>|undefined} response */
export function responsePreviewMime(response) {
  const declared=responseMime(response), body=response?.body;
  if (typeof body!=='string' || !body) return declared;
  try {JSON.parse(body);return 'application/json';} catch {}
  const prefix=new TextDecoder().decode(new TextEncoder().encode(body.slice(0,100)).subarray(0,100)).trim();
  return /^<!doctype html.*>/i.test(prefix)?'text/html':declared;
}

/** Build only local visual content; the caller owns the restrictive sandbox.
 * @param {Record<string,any>|undefined} response */
export function responseVisual(response) {
  const mime = responsePreviewMime(response);
  if (mime === "text/html")
    return {title:"HTML response preview",html:String(response?.body || "")};
  if (!/^(?:image|audio)\/[a-z0-9.+-]+$/.test(mime)) return null;
  const audio = mime.startsWith("audio/");
  const title = audio ? "Audio response preview" : "Image response preview";
  const bytes = response?.bodyBase64;
  if (typeof bytes !== "string" || !bytes || bytes.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(bytes))
    return {title,html:"<p>Original media bytes are unavailable or invalid. Source and Raw remain available.</p>"};
  // MIME and Base64 are constrained above before entering attribute markup.
  // The source comes from saved bytes, never the request URL or decoded text.
  if (audio) return {title,html:'<style>body{margin:16px}audio{width:100%}</style><audio aria-label="Response audio" controls preload="metadata" src="data:' + mime + ';base64,' + bytes + '"></audio>'};
  return {title,html:'<style>body{margin:16px}img{max-width:100%;height:auto}</style><img alt="Response image" src="data:' + mime + ';base64,' + bytes + '">'};
}
