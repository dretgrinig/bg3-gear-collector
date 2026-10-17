# Act 1 acquisition expansion — Batch 3

Data-only addition of the fifteen approved Act 1 identities on `5a1edf08a52803a502a13e740f3a9ba8276cd2f6`. Schema 2, resolver, renderer and `index.html` remain unchanged. Dataset **2.3.0-act1.batch3** contains **85 entries / 86 bindings / 104 routes**, matching **85 catalogue items / 80 of 219 Act 1 items**. The previous seventy entry objects remain unchanged.

## Reviewed identities and concise destinations

Every binding preserves the existing Act, progress key, complete UID/Stats set and item Wiki identity. All fifteen were unenriched before this batch and have no strong-ID collision with another catalogue row. No fallback identity is introduced.

| Item (sourceRow) | Type / destination | X, Y | Coordinate role / state |
| --- | --- | --- | --- |
| Boots of Aid and Comfort (24) | purchase: Goblin Camp · Grat the Trader's shop | -99, 424 | `actor` / `reference` |
| Boots of Genial Striding (26) | purchase: Ebonlake Grotto · Blurg's shop | 111, -89 | `actor` / `reference` |
| Boots of Elemental Momentum (25) | purchase: Rosymorn Monastery Trail · Camp northeast of the Trielta Crags waypoint | -43, -129 | `actor` / `reference` |
| Gloves of Dexterity (77) | purchase: Crèche Y'llek · A'jak'nir Jeera's shop | 1380, -798 | `location` / `reference` |
| Gloves of Missile Snaring (80) | purchase: The Hollow · Shop next to the Silvanus statue | 205, 516 | `actor` / `reference` |
| Hunting Shortbow (100) | purchase: The Hollow · Dammon's Act One shop | 177, 562 | `actor` / `reference` |
| The Speedy Lightfeet (201) | container: Blighted Village · Heavy chest in the windmill cellar | -711, -412 | `container` / `exact` |
| Helmet of Smiting (95) | container: Selûnite Outpost · Locked gilded chest southwest of the waypoint | 163, -248 | `container` / `reference` |
| Nature's Snare (121) | container: Underground Passage · Locked, trapped heavy chest | -425, -200 | `container` / `exact` |
| Moondrop Pendant (118) | container: Owlbear Nest · Magically sealed gilded chest at the Selûnite shrine | -321, -135 | `container` / `exact` |
| Ring of Poison Resistance (140) | actor_loot: Shattered Sanctum · Open sarcophagus before the Worg Pens | 338, 14 | `corpse` / `reference` |
| Smuggler's Ring (160) | actor_loot: The Risen Road · Bushes on the lower riverside path near the broken bridge | 58, 516 | `corpse` / `reference` |
| Spurred Band (168) | actor_loot: Whispering Depths · Skeleton beside a backpack | -495, -365 | `corpse` / `exact` |
| Staff of Crones (170) | world: Overgrown Tunnel · Ground pickup in the treasure/workshop room | -416, 599 | `item` / `reference` |
| Skybreaker (158) | container: Arcane Tower · Locked heavy chest outside the entrance | 28, -295 | `container` / `reference` |

## Conditions, discrepancies and scope

**Four Exact / eleven Reference / zero new exceptions / zero unresolved routes.** Every Reference has a nonempty reason, an explicit role and evidence. All seven known alternate published points remain in canonical notes and coordinate-review reasons. They are not averaged or silently promoted to Exact.

- **Moondrop Pendant:** one container route. Opening methods are alternatives: Selûnite Prayer Sheet read by someone other than Shadowheart, Knock, or a Cleric of Selûne. No full shrine walkthrough, mandatory Perception/Religion roll or cumulative requirements. The item article describes the prayer; the shrine article supplies alternatives and the reader restriction. The unchanged compact renderer shows the conditional-route Wiki notice, not a walkthrough.

- **Nature’s Snare:** locked/trapped chest; Charred Key OR lockpicking. Detecting/disarming the trap is not a universal acquisition prerequisite.

- **The Speedy Lightfeet:** actual cellar chest -711,-412 in the Windmill Cellar map space. The outside hatch -11,436 is a different subject/map space. Barcus rescue is not required.

- **Staff of Crones:** retain item reference -416,599; location article gives -412,606 in the Acrid Workshop, while the item calls it the Ancient Abode treasure room. Canonical evidence retains both points and the naming difference. Concise text says ground pickup in the treasure/workshop room, without rewriting catalogue geography or inventing an Ethel-kill prerequisite.

- **Jeera / Dammon:** Jeera shop 1380,-798 versus NPC 1387,-821 remains `reference` / `location`. Dammon shop 177,562 versus NPC 180,561 remains `reference` / `actor`; conditions retain Act One trading before refugee departure, without promising later-Act acquisition.

- **Other published differences:** Helmet of Smiting 163,-248 versus 163,-244; Ring of Poison Resistance 338,14 versus loot-list 338,15; Smuggler’s Ring 58,516 versus 57,516; Skybreaker 28,-295 versus 27,-298. Each retains the first approved point as Reference.

