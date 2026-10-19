# Ownership ground-truth pair: bounded observations, not classification

## Outcome and scope

**STILL AMBIGUOUS. Ownership remains unknown.** The caller's ground truth is:
A = an ordinary, unequipped Pitchfork loose in a character's main inventory;
B = that same Pitchfork dropped beside the character. B's filename said inventory;
its filename does not define its meaning. Incidental save-engine changes are noise
candidates, not automatically consequences of dropping the item.

This checkpoint adds reusable, research-only Globals comparison tooling and
fabricated tests. It does not add ownership classification, import/UI/apply flows,
ECS decoding, backend/storage writes or a way around resource limits. The existing
nine-file relation-explorer checkpoint is preserved. The local rescanning
optimization noted in its review remains deferred.

## Sanitized findings from the preceding authorized measurement

These are **prior measured observations**, not a claim that the newly added runner
has been rerun on private saves. No private save is read while implementing or
verifying this checkpoint. Inputs, fingerprints, character names, private UUIDs and
payloads are not included here or in fixtures.

| Supported Globals structure | A: inventory | B: ground |
|---|---:|---:|
| Nodes | 207,246 | 207,188 |
| Attributes | 321,451 | 321,382 |
| ItemFactory candidates | 4,858 | 4,857 |
| Pitchfork-family candidates | 4 | 3 |
| Creator rows | 4,858 | 4,857 |
| Nonzero UUID occurrences | 45,856 | 45,855 |
| Distinct UUID values | 23,667 | 23,666 |
| PlayerData rows | 17 | 17 |
| Opaque Globals NewAge bytes | 10,027,928 | 10,025,976 |

All Pitchfork candidates share one CurrentTemplate value. Its Creator.TemplateID
family has four occurrences in A and three in B. This equality does not join one
particular ItemFactory record to a particular Creator row.

Three associated Creator.Entity keys persist; one disappears. Across all Creator
rows, 4,857 Entity keys persist, one disappears and none are added. Each target-family
Entity key appears only in its own Creator.Entity field on the supported Globals
UUID surface. The separate Creator.UUID value in the disappearing row likewise
appears only in that row in A and nowhere in supported Globals references in B.
There is no proved inventory/container, holder or current player/party join.

The preceding diagnostic's supported scalar/type/length item evidence had 4,857
stable occurrences, one removed and none added; the Pitchfork family had three
stable occurrences and one removed. This is a multiset observation, not item-instance
identity. Unsupported attribute payload contents were not compared. The permanent
comparator deliberately makes the narrower, explicit comparison of **Stats,
type-31 CurrentTemplate and integer Amount only**; it never calls a whole item
record unchanged on that basis.

STABLE means a scoped evidence/key occurrence persists, not that the entity's
complete state or ownership is unchanged. REMOVED means absent on that particular
supported surface, not destroyed or unowned. A changed template-family association
with a persistent global Entity key is CHANGED, not globally REMOVED. Duplicate keys
retain multiplicity. Replacements have added/removed key observations without a
handoff interpretation. Other schema/status/behavior cardinality changes remain
UNKNOWN; there is no causal attribution to dropping the item.

The final diagnostic pass took about 27.5 seconds. Recorded indexing work was
1,886,137 steps before final scalar comparisons. The previous temporary snapshot
accounting was about 14.5 MB per save; it was not a peak-memory measurement. An
initial redundant-path diagnostic hit its own accounting cap; interning paths
removed that redundancy without changing parser limits. These timings/accounting
are historical observations, not guarantees for the new implementation.

## Reusable API

`experiments/lsv/pair.cjs` supports Node and a dedicated browser Worker:

- `createAnalyzer({ targetStats, limits?, signal? })` creates one bounded operation.
- `capture(validatedResourceIndex)` captures A, then B sequentially. Indexes must
  come from the existing validated LSF v7 / format-0 resource API.
- `compare()` returns one sanitized report. There is no exposed snapshot, UUID-key
  lookup or ownership classifier. Failed captures/queries cannot return partial
  results or be retried with fresh budgets inside the same analyzer.
- `usage()` exposes aggregate counters only. `remainingMs()` retains the original
  deadline and cancellation state.
- `analyzePackages([bytesA, bytesB], options)` uses the existing archive/Zstandard/
  resource path, selects exactly `Globals.lsf` and never reads other members.
  One cumulative expansion budget covers both manifests, both Globals extractions
  and their decoded sections. Each phase receives only the remaining deadline.

`targetStats` must be an explicit exact token. It selects a research family only:
there is no fuzzy matching, case-folded selector, catalogue/name fallback, subset
identity match, row-order association or implicit trust of CurrentTemplate as a
unique instance identifier. Missing/zero/unsupported template fields stay unusable.

The output always states ownership unknown, classification disabled, instance
continuity unproven and outcome STILL AMBIGUOUS, even for a synthetic apparently
complete holder/player chain. That is the intended semantic boundary, not a
classifier that happens to find no positives in this pair.

References are aggregate exact nonzero type-31 UUID / exact UUID-string equality
counts by redacted path, field and type. They are not directed edges. Field/node
labels outside a fixed allowlist become `[other]`; redaction can merge unrelated
schemas, so equal redacted counts are not full structural equality. Opaque buffers
are counted by length only, never read through `scalar()`, decoded, hashed or
claimed equal. Creator Entity/UUID observations do not bind Creator rows to items.

