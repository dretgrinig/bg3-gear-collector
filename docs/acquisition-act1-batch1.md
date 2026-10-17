# Act 1 acquisition expansion — Batch 1

Data-only addition of exactly fifteen reviewed Act 1 catalogue identities. Schema 2, resolver, compact renderer and index.html remain unchanged. Dataset **2.1.0-act1.batch1** now contains **55 entries / 56 bindings / 73 routes**, matching **55 unique catalogue items**, including **50 / 219 Act 1 items**. The original forty entry objects remain unchanged from `0b33854b2868f587fd614edf179fd5e0392e7c22`.

## Identity review

Each candidate has exactly one ACT 1 source row. The binding preserves its exact progress key, complete existing game-ID set and specific Wiki page. Item-page UID/Stats fields were checked against the existing IDs; no UUID/Stats namespace conversion, fuzzy matching or name-only fallback was added. The two-ID bindings for the amulet, Spiderstep Boots and Reason’s Grasp remain complete. All IDs below were allocated once before canonical data changes and are permanent.

## Reviewed routes

| Item (source row) | Method / destination | X | Y | Role / review | Item evidence |
| --- | --- | ---: | ---: | --- | --- |
| Cap of Curing (36) | container: Sacred Pool · Locked gilded chest near Alfira | 289 | 488 | `container` / `reference` | [416893](https://bg3.wiki/w/index.php?title=Cap_of_Curing&oldid=416893) |
| The Amulet of Lost Voices (182) | container: Dank Crypt · Heavy chest in Withers' room | -290 | -235 | `container` / `exact` | [423936](https://bg3.wiki/w/index.php?title=The_Amulet_of_Lost_Voices&oldid=423936) |
| Glowing Shield (85) | container: Goblin Camp · Locked chest on the ridge behind the camp | -53 | 461 | `container` / `reference` | [418984](https://bg3.wiki/w/index.php?title=Glowing_Shield&oldid=418984) |
| Spiderstep Boots (166) | container: Whispering Depths · Chest in the Arachnomancer's lab | -514 | -411 | `container` / `exact` | [423462](https://bg3.wiki/w/index.php?title=Spiderstep_Boots&oldid=423462) |
| Firestoker (69) | container: Grymforge · Dormitory chest near the Hellsboars | -574 | 382 | `container` / `exact` | [418522](https://bg3.wiki/w/index.php?title=Firestoker&oldid=418522) |
| Holy Lance Helm (98) | container: Rosymorn Monastery · Painted chest accessed from the top level | 120 | 35 | `container` / `reference` | [419557](https://bg3.wiki/w/index.php?title=Holy_Lance_Helm&oldid=419557) |
| Silver Pendant (157) | actor_loot: Harper Outpost skeleton · Ravaged Beach · Harper Outpost skeleton by the campfire | 152 | 366 | `corpse` / `exact` | [434159](https://bg3.wiki/w/index.php?title=Silver_Pendant&oldid=434159) |
| Gloves of Baneful Striking (74) | purchase: Lady Esther · Rosymorn Monastery Trail · Lady Esther's camp | -43 | -129 | `location` / `reference` | [418963](https://bg3.wiki/w/index.php?title=Gloves_of_Baneful_Striking&oldid=418963) |
| Giantbreaker (72) | purchase: Brem · Zhentarim Basement · Brem's shop | 295 | -250 | `encounter` / `reference` | [418879](https://bg3.wiki/w/index.php?title=Giantbreaker&oldid=418879) |
| Gloves of Uninhibited Kushigo (84) | quest_reward: Derryth Bonecloak · Ebonlake Grotto · Derryth's stall | -55 | -93 | `encounter` / `reference` | [418979](https://bg3.wiki/w/index.php?title=Gloves_of_Uninhibited_Kushigo&oldid=418979) |
| Beastmaster's Chain (20) | container: Worg Pens · Chest by the meat table | 379 | -43 | `container` / `reference` | [425313](https://bg3.wiki/w/index.php?title=Beastmaster%27s_Chain&oldid=425313) |
| Fleetfingers (70) | container: Forest · Buried chest southeast of the Blighted Village | 80 | 347 | `container` / `reference` | [418599](https://bg3.wiki/w/index.php?title=Fleetfingers&oldid=418599) |
| Mage's Friend (113) | container: Arcane Tower · Chest at the foot of the bedroom bed | -34 | -274 | `container` / `reference` | [420704](https://bg3.wiki/w/index.php?title=Mage%27s_Friend&oldid=420704) |
| Reason's Grasp (130) | container: The Risen Road · Locked chest behind the caravan survivors | 37 | 644 | `container` / `exact` | [422199](https://bg3.wiki/w/index.php?title=Reason%27s_Grasp&oldid=422199) |
| The Sparkle Hands (197) | container: Decrepit Sanctuary · Wooden chest at the giant stump in the Sunlit Wetlands | 95 | 210 | `container` / `exact` | [424109](https://bg3.wiki/w/index.php?title=The_Sparkle_Hands&oldid=424109) |

## Coordinate decisions

**Six exact routes; nine reference routes; zero exceptions or pending/conflict routes added.** No nearby coordinates were averaged or copied between routes.

Six container references preserve the item-page coordinate, with location-page discrepancies explicitly retained in canonical notes/evidence:

- Cap of Curing: item 289,488; Sacred Pool 292,483.
- Glowing Shield: item −53,461; Goblin Camp −57,467.
- Holy Lance Helm: item page and monastery item list 120,35; monastery prose 121,37. Retain the item point as a reference rather than claim agreement.
- Beastmaster’s Chain: item 379,−43; Worg Pens 377,−44 in prose and 378,−44 in its list.
- Fleetfingers: item 80,347; Forest 79,347.
- Mage’s Friend: item −34,−274; Arcane Tower −29,−273. The reviewed description uses the bedroom bed rather than changing the catalogue’s floor numbering.

Lady Esther’s camp is a `location` reference; neither egg quest nor an invented death-drop route is required. Giantbreaker uses Brem’s item-page `encounter` reference, not Zarys’ quest-giver point. Kushigo uses the item-page reward encounter −55,−93, not the quest-start coordinates 51,−96 supplied on the quest page.

Silver Pendant’s exact 152,366 point is the item-page skeleton. Ravaged Beach identifies 160,373 as a spider crevice; that nearby point is not substituted. The History check identifies an insignia, not a retrieval prerequisite.

## Concise conditions and alternatives

- Fleetfingers: Perception DC 20 **OR** reading the War Map reveals the buried chest. These are discovery alternatives for one container, not two acquisition methods or a mandatory check. The existing renderer safely uses its brief conditional qualification.
- Giantbreaker: Zarys’ approval unlocks Brem’s special stock through Find the Missing Shipment. No single shipment-resolution branch is made mandatory; generic merchant-loot prose is not promoted to a Giantbreaker-specific loot route.
- Gloves of Uninhibited Kushigo: rescue Baelen and speak to Derryth. Noblestalk is not required. The turn-in location is distinct from quest-start coordinates.
- Chest locks and physical access are described briefly in sublocations. No unsupported lockpicking DC, key, player-kill prerequisite or walkthrough branch is added.

## Primary evidence and provenance

Public BG3 Wiki API revision bodies were read with GET on **2026-10-14**, returning each revision ID and body together. Item acquisition fields and UID/Stats were inspected. Relevant location/NPC/quest pages are separately pinned in each route; canonical sources retain section labels. No long Wiki passages are copied. Historical revision pins in the original forty entries are untouched.

Supplementary reviews: Rosymorn Monastery 408982; Sacred Pool 422574; Goblin Camp 433423; Ravaged Beach 434158; Esther 425220; Rosymorn Monastery Trail 426994; Brem 425720; Find the Missing Shipment 418498; Derryth Bonecloak 433882; Find the Mushroom Picker 418499; Worg Pens 424990; Forest 418673; Arcane Tower 431380.

## Immutable identity register

| Item | Entry UUID | Binding UUID | Route UUID |
| --- | --- | --- | --- |
| Cap of Curing | `dd599543-0f80-4e09-a20b-b5c00a14a614` | `ee3521e6-663f-4185-9f49-56892b57a088` | `cddca05f-efb9-47cc-9049-20a76d801b66` |
| The Amulet of Lost Voices | `7a5bbf9e-de62-4419-884a-c8dcb49ec6bd` | `469f69ae-9465-432c-951e-4553f105becc` | `5fc621f8-88bb-4551-bbbb-8034bcef29a7` |
| Glowing Shield | `00909cc2-7577-472b-9d5f-9d2f58c2bb12` | `e0c63f1a-a34a-4b8e-942b-d25dfeb85d61` | `5cb1f3c0-5918-4548-b4f4-4d548baa6006` |
| Spiderstep Boots | `a32dbac2-0079-4f6c-aedb-6d2c5cdc625c` | `5e7ed27b-65ae-45d5-ac10-da372a8bbf43` | `092eae73-ef6f-44ba-96aa-d9d0d611d5f9` |
| Firestoker | `e8dc08e4-09f6-4c2f-b599-2c97c8b850f7` | `bff4dff7-527e-48ce-a7a3-cfc3ede97076` | `7056d7e8-8469-41a2-85a3-947ed8589245` |
| Holy Lance Helm | `a96da366-d459-4e38-99c2-a2fb87b38bdb` | `c780fc45-5ed7-4eac-82b3-7d3489fa8f2a` | `782920ee-62fa-44d1-bfb6-7d11f94471e8` |
| Silver Pendant | `92e1c35c-3780-4ae1-98e1-90af6637cd7f` | `c15b922d-3813-4acf-bb72-ff87d197b234` | `b69ebe26-482c-4d80-aebf-5116c622efb4` |
| Gloves of Baneful Striking | `2df71385-68cc-406d-9b91-07a1b20c8575` | `804c9bcc-cf11-4870-9d53-94acd7b6db6f` | `f1c0e32a-ea20-4e38-84c6-9a569bfc9e52` |
| Giantbreaker | `e28cbe1e-3e5d-474f-9b56-ec42ebf02851` | `c3ad2db8-cd49-462f-89ef-feefc28e31b7` | `aefc4ce4-1ed6-4d89-9347-71446bc0d747` |
| Gloves of Uninhibited Kushigo | `9fb372ad-34a4-4745-b09f-c5f7c29ef577` | `3259e113-8a4e-402a-aaf1-f49abd06b525` | `17473c98-2858-4045-b7f6-844ddbf4ce85` |
| Beastmaster's Chain | `c6742140-9686-48fd-8073-32e2de063cf3` | `0a6c6fd9-49e0-498f-99d8-905ca95a4df4` | `26675fa4-b827-4d55-a670-f7cbb991f712` |
| Fleetfingers | `3628bd0b-341a-47f9-81c9-79d054e655b4` | `1653aebe-5e32-480f-b210-23d5f135edda` | `0f30ab9b-2800-4f91-a810-543309f5e802` |
| Mage's Friend | `2f3955dc-ceb1-40a4-9fb0-cb2f4752b33f` | `71a5da33-ef5b-4b82-8d73-fadf1b5f7914` | `3eb4faf9-5fb1-4660-8d82-8ffb6e3d69d7` |
| Reason's Grasp | `0a07035b-3374-4fa3-b5e6-7662c0de8f8f` | `d79aff13-4f70-48dd-a80d-92b0b0f901ff` | `ca58f20a-8b59-490a-840b-f70ccb3a3c29` |
| The Sparkle Hands | `3ec7a407-4c88-4387-9bea-4d426ac417d9` | `3dc52da3-25d0-4021-881b-8931caa7bc84` | `e0f3c508-094c-4a9b-a255-bb73f13f5b4e` |

## Verification and boundaries

`tests/acquisition-act1-batch1.test.cjs` adds 149 permanent cases. The tests-first run had **143 failures / 6 passes** before metadata was added; the focused implementation run passes **149/149**. Assertions use literal expected identities/points and execute the production resolver, both render surfaces, generated/offline bundle and existing import handlers. Existing snapshot assertions retain their original checkpoint scope; current global counts are updated narrowly.

The full app suite, tracker-only suite, acquisition tests and disposable local-browser QA are run for this checkpoint. The browser runner includes all fifteen new items at 390 and 1280 pixels, native disclosure/keyboard interaction and Full ↔ protected transitions. It intercepts all requests and never connects to Supabase. Final totals are reported with the checkpoint handoff.

Full remains Effect → Where to find → one existing Wiki link. Minimal and Light construct zero enrichment DOM; search/filter/sort/counts/badges/progress remain independent. Dataset totals: **28 exact / 40 reference / 5 not-applicable / 0 pending/conflict** across 73 routes. The five original exceptions and five component navigation points are unchanged.

Catalogue invariants: **556 source rows → 555 items / 555 progress keys**; Vendor **63/50/67**; Loot **131/94/125**; Quest **25/0/0**. Both Graceful Cloth identities and retained Battlemage sourceRow 54 remain unchanged; v5/v6 compatibility is exercised.

No other catalogue items, runtime schema/resolver/renderer, index.html, auth/sync/Story/progress/themes, storage behavior, SQL/database, PWA, versioned transport or DEV PREVIEW gating are changed. No .lsv Phase B work, real-save parsing, production connection, commit or push is included.
