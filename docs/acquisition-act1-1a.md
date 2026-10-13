# Act 1 acquisition expansion — Checkpoint 1A

Checkpoint: `0a986fcd38f798191ed1672e58ac6e5bb3c9eaad`. This adds only the ten approved Act 1 identities to the original ten-item pilot. Schema stays **1**; dataset version becomes **1.1.0-act1.1a**. Total: **20 entries, 21 bindings, 24 routes**. The original entries, bindings, routes and facts remain unchanged.

## Review provenance

BG3 Wiki canonical item pages and the actor/location supplements below were read on **2026-10-13**. Their displayed permanent-link revision IDs matched the prior review pins. Explicit historical `oldid` retrieval was unavailable in the browsing tool; **the pinned historical page bodies were not independently retrieved**. URLs and section labels retain the observed revision identity without claiming a historical-snapshot review. These are concise paraphrases, not copied Wiki passages.

The canonical JSON is the sole runtime fact source. The existing canonical-validation builder regenerates `assets/acquisition-pilot.js`; neither renderer nor resolver changes. There is no runtime scraping or additional network dependency.

## Stable identity manifest

UUIDs were assigned once for this checkpoint. They do not derive from row order or presentation. Every binding is exactly `ACT 1` and uses the complete existing `gameIds[]`; `wikiPage` is the decoded canonical item title listed below. No fallback binding is added.

| Item / decoded Wiki identity | Entry UUID | Binding UUID | Route UUID / type |
| --- | --- | --- | --- |
| Gloves of Archery | `e1951fdb-1f5d-4d9d-8baa-acd637b2bbee` | `8ee57305-b248-4cba-aee5-c975536e6fa0` | `a9cc463f-f003-4a3f-a6cb-a596d2fd4887` / `purchase` |
| Returning Pike | `e1d30097-a7b3-4d7f-9726-eeaee38b403b` | `53a430eb-6b68-4edd-bb67-aadf1d5f62ad` | `5c010f34-1ffd-4060-98ee-46fb80e4f5fe` / `purchase` |
| Periapt of Wound Closure | `cf24d36b-c3f1-4a30-8422-7a045e4b1596` | `2a16e1a2-fb75-4461-939a-41d4475d0dbb` | `f77e74f8-9a65-48f2-b3de-02df71732def` / `purchase` |
| Haste Helm | `dd58ec01-cc38-485e-9e95-829cc9ca7299` | `3c15c196-3491-4549-9d02-b696b7019f82` | `4febc573-f6ea-4c6d-b948-92b6785e01fe` / `container` |
| Luminous Armour | `51a46914-eac6-4b5e-9ca0-794c2da907ed` | `4b5ccea7-dea4-4c75-9041-76f6abf55b13` | `306c63c5-2d36-444f-acf4-d8688aae9617` / `container` |
| Bracers of Defence | `64cf9246-1d4e-4338-b937-8c4b19e0b032` | `8dde450b-1cbe-4c3c-b291-0238f578ed53` | `27a9cbc8-ad13-47e8-8758-14bacf476445` / `container` |
| Amulet of Silvanus | `0973ed34-77d1-42e2-90e3-69f1c5304106` | `e0f13c63-aac0-4891-a0f6-72be24907067` | `81880cdb-2ffc-4da4-8ed8-221cad717a17` / `world` |
| Gloves of Power | `4a404f0f-fbe6-4d4c-ba24-586736ca2708` | `43a56161-a0ed-4158-872c-0f71e22bf072` | `4fb9c98a-5b63-48e7-afa7-18d8697b61df` / `actor_loot` |
| Faithbreaker | `7ed1aebe-9719-4c4f-9131-8161664977b8` | `6b27e4a2-ffff-4f5e-922b-8bb34b6eada0` | `dd8a0397-9f0c-441f-b257-767b28f39500` / `actor_loot` |
| Shortsword of First Blood | `1466bc4d-0c0b-4c76-94b6-9d4f2f751ad8` | `5e176d01-5adf-474c-b8bf-83a783bf360c` | `840f2cfc-76e4-4c99-969e-b75ea7b893d3` / `actor_loot` |

