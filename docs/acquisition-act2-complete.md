# Complete Act 2 acquisition checkpoint

Schema 2 · dataset `2.7.0-act2.complete` · approved Work plan, reviewed 2026-10-17.

## Reconciliation

- 145 raw Act 2 rows → 144 unique catalogue identities; two previously bound, 142 new.
- New: 142 entries / 142 bindings / 221 routes. Three existing entries gain six continuation routes. No duplicate identities.
- Added routes: 50 Exact / 120 Reference / 57 coordinate Exceptions / zero new Pending or conflicts.
- Post-checkpoint: 366 entries / 367 bindings / 526 routes; Act 1 219/219, Act 2 144/144, Act 3 unchanged at three bound identities.
- Blood-Bound Blade is a separate entry-level unavailability Exception, with zero fabricated routes and no Full acquisition DOM.
- Existing Staff of Arcane Blessing coordinate conflict remains unresolved with null X/Y.

## Evidence and review boundaries

Facts come from the previously approved complete Act 2 research plan. Source URLs pin the inspected Wiki revisions; current pages and their published coordinates were inspected. No historical revision body is claimed beyond the recorded inspected revisions. The independent fixture retains all published-coordinate discrepancies, source sections, identity notes and availability decisions. No broad re-research was performed during implementation.

No schema, resolver, renderer or integration changes. No new Act 3 identities. Cross-Act continuations are conditional venues, never promises of another copy.

- **Blood-Bound Blade**: Known current unavailability, entry-level Exception with zero fabricated routes. No historical acquisition has been established.
- **Shar’s Spear of Evening**: Original curly-apostrophe Wiki page is missing. Preserve original empty-ID binding guard; use explicit reviewed ASCII-apostrophe evidence. Existing outbound catalogue link remains a separate pre-existing link-quality issue; no fuzzy matching or ID injection.
- **Raven Gloves**: Known reward path included; failed-roll narrative does not explicitly identify the gloves, so that optional branch is not asserted. Entry coverage partial.
- **Hellfire Hand Crossbow**: Known Act 2 bearer route included. Vague contract-reward wording and Yurgir reappearance do not prove another crossbow copy. Those optional branches remain unasserted; entry coverage partial.

## Final factual-review corrections

- **Hat of Fire Acuity**: Both Strange Ox routes are carried loot (`actor_loot`) at Reference encounter points, not containers or fixed item/corpse points. Published X/Y, Act/map context, conditions and identities are preserved.
- **Coldbrim Hat**: The Act 3 Sorcerous Sundries table pickup is `world`, retaining its reviewed Reference/location point. The Act 2 locked-chest route is unchanged.

## Approved existing-entry additions

- act 2|armour of devotion: 2 appended routes; old bindings/route UUIDs and facts preserved.
- act 1|hunting shortbow: 2 appended routes; old bindings/route UUIDs and facts preserved.
- act 1|safeguard shield: 2 appended routes; old bindings/route UUIDs and facts preserved.

Five other Act 1 identities’ Act 3-only Roah gaps remain outside this Act 2 checkpoint; no independent Act 3 expansion is included.

## Independent implementation fixture

The fixture `tests/fixtures/acquisition-act2-complete.json` was authored from the approved plan before canonical additions, with UUIDs allocated once. It is the factual oracle for all 142 identities. Table below lists each exact catalogue row; the fixture supplies complete ID sets, evidence, coordinates, roles, conditions and discrepancies.