- **Vendor/loot semantics:** one purchase route per vendor item, with availability conditions where needed. No Omeluum/egg prerequisite, invented theft or death-drop route. Corpse items are carried by existing skeletons and do not imply killing a living NPC.

## Evidence and identity register

Public BG3 Wiki current revision bodies were inspected during planning and section/revision IDs rechecked with read-only GET on 2026-10-17. Primary item and supporting actor/location evidence are pinned in canonical sources. UUIDs were allocated once before the tests-first baseline.

| Item | Entry / binding UUID | Route UUID | Evidence revisions |
| --- | --- | --- | --- |
| Boots of Aid and Comfort | `fa05981a-7a3c-4f69-a715-aca3c71d9075` / `683f9439-072a-46d4-9b4c-a92c8a638858` | `f480fc7a-0f78-43ea-9118-931ebe99d9bf` | [416676](https://bg3.wiki/w/index.php?title=Boots_of_Aid_and_Comfort&oldid=416676); [414927](https://bg3.wiki/w/index.php?title=Grat&oldid=414927) |
| Boots of Genial Striding | `3b00c143-5b09-44b4-aaa3-253555c77bf5` / `246d2fa9-99cc-4aa5-89e4-77d0ebddb056` | `a4e8f99c-e50c-4637-97d9-f4a7c8db6129` | [416683](https://bg3.wiki/w/index.php?title=Boots_of_Genial_Striding&oldid=416683); [434059](https://bg3.wiki/w/index.php?title=Blurg&oldid=434059) |
| Boots of Elemental Momentum | `2d9a02e6-4f2e-4a1f-8ce9-e02ecd843c30` / `b7700e4f-58fa-4d52-88e9-4643c5b96336` | `3b61581d-949a-4644-9226-b639322526f2` | [416682](https://bg3.wiki/w/index.php?title=Boots_of_Elemental_Momentum&oldid=416682); [425220](https://bg3.wiki/w/index.php?title=Esther&oldid=425220) |
| Gloves of Dexterity | `8cde2948-005a-4835-b225-71ad89fcc747` / `ce6c141d-e46b-40ec-bd52-b0a321d283e9` | `68f43e81-ea43-4924-ab19-a1c149e5fd3b` | [418968](https://bg3.wiki/w/index.php?title=Gloves_of_Dexterity&oldid=418968); [416522](https://bg3.wiki/w/index.php?title=Jeera&oldid=416522) |
| Gloves of Missile Snaring | `babd48c1-f641-4854-b22c-64b82b61e680` / `deba51b7-88d8-4383-915f-ee0d72c7aea2` | `eacef3f5-3d1a-4167-b8c1-50d0eb2a68d0` | [418973](https://bg3.wiki/w/index.php?title=Gloves_of_Missile_Snaring&oldid=418973); [414921](https://bg3.wiki/w/index.php?title=Arron&oldid=414921) |
| Hunting Shortbow | `62ca4288-e1a3-4a05-bb5f-f0621a561892` / `7ae2bc2b-3412-42dd-8f9d-137546c7b1cd` | `978f9bf5-d3e3-4579-8e5a-19b7cfba8e01` | [419633](https://bg3.wiki/w/index.php?title=Hunting_Shortbow&oldid=419633); [414844](https://bg3.wiki/w/index.php?title=Dammon&oldid=414844) |
| The Speedy Lightfeet | `143d5e41-7a7d-4d56-9fee-3e4e9e70706f` / `19334d35-fcc3-49e0-be0d-eab833e1b12c` | `f98e234d-2800-401d-a33e-6848baf7ab65` | [424113](https://bg3.wiki/w/index.php?title=The_Speedy_Lightfeet&oldid=424113); [433668](https://bg3.wiki/w/index.php?title=Blighted_Village&oldid=433668) |
| Helmet of Smiting | `6bf2c1b3-7f6d-423b-9657-bb12d932e830` / `8846333b-f1fc-42d8-8f22-92d7c07caa20` | `9299369a-ee3c-46aa-90cc-7de4a195b03d` | [419475](https://bg3.wiki/w/index.php?title=Helmet_of_Smiting&oldid=419475); [431112](https://bg3.wiki/w/index.php?title=Sel%C3%BBnite_Outpost&oldid=431112) |
| Nature's Snare | `db95448a-64e1-4f92-ab28-7143568144c0` / `bbb0eec4-8d87-4771-9016-e17952f0bb7e` | `452274a9-869e-4550-913c-2fce0269242e` | [438410](https://bg3.wiki/w/index.php?title=Nature%27s_Snare&oldid=438410); [424498](https://bg3.wiki/w/index.php?title=Underground_Passage&oldid=424498) |
| Moondrop Pendant | `677b65b5-18a8-416e-a587-f2a42eddfd02` / `7b944d6b-a111-4248-a565-3e2688c62fc8` | `30a65b7c-10e3-415f-851a-63979edd9d9b` | [421071](https://bg3.wiki/w/index.php?title=Moondrop_Pendant&oldid=421071); [431001](https://bg3.wiki/w/index.php?title=Owlbear_Nest&oldid=431001) |
| Ring of Poison Resistance | `d894a6aa-4848-47e0-ae8d-1b32da567e74` / `372b8c5f-0f97-4d42-9993-555c3ef1a4e2` | `a3a83818-828d-4e2f-9f9e-37b020584b09` | [422389](https://bg3.wiki/w/index.php?title=Ring_of_Poison_Resistance&oldid=422389); [431013](https://bg3.wiki/w/index.php?title=Shattered_Sanctum&oldid=431013) |
| Smuggler's Ring | `397faf4f-f331-45ee-a6cf-b60d034872f5` / `a5968f21-e022-4ecd-91d1-c02dbadeedca` | `fa325c18-e482-49d1-92bf-301ec69b82b6` | [423333](https://bg3.wiki/w/index.php?title=Smuggler%27s_Ring&oldid=423333); [425790](https://bg3.wiki/w/index.php?title=The_Risen_Road&oldid=425790) |
| Spurred Band | `32b79f91-e548-441d-90a2-36c23caba57f` / `33fec110-849f-41e3-aa8a-c4957be043bd` | `c520df11-f165-4901-b516-93bdeb728c18` | [437985](https://bg3.wiki/w/index.php?title=Spurred_Band&oldid=437985); [370813](https://bg3.wiki/w/index.php?title=Whispering_Depths&oldid=370813) |
| Staff of Crones | `b33d5eb0-be1c-4d66-9e4b-41d2636c3cc0` / `ace6a2f5-410d-4ad4-b929-d5044fbc926b` | `9d0f4fc9-faa6-4111-8a2e-246cb9c83f8a` | [423535](https://bg3.wiki/w/index.php?title=Staff_of_Crones&oldid=423535); [433650](https://bg3.wiki/w/index.php?title=Overgrown_Tunnel&oldid=433650) |
| Skybreaker | `b5c8557e-fa6b-4341-ab21-4378fbbfd7e8` / `d9a423dd-37ca-40db-974a-4844b14238e3` | `b0fe5229-a400-4176-bef5-5f7793c2c061` | [423268](https://bg3.wiki/w/index.php?title=Skybreaker&oldid=423268); [431380](https://bg3.wiki/w/index.php?title=Arcane_Tower&oldid=431380) |

## Verification and boundaries

The new permanent Batch 3 suite has **159 tests**: literal identity/route/condition/evidence assertions, strict resolver rejection, actual desktop/mobile rendering, zero protected-mode enrichment DOM, transitions, generated/offline parity, cached identity, discovery isolation, all catalogue invariants and real v5/v6 import/export handlers with mocked state. The tests-first baseline was **153 failures / 6 passes**. Batch 2 total assertions now retain their fixed historical snapshot, while Batch 3 asserts the new global totals.

Verification is incremental across the unchanged product/data tree: the broad acquisition run passed 1,230 checks; its only two failures were the stale offline-restoration total (140 instead of 170 sections). Both corrected assertions were rerun successfully. All 803 focused cases (the previous 644 plus 159 new cases) are present among the successful acquisition checks. Remaining tracker and Phase A test files run as disjoint serial partitions, without counting any test twice.

For large virtual-DOM/export fixtures, direct per-file runs use `node --max-old-space-size=8192 --test-reporter=tap --expose-gc --require /path/to/test-gc.cjs tests/FILE.test.cjs`. A temporary hook outside the repository requests garbage collection with `require('node:test').afterEach(() => { if (global.gc) global.gc(); });`. It changes no assertion or application state and is not shipped. Parser-worker files run without this GC hook. These are verification-process settings only.

Completed incremental coverage: **803/803 focused acquisition, 2,099/2,099 tracker-only, 2,264/2,264 complete suite, 144/144 native browser scenarios**. All forty test files are covered; the two corrected assertions are counted once each, replacing their stale-count failures.

The native QA runner adds all fifteen items at 390/1280, first-click/Enter/Space checks, Full/protected transitions and representative screenshots, preserving all previous late-hydration cases. All requests are intercepted to local fixtures in disposable browser contexts; Supabase is blocked. Full/focused/tracker-only and browser result totals are recorded in the final handoff.

Minimal and Light construct zero new acquisition DOM. Full remains Effect → concise Where to find → original Wiki link. Conditions outside the simple-check case use the existing compact conditional-route notice; rich canonical alternatives/notes/evidence remain available for review. Metadata does not enter catalogue discovery, search, sort, options, badges, counts or progress.

Catalogue invariants: **556 source rows → 555 unique items / keys**; Vendor **63/50/67**, Loot **131/94/125**, Quest **25/0/0**; both Graceful Cloth contexts and retained Battlemage sourceRow 54 remain unchanged.

No Batch 4 or deferred-case implementation; no .lsv Phase B or real-save parsing. No auth/sync/Story/progress/themes/storage behavior, schema/resolver/renderer/index.html, classifier, SQL/database, PWA, versioned transport, DEV PREVIEW gating or deployment configuration changes. No commit/push.
