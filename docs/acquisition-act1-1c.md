# Act 1 acquisition expansion — Checkpoint 1C

> Historical checkpoint record. The approved Full Details coordinate checkpoint now supersedes the intentional null-coordinate statements below with reviewed navigation references or explicit exceptions; see [coordinate backfill](acquisition-coordinate-backfill.md). Original route facts and identities are retained. Four legacy corpse points now use schema 2’s `corpse` role.

Approved develop baseline: `9d4cc4aa38c4c2aa45b228e7175b3b66b95fa210`. Checkpoint 1B data review and deployed-preview QA passed before this expansion. This adds only the ten requested identities and twenty-two routes. Schema remains **1**; dataset becomes **1.3.0-act1.1c**: **40 entries / 41 bindings / 58 routes**. The original thirty entries retain their objects, order, UUIDs and factual content.

## Review provenance

Canonical BG3 Wiki item pages and relevant actor, location, quest and ability pages were inspected on **2026-10-13**. The route sources preserve the revision IDs observed in those current-page permanent links. **Thirty-six selected historical `oldid` body retrievals were attempted; zero succeeded.** Most were inaccessible; Save Arabella and Bernard returned cache-miss. No historical page body was independently retrieved or verified. Pins identify the observed revision references, not a claim of historical-snapshot verification. Goblin Camp was retrieved successfully through the actor-page link after an initial direct failure. Facts below are paraphrases.

The canonical JSON is the sole runtime fact source. The unchanged validating deterministic builder produces `assets/acquisition-pilot.js`; executable bundle logic stays unchanged. There is no runtime scraping or additional dependency.

## Stable identity manifest

UUIDs were assigned once before implementation. Every new entry has one exact `ACT 1` catalogue binding using its complete existing opaque `gameIds[]`, unchanged compatibility progress key, and decoded Wiki item identity. No weak, name-only or fallback binding was added. Everburn is still catalogue-bound to `ACT 1`; only its route context is `prologue`.

| Item / decoded Wiki identity | Entry UUID | Binding UUID | Route UUID / type |
| --- | --- | --- | --- |
| Fetish of Callarduran Smoothhands | `13e36e99-e54c-43f5-880d-f5a863a18fb6` | `2b495fca-7ee6-4d41-b52e-d9108a751b28` | `a91d0d81-612b-4a43-a70f-490b4a421399` / `actor_loot`<br>`f198ec10-6aa3-4155-a9c2-1134d95fa4ec` / `steal`<br>`18143c17-9c84-4f63-b33a-2c9e3a48ba75` / `purchase`<br>`e0770a8d-6caf-406f-b02f-a21f151bec31` / `drop` |
| Crusher's Ring | `ffb4d4e7-1bfb-4f48-a4d2-f7ca114ae733` | `fe5eb5c6-2ef7-4f3f-8e5f-d4f75cfe901d` | `05b12c2f-380e-4c96-9987-d34484e54549` / `drop`<br>`c7b59b42-f938-4750-a640-b57227d972b5` / `steal` |
| Everburn Blade | `fdab6f28-624c-4d83-b229-661fe6a16c59` | `c38e5635-1352-4763-a99f-c1e9dfe1edb0` | `6dfb04eb-0aa9-491a-acbc-de9472fb0c68` / `drop`<br>`2f2fd3a4-57a7-4a76-8177-2c80737ca98a` / `disarm` |
| Varsh Ko'kuu's Boots | `fd5c61f0-ff07-433b-817c-bf303badffa6` | `4a47e07e-632c-414f-82bb-cc3f8654b2a8` | `f1b5dfdf-ae87-4fc3-a4a7-99c40727e8b2` / `gift`<br>`d285bc4b-ae8e-4844-a925-bab71bc19942` / `actor_loot` |
| Hamarhraft | `7469bbee-d597-4512-ac6c-922465342d59` | `e140cd18-bf8f-4ed5-a0a4-3c9c9b441b96` | `ecbfa6f2-d7ce-4b93-8336-59686fde24ec` / `container`<br>`42a07a88-0293-4f23-9b69-1a6399fa963a` / `world` |
| Ritual Dagger | `706ba397-cf92-4ea4-8a49-90a436076c28` | `5f4ec052-8c5e-4b31-8e3d-89bad5a513b4` | `144e948d-a655-4b94-8b17-c10c45ec0105` / `world`<br>`406b1f43-1e27-46b2-a3b8-69a0c7229c76` / `actor_loot` |
| The Spellsparkler | `ceaf48b5-fc80-4077-ae6b-96240d7bf28d` | `67415fd7-7b89-4919-a638-f95479963171` | `400f612b-cc48-4844-9f84-a3c2a9f097e2` / `quest_reward` |
| Hellrider's Pride | `015f7414-0375-490d-8dca-282e397ebdef` | `85ca800f-f60e-4d21-93b2-500e4efcd299` | `a367f74b-94e1-4b75-8b58-bce08c7a8fa3` / `actor_loot`<br>`7bc7ff25-d716-44c6-b59e-cf1ed7d78fc4` / `steal`<br>`c4e5a02a-db2a-46df-b985-432435025c3b` / `quest_reward`<br>`b84514e9-0235-4bec-9aaa-1cd81f6e8480` / `quest_reward` |
| Komira's Locket | `b9436347-ed6a-45a3-a20a-1c7cf06b8ac6` | `29e24cd5-864a-4147-9868-bd458fe35e5c` | `f12a5dbe-cc9f-4df2-b004-575e3725ed7e` / `quest_reward` |
| Guiding Light | `5ada1f1e-ddfb-4190-96ef-5ef23e17a572` | `563845bc-6aa0-4dfd-8faa-098e4db19f05` | `373bc9c9-92b3-4c61-a3a9-2f2dd4b84a11` / `gift`<br>`d427d09f-716f-4688-b6c5-64d5b4df1a8e` / `drop` |

