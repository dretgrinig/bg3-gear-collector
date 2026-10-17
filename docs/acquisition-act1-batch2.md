# Act 1 acquisition expansion — Batch 2

Data-only addition of fifteen reviewed Act 1 catalogue identities on `2087779449092caf968e1a07f11943d480018990`. Schema 2 and compact runtime remain unchanged. Dataset **2.2.0-act1.batch2** contains **70 entries / 71 bindings / 89 routes**, matching **70 catalogue items**, including **65 / 219 Act 1 items**. All original fifty-five entry objects are unchanged.

## Reviewed identities and routes

Every binding preserves the existing catalogue Act, progress key, complete UID/Stats set and exact Wiki identity. No fuzzy/name fallback or save-ID adapter is introduced. Public Wiki API revision bodies and their IDs were read together with GET on 2026-10-17. Evidence is pinned inside each route. UUIDs were allocated once before the tests-first baseline.

| Item (source row) | Method / destination | X, Y | Role / state |
| --- | --- | --- | --- |
| Helmet of Autonomy (94) | actor_loot: Underdark · Skeleton above the Festering Cove entrance | 82, -241 | `corpse` / `exact` |
| Slippery Chain Shirt (159) | container: The Festering Cove · Locked, trapped chest on the cliff behind the altar | -400, 329 | `container` / `exact` |
| Explorer's Ring (65) | actor_loot: Dread Hollow · Skeleton on a ledge above the Bibberbang Grotto | -12, -50 | `corpse` / `exact` |
| The Joltshooter (189) | quest_reward: Waukeen's Rest · Post-rescue conversation | -63, 600 | `interaction` / `exact` |
| Robe of Summer (146) | container: Hidden Vault · Side container beside the altar | 183, -82 | `container` / `reference` |
| Armour of Uninhibited Kushigo (18) | quest_reward: Grymforge · Sergeant Thrinn near the cave-in | -628, 320 | `encounter` / `reference` |
| Aberration Hunters' Amulet (2) | actor_loot: Crèche Y'llek · Doctor's Office | 1285, -801 | `encounter` / `reference` |
| Ritual Axe (144) | world: Shattered Sanctum · Bloodied Shrine table beside Abdirak | 338, -26 | `item` / `reference` |
| Ritual Axe (144) | actor_loot: Shattered Sanctum · Bloodied Shrine departure encounter | 334, -21 | `location` / `reference` |
| Sussur Dagger (174) | craft: Blighted Village · Smithy's cellar furnace | -446, -378 | `crafting_station` / `reference` |
| Sorrow (161) | world: Hidden Vault · Stone slab at the Wolf altar | 183, -82 | `item` / `reference` |
| The Watcher's Guide (203) | container: Dank Crypt · Central sarcophagus surrounded by statues and traps | -293, -323 | `container` / `exact` |
| Wondrous Gloves (217) | actor_loot: Grymforge · Mimics near the Harper cache | -691, 374 | `encounter` / `reference` |
| Ring of Arcane Synergy (133) | actor_loot: Crèche Y'llek · Main entrance checkpoint | 1359, -831 | `encounter` / `reference` |
| Strange Conduit Ring (172) | container: Crèche Y'llek · Elegant chest in the Inquisitor's Chamber | 1360, -657 | `container` / `exact` |
| Sunwalker's Gift (173) | purchase: Ebonlake Grotto · Blurg's shop | 111, -89 | `actor` / `reference` |

## Coordinate and condition decisions

**Six Exact / ten Reference / zero new exceptions / zero unresolved routes.** All references have nonempty reasons, explicit subjects and pinned evidence. No 0,0, averaging, silent null or inherited route point is used.