| sourceRow | Catalogue name | Routes | Coordinate states | Coverage |
|---:|---|---:|---|---|
| 2 | Absolute's Protector | 1 | reference | reviewed |
| 3 | Acrobat Shoes | 1 | reference | reviewed |
| 4 | Amulet of the Harpers | 3 | reference, not_applicable, not_applicable | reviewed |
| 6 | Assassin's Shortsword | 1 | exact | reviewed |
| 7 | Argument Solver | 1 | reference | reviewed |
| 8 | Barkskin Armour | 3 | reference, not_applicable, not_applicable | reviewed |
| 9 | Bided Time | 1 | exact | reviewed |
| 10 | Bigboy's Chew Toy | 1 | reference | reviewed |
| 11 | Blade of Oppressed Souls | 2 | reference, exact | reviewed |
| 12 | Blood-Bound Blade | 0 |  | partial |
| 13 | Boots of Apparent Death | 1 | exact | reviewed |
| 14 | Boots of Arcane Bolstering | 2 | reference, reference | reviewed |
| 15 | Boots of Brilliance | 2 | exact, not_applicable | reviewed |
| 16 | Braindrain Gloves | 1 | exact | reviewed |
| 17 | Browbeaten Circlet | 1 | exact | reviewed |
| 18 | Callous Glow Ring | 1 | exact | reviewed |
| 19 | Charge-Bound Warhammer | 1 | reference | reviewed |
| 20 | Cindersnap Gloves | 3 | reference, not_applicable, not_applicable | reviewed |
| 21 | Circle of Bones | 3 | reference, reference, reference | reviewed |
| 22 | Circlet of Hunting | 2 | reference, reference | reviewed |
| 23 | Circlet of Mental Anguish | 1 | exact | reviewed |
| 24 | Cloak of Cunning Brume | 1 | reference | reviewed |
| 25 | Cloak of Elemental Absorption | 1 | exact | reviewed |
| 26 | Cloak of Protection | 3 | reference, not_applicable, not_applicable | reviewed |
| 27 | Coldbrim Hat | 2 | exact, reference | reviewed |
| 28 | Coruscation Ring | 1 | exact | reviewed |
| 29 | Covert Cowl | 1 | reference | reviewed |
| 30 | Cruel Sting | 3 | reference, not_applicable, not_applicable | reviewed |
| 31 | Dark Justiciar Boots | 1 | reference | reviewed |
| 32 | Dark Justiciar Gauntlets (Rare) | 1 | reference | reviewed |
| 33 | Dark Justiciar Half-Plate (Very Rare) | 1 | reference | reviewed |
| 34 | Dark Justiciar Helmet | 1 | exact | reviewed |
| 35 | Darkfire Shortbow | 1 | reference | reviewed |
| 36 | Defender Greataxe | 3 | reference, not_applicable, not_applicable | reviewed |
| 37 | Derivation Cloak | 1 | exact | reviewed |
| 38 | Drakethroat Glaive | 3 | reference, not_applicable, not_applicable | reviewed |
| 39 | Dwarven Splintmail | 1 | reference | reviewed |
| 40 | Enraging Heart Garb | 1 | reference | reviewed |
| 41 | Evasive Shoes | 1 | reference | reviewed |
| 42 | Eversight Ring | 1 | exact | reviewed |
| 43 | Family Ring | 1 | exact | reviewed |
| 44 | Fireheart | 1 | exact | reviewed |
| 45 | Firzu's Ring of Trading | 1 | exact | reviewed |
| 46 | Fistbreaker Helm | 1 | reference | reviewed |
| 47 | Flawed Helldusk Armour | 2 | reference, reference | reviewed |
| 48 | Flawed Helldusk Gloves | 2 | reference, reference | reviewed |
| 49 | Flawed Helldusk Helmet | 2 | reference, reference | reviewed |
| 50 | Fleshmelter Cloak | 1 | exact | reviewed |
| 51 | Frost Prince | 1 | exact | reviewed |
| 52 | Gauntlets of Surging Accuracy | 1 | reference | reviewed |
| 53 | Gloomstrand Shield | 1 | exact | reviewed |
| 54 | Gloves of Battlemage's Power | 1 | exact | reviewed |
| 55 | Gloves of Crushing | 3 | reference, not_applicable, not_applicable | reviewed |
| 56 | Gloves of the Automaton | 1 | reference | reviewed |
| 57 | Gloves of the Balanced Hands | 3 | reference, not_applicable, not_applicable | reviewed |
| 59 | Gloves of The Duellist | 1 | reference | reviewed |
| 60 | Halberd of Vigilance | 1 | reference | reviewed |
| 61 | Hammergrim Mist Amulet | 1 | exact | reviewed |
| 62 | Harmonium Halberd | 1 | reference | reviewed |
| 63 | Hat of Fire Acuity | 2 | reference, reference | reviewed |
| 64 | Hat of Storm Scion's Power | 2 | reference, reference | reviewed |
| 65 | Hat of Uninhibited Kushigo | 3 | reference, not_applicable, not_applicable | reviewed |
| 66 | Hellfire Hand Crossbow | 1 | reference | partial |
| 67 | Helmet of Arcane Acuity | 1 | exact | reviewed |
| 68 | Hr'a'cknir Bracers | 2 | reference, not_applicable | reviewed |
| 69 | Icebite Robe | 1 | exact | reviewed |
| 70 | Ichorous Gloves | 1 | exact | reviewed |
| 71 | Incandescent Staff | 3 | reference, not_applicable, not_applicable | reviewed |
| 72 | Infernal Rapier | 1 | reference | reviewed |
| 73 | Ironvine Shield | 1 | exact | reviewed |
| 74 | Ironwood Club | 1 | reference | reviewed |
| 75 | Jhannyl's Gloves | 4 | reference, reference, not_applicable, not_applicable | reviewed |
| 76 | Justiciar's Greatshield | 1 | reference | reviewed |
| 77 | Justiciar's Scimitar | 1 | reference | reviewed |
| 78 | Ketheric's Shield | 2 | reference, not_applicable | reviewed |
| 79 | Ketheric's Warhammer | 3 | reference, not_applicable, reference | reviewed |
| 80 | Killer's Sweetheart | 1 | reference | reviewed |
| 81 | Least Expected | 1 | exact | reviewed |
| 82 | Lightning Jabber | 1 | reference | reviewed |
| 83 | Luminous Gloves | 1 | exact | reviewed |
| 84 | Marksmanship Hat | 3 | reference, not_applicable, not_applicable | reviewed |
| 85 | Moon Devotion Robe | 4 | reference, reference, not_applicable, not_applicable | reviewed |
| 86 | Moonlight Glaive | 1 | reference | reviewed |
| 87 | Myrkulite Scourge | 6 | reference, reference, reference, reference, reference, reference | reviewed |
| 88 | Ne'er Misser | 3 | reference, not_applicable, not_applicable | reviewed |
| 89 | Obsidian Laced Robe | 3 | reference, not_applicable, not_applicable | reviewed |
| 90 | Penumbral Armour | 1 | exact | reviewed |
| 91 | Poisoner's Gloves | 1 | exact | reviewed |
| 92 | Potent Robe | 1 | reference | reviewed |
| 93 | Protective Plate | 1 | reference | reviewed |
| 94 | Psionic Ward Armour | 2 | reference, not_applicable | reviewed |
| 95 | Punch-Drunk Bastard | 1 | exact | reviewed |
| 96 | Rat Bat | 1 | exact | reviewed |
| 97 | Raven Gloves | 1 | reference | partial |
| 98 | Reaper's Embrace | 1 | reference | reviewed |
| 99 | Render of Mind and Body | 1 | reference | reviewed |
| 100 | Ring of Exalted Marrow | 1 | exact | reviewed |
| 101 | Ring of Free Action | 2 | reference, reference | reviewed |
| 102 | Ring of Geniality | 1 | reference | reviewed |
| 103 | Ring of Mental Inhibition | 1 | exact | reviewed |
| 104 | Ring of Self Immolation | 1 | exact | reviewed |
| 105 | Ring of Shadows | 3 | reference, reference, reference | reviewed |
| 106 | Ring of Spiteful Thunder | 3 | reference, not_applicable, not_applicable | reviewed |
| 107 | Ring of Twilight | 1 | exact | reviewed |
| 108 | Rippling Force Mail | 1 | exact | reviewed |
| 109 | Risky Ring | 2 | reference, reference | reviewed |
| 110 | Ritual Dagger of Shar | 1 | exact | reviewed |
| 111 | Robe of Exquisite Focus | 2 | reference, reference | reviewed |
| 112 | Selûne's Spear of Night | 1 | not_applicable | reviewed |
| 113 | Sentinel Shield | 1 | reference | reviewed |
| 114 | Shadeclinger Armour | 3 | reference, not_applicable, not_applicable | reviewed |
| 115 | Shadow Blade Ring | 1 | not_applicable | reviewed |
| 116 | Shadow Lantern | 2 | exact, exact | reviewed |
| 117 | Shadow-Cloaked Ring | 1 | reference | reviewed |
| 118 | Shar’s Spear of Evening | 1 | reference | reviewed |
| 119 | Shar's Temptation | 1 | exact | reviewed |
| 120 | Sharpened Snare Cuirass | 3 | reference, not_applicable, not_applicable | reviewed |
| 121 | Shield of Devotion | 3 | reference, not_applicable, not_applicable | reviewed |
| 122 | Shield of Scorching Reprisal | 1 | exact | reviewed |
| 123 | Shifting Corpus Ring | 1 | reference | reviewed |
| 124 | Slicing Shortsword | 1 | reference | reviewed |
| 125 | Snowburst Ring | 1 | exact | reviewed |
| 126 | Spear of Night | 1 | exact | reviewed |
| 127 | Spellcrux Amulet | 1 | reference | reviewed |
| 128 | Strange Tendril Amulet | 1 | exact | reviewed |
| 129 | Surgeon's Subjugation Amulet | 1 | reference | reviewed |
| 130 | Sword of Clutching Umbra | 1 | reference | reviewed |
| 131 | Sword of Life Stealing | 1 | reference | reviewed |
| 132 | Swordmaster Gloves | 1 | reference | reviewed |
| 133 | Spineshudder Amulet | 1 | reference | reviewed |
| 134 | Sylvan Scimitar | 3 | reference, not_applicable, not_applicable | reviewed |
| 136 | The Mighty Cloth | 3 | reference, not_applicable, not_applicable | reviewed |
| 137 | Thermoarcanic Gloves | 3 | reference, not_applicable, not_applicable | reviewed |
| 138 | Thermodynamo Axe | 2 | reference, reference | reviewed |
| 139 | Thorn Blade | 1 | reference | reviewed |
| 140 | Thunderskin Cloak | 2 | reference, reference | reviewed |
| 141 | True Love's Caress | 1 | exact | reviewed |
| 142 | True Love's Embrace | 1 | exact | reviewed |
| 143 | Twist of Fortune | 1 | reference | reviewed |
| 144 | Vivacious Cloak | 1 | exact | reviewed |
| 145 | Watcher's Shield | 1 | exact | reviewed |
| 146 | Yuan-Ti Scale Mail | 3 | reference, not_applicable, not_applicable | reviewed |

