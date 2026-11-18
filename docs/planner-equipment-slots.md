# Reviewed current-equipment slot extension

Baseline: `f693fcb3cb2c92c7b6f7282aaaeea88ec917d38c` on develop.
This extends the current-state proof in [planner-current-state.md](planner-current-state.md), not ownership, gameplay scoring, or profile support.

## Evidence and promotion boundary

Only the already authorized controlled A–E Globals / NewAge surfaces were inspected. Payloads stayed in bounded Worker memory. Before/after source fingerprints and filesystem metadata agreed. No save bytes, private entity/template identifiers, paths, labels or payload extracts are included here.

Every promotion requires the same complete relation: exact character owner → exactly one Equipment inventory in its validated inventory vector → Member/MemberData slot → current Wielding to the same holder → live EntityId → one scoped Creator → matching current template → one scoped ItemFactory Stats → one unique existing catalogue key. Main/inventory-only membership, stale/history, positional pairing and names never substitute for this chain. Bench identities do not receive equipment/build evidence.

The public [Script Extender ItemSlot enum](https://github.com/Norbyte/bg3se/blob/e2e640c9fa51448847bf8cf7907c90674299c2ac/BG3Extender/GameDefinitions/Enumerations/Stats.inl) corroborates the numbers; it is not the sole evidence. Current Member/Wielding relations and independent item families in the controlled saves provide runtime corroboration. Across the five saves there are 19 active-character observations per stable accessory/ranged-main family, spanning four character identities. Offhand has 18 observations; the controlled weapon-transfer differential removes its prior live offhand item into Main inventory without a current Wielding edge. Serialized ring 12 remains stable while the independent ring-7 transfer occurs.

| Presentation | Serialized MemberData slot | Promoted state | Empty semantics |
| --- | ---: | --- | --- |
| Helmet | 0 | Exact item or occupied-unmapped | Missing remains Unknown |
| Body | 1 | Existing exact/occupied-unmapped | Existing controlled body-empty proof only |
| Cloak | 2 | Exact item or occupied-unmapped | Unknown |
| Melee main | 3 | Existing exact/occupied-unmapped, plus six-entry type compatibility | Unknown |
| Offhand / shield | 4 | Exact weapon/shield or occupied-unmapped | Unknown |
| Ranged main | 5 | Exact ranged item or occupied-unmapped | Unknown |
| Ranged offhand | 6 | **Not promoted** | Unknown |
| Ring A | 7 | Existing ring-family proof | Unknown |
| Boots | 9 | Exact item or occupied-unmapped | Unknown |
| Gloves | 10 | Exact item or occupied-unmapped | Unknown |
| Amulet | 11 | Exact item or occupied-unmapped | Unknown |
| Ring B | 12 | Independently serialized ring-family proof | Unknown |

Both shields and a one-handed weapon occupy slot 4 through the same current graph. The exact catalogue definition distinguishes their item type; there is no invented separate shield slot. No current slot-6 occupant exists in this sample, so an enum-looking 6, a hand-crossbow type, or missing offhand cannot prove ranged-offhand support, dual wielding, or Empty.

A uniquely resolved two-handed ranged weapon is current in slot 5. This does not establish whether the absent offhand is empty, unavailable, or expressed elsewhere. Main/offhand grip and active weapon-set semantics remain unknown. Ring A/B do not mean left/right. Missing evidence, multiple current occupants, incomplete graphs and ambiguous identities are never promoted to Empty.

## Narrow presentation type completion

Six exact existing catalogue identities have unmodeled mechanics and a null mechanics slot. `current-equipment-types.json` adds only their reviewed public type for current-equipment presentation:

- [Sword of Life Stealing](https://bg3.wiki/wiki/Sword_of_Life_Stealing): Shortsword.
- [Belm](https://bg3.wiki/wiki/Belm): Scimitar.
- [Dwarven Thrower](https://bg3.wiki/wiki/Dwarven_Thrower): Warhammer (versatile; no inferred current grip).
- [Hellfire Hand Crossbow](https://bg3.wiki/wiki/Hellfire_Hand_Crossbow) and [Firestoker](https://bg3.wiki/wiki/Firestoker): Hand Crossbow.
- [Hellfire Engine Crossbow](https://bg3.wiki/wiki/Hellfire_Engine_Crossbow): Heavy Crossbow.

Build validation checks these exact keys/types against the canonical catalogue fixture. Existing complete strong-ID sets remain unchanged. This map cannot establish identity: the exact instance bridge must succeed first. It does not change any mechanics support status, effects, scores, ownership, copies or optimizer candidate eligibility. In particular, placeholder false flags on unmodeled weapons are not treated as grip facts. Unlisted null-category weapons stay occupied-unmapped.

## Product and safeguards

Existing twelve current-equipment rows are reused; new gear appears only in Full. Minimal/Light and stricter Act projection invalidate save evidence through the existing pipeline. Ring labels now say A/B. The panel explicitly explains unknown offhand/grip/active-set semantics.

Current remains separate from Proposed. Detection creates no locks, reservations, Found state, copies or new source-pool entries. Joint allocation still enforces the existing one-resource policy across explicit planner party members, and may recommend moving an item. Manual override removal reveals retained detection; Clear and context invalidation retain their existing behavior. Shared deadline/cancellation/step budget, structural limits and both existing profile validators are unchanged. No multiplayer expansion occurs.

Graceful Cloth variants sharing one Stats identity remain ambiguous. Distinct live instances sharing one definition remain distinct current-holder observations, without establishing owned quantity.

## Verification

Permanent tests use independent public tokens/keys and fabricated graphs, not private save bytes. They cover all promoted families, shields vs weapons, inventory/history exclusion, duplicates, incompatible categories, exact bridge failure, unknown ranged offhand, two-handed false-empty prevention, manual override removal, shared budgets, profile isolation, generated reader/kernel parity and joint allocation. Existing lifecycle/Story/spoiler/identity tests remain active.

The native browser script sends every independent slot fixture through the actual generated single-use reader Worker at 320/390/768/1280. It checks exact names, twelve distinct rows, Unknown ranged offhand, keyboard focus, overflow, no persistence/progress changes, stricter-mode DOM/accessibility removal and retained Current/Proposed behavior. Representative Full screenshots cover helmet, shield and ranged-main presentation at 390/1280. Shared cancellation, Enter/Space, context invalidation and Tracker node-preservation checks remain active.

Packaging remains the explicit 51-file public artifact; these research/docs/tests/config modules are not standalone deployed paths. Only the four existing planner runtime assets change.
