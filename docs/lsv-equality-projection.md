# Staged anonymous equality projection — research checkpoint

Ownership and instance continuity remain **unknown**. This checkpoint is
uncommitted/unpushed; no product/import/backend behavior is added.

## Cancellation and trust boundary

The previous assessor captured AbortSignal's getter. Node 24's implementation
can traverse caller-controlled internal-symbol/Proxy properties, so that was not
a native-brand check. The corrected assessor accepts primitive bounded JSON only
for observation/options, parses internally, and uses a module-owned opaque
WeakMap cancellation capability. Native cancellation is bridged by trusted host
code into that capability. Signals, foreign objects, Proxies, descriptor traps,
coercion hooks, accessors and boxed strings are rejected without introspection.
The CLI passes bounded stdin text directly. Error codes use private provenance.

New measurement configuration and Worker commands are primitive JSON. Worker
messages are structured cloned. Byte inputs are normalized using intrinsic typed
array slot getters into an ordinary owned view; own accessors and Proxy prototype
hooks cannot run. Existing generic research APIs are trusted-internal interfaces,
not a newly claimed hostile-JavaScript sandbox. The fixed-code VM removes APIs;
it is **not** a security sandbox for arbitrary code.

## Closed equality policy

Collection is opt-in, after the existing **whole-resource validation barrier**.
The default inspector retains its exact observations/work totals. Only selected
records on `Items/ItemFactory/Items/Item` qualify. Unexpected selected paths or
approved-field representations reject the whole attempt.

| Field | Type | Validation | Meaning |
|---|---:|---|---|
| CurrentTemplate | 31 | exactly 16 validated bytes | template-equivalence control only |
| Level | 22 | validated UTF-8; at most 64 encoded bytes including terminator | level-value control only |

Stats remains the existing exact family selector, not an equality field or
instance ID. Missing fields, zero UUID bytes and empty/default strings are
non-informative. Equality uses exact bytes in the same field/type domain; no
normalization, coercion, inferred roles, unrelated fields or name fallback.

The collector makes owned copies into a private arena. It retains no decoded
section views. Raw scalar values stay in the disposable Worker; reports carry
cryptographically random 128-bit session handles with collision checking.
Records receive independent attempt-local handles; classes can span the paired
session only to answer the approved equality question. No stable hashes, raw
UUID/string values, byte offsets, source paths or source fingerprints are emitted.

## Bounds and accounting

| Bound | Unchanged maximum |
|---|---:|
| Whole attempt deadline / aggregate work | 30 seconds / 24,000,000 |
| Selected equality records / approved fields | 128 / 2 |
| Endpoints/classes per attempt / pair | 256 / 512 |
| Owned private scalar arena across pair | 32 KiB |
| Additional equality-state reservation | 512 KiB |
| Total bookkeeping / retained evidence | 12 MiB / 4 MiB |
| Equality output per attempt / pair | 128 KiB / 256 KiB |
| Whole exported envelope | 512 KiB |
| Equality work, included within aggregate work | 500,000 |

Every allocation, field visit, lookup, copy, comparison, membership, profile and
serialization has conservative charges. Serialization state is reserved alongside
the arena/classes/retained B report. Retained B counts again inside A's aggregate
bookkeeping/evidence ceiling. Exact final bytes are checked after final metrics;
32 KiB of envelope room covers bounded host metrics/decisions. No truncation.
The stricter equality-state cap can reject before a larger public-output cap.
Some maxima cannot be reached simultaneously: the approved per-field lengths and
512 endpoints cap actual scalar keys below 32 KiB; lowered-limit tests exercise
exact private-arena boundaries without inventing broader fields.

There is one original attempt counter through decode, collection, comparison and
serialization. Host read/hash integrity passes and bounded protocol overhead are
reserved in it before decoding (four source-byte passes / 64 plus 4,096 units).
A gets a separate authorized attempt, never a reset within one pipeline.
The 90-second paired-key TTL starts at B attempt preparation; A must start with
at least 32 seconds remaining, checked in Worker and host before A file access.