## High-risk semantics

- Complete strong-ID sets and exact empty-ID Wiki guards are preserved. Shar’s original curly-apostrophe catalogue binding remains intact; the explicit ASCII evidence alias is not a fallback.
- Talli relocations, Roah/Araj continuation windows, Isobel outcomes, Ketheric shield theft/disarm prerequisites and final corpse routes remain separate.
- Infernal Iron and Infernal Alloy crafting alternatives stay separate; Shadow Lantern Gale/Arcana alternatives are not combined into mandatory requirements.
- Boots of Brilliance Early Access Mimic route is explicitly historical. Camp, moving actors and malformed/unknown points use null Exceptions.
- True Love’s Embrace retains Y = 0. No averaging, sign correction, borrowed map-space points or fabricated routes.
- Unproven Raven Gloves failed-roll and Hellfire extra-copy branches remain unasserted, with partial coverage.

## Safety

556 source rows → 555 unique items and all 555 progress keys unchanged. Vendor 63/50/67; Loot 131/94/125; Quest 25/0/0. Graceful Cloth contexts remain distinct; Battlemage sourceRow 54 retained. v5/v6 compatibility, Story isolation, themes, discovery, status and progress semantics remain independent. Minimal/Light construct zero enrichment DOM. No Supabase, real user storage, SQL, .lsv Phase B, PWA, versioned-transport activation or deployment changes.
