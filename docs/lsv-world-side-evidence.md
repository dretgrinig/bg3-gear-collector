# B-only world-side evidence: supported surface exhausted

Ownership and serialized-instance continuity remain **unknown**. This research
adds no product, import, classifier, holder direction or persistence behavior.
The approved performance checkpoint was committed separately as
`57a066eac2732b2a8b3b5fababa06f626787fa3c` and pushed only to develop.
All subsequent assessment tooling and this document remain uncommitted.

## Authorized attempt and integrity

Exactly one ground-state B measurement used the caller-confirmed
`LevelCache/CTY_Main_A.lsf` and the previously reviewed exact Stats-family query.
No instance selector was invented, no other member was substituted, no automatic
retry occurred, and inventory-state A was not opened. Source fingerprint and
stat verification before/after reported **unchanged**. Payloads stayed in memory.
Only the already-approved sanitized projection was retained for assessment.
No source pathname, hash, selector value, UUID, character/campaign value or raw
payload is stored here or in the new fixtures.

| Metric | Observed |
|---|---:|
| Result | validated |
| Adapter total, including integrity handling | 5,977.91 ms |
| Worker round trip, including startup/transport | 5,813.28 ms |
| Remaining cumulative deadline margin | 24,022.08 ms |
| Work including projection | 20,544,440 / 24,000,000 |
| Projection work (already included above) | 1,562 |
| Aggregate expansion accounting | 94,552,852 bytes |
| Decoded-section accounting | 73,237,779 bytes |
| Bookkeeping peak accounting | 7,486,903 bytes |
| Retained evidence accounting | 27,360 bytes |
| Selected records / selector equalities / context nodes | 11 / 11 / 14 |
| Structural records validated: nodes / attributes | 543,108 / 1,024,178 |

Pure Worker CPU time, actual private-run yield count, exact cleanup-only time
and peak RAM were **not measured**. The 164.63 ms difference between adapter total
and Worker round trip combines source handling, projection and cleanup; it is
not a cleanup-only measurement. No second private attempt is permitted to obtain
missing timing fields. The actual run took longer than the primary synthetic
optimized samples, but remained inside both unchanged limits. This demonstrates
compatibility for this one bounded query, not universal browser/product speed.

## Complete selected-evidence inventory

**VALIDATED FACT:** the eleven exact query equalities are all on the reviewed
`Stats` field (type 22). They select eleven records, retaining multiplicity.
All eleven belong to one sanitized descriptor/path class, labelled **S01** by the
new deterministic grouping helper. S01 is an attempt-local schema-class label,
not an entity, candidate-instance ID or cross-save join key.

All selected paths are:

`Items -> ItemFactory -> Items -> Item`

Each record has the same ten projected attribute descriptors:

| Reviewed/redacted name | Type | Byte length | Opaque |
|---|---:|---:|---|
| CurrentTemplate | 31 | 16 | false |
| Level | 22 | 11 | false |
| Stats | 22 | 14 | false |
| [other] | 1 | 1 | false |
| [other] | 12 | 12 | false |
| [other] | 13 | 16 | false |
| [other] | 19 | 1 | false |
| [other] | 24 | 8 | false |
| [other] | 4 | 4 | false |
| [other] | 6 | 4 | false |

**VALIDATED FACT:** CurrentTemplate and Level descriptors occur in each selected
record. Their values were not projected. No CurrentTemplate equality, Level
value, UUID continuity or typed entity-reference join is established by descriptor
presence. The 11 Stats equalities are query-to-field observations, not 11
candidate-to-candidate relations.

**VALIDATED FACT:** named Creator, Entity, UUID, World, Position, Transform,
Inventory, Container and Holder fields/ancestors are not present in the returned
selected projection. That is a statement about these selected observations,
not proof that such structures or relations do not exist elsewhere in B.
Redacted labels and numeric types cannot be relabelled by semantic guesswork.
The type-12/type-13 descriptors therefore do not prove position or transform.
There is no selected opaque field, which does not establish absence of opaque
content elsewhere.

**SUPPORTED INTERPRETATION:** a supported level-cache ItemFactory branch contains
multiple exact members of the queried Stats family in the controlled ground
save. The reported ancestor path is structurally validated.

**PLAUSIBLE HYPOTHESIS:** at least one selected record represents the dropped
world item. Ground truth makes this plausible, but the selected schema does not
identify which record, distinguish cache/history, or prove world placement.

