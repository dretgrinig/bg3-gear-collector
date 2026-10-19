# Targeted LSF level-cache inspection (research)

SUPPORTED: a separate two-pass capability for LSF v7 / metadata format 0,
using existing supported codecs. No generic parser fallback or enlarged generic
index is provided. The implementation is synthetic-only pending Work review.
No private save was read for this checkpoint.

## API and trust boundary

`resource.createTargetedInspector({ selectors, limits?, targetedLimits?, signal? })`
creates one attempt. `selectors` contains 1–32 own-data `{kind, value}` objects:
`uuid` is an exact nonzero UUID (case-canonicalized), `stats` an exact
case-sensitive Stats token. Stats matches only type-22 `Stats`; UUID matches
supported type-31 values or exact UUID-shaped supported strings. No fuzzy,
name, substring, row-position or subset identity matching exists.

- `await captureResource(bytes)` accepts one synthetic/raw LSF resource.
- `await capturePackage(bytes, exactMemberName)` validates the archive and
  extracts exactly the caller-selected `LevelCache/...lsf` member.
- At most two captures share the SAME attempt accounting.
- `finish()` returns the only evidence report, after every capture succeeds.
- `usage()` returns phase/work/poison status only, never evidence or match/context counts.

Input bytes are copied into attempt-owned storage before asynchronous validation.
Archive inputs use the existing parser's own snapshot. Shared or detached backing
buffers reject. Payloads remain in memory. There is no file reader, filesystem
extraction, network, storage, product import, backend integration or UI operation.

`targeted-worker.cjs` is a dedicated one-request Worker. Its `run()` accepts
`{mode:'resource'|'package', inputs:[bytesA, bytesB?], selectors, memberName?,
limits?, targetedLimits?}`. `targeted-controller.cjs` owns a disposable Worker,
includes Worker startup in a maximum 30-second watchdog, cancels by termination,
and requires a new task/Worker after completion or failure. No existing research
controller/Worker operation changed.

## Pass 1: complete structural validation

VALIDATED before selection: header/layout/section consumption, frame/decode
lengths, complete name table, every node/attribute name, parent/owner/first
reference, every supported value encoding and range, exact cumulative values
consumption, root uniqueness, parent cycles/depth, complete attribute coverage,
owner agreement, and duplicate RESOLVED attribute names. Unsupported or malformed
unselected data rejects just like selected data. Compact owner chains derive
from attribute record order and must agree with each node's first declaration.
Format 0 has sequential section/value ranges, so inconsistent declarations reject
rather than introducing independent overlapping offset ranges.

The existing resourceLayout, namesFrom, validateValue, sectionBudget and bounded
codec functions are reused. Existing generic function bodies and limits are
unchanged. ScratchBuffer (type 25) ranges are validated but its contents are
UNKNOWN/opaque: never searched, decoded semantically, hashed or compared.

## Compact bookkeeping and memory

Retain last-attribute Int32 per node, derived next-attribute Int32 per attribute,
node state/depth Uint8 arrays, attribute-coverage bitset and depth-sized Int32
stack. Read other fields directly from decoded record tables.

Exact typed bytes: `6*N + 4*A + ceil(A/8) + 4*depth`.
Before allocating, preflight against 12 MiB. Root and per-node duplicate-name Set
entries add conservative 64-byte accounting reservations; their live high-water
also must fit 12 MiB. Name text/count and per-node attribute bounds remain those
of the existing parser. All decoded sections still exist: this is NOT streaming
section decompression or a hard browser heap sandbox.

Evidence accounting is cumulative across both captures: fixed reservations per
resource/selector, context record, selected node, match and attribute descriptor,
plus comparison envelope. Preflight each insertion. Reports contain no scalar
payload copies, so descriptors have fixed bounded shapes and allowlisted labels.
Anonymous handles refer to selectors only, not stable item identities.
Serialized output has conservative incremental reservations plus an exact final
UTF-8 check. Source/archive snapshots, codecs, name strings, JS containers,
serialization and GC add memory beyond the typed-bookkeeping number.

## Limits and work

