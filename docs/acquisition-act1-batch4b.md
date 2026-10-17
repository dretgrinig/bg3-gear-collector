# Act 1 acquisition — Batch 4B

Data-only expansion on `6e71b247424e9ae17ae0782724b1972197574c8c`. Schema 2; dataset `2.5.0-act1.batch4b`. The independent [reviewed fact table](../tests/fixtures/acquisition-act1-batch4b.json) is authored from the previously approved 4B plan and explicit implementation brief, not extracted from canonical acquisition JSON. Existing pinned item/support bodies from the planning artifacts were reused; no broad new research was performed.

46 entries / 46 bindings / 55 routes added: **4 Exact / 50 Reference / 1 Exception / 0 Pending**. Total **178 entries / 179 bindings / 210 routes**: **50 Exact / 154 Reference / 6 Exceptions**, no pending/conflict/not-documented routes. Catalogue coverage **173/219 Act 1**, **46 remain for 4C**. Prior 132 entry objects remain unchanged.

## Concise approved routes

Every row below retains the complete catalogue strong-ID set and exact Act/name/Wiki guard in the independent fixture. Multi-route venues do not create additional tracker identities.

| Row | Catalogue item | Where to find / necessary context | State / role |
|---:|---|---|---|
| 3 | Absolute's Talisman | Shattered Sanctum · Gut’s sanctum area · 298,-16 · actor_loot | reference / actor |
| 4 | Absolute's Warboard | Shattered Sanctum · Gut’s sanctum area · 298,-16 · actor_loot | reference / actor |
| 12 | Amulet of Branding | Crèche Y'llek · Jeera’s shop · carried loot · 1380,-798 · actor_loot | reference / location |
| 17 | Amulet of the Unworthy | Underdark · Wandering Minotaur bearer · 160,-147 · actor_loot | reference / actor |
| 19 | Assassin's Touch | Shattered Sanctum · Sazza’s meeting with Minthara · 333,41 · quest_reward | reference / actor |
| 23 | Bloodguzzler Garb | Underdark · Roaming Bulette · encounter navigation · 120,-175 · actor_loot | reference / encounter |
| 27 | Boots of Speed | Ebonlake Grotto · Thulla’s refuge · 82,-97 · quest_reward; Ebonlake Grotto · Thulla’s refuge · 82,-97 · steal; Ebonlake Grotto · Thulla · corpse or slain spore-servant inventory · 82,-97 · actor_loot; Grymforge · Thrinn · retrieve previously returned boots · -628,320 · actor_loot | reference / actor; reference / actor; reference / actor; reference / actor |
| 28 | Boots of Stormy Clamour | Ebonlake Grotto · Blurg’s summon/interaction point · 111,-89 · purchase | reference / interaction |
| 29 | Boots of Striding | Shattered Sanctum · Minthara’s area · carried gear · 335,43 · actor_loot | reference / actor |
| 33 | Bracing Band | Grymforge · Thrinn · return the missing boots · -628,320 · quest_reward | reference / actor |
| 43 | Champion's Chain | Ebonlake Grotto · Sovereign Glut · after becoming sovereign · 58,-110 · quest_reward | reference / actor |
| 46 | Circlet of Psionic Revenge | Crèche Y'llek · Inquisitor’s Chamber · carried circlet · 1392,-752 · actor_loot | reference / actor |
| 47 | Club of Hill Giant Strength | Arcane Tower · Top floor · break the genuine magical stool · -26,-272 · world | exact / interaction |
| 48 | Corellon's Grace | The Hollow · Ethel’s shop in the Hollow · 192,546 · purchase; Riverside Teahouse · Ethel’s Riverside Teahouse shop · -58,263 · purchase | reference / actor; reference / actor |
| 49 | Corrosive Flail | Ebonlake Grotto · Derryth’s shop · navigation reference · 55,-93 · purchase | reference / location |
| 50 | Creation's Echo | Ebonlake Grotto · Blurg’s summon/interaction point · 111,-89 · purchase | reference / interaction |
| 54 | Dark Justiciar Mail | Grymforge · Skeleton north of the Grymforge waypoint · -655,424 · actor_loot; Grymforge · Skeleton south of Ancient Forge · -609,-246 · actor_loot | reference / corpse; reference / corpse |
| 55 | Dark Justiciar Mask | Abandoned Refuge · Skeleton near Ancient Forge · Act 1 · -606,282 · actor_loot; Ruined Battlefield · Beside a skeleton · Act 2 · -35,-88 · actor_loot | exact / corpse; exact / corpse |
| 56 | Deep Delver | Grymforge · Brithvar’s encounter area · -631,326 · actor_loot | reference / actor |
| 63 | Envoy's Amulet | Ebonlake Grotto · Sovereign Spaw · deliver Nere’s head · 79,-106 · quest_reward | reference / actor |
| 66 | Exterminator's Axe | Decrepit Village · Gekh Coal’s encampment · 14,-196 · actor_loot | reference / actor |
| 71 | Gandrel's Aspiration | Sunlit Wetlands · Gandrel’s Act 1 encounter · -26,238 · actor_loot | reference / actor |
| 83 | Gloves of Thievery | Zhentarim Basement · Brem’s unlocked special stock · 295,-250 · purchase | reference / actor |
| 96 | Herbalist's Gloves | Ebonlake Grotto · Derryth’s shop · navigation reference · 55,-93 · purchase | reference / location |
| 102 | Intransigent Warhammer | Grymforge · First voyage · watertight chest on the duergar skiff · -447,-525 · container | exact / container |
| 110 | Linebreaker Boots | Worg Pens · Zurk’s Worg Pens area · 379,-39 · actor_loot | reference / actor |
| 124 | Pearl of Power Amulet | Ebonlake Grotto · Blurg’s summon/interaction point · 111,-89 · purchase | reference / interaction |
| 132 | Ring of Absolute Force | Grymforge · Thrinn’s area · carried ring · -628,320 · actor_loot | reference / actor |
| 135 | Ring of Elemental Infusion | Crèche Y'llek · Umr’a’ac’s crèche encounter · 1303,-798 · actor_loot | reference / actor |
| 138 | Ring of Jumping | Ebonlake Grotto · Derryth’s shop · navigation reference · 55,-93 · purchase | reference / location |
| 143 | Ring of Salving | Ebonlake Grotto · Blurg’s summon/interaction point · 111,-89 · purchase | reference / interaction |
| 148 | Rupturing Blade | Zhentarim Basement · Brem’s unlocked special stock · 295,-250 · purchase | reference / actor |
| 153 | Shattered Flail | The Risen Road · Flind’s moving encounter · 33,597 · actor_loot | reference / actor |
| 162 | Soulbreaker Greatsword | Crèche Y'llek · Therezzyn’s chamber · 1408,-763 · actor_loot | reference / actor |
| 165 | Spidersilk Armour | Shattered Sanctum · Minthara’s area · carried gear · 335,43 · actor_loot | reference / encounter |
| 179 | Sword of Justice | Risen Road Toll House · Anders · toll house · 110,560 · actor_loot; Risen Road Toll House · Anders · toll house · 110,560 · quest_reward | reference / actor; reference / actor |
| 184 | The Blast Pendant | Underdark · Petrified battlefield · Dhourn encounter · 121,-245 · actor_loot | reference / actor |
| 190 | The Jolty Vest | Zhentarim Basement · Brem’s unlocked special stock · 295,-250 · purchase | reference / actor |
| 195 | The Shadespell Circlet | Ebonlake Grotto · Blurg’s summon/interaction point · 111,-89 · purchase | reference / interaction |
| 199 | The Sparky Points | Waukeen's Rest · Counsellor Florrick · rescue and choose this weapon · -63,600 · quest_reward | reference / actor |
| 200 | The Spectator Eyes | Underdark · Petrified Battlefield · encounter reference · 112,-249 · actor_loot | reference / encounter |
| 210 | Very Heavy Greataxe | Blighted Village · Fezzerk at the windmill · Act 1 · 10,420 · actor_loot; Moonrise Towers · Fezzerk on the main floor · Act 2 if available · -152,-191 · actor_loot | reference / actor; reference / actor |
| 213 | Wapira's Crown | Secluded Chamber · Zevlor · accept the reward package · -53,67 · quest_reward | reference / actor |
| 214 | Warped Headband of Intellect | Blighted Village · Lump’s village encounter · 13,366 · actor_loot; Dynamic Act 1 encounter · Where Lump is summoned · Act 1 · no fixed X/Y · actor_loot | reference / actor; Exception / none |
| 218 | Wood Woad Shield | Decrepit Sanctuary · Decrepit Sanctuary · one shield-bearing Wood Woad · 85,212 · actor_loot | reference / encounter |
| 220 | Xyanyde | Shattered Sanctum · Minthara’s area · carried gear · 335,43 · actor_loot | reference / actor |

