# Full Details coordinate backfill

This checkpoint resolves the 36 coordinate-null routes in the existing 40-entry acquisition dataset. It does not expand the other 515 catalogue items. Schema becomes **2**, dataset **2.0.0-full-details-coordinate-contract**; all **40 entry IDs / 41 binding IDs / 58 route IDs** remain unchanged. Rich route facts, conditions, notes, validity, review records and original source references are preserved.

## Result and coordinate meaning

- **22 exact acquisition points:** the previously approved XY/space values are unchanged.
- **31 reviewed navigation/reference points:** all previously null fixed-location routes receive an explicitly typed reference point.
- **5 explicit not-applicable routes:** fixed acquisition coordinates do not describe the finished-item acquisition.
- **0 pending, conflict or not-documented routes** in this bounded checkpoint.
- **5 separate component navigation points**, attached only to the two inventory-assembly routes. These do not become finished-item coordinates or new acquisition routes.

`coordinateReview` is independent of editorial entry `coverage` and of route availability `validity`. A reference is an intentionally useful source-backed destination, not a promise that an actor or loose item remains at those exact coordinates. Four original schema-1 `actor` roles now become `corpse`: Shortsword of First Blood, the fallen-corpse Poisoner's Robe route, and the two Fetish corpse methods. Their XY/space values and identities are unchanged; schema 1 lacked the corpse role.

## Primary-source verification

Project `sources/` contained no Wiki material. Public BG3 Wiki revision bodies were therefore retrieved on **2026-10-14** with read-only `GET /w/api.php?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main`. Item acquisition fields were checked against each route's actor/method/map, rather than treating a coordinate found anywhere on the page as interchangeable evidence. Current revision IDs and actual revision bodies were available together. Existing permanent source pins remain intact; relevant additional source sections are appended where needed.

Twenty-seven backfills use the corresponding item page's acquisition reference. The two Brathwen references use his own encounter point **(-608, 404)**, not the gnome corpse **(-610, 408)**. Hamarhraft's loose-item route uses the old chest position as **former_container**, not an invented loose-item position. Dolor's boutique route uses the building's sole entrance **(-181, -31)** in **Lower City**, not the festival coordinates or an exact interior actor position.

Nearby or conflicting exact-subject coordinates were not averaged or silently substituted. In particular, Esther's camp, Jeera's trade area, the forge area, and Sussur's cellar point are navigation references, rather than exact actor/crafting-station claims. Bracers uses the item page's published chest reference with reference semantics; the older one-unit source discrepancy is not converted into a claim of precise agreement.

## Backfilled reference points

| Catalogue item / methods | X | Y | Scene | Reference role |
| --- | ---: | ---: | --- | --- |
| Armour of Devotion (purchase) | -174 | -179 | Moonrise Towers | `encounter` |
| Helldusk Armour (actor_loot) | -6477 | 2884 | House of Hope | `encounter` |
| Dolor Amarus (drop) | 20 | -34 | Highberry's Home | `encounter` |
| Dolor Amarus (drop) | -181 | -31 | Lower City | `entrance` |
| Dolor Amarus (purchase) | -1263 | 511 | Murder Tribunal | `actor` |
| Adamantine Longsword (craft) | -558 | 230 | Adamantine Forge | `location` |
| The Graceful Cloth (Esther) (purchase) | -43 | -129 | Rosymorn Monastery Trail | `location` |
| Periapt of Wound Closure (purchase) | -43 | -129 | Rosymorn Monastery Trail | `location` |
| Bracers of Defence (container) | -656 | -370 | Apothecary's Cellar | `container` |
| Gloves of Power (actor_loot) | 208 | 427 | Emerald Grove | `encounter` |
| Faithbreaker (actor_loot) | 297 | 40 | Shattered Sanctum | `encounter` |
| Caustic Band (purchase) | -55 | -93 | Ebonlake Grotto | `actor` |
| Knife of the Undermountain King (purchase) | 1380 | -798 | Crèche Y'llek | `location` |
| Adamantine Shield (craft) | -558 | 230 | Adamantine Forge | `location` |
| Sussur Greatsword (craft) | -477 | -378 | Blighted Village | `location` |
| Grymskull Helm (actor_loot) | -558 | 230 | Adamantine Forge | `encounter` |
| Poisoner's Robe (actor_loot) | -569 | -359 | Whispering Depths | `encounter` |
| Light of Creation (drop, disarm) | -38 | -284 | Arcane Tower | `encounter` |
| Fetish of Callarduran Smoothhands (purchase, drop) | -608 | 404 | Grymforge | `encounter` |
| Crusher's Ring (drop, steal) | -70 | 439 | Goblin Camp | `encounter` |
| Everburn Blade (drop, disarm) | -53 | -391 | Nautiloid | `encounter` |
| Varsh Ko'kuu's Boots (gift, actor_loot) | 1288 | -759 | Crèche Y'llek | `encounter` |
| Hamarhraft (world) | -85 | 631 | Waukeen's Rest | `former_container` |
| Ritual Dagger (actor_loot) | 338 | -26 | Shattered Sanctum | `location` |
| Guiding Light (gift, drop) | -26 | -283 | Arcane Tower | `encounter` |

