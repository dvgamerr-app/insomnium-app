# Namespace fields: compact adoption, validation and removal focus

## Verified isolated implementation

After parent review of the frozen negative, ResponseNamespaces now adopts existing Field with additive `density="compact"`. Central forms.css owns compact6px gap and12px/18px normal caption, with inherited color; default Field DOM attribute omitted and existing default styles unchanged. No tokens/palette/global default changes. Exact numbered aria names remain stable valid/invalid. Typed NamespaceRowError carries authoritative row/field(s), preserving namespaceRows trimming, output, messages and precedence; duplicates mark all affected nonempty rows, reserved pairs mark prefix+URI, omitted blank rows are not attributed. Independent correction retains a still-invalid URI even if another prefix becomes invalid. Callback false/throw remains form-level. Focused removal chooses same-index surviving Remove, then previous, then Add; pointer/data/numbering/32cap preserved.

Final frozen `artifacts/namespace-field-proof/final/audit.json` SHA **503c1b034055c6b47571caeebf57c5f48f5a20a89e85eef721584a426ac2c117** binds677source/49frontend/66harness files (792total), exact11path guards, source and outputs. Mapping: sourceHashes under `final/source`, frontendHashes under `final/frontend`, harnessHashes relative to `final/` (`scenarios/...`, `verification/...`); `guards.json` binds exact current root originals/whole LF equality/new raw SHA. Nine existing originals match current root LF Git bytes; two namespace fixture paths must be absent. Earlier root original raw vs own CRLF bytes archived separately; no baseline product copies offered.

Terminal verification:

- `bun tests/ui/xml-response-filter.js --namespace-component`:4289 exit0,8profiles/88recorded checks,32refusals/48 exact affected field associations+distinct IDs,24 real keyboard removals/8 label clicks,512 exact32cap numbered textbox names,8 callback refusals+trimmed corrected saves/raw-response preservation. All earlier invalid/no-save/Escape assertions retained.
- `bun tests/ui/design-system.js`:98648 exit0, six compact/default profiles and all original assertions. SAME form-geometry now separately measures compact6px and default7→11px overridden token/restoration; default assertions remain intact.
- `bun tests/ui/resource-manager.js`:f0af7b exit0; previous accepted Field workflow unchanged.
- `bun run build`:d90ed6 exit0. `bun run check`:76937 terminal0errors/0warnings with explicitly isolated preview-helper supplement5493d735. Original own baseline has four preexisting fetch-option errors; initial40794 also exposed one new fixture type error, corrected before final acceptance. Supplement is consumed/frozen under final/source and original under final/verification, restored byte-exact before commit; `preview-restore.json` records restoration and it is NOT offered/staged. Ignored generators only; package/lock unchanged.
- Manual Bun receipts:11old/new validator output/message equivalences, structured duplicate indices, independent URI correction and omitted blank attribution; full geometry/style comparison EXACT for104controls/48captions/rows/dialog across8profiles.

Multiple legitimate field alerts require native helper presence `.first().waitFor()` instead of unique locator wait. Frozen audit proves entire original native helper body equal except this approved presence line, and original entry equal except explicit component branch; all original state/refusal/Escape/namespace assertions preserved. No native run or current native acceptance claimed.

Neutral geometry measurement uses a real hint click+pointer away. Earlier close-button-only background differences were keyboard focus modality (shared focus.css), not Field geometry; namespace rectangles/fonts/colors/backgrounds were exact throughout. Geometry comparison failures remain in the tool transcript; baseline and final exact metrics remain immutable. Design-default-only oracle failure is archived under `design-default-oracle-negative`. A corrected-save harness predecessor expected edits after Cancel had discarded them; archived under `corrected-save-harness-negative`, then actual accepted retry edited before Save with strict expected values retained. Caption comparison covers captured text/font/gap; caption color is inherited by scoped compact CSS and was not separately captured in the baseline.

