# Phase B ownership research — explicit relations, not possession inference

## Checkpoint outcome

**OWNERSHIP NOT YET FOUND.** All existing candidates retain `ownership: unknown`.
No classifier, player-owned/unowned/equipped output, import preview, apply action,
Story/progress change or persistence is enabled. This is local research only.

The complete currently decoded LSF node/attribute tables were scanned for typed
UUIDs and exact UUID-valued strings. Opaque ScratchBuffers, translated string
contents, embedded/sub-string UUIDs, integer handles and ECS serialization were
not interpreted. Thus this is an exhaustive scan of that **supported structural
reference surface**, not a claim that every possible relationship in the save
has been decoded. Dynamic/unreviewed schema labels are redacted in permanent
reports. No scalar UUID/profile/name values or private payload bytes enter docs,
fixtures or reports. All regression identities are fabricated.

## Sanitized structural map

| Path / structure | Observed shape/cardinality | Direction / identity / confidence |
|---|---|---|
| `Items/ItemFactory/Items/Item` | 4,435 records; Stats type 22, CurrentTemplate type 31; no direct Inventory/Holder/Owner attribute | **PROVEN STRUCTURE**; serialized item pool, not proven possession; CurrentTemplate is not an instance key |
| `Items/ItemFactory/Creators/Creator` | 4,435 Entity UUIDs, 4,435 TemplateID UUIDs, 3,901 nonzero UUID fields | **PROVEN STRUCTURE**; independent exact identities; no positional association accepted |
| `Characters/CharacterFactory/Characters/Character` | 255 records; CurrentTemplate, FollowCharacter, EnemyCharacter, Flags | **PROVEN STRUCTURE**; does not by itself establish current party or control |
| `Characters/CharacterFactory/Creators/Creator` | 255 Entity values; 255 exact UUID-form TemplateID strings | **PROVEN STRUCTURE**; character template/entity semantics remain unproven as a join to current Character rows |
| `.../Character/PlayerData` | 16 records | **PROVEN STRUCTURE**; player-associated data is a **PLAUSIBLE** lead; current party/control membership is **UNKNOWN** |
| `.../PlayerData/PlayerCustomData` | OwnerProfileID: one nonzero UUID-form value; ReservedProfileID: 13 nonzero values, one distinct value | **PROVEN STRUCTURE**, profile reservation is not inventory ownership or active party; values withheld |
| `.../Character/CreatedTemplateItems` | 76 Object attributes, 51 distinct UUID-form values | **PROVEN STRUCTURE**; includes cache/template co-references; not a current inventory list |
| `.../Character/StatusManager/STATUS` | ten nonzero SourceEquippedItem attributes | **PROVEN equality** to ten Creator.Entity values; current equipment/inventory semantics **UNKNOWN** |
| `CacheTemplates/CacheTemplates/Template/InventoryList/InventoryItem` | 142 cached definitions | **PROVEN STRUCTURE**; excluded from item candidate extraction, not live membership |
| `CacheTemplates/CacheTemplates/Template/ItemList/Item` | 44 cached definitions | **PROVEN STRUCTURE**; not possession evidence |
| `Journal/DialogLogs/DialogLog/RelevantParties/Party` | 100 UUID-form Object occurrences, one distinct value | **PROVEN STRUCTURE**; historical dialogue context, not current party membership |
| `AnubisFramework/Component/Handle`, `AnubisFramework/Data/Entry` | component/entry UUID co-references; 4,016 Entry.Handle occurrences / 914 distinct values | **PROVEN STRUCTURE**, equality is not an inventory component contract; no ownership semantics assigned |
| `NewAge/NewAge` | one 8,968,160-byte opaque ScratchBuffer | **PROVEN byte boundary**; decoded contents and inventory relevance **UNKNOWN** |

