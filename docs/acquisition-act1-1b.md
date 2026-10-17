# Act 1 acquisition expansion — Checkpoint 1B

> Historical checkpoint record. The approved Full Details coordinate checkpoint now supersedes the intentional null-coordinate statements below with reviewed navigation references or explicit exceptions; see [coordinate backfill](acquisition-coordinate-backfill.md). Original route facts and identities are retained. Four legacy corpse points now use schema 2’s `corpse` role.

Approved develop checkpoint: `ff140dc1535bb5bed5ba38af047b9826225ed98e`. Checkpoint 1A data review and develop-preview QA passed before this expansion. This adds only the ten approved 1B identities and twelve routes to the existing twenty-entry dataset. Schema stays **1**; dataset version becomes **1.2.0-act1.1b**. Total: **30 entries, 31 bindings, 36 routes**. The original twenty entries, bindings, routes and facts remain unchanged.

## Review provenance

BG3 Wiki canonical item pages and relevant actor, location, quest and component pages were read on **2026-10-13**. Their displayed permanent-link revision IDs are preserved in the canonical route sources below. All **32 selected historical `oldid` retrieval attempts** were inaccessible: seventeen in the first five-item review and fifteen in the second. Additional current-page supplements, including the forge location, were inspected where relevant. **No pinned historical page body was independently retrieved or verified.** The permanent references identify the observed revision pins; they do not claim historical-snapshot verification. These are concise paraphrases, not copied Wiki passages.

The canonical JSON remains the sole runtime fact source. The existing validating deterministic builder generates `assets/acquisition-pilot.js`; schema, resolver and renderer behavior remain unchanged. There is no runtime scraping or additional network dependency.

## Stable identity manifest

Each UUID was assigned once for this checkpoint and is an immutable enrichment, binding or route identity. IDs do not derive from row order or presentation. Every catalogue binding is exactly `ACT 1`, uses the complete existing `gameIds[]`, preserves its compatibility progress key, and records the decoded canonical item Wiki identity. No fallback binding is added.

| Item / decoded Wiki identity | Entry UUID | Binding UUID | Route UUID / type |
| --- | --- | --- | --- |
| Caustic Band | `ee08eb7f-1ae2-4aed-b70d-24fffa537ceb` | `d3f2236d-258a-4606-b041-9b16f3064aa8` | `6c4647e7-5f8f-4b6b-a117-7f908d8d6a03` / `purchase` |
| Psychic Spark | `406f25ce-9de6-4fdc-935b-f9ae4cd3995d` | `c943c12c-30f1-49e0-8263-efe14c49c00e` | `68cf23e8-db35-4e5a-a4bc-da20a2b2ceef` / `purchase` |
| Knife of the Undermountain King | `3d4afe37-1784-443b-ba20-d4905b73982a` | `48958ef2-ec45-4ec1-b881-59c82b3df1a4` | `175739d0-53f0-450e-981e-33f2024fc3f3` / `purchase` |
| Adamantine Shield | `4bf6dd97-9791-4b26-904a-025fa34a7b1a` | `7d4b36ee-cdf5-41fe-bf18-72f7f0cfde19` | `a7b4d953-988a-4817-9a9b-29da40eb6542` / `craft` |
| Sussur Greatsword | `b16f635f-b127-4f73-adc6-4a5a85e8214c` | `4a8aeded-57f0-463d-b139-015bed58a908` | `d3564134-7cd4-4743-8bfb-d789b5f9d4b7` / `craft` |
| Mourning Frost | `052324d4-48c3-4400-b335-b4dcfd9c6689` | `9f12cc7c-33a0-40bb-ae18-c864b6dc10f6` | `93a8ed94-4689-4f22-8e8a-3173bdd4a252` / `combine` |
| Vision of the Absolute | `11709aeb-8258-40b7-82ec-55b125e3bb6f` | `0d4cf2b5-13fd-4654-865d-d4c56b2de635` | `84a58698-c4b7-4131-9c6f-c4887d605433` / `combine` |
| Grymskull Helm | `4a15d374-1ce9-469c-84a7-98d69629ae62` | `e7f67b56-231b-4018-a334-d2b567044924` | `ea7fdb0f-b8dc-4d0d-8fad-3a3924da3e43` / `actor_loot` |
| Poisoner's Robe | `70688392-db9e-42d2-96b1-5a8a0396051d` | `3ca9a977-e308-42e9-8271-e62283f75ba0` | `4846e4a3-267b-4e25-a62b-cc3f47ed3713` / `actor_loot`<br>`32fb0efc-2544-4476-b1e8-6d6450879a22` / `actor_loot` |
| Light of Creation | `309774c4-cc6f-4b2e-9d64-a61f63a4b22e` | `3c7e7f4f-7ea1-4448-aa64-032a79e64e7d` | `3a91e94e-b951-404b-bd11-553ac3eb35bf` / `drop`<br>`c501e0ea-f869-4dd9-aa75-979ef6d25d50` / `disarm` |

