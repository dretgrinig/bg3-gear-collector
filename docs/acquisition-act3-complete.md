# Complete Act 3 acquisition checkpoint

Schema 2 · dataset `2.8.0-act3.complete` · approved factual plan reviewed 2026-10-17.

## Reconciliation

- 192 unique Act 3 catalogue identities: 3 already accounted, 189 newly bound.
- 189 entries / 189 bindings / 268 routes, plus 23 append-only routes on 12 existing entries: 291 additions total.
- Added states: 46 Exact / 173 Reference / 66 coordinate Exceptions / 3 conflicts / 3 Pending branches.
- Final: 555 entries / 556 bindings / 817 routes; 164 Exact / 502 Reference / 144 Exceptions / 4 conflicts / 3 Pending.
- All 219 Act 1 + 144 Act 2 + 192 Act 3 catalogue identities bind. Full renders 554 identities; Blood-Bound Blade remains unavailable with no routes.
- No identity, catalogue URL, complete ID set or progress key is changed. Prior 366 entries remain byte-equivalent except the exact 23 appended routes.

## Source and uncertainty boundaries

BG3 Wiki inspected item, NPC, quest and map bodies with current revision pins. No historical revision body inspection is claimed. Never infer coordinates, IDs or guarantees from neighbouring subjects.