| Exact Act | Exact progress key | Complete game IDs | Decoded Wiki identity |
| --- | --- | --- | --- |
| `ACT 1` | `act 1\|fetish of callarduran smoothhands` | `S_UND_CallarduranTrinket` + `UND_DeadInWater_CallarduranTrinket` | Fetish of Callarduran Smoothhands |
| `ACT 1` | `act 1\|crusher's ring` | `Quest_GOB_DrunkGoblin_Ring` + `ARM_DrunkGoblinRing` | Crusher's Ring |
| `ACT 1` | `act 1\|everburn blade` | `MAG_Fire_AlwaysDippedInFire_Greatsword` | Everburn Blade |
| `ACT 1` | `act 1\|varsh ko'kuu's boots` | `UNI_CRE_HatcheryBoots` + `CRE_Hatchery_AcidPoisonImmunity_Boots` | Varsh Ko'kuu's Boots |
| `ACT 1` | `act 1\|hamarhraft` | `MAG_Mobility_ExplosionOnJump_Maul` | Hamarhraft |
| `ACT 1` | `act 1\|ritual dagger` | `WPN_GOB_PainPriest_Dagger` + `GOB_PainPriest_Dagger` | Ritual Dagger |
| `ACT 1` | `act 1\|the spellsparkler` | `MAG_ChargedLightning_Quarterstaff` | The Spellsparkler |
| `ACT 1` | `act 1\|hellrider's pride` | `DEN_HellridersPride` | Hellrider's Pride |
| `ACT 1` | `act 1\|komira's locket` | `UNI_DEN_Arabella_Locket` | Komira's Locket |
| `ACT 1` | `act 1\|guiding light` | `UND_Tower_RingLight` | Guiding Light |

## Evidence and conservative route facts

All twenty-two routes have **current** validity, **reviewed** route state and review date **2026-10-13**. Entry coverage is **six reviewed / four partial**. Coverage describes this bounded source review; it does not guarantee availability in a particular save. Every new route is Act 1 except the two Everburn Prologue routes.

### Fetish of Callarduran Smoothhands

Four separate methods. **Actor loot:** successful corpse inspection / Perception followed by successful Deception lets the party loot the gnome corpses. **Dialogue steal:** inspection followed by Sleight of Hand reaches for the trinket, as an alternative to Deception. Both use **(-610, 408) / Grymforge / actor**, explicitly describing the deep gnome corpse on the disposal shore opposite the berth. **Conditional purchase:** failed acquisition checks can transfer the ring to Brathwen for subsequent trading. **Drop:** defeat and loot Brathwen while he holds the ring. Purchase/drop coordinates are **null**; Brathwen's separate **(-608, 404)** point is not substituted. Deep-gnome introductory Deception OR Persuasion options are notes, not universal prerequisites. The location source additionally mentions stealing the transferred ring from Brathwen; that additional branch has no separately reviewed fifth route in this checkpoint. **Partial:** transfer/dialogue branches are bounded; no guessed check DCs or exhaustive state coverage.