| Exact Act | Exact compatibility progress key | Complete game IDs | Decoded Wiki identity |
| --- | --- | --- | --- |
| `ACT 1` | `act 1\|caustic band` | `MAG_Acid_AcidDamageOnWeaponAttack_Ring` | Caustic Band |
| `ACT 1` | `act 1\|psychic spark` | `UNI_UND_SocietyOfBrilliance_MagicMissileNecklace` + `UND_SocietyOfBrilliance_MagicMissileNecklace` | Psychic Spark |
| `ACT 1` | `act 1\|knife of the undermountain king` | `MAG_Duergar_Sword_KingsKnife` | Knife of the Undermountain King |
| `ACT 1` | `act 1\|adamantine shield` | `WPN_HUM_Shield_Adamantine_A` + `MAG_MeleeDebuff_AttackDebuff1_OnDamage_Shield` | Adamantine Shield |
| `ACT 1` | `act 1\|sussur greatsword` | `QUEST_FOR_SussurGreatsword` + `FOR_IncompleteMasterwork_SussurGreatsword` | Sussur Greatsword |
| `ACT 1` | `act 1\|mourning frost` | `MAG_Cold_IncreaseColdDamageOnCast_Staff` | Mourning Frost |
| `ACT 1` | `act 1\|vision of the absolute` | `FOR_Spear_TrueSoul` + `FOR_TrueSoul_Spear` | Vision of the Absolute |
| `ACT 1` | `act 1\|grymskull helm` | `UNI_UND_KC_AdamantineGolem_Helmet` + `MAG_MeleeDebuff_AttackDebuff1_OnDamage_Helmet` | Grymskull Helm |
| `ACT 1` | `act 1\|poisoner's robe` | `UNI_FOR_SpiderQueen_Robe` + `FOR_SpiderQueen_Robe` | Poisoner's Robe |
| `ACT 1` | `act 1\|light of creation` | `WPN_Tower_AutomatonHalberd` | Light of Creation |

## Evidence and conservative route facts

All twelve new routes have `review.state: reviewed`, `validity: current` and review date **2026-10-13**. Entry coverage is **6 reviewed / 4 partial**: Caustic Band, Psychic Spark, Mourning Frost and Poisoner's Robe remain partial. Coverage reflects this bounded acquisition review and does not certify availability in a particular save. Eight items use `acts: [1]`; the two inventory-assembly routes retain unknown/null route Acts.

### Caustic Band

Purchase from Derryth Bonecloak in the Myconid Colony, Ebonlake Grotto. The condition is ordinary Act 1 trading; she can trade immediately and rescuing Baelen is not required. **Coordinates null**, as approved. **Coverage partial:** later-Act stock is unverified, so no later-Act route is asserted.