## Exceptions, discrepancies and decomposition

- The implementation brief explicitly supersedes the older planning estimate for Dark Justiciar Mask: both documented corpse points are **Exact**, with separate Act 1/2 contexts. The Spectator Eyes and Wood Woad Shield use the explicitly approved **encounter** role. No coordinates or identity sets were changed from the plan.
- Derryth: display **55,-93**, retain item-page **-55,-93** and the positive-X Hail of Thorns source pin as explicit evidence. Never silently change a sign. No Hail of Thorns enrichment entry is added.
- Omeluum: display **111,-89** as Blurg’s summon/interaction navigation reference, not a permanent Omeluum position. Retain **144,29** item-page evidence and the parasite-investigation trade gate. Ring of Salving is never bound to the historical Ring of Restorative Gravity.
- Bloodguzzler: one Bulette route with two displayed encounter references. Schema 2 requires the primary point for Reference state: **120,-175** is that point; **160,-150** is an additional `navigationPoints` entry. This avoids duplicating the first point in the UI or inventing two item copies. Neither point is a guaranteed corpse position.
- Boots of Speed: four separate routes (reward, specific dialogue theft, corpse/slain spore-servant loot, retrieval from Thrinn after returning). Thulla **82,-97** retains actor **87,-95** and quest **83,-97**; Thrinn **-628,320** retains **-643,300**. These remain references rather than exact corpse claims.
- Dark Justiciar Mail preserves both **-655,424** and **-609,-246**, including the second negative Y. Dark Justiciar Mask preserves **-606,282** in Act 1 and **-35,-88** in Act 2 without asserting a presumed skeleton’s personal identity.
- Lump: village reference **13,366** and a separate dynamic summoned route with explicit null coordinates plus a sourced `not_applicable` reason. This is a supported Exception, not Pending/unresolved. The headband is carried in his gut, not worn.
- Brithvar **-631,326** retains **-624,355**; Therezzyn **1408,-763** retains **1409,-765**; Jeera **1380,-798** retains **1387,-821** and remains loot rather than purchase. Spidersilk’s own page lacks X/Y: **335,43** is a corroborated encounter reference from Minthara gear.
- Genuine magical stool and first-crossing skiff subjects remain explicit. The ordinary replacement stool is not substituted. Woad shield belongs to one bearer; Spectator/Flind references are not guaranteed death positions.
- Quest/merchant gates remain canonical facts: Sazza escort; Glut versus Spaw sovereign branches; Thrinn reward alternatives; Zarys-unlocked special stock; Florrick’s mutually exclusive weapon selection; Zevlor’s accepted reward package; separate Anders loot versus Karlach-kill reward. Ethel’s two purchase venues and Fezzerk’s Act 1/2 contexts remain distinct, without a guaranteed second copy.

## Verification architecture

The single table supplies independent complete identities, coordinates/states/roles, conditions, route counts, display groups and pinned evidence. Generic tests exercise production validator/resolver, actual Full desktop/mobile rendering, protected-mode zero-DOM behavior, deterministic live/offline bundles, cached ingestion and v5/v6 Story-isolated import/export. Historical 4A assertions scope to its frozen checkpoint while still requiring the exact old objects to survive. Shared native interaction/late-hydration QA is reused; new screenshots are limited to the approved representative 4B cases.

Catalogue remains 556 source rows / 555 unique items; all 555 progress keys, Vendor 63/50/67, Loot 131/94/125, Quest 25/0/0, both Graceful Cloth identities and Battlemage sourceRow 54 remain unchanged. No renderer/schema/resolver/index.html/Story/progress/sync/PWA/transport/database/deployment changes. 4C and .lsv Phase B are not included.
