# Exact-version MIT text gaps: primary provenance audit

2026-10-13. Read-only report against current root7fc3372 tool lock SHA2b647d41231545747271d86b75e7b95f6e8ad42514714163c1cb1233b315682c. No collector/product/producer/backend/API/dependency/lock/native/profile/build/SDK/provider change or launch. Only this report and own STATUS are committed; new artifact evidence contains public primary source downloads, never executed source. All audit handles terminal. Old proofs remain immutable. /compact unavailable; explicit handoff for root review.

## Findings

No authentic corresponding full MIT text was recovered for any of the three versions. Each exact npm tarball verifies SHA512 integrity against both registry version metadata and the current lock, plus registry SHA1; every tar header checksum is checked. Published package name/version match. All tarball entries and every blob in each untruncated published gitHead tree are captured and Git-object SHA1 verified. No LICENSE/NOTICE/COPYING file exists in these snapshots and no full MIT text was found in the examined contents. Keyword scan receipts aid review but do not themselves establish legal completeness or universal absence elsewhere.

| Exact package | Published source commit / primary metadata | Tarball SHA256 | Captured files |
| --- | --- | --- | --- |
| estree-walker1.0.1 | b52908c0fd79c45a9e7796e4c669acfa33dfd875; [registry version](https://registry.npmjs.org/estree-walker/1.0.1) |a1d7006242d3c456215cc26b1eca5e3f4906d16c02256493bbb57d3d8ade3d61 |8tar entries/16source blobs |
| is-reference1.2.1 |9d2719fbcc2059567203063f1e7b65d7831bfd64; [registry version](https://registry.npmjs.org/is-reference/1.2.1) |64378adcaca033879d0a0172497bae4a73f9c07a0e57df1c9469db82f18fafd5 |6tar entries/9source blobs |
| tr460.0.3 |a8009f9ce80ff5dbe71dd71e203afe4e4c878d28; [registry version](https://registry.npmjs.org/tr46/0.0.3) |164ae1eb32cea353551bbc7f9358dcaae4ffabbe65ec37a92ca464a9570a2a0a |5tar entries/9source blobs |

Exact tarball URLs: [estree-walker1.0.1](https://registry.npmjs.org/estree-walker/-/estree-walker-1.0.1.tgz), [is-reference1.2.1](https://registry.npmjs.org/is-reference/-/is-reference-1.2.1.tgz), [tr460.0.3](https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz). Artifact receipt records every byte count/hash, exact source URL and lock integrity:

- estree-walker: sha512-1fMXF3YP4pZZVozF8j/ZLfvnR8NSIljt56UhbZ5PeeDmmGHpgpdwQt7ITlGvYaQukCvuBRMLEiKiYC+oeIg4cg==
- is-reference: sha512-U82MsXXiFIrjCK4otLT+o2NA2Cd2g5MLoOVXUZjIOhLurrRxpEXzI8O0KZHr3IjLvlAH1kTPYSuqer5T9ZVBKQ==
- tr46: sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==

## Source/tag and attribution limits

[estree-walker v1.0.1 tag](https://api.github.com/repos/Rich-Harris/estree-walker/git/ref/tags/v1.0.1) and [is-reference v1.2.1 tag](https://api.github.com/repos/Rich-Harris/is-reference/git/ref/tags/v1.2.1) resolve exactly to their published gitHeads. Their tag trees also contain no license file. Both source package versions match the published versions. Their published READMEs state MIT without a full permission/copyright text; package author metadata names Rich Harris. An author field is not an authentic dated copyright notice and was not used to construct one.

[tr46 v0.0.3 tag lookup](https://api.github.com/repos/Sebmaster/tr46.js/git/ref/tags/v0.0.3) returns404; the exact [unprefixed0.0.3 tag](https://api.github.com/repos/Sebmaster/tr46.js/git/ref/tags/0.0.3) succeeds and matches published gitHead a8009f9ce80ff5dbe71dd71e203afe4e4c878d28. Its untruncated source tree and source package version0.0.3 are verified. The published package declares MIT and author metadata, but no full text. Those fields do not recover missing copyright years/holders or an authentic notice.

Immutable published-source trees: [estree-walker b52908](https://api.github.com/repos/Rich-Harris/estree-walker/git/trees/b52908c0fd79c45a9e7796e4c669acfa33dfd875?recursive=1), [is-reference9d2719](https://api.github.com/repos/Rich-Harris/is-reference/git/trees/9d2719fbcc2059567203063f1e7b65d7831bfd64?recursive=1), [tr46a8009f](https://api.github.com/repos/Sebmaster/tr46.js/git/trees/a8009f9ce80ff5dbe71dd71e203afe4e4c878d28?recursive=1). Content at each immutable raw URL is captured; no current/unversioned license is substituted. No generic SPDX MIT text or fabricated attribution is proposed.

## Decision and evidence

Keep the existing three rows unresolved/fullTextAvailable=false. There is no new authentic full text justified for collector adoption by this audit. Future adoption needs an authentic archived text or explicit primary provenance relating it to the exact published version; a later/current license file, metadata expression or guessed author/year is insufficient. Existing coverage=incomplete/no-new-completeness-blocker policy is preserved, with full redistribution/per-file/data/component/platform/migration gates still open. This is a precise examined-source gap, not a claim that no additional primary evidence can ever exist.

Artifacts/mit-text-gap-audit contains registry responses, exact archives/unpacked files, source trees/blobs, tag responses and receipt.json. Reproduce read-only capture with `bun artifacts/mit-text-gap-audit/capture.mjs`, then `bun artifacts/mit-text-gap-audit/tags.mjs`; do not execute package scripts. The original process92210 completed0; no live handles. Frozen artifacts/mit-text-gap-proof binds the report and every evidence file, with old413/406/57/16 proofs independently rehashed before handoff. Root decides any later adoption; current report introduces no code or release gate.
