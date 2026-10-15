import targetReference from "../fixtures/grpc-any-target-reference.json" with { type: "json" };
import wktReference from "../fixtures/grpc-any-wkt-reference.json" with { type: "json" };

export const grpcAnyTargetProtos = [
  { name: "any_targets.proto", text: targetReference.source },
  { name: "any_wkt.proto", text: wktReference.source },
];
const targets = [
  "Payload",
  "Payload.Child",
  "ownedtargets.Payload.Child",
  "ownedtargets.Missing",
  "ownedtargets.Payload.LabelsEntry",
  "google.protobuf.Any.insomnium_string_1",
  "",
  "ownedtargets..Payload",
  "Payload-nested",
  "ownedtargets.Payload.LabelsEntry-nested",
  "-nested",
];
const wkts = [
  "empty-message",
  "empty-value",
  "raw-empty-bytes",
  "raw-absent-bytes",
  "raw-empty-base64",
  "unknown-empty-bytes",
  "empty-context",
  "string_value",
  "empty-message-nested",
];
const rows = [
  ...targets.map((label) =>
    targetReference.rows.find((row) => row.label === label),
  ),
  ...wkts.map((label) => wktReference.rows.find((row) => row.label === label)),
];
if (rows.some((row) => !row || !("wireHex" in row)))
  throw new Error("Missing pinned Any lookup oracle");
export const grpcAnyTargetModes = rows.map(
  (_, index) => `legacy-anytarget-${index + 1}`,
);

/** Pinned library wire/JSON, independent of the application converter.
 * @param {string} mode */
export function grpcAnyTargetCase(mode) {
  const row = rows[grpcAnyTargetModes.indexOf(mode)];
  if (!row || typeof row.wireHex !== "string" || typeof row.json !== "string")
    throw new Error("Unknown Any lookup case");
  const payload = Buffer.from(row.wireHex, "hex"),
    prefix = Buffer.alloc(5);
  prefix.writeUInt32BE(payload.length, 1);
  return {
    mode,
    jsonMode: "legacy",
    unary: true,
    receives: true,
    body: row.body,
    formattedBody: JSON.stringify(JSON.parse(row.body), null, 2),
    responseText: row.json,
    preview: JSON.stringify(JSON.parse(row.json), null, 2),
    wire: Buffer.concat([prefix, payload]),
    method:
      "/ownedlarge.Upload/" +
      (row.name === "google.protobuf.Any"
        ? "AnyEcho"
        : row.name === "ownedtargets.Envelope"
          ? "AnyTargetEnvelopeEcho"
          : "AnyWktEnvelopeEcho"),
    editor: true,
    showNotice: false,
    referenceLabel: row.label,
  };
}

export const grpcAnyTargetRefusals = {
  "any-namespace": "types/ownedtargets",
  "any-field": "types/ownedtargets.Payload.text",
  "any-oneof": "types/ownedtargets.Payload.choice",
  "any-optional-oneof": "types/ownedtargets.Payload._optional_text",
  "any-service": "types/ownedtargets.Echo",
  "any-method": "types/ownedtargets.Echo.Call",
  "any-prototype": "types/constructor",
  "any-wkt-alias": "types/google.protobuf.Value.stringValue",
};
