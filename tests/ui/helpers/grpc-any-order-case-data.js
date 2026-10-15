import reference from "../fixtures/grpc-any-order-reference.json" with { type: "json" };
/** Keep each declaration-order fixture as a separate selectable entry schema. */
/** @type {{name:string,text:string}[]} */
export const grpcAnyOrderProtos = [];
const entries = new Map();
for (const row of reference.rows) {
  const label = row.label.replace(/-(?:ownedorder\.)?Payload$/, "");
  if (entries.has(label)) continue;
  const names = new Map(
    row.files.map((file) => [file.name, `any_order_${label}_${file.name}`]),
  );
  const entry = names.get(row.entry);
  if (!entry) throw new Error("Missing Any order proto entry");
  entries.set(label, entry);
  for (const file of row.files) {
    let text = file.text;
    for (const [before, after] of names)
      text = text.replaceAll(`"${before}"`, `"${after}"`);
    if (file.name === row.entry)
      text = text.replace(
        'import "google/protobuf/any.proto";',
        'import "google/protobuf/any.proto";import "large.proto";',
      );
    const name = names.get(file.name);
    if (!name) throw new Error("Missing Any order proto file");
    grpcAnyOrderProtos.push({ name, text });
  }
}
const rows = reference.rows.filter((row) => typeof row.wireHex === "string");
export const grpcAnyOrderModes = rows.map(
  (_, index) => `legacy-anyorder-${index + 1}`,
);
/** @param {string} mode */
export function grpcAnyOrderCase(mode) {
  const row = rows[grpcAnyOrderModes.indexOf(mode)];
  if (!row || typeof row.wireHex !== "string" || typeof row.json !== "string")
    throw new Error("Missing pinned Any order case");
  const label = row.label.replace(/-(?:ownedorder\.)?Payload$/, "");
  const protoEntry = entries.get(label);
  if (!protoEntry) throw new Error("Missing Any order case entry");
  const payload = Buffer.from(row.wireHex, "hex"),
    prefix = Buffer.alloc(5);
  prefix.writeUInt32BE(payload.length, 1);
  return {
    mode,
    jsonMode: "legacy",
    unary: true,
    receives: true,
    editor: true,
    showNotice: false,
    method: "/ownedlarge.Upload/AnyEcho",
    protoEntry,
    body: row.body,
    formattedBody: JSON.stringify(JSON.parse(row.body), null, 2),
    responseText: row.json,
    preview: JSON.stringify(JSON.parse(row.json), null, 2),
    wire: Buffer.concat([prefix, payload]),
    referenceLabel: row.label,
  };
}
export const grpcAnyOrderRefusals = {
  "any-order-service-relative": "types/Payload",
  "any-order-service-scoped": "types/ownedorder.Payload",
};
const refusalEntry = entries.get("service-before-message");
if (!refusalEntry) throw new Error("Missing Any order refusal entry");
export const grpcAnyOrderRefusalEntry = refusalEntry;
