# Exact origin identity and equipment boundary

## Shipped proof

The existing strict `lsmf-08000101-tag123` decoder validates all directory, fixed
array, owner map, overlap and duplicate invariants first. On an eligible current
Player + Character + Stats owner, Origin v0 must be exactly 16 bytes and its GUID
must be an exact member of `planner/origin-ids.json`. That finite map contains the
ten reviewed companions, Custom and Dark Urge, not world-template aliases or
private save identifiers. The GUID byte order matches the engine's explicit
`Guid::ToString` implementation, including its last four little-endian pairs.

Custom additionally requires the same owner's IsCustom v0 tag and Avatar v0
component. An unknown origin never defaults to Custom, Tav, a companion or a
hireling. Dark Urge uses its separate exact definition. A contradictory custom
marker on a companion is withheld. A repeated mapped identity on different
current candidates is ambiguous for both; there is no first-row tie break.
Non-player/history origin records cannot create or name candidates. Directory
reordering, class changes and build similarity do not affect identity.

Primary implementation references:
- [Pinned origin-definition map](https://github.com/angaityel/bg3-dialog-reader/blob/6acaff05cd63dc034266e16fc808e9e62bf12754/bg3dialogreader/Form1.cs)
- [Independent origin constants](https://github.com/0x1amy0urdad/Guidance/blob/main/src/bg3moddinglib/_constants.py)
- [Toolkit origin edit: Shadowheart](https://github.com/BG3-Community-Library-Team/BG3-Toolkit-SH-Knowledge)
- [Toolkit origin edit: Wyll](https://github.com/BG3-Community-Library-Team/BG3-Toolkit-Wyll-Hexblade)
- [Engine GUID implementation](https://github.com/Norbyte/bg3se/blob/main/CoreLib/Base/Base.cpp)

No public reader/extractor was executed. Published mappings are definitions to
compare exactly, not heuristic joins. Names, XP, class defaults, adjacency,
Creator-only and CurrentTemplate-only matches are not accepted.

## Authorized structural measurement

The authorized source was processed read-only, with payloads in memory and
source bytes/stat checked afterward. Only sanitized aggregate results are retained:
four eligible candidates, four exact reviewed origin matches (three companion
origins and one exact Custom + Avatar conjunction), and four preserved results
for direct level, class split, subclass and observed effective abilities. No
private character names, identity composition, UUIDs, payloads, file paths or
source hashes are retained here or in fixtures. This is not a census of every
serialized character and does not establish active-party membership.

The final product read uses Globals/NewAge only, about 22.8 MB aggregate decoded
expansion and about 315k identity steps, within the unchanged 128 MiB member/file,
512 MiB aggregate, 2M identity-step and 30-second aggregate deadline limits.
One diagnostic traversal exceeded the unchanged work ceiling; it rejected with
no partial result. Indexed comparisons completed inside the same bound. No cap
was raised and no parser/codec was changed.

## Current party: not promoted

The same owners have a serialized Party Member component, but the reviewed live
Party Member reference offset is not a valid serialized reference in this profile.
A matching count, Player tag or component name is not proof of the exact current
party. Reviewed meta.lsf UUID metadata supplies no exact candidate reference;
SaveInfo compatibility/display metadata is not an identity/party join. Neither
XP, ordering nor display names are used. No auto-party control ships; bench and
historical records remain separate unknowns rather than inferred active/inactive.

[Live Party definitions](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Components/Party.h)
are structural clues, not an on-disk layout guarantee.

## Equipment: full chain still unproven

Within the authorized NewAge surface, 56 Wielding references associated with the
four candidates also have aligned MemberData references and matching inventory
holder references. Their candidate slot words fall in the public equipment enum.
This is useful structural consistency, **not** a completed current-state
character -> slot -> exact item instance -> exact catalogue proof.

The serialized template UUIDs do not match reviewed static catalogue IDs; the
second opaque template word supplies no reviewed replacement. Wielded GUID
components do not supply a symmetric holder proof for these candidate records.
No other reviewed serialized stat-definition component establishes the missing
catalogue bridge. An exact LSF character-template association exists after
normalizing the engine UUID byte convention, but it does not bind gear instances.
The generic resource UUID renderer is unchanged; no unrelated global UUID fix is
included. The diagnostic conversion is not used as an identity fallback.

The public readers disagree about MemberData slot versus historical runtime
handle interpretation. Plausible slot values and internally consistent pointers
cannot by themselves validate current-versus-stale semantics or define a static
item identity. No guessed offsets, shifted owner maps, cluster windows, scene
positions, similar gear, template-only gear or occurrence counts are used.

Consequently zero catalogue equipment slots are promoted. Main/offhand, ranged
main/offhand, armour, head, hands, feet, cloak, amulet and the two ring slots
remain separately Unknown until manually specified through existing planner
controls where supported. Unknown is not empty. Both weapon sets are not merged.
No detected hard locks, duplicate-copy capacity, inventory quantities, ownership
claims or Found mutations are introduced. Manual locks/reservations/conflicts
and practical alternatives continue through the original optimizer.

[Inventory definitions](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Components/Inventory.h),
[slot enum](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Enumerations/Stats.inl),
[pinned serialized-format research](https://github.com/danielsamuels/bg3-savefile-parser/blob/9578ff7c46a1aa40c805f6b7beecf907f10fb3b8/FORMAT.md).
Do not import those readers' XP, adjacency, row-window or class-similarity joins.

The next equipment checkpoint needs an independently reviewed exact static
catalogue bridge for a proven live instance, plus current-slot semantics backed
by controlled swaps across holders, rings and both weapon sets. Any additional
Globals item-factory capability must be explicitly scoped and reviewed; this
checkpoint does not broaden the selected NewAge capability or inspect LevelCache,
StorySave or other payloads. Failure to prove one field does not suppress the
now-proven identity or build fields.

## DTO, UI and safety

Identity enters the existing detected/override BuildSnapshot. Manual identity
corrections survive reread and Clear; clearing/replacement removes detected
identity/provenance immediately. Fixed origin keys only cross the Worker boundary,
never raw save IDs or user character names. UI applies the existing shared Act
roster before headings, labels, ARIA, selects, party/conflict names and unknown
counts. Concealed identities retain neutral candidate positions/counts. Custom
uses a neutral public label; Dark Urge additionally requires Full. Ignore removes
only the chosen session candidate and moves focus to a surviving control.

All payloads stay inside the single-use bounded save Worker. No save is uploaded,
persisted or exported. Ordinary static assets load as before. Synthetic fixtures
use public definitions and invented entities only. Private browser QA is isolated,
blocks backend/write requests and takes no private screenshots. The public package
retains exactly 51 paths; research, source JSON, tests, scripts and docs remain
excluded. Story, progress, auth, sync, import Apply, PWA, transport defaults,
DEV PREVIEW gate and deployment settings are unchanged.
