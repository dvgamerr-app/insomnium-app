import reference from "../fixtures/grpc-bytes-arraylike-reference.json" with { type: "json" };
import { profileGrpcFrame } from "./grpc-reflection-profile-case-data.js";
export const grpcBytesArraylikeProtos = [
  { name: "arraylike.proto", text: reference.source },
];
/** Independent pretty-print expectations preserve raw length tokens above JS's
 * integer range and positive-overflow exponents instead of parsing them as f64.
 * @param {string} body */
function formatted(body) {
  const tokens = /** @type {string[]} */ ([]),
    marker = "__owned_arraylike_length_";
  if (body.includes(marker)) throw Error("Unexpected fixture marker");
  const protectedBody = body.replace(
    /("length"\s*:\s*)(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi,
    (_all, prefix, number) => {
      const index = tokens.push(number) - 1;
      return prefix + JSON.stringify(marker + index);
    },
  );
  let text = JSON.stringify(JSON.parse(protectedBody), null, 2);
  tokens.forEach((number, index) => {
    text = text.replace(JSON.stringify(marker + index), number);
  });
  return text;
}
/** @type {Map<string,Record<string,any>>} */ const cases = new Map();
const labels = [
  ...[
    "uint32-wrap",
    "double-wrap",
    "wrap-fraction",
    "uint64-wrap",
    "positive-overflow",
    "string-infinity",
    "string-wrap",
  ].map((name) => name + ":ordinary"),
  "uint32-wrap:repeated",
  "uint32-wrap:nested",
  "negative:repeated",
  "sparse:trailing-invalid",
  "sparse:all-invalid",
  "sparse:missing-length",
  "fraction:ordinary",
  "small:ordinary",
];
for (const profile of ["file", "reflection"])
  for (const label of labels) {
    const row = reference.rows.find(
      (row) => row.profile === profile && row.label === label,
    );
    if (
      !row ||
      !("wireHex" in row) ||
      typeof row.wireHex !== "string" ||
      !("json" in row) ||
      typeof row.json !== "string"
    )
      throw Error("Missing positive bytes oracle: " + profile + ":" + label);
    const mode = "legacy-arraylike-" + (cases.size + 1);
    cases.set(mode, {
      mode,
      jsonMode: "legacy",
      reflection: profile === "reflection",
      unary: true,
      receives: true,
      editor: true,
      showNotice: false,
      protoEntry: "arraylike.proto",
      service: "ownedarraylike.Echo",
      descriptorSet: reference.descriptorSet,
      body: row.body,
      formattedBody: formatted(row.body),
      wire: profileGrpcFrame(Buffer.from(row.wireHex, "hex")),
      responseText: row.json,
      preview: JSON.stringify(JSON.parse(row.json), null, 2),
      method: "/ownedarraylike.Echo/Call",
      referenceLabel: profile + ":" + label,
    });
  }
export const grpcBytesArraylikeModes = [...cases.keys()];
/** @type {Record<string,{mode:string,body:string,kind:string}>} */
export const grpcBytesArraylikeRefusals = {};
for (const profile of ["file", "reflection"])
  for (const [kind, label] of [
    ["leading", "sparse:leading-invalid"],
    ["nonzero", "wrapped-positive:ordinary"],
  ]) {
    const row = reference.rows.find(
      (row) => row.profile === profile && row.label === label,
    );
    const repair = [...cases.values()].find(
      (spec) => spec.referenceLabel === profile + ":small:ordinary",
    );
    if (!row || !("error" in row) || typeof row.error !== "string" || !repair)
      throw Error("Missing refusal oracle");
    grpcBytesArraylikeRefusals["arraylike-" + kind + "-" + profile] = {
      mode: repair.mode,
      body: row.body,
      kind,
    };
  }
/** @param {string} mode @returns {Record<string,any>} */
export function grpcBytesArraylikeCase(mode) {
  const value = cases.get(mode);
  if (!value) throw Error("Unknown array-like byte case " + mode);
  return value;
}
