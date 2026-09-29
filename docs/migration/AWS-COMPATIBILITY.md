# AWS IAM compatibility

Implemented 2026-09-24; native UI/provider acceptance remains pending.

## Implementation

- Legacy `authentication.type = iam`, enabled toggle and accessKeyId/secretAccessKey/sessionToken/region/service are retained. Every field renders with the existing environment resolver. No AWS environment/profile/metadata credential discovery or account access is performed.
- Native `aws-sigv4` 1.6.0 + `aws-credential-types` 1.3.0 sign the actual buffered bytes (20 MiB limit), after multipart encoding. Shared executor covers HTTP, GraphQL, SSE and WebSocket upgrade. OAuth2 token exchange/browser envelopes clear the AWS config. Browser preview rejects AWS signing.
- Same-origin redirects are signed again with the effective method, URL and body. The original effective Host is retained for signing at that origin. 303 and POST 301/302 switch to GET and drop body/content headers. Authorization/date/session-token/checksum are removed at every redirect; cross-origin requests get no generated AWS credentials. Client certificate origin restrictions, cancellation/deadline and redirect limit stay in the existing executor.
- As in the original AWS branch, enabled AWS replaces manual Authorization. It also replaces X-Amz-Date, X-Amz-Security-Token and X-Amz-Content-Sha256, avoiding stale or duplicate signing fields. The Auth editor states this explicitly. Disabled AWS leaves manual credentials intact. Digest/OAuth/Basic/Bearer/API-key manual-header rules are unchanged.
- Effective Host drives legacy endpoint inference: amazonaws.com/.com.cn, global bucket.s3, s3-region, reversed es/aoss, email→ses and default us-east-1. Explicit fields override inference; email also maps to ses when supplied explicitly. Custom endpoints need an explicit service; dualstack/FIPS/new endpoint forms should supply both service and region. A manual Host with a port is parsed as an authority; duplicate/invalid Host fails before sending.
- S3 uses single URI encoding, disabled path normalization and generated SHA-256 payload header; ordinary services use AWS SDK double encoding and normalization. Session token is included in the signature. The AWS SDK signs existing eligible headers, including custom x-amz fields/content type, while transport/proxy/WebSocket-mutated headers and collection Cookie are excluded. Generated headers are marked sensitive using the SDK flags.
- Postman awsv4 maps accessKey/secretKey and preserves the source fields. Its missing service/region use Postman's execute-api/us-east-1 defaults. Imported query signing stays visibly blocked until the user chooses signed headers. URLs already containing signing credentials fail with guidance to disable IAM for a presigned URL.

## Explicit differences and remaining scope

The old adapter supplied only Host/content type/body text to aws4 1.13.2. The new implementation signs actual bytes and eligible manual headers. It follows AWS SDK query canonicalization, including all duplicate query values and empty keys; old aws4's S3 branch took only the first duplicate value and discarded empty keys. Unusual percent-encoded/slash/path behavior is not claimed to be bit-for-bit compatible with the old URL parser. Review these cases against the intended AWS service, rather than assuming a matching build proves parity.

CodeCommit's special `GIT` signing is explicitly blocked and remains a legacy gap. SigV4a, presigned URL generation and chunk/event-stream body signing are not implemented. Ordinary pre-existing presigned URLs can be sent with IAM disabled. There is no automatic clock-skew retry or credential acquisition. The original Enable toggle is respected; the legacy unconditional AWS parser branch is not reproduced when disabled.

Real AWS endpoint acceptance, temporary credential expiration, TLS/proxy/HTTP2, cookie-provider interaction, UI/environment switching/reload and Tauri IPC remain unverified. CUA exposes no apps/browsers. No AWS account or real credentials were used; no installer was run.

## Verification

- Svelte check: zero errors/warnings; Rust check/build and clippy `-D warnings` passed.
- Actual request structs/builders, AWS/OAuth1/Digest modules compiled from stdin into an ignored inspection binary. Persistent jar deliberately not attached. No new test scripts saved.
- 34 native cases passed: independent Bun HMAC-SHA256 oracle reconstructed canonical requests from received wire headers/body; UTF-8 JSON/text, binary, multipart, escaped/duplicate query, S3 path, endpoint inference, manual Host, same-origin replay/303 conversion, cross-origin credential stripping, follow-off, 401, redirect limit, SSE/WS, no-session-token and malformed/missing/mixed credential rejection. Oversized signed body failed before send.
- Browser rejection, disabled auth, Postman mapping/query-signing retention were inspected directly. Existing 14 manual Authorization/Digest/OAuth1 native cases passed against the modified executor.
- Windows release/NSIS packaging passed session 36145 (Rust release 4m04s); all 157 captured source hashes matched after packaging. Exact artifact/source fingerprints are recorded in STATUS/BUILD.json. These checks do not establish the runtime gates above.

## Sources consulted before implementation

- https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
- https://docs.rs/aws-sigv4/1.6.0/aws_sigv4/http_request/index.html (web fetch unavailable; read the official downloaded 1.6.0 crate source/settings/signing example)
- https://doc.rust-lang.org/cargo/commands/cargo-add.html
- https://raw.githubusercontent.com/mhart/aws4/v1.13.2/aws4.js
- https://learning.postman.com/latest-v-12/docs/use/send-requests/authorization/aws-signature
- https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/aws4.js

Installed API source: `D:/home/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/aws-sigv4-1.6.0`, plus aws-credential-types 1.3.0. Do not use a cached older SigningSettings page as evidence for the pinned API.
