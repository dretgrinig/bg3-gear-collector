# Controlled current party and equipment evidence

Only proved current-state relations enter the existing session BuildSnapshot.
This is not an ownership, quantity, Found or Story-progress classifier. All
existing structural/resource limits, the aggregate work counter, cancellation
and the reader deadline remain in force. No backend or deployment configuration
changes are included.

## Scope and corrected controlled record

Five controlled inputs compare A/B dismissal, A/C ring transfer, A/D weapon
transfer, A/E body unequip. Private payloads, instance keys and fingerprints stay
in memory. Only Globals, its exact root NewAge ScratchBuffer and the authorized
scoped ItemFactory are inspected. No LevelCache, StorySave or unrelated payload
is needed. The user explicitly clarified that earlier item names/directions may
be mislabeled notes: structural differentials are primary evidence.

The exact observed transitions are:

| Pair | Catalogue identity | Current transition |
| --- | --- | --- |
| A/B | Dismissed companion | current party -> camp / not active |
| A/C | Ring of Twilight | Astarion ring 7 -> Shadowheart ring 7 |
| A/C | The Whispering Promise | Shadowheart ring 7 -> Astarion ring 7 |
| A/D | Knife of the Undermountain King | Astarion melee main hand 3 -> Shadowheart melee main hand 3 |
| A/D | The Blood of Lathander | Shadowheart melee main hand 3 -> Astarion melee main hand 3 |
| A/D | Sword of Life Stealing | Astarion slot 4 -> ordinary Main inventory, no current Wielding |
| A/E | Shared Graceful Cloth definition | Astarion body 1 -> ordinary Main inventory, no current Wielding |

Each changed physical instance retains its exact live EntityId key. Both sides
of automatic swaps are retained; historical components and still-present carried
items do not substitute for current Wielding. Slot 4 displacement is documented,
not generalized into offhand/shield/two-handed detection. Ring numbers do not
claim left/right semantics.

## Party proof

Current-state interpretation is restricted to descriptor 63. Descriptor 123
retains its previous results/work-count semantics. Unknown capabilities,
multiple roots/custom anchors, ambiguous identities and unreviewed layouts
cannot create a claim.

An exact Origin and Character/Stats owner maps identify the candidate. A unique
Custom/Avatar/Player anchor's MemberComponent EntityId reference at +16 must reach
the sole entity carrying current CompositionComponent and ViewComponent. A named
companion additionally requires RecruitedBy to that same anchor. Active requires
Player AND Member to the current root. Camp / non-active requires camp Presence,
the same recruit relation, and neither Player nor Member.

In A/B the dismissed companion loses Member/Player and gains camp Presence;
the remaining active edges persist. A/C/D/E have four current members, B three.
Candidate count, Player alone, origin identity, ordering and history are not
party proof. Generic Player/follower-like records and camp NPCs lacking the
reviewed identity/recruit chain stay Unknown. Summons Container is not a summoned
role discriminator. Duplicate named origins withdraw current-state claims.
Camp candidates expose identity/party only; level/classes/observed abilities
remain Unknown. Detection does not automatically fill planner drafts or claim
camp availability/aliveness.

## Current equipment and true Empty

Character Owner -> its inventory vector -> inventory Data -> explicit Type
(Main=0 / Equipment=1), corroborated by inventory IsOwned -> same holder, identifies
one Equipment inventory separate from the Primary Main inventory. Item Member
must point to a valid MemberData inventory/slot row. Current Wielding must reach
the same character on the same live item entity. Complete, consistent membership
and exact owner maps are required; malformed references reject.

Only body 1, melee main hand 3 and numbered ring slots 7/12 are promoted.
Duplicate occupants, conflicting holders and incomplete evidence stay Unknown.
Only body has the controlled Empty proof. Missing other slots remain Unknown.
In E the body instance survives in Main slot 45 and loses Wielding; another Main
item still has slot 1, proving that slot number alone is unsafe. History/Wielded
components survive and are deliberately not used as current state.

## Exact catalogue bridge