All overrides are own data properties and may only lower ceilings.

| Targeted limit | Ceiling | Scope |
|---|---:|---|
| Nodes / attributes | 600,000 / 1,100,000 | Per resource |
| Live bookkeeping | 12 MiB | Per resource, including validation Set reservations |
| Retained evidence | 4 MiB | Combined captures/comparison |
| Selectors | 32 | Attempt |
| Selected records | 1,024 | Per resource |
| Context nodes / equality occurrences | 4,096 / 8,192 | Combined captures |
| Output | 512 KiB | Combined report |
| Work | 24,000,000 | Whole attempt |
| Deadline | 30 seconds | Whole attempt, including Worker startup watchdog |

Generic 400,000-node / 655,360-attribute / 32 MiB index bounds remain unchanged.
Existing file/member 128 MiB, cumulative expansion 512 MiB, name/string/depth
and 4,096-attributes-per-node bounds remain unchanged.

Work units charge record visits, name resolutions, comparisons/chain hops,
coverage visits, selection checks, context/output construction and one unit per
64 bytes (rounded up per operation) of bounded byte/string processing. Existing
codecs retain their own checks and receive remaining time; their compressed and
expanded byte spans also receive aggregate charges. This counter is deterministic
accounting, not an instruction counter. Repeated scans are fixed linear passes;
no candidate-by-entire-resource or Cartesian reference join occurs.

One expansion object charges manifests, selected outer members and nested section
expansions, once each. Direct raw-resource captures charge nested sections only.
Deadline/cancellation/work/evidence/context/equality/output never reset between
phases or captures. JS scans yield every 2,048 records. Reports are withheld until
finish; failure/concurrent misuse poisons the attempt and clears snapshots.
No retry with fresh budgets inside a failed inspector is permitted.

## Evidence semantics and privacy

Structural references outside bounds are fatal everywhere. Unresolved semantic
UUID equality is an allowed UNKNOWN observation. A complete zero-target scan is
VALIDATED, not a malformed result and not proof of absence outside this surface.
Matches have direction unproven; repeated matches retain multiplicity. All results
state ownership unknown, classification disabled and same-instance unproven,
even for a fabricated item/container/holder/player chain.

Only allowlisted schema labels, redacted `[other]`, counts, types, structural
indices/offsets, operation-local selector handles and metrics leave the Worker.
Unknown labels can merge after redaction; redacted paths are not schema identity.
No raw UUID, Stats token, private value, path, fingerprint or payload enters reports.
Thrown errors map to fixed code/message pairs; accessor-based error codes are not
read. No semantic interpretation of transforms, ownership, position or ECS exists.

## Future private measurement gate

After Work approval only: explicitly select corresponding authorized A/B
level-cache members, process ground-side first, and continue within the SAME
budgets. Verify private source fingerprints/stat identity before and after in a
separately reviewed read-only adapter; suppress observations on instability.
This checkpoint deliberately contains no private-file measurement adapter.
Stop on unsupported layout/codec/value, malformed skipped or selected data,
limit/deadline/cancellation, source change or need for ECS/new semantics. Do not
raise limits or silently restart time. No target is a scoped observation only.
Fresh Globals correlation, if required, needs explicit scope and shared budgets.
Owned Gear Import Preview remains blocked.

## Synthetic performance observation

One fabricated zero-match resource with 543,108 nodes and 1,024,178 attributes
used 7,483,639 typed-bookkeeping bytes and 7,483,831 accounted peak bookkeeping
bytes. An uncontended local scan took about 4.7 seconds and 14.0 million work
units. These are synthetic observations, not private-save compatibility or peak
heap claims. Two comparably sized scans may exceed the unchanged 24-million
attempt ceiling. Work review should authorize a single ground-side compatibility
measurement first; do not silently widen work/time limits for an A/B comparison.

The controller preflights message count, selectors and backing-buffer sizes
before structured clone, copies only bounded known request fields, and rejects
accessors without executing them. The Worker preserves existing outer codec/
resource-limit failure categories in its fixed sanitized error vocabulary.