The version-1 sanitized envelope contains kind, scope, completeness/integrity,
anonymous records/classes/memberships, multiplicities, joint profiles, coverage,
accounting and the explicit unknown ownership/continuity/unproven direction.
Class/membership topology is bounded; no quadratic record-edge graph is created.

## Lifecycle and cleanup

One Worker owns the paired arena. B must succeed and its source must verify
unchanged before the fixed predicate is evaluated. Ineligible, failed, cancelled
or expired sessions wipe owned arenas, clear private references and terminate.
Termination is awaited. Final self-review additionally hardened host failure
cleanup: request IDs prevent stale replies satisfying a later request, and the
host awaits an explicit wipe acknowledgement before termination, with a bounded
250-ms cleanup-only fallback if the Worker is unresponsive. An unresponsive
Worker is terminated/awaited; forensic erasure is never claimed. This does not
extend a successful decode deadline or authorize another attempt.

The successful private A path already wiped the session inside the Worker before
posting its result. The later acknowledgement hardening changes failure cleanup
only; private collection/projection/query code did not change during B/A and no
private attempt was repeated to verify that hardening.

## Stage A evidence

The full synthetic matrix covers trust/cancellation, exact equality domains,
missing/default fields, ambiguity, candidate permutation, collision retry/failure,
all applicable lowered/exact caps, aggregate accounting, validation of malformed
selected/unselected structures, cycles/depth/coverage/reference faults, source
mutation/replacement, deadlines, recovery, B-before-A file-access gates,
one-shot sessions, TTL and counterfeit topology rejection. Natural upper bounds
are supplemented by exact lowered-bound tests; no private vectors enter fixtures.

Three fresh uninstrumented Node process runs used 543,108 nodes, 1,024,178
attributes, eleven selected ten-descriptor records, genuine outer Zstandard and
dependent framed LZ4. Both sparse control and selected fields are validated; this
is not a cheap selected-only benchmark. Generation is excluded. All qualified
below 20 seconds and 23M work. Exact final timings and suite totals appear in the
consolidated report below.

Routine bugs found/fixed synthetically: literal-frame fixture encoding overhead,
browser expiry-timer receiver binding, uncharged profile/host preparation work,
serialization-state and final-byte growth, typed-view hooks, and stale-reply/
cleanup acknowledgement. No decoder/parser support or limits were broadened.

## Exactly one private B and conditional A

The approved exact member was `LevelCache/CTY_Main_A.lsf`, with the same reviewed
exact Stats selector. No payloads, selector values, private paths/hashes, scalar
values or character/campaign identifiers are included here. Both files remained
read-only and verified unchanged. No other member or Globals payload was read.

| Metric | Ground B | Inventory A |
|---|---:|---:|
| Result | validated | validated |
| End-to-end preparation/extraction/integrity | 6,236.83 ms | 6,316.01 ms |
| Aggregate work | 22,094,024 | 22,091,325 |
| Equality work, included above | 3,087 | 4,254 |
| Selected records | 11 | 10 |
| CurrentTemplate classes | 11 | 10 |
| Level classes | 1 | 1 |
| Informative memberships | 22 | 20 |
| Joint profiles | 11 | 10 |
| Bookkeeping peak bytes | 7,558,843 | 7,594,591 |
| Equality-state reservation bytes | 73,284 | 109,120 |
| Retained evidence bytes | 100,644 | 134,336 |

B's CurrentTemplate multiplicities are eleven singletons. Its one Level class
spans all eleven records. Every joint profile is a singleton. The topology is
therefore **not uniform**, even though Level alone is uniform.

### Predicate-by-predicate result

| Predicate | Result |
|---|---|
| All synthetic/performance/privacy/packaging gates passed before private read | pass |
| B validated; unchanged source | pass |
| Complete, no truncation, every cap respected | pass |
| 2–128 selected B records | pass: 11 |
| Both fields informative on every B record | pass: 22 memberships |
| At least two distinct joint profiles | pass: 11 |
| At least one class spans multiple records | pass: Level spans 11 |
| Same frozen collection policy/code/query during B/A | pass |
| Private comparator valid; A not previously attempted | pass |
| At least 32 seconds of TTL remain before A access | pass: B finished after about 6.24 seconds |