All promising known container/inventory/player/equipment labels plus Character
and Item descendants were inspected in the exploratory census. The final tool
also scans UUID occurrences across other roots, preserving equality edges while
redacting unknown schema labels. No live LSF inventory/container-to-holder chain
was found. Relevant property names assist discovery only; names/flags/proximity,
record order and object counts never authorize ownership classification.

### Independent metadata cross-check

The existing bounded `meta.lsf` decoder also validated 19 nodes / 45 attributes.
`MetaData/MetaData/PartyMetaData/CharacterMetaData` has four rows containing
CharacterIconID (type 22) and CharacterName (type 28). No names/icon values were
reported or used to identify entities. The three type-31 UUID attributes belong
to module/ruleset metadata. There is no reviewed deterministic join from these
party-display rows to a live holder entity. Matching names/portraits to characters
would be an unsafe identity substitute and was rejected. Source bytes/relevant
stats remained unchanged, and the Worker returned no payload buffers.

## Exact joins and rejected hypotheses

The scan indexed **40,430 nonzero UUID occurrences**, **20,444 distinct values**,
723 zero UUID occurrences and 6,065 exact UUID-form string occurrences. Zero UUIDs
are never joined. Maximum observed equality-group fanout was 822 occurrences.

For the 4,435 item CurrentTemplate fields:

- zero other matching UUID occurrences: **0**;
- exactly one: **1,288**;
- multiple: **3,147**.

These are **template co-reference counts**, not proven inbound item-instance
references. An authoritative item instance identity has not been joined, so the
latter cannot honestly be reported as zero/one/many inventory memberships.

Every item CurrentTemplate has an exact Creator.TemplateID equality. Of these,
1,296 candidates have one matching Creator row and 3,139 have several. There are
**zero** CurrentTemplate matches to Creator.Entity or Creator.UUID. Overall
weighted co-references include 48,021 Creator.TemplateID occurrences and 43,586
other Item.CurrentTemplate occurrences: reused values invalidate a general
one-to-one bridge. No averaging, row alignment or "first match" is substituted.

Creator.Entity has 4,435 distinct values: 4,371 have no external co-reference,
23 have one and 41 have multiple. Ten status SourceEquippedItem fields match ten
of those Entity values exactly. This proves a stored status-source equality; it
does **not** prove the source is presently equipped, the affected character owns
it, or the character is player-controlled. Effects can outlive/refer beyond an
inventory state. No such semantics are inferred from the field name.

Rejected as ownership proof:

- serialized presence or exact catalogue match;
- CurrentTemplate → arbitrary/positional Creator.Entity association;
- shared TemplateID → unique item instance;
- CreatedTemplateItems → current held inventory;
- PlayerData/profile reservation → active player/party membership;
- Journal RelevantParties → current party;
- cached template `InventoryList`, template owner fields → live ownership;
- status SourceEquippedItem → current equipment/holder;
- generic Anubis UUID/handle equality → inventory/component semantics;
- missing reference → unowned.

The previous identity measurement remains 4,435 candidates / 341 matched records /
4,093 unmatched / one ambiguous / 318 distinct catalogue identities. This checkpoint
reran unchanged identity extraction in the exploratory measurement, and the final
permanent operation measures relations only. Neither set counts owned gear.

### Anubis / GameControl follow-up

A targeted metadata census also inspected Anubis Data/Entry, Scalar/DataIndex,
Table/TableEntry, Variable/Value, Tree/State/ValueIndices, Component and
ParameterOverrides, plus GameControl dialog/trade/gossip structures. Observed:
41 Data groups, 13,177 entries/scalars, 13,089 variables, 296 components/trees,
352 tables and 220 table entries. Index/Kind/TreeIndex/DataIndex/EntryIndex fields
are explicit structures, but their application semantics were not guessed.