The underlying route alternatives remain separate even when they share geography. Phalar retains three interactions, Dolor retains its two drops and conditional purchase, Fetish retains four methods, Hellrider's Pride retains four methods, and Light of Creation retains drop/disarm. Geometry grouping in presentation must never merge their availability or methods.

## Explicit exceptions

| Item | Review state | Reason |
| --- | --- | --- |
| Blazer of Benevolence | `not_applicable` | Rewarded at camp; location varies. |
| Devotee's Mace | `not_applicable` | Created by an ability; no fixed map point. |
| The Graceful Cloth (Araj) | `not_applicable` | Historical stock; no longer available. |
| Mourning Frost | `not_applicable` | Assembled in inventory; component locations below. |
| Vision of the Absolute | `not_applicable` | Assembled in inventory; component locations below. |

Blazer's item page and the Campsite `Instances` section support the camp reward and variable layout. Devotee's item/ability sources support creation on the caster. The two assembly recipes combine components in one character's inventory. The Graceful Cloth's Notes document removal of Araj's stock in Patch 4; Esther's current route remains distinct. No coordinates from another route or Act are assigned to these exceptions.

## Component navigation, distinct from assembly

| Finished item | Component / reference | X | Y | Scene | Role |
| --- | --- | ---: | ---: | --- | --- |
| Mourning Frost | Icy Crystal — Sussur Tree waypoint | -50 | -138 | Underdark | `location` |
| Mourning Frost | Icy Helve — Selûnite Outpost waypoint | 176 | -235 | Underdark | `location` |
| Mourning Frost | Icy Metal | 49 | -72 | Ebonlake Grotto | `component` |
| Vision of the Absolute | Shaft of a Broken Spear | 136 | 446 | Forest | `component` |
| Vision of the Absolute | Head of a Broken Spear — Owlbear Nest entrance | 82 | 450 | Wilderness | `entrance` |

The Icy Crystal and Icy Helve pages identify their carriers; Filro/Dhourn identify their associated locations. Dread Hollow and Selûnite Outpost provide the labelled waypoint anchors. Those waypoint references are **location** points, not exact actor/component positions. Icy Metal and Shaft of a Broken Spear use their own component-page coordinates. The Head of a Broken Spear points to the explicitly labelled Owlbear Nest entrance, supported by the component and location pages, not an exact moving-owlbear position.

Each navigation point carries its own primary source list. The finished-item `coordinates` remains null with `not_applicable`; component locations do not imply an Act restriction or fixed assembly site. Acquiring either recipe does not invent a player-kill prerequisite.

## Protected identities and verification

The exact Act, compatibility progress key, complete game-ID set and Wiki binding remain unchanged. Schema 1 retains its strict legacy contract; schema 2 adds explicit coordinate review and navigation references without Story/progress/cache/database migration. Vendor/Loot/Quest compatibility classifiers do not consume this enrichment.

The permanent `tests/acquisition-coordinate-backfill.test.cjs` declares all 36 literal route expectations, counts, exception reasons, special-subject references, component labels and four corpse-role corrections. Its preservation checks compare every original rich field and source prefix to fixed commit `74df6103ab836542b4516910bd83b50b35ea232d`, preserving all original XY/space values. Checkpoint 1A/1B/1C tests retain their historical facts while explicitly allowing this tested coordinate checkpoint and compact presentation.

Tests-first result: **42 failed / 1 passed** before canonical data changed. The completed permanent backfill suite contains **44 tests**, including the additional explicit corpse-role correction regression. Full-suite and browser results are reported with the integration checkpoint.

Expected tracker invariants remain **556 source rows -> 555 items / 555 progress keys**, Vendor **63/50/67**, Loot **131/94/125**, Quest **25/0/0**. The existing 40 catalogue matches and one additional Gloves of Heroism fallback binding remain the complete enrichment scope.
