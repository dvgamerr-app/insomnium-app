# ASAP compatibility checkpoint

Updated 2026-09-24. Implemented and directly inspected; native UI/provider acceptance is pending.

## Behavior

- Native JWT generation is shared by HTTP, GraphQL, SSE and WebSocket. Enabled manual Authorization bypasses generation, including unused invalid credentials; disabled ASAP does nothing. Browser preview reports native-only support.
- Insomnium mode uses RS256, a 600-second default lifetime, sub defaulting to issuer, iat/nbf/exp and a 20-byte random hex jti. Additional JSON claims merge last, including registered claims. A fresh token is generated per operation, reused on same-origin redirects and removed outside the original origin. The original adapter created a new generator per invocation, so its nine-minute closure cache was not a global request cache.
- Postman import maps iss/sub/aud/kid/alg/claims/exp and selects explicit Postman mode. It uses truthy registered-claim fallbacks, UUID v4 jti, no default nbf or typ, default 3600-second duration and effective-issuer subject fallback. Claims exp is an absolute timestamp; configured expiry is a duration. Claims kid can override the configured header kid.
- Supported Postman algorithms: RS256/384/512, PS256/384/512, ES256/384/512. ES512 uses P-521 with SHA-512 and the 132-byte JWS signature format.
- Unencrypted RSA PKCS1/PKCS8 PEM and base64 DER/PEM are supported. Literal backslash-n and quoted PEM normalization match the original generator. ES256/ES384 use PKCS8 matching the selected curve. ES512 accepts P-521 PKCS8 or SEC1 PEM/DER; data URIs still require PKCS8. PKCS8 data URI decoding is explicit, including percent-encoded kid; a supplied Key ID must match its embedded kid, or can be blank to adopt it. The original UI advertised data URIs but its actual adapter did not call the parser.
- RSA keys are bounded to 2048–8192 bits, fields and generated tokens to 64 KiB, and shared replay bodies to 20 MiB. Private keys remain ordinary local request credentials; generated tokens are not persisted as OAuth resources. Errors omit private key/token values. Authorization HeaderValue is sensitive.

## Deliberate differences and remaining gaps

This API client preserves explicit custom/expired claims rather than enforcing every server-side ASAP protocol requirement. Numeric dates are required. Legacy object/array/falsy additional claims are supported; unsupported primitive/prototype-property cases stop explicitly. Postman validates issuer/subject/jti as non-empty strings and configured duration as 1–3600 seconds; unusual loose JavaScript coercions and unbounded/negative durations are not reproduced. Zero/invalid parsed duration falls back to 3600, following the original Postman default behavior.

Entirely percent-encoded PEM or an encoded data-URI prefix is not decoded. Encrypted keys, unusual Postman key/claim coercions, real provider compatibility, Tauri UI/IPC/reload, TLS/proxy/HTTP2 and persistent-cookie integration remain acceptance work. No provider keys, user credential files or production endpoints were read. JWT body bytes are not a signed payload hash; ASAP authenticates with JWT claims.

## Evidence

64 direct native cases passed using actual signing modules and HTTP builders compiled from stdin, 27 direct token cases and 21 loopback wire requests. Independent Bun crypto verification covered all eight supported algorithms, PKCS1/PKCS8/base64/data-URI formats, claim precedence/defaults, unique IDs, key/algorithm/input rejection, same-origin replay, cross-origin stripping, body-dropping redirects, limit/follow-off/401 behavior, SSE/WS and manual override. Pure JavaScript import/environment/browser checks also passed.

45 Hawk, 34 AWS and 14 manual-auth/Digest/OAuth1 regression cases passed against the same updated executable. Persistent jar was not attached. Svelte check returned zero errors/warnings; Rust clippy -D warnings and debug library build passed. No test script/source was saved. These inspections do not establish native UI/provider acceptance.

## Sources read before implementation