Discovery-only inspection of TypeName/Name/ConfigName/SelectedNode/Path string
labels found player/party terms in variable/behavior context; none of the audited
labels contained inventory/container/holder/owner/equipment terms. Only the
allowlisted exact type label Item was reported. All other string values stayed
private. This text search is **not** a semantic discriminator or proof of absence.
No concrete inventory chain was found here; extending a numeric behavior/table
interpreter without a verified contract would not establish ownership. GameControl
exposes dialog/gossip context and an opaque buffer, not a demonstrated party roster.

## ECS boundary and ground truth

NewAge/ECS serialization was not decoded or searched for semantic values. The current
structured tables were sufficient to reject the obvious unsafe joins; they were
insufficient to prove live inventory membership. Further ownership work likely
needs a separately reviewed serialization map for ECS/handles **or another
explicit independently validated representation**. This is an inference, not
proof that ownership must be in NewAge.

The upstream [BG3SE Inventory component definitions](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Components/Inventory.h)
show separate live owner/container/member concepts. They are useful research
vocabulary; they are **not** an on-disk save specification, and their layout or
component names are not imported as save classification rules.

There is no independently observed current-inventory ground truth for the
supplied save. Neither labels nor plausible graph shapes are sufficient. A
controlled pair can provide the missing behavioral evidence once an explicit
serialization contract is available; the pair alone does not authorize a guessed
ECS decoder.

### Minimal human-controlled save pair (~2 minutes)

1. In a quiet, safe location outside combat, pick one ordinary, uniquely
   recognizable **non-stackable, non-quest** item. Do not equip it. Keep it in one
   player-controlled character's **main inventory**, outside nested bags.
2. Keep party composition, selected character and location unchanged. Make a new
   manual **Save A** while the item is in that inventory.
3. Drop **only that item** onto the ground immediately beside the character.
   Do not move characters, rest, travel, talk, trade, sort/transfer other items,
   change equipment or alter party composition.
4. Immediately make new manual **Save B**. Do not overwrite either save.
5. Copy the two `.lsv` files to the private research directory as
   `ownership-A-inventory.lsv` and `ownership-B-ground.lsv`. Keep them outside git.
   Record separately which item/character you used; no private labels need to be
   committed or published. Automatic save metadata/time differences are expected.

Do not edit/repack save bytes. No game manipulation or pair creation is performed
by this checkpoint. A later read-only differential run requires explicit file
selection/authorization and must compare deterministic relation changes, not infer
ownership from a change count alone. Inventory → another party member or camp
chest can be follow-up pairs after the simplest ground transfer is understood.

## Bounded explorer / API

`relations.buildRelationIndex(validatedIndex, options)` reuses the existing
validated `resource.openResource()` view. Typed arrays index node/attribute/token
positions; Maps retain bounded exact canonical UUID keys privately. No duplicate
recursive Globals tree is built. `references(node, field?)` and iterative
`trace(node)` return equality provenance with `direction: unproven`,
`ownership: unknown` and `provesOwnership: false`; they are not classifiers.
Cycles terminate with visited-node/token tracking. Duplicate/ref/conflicting
paths remain evidence, never a selected ownership result.

`inspectGlobalsRelations()` on the research controller/Worker is Globals-only
and returns **sanitized aggregate reports only**, no resource buffers, UUIDs,
character names or node-level graphs. The relation module loads lazily only for
this operation. Existing parsing, matching, workbench and decode operations are
unchanged. No product integration or automatic invocation exists.

New independent relation bounds (lower overrides only):

| Bound | Maximum | Basis |
|---|---:|---|
| Reference occurrences | 65,536 | margin over 40,430; no pairwise adjacency matrix |
| Distinct UUIDs | 32,768 | margin over 20,444 |
| Candidates | 16,384 | existing candidate ceiling retained |
| Additional index accounting | 16 MiB | typed arrays plus explicit key/schema/query reservations; observed ~8.5 MiB |
| Schema text | 512 KiB | observed 7,801 bytes after privacy redaction |
| Redacted schema paths / fields / report groups | 2,048 / 512 / 2,048 | observed 136 paths; explicit finite metadata bounds |
| Aggregate relation work | 2,000,000 steps | observed 1,249,059; shared across build, summary and queries |
| Per-trace UUID fanout | 1,024 | observed maximum 822; aggregate census remains linear |
| Per-trace nodes / edges / depth | 4,096 / 8,192 / 64 | bounded iterative evidence exploration |
| Report/query output | 2 MiB | incremental query/schema checks plus exact final size validation |

