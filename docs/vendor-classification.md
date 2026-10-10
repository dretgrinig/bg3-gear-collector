# Reviewed Vendor classification

This is catalogue classification only. Item names, locations, effects, URLs,
progress keys, Story records and cloud protocols are unchanged. There is no
runtime enrichment request and no new storage key or cache migration.

## Identity and ingestion

`REVIEWED_VENDOR_DATA` in `index.html` contains immutable reviewed rows:
Act, catalogue name, game IDs, item source URLs and explicit fallback aliases.
Lookup uses Act-scoped game IDs first, reviewed item URLs second, and reviewed
Act/name aliases only when no stronger identity exists. IDs are the catalogue's
existing game identifiers, not progress revision fields. Unknown/malformed IDs
cannot fall through to a name. Unknown item URLs likewise fail closed.

Most fallback source URLs are shared Act-list pages; these have no item identity.
Only those explicit generic pages, or an absent source, permit name matching.
Sets protect prototype-sensitive names. URL normalization changes lookup keys
only. The original Shapeshifter Hat URL is a reviewed exact external alias;
foreign URLs are not generally accepted.

`acquisitionFor()` supplies independent Vendor, Quest/reward and Loot booleans
for filters and badges. Quest/reward retains the released acquisition-prose
predicate exactly; it may overlap Vendor. Loot remains neither Vendor nor Quest.
Vendor never derives from geography, arbitrary NPC mentions, descriptions,
effects or sale-language guessing.

`normalizeFallback()` retains reviewed structured acquisition classification.
Fallback Yes/No flags were audit candidates, not unconditional authority.
`setDB()` recomputes classification on copied items, ignoring stale stored flags.
This repairs fresh downloads, old normalized caches, failed-refresh cache
fallback and offline snapshots without rewriting their text or clearing storage.

## Reviewed baseline (2026-10-10)

The unchanged 556-row public catalogue is pinned in
`tests/fixtures/vendor-catalogue.json`. Exact expected membership is pinned
separately in `tests/fixtures/vendor-membership.json`.

| Act | Catalogue rows | Reviewed remote Vendors | Reviewed fallback Vendors |
| --- | ---: | ---: | ---: |
| 1 | 219 | 63 | 49 |
| 2 | 145 | 50 | 45 |
| 3 | 192 | 67 | 55 |

Act 1 remote membership is the exact pre-fix 63-item compatibility baseline,
including every existing game ID and item URL. It is intentionally not expanded
by new research. Fallback metadata was reconciled against that set and reviewed
item acquisition sections. All 145 Act 2 and 192 Act 3 item acquisition pages
were checked. Additional remote vendors beyond the matching fallback candidates
are included; fallback flags alone are not the expected counts.

