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
  "legacy-numeric-nel",
  "legacy-numeric-nbsp",
  "legacy-numeric-bom",
  "legacy-numeric-zwsp",
  "legacy-long-nel",
  "legacy-long-nbsp",
  "legacy-long-chunk-nel",
  "legacy-long-chunk-nbsp",
  "legacy-long-negative-nel",
  "legacy-long-negative-bom",
];
export const grpcLargeProto =
  'syntax="proto3"; package ownedlarge; message Input { string value=1; } message Compact { repeated int32 values=1; } message Precision { int64 exact_value=1; bytes bytes_value=2; } message Numeric { optional int32 value=1; double real=2; } message Wide { optional int64 signed_value=1; optional uint64 unsigned_value=2; } service Upload { rpc Stream(stream Input) returns(stream Input); rpc Echo(Input) returns(Input); rpc Expand(Compact) returns(Compact); rpc PrecisionEcho(Precision) returns(Precision); rpc NumericEcho(Numeric) returns(Numeric); rpc WideEcho(Wide) returns(Wide); }';
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
  if (mode.includes("-long-")) {
    const tuple = {
      "legacy-long-nel": ["\u00851\u0085", "0", "0", "08001000"],
      "legacy-long-nbsp": ["\u00a01\u00a0", "1", "1", "08011001"],
      "legacy-long-chunk-nel": [
        "12345678\u00851",
        "1234567800",
        "1234567800",
        "08f884d8cc0410f884d8cc04",
      ],
      "legacy-long-chunk-nbsp": [
        "12345678\u00a01",
        "1234567801",
        "1234567801",
        "08f984d8cc0410f984d8cc04",
      ],
      "legacy-long-negative-nel": ["-\u00851", "0", "0", "08001000"],
      "legacy-long-negative-bom": [
        "-\ufeff1",
        "-1",
        "18446744073709551615",
        "08ffffffffffffffffff0110ffffffffffffffffff01",
      ],
    }[mode];
    if (!tuple) throw new Error("Unknown Long case");
    const [input, signed, unsigned, hex] = tuple;
    const authored = { signed_value: input, unsigned_value: input };
    const response = {
      signed_value: signed,
      _signed_value: "signed_value",
      unsigned_value: unsigned,
      _unsigned_value: "unsigned_value",
    };
    const payload = Buffer.from(hex, "hex"),
      prefix = Buffer.alloc(5);
    prefix.writeUInt32BE(payload.length, 1);
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body: JSON.stringify(authored),
      formattedBody: JSON.stringify(authored, null, 2),
      responseText: JSON.stringify(response),
      preview: JSON.stringify(response, null, 2),
      wire: Buffer.concat([prefix, payload]),
      method: "/ownedlarge.Upload/WideEcho",
      editor: true,
      showNotice: false,
    };
  }
  if (mode.includes("-numeric-")) {
    const character = {
      "legacy-numeric-nel": "\u0085",
      "legacy-numeric-nbsp": "\u00a0",
      "legacy-numeric-bom": "\ufeff",
      "legacy-numeric-zwsp": "\u200b",
    }[mode];
    const finite = mode.endsWith("-nbsp") || mode.endsWith("-bom");
    const authored = {
      value: character + "1" + character,
      real: character + "1" + character,
    };
    const response = {
      value: finite ? 1 : 0,
      _value: "value",
      real: finite ? 1 : null,
    };
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body: JSON.stringify(authored),
      formattedBody: JSON.stringify(authored, null, 2),
      responseText: JSON.stringify(response),
      preview: JSON.stringify(response, null, 2),
      // Explicit optional int32 presence and IEEE754 double, independently authored.
      wire: Buffer.from(
        finite
          ? "000000000b080111000000000000f03f"
          : "000000000b080011000000000000f87f",
        "hex",
      ),
      method: "/ownedlarge.Upload/NumericEcho",
      editor: true,
      showNotice: false,
    };
  }
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
