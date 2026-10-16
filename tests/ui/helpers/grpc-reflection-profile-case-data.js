import profile from "../fixtures/grpc-reflection-profile-reference.json" with { type: "json" };
import any from "../fixtures/grpc-reflection-any-reference.json" with { type: "json" };
import examples from "../fixtures/grpc-reflection-example-reference.json" with { type: "json" };

export const grpcReflectionProfileProtos = [
  { name: "reflection_profile.proto", text: profile.source },
  { name: "reflection_any.proto", text: any.source },
];
/** @param {Uint8Array} payload */
export function profileGrpcFrame(payload) {
  const prefix = Buffer.alloc(5);
  prefix.writeUInt32BE(payload.length, 1);
  return Buffer.concat([prefix, payload]);
}
/** @type {Map<string,Record<string,any>>} */
const cases = new Map();
/** @param {string} id @param {typeof profile|typeof any} fixture @param {string} label @param {Record<string,any>} [extra] */
function add(id, fixture, label, extra = {}) {
  const row = fixture.rows.find((row) => row.label === label);
  if (!row || typeof row.wireHex !== "string" || typeof row.json !== "string")
    throw new Error("Missing profile oracle " + label);
  const incoming = "incoming" in row && row.incoming === true;
  const body = incoming ? "{}" : row.body;
  if (typeof body !== "string") throw new Error("Missing profile body");
  const reflection = row.profile === "reflection";
  const method =
    row.name === "ownedreflection.Input"
      ? "Call"
      : row.name === "google.protobuf.Any"
        ? "AnyEcho"
        : "ValueEcho";
  const mode = "legacy-profile-" + id;
  cases.set(mode, {
    mode,
    jsonMode: "legacy",
    unary: true,
    receives: true,
    editor: true,
    showNotice: false,
    reflection,
    protoEntry:
      fixture === profile ? "reflection_profile.proto" : "reflection_any.proto",
    descriptorSet: fixture.descriptorSet,
    service: "ownedreflection.Echo",
    body,
    formattedBody: label.startsWith("negative-zero-")
      ? '{\n  "real": -0\n}'
      : JSON.stringify(JSON.parse(body), null, 2),
    wire: profileGrpcFrame(
      incoming ? Buffer.alloc(0) : Buffer.from(row.wireHex, "hex"),
    ),
    ...(incoming
      ? { responseWire: profileGrpcFrame(Buffer.from(row.wireHex, "hex")) }
      : {}),
    responseText: row.json,
    preview: JSON.stringify(JSON.parse(row.json), null, 2),
    method: "/ownedreflection.Echo/" + method,
    referenceLabel: label,
    ...extra,
  });
}
for (const label of [
  "absent",
  "explicit-zero",
  "negative-zero",
  "nonzero",
  "oneof-defaults",
  "nested-zero",
  "entry-array-key-value",
])
  add(label + "-file", profile, label + "-file");
for (const label of [
  "absent",
  "explicit-zero",
  "negative-zero",
  "nonzero",
  "oneof-defaults",
  "nested-empty",
  "entry-array-empty",
  "entry-array-value",
  "entry-array-key-value",
])
  add(label + "-reflection", profile, label + "-reflection");
add("nonzero-alpha", profile, "nonzero-reflection", { alphaOnly: true });
for (const label of [
  "wire-explicit-zero",
  "wire-empty-entry",
  "wire-value-only-entry",
  "wire-duplicate-entries",
  "wire-reversed-oneof",
])
  add(label + "-reflection", profile, label + "-reflection");
add("wire-duplicate-entries-file", profile, "wire-duplicate-entries-file");
for (const origin of ["file", "reflection"]) {
  add(
    "any-map-entry-" + origin,
    any,
    "target:ownedreflection.Input.Labels-" + origin,
  );
  for (const name of ["stringValue", "string_value"])
    add("value-" + name + "-" + origin, any, "value:" + name + "-" + origin);
}
add("any-input-reflection", any, "target:ownedreflection.Input-reflection");
// Standard ProtoJSON control: the legacy options must never leak into this mode.
const standardBody = {
  number: 7,
  flag: true,
  real: 1.5,
  text: "owned",
  data: "AP+A",
  wide: "9007199254740993",
  unsignedWide: "18446744073709551615",
  choice: "ONE",
};
const standardResponse = {
  number: 7,
  flag: true,
  real: 1.5,
  text: "owned",
  data: "AP+A",
  wide: "9007199254740993",
  unsigned_wide: "18446744073709551615",
  choice: "ONE",
  list: [],
  labels: {},
};
add("standard-nonzero-reflection", profile, "nonzero-reflection", {
  jsonMode: "protoJson",
  body: JSON.stringify(standardBody),
  formattedBody: JSON.stringify(standardBody, null, 2),
  responseText: JSON.stringify(standardResponse),
  preview: JSON.stringify(standardResponse, null, 2),
});
for (const row of examples.rows)
  add("example-" + row.jsonMode, profile, "nonzero-reflection", {
    jsonMode: row.jsonMode,
    useExample: true,
    editor: false,
    body: row.body,
    formattedBody: JSON.stringify(JSON.parse(row.body), null, 2),
    wire: profileGrpcFrame(Buffer.from(row.wireHex, "hex")),
    responseText: row.responseText,
    preview: JSON.stringify(JSON.parse(row.responseText), null, 2),
  });
export const grpcReflectionProfileModes = [...cases.keys()];
/** @param {string} mode @returns {Record<string,any>} */
export function grpcReflectionProfileCase(mode) {
  const value = cases.get(mode);
  if (!value) throw new Error("Unknown reflection profile case " + mode);
  return value;
}
