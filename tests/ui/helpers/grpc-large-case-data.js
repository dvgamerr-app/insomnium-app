/** Authored native case inputs and independent protobuf/preview expectations. */
export const grpcLargeModes = [
  "legacy",
  "protoJson",
  "legacy-response",
  "protoJson-response",
  "legacy-unary",
  "protoJson-unary",
  "legacy-compact",
  "protoJson-compact",
  "legacy-unicode",
  "protoJson-unicode",
];
export const grpcLargeProto =
  'syntax="proto3"; package ownedlarge; message Input { string value=1; } message Compact { repeated int32 values=1; } service Upload { rpc Stream(stream Input) returns(stream Input); rpc Echo(Input) returns(Input); rpc Expand(Compact) returns(Compact); }';
/** @param {number} value */
function varint(value) {
  const bytes = [];
  do {
    bytes.push((value & 127) | (value > 127 ? 128 : 0));
    value = Math.floor(value / 128);
  } while (value);
  return Buffer.from(bytes);
}
/** @param {string} mode */
export function grpcLargeCase(mode) {
  if (!grpcLargeModes.includes(mode))
    throw new Error("Unknown authored gRPC case");
  const compact = mode.endsWith("-compact"),
    unicode = mode.endsWith("-unicode");
  const unary = mode.endsWith("-unary") || compact || unicode;
  const receives = unary || mode.endsWith("-response");
  const value = compact
    ? ""
    : unicode
      ? "x".repeat(65525) + "😀" + "x".repeat(1000)
      : "x".repeat(9 * 1024 * 1024);
  const body = compact
    ? JSON.stringify({ values: Array.from({ length: 16000 }, () => 0) })
    : JSON.stringify({ value });
  let wire;
  if (compact)
    wire = Buffer.concat([
      Buffer.from("0000003e830a807d", "hex"),
      Buffer.alloc(16000),
    ]);
  else {
    const bytes = Buffer.from(value),
      payload = Buffer.concat([Buffer.from([10]), varint(bytes.length), bytes]);
    const header = Buffer.alloc(5);
    header.writeUInt32BE(payload.length, 1);
    wire = Buffer.concat([header, payload]);
  }
  const formatted = compact
    ? '{\n  "values": [\n' + "    0,\n".repeat(15999) + "    0\n  ]\n}"
    : body;
  const preview = formatted.slice(0, unicode ? 65535 : 65536);
  return {
    mode,
    jsonMode: mode.split("-")[0],
    unary,
    receives,
    body,
    wire,
    preview,
    method: compact
      ? "/ownedlarge.Upload/Expand"
      : unary
        ? "/ownedlarge.Upload/Echo"
        : "/ownedlarge.Upload/Stream",
  };
}
