# Round 1: bounded profile-associated schema neighborhoods

## Scope and result

The previously reviewed 16-file equality milestone was committed and pushed first as `b3f456d178881e89efc1adc0630879a82549a701` (`research: compare bounded lsv equality topology`). All subsequent work described here remains a separate uncommitted research checkpoint. No product UI, public artifact, generic parser/codec, structural ceiling, ownership classifier or backend changes are part of it.

**Research collection is exhausted under this authorization.** Exactly one new private B attempt ran after all synthetic gates passed. It stopped with `RESOURCE_LIMIT` after 5,985.14 ms. Its source verified unchanged; no partial observation survived. A was not attempted and had zero source opens. Worker cleanup acknowledged and the Worker exited. No retry, alternative member/selector, new scalar, fresh Globals, join or ECS investigation occurred.

The safe error envelope deliberately omits private/intermediate state and does not identify which resource sub-cap was exceeded. Consequently this result does **not** establish a particular child count, table shape, equality class, memory use or work-step count in B. Do not infer the limiting sub-cap from elapsed time or the fabricated fixture. Recovering that detail from the save would require another separately authorized private attempt; it is not needed for the product preview and is not requested as a prerequisite.

## Architecture

`createTargetedInspector` accepts an opt-in JSON neighborhood policy only inside the existing private equality session. It captures all exact selected ItemFactory records, retaining their approved ancestry labels and descendants through depth two. Whole-resource range/type/UTF-8/parent/cycle/attribute-coverage/name validation completes before any selection or projection. No first-match or presumed dropped-record selection is introduced.

A single bounded node pass uses validated parent references to identify children and grandchildren independent of serialization order. Existing typed validation scratch is reused for depth-two child-presence flags; no second full-resource index is allocated. An existing linear descriptor walk retains only reviewed schema labels (unknown labels become `[other]`), attribute type and opaque flag. No additional scalar, variable-value length, raw node index, value offset or sibling position enters the projection.

Each root receives a recursively canonicalized shape. Children and attribute descriptors sort by sanitized metadata; repeated shapes are interned under session-random handles. Every record remains associated with its equality profile and shape. Paired comparison aggregates all profile/shape associations and multiplicities rather than pairing serialized records. `redactionMayMerge:true`, `completeSubtree:false` and `maxDepth:2` are mandatory. A child-presence flag below depth two indicates uninspected structure, never complete subtree coverage.

The private comparator requires an identical query and projection policy on A. The original predicate is extended with `newDescendants`; no descendant evidence means no A source access. Source integrity, bounded complete B, all synthetic gates, unused A, valid comparator and at least 32 seconds of TTL remain mandatory. Failure destroys comparator state. Session-private scalar storage is cleared on destruction; this is not a forensic-erasure claim for the entire process.

## Fixed accounting

The original 30-second attempt deadline, 24M aggregate work, 12 MiB bookkeeping and 4 MiB evidence ceilings remain unchanged. Host source verification work is reserved inside that same aggregate counter. Equality remains 128 selected records, two reviewed fields, 32 KiB private scalar arena, 512 KiB equality state and 500k equality work.

Neighborhoods enforce depth two, eight direct children and sixteen grandchildren per root, 1,024 total contextual nodes and edges, 2,048 attribute descriptors, 32 descriptors per context node, 512 KiB new state and 1.5M structural work. Structural work is a sub-cap inside 24M, never an additional budget. Reservations include retained private class keys, metadata objects, associations, serialization/comparison and paired state; they also count against existing aggregate bookkeeping/evidence. Existing 128/256/512 KiB observation/pair/envelope caps apply to combined output. Every excess rejects rather than truncating.

During self-review, contextual edge accounting initially omitted ancestry edges. It now counts every parent/child edge within the context, and a permanent regression checks a connected context has nodes minus one edges. A Stats-only opt-in equality pass skips redundant post-validation schema-name resolution on non-Stats-compatible types; validation still resolves every name and validates every value. Conservative loop charging is retained. The default inspector remains byte-for-byte report/work equivalent in differential tests. Profiling markers support both frozen baseline and current selection-loop syntax.

## Synthetic qualification

Fabricated observed-scale paired workloads contain 543,108 nodes and 1,024,178 attributes, outer Zstandard and framed LZ4, eleven selected records and depth-two descendants. Each rehearsal uses a fresh uninstrumented process and a private Worker session. No private save bytes are used.