Exactly one A was read. No retries or alternative selector/member were used.
The Worker compared **all** profiles under the fixed question, never a presumed
dropped instance. Afterwards all owned private keys were cleared and the Worker
was terminated/awaited. No private values were retained for later experiments.

## Exhausted topology analysis and self-falsification

Under this exact selected query:

- ten joint profiles occur once in each save;
- one joint profile occurs once only in B;
- no profile occurs only in A;
- shared-profile multiplicities are unchanged;
- the common Level class occurs ten times in A and eleven times in B;
- record handles are not paired by position or treated as cross-save IDs.

**Strongest validated fact:** exact approved typed-byte equality distinguishes
one additional B-only selected profile while ten profiles persist on this
selected surface. The private values themselves remain undisclosed.

**Strongest supported interpretation:** the queried family-level ItemFactory
surface differs across the controlled inventory/ground saves. This is consistent
with the controlled drop, but neither identifies the dropped serialized instance
nor proves that this branch represents live world objects.

The uniform-projection hypothesis, identical selected-profile multisets, and
pure candidate-order explanations are rejected for this query. A-only appearance
and shared-profile multiplicity changes are absent. These are surface-level
hypotheses, not semantic ownership conclusions.

Repeated CurrentTemplate values do not explain multiplicity *within this selected
sample* (they are distinct there), but template/control values are not proved to
be globally unique, stable instance IDs. Shared Level has no discriminating value.
Cached/history representation, unrelated same-family records, schema-level
persistence, recreation and unobserved representation changes remain compatible
with the same sanctioned topology. Synthetic counterexamples reproduce these
count/profile results without a holder or owner relation. They falsify the
inference rule, not assert that such a counterexample occurred in this save.

H1 (representation transition), H2 (recreation), H3 (stable entity movement),
H4 (cache/history update), H5 (world data without continuity) and H6 (decisive
relation outside this surface) remain semantically unresolved. No winner is
selected. CurrentTemplate equality, unique selected joint profiles and persistence
are explicitly insufficient for continuity, direction or ownership.

## Hard stops and next evidence requirement

All authorized private attempts are exhausted. No second B/A, other member,
Creator/Entity collection, new UUID/Globals semantics, ECS, ownership classifier,
raised limits or protected writes were used. Owned Gear Import Preview remains
**blocked**; ownership and instance continuity remain **unknown**.

The strongest next milestone is a separately reviewed reference-role/ground-truth
design: establish what these approved reference values denote and prove a bounded
explicit item-instance → inventory/container → holder → player relation. Before
an ownership contract, evidence must resolve endpoint identity and direction,
exclude cached/history/template-only representations, test duplicates/absence/
multiplicity and controlled negative cases, and establish behavior across known
inventory/ground/container states. Any new field/member/private attempt requires
new authorization; this checkpoint implements none of that future work.

## Verification and repository state

Final verification: **102/102 focused; 996/996 LSV; 5,821/5,821 repository;
15/15 packaging; 104/104 native Chrome/Worker**. Every test passed with zero
failures, cancellations or skips. Native QA recorded zero runtime errors and
zero unexpected requests.
All changes remain uncommitted/unpushed on develop. Main and all 42 public files
remain unchanged. No network/backend/Supabase/Story/progress/storage writes,
deployment, PR, tag or release action occurred.

## Consolidated 65-point review report

