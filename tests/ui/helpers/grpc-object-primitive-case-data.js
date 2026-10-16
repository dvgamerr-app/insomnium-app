import reference from "../fixtures/grpc-object-primitive-reference.json" with { type: "json" };
import { profileGrpcFrame } from "./grpc-reflection-profile-case-data.js";
export const grpcObjectPrimitiveProtos = [
  { name: "primitive.proto", text: reference.source },
];
/** @type {Map<string,Record<string,any>>} */ const cases = new Map();
for (const row of reference.rows) {
  if (
    !("wireHex" in row) ||
    typeof row.wireHex !== "string" ||
    !("json" in row) ||
    typeof row.json !== "string"
  )
    continue;
  const mode = "legacy-primitive-" + (cases.size + 1);
  cases.set(mode, {
    mode,
    jsonMode: "legacy",
    reflection: row.profile === "reflection",
    unary: true,
    receives: true,
    editor: true,
    showNotice: false,
    protoEntry: "primitive.proto",
    service: "ownedprimitive.Echo",
    descriptorSet: reference.descriptorSet,
    body: row.body,
    formattedBody: JSON.stringify(JSON.parse(row.body), null, 2),
    wire: profileGrpcFrame(Buffer.from(row.wireHex, "hex")),
    responseText: row.json,
    preview: JSON.stringify(JSON.parse(row.json), null, 2),
    method: "/ownedprimitive.Echo/Call",
    referenceLabel: row.profile + ":" + row.label,
  });
}
export const grpcObjectPrimitiveModes = [...cases.keys()];
// Native UI verifies integration boundaries; exhaustive values belong to Rust.
const smokeLabels = new Set([
  "valueof-text",
  "bool",
  "enum",
  "long-outer",
  "bytes-outer",
  "bytes-zero-lazy",
  "bytes-negative-lazy",
  "map-key-shadow",
]);
export const grpcObjectPrimitiveSmokeModes = grpcObjectPrimitiveModes.filter(
  (mode) =>
    smokeLabels.has(
      grpcObjectPrimitiveCase(mode).referenceLabel.split(":control:")[1],
    ),
);
/** @type {Record<string,{mode:string,body:string,kind:string}>} */
export const grpcObjectPrimitiveRefusals = {};
for (const row of reference.rows) {
  if (!row.label.startsWith("shadow-null:")) continue;
  if (!("error" in row) || typeof row.error !== "string")
    throw Error("Expected refusal oracle");
  const repair = [...cases.values()].find(
    (spec) => spec.referenceLabel === row.profile + ":control:plain-text",
  );
  if (!repair) throw Error("Missing repair oracle");
  const kind = row.label.slice("shadow-null:".length);
  grpcObjectPrimitiveRefusals["primitive-" + kind + "-" + row.profile] = {
    mode: repair.mode,
    body: row.body,
    kind,
  };
}
const smokeRefusalKinds = new Set([
  "text",
  "num",
  "bytes-index",
  "long-low",
  "map-string",
  "nested-text",
]);
export const grpcObjectPrimitiveSmokeRefusals = Object.fromEntries(
  Object.entries(grpcObjectPrimitiveRefusals).filter(([, spec]) =>
    smokeRefusalKinds.has(spec.kind),
  ),
);
/** @param {string} mode @returns {Record<string,any>} */
export function grpcObjectPrimitiveCase(mode) {
  const spec = cases.get(mode);
  if (!spec) throw Error("Unknown primitive case " + mode);
  return spec;
}