| Run | B ms | A ms | B aggregate work | A aggregate work |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4,454.95 | 4,510.89 | 22,144,073 | 22,146,106 |
| 2 | 4,418.05 | 4,517.64 | 22,144,073 | 22,146,106 |
| 3 | 4,366.85 | 4,497.71 | 22,144,073 | 22,146,106 |

All six attempts meet the strict <20s / <23M thresholds. Each fabricated projection has 36 contextual nodes, 35 edges and 154 descriptors. B structural work/state: 1,105,673 steps / 33,066 bytes; A: 1,106,558 steps / 67,955 cumulative paired bytes. B/A peak bookkeeping: 7,587,740 / 7,660,086 bytes. These are **synthetic** metrics, not estimates of private B.

Permanent new tests cover zero/one/eight/nine children, sixteen/seventeen grandchildren, depth-three omission, 31/32/33 attributes, exact 1,024/1,025 nodes and 2,048/2,049 descriptors, lowered state/work/edge bounds, exact serialization accounting, reordering, multiplicity, redaction collisions, opaque types, malformed selected/unselected regions and cancellation. Real Node Worker tests cover B failure/no A access, missing descendants, source change, timeout, cancellation, cleanup and recovery. Existing trust/TTL/source replacement/delayed-result/default-equivalence regressions stay active. Native Chrome adds thirty checks with fabricated bytes only, disposable context, blocked storage and loopback-only GETs.

## Evidence and falsification

No new private structural result exists because B failed closed. Its profile counts, neighborhoods, descendants, multiplicity and collisions are therefore **not available**. No new A/B comparison exists. Preserve the prior approved observation separately: ten selected typed-byte joint profiles appeared once in both controlled surfaces, with one additional selected profile once only in ground-state B. That proves a selected ItemFactory representation difference; it does not identify a dropped object or transfer direction.

Synthetic counterexamples demonstrate: identical sanitized shapes can contain different hidden values; unknown names can collide after redaction; different shapes can share identical approved equality values; World/Owner/Inventory/CacheTemplates labels and opaque fields do not prove semantics; serialization reordering preserves all canonical shape/profile multiplicities. Cache/history bookkeeping, generic family multiplicity, unrelated same-profile records and serializer behavior remain compatible alternative explanations. We reject the *inferences* that topology/family presence establishes live placement, ownership, movement or unique-instance continuity; we have not disproven these as possible real-world explanations.

Ownership remains **unknown**. Instance continuity remains **unknown**. Fresh Globals research, new cross-resource joins, Creator/Entity/UUID collectors and ECS remain blocked. Optional control-save pairs, richer ownership relations and new scalar/domain evidence are POST-MVP research; none is required for a read-only family-evidence preview.

## Product decision

The existing bounded Globals identity extractor already supplies exact Stats-family evidence with ownership unknown. A product adapter can conservatively present matched catalogue families, ambiguity, unsupported records and honest errors without new ownership research. CurrentTemplate must not be relabelled as a static catalogue template. No absence/family-match -> ownership inference is permitted.

The frozen contract and versioned DTO are in [lsv-import-preview-contract.md](lsv-import-preview-contract.md) and [lsv-import-preview.schema.json](lsv-import-preview.schema.json). They specify all thirty decisions, spoiler-safe counts/projection, local Worker lifecycle, no persistence/backend/progress writes, and one complete A–J Round 2 implementation milestone. Private-file product QA requires its own explicit authorization. This research checkpoint itself enables no public parsing/import UI.

**READY FOR ROUND 2 PRODUCT IMPLEMENTATION.** No further research is required for that conservative preview. A new private retry, new scalar, parser/support/limit expansion or semantic ownership classification is a hard stop for the affected line, not permission to postpone the safe preview.

## Final verification

New permanent regressions: 59/59 (44 neighborhood/Worker and 15 product-contract checks). Full LSV: 1,055/1,055. Complete repository: 5,880/5,880, zero failures/skips. Packaging: 15/15; all 42 public files match HEAD/source/artifact bytes. Native Chrome/Worker: 72/72 (30 neighborhood, 21 equality, 13 assessor, 8 default differential/performance/cancellation). The older default browser performance matrix first timed out while the full suite was concurrently consuming resources; its isolated rerun passed unchanged at 22.27–24.60s per attempt, within the existing 30s cap. No limits were relaxed. The separate required fresh paired neighborhood rehearsals all passed <20s / <23M as shown above.

Privacy/token/path scans, all-file whitespace, `git diff --check`, frozen non-documentation implementation hashes, generic-resource prefix comparison and protected-file byte checks pass. No private source was reread after the one new B attempt. The only post-measurement changes are sanitized documentation, including explicitly naming the already-supported LSPK v18 product format.