1. **Overall verdict:** Ready for Work review as research only; uncommitted/unpushed. Owned Gear Import Preview is blocked.
2. **Cancellation root cause:** Node’s captured AbortSignal getter still traversed caller-controlled Proxy/internal-symbol state.
3. **Cancellation architecture:** Primitive bounded JSON + module-owned opaque cancellation state; genuine host controllers bridge cancellation without accepting external signal objects.
4. **Proxy/forged regressions:** Proxy, forged internal-state accessor, foreign/native signal and object inputs reject with zero caller hook execution. Genuine cancellation and recovery pass.
5. **Input-surface audit:** JSON boundaries, private error provenance, intrinsic typed-view normalization and structured-cloned Worker messages replace arbitrary object introspection in the new tooling.
6. **Equality architecture:** Closed opt-in collector after whole-resource validation; owned private arena in one disposable paired Worker; default inspector unchanged.
7. **Allowlist:** Exact selected ItemFactory path; CurrentTemplate type 31 / 16 bytes; Level type 22 / validated UTF-8 / at most 64 bytes including terminator.
8. **Memory accounting:** 32 KiB arena; 512 KiB additional state; retained B and serialization charged inside 12 MiB bookkeeping and 4 MiB evidence. Observed equality state B 73,284 / A 109,120 bytes.
9. **Work accounting:** 500k equality subcap inside 24M; original counter includes field/class/profile/serialization work plus host integrity reservation. No comparison reset.
10. **Privacy:** Raw keys never leave Worker; independent random collision-checked session handles; no private scalar, stable hash or source path in reports.
11. **Output schema:** Version 1 anonymous records/classes/memberships/profiles/multiplicities, coverage/integrity/accounting; unknown ownership/continuity and unproven direction.
12. **Synthetic/adversarial matrix:** 102/102 final focused checks; all trust, equality, boundary, structural, privacy, lifecycle, source-change, pairing and false-inference tests pass.
13. **Three qualifying runs:** 3918.44 ms, 3744.17 ms, 3889.01 ms; each 21,999,566 work. Final post-cleanup runs: 4762.03 ms, 4718.46 ms, 4796.15 ms; all qualify.
14. **Stage A:** Every required gate passed before B; source code/policy/query stayed frozen throughout B/A.
15. **B attempted:** Yes, exactly once; no retry.
16. **B result:** Validated successfully.
17. **B exact member:** LevelCache/CTY_Main_A.lsf; same reviewed exact Stats-family selector, undisclosed.
18. **B source integrity:** Verified unchanged before/after; read-only, no filesystem extraction.
19. **B runtime:** 6,236.83 ms, including preparation/extraction/integrity handling.
20. **B aggregate work:** 22,094,024 / 24,000,000; equality 3,087 included.
21. **B selected records:** 11; no truncation or arbitrary candidate selection.
22. **B classes:** 12 total: 11 CurrentTemplate + 1 Level; 22 memberships.
23. **B CurrentTemplate multiplicities:** Eleven singleton classes.
24. **B Level multiplicity:** One class spanning all eleven records.
25. **B joint profiles:** Eleven distinct singleton joint profiles; both approved fields informative on every record.
26. **B self-falsification:** Sample-local reference distinctions and common Level cannot identify the dropped instance, establish live-world meaning, global uniqueness or holder direction.
27. **Stage D predicate:** Passed.
28. **Predicate table:** Every row passes: synthetic gates; B source/completeness/limits; 11 records; 22 informative memberships; 11 joint profiles; repeated Level class; frozen contract; valid unused comparator; sufficient TTL margin. See detailed table above.
29. **A attempted:** Yes, exactly once after B verification/predicate, in the same private session; no retry.
30. **Failed A predicates:** None; no unauthorized A access.
31. **A measurement:** Unchanged source; 6,316.01 ms; 22,091,325 work (4,254 equality); 10 records, 11 classes, 20 memberships, 10 joint profiles.
32. **Pair comparison:** All approved joint-profile multiplicities compared under the exact selected query; no positional record pairing.
33. **Stable profiles:** 10 profiles, each once in A and B.
34. **A-only profiles:** 0.
35. **B-only profiles:** 1 singleton profile.
36. **Multiplicity changes:** No shared-profile count changed; common Level count is A 10 / B 11.
37. **Continuity interpretation:** Unknown. Persisting equality controls do not prove persistent serialized instances.
38. **Strongest fact:** One additional B-only joint value profile and ten shared profiles on this exact selected surface.
39. **Strongest interpretation:** A family-level ItemFactory surface difference consistent with controlled ground truth; no causal/instance/owner attribution.
40. **Hypotheses tested:** Uniformity, same multisets, ordering effects, shared vs appearing/disappearing profiles, multiplicity, repeated-value and cache/history countermodels.
41. **Hypotheses rejected:** Uniform B topology, identical A/B selected-profile multisets, pure reordering explanation, A-only appearance and shared-profile count changes for this query. No semantic H1–H6 winner.
42. **Self-falsification:** Cache/history, schema persistence, unrelated family records and recreation can still fit the same topology; equality-to-ownership/continuity inference is rejected.
43. **Ownership verdict:** Unknown; no classifier or holder inference.
44. **Instance-continuity verdict:** Unknown; no cross-save instance-ID claim.
45. **Bugs found:** Signal/input trust, synthetic frame overhead, browser timer receiver, incomplete charging/reservation, provisional/final-byte mismatch, typed-view hooks and failure-cleanup reply race.
46. **Bugs fixed:** All identified in-scope engineering bugs fixed with permanent regression or native coverage. No private attempt retried; final failure-cleanup hardening does not change successful private projection evidence.
47. **Regressions:** 65 additional checks versus the previous 5,756-test checkpoint; 102 focused total. Synthetic fixtures only.
48. **Files changed:** 16 files, research/test/scripts/docs only; complete list below. Only previously tracked edit is research resource.cjs.
49. **Diff stat:** 16 files, 1109 insertions / 6 deletions; complete reviewable diff supplied separately.
50. **Focused tests:** 102/102; targeted/performance/relation/pair coverage also included in full LSV.
51. **Full LSV:** 996/996, zero failures/cancellations/skips.
52. **Complete repository:** 5,821/5,821, zero failures/cancellations/skips; no unexplained skips.
53. **Packaging:** 15/15; exactly 42 intended public files.
54. **Native Chrome/Worker:** 104/104: targeted 41 + evidence 21 + assessor 13 + equality 21 + performance 8. Zero runtime errors or unexpected requests.
55. **Privacy/diff/whitespace:** Private path/value canary scan, complete diff self-review, all-file whitespace checks and git diff --check pass.
56. **Public bytes:** All 42 HEAD/source/packaged bytes identical; research excluded. Default inspector equivalence regression passes.
57. **Scalar disclosure:** No raw private CurrentTemplate/Level values, private paths or stable save hashes emitted or persisted.
58. **Globals:** No fresh Globals work or reread.
59. **ECS:** No ECS implementation or interpretation.
60. **Ownership classifier:** None; Owned Gear Import Preview remains blocked.
61. **Protected systems:** No product/Story/progress/backend/Supabase/storage writes; no commit/push/deploy/PR/main changes.
62. **True hard stops:** Both authorized private attempts exhausted and comparator destroyed. Further fields/members/private reads/joins/ownership semantics require new approval; no engineering blocker remains.
63. **Uncertainty:** Reference-role/live-world/cache semantics, global uniqueness, causal drop mapping, instance continuity, holder direction and ownership remain unproved.
64. **Next milestone:** Separately reviewed reference-role and controlled ground-truth relation design, without guessing another member/field or reopening these saves.
65. **Evidence before ownership review:** A validated instance identity and explicit item → inventory/container → holder → player relation, resolved endpoint/direction, cache/history/template exclusions and controlled positive/negative/duplicate/absence cases. No such contract is established here.

### Complete changed-file inventory

- `experiments/lsv/resource.cjs`
- `docs/lsv-equality-projection.md`
- `docs/lsv-world-side-evidence.md`
- `experiments/lsv/equality-worker.cjs`
- `experiments/lsv/evidence-assessment.cjs`
- `scripts/assess-lsv-evidence.cjs`
- `scripts/benchmark-lsv-equality.cjs`
- `scripts/measure-lsv-equality.cjs`
- `scripts/qa-lsv-equality.cjs`
- `scripts/qa-lsv-evidence-assessment.cjs`
- `tests/helpers/lsv-equality-fixtures.cjs`
- `tests/helpers/lsv-equality-scale.cjs`
- `tests/helpers/lsv-evidence-assessment-fixtures.cjs`
- `tests/lsv-equality-worker.test.cjs`
- `tests/lsv-equality.test.cjs`
- `tests/lsv-evidence-assessment.test.cjs`
