# NTLM compatibility checkpoint

2026-10-01 native UI acceptance: bun tests/ui/curl-import-ntlm.js passed on artifacts/native-curl-ntlm-ui-probe/build-state.json. Evidence artifacts/playwright/curl-import-ntlm-1790794284777; validates imported explicit credentials with independent NTLMv2 proof, reload, connection binding, POST replay and manual Authorization suppression. Does not cover MIC/TLS binding/hosted provider/OS sign-in/proxy/mixed negotiation.

Updated 2026-09-24. NTLMv2 implemented and directly inspected; full legacy/native-provider parity remains pending.

## Architecture and behavior

Each operation has its own reqwest client and explicit SSPI credentials. HTTP/1.1, a one-idle-connection pool, disabled automatic retries and a connector guard keep the Type2→Type3 exchange on the same connection. The guard rejects a replacement connection before the underlying connector is called; a closed challenge connection stops with an explicit error. It is not merely a comparison of remote IP addresses. The actual inspected TCP source port also remained unchanged.

The first request is unauthenticated. After a 401 advertising NTLM, the executor sends Type1 and accepts a bounded Type2 challenge, then sends Type3. Final 401 returns normally. Negotiate/SPNEGO and Basic are never automatic fallbacks. Intermediate responses are drained to reuse the connection (maximum1MiB), and encoded request bodies are buffered once (maximum20MiB) for exact replay. The operation retains its existing overall deadline/cancellation; stream handshake deadlines remain separate from the stream lifetime. Request bodies accompany each authentication round, so application servers must honor 401 semantics before performing an operation.

All HTTP/GraphQL/SSE/WebSocket paths use this executor. Redirects retain the existing method/body/credential rules, reset the NTLM exchange, and never negotiate outside the original origin. Same-origin redirects may reuse the already-authenticated connection. Each request/credential selection gets a separate client; there is no global authenticated connection cache. Proxy transport uses existing reqwest configuration; proxy NTLM407 is not implemented.

Enabled manual Authorization takes precedence, including directly supplied native envelopes; unused credentials need not resolve. Disabled auth is omitted. Selected native NTLM strips URL userinfo before reqwest can turn it into preemptive Basic. The saved URL remains unchanged. Browser preview rejects NTLM explicitly.

Explicit DOMAIN\user, UPN and separate domain formats are handled by SSPI. UPN stays a full user principal name with an empty wire domain, rather than being split into a NetBIOS domain. Unicode credentials were independently verified. Empty username stops explicitly; no automatic OS account/SSO fallback. Credential fields are bounded16KiB and reject NUL. Passwords remain existing plaintext local request data. Generated messages are sensitive headers and are not persisted as token resources. Errors omit credentials/token bytes.

## TLS binding

HTTPS obtains the actual peer certificate through reqwest tls_info. x509-parser reads the signature algorithm (including RSA-PSS hash parameters), and existing SHA2 primitives implement RFC5929 tls-server-end-point. MD5/SHA1 certificate signatures select SHA256; SHA224/256/384/512 signatures use their hash. SSPI incorporates the resulting binding into Type3. Unsupported signature hashes or missing certificate metadata stop explicitly. Certificate trust/hostname validation remains the existing reqwest/rustls behavior. This is NTLM extended protection binding, not a replacement certificate verifier.

## Differences and outstanding work

- NTLMv1/LM compatibility, proxy407, OS default credentials and unusual server/username negotiation remain pending; no silent downgrade was added.
- SSPI0.22 sends configured workstation in Type1 only. Its Type3 workstation field is empty. UI states this clearly; imported Postman workstation is preserved. Type3 workstation parity must be implemented/verified before declaring full compatibility.
- A server that closes the connection after Type2 requires a new Send; Type3 is never retried on a new connection. Broader transparent restart/provider compatibility is pending.
- EdDSA/other certificate hash cases, native Tauri UI/IPC/reload, IIS/AD/real provider, proxy/custom client-certificate integration and persistent jar acceptance remain pending. Windows is the only compiled target; SSPI's platform dependencies still require Linux/macOS CI verification.
- SSPI supplies the NTLMv2/MIC cryptography. No bespoke NTLM password-hash or response implementation was added. Its optional network-client, smartcard, Kerberos resolver and default crypto-provider features are disabled; the crate still contains shared protocol dependencies.

## Inspection evidence

Thirty native cases passed with an independent Bun crypto NTLMv2 proof/MIC oracle and TCP source-port assertions (103 loopback wire requests). Includes Unicode/domain/UPN, raw/binary/multipart replay, same/cross-origin/body-dropping redirects, manual/disabled precedence, URL-userinfo override, follow-off/limit, final401, SSE/WS, malformed/missing/ambiguous challenges, oversized intermediate body/fields, empty username and closed-connection refusal. Postman field preservation and frontend/native-only preparation also passed.

Twenty-seven scenarios were additionally run over each of three disposable TLS configurations: RSA/SHA256, EC/SHA384 and RSA-PSS/SHA256 (81 case executions, 291 wire requests). The independent server checked the Type3 channel-binding AV pair, proof and MIC. Temporary certificate keys were created solely for these loopback checks; the OpenSSL input key files under artifacts were removed. The initial stdin-key attempt failed before any file was created. No user/provider keys were read.

Regression:64 ASAP +45 Hawk +34 AWS +14 manual-auth/Digest/OAuth1 cases passed against the updated executor. Svelte check0errors/0warnings, Rust clippy -Dwarnings and debug library build passed. No test scripts/source were saved; inspection helper compiled actual modules/builders from stdin. Persistent jar not attached, and these direct checks do not establish UI/IPC/provider acceptance.

## Sources and commands

- Microsoft connection-oriented flow: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/1f18ef3b-7d62-4e1a-a8a7-6bc0607fad70 ; full protocol index: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/b38c36ed-2804-4868-a9ff-8dd3182128e4
- reqwest connector layer and installed0.12.28 connect.rs/request.rs: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.connector_layer
- SSPI official API and installed0.22.0 examples/client.rs plus ntlm client/identity source: https://docs.rs/sspi/0.22.0/sspi/
- Tower Layer: https://docs.rs/tower/latest/tower/trait.Layer.html
- RFC5929 binding: https://www.rfc-editor.org/rfc/rfc5929#section-4
- X509 parser: https://docs.rs/x509-parser/0.18.1/x509_parser/certificate/struct.X509Certificate.html
- Disposable certificate command options: https://docs.openssl.org/3.5/man1/openssl-req/
- Documented cargo commands: https://doc.rust-lang.org/cargo/commands/cargo-add.html ; cargo info sspi; cargo add sspi@0.22.0 --no-default-features --manifest-path src-tauri/Cargo.toml; cargo add tower@0.5 --no-default-features --manifest-path src-tauri/Cargo.toml; cargo add x509-parser@0.18 --no-default-features --manifest-path src-tauri/Cargo.toml; cargo fetch --locked --manifest-path src-tauri/Cargo.toml.
- Existing dependencies resolved tower0.5.3; new libraries sspi0.22.0 and x509-parser0.18.1. No Node/npm/Python runtime used. SSPI requires Rust1.93; workspace Rust1.98.1 satisfies it.
