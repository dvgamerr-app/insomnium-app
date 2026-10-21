# Legacy protobuf common definitions

Unmodified `google/protobuf/{api,descriptor,source_context,type}.proto` and
`LICENSE` from the published protobufjs 7.2.4 package. The archive was verified
against its npm registry SHA512 integrity value and these files matched the
existing pinned legacy-reference installation byte for byte. See
`provenance.json` for the immutable version, archive URL/integrity and file hashes.

These sources correspond to the four additional common definitions registered by
@grpc/proto-loader 0.7.13. Saved-file Legacy compilation embeds them so changes
to prost's Google descriptors do not add newer fields or enum values. The
existing legacy field-name adapter supplies the bundled JSON's camelCase names.
ProtoJSON continues to use its normal resolver. The seven protobuf.js core
common files remain provided by the standard Google resolver.

The bundled JSON inlines some dependency definitions. Parsing these sources
retains standard `.proto` imports; exact JSON graph/load-order compatibility is
a separate remaining gate.

The upstream BSD license and provenance are included in Tauri bundle resources
under `notices/protobufjs/`. They are separate from generated Cargo notices;
their presence does not claim complete distribution or legal coverage.

Upstream: https://www.npmjs.com/package/protobufjs/v/7.2.4
and https://github.com/protobufjs/protobuf.js/tree/protobufjs-v7.2.4/google/protobuf