| Exact compatibility progress key | Complete game IDs | Original source row |
| --- | --- | --- |
| `act 1\|gloves of archery` | `UNI_ARM_OfArchery_Gloves` | 73 |
| `act 1\|returning pike` | `MAG_Throwable_Pike` | 131 |
| `act 1\|periapt of wound closure` | `MAG_PHB_PeriaptofWoundClosure_Amulet` | 125 |
| `act 1\|haste helm` | `MAG_Mobility_MomentumOnCombatStart_Helmet` | 90 |
| `act 1\|luminous armour` | `MAG_Radiant_RadiatingOrb_Armor` | 112 |
| `act 1\|bracers of defence` | `UNI_ARM_OfDefense_Gloves` | 32 |
| `act 1\|amulet of silvanus` | `DEN_BearReward_Amulet` | 16 |
| `act 1\|gloves of power` | `UNI_DEN_RaidingParty_GoblinCaptain_Gloves` + `DEN_RaidingParty_GoblinCaptain_Gloves` | 81 |
| `act 1\|faithbreaker` | `GOB_GoblinKing_Warhammer` | 67 |
| `act 1\|shortsword of first blood` | `UNI_UND_Duergar_ShortswordOfFirstBlood` + `UND_Duergar_ShortswordOfFirstBlood` | 155 |

## Evidence and conservative route facts

All ten additions have `coverage: reviewed`, one route with `review.state: reviewed`, `validity: current`, and `acts: [1]`. Coverage records this bounded checkpoint review; it does not infer extra methods or certify availability in a particular save. Only explicit acquisition facts are included.

### Gloves of Archery

Purchase from Grat at the Goblin Camp courtyard shop. Actor point **(-99, 424)**, space **Goblin Camp**. Available while the shop remains open; poisoning the courtyard puts it on high alert and closes shop access. No carried/drop/theft alternative inferred.

