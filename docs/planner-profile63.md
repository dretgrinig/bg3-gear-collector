# Bounded NewAge descriptor-63 compatibility

## Decision and evidence boundary

Support two explicit, uniform profile discriminators under the existing
`0x08000101` envelope: `lsmf-08000101-tag123` and
`lsmf-08000101-tag63`. A descriptor word does not itself validate a save. Every
accepted file must pass the complete unchanged structural validator before any
previously reviewed build/identity field is emitted.

This is category A **for the interpreted serialization layout**: the known
component layouts, owner maps and relative-pointer encoding are reused exactly.
It is not a claim that every opaque component's contents have been decoded, or
that the producer meaning of the differing word is known.

At descriptor +8 there is a bounded u32 name length. At +12 there is a separate
u32 which is constant across the descriptors in each measured file. Its internal
producer meaning and the reason one source uses 123 while another uses 63 remain
unproven. It is retained as an opaque, finite profile discriminator. It is not
used as an entity count, pointer, component version, identity or join key. No
allocation/capacity/flag interpretation is assumed.

Published reverse engineering disagrees here:

- [Pinned NodeJSmith directory reader](https://github.com/NodeJSmith/bg3-newage/blob/c3372b1988109a2fd1d35897e1895e387f7a916e/src/bg3_newage/lsmf.py)
  treats +8..15 as one u64 name size. That interpretation cannot describe the
  measured files: a nonzero upper word produces a size far beyond the names blob.
- [Pinned serialized-format notes](https://github.com/danielsamuels/bg3-savefile-parser/blob/9578ff7c46a1aa40c805f6b7beecf907f10fb3b8/FORMAT.md)
  repeat the u64 description. They are layout clues, not an acceptance oracle.
- [Pinned Wahkah format notes](https://github.com/Wahkah/BG3SE/blob/fb4b9d15068b3f48a630c2d68922c3a732f32699/README.md)
  split the words but call +12 an entity count. The measured entity tables have
  5,461–5,463 records, disproving that interpretation for these inputs.

No third-party reader was executed on a private input. Source code was inspected
only as a reference. No claim about patches, mods, platforms or producer causes
is inferred from these observations.

## Independent structural comparison

The descriptor-123 reference is the already reviewed implementation, synthetic
fixtures and retained sanitized compatibility result. No old private source was
reread for this audit. The new five-file measurement independently checked the
structure, without calling the build-field decoder or changing its profile gate.
Only the exact validated root Globals/NewAge/NewAge ScratchBuffer was selected.

| Property | Reviewed 123 contract | Measured 63 structure |
| --- | --- | --- |
| Header | LSMF, `0x08000101`, marker 32, zero reserved tail | Exact same |
| Header / descriptor size | 48 / 48 bytes | Exact same |
| Names | u64 relative offset, u32 length, bounded UTF-8, unique names | All validate |
| Descriptor +12 | Uniform 123 | Uniform 63 |
| Fixed data | u32 stride/version, u64 count/relative offset | Same encoding; all ranges validate |
| Name / fixed-array spans | No overlap | All validate |
| Entity list | Bounded 16-byte records, unique instances | All validate |
| Maps | 32-byte records, u32 owner indices | All validate |
| Owners | Exact count, unique and in range, no duplicate component map | All validate |
| Empty map buckets | Three all-ones pointers and count zero | Exact same |
| Metadata alias protections | No fixed-array/entity/map overlap except explicit reviewed cases | All validate |
| Class vectors | Bounded relative begin/end pair, 40-byte record stride | All validate |
| Pointer encoding | Relative to the end of the 48-byte header | Same for every interpreted range |
| Alignment | Exact element strides; no universal 8-byte absolute alignment assumption | Fixed starts use several residues, as variable-stride packing permits |

Reused exact component layouts (version / bytes per record):

- `core.v0.Level`: 0 / 32; `core.v0.EntityId`: 0 / 16.
- Character and Player: 0 / 1 each; Stats: 3 / 36.
- Direct Level: 0 / 4; Classes: 0 / 16, with 40-byte ClassInfo vectors.
- Origin: 0 / 16; IsCustom: 0 / 1; Avatar: 0 / 16.

Every observed component's descriptor version agrees with its `.vN.` name.
All five inputs have exactly matching versions/strides for common names. One
contains one additional opaque component type; no interpretation is attached to
its presence. The component directory counts are 358 / 359 / 358 / 358 / 358.
Owner-map counts are 228 / 229 / 228 / 228 / 228. Owner references total
187,486–187,585 per file; all are bounded and unique within their component map.
The independent pass used about 506k structural checks per file, below 2M, and
roughly 24 MB aggregate decoded expansion per file, below 512 MiB.

Row counts, concrete offsets and optional component presence may vary. They are
not new profile constants. Unknown component contents remain opaque. No stronger
claim is made about layouts absent from the synthetic/retained 123 reference.

## Implementation and safety

The first descriptor selects only 123 or 63. Every later descriptor must equal
that selection. No caller option can disable or choose the gate. The existing
123 result profile string is unchanged. The new profile string distinguishes 63.
Both execute the same validator and retain the same counters, deadlines,
cancellation, name/array bounds, exact interpreted sizes/versions, owner-map,
duplicate and alias checks. No parser, codec, resource cap or archive selection
changes. Generated output changes only the planner save-reader Worker; kernel,
optimizer, UI and all other public assets are unchanged.

This does not promote active party, bench state, current equipment, holder/slot,
live-instance/catalogue relations, ownership or inventory quantity. Existing
build/origin interpretation remains unchanged. Party and equipment issues remain
Unknown; reading does not apply anything to Story progress.

## Permanent verification

`tests/planner-profile63.test.cjs` uses fabricated assembly, never private bytes.
It covers equivalent valid 123/63 results, directory reordering, opaque equipment,
no-player and empty-map cases; uniform unknown and mixed tags; corrupt headers,
versions, strides, counts, ranges, owners, aliasing and duplicates; truncation;
exact work limits, cancellation and deadlines; actual generated archive/root/
Worker-boundary success and whole-result rejection. Positive compatibility tests
failed before implementation. Existing 123 tests remain unchanged.

Native Chrome QA can select the synthetic variant with
`BG3_QA_DESCRIPTOR_TAG=63`; default 123 is unchanged. Only 123/63 are accepted by
the QA option. The existing disposable-context flow exercises actual Workers,
320/390/768/1280, identity/spoiler gating, keyboard/focus, cancellation, replacement,
manual fallback and Story isolation. No private input is needed for browser QA.

Private measurements keep payloads and fingerprints in memory, report only
structural aggregates and verify source fingerprint/stat equality afterward.
No private names, entity IDs, save paths/hashes or bytes belong in this document
or the permanent fixtures. No LevelCache, StorySave or unrelated member is read.

## Completed verification

All five controlled inputs passed the real generated reader as descriptor-63,
within unchanged expansion/work/deadline limits. Source bytes and file stat were
unchanged. Candidate-count differences are not interpreted as party proof. No
controlled equipment or party differential was performed.

- New synthetic profile regressions: 60/60; seven positive/boundary checks failed
  against the previous implementation before support was added.
- Focused reader/profile/identity set: 170/170.
- Previous HEAD decoder versus new decoder, synthetic descriptor-123 cases:
  18 exact result/error comparisons passed, including unchanged step counts.
- Complete repository suite: 6,397/6,397, including packaging regressions.
- Isolated native Chrome, synthetic descriptor-63: 521/521, zero runtime errors
  and backend/write requests, at 320/390/768/1280 pixels.
- Pages package: exactly 51 public paths, source/output byte parity 51/51. Only
  the planner save-reader Worker differs from baseline; all other 50 public files
  are byte-identical. Research, source, docs, scripts and tests remain excluded.
- Generated planner bundles are deterministic; diff whitespace checks pass.