The raw catalogue source is
[RobzBE/bg3wikitool items.json](https://raw.githubusercontent.com/RobzBE/bg3wikitool/refs/heads/main/Data/items.json).
The Act 2/3 acquisition review uses the item-specific bg3.wiki pages listed below.
Only classification identifiers are shipped; new NPC names, conditions or quest
information are not added to the application's UI.

## Reconciliation exceptions

- [Hoppy](https://bg3.wiki/wiki/Hoppy) is a verified fallback-only Vendor.
- [The Graceful Cloth](https://bg3.wiki/wiki/The_Graceful_Cloth) uses the explicit
  Act 1 fallback alias for the Esther variant. The shared Act 2 identity is not
  classified as Vendor: its historical Araj sale was removed.
- [Shining Staver-of-Skulls](https://bg3.wiki/wiki/Shining_Staver-of-Skulls) is
  Vendor-capable despite the fallback No flag. Its raw acquisition text is kept.
- [Amulet of Branding](https://bg3.wiki/wiki/Amulet_of_Branding) remains negative;
  the old fallback false positive came from the words “Crèche merchant”.
- [Harmonic Dueller](https://bg3.wiki/wiki/Harmonic_Dueller) is Vendor-capable;
  the invented fallback “Harmonic Dueller (Sharess)” alias is not admitted.
- [Dolor Amarus](https://bg3.wiki/wiki/Dolor_Amarus) supports purchase as an
  acquisition alternative. Both reviewed fallback aliases classify consistently,
  including the row whose original text describes another acquisition route.
- [Devotee's Mace](https://bg3.wiki/wiki/Devotee%27s_Mace) is not a Vendor merely
  because it can be transferred between party members.
- [Voss' Silver Sword](https://bg3.wiki/wiki/Voss%27_Silver_Sword) and
  [Blood-Bound Blade](https://bg3.wiki/wiki/Blood-Bound_Blade) are not admitted on
  historical or unavailable purchase evidence.

## Spoiler and maintenance boundaries

Minimal/Light still suspend source filters and acquisition search. Vendor/Quest
badges remain inside intentional spoiler details; options, active-filter counts
and suspension notices do not expose classification or NPC names. Full uses the
same lookup on desktop and mobile.

Future catalogue additions remain unclassified as Vendor until reviewed. Update
identifiers and independent expected membership together with real-data tests.
Availability conditions are not modeled here. This fix identifies documented
Vendor-capable items, not whether a vendor is currently available in a playthrough.

## Act 2/3 item-source review index

### ACT 2

- [Acrobat Shoes](https://bg3.wiki/wiki/Acrobat_Shoes)
- [Amulet of the Harpers](https://bg3.wiki/wiki/Amulet_of_the_Harpers)
- [Armour of Devotion](https://bg3.wiki/wiki/Armour_of_Devotion)
- [Barkskin Armour](https://bg3.wiki/wiki/Barkskin_Armour)
- [Bigboy's Chew Toy](https://bg3.wiki/wiki/Bigboy%27s_Chew_Toy)
- [Boots of Arcane Bolstering](https://bg3.wiki/wiki/Boots_of_Arcane_Bolstering)
- [Charge-Bound Warhammer](https://bg3.wiki/wiki/Charge-Bound_Warhammer)
- [Cindersnap Gloves](https://bg3.wiki/wiki/Cindersnap_Gloves)
- [Circlet of Hunting](https://bg3.wiki/wiki/Circlet_of_Hunting)
- [Cloak of Cunning Brume](https://bg3.wiki/wiki/Cloak_of_Cunning_Brume)
- [Cloak of Protection](https://bg3.wiki/wiki/Cloak_of_Protection)
- [Darkfire Shortbow](https://bg3.wiki/wiki/Darkfire_Shortbow)
- [Defender Greataxe](https://bg3.wiki/wiki/Defender_Greataxe)
- [Drakethroat Glaive](https://bg3.wiki/wiki/Drakethroat_Glaive)
- [Dwarven Splintmail](https://bg3.wiki/wiki/Dwarven_Splintmail)
- [Enraging Heart Garb](https://bg3.wiki/wiki/Enraging_Heart_Garb)
- [Evasive Shoes](https://bg3.wiki/wiki/Evasive_Shoes)
- [Fistbreaker Helm](https://bg3.wiki/wiki/Fistbreaker_Helm)
- [Gauntlets of Surging Accuracy](https://bg3.wiki/wiki/Gauntlets_of_Surging_Accuracy)
- [Gloves of Crushing](https://bg3.wiki/wiki/Gloves_of_Crushing)
- [Gloves of the Automaton](https://bg3.wiki/wiki/Gloves_of_the_Automaton)
- [Gloves of the Balanced Hands](https://bg3.wiki/wiki/Gloves_of_the_Balanced_Hands)
- [Gloves of The Duellist](https://bg3.wiki/wiki/Gloves_of_The_Duellist)
- [Halberd of Vigilance](https://bg3.wiki/wiki/Halberd_of_Vigilance)
- [Harmonium Halberd](https://bg3.wiki/wiki/Harmonium_Halberd)
- [Hat of Storm Scion's Power](https://bg3.wiki/wiki/Hat_of_Storm_Scion%27s_Power)
- [Hat of Uninhibited Kushigo](https://bg3.wiki/wiki/Hat_of_Uninhibited_Kushigo)
- [Incandescent Staff](https://bg3.wiki/wiki/Incandescent_Staff)
- [Marksmanship Hat](https://bg3.wiki/wiki/Marksmanship_Hat)
- [Ne'er Misser](https://bg3.wiki/wiki/Ne%27er_Misser)
- [Obsidian Laced Robe](https://bg3.wiki/wiki/Obsidian_Laced_Robe)
- [Render of Mind and Body](https://bg3.wiki/wiki/Render_of_Mind_and_Body)
- [Ring of Free Action](https://bg3.wiki/wiki/Ring_of_Free_Action)
- [Ring of Geniality](https://bg3.wiki/wiki/Ring_of_Geniality)
- [Ring of Spiteful Thunder](https://bg3.wiki/wiki/Ring_of_Spiteful_Thunder)
- [Risky Ring](https://bg3.wiki/wiki/Risky_Ring)
- [Robe of Exquisite Focus](https://bg3.wiki/wiki/Robe_of_Exquisite_Focus)
- [Sentinel Shield](https://bg3.wiki/wiki/Sentinel_Shield)
- [Shadeclinger Armour](https://bg3.wiki/wiki/Shadeclinger_Armour)
- [Sharpened Snare Cuirass](https://bg3.wiki/wiki/Sharpened_Snare_Cuirass)
- [Shield of Devotion](https://bg3.wiki/wiki/Shield_of_Devotion)
- [Slicing Shortsword](https://bg3.wiki/wiki/Slicing_Shortsword)
- [Sword of Clutching Umbra](https://bg3.wiki/wiki/Sword_of_Clutching_Umbra)
- [Sword of Life Stealing](https://bg3.wiki/wiki/Sword_of_Life_Stealing)
- [Swordmaster Gloves](https://bg3.wiki/wiki/Swordmaster_Gloves)
- [The Mighty Cloth](https://bg3.wiki/wiki/The_Mighty_Cloth)
- [Thermodynamo Axe](https://bg3.wiki/wiki/Thermodynamo_Axe)
- [Thorn Blade](https://bg3.wiki/wiki/Thorn_Blade)
- [Thunderskin Cloak](https://bg3.wiki/wiki/Thunderskin_Cloak)
- [Yuan-Ti Scale Mail](https://bg3.wiki/wiki/Yuan-Ti_Scale_Mail)

### ACT 3

- [Ambusher](https://bg3.wiki/wiki/Ambusher)
- [Amulet of the Drunkard](https://bg3.wiki/wiki/Amulet_of_the_Drunkard)
- [Armour of Agility](https://bg3.wiki/wiki/Armour_of_Agility)
- [Armour of Landfall](https://bg3.wiki/wiki/Armour_of_Landfall)
- [Armour of Moonbasking](https://bg3.wiki/wiki/Armour_of_Moonbasking)
- [Armour of Persistence](https://bg3.wiki/wiki/Armour_of_Persistence)
- [Armour of the Sporekeeper](https://bg3.wiki/wiki/Armour_of_the_Sporekeeper)
- [Assassin of Bhaal Cowl](https://bg3.wiki/wiki/Assassin_of_Bhaal_Cowl)
- [Bhaalist Armour](https://bg3.wiki/wiki/Bhaalist_Armour)
- [Bhaalist Gloves](https://bg3.wiki/wiki/Bhaalist_Gloves)
- [Birthright](https://bg3.wiki/wiki/Birthright)
- [Blightbringer](https://bg3.wiki/wiki/Blightbringer)
- [Bonespike Garb](https://bg3.wiki/wiki/Bonespike_Garb)
- [Bonespike Helmet](https://bg3.wiki/wiki/Bonespike_Helmet)
- [Boots of Persistence](https://bg3.wiki/wiki/Boots_of_Persistence)
- [Caitiff Staff](https://bg3.wiki/wiki/Caitiff_Staff)
- [Cloak of Displacement](https://bg3.wiki/wiki/Cloak_of_Displacement)
- [Cloak of the Weave](https://bg3.wiki/wiki/Cloak_of_the_Weave)
- [Cold Snap](https://bg3.wiki/wiki/Cold_Snap)
- [Corvid Token](https://bg3.wiki/wiki/Corvid_Token)
- [Craterflesh Gloves](https://bg3.wiki/wiki/Craterflesh_Gloves)
- [Dark Displacement Gloves](https://bg3.wiki/wiki/Dark_Displacement_Gloves)
- [Dolor Amarus](https://bg3.wiki/wiki/Dolor_Amarus)
- [Dostrealt's Piccolo](https://bg3.wiki/wiki/Dostrealt%27s_Piccolo)
- [Dread Iron Dagger](https://bg3.wiki/wiki/Dread_Iron_Dagger)
- [Drunken Cloth](https://bg3.wiki/wiki/Drunken_Cloth)
- [Dwarven Thrower](https://bg3.wiki/wiki/Dwarven_Thrower)
- [Elven Chain](https://bg3.wiki/wiki/Elven_Chain)
- [Falataeric Cli Lyre](https://bg3.wiki/wiki/Falataeric_Cli_Lyre)
- [Flail of Ages](https://bg3.wiki/wiki/Flail_of_Ages)
- [Fleshrender](https://bg3.wiki/wiki/Fleshrender)
- [Garb of the Land and Sky](https://bg3.wiki/wiki/Garb_of_the_Land_and_Sky)
- [Gauntlets of the Warmaster](https://bg3.wiki/wiki/Gauntlets_of_the_Warmaster)
- [Gemini Gloves](https://bg3.wiki/wiki/Gemini_Gloves)
- [Gibus of the Worshipful Servant](https://bg3.wiki/wiki/Gibus_of_the_Worshipful_Servant)
- [Glimmergad's Selgaunt Fiddle](https://bg3.wiki/wiki/Glimmergad%27s_Selgaunt_Fiddle)
- [Harmonic Dueller](https://bg3.wiki/wiki/Harmonic_Dueller)
- [Harper Sacredstriker](https://bg3.wiki/wiki/Harper_Sacredstriker)
- [Hat of the Sharp Caster](https://bg3.wiki/wiki/Hat_of_the_Sharp_Caster)
- [Hellbeard Halberd](https://bg3.wiki/wiki/Hellbeard_Halberd)
- [Hellrider Longbow](https://bg3.wiki/wiki/Hellrider_Longbow)
- [Hood of the Weave](https://bg3.wiki/wiki/Hood_of_the_Weave)
- [Horns of the Berserker](https://bg3.wiki/wiki/Horns_of_the_Berserker)
- [Kiam Goda's Kilat Drum](https://bg3.wiki/wiki/Kiam_Goda%27s_Kilat_Drum)
- [Legacy of the Masters](https://bg3.wiki/wiki/Legacy_of_the_Masters)
- [Mantle of the Holy Warrior](https://bg3.wiki/wiki/Mantle_of_the_Holy_Warrior)
- [Martial Exertion Gloves](https://bg3.wiki/wiki/Martial_Exertion_Gloves)
- [Nimblefinger Gloves](https://bg3.wiki/wiki/Nimblefinger_Gloves)
- [Nymph Cloak](https://bg3.wiki/wiki/Nymph_Cloak)
- [Quickspell Gloves](https://bg3.wiki/wiki/Quickspell_Gloves)
- [Ring Of Regeneration](https://bg3.wiki/wiki/Ring_of_Regeneration)
- [Robe of Supreme Defences](https://bg3.wiki/wiki/Robe_of_Supreme_Defences)
- [Scabby Pugilist Circlet](https://bg3.wiki/wiki/Scabby_Pugilist_Circlet)
- [Sethan](https://bg3.wiki/wiki/Sethan)
- [Shade-Slayer Cloak](https://bg3.wiki/wiki/Shade-Slayer_Cloak)
- [Shapeshifter Hat](https://bg3.wiki/wiki/Shapeshifter_Hat)
- [Slinging Shoes](https://bg3.wiki/wiki/Slinging_Shoes)
- [Snow-Dusted Monastery Gloves](https://bg3.wiki/wiki/Snow-Dusted_Monastery_Gloves)
- [Spellseeking Gloves](https://bg3.wiki/wiki/Spellseeking_Gloves)
- [Stalker Gloves](https://bg3.wiki/wiki/Stalker_Gloves)
- [Stolyarof's Table Lute](https://bg3.wiki/wiki/Stolyarof%27s_Table_Lute)
- [Swires' Sledboard](https://bg3.wiki/wiki/Swires%27_Sledboard)
- [The Dancing Breeze](https://bg3.wiki/wiki/The_Dancing_Breeze)
- [The Dead Shot](https://bg3.wiki/wiki/The_Dead_Shot)
- [The Reviving Hands](https://bg3.wiki/wiki/The_Reviving_Hands)
- [The Sacred Star](https://bg3.wiki/wiki/The_Sacred_Star)
- [Thunderpalm Strikers](https://bg3.wiki/wiki/Thunderpalm_Strikers)
- [Unwanted Masterwork Scalemail](https://bg3.wiki/wiki/Unwanted_Masterwork_Scalemail)
- [Veil of the Morning](https://bg3.wiki/wiki/Veil_of_the_Morning)
- [Vest of Soul Rejuvenation](https://bg3.wiki/wiki/Vest_of_Soul_Rejuvenation)
- [Vicious Battleaxe](https://bg3.wiki/wiki/Vicious_Battleaxe)
- [Vicious Shortbow](https://bg3.wiki/wiki/Vicious_Shortbow)

