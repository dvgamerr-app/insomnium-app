/** Resolve read-only legacy util.models calls against the operation's saved
 * workspace snapshot. The callback bridge must guard ownership before/after
 * dispatch; this module does not grant access to live workspace state.
 * @param {{resources:Record<string,any>[],history?:Record<string,any>[],settings?:Record<string,any>}} data
 * @param {string} method @param {any[]} args */
export function resolvePluginModelRead(data, method, args) {
  if (!Array.isArray(data?.resources) || !Array.isArray(args))
    throw Error("Invalid plugin model snapshot");
  const methods = [
    "request.getById",
    "request.getAncestors",
    "workspace.getById",
    "oAuth2Token.getByRequestId",
    "response.getLatestForRequestId",
  ];
  if (!methods.includes(method)) throw Error("Unsupported plugin model read");
  const response = method === "response.getLatestForRequestId";
  if (args.length !== 1 && !(response && args.length === 2))
    throw Error("Invalid plugin model arguments");
  const value = args[0];
  const id = method === "request.getAncestors" ? value?._id : value;
  if (typeof id !== "string" || !id || id.length > 1024)
    throw Error("Invalid plugin model ID");
  if (
    response &&
    args.length === 2 &&
    args[1] !== null &&
    args[1] !== undefined &&
    typeof args[1] !== "string"
  )
    throw Error("Invalid response environment ID");
  const resources = data.resources;
  let result;
  switch (method) {
    case "request.getById":
      result =
        resources.find((r) => r._type === "request" && r._id === id) ?? null;
      break;
    case "workspace.getById":
      result =
        resources.find((r) => r._type === "workspace" && r._id === id) ?? null;
      break;
    case "oAuth2Token.getByRequestId":
      result =
        resources.find(
          (r) => r._type === "oauth2_token" && r.parentId === id,
        ) ?? null;
      break;
    case "request.getAncestors": {
      // Legacy accepts a request document, including a caller's edited parent.
      // Parent lookup still resolves only against the operation snapshot.
      if (value.parentId != null && typeof value.parentId !== "string")
        throw Error("Invalid plugin request parent ID");
      const ancestors = [],
        seen = new Set([id]);
      let parentId = value.parentId;
      while (parentId) {
        if (seen.has(parentId)) throw Error("Cyclic plugin request ancestry");
        seen.add(parentId);
        const parent = resources.find(
          (r) =>
            r._id === parentId &&
            ["request_group", "workspace"].includes(r._type),
        );
        if (!parent) break;
        ancestors.push(parent);
        parentId = parent.parentId;
      }
      result = ancestors;
      break;
    }
    case "response.getLatestForRequestId": {
      // Legacy model reads filter by environment only when that setting is on;
      // response template tags have their own stricter environment contract.
      result =
        (data.history ?? [])
          .filter(
            (r) =>
              r.requestId === id &&
              (!r.protocol || r.protocol === "http") &&
              (!data.settings?.filterResponsesByEnv ||
                r.environmentId === args[1]),
          )
          .sort(
            (a, b) =>
              (b.modified ?? b.created ?? 0) - (a.modified ?? a.created ?? 0),
          )[0] ?? null;
      break;
    }
  }
  // Every call owns its result. A guest edit cannot change the snapshot or a
  // subsequent call; the value codec remains the bridge's separate byte bound.
  return structuredClone(result);
}
