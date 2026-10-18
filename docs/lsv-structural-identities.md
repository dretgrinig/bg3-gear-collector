# Phase B: structural scale and read-only item identity checkpoint

This research checkpoint replaces the historical uniform 65,536-record LSF
probe cap with separately bounded typed indexes. It does **not** establish player
inventory ownership. No Save Inspector/import UI, apply operation, Story/progress
mutation, storage, backend, upload, or deployment integration is added.

## Structural contract and limits

The existing outer archive, Zstandard and LZ4 implementations are unchanged.
`resource.openResource()` shares the validated codec path with `decodeResource()`
and retains a request-bound indexed view. Existing `decodeResource()` returns its
previous summary shape. Heavy work stays in the dedicated Worker. The index is
iterative, not a recursive JavaScript object tree; it exposes node descriptors,
attribute descriptors and explicitly supported typed scalars. UUID decoding uses
the .NET Guid byte order used by the pinned LSLib `BinUtils.ReadAttribute()`.
ScratchBuffers remain opaque. Format/version/attribute support is not broadened.

| Bound | Hard maximum | Basis |
|---|---:|---|
| Nodes | 400,000 | About twice the observed 196,784 |
| Attributes | 655,360 | About 2.16 times the observed 302,638 |
| Typed index plus scratch | 32 MiB | Preflight `27 * nodes + 22 * attributes + 4`; maximum tables need 25,217,924 bytes |
| Names / name buckets / keys | 65,536 each | Previous limits retained |
| Aggregate name text | 8 MiB | Explicit bound, separate from report size |
| Attributes per node | 4,096 | Bounds per-node duplicate-name sets and descriptor lists |
| Structural link/record work | 12,000,000 steps | Observed validation about 2.5 million; same counter also bounds indexed reads |
| Item candidates | 16,384 | About 3.7 times the observed 4,435; output limit also applies |
| Canonical catalogue rows | 1,024 | Margin over the existing 555 |
| Strong IDs per row / bytes per ID | 64 / 256 | Exact bounded token/UUID namespaces |
| Identity traversal/matching work | 2,000,000 steps | Includes set intersection work; no pairwise catalogue scan |
| Identity report | 8 MiB | Incremental checks plus exact final serialized-size check |

Only lower overrides are accepted. Structural overrides are separate from the
unchanged codec `limits`. Existing file/member bounds of 128 MiB, cumulative
expansion of 512 MiB, individual string limit of 1 MiB, depth 64, report limit
10 MiB and cumulative active Worker deadline of 30 seconds remain unchanged.
Index allocations are preflighted before decoding/index construction. The shared
expansion budget charges the outer member and internal sections exactly once.
Loops yield at bounded intervals; malformed references/cycles/owners, duplicate
names, unreachable attributes and invalid values still reject. Keys are checked
once per keyed node, so attribute scans remain linear in aggregate. Malformed,
unsupported, resource-exhausted, cancelled and timed-out failures retain distinct
Worker error categories.

This is bounded application memory, not a hard Worker memory sandbox. Codec
workspaces, strings, temporary descriptors, serialization and cloned reports add
memory beyond the exact decoded/index byte counters. No mobile peak-memory claim
is made.

## Measured Globals structures and scope

The authorized private sample structurally validates as LSF v7 / format 0:
196,784 nodes and 302,638 attributes. Its measured structural paths include:

- `Items/ItemFactory/Items/Item`: 4,435 concrete factory records, with `Stats`
  (FixedString, type 22) and `CurrentTemplate` (UUID, type 31).
- `Items/ItemFactory/Creators/Creator`: 4,435 creator records.
- `CacheTemplates/CacheTemplates/Template/InventoryList/InventoryItem`: 142
  cached definitions, **not** live inventory membership.
- `CacheTemplates/CacheTemplates/Template/ItemList/Item`: 44 cached definitions.
- `Characters/CharacterFactory/Characters/Character`: character records, not
  used to infer holders from positions, flags, names or proximity.
- `NewAge/NewAge`: an opaque ScratchBuffer carrying the later ECS boundary.

No explicit holder/container relation is established from the concrete Item
attributes. A tested `CurrentTemplate` to Creator `Entity` equality join produced
zero links. Positional row association, a guessed alternate UUID join, coordinate
matching, Flags bits and free-text inference are deliberately not substituted.
The 186 cache definitions are excluded. No static root-template mapping is
invented from `CurrentTemplate`.

`inventory.extractGlobalsItems()` therefore returns an explicitly **unscoped
global item pool**, not a player-owned inventory. Each record retains its source
member/path/node index, exact Stats evidence, save-local CurrentTemplate evidence,
explicit numeric Amount only if present, and duplicate-record evidence. Records
are never collapsed into an ownership claim; quantity defaults are not invented.
`ownership` is always `unknown`, `holder`/`container` remain null, and absence
never emits unowned/found/progress instructions. Unsupported or partial identity
fields remain explicit. Cached, historical and world-state presence cannot be
promoted to player possession.