- [BG3 Wiki revision 416928](https://bg3.wiki/w/index.php?title=Caustic_Band&oldid=416928) — Where to find.
- [BG3 Wiki revision 433882](https://bg3.wiki/w/index.php?title=Derryth_Bonecloak&oldid=433882) — Involvement / Act One; Store / Notable items sold.
- [BG3 Wiki revision 418060](https://bg3.wiki/w/index.php?title=Ebonlake_Grotto&oldid=418060) — Traders and scientists; Loot.

### Psychic Spark

Purchase from Blurg in the Myconid Colony, Ebonlake Grotto. Actor point **(111, -89)**, space **Ebonlake Grotto**, subject **actor**, confirmed by both item and actor pages. Complete the introductory dialogue to open trading; the Omeluum investigation quest is not required. **Coverage partial:** later-Act stock remains unverified.

- [BG3 Wiki revision 422030](https://bg3.wiki/w/index.php?title=Psychic_Spark&oldid=422030) — Where to find.
- [BG3 Wiki revision 434059](https://bg3.wiki/w/index.php?title=Blurg&oldid=434059) — Involvement / Act One; Shop / Notable items sold.
- [BG3 Wiki revision 418060](https://bg3.wiki/w/index.php?title=Ebonlake_Grotto&oldid=418060) — Traders and scientists.

### Knife of the Undermountain King

Purchase from A'jak'nir Jeera, whose canonical actor Wiki identity is `Jeera`, in the trading area southeast of the Crèche Y'llek waypoint. The only encoded condition is trading with Jeera. **Coordinates null:** item point **(1380, -798)** and actor point **(1387, -821)** disagree; the location page also gives a Trade Post point **(1392, -776)**, which is not substituted for the actor. **Coverage reviewed.** No quest cutoff or guaranteed loot alternative is inferred.

- [BG3 Wiki revision 420147](https://bg3.wiki/w/index.php?title=Knife_of_the_Undermountain_King&oldid=420147) — Where to find.
- [BG3 Wiki revision 416522](https://bg3.wiki/w/index.php?title=Jeera&oldid=416522) — Involvement; Shop / Notable items sold.
- [BG3 Wiki revision 417426](https://bg3.wiki/w/index.php?title=Cr%C3%A8che_Y%27llek&oldid=417426) — Main Corridor; Trade Post.

### Adamantine Shield

Craft at the Adamantine Forge in Grymforge. Required recipe: **one Mithral Ore**, **Shield Mould**, and **forge operation**: load ore and mould, lower the platform, release lava, and use the hammer. The mould is reusable; every crafted item consumes one ore. Only **two pieces of Mithral Ore** are available, shared across all six forge outputs. **Coordinates null:** no component, waypoint or broad forge point is represented as a fixed station coordinate. **Coverage reviewed.**

- [BG3 Wiki revision 415819](https://bg3.wiki/w/index.php?title=Adamantine_Shield&oldid=415819) — Where to find.
- [BG3 Wiki revision 415809](https://bg3.wiki/w/index.php?title=Adamantine_Forge_%28location%29&oldid=415809) — Overview; Using the Adamantine Forge; Shields.
- [BG3 Wiki revision 433400](https://bg3.wiki/w/index.php?title=Grymforge&oldid=433400) — Abandoned Refuge / Adamantine Forge; Loot / Craftable in the Adamantine Forge.
- [BG3 Wiki revision 421041](https://bg3.wiki/w/index.php?title=Mithral_Ore&oldid=421041) — Lead; Usage.
- [BG3 Wiki revision 423140](https://bg3.wiki/w/index.php?title=Shield_Mould&oldid=423140) — Lead.

### Sussur Greatsword

Craft at the smithy's cellar furnace in Blighted Village. Require **Sussur Tree Bark**, a **plain Greatsword**, and using the furnace. Procedure notes preserve the order: **light the furnace with the bellows, add bark, then add a plain, non-magical Greatsword**. The quest's result is this crafted weapon; there is no duplicate `quest_reward` route or invented journal/blueprint requirement. **Coordinates null; coverage reviewed.** The item page's point **(-477, -378)** and quest furnace point **(-446, -378)** are not used as a fixed crafting point.

- [BG3 Wiki revision 423763](https://bg3.wiki/w/index.php?title=Sussur_Greatsword&oldid=423763) — Where to find; Notes.
- [BG3 Wiki revision 418506](https://bg3.wiki/w/index.php?title=Finish_the_Masterwork_Weapon&oldid=418506) — Walkthrough; Quest rewards.
- [BG3 Wiki revision 433668](https://bg3.wiki/w/index.php?title=Blighted_Village&oldid=433668) — Blacksmith's house.
- [BG3 Wiki revision 423765](https://bg3.wiki/w/index.php?title=Sussur_Tree_Bark&oldid=423765) — Lead; Notes.

### Mourning Frost

Combine **Icy Crystal**, **Icy Helve** and **Icy Metal** in the same character's inventory. Each component and the combining interaction are prerequisites. This is inventory assembly: `actor`, `location`, `sublocation`, `coordinates` and route `acts` remain **null**. The exact catalogue binding still says `ACT 1`; it does not establish an Act restriction or geography for assembly. **Coverage partial:** component acquisition branches are only partially covered. Component origin coordinates are not assembly coordinates.

- [BG3 Wiki revision 421125](https://bg3.wiki/w/index.php?title=Mourning_Frost&oldid=421125) — Where to find; Notes.
- [BG3 Wiki revision 419662](https://bg3.wiki/w/index.php?title=Icy_Crystal&oldid=419662) — Where to find; Notes.
- [BG3 Wiki revision 419663](https://bg3.wiki/w/index.php?title=Icy_Helve&oldid=419663) — Where to find; Notes.
- [BG3 Wiki revision 419664](https://bg3.wiki/w/index.php?title=Icy_Metal&oldid=419664) — Where to find; Notes.

### Vision of the Absolute

Combine **Shaft of a Broken Spear** and **Head of a Broken Spear** in one character's inventory. The two components and combining interaction are prerequisites. Inventory assembly has **null actor, location, sublocation, coordinates and route acts**, while the exact catalogue binding remains `ACT 1`. Origin notes identify Edowin's corpse in the Forest and the Owlbear mother in the Owlbear Nest. They do not require the player to kill both owners. **Coverage reviewed.**

- [BG3 Wiki revision 424690](https://bg3.wiki/w/index.php?title=Vision_of_the_Absolute&oldid=424690) — Where to find; Notes.
- [BG3 Wiki revision 423079](https://bg3.wiki/w/index.php?title=Shaft_of_a_Broken_Spear&oldid=423079) — Where to find; Notes.
- [BG3 Wiki revision 419385](https://bg3.wiki/w/index.php?title=Head_of_a_Broken_Spear&oldid=419385) — Where to find; Notes.
- [BG3 Wiki revision 425476](https://bg3.wiki/w/index.php?title=Edowin&oldid=425476) — Involvement / Act One; Loot.
- [BG3 Wiki revision 431001](https://bg3.wiki/w/index.php?title=Owlbear_Nest&oldid=431001) — Overview / Obtaining the Owlbear Cub as a camp follower.

### Grymskull Helm

Carried `actor_loot` on Grym in the Adamantine Forge arena; canonical location Wiki identity `Adamantine Forge (location)`. **Coordinates null; conditions null; coverage reviewed.** The helm is carried loot and is explicitly excluded from the forge's crafting outputs. No ore, mould or crafting prerequisite is attached to this route.

- [BG3 Wiki revision 419203](https://bg3.wiki/w/index.php?title=Grymskull_Helm&oldid=419203) — Where to find.
- [BG3 Wiki revision 415634](https://bg3.wiki/w/index.php?title=Grym&oldid=415634) — Overview; Combat / Loot.
- [BG3 Wiki revision 415809](https://bg3.wiki/w/index.php?title=Adamantine_Forge_%28location%29&oldid=415809) — Overview.

### Poisoner's Robe

Two distinct `actor_loot` routes on the Phase Spider Matriarch. **Route A:** the ordinary lair route in **Whispering Depths**, sublocation **Matriarch's lair**, coordinates and conditions null. **Route B:** recover and loot her already-fallen corpse in the **Underdark**, after a **central-hole fall**. Corpse point **(140, +151)**, space **Underdark**, subject **actor** because schema 1 has no corpse enum. This is not the party's separate landing point **(140, -150)**; the map contexts and coordinate subjects are not interchangeable.

The central hole is not labelled Chasm; side pits labelled Chasm are not equivalent recoverable-loot destinations. **Tactician and Honour block the living-knock method** because the living Matriarch teleports back. This is a method-specific note, not a universal difficulty exclusion on all existing-corpse recovery: other corpse-transfer methods and custom difficulty settings remain unreviewed. **Coverage partial.**

- [BG3 Wiki revision 421868](https://bg3.wiki/w/index.php?title=Poisoner%27s_Robe&oldid=421868) — Where to find.
- [BG3 Wiki revision 414738](https://bg3.wiki/w/index.php?title=Phase_Spider_Matriarch&oldid=414738) — Combat / Encounter details; Combat / Loot.
- [BG3 Wiki revision 370813](https://bg3.wiki/w/index.php?title=Whispering_Depths&oldid=370813) — Matriarch's den; Loot.

### Light of Creation

Two distinct routes involving Bernard on the Arcane Tower **roof (fourth floor)**. **Route A, `drop`:** defeat Bernard in combat and loot the weapon. **Route B, `disarm`:** successfully use **Command: Drop**, then collect the dropped weapon. The ability allows a Wisdom saving throw, so disarming is not guaranteed. Both routes omit coordinates and retain `acts: [1]`. **Coverage reviewed.** No dialogue-gift route is added.

- [BG3 Wiki revision 420481](https://bg3.wiki/w/index.php?title=Light_of_Creation&oldid=420481) — Where to find.
- [BG3 Wiki revision 431380](https://bg3.wiki/w/index.php?title=Arcane_Tower&oldid=431380) — The fourth floor (roof); Loot / Fourth floor (roof).
- [BG3 Wiki revision 432891](https://bg3.wiki/w/index.php?title=Bernard&oldid=432891) — Combat / Notable loot.
- [BG3 Wiki revision 278984](https://bg3.wiki/w/index.php?title=Command%3A_Drop&oldid=278984) — Description; Properties.

## Coordinates, unknowns and deferred work

- Two routes publish coordinates: Psychic Spark **(111, -89) / Ebonlake Grotto / actor**, and the fallen-corpse Poisoner's Robe route **(140, +151) / Underdark / actor**. The other ten new routes keep coordinates null. No component, party-landing, waypoint or contradictory actor point is substituted.
- Mourning Frost and Vision of the Absolute keep route Act, actor and assembly geography null. Their Act 1 catalogue bindings are distinct from an unknown restriction on when or where assembly can occur.
- Caustic Band and Psychic Spark preserve unknown later-Act stock. Mourning Frost preserves partial component acquisition coverage. Poisoner's Robe preserves partial fall-method/difficulty coverage; the Tactician/Honour note applies specifically to knocking the living Matriarch into holes.
- Jeera's conflicting published points remain omitted and are recorded above. Adamantine and Sussur crafting locations remain descriptive, without guessed station precision.
- No new universal quest cutoff, guaranteed trader loot, duplicate quest reward, forged Grymskull Helm, dual-owner kill prerequisite or Bernard dialogue gift is inferred.
- Checkpoint 1C, later-Act expansion, additional acquisition methods and save-ID namespace adaptation remain outside this checkpoint.

## Verification boundaries

The original twenty canonical entries are preserved against the approved `ff140dc1535bb5bed5ba38af047b9826225ed98e` checkpoint. The focused regressions cover exact binding resolution, full/reordered IDs and fail-closed mismatches, route types and counts, coordinates and intentional nulls, recipe order, route-specific conditions, separate map contexts and existing Full-only hydration. Existing resolver and renderer paths provide this behavior; the expansion adds facts rather than application logic. Local verification for this checkpoint: **72/72 new regressions**, **481/481 existing acquisition regressions**, and **1,417/1,417 full-suite tests** pass. The protected-file and generated executable-logic audit is unchanged. Builder determinism is reported with the implementation review.

Catalogue invariants remain **556 raw source rows / 555 unique items / 555 distinct progress keys**. Acts 1/2/3: Vendor **63 / 50 / 67**, Loot **131 / 94 / 125**, Quest **25 / 0 / 0**. Both Graceful Cloth identities remain distinct; Battlemage retains source row **54**. Existing v5/v6 behavior and compatibility progress keys are preserved.

This checkpoint does not change schema, resolver, acquisition UI logic, application HTML, spoiler gating, search/filter/sort, classifiers, Story/progress/sync/auth, Supabase/database/storage, PWA/service worker, versioned transport or DEV PREVIEW gating. Generated executable bundle logic is unchanged. Local regression work uses mocks; no live Supabase/database or existing user storage is accessed.