- [BG3 Wiki revision 418962](https://bg3.wiki/w/index.php?title=Gloves_of_Archery&oldid=418962) — Where to find.
- [BG3 Wiki revision 414927](https://bg3.wiki/w/index.php?title=Grat&oldid=414927) — Involvement / Act One; Store / Stock.
- [BG3 Wiki revision 433423](https://bg3.wiki/w/index.php?title=Goblin_Camp&oldid=433423) — Centre courtyard.

### Returning Pike

Purchase from Grat at the same courtyard shop and actor point **(-99, 424)**. The same shop-open prerequisite and courtyard high-alert cutoff remain route-specific. No death-drop route inferred.

- [BG3 Wiki revision 422338](https://bg3.wiki/w/index.php?title=Returning_Pike&oldid=422338) — Where to find.
- [BG3 Wiki revision 414927](https://bg3.wiki/w/index.php?title=Grat&oldid=414927) — Involvement / Act One; Store / Stock.
- [BG3 Wiki revision 433423](https://bg3.wiki/w/index.php?title=Goblin_Camp&oldid=433423) — Centre courtyard.

### Periapt of Wound Closure

Purchase from Lady Esther (`Esther`) at the camp northeast of Trielta Crags, Rosymorn Monastery Trail. Accepting or completing the egg mission is not required. **Coordinates null:** the published (-43, -129) identifies the camp, not a verified exact actor point.

- [BG3 Wiki revision 421757](https://bg3.wiki/w/index.php?title=Periapt_of_Wound_Closure&oldid=421757) — Where to find.
- [BG3 Wiki revision 425220](https://bg3.wiki/w/index.php?title=Esther&oldid=425220) — Store / Notable items sold.
- [BG3 Wiki revision 426994](https://bg3.wiki/w/index.php?title=Rosymorn_Monastery_Trail&oldid=426994) — Lady Esther's camp.

### Haste Helm

Open the locked Moss-Covered Chest near the Blighted Village waypoint/wagon. Container point **(29, 405)**, space **Blighted Village**. The documented key can open the chest, but possession of it is not mandatory. No lockpick DC or additional route inferred.

- [BG3 Wiki revision 419356](https://bg3.wiki/w/index.php?title=Haste_Helm&oldid=419356) — Where to find.
- [BG3 Wiki revision 421114](https://bg3.wiki/w/index.php?title=Moss-Covered_Chest&oldid=421114) — Where to find.
- [BG3 Wiki revision 433668](https://bg3.wiki/w/index.php?title=Blighted_Village&oldid=433668) — Village Center and the Well.

### Luminous Armour

Open the hidden room's locked, trapped opulent chest at the Selûnite Outpost. Container point **(176, -247)**, space **Selûnite Outpost**. Access notes preserve **Perception DC 15 OR jumping through the wall breach from the adjacent waypoint room**. Neither alternative is a separately mandatory prerequisite; no compulsory disarm check is invented.

- [BG3 Wiki revision 420655](https://bg3.wiki/w/index.php?title=Luminous_Armour&oldid=420655) — Where to find; Notes.
- [BG3 Wiki revision 431112](https://bg3.wiki/w/index.php?title=Sel%C3%BBnite_Outpost&oldid=431112) — Overview / Outpost; Loot.

### Bracers of Defence

Gilded chest in the Necromancer's Lab small library, Apothecary's Cellar. Prerequisite: reach the hidden laboratory. Notes preserve finding/using the hidden lever and **persuading OR destroying the Ornate Mirror**; Perception highlights the lever and is not mandatory. **Coordinates null:** item source (-656, -370) and chest-specific location source (-656, -369) disagree. The book enclosure's separate gate/key/trap rules are not copied onto the bracers. Review risk **medium**, documented here without extending schema 1.

- [BG3 Wiki revision 416721](https://bg3.wiki/w/index.php?title=Bracers_of_Defence&oldid=416721) — Where to find.
- [BG3 Wiki revision 408733](https://bg3.wiki/w/index.php?title=Apothecary%27s_Cellar&oldid=408733) — Main Cellar; Cavernal Antechamber; Necromancer's Lab.

### Amulet of Silvanus

World pickup under the flat rock near Ormn in the Emerald Grove. Move the rock; **(262, 481)**, space **Emerald Grove**, subject **item**, as approved. No actor/giver, Strength threshold, or bear reward is inferred from the opaque `DEN_BearReward_Amulet` ID.

- [BG3 Wiki revision 415919](https://bg3.wiki/w/index.php?title=Amulet_of_Silvanus&oldid=415919) — Where to find.
- [BG3 Wiki revision 418197](https://bg3.wiki/w/index.php?title=Emerald_Grove&oldid=418197) — Loot; Notes and references.

### Gloves of Power

Carried loot on Za'krug at the Emerald Grove entrance's initial gate encounter. **Coordinates null:** published item acquisition context does not establish an exact actor point. Conditions remain null: Absolute's Brand concerns an equipment effect, not acquiring the gloves. No theft method inferred.

- [BG3 Wiki revision 418974](https://bg3.wiki/w/index.php?title=Gloves_of_Power&oldid=418974) — Where to find.
- [BG3 Wiki revision 415001](https://bg3.wiki/w/index.php?title=Za%27krug&oldid=415001) — Involvement / Act One; Combat / Loot.

### Faithbreaker

Carried loot on Dror Ragzlin in the Shattered Sanctum throne room. **Coordinates null:** published item acquisition context does not establish an exact actor point. Conditions remain null; no universal player-kill prerequisite or unverified non-kill method is added.

- [BG3 Wiki revision 418370](https://bg3.wiki/w/index.php?title=Faithbreaker&oldid=418370) — Where to find.
- [BG3 Wiki revision 433795](https://bg3.wiki/w/index.php?title=Dror_Ragzlin&oldid=433795) — Involvement / Act One / Shattered Sanctum; Combat / Loot.

### Shortsword of First Blood

Loot an already-executed unnamed deep gnome's corpse at the Decrepit Village entrance, Underdark. **(73, -187)**, space **Underdark**, subject **actor**, because schema 1 has no corpse-specific enum. Actor name and notes explicitly say corpse/already dead. The Myconid Colony approach identifies the entrance; it is guidance, not a prerequisite. No killing, quest or check requirement inferred.

- [BG3 Wiki revision 423174](https://bg3.wiki/w/index.php?title=Shortsword_of_First_Blood&oldid=423174) — Where to find.
- [BG3 Wiki revision 393428](https://bg3.wiki/w/index.php?title=Decrepit_Village&oldid=393428) — Loot.

## Unknowns and deferred work

- Four optional coordinate points remain null: Periapt of Wound Closure, Bracers of Defence, Gloves of Power, Faithbreaker. No fabricated precision or coordinate conversion.
- The unnamed corpse has no specific actor Wiki identity. Null actor fields remain null for containers and the world pickup.
- No additional purchase/drop/theft/kill routes, later Acts, inferred hard prerequisites, dynamic availability evaluator or new schema field.
- Checkpoints 1B/1C are not included. Save-ID namespace adaptation and broader data expansion remain separate approvals.

## Verification boundaries

The focused checkpoint tests use the actual validator/resolver, current normalized catalogue, generated browser bundle, production Full hydration and existing DOM boundaries. They pin IDs and exact facts independently, verify fail-closed identity mismatches, preserve all original pilot entries against the fixed approved checkpoint, and exercise Minimal/Light isolation and in-place Full hydration. Aggregate existing-test counts are increased only for the explicitly approved additions; original pilot assertions stay present.

Catalogue invariants: **556 raw source rows / 555 unique items and distinct progress keys**. Acts 1/2/3: Vendor **63 / 50 / 67**, Loot **131 / 94 / 125**, Quest **25 / 0 / 0**. Both Graceful Cloth identities stay separate; Battlemage retains source row **54**. Existing v5/v6 tests remain unchanged.

Protected modules, application HTML, source fixtures and SQL are unchanged. Versioned transport remains default-off and DEV PREVIEW retains its exact hostname condition. All testing is local/mocked; no live Supabase/database or existing user storage is accessed.