## Catalogue identity and deterministic output

The caller supplies the tracker's already-ingested canonical catalogue, with
unique `(act + '|' + name).toLowerCase()` progress keys. The reader neither
normalizes nor deduplicates/reclassifies catalogue rows. `gameIds` are exact
existing alternatives; malformed arrays/IDs and duplicate progress identities
reject. Prototype-sensitive tokens use Maps/Sets, never object-property dispatch.
Input arrays/bytes are preserved; accessor properties are rejected without reads.

Matching builds bounded exact indexes, rather than scanning the catalogue for
every item. Stats tokens are case-sensitive, without trimming/fuzzy/name/suffix
fallback. Explicitly reviewed static-template UUID evidence can use the exact UUID
index, but the measured save adapter emits **no** such evidence. A supplied
unknown stronger template never falls back to a weaker Stats hit. Contradictory
exact identities or multiple catalogue rows remain ambiguous; no first match is
selected. `save-current-template` is retained evidence, never a catalogue lookup.
No new alias data or external dependency is introduced.

Schema 1 output includes coverage, candidates, per-candidate match status,
aggregate counts, warnings, limits, provenance and separately identified timing
metrics. Candidate order follows validated node order; ambiguous catalogue results
sort by canonical progress key. Timings are explicitly nondeterministic metadata.
The Worker/controller `extractGlobalsItems(catalogue)` operation is restricted to
`Globals.lsf` and returns **no raw resource buffer**. The new module is loaded
only for this operation; existing inspection/read/framing startup paths retain
their original imports. Results are memory-only, not logged or persisted.

## Evidence and next gate

Independent synthetic fixtures cover real-scale tables, exact/default/lowered
caps, corrupt declarations, index/name/aggregate budgets, owner/graph validation,
cancellation/deadlines, prototype-shaped names, exact UUID byte order, duplicate
records, unknown/partial/unsupported identities, ambiguous/contradictory matches,
no fuzzy fallback, no ownership inference, deterministic ordering and real
Worker/controller execution. Existing codec/security tests remain active. The old
65,536-cap regression now explicitly requests that lower cap; the new default
boundary tests prove that limits were replaced, not removed.

An initial private aggregate run found 4,435 candidates: 341 matched records,
4,093 unmatched, 1 ambiguous and 0 unsupported forms. Matched records cover 318
distinct catalogue identities. These numbers **do not count player-owned gear**.
All 4,435 records retain unknown ownership; no private IDs/values/path/hash or
payload bytes are checked into git. Final tests and frozen-source measurement
are recorded in the checkpoint report.

**Not ready for Owned Gear Import Preview.** The next separately reviewed step is
bounded, read-only evidence for explicit ECS inventory/container/member/holder
relations (or an independently proven alternative), with joins and ground truth.
Only then may a future preview label candidates as owned. Do not build apply/UI
or use coordinate/flag/name heuristics to cross this boundary.

Format references, read as specifications only; no third-party implementation or
semantic tables copied:

- [Pinned LSLib LSFReader](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/Resources/LSF/LSFReader.cs)
- [Pinned LSLib BinUtils](https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/BinUtils.cs)
- [BG3SE inventory component definitions](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Components/Inventory.h)
  describe live component fields, **not** proof of their on-disk serialization.

### Final frozen-source measurement and focused QA

The authorized Globals-only Worker run completed without implementation changes,
limit failures or effects: 341 matched records, 4,093 unmatched, one ambiguous,
zero unsupported forms; 318 unique catalogue identities matched. All 4,435
candidates remained unknown ownership. The source fingerprint/relevant stats and
repository snapshot were unchanged during measurement. Payloads/IDs remained in
Worker memory; only aggregate counters were returned by the measurement adapter.

One uncontended local observation (not a performance guarantee): outer extraction
9,500 ms; section decoding 976 ms; structural validation/indexing 1,454 ms;
traversal 361 ms; field extraction 99 ms; matching 88 ms; cumulative active Worker
12,602 ms. Charged expansion was 22,782,053 bytes including the 2,720-byte manifest,
4,829,384-byte outer member and 17,949,949 internal section bytes. The exact typed
index allocation count was 11,971,208 bytes, not a claim of whole-process peak RAM.

Focused research tests passed 507/507; packaging passed 15/15. Disposable Chrome
passed 56/56 synthetic checks, including observed-scale records, retained codec/
detachment regressions, exact and ambiguous matches, cancellation, deadlines and
existing research workbench behavior. Zero runtime errors/unexpected requests;
no real profile/account/storage access. Complete repository verification is
reported with the Work checkpoint. All public artifact bytes remain unchanged.