Remaining gates: root guarded integration/current-root replay, fresh native namespace persistence/focus/generation, duplicate-announcement AT behavior, platform/private/global migration/UX. This isolated frontend is baseb95 plus owned accepted ResourceManager and this topic, not root's entire current runtime/native generation. All handles terminal; no profile claimed. Earlier Resource775 proofs immutable. `/compact` cannot be invoked by this interface; explicit handoff only.

## Original measurement checkpoint (immutable)

Measurement only, ui-next at 53ecbc0 before implementation. ResponseNamespaces and namespaceRows were unchanged. Current root raw originals are archived under `artifacts/namespace-field-proof/baseline`; every complete normalized LF source equals the corresponding own source. Root ResponseNamespaces raw SHA e1a5f076641835669a177027be855268618be6670662d2aba779553342bdca07; own raw SHA 1274a5aa94d88c46fe60f3b7cbd022121ca19e97f8333393b48c6bc8bb52d35d.

## Saved negative

`bun tests/ui/xml-response-filter.js --namespace-component` exited 1 (session43507). The explicit component branch exits before native execution. Actual component fixture, local snapshot only; no Tauri shim, workspace persistence, network, native profile or native acceptance. Existing native scenario body and helper assertions remain intact.

Frozen `artifacts/namespace-field-proof/negative/audit.json` SHA **0f9f7d94da432043225ab508758569bd28c00d238bded0300386180c787f80b4** binds source snapshots and exact emitted fixture bundle/result/measurements/failure screenshot. Eight profiles: dark/light ×1440/900/760/560, height600. 80 recorded checks and48 failures:

- 32 field association failures: duplicate prefix, invalid NCName, missing URI, reserved binding each refuse without save but have no input ID/aria-invalid/describedby. Exact numbered accessible names are already valid and stable; submit focus remains unchanged.
- 16 keyboard removal failures: after middle-row Enter removal preserves reused Remove2 focus, removing the last row with Space or the only row with Enter moves focus to BODY.
- Escape restores trigger focus and preserves local namespaces/save count/raw response. All32-cap cases disable Add and retain64inputs; no callback/data changes.

## Density contract measured before adoption

Labels and row gap are exactly6px, label font12px/18px normal; controls12px/16.8px, height34.796875px. At1440/900/760 the660px dialog has columns132.562/397.734/67.7031px. At560 it is528px wide and stacks into one478px column, within viewport and without horizontal overflow. Dark/light control colors/backgrounds and full rectangles are retained in measurements. Keep6px rather than adopting global Field7px implicitly; preserve exact control geometry and responsive breakpoint. Caption API changes require explicit review.

## Attribution boundaries for review

`src/lib/xpath-namespaces.js` validates trimmed nonempty rows, unique prefixes, XML NCName128, URI4096/no whitespace, reserved xml/xmlns pairs and32mapping cap. Duplicate and NCName failures identify prefix; URI failure identifies URI. Reserved bindings can involve either/both prefix and URI, so do not falsely classify them as prefix-only. Save callback false/throw remains form-level and must not mark local fields. Existing `namespaceRows` normalization and raw response/request metadata behavior must remain unchanged.

Proposed bounded correction after parent review: adopt existing Field locally with exact numbered accessible names/description IDs, scoped6px dense geometry, clear only corrected errors, and explicitly restore usable dialog focus after focused-row deletion. No global Field/tokens/styles changes. Next saved assertions should retain original four refusals/no-save/Escape, exact labels valid/invalid, correction and form-level callback failure, numbering,32cap and geometry.

## Documentation and gates

Primary sources consulted: [Svelte each/key semantics](https://svelte.dev/docs/svelte/each), [WAI description ID relationships](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA1), [WAI form labels](https://www.w3.org/WAI/tutorials/forms/labels/). These inform DOM identity and association; they do not establish platform acceptance.

At this original measurement checkpoint all handles were terminal, browser/server closed by shared fixture finally, and product correction/compiler/build were pending. The verified implementation above closes isolated compiler/build/component gates only. Earlier Resource775 proofs and e9c6099/53ecbc0 remain immutable; native/AT/platform/full migration still OPEN. /compact unavailable in this interface.
