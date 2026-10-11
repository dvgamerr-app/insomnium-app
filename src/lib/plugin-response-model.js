/** Adapt captured HTTP history to the legacy response fields. Body bytes are
 * delivered separately for the guest's synchronous getBodyBuffer cache.
 * @param {Record<string,any>|null|undefined} entry */
export function pluginResponseEnvelope(entry) {
  if (!entry) return { response: null, body: null };
  if (
    typeof entry._id !== "string" ||
    !entry._id ||
    typeof entry.requestId !== "string"
  )
    throw Error("Invalid plugin response identity");
  const headers = (entry.headers ?? []).map((/** @type {any} */ row) =>
    Array.isArray(row)
      ? { name: String(row[0]), value: String(row[1]) }
      : structuredClone(row),
  );
  const path = "insomnium-response:" + entry._id;
  const response = {
    _id: entry._id,
    type: "Response",
    parentId: entry.requestId,
    created: entry.created,
    modified: entry.modified ?? entry.created,
    environmentId: entry.environmentId,
    statusCode: entry.status ?? 0,
    statusMessage: entry.statusText ?? "",
    httpVersion: entry.httpVersion ?? "",
    url: entry.url ?? "",
    headers,
    elapsedTime: entry.elapsedMs ?? 0,
    contentType:
      headers.find(
        (/** @type {any} */ row) => row.name.toLowerCase() === "content-type",
      )?.value ?? "",
    bytesContent: entry.size ?? -1,
    bytesRead: entry.bytesRead ?? 0,
    bodyPath: path,
    bodyCompression: null,
    error: entry.error ?? "",
    requestVersionId: entry.requestVersionId ?? null,
    timelinePath: "",
    settingStoreCookies: entry.settingStoreCookies ?? null,
    settingSendCookies: entry.settingSendCookies ?? null,
  };
  return {
    response,
    body: {
      path,
      base64: typeof entry.bodyBase64 === "string" ? entry.bodyBase64 : null,
    },
  };
}

/** Operation-local transfer cache; paths are admitted only by a response returned
 * to this dispatcher. Every RPC chunk fits the existing 1 MiB value codec.
 * @returns {{packet:(entry:Record<string,any>|null|undefined)=>any,chunk:(args:any[])=>string}} */
export function createPluginResponseTransfer() {
  const chunkSize = 262144,
    maxBody = 20 * 1024 * 1024;
  const bodies = new Map();
  let retained = 0;
  return {
    packet(entry) {
      const packet = /** @type {any} */ (pluginResponseEnvelope(entry));
      const body = packet.body;
      if (!body || typeof body.base64 !== "string") return packet;
      const text = body.base64;
      const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
      if (
        text.length > Math.ceil(maxBody / 3) * 4 ||
        text.length % 4 ||
        /[^A-Za-z0-9+/]/.test(text.slice(0, text.length - padding)) ||
        (padding && text.length < 4)
      )
        throw Error("Invalid or oversized plugin response body");
      const size = (text.length / 4) * 3 - padding;
      if (size > maxBody) throw Error("Plugin response body exceeds 20 MiB");
      if (text.length <= chunkSize) return packet;
      const next =
        retained - (bodies.get(body.path)?.length ?? 0) + text.length;
      if (next > Math.ceil((64 * 1024 * 1024) / 3) * 4)
        throw Error("Plugin response transfer cache exceeds 64 MiB");
      bodies.set(body.path, text);
      retained = next;
      packet.body = {
        path: body.path,
        length: text.length,
        bytes: size,
        chunkSize,
      };
      return packet;
    },
    chunk(args) {
      const [path, offset] = args;
      const text = bodies.get(path);
      if (
        args.length !== 2 ||
        typeof path !== "string" ||
        !text ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset >= text.length ||
        offset % chunkSize
      )
        throw Error("Invalid plugin response chunk");
      return text.slice(offset, offset + chunkSize);
    },
  };
}