- [BG3 Wiki revision 418432](https://bg3.wiki/w/index.php?title=Fetish_of_Callarduran_Smoothhands&oldid=418432) — Where to find; Notes.
- [BG3 Wiki revision 426666](https://bg3.wiki/w/index.php?title=Brathwen&oldid=426666) — Involvement / Act One.
- [BG3 Wiki revision 433400](https://bg3.wiki/w/index.php?title=Grymforge&oldid=433400) — Brathwen and Viss.

### Crusher's Ring

Two routes only: defeat Crusher and loot his corpse, OR agree to his foot-kissing dialogue and pass **Sleight of Hand DC 10**. The dialogue method excludes **drow, drow half-elf, and characters disguised as either**. Rogue has an advantaged option, not a mandatory class. Goblin Camp / eastern courtyard; **coordinates null** as requested. Ordinary pickpocketing is not a route. **Reviewed.**

- [BG3 Wiki revision 417417](https://bg3.wiki/w/index.php?title=Crusher%27s_Ring&oldid=417417) — Where to find; Notes.
- [BG3 Wiki revision 433223](https://bg3.wiki/w/index.php?title=Crusher&oldid=433223) — Involvement / Act One.
- [BG3 Wiki revision 433423](https://bg3.wiki/w/index.php?title=Goblin_Camp&oldid=433423) — Main area of the camp / Eastern courtyard; Items / Looted.

### Everburn Blade

Defeat/loot Commander Zhalk OR successfully disarm him with **Command: Drop** and collect the blade. Both happen in the Nautiloid helm **before using the transponder and leaving**. Route Acts are **[prologue]**, distinct from the exact **ACT 1** catalogue binding. The spell allows a Wisdom saving throw; no particular companion is required. Canonical actor Wiki identity is **Zhalk**. **Coordinates null; reviewed.**

- [BG3 Wiki revision 418305](https://bg3.wiki/w/index.php?title=Everburn_Blade&oldid=418305) — Where to find; Notes.
- [BG3 Wiki revision 414973](https://bg3.wiki/w/index.php?title=Zhalk&oldid=414973) — Involvement / Prologue; Combat / Loot; Combat / Tactics.
- [BG3 Wiki revision 428850](https://bg3.wiki/w/index.php?title=Nautiloid&oldid=428850) — Overview / Helm; Loot.
- [BG3 Wiki revision 278984](https://bg3.wiki/w/index.php?title=Command%3A_Drop&oldid=278984) — Description; Properties.

### Varsh Ko'kuu's Boots

Two separate routes: **gift** after successful Persuasion, then a protective answer; OR **carried actor loot**, without the gift's dialogue prerequisites. Supported protective answers remain alternatives: raise it as one's own **OR** find a more forgiving crèche **OR** the githyanki-specific ghaik-slayer pledge. Sale/omelette answers are not protective and start combat. Crèche Y'llek / Hatchery cliff overlooking the egg. Canonical actor Wiki identity is **Ko'kuu**, displaying Varsh Ko'kuu. **Coordinates null; partial.** The actor page reports **DC 18**, while the quest page reports **DC 16**; the runtime metadata omits numeric DC. Delivering the egg to Esther is not required for the gift.

- [BG3 Wiki revision 424593](https://bg3.wiki/w/index.php?title=Varsh_Ko%27kuu%27s_Boots&oldid=424593) — Where to find; Related Quest.
- [BG3 Wiki revision 426079](https://bg3.wiki/w/index.php?title=Ko%27kuu&oldid=426079) — Involvement / Act One; Combat / Loot; Notes and references.
- [BG3 Wiki revision 433666](https://bg3.wiki/w/index.php?title=Steal_a_Githyanki_Egg&oldid=433666) — Walkthrough / Acquiring the egg.
- [BG3 Wiki revision 417426](https://bg3.wiki/w/index.php?title=Cr%C3%A8che_Y%27llek&oldid=417426) — Hatchery.

### Hamarhraft

Two state-specific routes in the upstairs inn room adjacent to Benryn's room, Waukeen's Rest. **Container:** intact locked gilded chest at **(-85, 631) / Waukeen's Rest / container**. No lock DC or mandatory key is inferred. **World:** after fire/long rest destroys the chest, collect the surviving loose weapon; **coordinates null** for this state. The weapon does not disappear after resting. Rescuing Florrick or Benryn is not a universal weapon prerequisite. **Reviewed.**

- [BG3 Wiki revision 419287](https://bg3.wiki/w/index.php?title=Hamarhraft&oldid=419287) — Where to find; Notes.
- [BG3 Wiki revision 424793](https://bg3.wiki/w/index.php?title=Waukeen%27s_Rest&oldid=424793) — After the assault; Benryn and Mirileth; Notes.

### Ritual Dagger

Two separate placement routes at Shattered Sanctum / Bloodied Shrine. **World:** table or floor near Abdirak at **(338, -26) / Shattered Sanctum / item**. **Actor loot:** carried by Abdirak when that placement state applies; **coordinates null**. Arrival timing affects placement; the generic arrival trigger remains unspecified. The actor takes the shrine weapons when departing. Departure following the goblin-leader resolution is state context, not a mandatory kill prerequisite. No theft/disarm route or invented kill condition is added. **Partial.** The shrine's broader **(334, -21)** point is not substituted for the item's point.

- [BG3 Wiki revision 422415](https://bg3.wiki/w/index.php?title=Ritual_Dagger&oldid=422415) — Where to find; Notes.
- [BG3 Wiki revision 430717](https://bg3.wiki/w/index.php?title=Abdirak&oldid=430717) — Involvement / Act One.
- [BG3 Wiki revision 430720](https://bg3.wiki/w/index.php?title=Bloodied_Shrine&oldid=430720) — Overview; Loot.
- [BG3 Wiki revision 431013](https://bg3.wiki/w/index.php?title=Shattered_Sanctum&oldid=431013) — Bloodied shrine.

### The Spellsparkler

One **quest_reward** from Counsellor Florrick (canonical Wiki actor **Florrick**) after timely rescue and the conversation outside, **(-63, 600) / Waukeen's Rest / interaction**. Choose exactly **one** of The Spellsparkler, The Joltshooter or The Sparky Points; select The Spellsparkler for this route. The fire timer starts at the inner yard; fast travel, returning to camp or long rest can advance it before rescue. Agreement to the subsequent Duke-rescue request is not required. Rescue-room east/west wording differs between actor/location pages, so no disputed wing is encoded. **Reviewed.**

- [BG3 Wiki revision 424114](https://bg3.wiki/w/index.php?title=The_Spellsparkler&oldid=424114) — Where to find; Notes.
- [BG3 Wiki revision 431924](https://bg3.wiki/w/index.php?title=Florrick&oldid=431924) — Involvement / Act One.
- [BG3 Wiki revision 424793](https://bg3.wiki/w/index.php?title=Waukeen%27s_Rest&oldid=424793) — After the assault; Florrick and the Grand Duke; Loot / Quest rewards; Notes.
- [BG3 Wiki revision 408690](https://bg3.wiki/w/index.php?title=Rescue_the_Grand_Duke&oldid=408690) — Walkthrough / Waukeen's Rest / If Florrick is saved.

### Hellrider's Pride

Four routes remain separate: Zevlor's **carried loot**, **steal**, **Kill Kagha quest reward**, and **Investigate Kagha quest reward**. Shared actor geography: Emerald Grove / Secluded Chamber, **(-53, 67) / Secluded Chamber / actor**. The quests are alternatives, never a mandatory conjunction. Kill Kagha requires returning to an available Zevlor. Investigation requires stopping the ritual and reporting to him; Kagha need not die. **Investigation-only restriction:** killing OR knocking out the goblin leaders before confronting Kagha auto-resolves the quest without Zevlor's reward. The item and Zevlor pages support the Kill Kagha glove reward despite its omission from that quest's reward list. **Reviewed.** Secluded Chamber redirects to **The Hollow**, whose section is retained without a URL fragment. The Hollow entrance **(166, 539)** is not Zevlor's interior-map point.

- [BG3 Wiki revision 419462](https://bg3.wiki/w/index.php?title=Hellrider%27s_Pride&oldid=419462) — Where to find.
- [BG3 Wiki revision 414784](https://bg3.wiki/w/index.php?title=Zevlor&oldid=414784) — Involvement / Act One.
- [BG3 Wiki revision 413130](https://bg3.wiki/w/index.php?title=The_Hollow&oldid=413130) — Secluded Chamber.
- [BG3 Wiki revision 420122](https://bg3.wiki/w/index.php?title=Kill_Kagha&oldid=420122) — Objectives; Walkthrough; Rewards.
- [BG3 Wiki revision 428719](https://bg3.wiki/w/index.php?title=Investigate_Kagha&oldid=428719) — Objectives; Quest rewards; Notes and references, note 4.

### Komira's Locket

One **quest_reward** only: save Arabella and return to her parents, Komira / Locke. Emerald Grove / Sacred Pool / return to parents, **(262, 542) / Sacred Pool / interaction**. Komira's actor page lists the locket as loot without sufficient state detail; that possibility stays unencoded rather than becoming a guessed alternative or duplicate gift. **Partial.**

- [BG3 Wiki revision 425303](https://bg3.wiki/w/index.php?title=Komira%27s_Locket&oldid=425303) — Where to find.
- [BG3 Wiki revision 422647](https://bg3.wiki/w/index.php?title=Save_Arabella&oldid=422647) — Objectives / Return to Arabella's Parents; Quest rewards.
- [BG3 Wiki revision 414866](https://bg3.wiki/w/index.php?title=Komira&oldid=414866) — Involvement / Act One.
- [BG3 Wiki revision 414865](https://bg3.wiki/w/index.php?title=Locke&oldid=414865) — Involvement / Act One.
- [BG3 Wiki revision 422574](https://bg3.wiki/w/index.php?title=Sacred_Pool&oldid=422574) — Access.

### Guiding Light

Two Bernard routes on Arcane Tower roof (fourth floor): peaceful ring-giving verse dialogue OR defeat/loot if he has **not already gifted the ring**. The gift stanza begins **"How can I trust?"**; Threadbare Book documents it, and a Bard can unlock verses through an alternative. No particular class is required. **Coordinates null; reviewed.** No pickpocket route. **Command: Drop belongs to Light of Creation, not Guiding Light.**

- [BG3 Wiki revision 419215](https://bg3.wiki/w/index.php?title=Guiding_Light&oldid=419215) — Where to find; Notes.
- [BG3 Wiki revision 432891](https://bg3.wiki/w/index.php?title=Bernard&oldid=432891) — Involvement / Act One / Commands; Combat / Notable loot.
- [BG3 Wiki revision 431380](https://bg3.wiki/w/index.php?title=Arcane_Tower&oldid=431380) — The fourth floor (roof); Bernard's commands; Loot / Fourth floor (roof).

## Coordinates, unknowns and review boundaries

- **Ten routes include supported coordinates:** two Fetish corpse routes, intact Hamarhraft chest, Ritual Dagger world placement, Spellsparkler interaction, four Hellrider actor routes, and Komira reward interaction. The two Fetish routes and four Hellrider routes intentionally repeat their respective reviewed point. The remaining **twelve** routes preserve null coordinates. No corpse point is repurposed as a living actor point, and no container point is repurposed as a loose-item point.
- Schema 1 has no corpse coordinate-subject enum, so Fetish uses `subject: actor` while actor name/notes make the corpse context explicit. No schema extension was introduced.
- Partial entries: Fetish transfer/dialogue branches, disputed Varsh DC and optional dialogue paths, Ritual Dagger arrival-state placement, Komira carried-loot uncertainty. Unknown coordinates remain null. No omitted fact is promoted to a universal prerequisite.
- The canonical actor redirects **Zhalk**, **Ko'kuu**, and **Florrick**, and the **The Hollow / Secluded Chamber** location redirect, are explicit source identities rather than weak item fallback.
- More sources compaction and shared-geography presentation come from the unchanged renderer. Fetish and Hamarhraft keep separate geography because their coordinate tuples differ; Hellrider's identical actor geography may collapse while the four route facts remain separate.
- No Checkpoint 1D/later-Act items, additional routes, schema additions, manual theme state, save-ID adapter or UI redesign are included.

## Tests and protected invariants

The permanent `tests/acquisition-act1-1c.test.cjs` regressions use literal checkpoint identities and the fixed approved 1B commit. They exercise the production resolver, generated browser/offline bundle, real normalizer/classifier/rendering paths and mocked imports/sync. Assertions cover reordered exact IDs and fail-closed mismatches, all twenty-two route contracts, supported/null coordinates, route-specific OR/ordering conditions, original thirty-entry preservation, Full-only native enrichment, density/reference retention, and v5/v6 Story isolation. Global aggregate tests advance to forty entries; the 1B snapshot assertion stays pinned to the approved thirty-entry checkpoint rather than weakening historical facts. Tests-first baseline: **78 failed / 4 passed** before the new data was applied. Final focused result: **82/82 passed**. Final complete app suite: **1,499/1,499 passed**, including all **1,417** previous tests. Both generated outputs and the saved asset are byte-identical; removing the embedded dataset line leaves executable bundle bytes identical to the fixed baseline.

Catalogue remains **556 source rows / 555 unique items / 555 distinct progress keys**. Acts 1/2/3: Vendor **63 / 50 / 67**, Loot **131 / 94 / 125**, Quest **25 / 0 / 0**. Graceful Cloth keeps two distinct identities; the Battlemage row retains **sourceRow 54**. Catalogue source bytes and all compatibility progress identities remain unchanged.

Schema, resolver, acquisition renderer, application HTML, validating builder, spoiler policy, search/filter/sort, classifiers, Story/progress/sync/auth, themes, SQL/database, PWA/service worker, versioned transport and exact DEV PREVIEW gating stay unchanged. Generated executable logic stays unchanged; only embedded canonical data changes. No live Supabase, database or existing user storage is used.
