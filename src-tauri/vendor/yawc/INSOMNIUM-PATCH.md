# Local patch: yawc 0.4.3

Source: crates.io archive SHA256
7d6dd180f28fde9977748788203e03d417d0b60548ba29b645e0730842138015.
MPL-2.0 LICENSE, upstream source, README, manifests and VCS metadata retained.
Cargo cache marker and package lockfile omitted. No upstream tests are changed.

Change: compression.rs accounts decoded bytes across all compressed fragments
of one message, including inflate suffix/flush output. streaming.rs supplies
the configured decoded message-buffer limit. Inflate output is exposed to the
backend in at most 8192-byte slices, capped at remaining message allowance plus
one overflow-detection byte. Overflow returns an error before publication;
context takeover does not reset the per-message allowance. Allocator capacity
rounding remains separate from the logical decoded-byte bound.

Application negotiation is validated separately before calling this backend.
It does not rely on the upstream permissive extension parser or Stream facade
that converts protocol failures into EOF; the adapter polls poll_next_frame
and preserves errors for durable application history.

Frame guards: codec.rs rejects masked server frames, RSV1 on control or continuation frames, non-minimal extended lengths and the forbidden high bit of64-bit payload lengths. All control opcodes are limited to125bytes, not only Ping. Frame and reassembled message limits are inclusive (only values greater than the configured limit fail), matching the existing application budget. native/mod.rs applies that inclusive aggregate check. These rules follow RFC6455 sections5.1/5.2/5.5 and RFC7692 section6.1. No upstream test is added or changed.

Read-failure close ownership: native/streaming.rs now queues one bounded protocol Close for frame/decompression errors; native/mod.rs does the same for fragment assembly/UTF8 errors. Codes distinguish size1009, invalid payload1007 and protocol1002. The application awaits its existing bounded flush path before surfacing the original error, appending cleanup failure without hiding the cause. Decoder overflow is mapped to typed FrameTooLarge; no arbitrary payload is copied into the Close reason.