- Official ASAP protocol: https://s2sauth.bitbucket.io/spec/
- Pinned original library: https://unpkg.com/httplease-asap@0.6.0/lib/authHeaderGenerator.js and https://unpkg.com/httplease-asap@0.6.0/lib/parseDataUri.js ; package metadata identifies Atlassian's repository https://bitbucket.org/atlassianlabs/httplease-asap . Read only; no package JavaScript runtime was executed.
- Original JWT payload/key validation: https://raw.githubusercontent.com/auth0/node-jsonwebtoken/v9.0.0/sign.js
- Postman authorizer: https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/asap.js
- Rust JWT API: https://docs.rs/jsonwebtoken/11.1.0/jsonwebtoken/ and installed 11.1.0 encoding/RustCrypto implementation. RSA DER is converted to PKCS1; EC DER remains PKCS8. Exactly one crypto backend (rust_crypto) is selected.
- UUID API: https://docs.rs/uuid/latest/uuid/struct.Uuid.html#method.new_v4
- Documented dependency command: https://doc.rust-lang.org/cargo/commands/cargo-add.html
- Archived application: network/authentication.ts, models/request.ts, ui/components/editors/auth/asap-auth.tsx and ui/components/auth-private-key-row.tsx under _backup/legacy-electron/packages/insomnia/src.

## ES512 follow-up (2026-09-24)

Added p5210.14.0 as a direct dependency with ecdsa/pem/std; this version was already in Cargo.lock through SSPI. jsonwebtoken11.1.0 has no ES512 Algorithm variant, so only this variant uses RFC7515 compact JSON/base64url encoding with RustCrypto signing. Existing JWT algorithms retain jsonwebtoken. No elliptic-curve/signature arithmetic is implemented in the app. Header alg is fixed to ES512 and kid follows the existing claims/data-URI rules; Postman mode has no typ. Legacy mode remains RS256.

The existing shared key decoder handles normalization/base64/data URI before selecting a P-521 key. PKCS8 validates the selected curve; SEC1 uses the library decoder/curve checks. Public-only, encrypted, wrong-curve and mismatched data-URI keys stop with secret-free errors. No key files are generated or read by this signing path; credentials stay in the existing local request field.

Inspected official p5210.13.3 docs first, then cargo info showed0.14.0 already installed. The0.14.0 docs.rs pages failed to fetch; read the actual downloaded crate ecdsa.rs, elliptic-curve0.14.1 SecretKey decoding and ecdsa0.17.0 signer/PKCS8 implementations. Its RFC6979 example retains an old TODO comment; the compiled dependency matched the official RFC6979 A.2.7 P-521/SHA-512 sample signature exactly in an inline inspection. This result resolves that specific example concern; it is not a general cryptographic audit.

89 actual native cases passed: all previous ASAP cases plus ES512 key formats, claims/mode restrictions, wrong/encrypted/public keys, explicit P-521 data URI, HTTP body, redirects/follow-off/final401, SSE and WebSocket.35 direct token results verified independently using Bun crypto across nine algorithms, including fixed132-byte ES512 R||S;31 authenticated wire observations. Svelte check0/0, clippy -D warnings, debug library build and formatting passed. Postman ES512 import/environment preparation passed. Source compiled from stdin; no test scripts saved. Real UI/IPC/provider/TLS/proxy/persistent-jar gates remain pending.

Additional sources: https://www.rfc-editor.org/rfc/rfc7515.txt ; https://www.rfc-editor.org/rfc/rfc7518.txt section3.4 ; https://www.rfc-editor.org/rfc/rfc6979.txt appendixA.2.7 ; https://docs.rs/p521/0.13.3/p521/ecdsa/index.html ; installed p5210.14.0 source/examples after documented cargo info/add.

Windows release session57219 exited0 (Rust release4m11s); all 165 captured source hashes matched after packaging. BUILD.json records the executable/NSIS hashes. No installer execution or publication; CUA still has no apps/browsers for real UI/IPC acceptance.