## Local read-only runner

Only after explicit authorization for the chosen inputs:

```sh
node scripts/measure-lsv-pair.cjs SAVE_A SAVE_B EXACT_STATS_TOKEN
```

The caller supplies both paths; none are embedded in code. A disposable Node Worker
runs the same production research modules. Its outer 30-second watchdog includes
startup, and the analyzer also maintains a single deadline across parsing and
comparison. Network/storage entry points are blocked. The parent opens explicit
sources read-only with leaf-symlink rejection, checks fingerprints/stat identity
before and after, and suppresses observations if source stability cannot be
verified. It never writes reports or extracts members to disk. Stdout contains
sanitized observations or fixed error codes only, never source paths or hashes.
A new Worker is required after failure/cancellation. This CLI has no UI integration.

## Additional pair-specific bounds

All can only be lowered through own data properties. Existing codec/resource/
structural/identity limits remain unchanged.

| Pair bound | Maximum | Scope / rationale |
|---|---:|---|
| Work | 4,000,000 steps | Shared captures + comparison; margin over observed two-save indexing plus comparisons |
| Index accounting | 32 MiB | Combined snapshots, typed storage and map/histogram reservations; not heap/peak memory |
| References / distinct UUIDs | 65,536 / 32,768 | Per capture; reuse relation-explorer ceilings |
| Item candidates / Creator rows | 16,384 / 16,384 | Per capture; bounded pools, observed fewer than 5,000 |
| Redacted schema paths / text | 2,048 / 512 KiB | Combined interned schema dictionary |
| Reference schema groups | 2,048 | Per UUID, no pairwise adjacency expansion |
| Target Entity / target UUID keys | 1,024 each | Explicit bounded family diagnostics; actual pair had four |
| Output accounting | 512 KiB | Conservative incremental row accounting plus exact final UTF-8 size check |
| Deadline | 30 seconds | One operation including archive/resource stages; never reset between saves |

Output accounting includes a 4 KiB envelope reservation and conservatively counts
nested rows again inside their outer diagnostic row. Thus it may reject before
actual JSON reaches 512 KiB. Tests use accounted usage for exact cap boundaries.
The tool is intended to fail closed, not guarantee acceptance of every save that
fits the underlying parser. Sorting is bounded by target/schema caps; UUID groups
are aggregated rather than expanded into Cartesian node pairs.

## Separate, unimplemented level-cache design problem

The preceding manifest comparison found five level-cache members: three changed
compressed byte sequences and two identical ones. The largest changed B member
extracted exactly (8,668,536 compressed -> 21,312,353 bytes). Its header is LSF v7 /
format 0. Existing structural preflight then rejected it before section decoding:

| Requirement | Declared | Existing cap |
|---|---:|---:|
| Nodes | 543,108 | 400,000 |
| Attributes | 1,024,178 | 655,360 |
| Typed index formula `27*n + 22*a + 4` | 37,195,836 bytes | 33,554,432 bytes |

This checkpoint neither attempts that resource nor changes any of those limits.
The next separate design review must decide how to validate/query this evidenced
layout with explicit memory, count, work, deadline/cancellation and partial-result
rules, preserving malformed-reference/cycle checks. Do not bypass validation by
scanning raw UUID bytes, silently raise limits or infer serialization from external
live ECS headers. No evidence yet proves the missing relation specifically lives
in NewAge. A broad ECS decoder is not justified.

Do not request a second pair yet. First resolve safe access to the world-side
resource. A later character-to-character transfer can help distinguish membership
from holder identity if the reviewed evidence still requires it.

## Verification

Synthetic fixtures reproduce removal, replacement, duplicate-template ambiguity,
changed family association, row/attribute reordering, cache/history/status/world/
non-player/broken/conflicting holder shapes and deliberately apparent player chains.
Every case remains unknown. Resource tests cover below/at/above limits, aggregate
work across captures/comparison, original deadline/cancellation, source preservation,
redaction, malformed inputs, Worker failure and fresh-Worker recovery.

The CLI is tested only with fabricated disposable files. Native Chrome checks use
new disposable contexts, synthetic Worker inputs and loopback-only GETs with
storage/backend access blocked. No private pair rerun is part of this implementation.

Research, tests, scripts and docs remain excluded from the existing 42-file public
artifact. There is no product/auth/sync/Story/progress/ownership/database/Supabase,
PWA, transport, deployment, commit or push action. Owned Gear Import Preview remains
blocked. This checkpoint must return to Work review.

### Final checkpoint verification

- Focused pair regressions: **61/61** (45 comparator, 16 Worker/CLI).
- Complete LSV research suite: **627/627**.
- Complete repository suite: **5,452/5,452**, zero failures.
- Packaging regressions: **15/15**; local build: **42 files**.
- Disposable native Chrome/Worker checks: **21/21**, zero runtime errors or unexpected requests.
- Public HEAD/source/dist bytes: **42/42 identical**; research remains excluded.
- Earlier nine-file relation checkpoint: byte-identical to its approved snapshot.
- Parser/resource/codecs/inventory implementation and structural caps: unchanged.
- Tracked diff and all new-file whitespace checks: pass.
- Documentation/privacy checks: no private UUIDs, fingerprints or embedded save paths.
- No private save reread, ownership classifier, commit, push, PR or deployment.
