# Controlled current-state evidence: partial promotion

This checkpoint adds only the relations supported by controlled differentials.
It does not establish general ownership, named current equipment, quantity,
Found state or automatic party/allocation. All existing parser/resource limits,
aggregate work counter, cancellation and deadline remain in force.

## Evidence boundary

Five controlled inputs are compared as A/B (dismissal), A/C (ring transfer),
A/D (weapon transfer), A/E (body unequip). Inputs, extracted payloads, entity
keys and fingerprints remain private and in memory. Only Globals, its exact
root NewAge ScratchBuffer and the already authorized scoped ItemFactory were
examined. No LevelCache, StorySave or other payload is needed.

The supported current-state graph is restricted to descriptor 63. Descriptor
123 retains its previous output and work-count semantics. Unknown/missing
capabilities, ambiguous identities, multiple party roots and multiplayer-like
multiple custom anchors cannot create a current-state claim.

## Party

An exact character Origin, Character/Stats owner maps, and a unique reviewed
Custom/Avatar/Player anchor are required. The serialized MemberComponent's
EntityId reference at +16 must reach the single entity carrying the current
CompositionComponent and ViewComponent. RecruitedBy must reach the same custom
anchor. Active requires Player AND Member to that root. Benched requires camp
Presence, the same recruit relation, and neither Player nor Member.

In A/B the dismissed companion loses current Member/Player and gains camp
Presence; the remaining current-root edges persist. Candidate count, Player
alone, origin identity, order and history are not party evidence. A generic
Player/follower-like record or camp NPC without the reviewed identity/recruit
chain stays Unknown. Summons Container is not interpreted as a summoned role.
Duplicate named origins withdraw their identity and current-state claims.

Proved camp candidates may be included for explicit selection. They have only
identity/party evidence: their level, classes and observed abilities stay
Unknown. This avoids extending the old current-build reader to camp records.
The planner party remains user-selected; detection does not create drafts.

## Body occupancy: Empty versus Unknown

The explicit chain is character Owner -> inventory vector -> inventory Data ->
Type (Main=0 / Equipment=1), corroborated by inventory IsOwned -> holder. Primary
must be the separately typed Main inventory and exactly one Equipment inventory
must be identified. Item Member points to a complete MemberData inventory/slot
row. Current Wielding must agree with that equipment inventory's holder.

In A/E the same live entity moves Equipment/body slot 1 -> ordinary Main
inventory and loses current Wielding, while history/Wielded remains. Another
ordinary inventory item has slot 1 throughout: slot number alone is therefore
insufficient. Only a positively identified Equipment container with complete,
consistent current membership can prove an empty body slot. Missing capability,
duplicate occupant or conflicting edge yields Unknown; malformed references
reject. All work shares the original decoder budget.

The existing session BuildSnapshot receives either body `empty` or
`occupied-unknown`. No catalogue key or raw instance ID crosses the Worker.
Other slots remain Unknown. Manual equipment overrides survive reread/clear;
clearing, replacement and stricter modes remove detected current evidence.
Equipment details remain Full-only. Existing Act identity projection is reused.

## Unresolved named equipment / catalogue bridge

Live entity GUID references, not positions or shared templates, provide the
candidate continuity key. Exact NewAge Template and scoped Creator.Entity /
TemplateID relations agree throughout the inspected item population. The
CurrentTemplate/Stats catalogue hypothesis nevertheless contradicts the supplied
ring/weapon direction: the named ring and mace map from Shadowheart to Astarion,
while the reverse-moving instances map to Ring of Twilight and Knife of the
Undermountain King. This discrepancy is unresolved and is NOT a product rule.
No named current gear or transfer recommendation is promoted from it.

The body item's exact Stats is shared by both distinct Graceful Cloth catalogue
identities. No variant is chosen. CurrentTemplate is never used as a unique
physical-instance key, and Creator/Item rows are never joined positionally.
Ownership remains unknown; body occupancy is not an ownership classifier.

## Public references and verification

Engine declarations are structural cross-checks, not proof of serialized offsets:

- [Party components](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Components/Party.h)
- [Inventory components](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Components/Inventory.h)
- [Slot enum](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Enumerations/Stats.inl)
- [Inventory-type enum](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Enumerations/ECS.inl)

Independent fabricated fixtures cover active/bench, stale relations, follower-like
records, ambiguous roots, duplicate identities, current/history/inventory,
Empty/Unknown, wrong holders, invalid references, input preservation, aggregate
work limits and cancellation. Integration checks cover the actual generated
reader, closed DTO boundary, legacy session upgrade, manual overrides and
unchanged optimizer results. Disposable browser QA covers real Workers,
320/390/768/1280, focus/keyboard, clear/replacement, stricter spoilers and tracker
node/progress isolation. The same 51 public paths remain; only the planner UI,
core and two generated planner Workers change. No backend or deployment
configuration changes are included.

Controlled rerun: all five generated-reader runs decoded successfully within
unchanged limits (approximately 12–15 seconds each, at most 353,850 identity
steps). A/C/D/E have four proved current members, B has three; the dismissed
companion is explicitly non-active/camp-present. The controlled body's occupancy
is detected in A–D and Empty in E. Previously supported Player build fields are
unchanged in all five inputs. Source bytes/stat remain identical and no private
identifier is exported. Eighteen separate legacy synthetic result/error/step-count
comparisons also remain exact.

Local verification: 42 new permanent tests; focused integration/profile/model/
engine group 183/183; complete repository suite 6,439/6,439; packaging 15/15.
New isolated current-state Chrome scenarios: 106/106 across all four widths,
zero runtime errors and backend/write requests. Existing shared planner browser
scenarios also passed before the new scenarios. Generated bundles are exact and
deterministic; all 51 source/dist byte comparisons pass, with the other 47
public files byte-identical to baseline. No deployment configuration changed.
