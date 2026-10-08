# eventsource-stream local patch

Source: crates.io eventsource-stream 0.2.3, cached upstream package; original Cargo.toml/Cargo.toml.orig/README/source retained. License: MIT OR Apache-2.0, as declared by upstream.

https://github.com/jpopesculian/eventsource-stream
https://docs.rs/eventsource-stream/0.2.3/eventsource_stream/

Local fix: advance past the leading UTF-8 BOM by its encoded byte length instead of slicing a Rust string at byte 1. Preserves the existing parser and all other stream behavior. Added regression for every byte chunk width, initial empty chunk, and an interior BOM that must remain in data. Reproduced as an actual release-profile Windows native process panic before this patch. See docs/migration/STATUS.md and UI-TESTING.md for release evidence.