- **Helmet of Autonomy:** the skeleton is outside the Festering Cove in the Underdark at 82,-241. The access point 70,-240 is not substituted.
- **Slippery Chain Shirt:** use the actual chest -400,329, not the platform approach -401,311. It is locked/trapped; neither worship nor sacrifice is required.
- **Explorer’s Ring:** the item page and Dread Hollow agree on the skeleton at -12,-50. Jump aids are options, not mandatory character requirements.
- **The Joltshooter:** one post-rescue reward choice at -63,600, mutually exclusive with the other two weapons. Later Duke rescue/agreement is not a prerequisite. Rescue timing remains explicit in canonical conditions.
- **Robe of Summer / Sorrow:** each retains a separate object/method at the published Hidden Vault reference 183,-82. The item pages share that point for different objects. Inner Sanctum calls the robe container a side trunk, while its item page says crate; use the neutral side-container description rather than silently resolving the wording disagreement. Rune/pedestal access is required; obtaining the rune via reward, loot or pickpocket is not three routes creating either item.
- **Armour of Uninhibited Kushigo:** retain the item reward encounter -628,320 as Reference. Thrinn’s NPC page gives -643,300; the quest gives cave-in -626,331. Return Boots of Speed while Thrinn is available, then choose the armour instead of Bracing Band. Freeing Nere/certain Thulla outcomes are not made mandatory.
- **Aberration Hunters’ Amulet:** item reference 1285,-801; NPC page 1286,-800; crèche list 1286,-801; office entrance 1289,-809 is a different subject. Concise Full output is Crèche Y'llek · Doctor's Office · X/Y, then Loot: Carried by Ghustil Stornugoss. Acquisition has no ancestry/treatment prerequisite.
- **Ritual Axe:** table reference 338,-26 (location page says 337,-26) is distinct from the carried-by-Abdirak departure state. His page explicitly says he collects the axe when leaving after the goblin-leader conflict. The second route uses the explicitly labelled Bloodied Shrine navigation point 334,-21, not a claimed moving actor position. No ritual/blessing, theft or mandatory killing method is invented.
- **Sussur Dagger:** one craft route. Current quest body explicitly places the furnace at -446,-378; item acquisition-area reference -477,-378 is retained in notes/evidence. Use the furnace as a crafting-station Reference; do not alter the previously approved Sussur Greatsword entry. Plain compatible dagger and Sussur Tree Bark are required; no separate reward route is invented.
- **The Watcher’s Guide:** sarcophagus point -293,-323 is distinct from the southern-room anchor -293,-325. Trap disarming is not made mandatory.
- **Wondrous Gloves:** carried by a mimic near the Harper cache, not inside the separate Harper Stash. Use its encounter reference -691,374; detecting its disguise is optional.
- **Ring of Arcane Synergy:** Gish Far'aag entryway encounter reference 1359,-831; no mandatory dialogue/combat/artefact handover is added.
- **Strange Conduit Ring:** elegant chest 1360,-657; do not substitute Inquisitor chamber entrance 1357,-685 or require killing the Inquisitor.
- **Sunwalker’s Gift:** Blurg’s item/NPC pages agree on Act One trader reference 111,-89. No Omeluum prerequisite or later-Act binding is introduced.

## Pinned source and identity register

