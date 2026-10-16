import reference from "../fixtures/grpc-reflection-service-reference.json" with { type: "json" };
import { profileGrpcFrame } from "./grpc-reflection-profile-case-data.js";
/** @type {Map<string,Record<string,any>>} */
const cases = new Map();
/** @param {typeof reference.rows[number]} row @param {Record<string,any>} [extra] */
function add(row, extra = {}) {
  const scope = reference.scopes.find((scope) => scope.scope === row.scope);
  if (!scope) throw Error("Missing service root oracle");
  const kind = row.scope.startsWith("extras-") ? "extras-" : "isolated-";
  const roots = reference.scopes.filter((scope) =>
    scope.scope.startsWith(kind),
  );
  const mode = "legacy-service-" + (cases.size + 1);
  cases.set(mode, {
    mode,
    reflection: true,
    jsonMode: "legacy",
    unary: true,
    receives: true,
    editor: true,
    showNotice: false,
    service: row.service,
    services: roots.map((root) => root.service),
    discoveryFileGroups: Object.fromEntries(
      roots.map((root) => [root.service, root.initialFiles]),
    ),
    omitPreviouslySent: true,
    descriptorSet: reference.combinedDescriptorSet,
    body: row.body,
    formattedBody: JSON.stringify(JSON.parse(row.body), null, 2),
    wire: profileGrpcFrame(Buffer.from(row.wireHex, "hex")),
    responseText: row.json,
    preview: JSON.stringify(JSON.parse(row.json), null, 2),
    method: "/" + row.service + "/Call",
    referenceLabel: row.label,
    expectedServiceFiles: scope.fileOrder,
    ...extra,
  });
}
for (const row of reference.rows) add(row);
for (const scope of [
  "isolated-alpha",
  "isolated-beta",
  "extras-alpha",
  "extras-beta",
]) {
  const row = reference.rows.find((row) => row.label === scope + ":Payload");
  if (!row) throw Error("Missing reverse-list oracle");
  add(row, {
    services: ["ownedclosure.beta.Echo", "ownedclosure.alpha.Echo"],
    reversedServices: true,
  });
}
for (const scope of ["isolated-beta", "extras-beta"]) {
  const row = reference.rows.find((row) => row.label === scope + ":Payload");
  if (!row) throw Error("Missing alpha fallback oracle");
  add(row, { alphaOnly: true });
}
export const grpcReflectionServiceModes = [...cases.keys()];
/** @param {string} mode @returns {Record<string,any>} */
export function grpcReflectionServiceCase(mode) {
  const value = cases.get(mode);
  if (!value) throw Error("Unknown reflection service case " + mode);
  return value;
}