NewAge's live entity key joins to scoped Creator.Entity through exact engine
GUID byte normalization. TemplateComponent's bounded UUID string must agree
with Creator.TemplateID; the scoped Item.CurrentTemplate group must contain
exactly one record with a valid Stats token. That exact case-sensitive token must
map to exactly one reviewed catalogue key, with a compatible equipment category.
Creator entities, templates and all inspected item Template strings agree across
the five inputs. Entity references identify physical instances; templates do not.

Scope is exact root Items/ItemFactory/Creators/Creator and
Items/ItemFactory/Items/Item. No name, position, occurrence-count, XP or fuzzy
fallback exists. Duplicate Creators or template groups, wrong field types/lengths,
unknown tokens, mismatching templates, incompatible slots and multi-key aliases
withhold the named item. Stats aliases are exact existing reviewed definition
IDs, not inferred display-name synonyms. No private entity IDs cross the Worker.

The shared Graceful Cloth Stats maps to both Esther and Araj catalogue identities.
It remains occupied-unknown in A and Empty in E, with no variant selected.
Duplicate-template ambiguity is withheld rather than inventing copy allocation.
All other unproved slots and broader save profiles retain Unknown/manual behavior.

## Product and safety

The existing BuildSnapshot stores party provenance and partial equipment entries:
`empty`, `occupied-unknown` or `detected` with an exact catalogue key. No parallel
model, ownership flag, quantity or private ID is added. Manual corrections survive
reread/Clear; source replacement, clearing and stricter spoiler modes invalidate
old detection. The existing Act identity projection is reused. Gear is Full-only.

Recommendation cards annotate current holder/slot versus proposed holder for
items with evidence. Multiple observed uses never imply interchangeable copies.
Existing scoring, source pools, one-copy capacity, reservations and conflict
allocation remain unchanged. No automatic lock or Found/progress write is made.

## Public structural references and verification

Engine declarations corroborate components/enums; serialized offsets are proved
by the controlled graph, not assumed from native-memory layouts:

- [Party](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Components/Party.h)
- [Inventory](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Components/Inventory.h)
- [Slots](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Enumerations/Stats.inl)
- [Inventory types](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Enumerations/ECS.inl)

Independent fabricated tests cover dismissal, stale/follower-like/ambiguous party
records, exact transfers, history/inventory exclusion, Empty/Unknown, duplicate
identities/templates, incorrect holders, malformed references, catalogue ambiguity,
closed DTOs, manual overrides and unchanged scoring/source capacity. Factory work
shares the same decoder counter/deadline/cancellation; no phase resets it.
Disposable native-browser QA uses real Workers, all four widths, keyboard/focus,
clear/replacement, Full/Light/Minimal and tracker/storage/pending isolation.
Research, source, docs, scripts and tests remain excluded from the same 51-file
public package. Only the planner UI, core and two planner Workers change.

## Completed checkpoint evidence

- All five final generated-reader runs decoded within unchanged limits; exact
  party, ring/main-hand identities and body Empty/occupied states matched the
  corrected controlled differentials. Earlier Player build fields stayed exact.
  Each input took approximately 13–15 seconds and at most 669,261 identity steps.
  Source fingerprint/stat remained unchanged; no private IDs were exported.
- Eighteen legacy synthetic comparisons retained exact results/errors/step counts.
- Seventy new permanent tests; all planner tests 474/474.
- Complete repository suite 6,467/6,467; packaging tests 15/15.
- Complete isolated native Chrome QA 641/641 across 320/390/768/1280; no runtime
  errors or backend/write requests. New current-state cases separately passed
  122/122. Actual single-use Workers, keyboard/focus, stricter modes, tracker
  nodes/progress/pending and disposable-storage isolation are covered.
- Deterministic bundles and the same 51 public paths; 51/51 source/output byte
  parity, with 47 public files byte-identical to baseline. Only planner UI/core
  and the two planner Workers differ. No generic LSV parser/codec, structural cap, canonical
  catalogue, auth, transport, PWA or production setting changes.
