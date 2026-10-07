# OAuth1 signing migration

Implemented in `src-tauri/src/oauth1.rs`, shared `digest::execute`, `src/lib/oauth1-model.js` and `OAuth1Editor.svelte`. This is request signing, matching the original manually supplied OAuth1 credentials; it does not add an automatic browser/token exchange.

## Supported behavior

- Enabled manual Authorization takes precedence, including empty or duplicate values. No OAuth1 signature or credential validation is performed on that path. Disabled manual rows restore normal signing. Native direct-input dispatch follows the same rule and uses normal client redirects; current manual-header loopback checks passed.

- HMAC-SHA1, HMAC-SHA256, RSA-SHA1 and PLAINTEXT. RSA accepts unencrypted PKCS#1/PKCS#8 PEM up to 8192 bits. RustCrypto performs cryptographic operations; application code normalizes OAuth protocol parameters.
- Consumer/token credentials, callback, verifier, realm, version, nonce and timestamp render environment variables. Blank nonce/time generate values per signed attempt. Blank version is omitted in RFC mode and defaults to 1.0 in legacy mode.
- New requests use RFC 5849 mode. Existing Insomnium OAuth1 resources with no bodyMode use explicit, visible legacy body mode. No imported credentials are rewritten or exchanged automatically.
- RFC mode collects duplicate query/form parameters, decodes UTF-8/form encoding, sorts percent-encoded names and values, then signs the effective method and URI. Realm is outside the signature. A manual Host header affects the base URI. Ambiguous duplicate Host/Content-Type headers and invalid UTF-8 fail explicitly.
- Optional body-hash extension signs buffered non-form wire bytes, including multipart boundary and binary content: SHA-1 for HMAC-SHA1/RSA-SHA1, provider-specific SHA-256 for HMAC-SHA256. Form + Hash Body and PLAINTEXT + Hash Body require explicit correction. This extension is a draft, not part of RFC 5849 itself.
- HTTP, GraphQL, SSE and WebSocket handshake share the native executor. Bodies buffer once, at most 20 MiB. Redirects re-sign the new method/URI only at the original origin; cross-origin requests lose Authorization/manual cookies/proxy auth. Existing redirect limit, client-certificate guard, timeout and cancellation wrappers remain. OAuth1 does not retry a 401 challenge.

## Original Insomnium body behavior

The archived adapter only supplied form data to oauth-1.0a when Hash Body was enabled. Without it, form fields were absent from the signature. With it, the original adapter constructed a JSON object containing configured callback/nonce/timestamp/verifier, followed by every form field, including disabled entries. Last duplicate wins; JavaScript property ordering applies. It hashed this JSON with the selected signature function, not an ordinary hash of transmitted bytes. Configured nonce/time then remain inside that JSON while fresh header values are generated; callback/verifier are absent from the header. Original PLAINTEXT returns the signature base string (or JSON for the body hash).

Legacy body mode preserves those behaviors visibly. It is not a claim of bit-for-bit compatibility with all original URL/parser bugs. Queries with literal plus, encoded names, empty segments, repeated empty values, literal extra equals or prototype-related edge cases are rejected for explicit review/RFC selection. A legacy form named **proto** also requires review. OAuth protocol parameters in URL/form must move to Auth. Percent encoding/canonical HTTP URI and header encoding follow the current native stack. Unusual legacy providers remain an acceptance gate.

## Postman import

Postman token maps to tokenKey and its form signing selects RFC mode; original source remains preserved. An absent/false addParamsToHeader means the original request used URL/form placement, so sending stops until Authorization header is selected explicitly. addEmptyParamsToSign and disableHeaderEncoding also stop sending until explicitly disabled. Unknown signature methods remain visible and fail; only the four methods above are implemented. Boolean strings true/false normalize; dynamic/invalid booleans require editing. As in Postman, imported form bodies do not use the body-hash extension.

## Verification and remaining gates

- Actual native modules compiled directly from stdin; 17 signature cases and 15 rejection cases passed. Included RFC 5849's POST example with verified erratum 2550, Unicode/duplicate parameters, HMAC-SHA256, both PEM formats independently verified by Bun crypto, PLAINTEXT, legacy JSON hashes and manual Host.
- Thirteen real loopback cases passed: same-origin 307 replay/303 GET, cross-origin removal and return, follow-off, client-certificate origin restriction, exact multipart hash, SSE, WebSocket upgrade, redirect cap, deadline, final 401 and Digest 401/200 regression. No test source/script saved.
- Direct JS preparation/import and compiled Svelte server rendering passed. This does not verify rendered WebView interactions, Tauri IPC, persisted reload, TLS/proxy/cookie integration or a real OAuth1 provider.
- Manual acceptance: create each method in Auth, import legacy/Postman samples, inspect unsupported options, send through a provider, cancel pending requests, reload/re-export credentials and verify no unexpected token/history record. Keep native UI and full legacy parity pending until exercised.

Sources: [RFC 5849](https://www.rfc-editor.org/rfc/rfc5849.html), [verified erratum 2550](https://errata.rfc-editor.org/search/?rfc_number=5849&presentation=records), [body-hash draft](https://www.ietf.org/archive/id/draft-eaton-oauth-bodyhash-00.html), [oauth-1.0a implementation](https://github.com/ddo/oauth-1.0a), [Postman runtime](https://github.com/postmanlabs/postman-runtime/blob/develop/lib/authorizer/oauth1.js). Archived source: `packages/insomnia/src/network/o-auth-1/get-token.ts` and its Auth editor.