- Shapeshifter Hat (row 140) and Burnished Ring (row 192) keep empty IDs and original external URLs. The closed two-entry lookup rule is documented in [the identity contract](acquisition-metadata.md#identity-and-binding); strict evidence URLs remain BG3 Wiki only.
- Bonespike Boots: conflicting interior chest points remain evidence; no asserted chest X/Y. The exterior entrance is labelled only as separate navigation.
- Staff of Interruption: both reward branches preserve the published coordinate conflict; no inferred extra-zero repair.
- Kled reward, non-Origin Gibus desk and later Vest purchase remain draft/uncertain Pending branches. They do not render Full routes.
- Moving owners, shop transfers, mutually exclusive rewards and historical availability remain explicit. Alternate venues never promise additional copies.
- Long Arm of the Gur retains all three catalogue IDs; the uncorroborated third legacy ID is not discarded or asserted as a save-ID mapping.
- Original Ring Of Regeneration case identity and Seemingly Gleaming Ring source-less strong-ID binding are retained.

## Independent oracle

`tests/fixtures/acquisition-act3-complete.json` preserves the reviewed plan facts, discrepancy/identity notes and revision pins independently of canonical JSON. UUIDs were allocated once before canonical mutation. Planning-time source-compatibility blocker notes remain historical provenance; `compatibilityDisposition` records their Stage B resolution.

Approved plan SHA-256: `9a79dbdc9b3936944134513156c6b7952bd1021dfb9fb36d4e04c5178f0abe9b`.

| sourceRow | Exact catalogue name | Routes | States | Availability / coverage |
|---:|---|---:|---|---|
| 2 | Abdel's Trusted Shield | 1 | reference | current / reviewed |
| 3 | Absolute Confidence Amulet | 2 | reference, reference | current / reviewed |
| 4 | After Death Do Us Part | 1 | reference | current / reviewed |
| 5 | Ambusher | 1 | reference | current / reviewed |
| 6 | Amulet of Bhaal | 2 | reference, reference | current / reviewed |
| 7 | Amulet of Elemental Torment | 4 | reference, not_applicable, not_applicable, not_applicable | current / reviewed |
| 8 | Amulet of Greater Health | 1 | exact | current / reviewed |
| 9 | Amulet of the Devout | 1 | exact | current / reviewed |
| 10 | Amulet of the Drunkard | 1 | reference | current / reviewed |
| 11 | Amulet of Windrider | 3 | reference, reference, reference | current / reviewed |
| 12 | Armour of Agility | 1 | reference | current / reviewed |
| 13 | Armour of Landfall | 4 | reference, reference, not_applicable, not_applicable | current / reviewed |
| 14 | Armour of Moonbasking | 1 | reference | current / reviewed |
| 15 | Armour of Persistence | 1 | reference | current / reviewed |
| 16 | Armour of the Sporekeeper | 1 | reference | current / reviewed |
| 17 | Assassin of Bhaal Cowl | 2 | reference, not_applicable | current / reviewed |
| 18 | Balduran's Giantslayer | 2 | reference, exact | current / reviewed |
| 19 | Band of the Mystic Scoundrel | 1 | exact | current / reviewed |
| 20 | Belm | 1 | exact | current / reviewed |
| 21 | Bhaalist Armour | 2 | reference, not_applicable | current / reviewed |
| 22 | Bhaalist Gloves | 2 | reference, not_applicable | current / reviewed |
| 23 | Birthright | 4 | reference, reference, not_applicable, not_applicable | current / reviewed |
| 24 | Blackguard's Gauntlets | 1 | reference | current / reviewed |
| 25 | Blackguard's Greaves | 1 | reference | current / reviewed |
| 26 | Blackguard's Plate | 1 | reference | current / reviewed |
| 27 | Blackguard's Sword | 1 | reference | current / reviewed |
| 28 | Blightbringer | 1 | reference | current / reviewed |
| 29 | Bloodthirst | 1 | reference | current / reviewed |
| 30 | Bonespike Boots | 1 | conflict | current / reviewed |
| 31 | Bonespike Garb | 1 | reference | current / reviewed |
| 32 | Bonespike Gloves | 1 | reference | current / reviewed |
| 33 | Bonespike Helmet | 1 | reference | current / reviewed |
| 34 | Boots of Persistence | 1 | reference | current / reviewed |
| 35 | Boots of Psionic Movement | 1 | reference | current / reviewed |
| 36 | Boots of Uninhibited Kushigo | 1 | reference | current / reviewed |
| 37 | Boots of Very Fast Blinking | 1 | reference | current / reviewed |
| 38 | Breaching Pikestaff | 1 | exact | current / reviewed |
| 39 | Caitiff Staff | 1 | reference | current / reviewed |
| 40 | Cerebral Citadel Armour | 1 | exact | current / reviewed |
| 41 | Cerebral Citadel Gloves | 1 | exact | current / reviewed |
| 42 | Cindermoth Cloak | 1 | reference | current / reviewed |
| 43 | Circlet of Fire | 1 | exact | historical_only / partial |
| 44 | Cloak of Displacement | 1 | reference | current / reviewed |
| 45 | Cloak of the Weave | 1 | reference | current / reviewed |
| 46 | Cloth of Authority | 2 | reference, not_applicable | current / partial |
| 47 | Clown Hammer | 1 | reference | current / reviewed |
| 48 | Cold Snap | 1 | reference | current / reviewed |
| 49 | Corpsegrinder | 1 | reference | current / reviewed |
| 50 | Corvid Token | 1 | reference | current / reviewed |
| 51 | Craterflesh Gloves | 2 | reference, not_applicable | current / reviewed |
| 52 | Crimson Mischief | 1 | reference | current / reviewed |
| 53 | Crypt Lord Ring | 1 | reference | current / reviewed |
| 54 | Dark Displacement Gloves | 1 | reference | current / reviewed |
| 55 | Despair of Athkatla | 1 | reference | current / reviewed |
| 57 | Djinni Ring | 1 | reference | current / reviewed |
| 59 | Dread Iron Dagger | 2 | reference, not_applicable | current / reviewed |
| 60 | Drunken Cloth | 1 | reference | current / reviewed |
| 61 | Duellist's Prerogative | 1 | reference | current / reviewed |
| 62 | Duke Ravengard's Longsword | 2 | not_applicable, not_applicable | current / reviewed |
| 63 | Dwarven Thrower | 1 | reference | current / reviewed |
| 64 | Elegant Studded Leather | 1 | exact | current / reviewed |
| 65 | Elven Chain | 1 | reference | current / reviewed |
| 66 | Emblazoned Plate of the Marshal | 2 | not_applicable, not_applicable | current / reviewed |
| 67 | Fabricated Arbalest | 2 | reference, not_applicable | current / partial |
| 68 | Fey Semblance Amulet | 2 | reference, pending | current / partial |
| 69 | Flail of Ages | 1 | reference | current / reviewed |
| 70 | Flame Enamelled Armour | 1 | exact | current / reviewed |
| 71 | Fleshrender | 2 | reference, not_applicable | current / reviewed |
| 72 | Foebreaker | 1 | exact | current / reviewed |
| 73 | Garb of the Land and Sky | 1 | reference | current / reviewed |
| 74 | Gauntlet of the Tyrant | 2 | reference, not_applicable | current / partial |
| 75 | Gauntlets of Hill Giant Strength | 2 | exact, reference | current / reviewed |
| 76 | Gauntlets of the Warmaster | 1 | reference | current / reviewed |
| 77 | Gemini Gloves | 1 | reference | current / reviewed |
| 78 | Gibus of the Worshipful Servant | 4 | reference, reference, reference, pending | current / partial |
| 79 | Gleamdance Dagger | 1 | reference | current / reviewed |
| 80 | Gloves of Soul Catching | 1 | reference | current / reviewed |
| 81 | Gontr Mael | 1 | reference | current / reviewed |
| 82 | Hammer of the Just | 1 | exact | current / reviewed |
| 83 | Handmaiden's Mace | 1 | reference | current / reviewed |
| 84 | Harmonic Dueller | 1 | reference | current / reviewed |
| 85 | Harper Sacredstriker | 4 | reference, reference, not_applicable, not_applicable | current / reviewed |
| 86 | Hat of the Sharp Caster | 2 | exact, reference | current / reviewed |
| 87 | Hellbeard Halberd | 1 | reference | current / reviewed |
| 89 | Helldusk Boots | 1 | exact | current / reviewed |
| 90 | Helldusk Gloves | 1 | reference | current / reviewed |
| 91 | Helldusk Helmet | 1 | exact | current / reviewed |
| 92 | Hellfire Engine Crossbow | 1 | exact | current / reviewed |
| 93 | Hellfire Greataxe | 1 | exact | current / reviewed |
| 94 | Hellrider Longbow | 1 | reference | current / reviewed |
| 95 | Helm of Balduran | 1 | exact | current / reviewed |
| 96 | Helmet of Grit | 1 | exact | current / reviewed |
| 97 | Hollow's Staff | 1 | reference | current / reviewed |
| 98 | Hood of the Weave | 1 | reference | current / reviewed |
| 99 | Horns of the Berserker | 1 | reference | current / reviewed |
| 100 | Infernal Mace | 5 | reference, reference, reference, reference, reference | current / reviewed |
| 101 | Infernal Spear | 2 | reference, reference | current / reviewed |
| 102 | Jannath's Hat | 1 | exact | current / reviewed |
| 103 | Keepsake Ring | 1 | exact | current / reviewed |
| 104 | Khalid's Gift | 1 | exact | current / reviewed |
| 105 | Knock Knuckle Gloves | 1 | exact | current / reviewed |
| 106 | Kurwin's Cauteriser | 1 | reference | current / reviewed |
| 107 | Legacy of the Masters | 1 | reference | current / reviewed |
| 108 | Magic Amulet | 1 | reference | current / reviewed |
| 109 | Mantle of the Holy Warrior | 1 | reference | current / reviewed |
| 110 | Markoheshkir | 1 | exact | current / reviewed |
| 111 | Martial Exertion Gloves | 1 | reference | current / reviewed |
| 112 | Mask of Soul Perception | 1 | exact | current / reviewed |
| 113 | Murderous Cut | 1 | not_applicable | current / partial |
| 114 | Nimblefinger Gloves | 1 | reference | current / reviewed |
| 115 | Nymph Cloak | 2 | exact, reference | current / reviewed |
| 116 | Nyrulna | 1 | exact | current / reviewed |
| 117 | Orphic Hammer | 3 | exact, not_applicable, not_applicable | current / reviewed |
| 118 | Orphic Ring | 1 | reference | current / reviewed |
| 119 | Pelorsun Blade | 1 | exact | current / reviewed |
| 120 | Pyroquickness Hat | 1 | exact | current / reviewed |
| 121 | Quickspell Gloves | 4 | reference, reference, not_applicable, not_applicable | current / reviewed |
| 122 | Ravengard's Scourger | 1 | reference | current / reviewed |
| 123 | Reverse Rain Cloak | 1 | reference | current / reviewed |
| 124 | Rhapsody | 1 | reference | current / reviewed |
| 125 | Ring of Blink | 1 | reference | current / reviewed |
| 126 | Ring of Feywild Sparks | 1 | reference | current / reviewed |
| 127 | Ring Of Regeneration | 4 | reference, reference, not_applicable, not_applicable | current / partial |
| 128 | Ring of Truthfulness | 1 | reference | current / reviewed |
| 129 | Robe of Supreme Defences | 1 | reference | current / reviewed |
| 130 | Robe of the Weave | 1 | exact | current / reviewed |
| 131 | Sarevok's Horned Helmet | 1 | reference | current / reviewed |
| 132 | Scabby Pugilist Circlet | 1 | reference | current / reviewed |
| 133 | Scarlet Leather Armour | 3 | reference, exact, reference | current / reviewed |
| 134 | Seemingly Gleaming Ring | 1 | reference | current / reviewed |
| 135 | Sentient Amulet (Very Rare) | 1 | reference | current / reviewed |
| 136 | Seraphic Pugilist Gloves | 1 | exact | current / reviewed |
| 137 | Servitor of the Black Hand Gloves | 1 | exact | current / reviewed |
| 138 | Sethan | 1 | reference | current / reviewed |
| 139 | Shade-Slayer Cloak | 1 | reference | current / reviewed |
| 140 | Shapeshifter Hat | 1 | reference | current / partial |
| 141 | Shelter of Athkatla | 1 | reference | current / reviewed |
| 142 | Shield (Hope) | 1 | not_applicable | historical_only / partial |
| 143 | Shield of Shielding | 1 | exact | current / reviewed |
| 144 | Shield of the Undevout | 1 | reference | current / reviewed |
| 145 | Silver Sword of the Astral Plane | 6 | reference, reference, not_applicable, not_applicable, reference, not_applicable | current / reviewed |
| 146 | Slinging Shoes | 1 | reference | current / reviewed |
| 147 | Snow-Dusted Monastery Gloves | 1 | reference | current / reviewed |
| 148 | Spaceshunt Boots | 2 | reference, reference | current / reviewed |
| 149 | Spell Savant Amulet | 1 | not_applicable | current / reviewed |
| 150 | Spellmight Gloves | 3 | reference, reference, reference | current / reviewed |
| 151 | Spellseeking Gloves | 1 | reference | current / reviewed |
| 152 | Staff of a Mumbling Wizard | 1 | reference | current / reviewed |
| 153 | Staff of Cherished Necromancy | 1 | reference | current / reviewed |
| 154 | Staff of Interruption | 2 | conflict, conflict | current / reviewed |
| 155 | Staff of Spellpower | 1 | exact | current / reviewed |
| 156 | Staff of the Emperor | 1 | reference | current / reviewed |
| 157 | Staff of the Ram | 1 | exact | current / reviewed |
| 158 | Stalker Gloves | 1 | reference | current / reviewed |
| 159 | Steelwatcher Helmet | 1 | exact | current / reviewed |
| 160 | Stillmaker | 1 | exact | current / reviewed |
| 161 | Swires' Sledboard | 1 | reference | current / reviewed |
| 162 | Sword of Chaos | 1 | reference | current / reviewed |
| 163 | Sword of the Emperor | 1 | reference | current / reviewed |
| 164 | The Dancing Breeze | 1 | reference | current / reviewed |
| 165 | The Dead Shot | 1 | reference | current / reviewed |
| 166 | The Long Arm of the Gur | 1 | exact | current / reviewed |
| 167 | The Pointy Hat | 1 | exact | current / reviewed |
| 168 | The Reviving Hands | 1 | reference | current / reviewed |
| 169 | The Sacred Star | 1 | reference | current / reviewed |
| 170 | The Undead Bane | 2 | reference, reference | current / reviewed |
| 171 | Thunderpalm Strikers | 1 | reference | current / reviewed |
| 172 | Til Death Do Us Part | 3 | reference, reference, reference | current / reviewed |
| 173 | Torch of Revocation | 2 | reference, reference | current / reviewed |
| 174 | Trident of the Waves | 1 | reference | current / reviewed |
| 175 | Tyrannical Jackboots | 2 | reference, not_applicable | current / partial |
| 176 | Unflinching Protector Amulet | 1 | reference | current / reviewed |
| 177 | Unlucky Thief's Gloves | 1 | reference | current / reviewed |
| 178 | Unwanted Masterwork Gauntlets | 1 | exact | current / reviewed |
| 179 | Unwanted Masterwork Greaves | 1 | exact | current / reviewed |
| 180 | Unwanted Masterwork Scalemail | 1 | reference | current / reviewed |
| 181 | Veil of the Morning | 1 | reference | current / reviewed |
| 182 | Vest of Soul Rejuvenation | 5 | reference, reference, not_applicable, not_applicable, pending | current / partial |
| 183 | Vicious Battleaxe | 2 | reference, not_applicable | current / reviewed |
| 184 | Vicious Shortbow | 2 | reference, not_applicable | current / reviewed |
| 185 | Viconia's Priestess Robe | 1 | reference | current / reviewed |
| 186 | Viconia's Walking Fortress | 1 | reference | current / reviewed |
| 187 | Voss' Silver Sword | 6 | not_applicable, reference, reference, reference, not_applicable, not_applicable | current / reviewed |
| 188 | Wavemother's Cloak | 1 | exact | current / reviewed |
| 189 | Wavemother's Robe | 3 | reference, reference, reference | current / reviewed |
| 190 | Wavemother's Sickle | 2 | reference, reference | current / reviewed |
| 191 | Winkling Gloves | 2 | reference, not_applicable | current / reviewed |
| 192 | Burnished Ring | 1 | reference | current / partial |
| 193 | Woe | 1 | reference | current / reviewed |

## Existing-entry appends

| Existing progress key | Appended routes |
|---|---:|
| act 1 / blooded greataxe | 2 |
| act 1 / bow of awareness | 2 |
| act 1 / hunter's dagger | 2 |
| act 1 / monster slayer glaive | 2 |
| act 1 / gold wyrmling staff | 2 |
| act 1 / amulet of restoration | 2 |
| act 1 / caustic band | 2 |
| act 1 / corrosive flail | 2 |
| act 1 / gloves of hail of thorns | 2 |
| act 1 / herbalist's gloves | 2 |
| act 1 / ring of jumping | 2 |
| act 3 / dolor amarus | 1 |

Roah retains separate pre-battle and successful Guildhall-takeover trade venues. Six Derryth stock entries retain separate Derryth/Baelen conditional owner routes, without importing unrelated bookcase coordinates. Dolor retains its original three routes and gains one separately reviewed temporary-ghost inventory exploit; no direct Abazigal pickpocket or ghost corpse stock is asserted.

## High-risk facts

- Sorcerous Sundries front-desk purchases and later Rolan inventory access remain separate. Later Vest purchase is withheld; uncertain stock is not made unconditional.
- Hat of the Sharp Caster keeps its current Patch 8 canopy pickup separate from historical Tara purchase. Slinging Shoes keeps its reviewed relocation/barter conditions.
- Counting House vault numbers remain distinct even when published navigation points coincide; keys are not universal prerequisites when another legitimate unlock works.
- Foundry component waypoints are labelled components, not finished-item acquisition; Gortash/Orin Netherstone separation is not invented manual crafting.
- House of Hope and House of Grief outcomes, tribunal stock, companion/origin rewards, Voss variants, Ravengard restrictions and historical items preserve reviewed alternatives and complete IDs.

## Verification and UI boundaries

- Table-driven generic identity/facts/negative, Full DOM and protected-mode tests cover every new item. Exact append-only assertions cover all 12 prior entries.
- Only reviewed current/historical routes render. Three draft branches are excluded; Minimal/Light construct zero enrichment DOM.
- Deterministic canonical/browser/offline bundle parity is tested for all new and continued entries.
- Automated browser/overflow sweeps use 320/390/768/1280; screenshots use only the twelve approved representatives at 390/1280. Shared click, Enter/Space, search-blur, focus/node-identity and late-hydration regressions remain active.

## Protected systems

556 raw rows → 555 unique; all 555 progress keys; Vendor 63/50/67; Loot 131/94/125; Quest 25/0/0; Graceful Cloth separation; Battlemage sourceRow 54; v5/v6 compatibility unchanged. No Story/progress/auth/sync/theme/spoiler preference/classification/database/SQL/PWA/transport/deployment changes. Versioned transport remains default-off, PWA/service worker disabled, DEV PREVIEW hostname gate unchanged. No .lsv Phase B.
