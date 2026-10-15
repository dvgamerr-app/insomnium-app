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
  "legacy-json-number",
  "protoJson-json-number",
  "legacy-json-string",
  "protoJson-json-string",
  "legacy-base64-canonical",
  "legacy-base64-trailing",
  "legacy-base64-unpadded",
  "legacy-base64-two-padded",
  "legacy-base64-two-unpadded",
  "legacy-base64-short-padding",
];
export const grpcLargeProto =
  'syntax="proto3"; package ownedlarge; message Input { string value=1; } message Compact { repeated int32 values=1; } message Precision { int64 exact_value=1; bytes bytes_value=2; } service Upload { rpc Stream(stream Input) returns(stream Input); rpc Echo(Input) returns(Input); rpc Expand(Compact) returns(Compact); rpc PrecisionEcho(Precision) returns(Precision); }';
/** Independent small-message wire and lexical editor expectations.
 * @param {string} mode */
function jsonEditorCase(mode) {
  const legacy = mode.startsWith("legacy-"),
    numeric = mode.endsWith("-number");
  const literal = numeric ? "9007199254740993" : '"9007199254740993"';
  const result = legacy && numeric ? "9007199254740992" : "9007199254740993";
  const body = `{"exact_value":${literal},"bytes_value":"AP+A"}`;
  const formattedBody = `{\n  "exact_value": ${literal},\n  "bytes_value": "AP+A"\n}`;
  const responseText = JSON.stringify({
    exact_value: result,
    bytes_value: legacy ? { 0: 0, 1: 255, 2: 128 } : "AP+A",
  });
  const preview = legacy
    ? `{\n  "exact_value": "${result}",\n  "bytes_value": {\n    "0": 0,\n    "1": 255,\n    "2": 128\n  }\n}`
    : `{\n  "exact_value": "${result}",\n  "bytes_value": "AP+A"\n}`;
  // int64 tag1, authored eight-byte varint, bytes tag2/length3/00ff80.
  const wire = Buffer.from(
    legacy && numeric
      ? "000000000e088080808080808010120300ff80"
      : "000000000e088180808080808010120300ff80",
    "hex",
  );
  return {
    mode,
    jsonMode: legacy ? "legacy" : "protoJson",
    unary: true,
    receives: true,
    body,
    wire,
    preview,
    method: "/ownedlarge.Upload/PrecisionEcho",
    editor: true,
    formattedBody,
    responseText,
    showNotice: false,
  };
}
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
  if (mode.includes("-base64-")) {
    const input = {
      "legacy-base64-canonical": "Zg==",
      "legacy-base64-trailing": "Zh==",
      "legacy-base64-unpadded": "Zh",
      "legacy-base64-two-padded": "Zm9=",
      "legacy-base64-two-unpadded": "Zm9",
      "legacy-base64-short-padding": "Zg=",
    }[mode];
    const two = mode.includes("-two-");
    const body = `{"exact_value":"9007199254740993","bytes_value":"${input}"}`;
    const response = {
      exact_value: "9007199254740993",
      bytes_value: two ? { 0: 102, 1: 111 } : { 0: 102 },
    };
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body,
      formattedBody: body,
      responseText: JSON.stringify(response),
      preview: JSON.stringify(response, null, 2),
      wire: Buffer.from(
        two
          ? "000000000d0881808080808080101202666f"
          : "000000000c088180808080808010120166",
        "hex",
      ),
      method: "/ownedlarge.Upload/PrecisionEcho",
      editor: false,
      showNotice: false,
    };
  }
  if (mode.includes("-json-")) return jsonEditorCase(mode);
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
    editor: false,
    formattedBody: body,
    responseText: body,
    showNotice: true,
    method: compact
      ? "/ownedlarge.Upload/Expand"
      : unary
        ? "/ownedlarge.Upload/Echo"
        : "/ownedlarge.Upload/Stream",
  };
}
