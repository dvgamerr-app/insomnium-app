/** Authored native case inputs and independent protobuf/preview expectations. */
import {
  grpcReflectionProfileCase,
  grpcReflectionProfileModes,
  grpcReflectionProfileProtos,
} from "./grpc-reflection-profile-case-data.js";
import {
  grpcAnyTargetModes,
  grpcAnyTargetCase,
} from "./grpc-any-target-case-data.js";
import { grpcAnyTargetProtos } from "./grpc-any-target-case-data.js";
import {
  grpcAnyOrderModes,
  grpcAnyOrderCase,
  grpcAnyOrderProtos,
} from "./grpc-any-order-case-data.js";
export const grpcLargeAdditionalProtos = [
  ...grpcAnyTargetProtos,
  ...grpcAnyOrderProtos,
  ...grpcReflectionProfileProtos,
];
export const grpcLargeModes = [
  ...grpcReflectionProfileModes,
  ...grpcAnyOrderModes,
  ...grpcAnyTargetModes,
  "legacy-anyurl-plain",
  "legacy-anyurl-leading-dot",
  "legacy-anyurl-high-prefix",
  "legacy-anyurl-low-prefix",
  "legacy-anyurl-pair-prefix",
  "legacy-anyurl-units39",
  "legacy-anyurl-units40",
  "legacy-anyurl-dot-crosses40",
  "legacy-anyurl-two-dot-prefix",
  "legacy-anyurl-two-dot-name",
  "legacy-anyurl-high-prefix-nested",
  "legacy-anyurl-units39-nested",
  "legacy-anyurl-dot-crosses40-nested",
  "legacy-anyurl-unknown-name",
  "legacy-surrogate-high-text",
  "legacy-surrogate-low-text",
  "legacy-surrogate-pair-text",
  "legacy-surrogate-39units-text",
  "legacy-surrogate-40units-text",
  "legacy-surrogate-high-list",
  "legacy-surrogate-high-labels",
  "legacy-surrogate-decoded-key-collision",
  "legacy-surrogate-array-coercion",
  "legacy-surrogate-unknown-high",
  "legacy-surrogate-escaped-field-name",
  "legacy-surrogate-unknown-surrogate-key",
  "legacy-surrogate-coerced-null-array",
  "legacy-map-missing-value",
  "legacy-map-indices",
  "legacy-map-collision",
  "legacy-map-bool",
  "legacy-map-long-hash",
  "legacy-map-missing-long",
  "legacy-map-duplicates",
  "legacy-map-nested",
  "legacy-map-bytes",
  "legacy-order-defaults",
  "legacy-order-full",
  "legacy-order-normal",
  "legacy-order-default-oneof",
  "legacy-order-child",
  "legacy-order-nested",
  "legacy-order-map-first-defaults",
  "legacy-order-map-first-full",
  "legacy-oneof-both",
  "legacy-oneof-reverse-input",
  "legacy-oneof-defaults",
  "legacy-oneof-list",
  "legacy-oneof-map",
  "legacy-oneof-reverse-wire",
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
  "legacy-overflow-positive-400",
  "legacy-overflow-negative-400",
  "legacy-overflow-positive-309",
  "legacy-overflow-negative-309",
  "legacy-overflow-finite-positive",
  "legacy-overflow-finite-negative",
  "legacy-overflow-underflow-positive",
  "legacy-overflow-underflow-negative",
];
export const grpcLargeProto =
  'syntax="proto3";import "google/protobuf/any.proto";import "any_targets.proto";import "any_wkt.proto"; package ownedlarge; message Input { string value=1; } message Compact { repeated int32 values=1; } message Precision { int64 exact_value=1; bytes bytes_value=2; } message Numeric { optional int32 value=1; double real=2; } message Wide { optional int64 signed_value=1; optional uint64 unsigned_value=2; } message Overflow { optional double real=1; optional int32 integer=2; optional int64 wide=3; string text=4; } message Choice { oneof pick { int32 a=1; string b=2; } enum Collision { insomnium_legacy_2=0; insomnium_legacy_2_=1; } repeated Choice children=3; map<string,Choice> entries=4; } message Inner { string value=1; } message Order { bool flag=7; string scalar=1; oneof pick { string b=5; int32 a=4; } Inner child=6; map<string,string> labels=3; repeated int32 list=2; } message Envelope { int32 count=1; repeated Order items=2; map<string,Order> groups=3; } message MapFirst { repeated string tail=4; map<string,string> labels=1; bool flag=3; repeated int32 list=2; map<string,int32> counts=5; }  message Strings { map<string,string> values=1; } message Int32 { map<int32,string> values=1; } message Uint32 { map<uint32,string> values=1; } message Sint32 { map<sint32,string> values=1; } message Fixed32 { map<fixed32,string> values=1; } message Sfixed32 { map<sfixed32,string> values=1; } message Int64 { map<int64,string> values=1; } message Uint64 { map<uint64,string> values=1; } message Sint64 { map<sint64,string> values=1; } message Fixed64 { map<fixed64,string> values=1; } message Sfixed64 { map<sfixed64,string> values=1; } message Bools { map<bool,string> values=1; } enum Flag { ZERO=0; ONE=1; } message Enums { map<string,Flag> values=1; } message Blobs { map<string,bytes> values=1; } message Child { map<string,string> values=1; } message Nested { map<string,Child> values=1; } message Empty {} message EmptyValues { map<string,Empty> values=1; }  message SurrogateText { string text=1; repeated string list=2; map<string,string> labels=3; } message AnyText {string text=1;}message AnyEnvelope {google.protobuf.Any item=1;} enum AnyFlag {ANY_ZERO=0;ANY_ONE=1;} service Upload { rpc AnyTargetEnvelopeEcho(ownedtargets.Envelope) returns(ownedtargets.Envelope); rpc AnyWktEnvelopeEcho(ownedwkt.Envelope) returns(ownedwkt.Envelope); rpc AnyEcho(google.protobuf.Any) returns(google.protobuf.Any); rpc AnyEnvelopeEcho(AnyEnvelope) returns(AnyEnvelope); rpc SurrogateEcho(SurrogateText) returns(SurrogateText); rpc MapStrings(Strings) returns(Strings); rpc MapInt32(Int32) returns(Int32); rpc MapBools(Bools) returns(Bools); rpc MapInt64(Int64) returns(Int64); rpc MapNested(Nested) returns(Nested); rpc MapBlobs(Blobs) returns(Blobs); rpc OrderEcho(Order) returns(Order); rpc EnvelopeEcho(Envelope) returns(Envelope); rpc MapFirstEcho(MapFirst) returns(MapFirst); rpc ChoiceEcho(Choice) returns(Choice); rpc Stream(stream Input) returns(stream Input); rpc Echo(Input) returns(Input); rpc Expand(Compact) returns(Compact); rpc PrecisionEcho(Precision) returns(Precision); rpc NumericEcho(Numeric) returns(Numeric); rpc WideEcho(Wide) returns(Wide); rpc OverflowEcho(Overflow) returns(Overflow); }';

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

  if (mode.startsWith("legacy-profile-"))
    return grpcReflectionProfileCase(mode);
  if (mode.startsWith("legacy-anytarget-")) return grpcAnyTargetCase(mode);
  if (mode.startsWith("legacy-anyorder-")) return grpcAnyOrderCase(mode);

  if (mode.startsWith("legacy-anyurl-")) {
    // Independent pinned Any wrapper/wire/response oracle, including nested Any.
    /** @type {Record<string,[string,string,string,string]>} */
    const cases = {
      "legacy-anyurl-plain": [
        "google.protobuf.Any",
        '{"@type":"ownedlarge.AnyText","text":"owned"}',
        "0a132f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-leading-dot": [
        "google.protobuf.Any",
        '{"@type":".ownedlarge.AnyText","text":"owned"}',
        "0a132f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-high-prefix": [
        "google.protobuf.Any",
        '{"@type":"\\ud800/ownedlarge.AnyText","text":"owned"}',
        "0a16eda0802f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"���/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-low-prefix": [
        "google.protobuf.Any",
        '{"@type":"\\udfff/ownedlarge.AnyText","text":"owned"}',
        "0a16edbfbf2f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"���/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-pair-prefix": [
        "google.protobuf.Any",
        '{"@type":"😀/ownedlarge.AnyText","text":"owned"}',
        "0a17f09f98802f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"😀/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-units39": [
        "google.protobuf.Any",
        '{"@type":"xxxxxxxxxxxxxxxxxxx\\ud800/ownedlarge.AnyText","text":"owned"}',
        "0a2978787878787878787878787878787878787878eda0802f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"xxxxxxxxxxxxxxxxxxx���/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-units40": [
        "google.protobuf.Any",
        '{"@type":"xxxxxxxxxxxxxxxxxxxx\\ud800/ownedlarge.AnyText","text":"owned"}',
        "0a2a7878787878787878787878787878787878787878efbfbd2f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"xxxxxxxxxxxxxxxxxxxx�/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-dot-crosses40": [
        "google.protobuf.Any",
        '{"@type":".xxxxxxxxxxxxxxxxxxx\\ud800/ownedlarge.AnyText","text":"owned"}',
        "0a2978787878787878787878787878787878787878eda0802f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"xxxxxxxxxxxxxxxxxxx���/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-two-dot-prefix": [
        "google.protobuf.Any",
        '{"@type":"..types/ownedlarge.AnyText","text":"owned"}',
        "0a192e74797065732f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":".types/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-two-dot-name": [
        "google.protobuf.Any",
        '{"@type":"types/..ownedlarge.AnyText","text":"owned"}',
        "0a1a74797065732f2e2e6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"type_url":"types/..ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}',
      ],
      "legacy-anyurl-high-prefix-nested": [
        "ownedlarge.AnyEnvelope",
        '{"item":{"@type":"\\ud800/ownedlarge.AnyText","text":"owned"}}',
        "0a210a16eda0802f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"item":{"type_url":"���/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}}',
      ],
      "legacy-anyurl-units39-nested": [
        "ownedlarge.AnyEnvelope",
        '{"item":{"@type":"xxxxxxxxxxxxxxxxxxx\\ud800/ownedlarge.AnyText","text":"owned"}}',
        "0a340a2978787878787878787878787878787878787878eda0802f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"item":{"type_url":"xxxxxxxxxxxxxxxxxxx���/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}}',
      ],
      "legacy-anyurl-dot-crosses40-nested": [
        "ownedlarge.AnyEnvelope",
        '{"item":{"@type":".xxxxxxxxxxxxxxxxxxx\\ud800/ownedlarge.AnyText","text":"owned"}}',
        "0a340a2978787878787878787878787878787878787878eda0802f6f776e65646c617267652e416e795465787412070a056f776e6564",
        '{"item":{"type_url":"xxxxxxxxxxxxxxxxxxx���/ownedlarge.AnyText","value":{"0":10,"1":5,"2":111,"3":119,"4":110,"5":101,"6":100}}}',
      ],
      "legacy-anyurl-unknown-name": [
        "google.protobuf.Any",
        '{"@type":"types/ownedlarge.Missing","text":"owned"}',
        "",
        '{"type_url":"","value":{}}',
      ],
    };
    const tuple = cases[mode];
    if (!tuple) throw new Error("Unknown Any URL case");
    const [type, body, hex, responseText] = tuple;
    const payload = Buffer.from(hex, "hex"),
      prefix = Buffer.alloc(5);
    prefix.writeUInt32BE(payload.length, 1);
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body,
      formattedBody: JSON.stringify(JSON.parse(body), null, 2),
      responseText,
      preview: JSON.stringify(JSON.parse(responseText), null, 2),
      wire: Buffer.concat([prefix, payload]),
      method:
        "/ownedlarge.Upload/" +
        (type === "google.protobuf.Any" ? "AnyEcho" : "AnyEnvelopeEcho"),
      editor: true,
      showNotice: false,
    };
  }
  if (mode.startsWith("legacy-surrogate-")) {
    // Captured from pinned protobuf.js7.2.4 BufferWriter and BufferReader.
    /** @type {Record<string,[string,string,string]>} */
    const cases = {
      "legacy-surrogate-high-text": [
        '{"text":"\\ud800"}',
        "0a03eda080",
        '{"list":[],"labels":{},"text":"���"}',
      ],
      "legacy-surrogate-low-text": [
        '{"text":"\\udfff"}',
        "0a03edbfbf",
        '{"list":[],"labels":{},"text":"���"}',
      ],
      "legacy-surrogate-pair-text": [
        '{"text":"😀"}',
        "0a04f09f9880",
        '{"list":[],"labels":{},"text":"😀"}',
      ],
      "legacy-surrogate-39units-text": [
        '{"text":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\ud800"}',
        "0a297878787878787878787878787878787878787878787878787878787878787878787878787878eda080",
        '{"list":[],"labels":{},"text":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx���"}',
      ],
      "legacy-surrogate-40units-text": [
        '{"text":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\ud800"}',
        "0a2a787878787878787878787878787878787878787878787878787878787878787878787878787878efbfbd",
        '{"list":[],"labels":{},"text":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx�"}',
      ],
      "legacy-surrogate-high-list": [
        '{"list":["\\ud800"]}',
        "1203eda080",
        '{"list":["���"],"labels":{},"text":""}',
      ],
      "legacy-surrogate-high-labels": [
        '{"labels":{"\\ud800":"\\ud800"}}',
        "1a0a0a03eda0801203eda080",
        '{"list":[],"labels":{"���":"���"},"text":""}',
      ],
      "legacy-surrogate-decoded-key-collision": [
        '{"labels":{"\\ud800":"first","\\udfff":"second","�":"third"}}',
        "1a0c0a03eda080120566697273741a0d0a03edbfbf12067365636f6e641a0c0a03efbfbd12057468697264",
        '{"list":[],"labels":{"���":"second","�":"third"},"text":""}',
      ],
      "legacy-surrogate-array-coercion": [
        '{"text":["\\ud800",null,"\\udfff"]}',
        "0a08eda0802c2cedbfbf",
        '{"list":[],"labels":{},"text":"���,,���"}',
      ],
      "legacy-surrogate-unknown-high": [
        '{"ignored":"\\ud800","text":"owned"}',
        "0a056f776e6564",
        '{"list":[],"labels":{},"text":"owned"}',
      ],
      "legacy-surrogate-escaped-field-name": [
        '{"te\\u0078t":"\\ud800"}',
        "0a03eda080",
        '{"list":[],"labels":{},"text":"���"}',
      ],
      "legacy-surrogate-unknown-surrogate-key": [
        '{"\\ud800":"ignored","text":"owned"}',
        "0a056f776e6564",
        '{"list":[],"labels":{},"text":"owned"}',
      ],
      "legacy-surrogate-coerced-null-array": [
        '{"text":[null]}',
        "0a00",
        '{"list":[],"labels":{},"text":""}',
      ],
    };
    const tuple = cases[mode];
    if (!tuple) throw new Error("Unknown surrogate case");
    const [body, hex, responseText] = tuple;
    const payload = Buffer.from(hex, "hex"),
      prefix = Buffer.alloc(5);
    prefix.writeUInt32BE(payload.length, 1);
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body,
      formattedBody: JSON.stringify(JSON.parse(body), null, 2),
      responseText,
      preview: JSON.stringify(JSON.parse(responseText), null, 2),
      wire: Buffer.concat([prefix, payload]),
      method: "/ownedlarge.Upload/SurrogateEcho",
      editor: true,
      showNotice: false,
    };
  }
  if (mode.startsWith("legacy-map-")) {
    // Independently captured protobuf.js7.2.4 wire and exact JSON; never normalize expected output.
    /** @type {Record<string,[string,string,string,string,string]>} */
    const cases = {
      "legacy-map-missing-value": [
        "Nested",
        '{"values":{"__proto__":{"values":{"owned":"ignored"}},"z":{"values":{"z":"first","a":"last"}},"a":{"values":{"m":"middle"}}}}',
        "0a1c0a017a12170a0a0a017a120566697273740a090a016112046c6173740a120a0161120d0a0b0a016d12066d6964646c65",
        "0a070a056f776e6564",
        '{"values":{"z":{"values":{"z":"first","a":"last"}},"a":{"values":{"m":"middle"}}}}',
      ],
      "legacy-map-indices": [
        "Strings",
        '{"values":{"10":"ten","2":"two","01":"lead","-1":"minus","0":"zero","4294967295":"max","4294967294":"indexMax"}}',
        "0a090a013012047a65726f0a080a0132120374776f0a090a023130120374656e0a160a0a343239343936373239341208696e6465784d61780a0a0a02303112046c6561640a0b0a022d3112056d696e75730a110a0a3432393439363732393512036d6178",
        "0a090a013012047a65726f0a080a0132120374776f0a090a023130120374656e0a160a0a343239343936373239341208696e6465784d61780a0a0a02303112046c6561640a0b0a022d3112056d696e75730a110a0a3432393439363732393512036d6178",
        '{"values":{"0":"zero","2":"two","10":"ten","4294967294":"indexMax","01":"lead","-1":"minus","4294967295":"max"}}',
      ],
      "legacy-map-collision": [
        "Int32",
        '{"values":{"z":"first","a":"last"}}',
        "0a090800120566697273740a08080012046c617374",
        "0a090800120566697273740a08080012046c617374",
        '{"values":{"0":"last"}}',
      ],
      "legacy-map-bool": [
        "Bools",
        '{"values":{"z":"first","a":"last"}}',
        "0a090801120566697273740a08080112046c617374",
        "0a090801120566697273740a08080112046c617374",
        '{"values":{"true":"last"}}',
      ],
      "legacy-map-long-hash": [
        "Int64",
        '{"values":{"0":"zero","3544952156018063160":"numericHash"}}',
        "0a08080012047a65726f0a1708b8eed8a9c3e68c9931120b6e756d6572696348617368",
        "0a08080012047a65726f0a1708b8eed8a9c3e68c9931120b6e756d6572696348617368",
        '{"values":{"87654321":"numericHash","\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000":"zero"}}',
      ],
      "legacy-map-missing-long": [
        "Int64",
        '{"values":{"0":""}}',
        "0a0408001200",
        "0a0912076d697373696e67",
        '{"values":{"0":"missing"}}',
      ],
      "legacy-map-duplicates": [
        "Strings",
        '{"values":{"z":"first","a":"last"}}',
        "0a0a0a017a120566697273740a090a016112046c617374",
        "0a0a0a017a120566697273740a0b0a016112066d6964646c650a090a017a12046c617374",
        '{"values":{"z":"last","a":"middle"}}',
      ],
      "legacy-map-nested": [
        "Nested",
        '{"values":{"__proto__":{"values":{"owned":"ignored"}},"z":{"values":{"z":"first","a":"last"}},"a":{"values":{"m":"middle"}}}}',
        "0a1c0a017a12170a0a0a017a120566697273740a090a016112046c6173740a120a0161120d0a0b0a016d12066d6964646c65",
        "0a1c0a017a12170a0a0a017a120566697273740a090a016112046c6173740a120a0161120d0a0b0a016d12066d6964646c65",
        '{"values":{"z":{"values":{"z":"first","a":"last"}},"a":{"values":{"m":"middle"}}}}',
      ],
      "legacy-map-bytes": [
        "Blobs",
        '{"values":{"z":"","a":"AP+A","m":false}}',
        "0a050a017a12000a080a0161120300ff80",
        "0a050a017a12000a080a0161120300ff80",
        '{"values":{"z":{},"a":{"0":0,"1":255,"2":128}}}',
      ],
    };
    const tuple = cases[mode];
    if (!tuple) throw new Error("Unknown map case");
    const [type, body, hex, responseHex, responseText] = tuple;
    const frame = (/** @type {string} */ value) => {
      const payload = Buffer.from(value, "hex"),
        prefix = Buffer.alloc(5);
      prefix.writeUInt32BE(payload.length, 1);
      return Buffer.concat([prefix, payload]);
    };
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body,
      formattedBody:
        mode === "legacy-map-indices"
          ? '{\n  "values": {\n    "10": "ten",\n    "2": "two",\n    "01": "lead",\n    "-1": "minus",\n    "0": "zero",\n    "4294967295": "max",\n    "4294967294": "indexMax"\n  }\n}'
          : JSON.stringify(JSON.parse(body), null, 2),
      responseText,
      preview: JSON.stringify(JSON.parse(responseText), null, 2),
      wire: frame(hex),
      responseWire: frame(responseHex),
      ...(mode === "legacy-map-missing-value"
        ? { expectedError: "Legacy map message value is missing." }
        : {}),
      method: "/ownedlarge.Upload/Map" + type,
      editor: true,
      showNotice: false,
    };
  }
  if (mode.includes("-order-")) {
    // Literal response strings and wire bytes pinned independently from protobuf.js7.2.4.
    /** @type {Record<string, [string, string, string, string]>} */
    const cases = {
      "legacy-order-defaults": [
        "Order",
        "{}",
        "",
        '{"list":[],"labels":{},"scalar":"","child":null,"flag":false}',
      ],
      "legacy-order-full": [
        "Order",
        '{"a":1,"b":"x","scalar":"s","list":[2],"labels":{"owned":"v"},"child":{"value":"c"},"flag":true}',
        "0a01731201021a0a0a056f776e656412017620012a017832030a01633801",
        '{"list":[2],"labels":{"owned":"v"},"scalar":"s","child":{"value":"c"},"flag":true,"a":1,"pick":"b","b":"x"}',
      ],
      "legacy-order-normal": [
        "Order",
        '{"scalar":"s","flag":true}',
        "0a01733801",
        '{"list":[],"labels":{},"scalar":"s","child":null,"flag":true}',
      ],
      "legacy-order-default-oneof": [
        "Order",
        '{"a":0,"b":""}',
        "20002a00",
        '{"list":[],"labels":{},"scalar":"","child":null,"flag":false,"a":0,"pick":"b","b":""}',
      ],
      "legacy-order-child": [
        "Order",
        '{"child":{}}',
        "3200",
        '{"list":[],"labels":{},"scalar":"","child":{"value":""},"flag":false}',
      ],
      "legacy-order-nested": [
        "Envelope",
        '{"count":1,"items":[{"a":1,"b":"x","scalar":"s","list":[2],"labels":{"owned":"v"},"child":{"value":"c"},"flag":true}],"groups":{"owned":{"a":1,"b":"x","scalar":"s","list":[2],"labels":{"owned":"v"},"child":{"value":"c"},"flag":true}}}',
        "0801121e0a01731201021a0a0a056f776e656412017620012a017832030a016338011a270a056f776e6564121e0a01731201021a0a0a056f776e656412017620012a017832030a01633801",
        '{"items":[{"list":[2],"labels":{"owned":"v"},"scalar":"s","child":{"value":"c"},"flag":true,"a":1,"pick":"b","b":"x"}],"groups":{"owned":{"list":[2],"labels":{"owned":"v"},"scalar":"s","child":{"value":"c"},"flag":true,"a":1,"pick":"b","b":"x"}},"count":1}',
      ],
      "legacy-order-map-first-defaults": [
        "MapFirst",
        "{}",
        "",
        '{"list":[],"tail":[],"labels":{},"counts":{},"flag":false}',
      ],
      "legacy-order-map-first-full": [
        "MapFirst",
        '{"labels":{"owned":"v"},"list":[2],"flag":true,"tail":["t"],"counts":{"owned":1}}',
        "0a0a0a056f776e656412017612010218012201742a090a056f776e65641001",
        '{"list":[2],"tail":["t"],"labels":{"owned":"v"},"counts":{"owned":1},"flag":true}',
      ],
    };
    const tuple = cases[mode];
    if (!tuple) throw new Error("Unknown message-order case");
    const [type, body, hex, responseText] = tuple;
    const payload = Buffer.from(hex, "hex"),
      prefix = Buffer.alloc(5);
    prefix.writeUInt32BE(payload.length, 1);
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body,
      formattedBody: JSON.stringify(JSON.parse(body), null, 2),
      responseText,
      preview: JSON.stringify(JSON.parse(responseText), null, 2),
      wire: Buffer.concat([prefix, payload]),
      method: "/ownedlarge.Upload/" + type + "Echo",
      editor: true,
      showNotice: false,
    };
  }

  if (mode.includes("-oneof-")) {
    const child = { children: [], entries: {}, a: 1, pick: "b", b: "x" };
    /** @type {Record<string, [Record<string, unknown>, string, Record<string, unknown>]>} */
    const cases = {
      "legacy-oneof-both": [{ a: 1, b: "x" }, "0801120178", child],
      "legacy-oneof-reverse-input": [{ b: "x", a: 1 }, "0801120178", child],
      "legacy-oneof-defaults": [
        { a: 0, b: "" },
        "08001200",
        { children: [], entries: {}, a: 0, pick: "b", b: "" },
      ],
      "legacy-oneof-list": [
        { children: [{ a: 1, b: "x" }] },
        "1a050801120178",
        { children: [child], entries: {} },
      ],
      "legacy-oneof-map": [
        { entries: { owned: { a: 1, b: "x" } } },
        "220e0a056f776e656412050801120178",
        { children: [], entries: { owned: child } },
      ],
      "legacy-oneof-reverse-wire": [{ a: 1, b: "x" }, "0801120178", child],
    };
    const tuple = cases[mode];
    if (!tuple) throw new Error("Unknown oneof case");
    const [input, hex, response] = tuple;
    const frame = (/** @type {string} */ value) => {
      const payload = Buffer.from(value, "hex"),
        prefix = Buffer.alloc(5);
      prefix.writeUInt32BE(payload.length, 1);
      return Buffer.concat([prefix, payload]);
    };
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body: JSON.stringify(input),
      formattedBody: JSON.stringify(input, null, 2),
      responseText: JSON.stringify(response),
      preview: JSON.stringify(response, null, 2),
      wire: frame(String(hex)),
      responseWire: frame(
        mode.endsWith("reverse-wire") ? "1201780801" : String(hex),
      ),
      method: "/ownedlarge.Upload/ChoiceEcho",
      editor: true,
      showNotice: false,
    };
  }
  if (mode.includes("-overflow-")) {
    const tuple = {
      "legacy-overflow-positive-400": [
        "1e400",
        null,
        "9223372036854775807",
        "Infinity",
        "09000000000000f07f100018ffffffffffffffff7f2208496e66696e697479",
      ],
      "legacy-overflow-negative-400": [
        "-1e400",
        null,
        "-9223372036854775808",
        "-Infinity",
        "09000000000000f0ff1000188080808080808080800122092d496e66696e697479",
      ],
      "legacy-overflow-positive-309": [
        "1e309",
        null,
        "9223372036854775807",
        "Infinity",
        "09000000000000f07f100018ffffffffffffffff7f2208496e66696e697479",
      ],
      "legacy-overflow-negative-309": [
        "-1e309",
        null,
        "-9223372036854775808",
        "-Infinity",
        "09000000000000f0ff1000188080808080808080800122092d496e66696e697479",
      ],
      "legacy-overflow-finite-positive": [
        "1e308",
        1e308,
        "9223372036854775807",
        "1e+308",
        "09a0c8eb85f3cce17f100018ffffffffffffffff7f220631652b333038",
      ],
      "legacy-overflow-finite-negative": [
        "-1e308",
        -1e308,
        "-9223372036854775808",
        "-1e+308",
        "09a0c8eb85f3cce1ff1000188080808080808080800122072d31652b333038",
      ],
      "legacy-overflow-underflow-positive": [
        "1e-400",
        0,
        "0",
        "0",
        "09000000000000000010001800220130",
      ],
      "legacy-overflow-underflow-negative": [
        "-1e-400",
        0,
        "0",
        "0",
        "09000000000000008010001800220130",
      ],
    }[mode];
    if (!tuple) throw new Error("Unknown overflow case");
    const [literal, real, wide, text, hex] = tuple;
    const response = {
      text,
      real,
      _real: "real",
      integer: 0,
      _integer: "integer",
      wide,
      _wide: "wide",
    };
    const body = `{"real":${literal},"integer":${literal},"wide":${literal},"text":${literal}}`;
    const formattedBody = `{\n  "real": ${literal},\n  "integer": ${literal},\n  "wide": ${literal},\n  "text": ${literal}\n}`;
    const payload = Buffer.from(String(hex), "hex"),
      prefix = Buffer.alloc(5);
    prefix.writeUInt32BE(payload.length, 1);
    return {
      mode,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      body,
      formattedBody,
      responseText: JSON.stringify(response),
      preview: JSON.stringify(response, null, 2),
      wire: Buffer.concat([prefix, payload]),
      method: "/ownedlarge.Upload/OverflowEcho",
      editor: true,
      showNotice: false,
    };
  }
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
      real: finite ? 1 : null,
      value: finite ? 1 : 0,
      _value: "value",
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