Only lower positive safe-integer overrides are accepted; accessor limits are
rejected without executing getters. The same relation work counter, deadline and
cancellation signal cover index construction and later query phases. UUID groups
are aggregated once per probe, not expanded into all record pairs. Oversized or
incomplete traces reject rather than returning partial authoritative graphs.

All existing structural, identity, codec and decoded-byte caps remain unchanged:
400,000 nodes, 655,360 attributes, 32 MiB structural indexes, 8 MiB names, 4,096
attributes/node, 12M structural steps, 16,384 identity candidates, 2M aggregate
identity steps, 8 MiB identity output, depth 64 and cumulative 30-second active
Worker deadline. Relationship work has its own explicitly documented counter;
this does not reset or multiply the existing extraction/matching budget.

## Sanitized real-save performance observation

One local measurement (not a performance guarantee):

- outer archive read/decompression: 11,064 ms;
- internal section decoding: 982 ms;
- structural validation/indexing: 1,476 ms;
- relation index construction: 1,304 ms;
- aggregate reference traversal/probes: 181 ms;
- total active Worker time including manifest: 15,075 ms;
- charged expansion: 22,782,053 bytes;
- structural typed index: 11,971,208 bytes;
- additional relation typed arrays: 5,442,656 bytes;
- relation accounting including keys/metadata/query reservations: 8,910,989 bytes.

No whole-process or peak-memory measurement is claimed. No timeout/cancellation,
limit failure, network/storage effect or source fingerprint/stat change occurred
in the final run. Payloads and private identities stayed in Worker memory.
An exploratory metadata census initially reached its separate report-schema cap;
unrelated schema paths were then grouped/redacted without changing parser limits.
That diagnostic stop was not bypassed by relaxing archive/resource protections.

## Verification and next gate

Permanent fabricated fixtures cover explicit and nested co-references, multiple
items, holder/party-shaped graphs, duplicates, broken/conflicting/world/cache/
historical cases, cycles, malformed/zero/embedded UUIDs, exact UUID strings,
fanout/work/byte/count/output limits with boundary cases, deadlines/cancellation,
shared build/query budgets, input preservation, error serialization/recovery and
no ownership inference. Native Chrome runs use a fresh disposable profile with
loopback-only synthetic fixtures and blocked storage/backend access.

Public inventory remains 42 byte-identical files; research/tests/docs/scripts
remain excluded. No private save data, IDs, names, path or fingerprint is committed.
No backend, Supabase, auth, Story/progress/ownership persistence, transport, Guide,
Party Optimizer, PWA or production change is made. All work stays uncommitted for
Work review.

**Owned Gear Import Preview remains blocked.** Next step: review the structural
findings and controlled-pair protocol, then design the smallest bounded
serialization/handle relation adapter supported by independent evidence. Do not
promote plausible profile/status/template associations to ownership.

### Final local verification

- New focused relation tests: **54/54**.
- Complete research suite: **566/566** (existing shared identity-budget tests retained).
- Complete repository suite: **5,391/5,391**, zero failures.
- Packaging: **15/15**; all **42/42** HEAD/source/dist files byte-identical.
- Fresh disposable native Chrome/Worker checks: **23/23**, zero runtime errors or unexpected requests.
- `git diff --check`: clean. Parser/resource/codecs/identity/workbench remain byte-identical to HEAD.
- No commit, push, PR, deployment, product/backend/storage or ownership action.