**UNKNOWN:** the dropped serialized instance, scalar Level value, actual spatial
placement, Creator/entity identity, spawned-object meaning, cached/historical
status, same-instance continuity and any player/container/holder relation.

**UNSUPPORTED:** selecting the first record, using source order, choosing by Stats
or CurrentTemplate alone, interpreting an equality as a directed relation, or
classifying ownership.

## Ambiguity and false-positive audit

All eleven candidates are indistinguishable under the available projection.
There are eleven candidate records and one descriptor class; collapsing them to
one item would discard ambiguity. No retained anonymous value token or graph edge
can partition them further. Actual UUID values and references were never present
in the sanitized result.

Synthetic counterexamples establish that:

- cache-like, historical or unrelated hypothetical records can produce the same
  selected schema; annotation outside the projection is not evidence;
- repeated template/UUID descriptors do not identify equal reference values;
- a single selected record still would not prove continuity or ownership;
- World/Position/Transform/Creator/Entity/Holder labels alone cannot establish
  placement or direction;
- redaction can merge different field semantics, while repeated descriptors
  must remain repeated;
- candidate/field order does not determine identity or pairing; schema groups
  and multiplicities remain deterministic (operational work can vary by sort).

**Audit limitation:** unrelated private records, cached definitions, status
sources and historical records were not collected as controls. They cannot be
empirically excluded using this report. Generic whole-resource validation did
validate unselected structures, but it did not return their semantic contents.
Synthetic counterexamples falsify an inference rule; they do not assert that a
particular counterexample occurred in B. The false-positive audit is complete
for the available selected projection, not a census of all private records.

The strongest proposed interpretation (one of these is the newly dropped world
instance) survives only as a plausible hypothesis: both a cache/history model
and generic family multiplicity remain consistent. Confidence is not upgraded
from the controlled gameplay action to serialization identity.

## Supported relation exploration

The ancestor chain above is the only returned structural relation for these
records. It encodes containment in the parsed node tree, not a semantic holder,
owner, world-placement or directed entity relation. Each selected record has one
Stats-field equality to the queried family. No candidate-to-Creator, entity-to-world
or item-to-player join can be traversed because scalar endpoints/edges are absent
from the approved projection. No absent value is reconstructed from byte length,
node count, anonymous label or position in the output.

## Correlation and competing models

Only already-reviewed sanitized Globals findings were used: inventory-state A
had four family candidates, ground-state B had three; one scalar occurrence and
an associated Creator.Entity/UUID row disappeared; template identity was
nonunique and no holder/player chain or serialized continuity was proved.
Globals was not reread or newly collected. The new level-cache count of eleven
is from a different supported surface, and cannot be arithmetically paired with
those four/three counts.

| Model | Supporting evidence | Contradicting evidence | Missing evidence | False-positive risk | Status |
|---|---|---|---|---|---|
| H1 Inventory representation disappears and world representation appears | Prior Globals disappearance; family records exist in B level cache | None decisive | A level-cache baseline; explicit world semantics; instance join | Generic existing records/cache can give the same result | unresolved |
| H2 Drop recreates the entity | No discriminating evidence | None decisive | Before/after deterministic instance keys and creation relation | Family/template reuse looks similar | unresolved |
| H3 Stable entity moves between representations | Controlled gameplay action is consistent, but not serialized proof | None decisive | Stable supported identity plus relation endpoints across states | Nonunique template or Stats equality | unresolved |
| H4 Globals change is cache/history cleanup | No discriminating evidence; still compatible | None decisive | Historical/cache semantics and an instance-specific transition | Treating any disappearance as movement | unresolved |
| H5 World-side data is present but continuity is outside supported surfaces | B contains family records in a level cache | No proof that these are the relevant world representation | Proven world classification and location of continuity relation | Assuming ItemFactory means live placed entity | unresolved |
| H6 Decisive relation lies outside current semantic surface | Current projection lacks needed endpoints | None decisive | Evidence identifying a particular missing relation/surface | Absence of evidence does not locate ECS or any other store | unresolved |

No hypothesis is ruled out or selected as a winner. Claims that counts, field
names, template descriptors or schema sameness prove continuity/direction are
rejected. These are rejected inference rules, not rejected H1-H6 models.

## What an A attempt could and could not answer

A is **not authorized or read**. One precise future supported question is:

> Does the already-reviewed exact Stats-family query on the same pinned member
> produce the same ItemFactory descriptor-class multiplicity in inventory-state A?

