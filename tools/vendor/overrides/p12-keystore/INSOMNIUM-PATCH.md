# Ordered PKCS12 TLS identity decoding

Based on crates.io p12-keystore 0.3.2, original checksum
59710c89ee68e5cd17e8bac17a18e0a674bf959b11317531f481e612f567283c.
Original source, package metadata and MIT/Apache-2.0 license declaration retained.
Pinned application dependency and Cargo [patch.crates-io]; registry source unchanged.

KeyStore::first_tls_identity returns the first private key in encoded bag order and
all X.509 certificates in encoded order. TLS mode ignores aliases/localKeyID for
selection, accepts keys without localKeyID, skips subsequent private keys before
decrypting them, ignores secret/non-X509 bags and traverses nested SafeContents
with a depth limit of32. Existing KeyStore policies/alias sorting are unchanged.
MAC validation, ASN.1 decoding, encryption and KDF bounds use upstream routines.
Application matches the first key to the first certificate with matching SPKI,
then serializes that leaf followed by the other certificates and selected key.
The application still bounds files to1MiB and normalized identity to2MiB.

Official references:
- https://docs.openssl.org/3.0/man3/PKCS12_parse/
- https://raw.githubusercontent.com/openssl/openssl/openssl-3.0.16/crypto/pkcs12/p12_kiss.c
- https://raw.githubusercontent.com/nodejs/node/v22.0.0/src/crypto/crypto_context.cc
- https://docs.rs/p12-keystore/0.3.2/p12_keystore/
- https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section

Maintenance: preserve encoded traversal order and the skip-before-decrypt behavior
for later keys. Never use BTreeMap alias order or localKeyID as proof of key/cert
correspondence. Verify multi-key, alias/attribute, nested, missing-match, password
and first-key-selection fixtures against real TLS peers before acceptance.
Windows native production acceptance passes HTTP43, SSE38, WSS38 and gRPC67
checks, including nine multi-key fixtures for collection requests and reflection.
Independent OpenSSL3.5.7 PKCS12_parse proves encoded-order selection, absent or
contradictory attributes, nested/split Safes, later-key decryption skipping and
first-key password/missing-certificate refusals. Actual peer fingerprints and
pre-TCP refusals are checked by the saved scenarios. See docs/migration/STATUS.md
for exact artifacts and build evidence. Actual archived Electron runtime,
arbitrary algorithms/providers/platforms and extra-certificate trust-store
behavior remain separate parity gates; this patch does not claim full parity.

The WSS caller additionally loads extra PFX certificates into that connection's
root store, following Node LoadPKCS12. Modern/legacy CA bundles, earlier-container
CA retention after key replacement and selected/disabled/host/leaf-only controls
have native acceptance. HTTP/SSE/gRPC retain their own trust policy; OS stores are
unchanged. Exact archived-runtime and broader chain/trust behavior remain gates.