| Item | Entry UUID / binding UUID | Route UUID(s) | Primary item revision |
| --- | --- | --- | --- |
| Helmet of Autonomy | `8611acab-ae1f-4160-976b-f532f096f6d3` / `1a524618-86fc-4abd-b80d-e4238bbc410e` | `c104f0ad-56ab-46a9-a226-226bd4717584` | [419473](https://bg3.wiki/w/index.php?title=Helmet_of_Autonomy&oldid=419473) |
| Slippery Chain Shirt | `e10f6f76-ec5a-436f-9db4-bdebbc5d71ac` / `3629c5e9-5961-465b-a265-835091e74138` | `a116540e-b63a-459e-8676-628b40587f1d` | [423304](https://bg3.wiki/w/index.php?title=Slippery_Chain_Shirt&oldid=423304) |
| Explorer's Ring | `1965d424-1691-43e2-bedc-e8327126e6b3` / `489d6244-7324-404e-b5f4-5f62cae7ebd1` | `420ff375-75cb-4cf1-b792-77d1d7989a04` | [418328](https://bg3.wiki/w/index.php?title=Explorer%27s_Ring&oldid=418328) |
| The Joltshooter | `697bdf7c-be2b-4eff-96da-88a82ffbd92e` / `17d3513c-5dab-441e-947a-d5c8f4dedd41` | `c012f306-da9f-43cc-b1e0-14773d49bfcf` | [424041](https://bg3.wiki/w/index.php?title=The_Joltshooter&oldid=424041) |
| Robe of Summer | `15c273ee-5f1d-4afc-a9c9-a8841b62a158` / `19a154fa-14ae-47ac-a73d-861a11b8a3b9` | `35802ea9-403c-4837-ab0a-6072d7997070` | [422437](https://bg3.wiki/w/index.php?title=Robe_of_Summer&oldid=422437) |
| Armour of Uninhibited Kushigo | `06015a47-519f-483d-b6bc-eb38c644b344` / `b637a4e7-e6b1-442f-a21c-db78476d3850` | `70e51de6-b3d2-49ca-9c70-3eb30fa49d0d` | [416072](https://bg3.wiki/w/index.php?title=Armour_of_Uninhibited_Kushigo&oldid=416072) |
| Aberration Hunters' Amulet | `3809df0a-fc9d-4ab2-9473-6610ad441464` / `3ac7519d-5e76-4cf4-9846-b215b47e007a` | `20e39cd4-9853-4328-a6a1-997eae981584` | [415736](https://bg3.wiki/w/index.php?title=Aberration_Hunters%27_Amulet&oldid=415736) |
| Ritual Axe | `45007dab-5a69-4b83-a090-6fd30f69b799` / `08bbe2c7-e516-440e-9f29-df25b72529b6` | `f46448bc-57e3-4664-9705-297557b3f712` / `f41beb97-95ea-4c86-b1d5-3849caedceae` | [422414](https://bg3.wiki/w/index.php?title=Ritual_Axe&oldid=422414) |
| Sussur Dagger | `5a12b209-dd90-466e-9b7f-00723b11fa8e` / `7e1b46e6-9b8c-4e5b-b53a-823f21a1affb` | `0b874eb2-c5ae-441b-ab54-2420f0c4f2f8` | [438507](https://bg3.wiki/w/index.php?title=Sussur_Dagger&oldid=438507) |
| Sorrow | `4e49579c-7de2-417b-8190-0a67cdf2b543` / `1c9fc71a-7690-450a-b76f-00e5d04e41ae` | `dd94ea09-0737-4ffd-b240-05e0ea3c8b23` | [426894](https://bg3.wiki/w/index.php?title=Sorrow&oldid=426894) |
| The Watcher's Guide | `df5fa78a-9002-4c27-95dd-9f8d05af64c3` / `a653e118-9b94-4969-939a-5b9b206ee9cf` | `4168d325-da02-4170-9ba2-3b3ecd2fa333` | [424151](https://bg3.wiki/w/index.php?title=The_Watcher%27s_Guide&oldid=424151) |
| Wondrous Gloves | `da342b39-8092-44c6-89a9-c6e27778a123` / `0e48db29-2b5c-460c-98b0-7bfcfaba06fb` | `e7e3e82b-bd28-46e3-93f6-0a666e7509b5` | [424969](https://bg3.wiki/w/index.php?title=Wondrous_Gloves&oldid=424969) |
| Ring of Arcane Synergy | `9db3446c-e93b-48ab-ba7b-083d4021c1cf` / `7ec0f442-e693-44ca-9aa6-a8272e5843f8` | `f00bea0b-994e-48ae-8f44-b3c6f7f692e2` | [438176](https://bg3.wiki/w/index.php?title=Ring_of_Arcane_Synergy&oldid=438176) |
| Strange Conduit Ring | `9e3697dc-ec4c-488d-aa34-4a5106659a63` / `fc54a7bc-d269-433a-8774-b7ac7cb4a8ef` | `83de956f-b1f6-4ec1-8c5a-2eac7e58aecc` | [423637](https://bg3.wiki/w/index.php?title=Strange_Conduit_Ring&oldid=423637) |
| Sunwalker's Gift | `f5254339-0640-4849-9c58-f593f2daa7e5` / `f70f908c-2de3-4461-83a4-446f4ccb73c8` | `3fb986a6-ff89-446f-9bf3-896a3200fec7` | [423716](https://bg3.wiki/w/index.php?title=Sunwalker%27s_Gift&oldid=423716) |

## Verification and scope

The new permanent Batch 2 tests pin literal identities, points, methods and source revisions, exercising the production resolver, both renderers, generated/offline bundle, cache identity and v5/v6 import/export handlers. The tests-first baseline was **147 failures / 6 passes across 153 regressions**. Earlier checkpoint assertions retain their fixed historical scopes; new global guards assert the complete 70/71/89 dataset and 34/50/5 coordinate totals.

Browser QA covers all fifteen new items at 390/1280, native click/Enter/Space, compact presentation and Full ↔ protected transitions, alongside all existing cases. All requests are intercepted to local fixtures, with Supabase blocked and disposable browser state. Final run totals are reported in the handoff.

Full remains Effect → Where to find → one original Wiki link. Minimal/Light construct zero enrichment DOM. Discovery/search/filter/sort/counts/badges/progress remain independent. Canonical data is inspectable in the static bundle, which is separate from UI spoiler isolation.

Catalogue invariants remain **556 source rows → 555 unique items / 555 keys**; Vendor **63/50/67**, Loot **131/94/125**, Quest **25/0/0**. Both Graceful Cloth identities and retained Battlemage row 54 remain unchanged.

No schema/resolver/renderer/index.html, auth/sync/Story/progress/themes/storage behavior, classifier, SQL/database, PWA, versioned transport, DEV PREVIEW gating or deployment configuration changes. No .lsv Phase B or real-save parsing. No commit/push.
