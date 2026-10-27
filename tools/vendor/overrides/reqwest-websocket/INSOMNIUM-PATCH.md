# Local patch: reqwest-websocket 0.5.1

Source: crates.io reqwest-websocket 0.5.1 archive SHA256
cd5f79b25f7f17a62cc9337108974431a66ae5a723ac0d9fe78ac1cce2027720.
Source files, package manifests, README, changelog, example, formatting config,
VCS metadata and MIT LICENSE are retained from that archive. Cargo cache markers,
upstream CI and the dependency's own lockfile are omitted.

Change: src/native.rs permits an absent Sec-WebSocket-Protocol response even
when the client offered protocols, as RFC 6455 sections 4.1 and 4.2.2 require.
An unexpected selected protocol is still rejected. No protocol is invented or
injected into the response; WebSocket::protocol() remains None when omitted.
The public ExpectedAProtocol error variant remains for API compatibility.

Additional handshake corrections: Connection is a comma-separated token list
across repeated header rows; accept an Upgrade token case-insensitively instead
of requiring the entire first value to equal Upgrade. Sec-WebSocket-Accept
allows surrounding HTTP space/tab and must occur once. A present selected
subprotocol must be one ASCII token in one header row: malformed/non-ASCII
values are errors, never silently interpreted as absent. Strip only HTTP
space/tab around the selected token before comparing it with offered names.
These checks follow RFC 6455 sections 4.1, 4.2.2, 11.3.3 and 11.3.4.

Contract: https://www.rfc-editor.org/rfc/rfc6455#section-4.2.2
This patch does not implement compression or change frame processing.

Decoder integration boundary: UpgradeResponse::into_upgraded returns the native reqwest::Upgraded transport plus optional selected protocol after the same status/version/Connection/Upgrade/Accept/subprotocol validation used by into_websocket. Existing into_websocket delegates through the shared validated upgrade and still constructs Tungstenite with the original config. The raw API does not negotiate or validate extensions; its decoder caller must do that before accepting the session. This enables a compression-capable frame adapter without bypassing the existing auth/TLS/proxy handshake or duplicating its validation. No compression implementation is claimed by this preparatory API.