Use only the existing exact selector, no invented UUID selector or heuristic
family expansion. Outcomes: same eleven/same schema means no observed difference
on this selected surface; a different count/schema means a family-level supported
surface difference; zero matches means no match on that exact surface. None
proves which instance moved, world semantics, directed relation or ownership.

This is a specific bounded comparison question, but its identity value is low.
It does not justify promising an instance transition. A new authorization and
explicit B-dependent assessment would still be needed; this milestone does not
read A automatically after B success.

## Next scope, Globals and ECS decisions

New Globals collection is **not justified yet**: no selected instance-specific
reference value was retained to define an exact bounded join, expected candidate
count or false-positive control. The existing relation explorer cannot invent
that missing key. Do not name a speculative Globals collector or UUID.

ECS is **not justified**: no returned relation specifically points there, and
missing projection fields do not show that the underlying supported structures
lack them. No ECS decoder or broad save inspector is proposed.

The strongest safe next milestone is a **synthetic-only design/review of an
explicit bounded equality-projection contract** on already supported typed
fields. It should retain only anonymous, attempt-scoped equality tokens and
field roles needed to test candidate uniqueness, with family/cache/unrelated
controls, no raw values and no semantic direction inference. Its exact fields,
work/evidence/privacy costs and false-positive tests must be reviewed before any
new private measurement. This is not permission to broaden a generic parser or
reuse a fresh B budget now. It may prove that no useful key exists; that outcome
must remain acceptable. Owned Gear Import Preview remains blocked.

## True hard stops reached

The approved projection has been fully assessed. Recovering discarded scalars,
new UUID joins, original redacted names or unrelated private control records
would require another private read/attempt or changed collection semantics.
A comparison requires reading A. Both are outside this milestone. New Globals
semantics, ownership inference, ECS, generic codec/parser changes, larger limits,
weaker validation, product changes and protected-system writes remain forbidden.
No retry, unsafe inference or fabricated candidate resolution is used to cross
those boundaries. B itself encountered no timeout, malformed input or resource
failure.

## New tools and validation

- `experiments/lsv/evidence-assessment.cjs`: bounded descriptor-only assessment;
  exactly retains multiplicity, canonical schema groups, explicit missing-evidence
  coverage and unknown identity/ownership. No archive/resource or I/O capability.
- `scripts/assess-lsv-evidence.cjs`: sanitized JSON on stdin only, 512 KiB cap,
  fixed error output, no source-path arguments or save-file access.
- `tests/helpers/lsv-evidence-assessment-fixtures.cjs`: fabricated equivalent
  shape and independent counterexamples; no private save bytes or identifiers.
- `tests/lsv-evidence-assessment.test.cjs`: permanent ambiguity, false-positive,
  invariance, limits, privacy, CLI and actual synthetic projection integration.
- `scripts/qa-lsv-evidence-assessment.cjs`: disposable browser/real-Worker QA
  using fabricated projections, blocked storage and loopback GETs only.

Local assessment uses a separate 100,000-step / 30-second maximum only for
already-sanitized JSON. It cannot decode or reopen B, and is not a reset or
extension of the original 24M private pipeline. Limits can only be lowered.
Results are bounded to 512 KiB with conservative reservations. Input is not
mutated. Only reviewed schema labels and structural descriptors can be emitted.
Unknown labels, accessors, sparse data, inconsistent counts or invalid boundaries
reject with fixed diagnostics. The assessor is not authentication of arbitrary
caller-supplied reports and does not revalidate the underlying resource.

## Superseding cancellation/equality checkpoint

The earlier intrinsic AbortSignal-getter correction was rejected by Work: Node
could still invoke Proxy/internal-symbol accessors. The historical B measurement
above had no signal and remains unchanged; it was not repeated to fix that bug.

The assessor now accepts only primitive bounded JSON strings for input/options,
with JSON parsing inside the module. All arbitrary object inputs (including
Proxy, foreign objects and signals) reject without introspection. Cancellation
uses a module-owned opaque WeakMap capability; trusted host code may bridge its
own genuine controller event into `cancel(token)`. No caller-provided AbortSignal
is inspected. Errors are recognized privately, not by traversing thrown values.
The separate sanitized-analysis cap does not add to any private decode budget.

The later staged anonymous-equality milestone is documented in
`lsv-equality-projection.md`. Historical timing/test totals above describe the
previous descriptor-only checkpoint, not approval of the superseding code.
All new research remains uncommitted/unpushed pending review.
