# Party & Gear Planner v1

Session-only, read-only planning for 1–4 manually selected characters. Story Gear
means **marked found in this Story**, not owned, carried, equipped or quantity.
Theoretical means eligible catalogue identities irrespective of found status.
The adapter receives current validated catalogue/in-memory progress only; it
has no mutation callback and never reconstructs progress through backend reads.
Unavailable progress is distinct from an empty found pool. Cloud Story state is
labelled cached; this view does not promise independently verified freshness.

## Build and detection contract

`planner/model.cjs`: closed BuildSnapshot version 1, opaque session character ID,
context epoch/revision, detected/override values, source/completeness, opaque
field evidence references, issue codes. Overrides retain original detection;
removing an override exposes that detection. Unknown list is not confirmed empty.
Level order is explicit, total 1–12; all 12 base classes and 58 current subclasses
are class-bound choices. Selecting a companion never assigns their class.
The reviewed Companion Guide Act roster is reused for identity display.

Manual baseline abilities exclude gear. Observed effective scores never become
a baseline or silently acquire an equipment decomposition. Manual proficiencies
must include starting-class, multiclass and subclass grants; names alone are not
proof. Relevant feats, choices, prepared/known spells and passives are editable.
Only reviewed explicit tokens affect modeled rules; other input remains an honest
unmodeled choice. The user confirms the manual build before calculation.

The build-reader Worker reads **Globals.lsf only**, selecting the unique root
`NewAge` / `NewAge` type-25 ScratchBuffer after full generic structural validation.
No LevelCache, StorySave, thumbnail, name/XP join, or archive-order inference.
The original parser, resource module, codecs, limits, existing save-import Worker
and existing additive Apply behavior are unchanged. The build bundle derives a
narrow private ScratchBuffer capability from the same validated generic resource
source; that capability checks exact node/attribute/type and is not exported to
UI. Its generation boundary is checked and permanently tested.

Reference-profile LSMF v1 envelope reader: relative base 48; component table records 48;
core.v0.Level version 0 / 32 bytes; owner map records 32 / indices u32; reviewed
Stats v3 version 0 / 36 bytes; progression v3 version 0 / 16 bytes; level-up data
v3 version 0 / 96 bytes. Table/range/count/overlap/duplicate/reference validation
precedes output. Entity IDs stay internal and are never emitted. Component-owner
association uses only exact owner maps. Stats candidates must also have nonempty
validated progression references. Candidates are anonymous and explicitly chosen,
never automatically added as an active party. No partial fields on structural
failure. Unknown/missing/unsupported profile => manual completion.

The reference profile promotes **observed effective abilities** only. The separately
validated 1.1 profile below also promotes direct current level and exact reviewed
current class/subclass totals. The exact origin extension below separately permits reviewed identity. Active party, class order, feats/ASIs, base abilities,
proficiencies, prepared spells, invocations/styles/metamagic/manoeuvres, permanent
passives, holder/slot/equipment and ownership remain Unknown/manual. Public GUID
mappings and respec/current-progression semantics are not independently proven;
raw IDs, stale history counts and unreviewed tokens are not exposed as builds.
The upstream reader is a research lead, not a product dependency:
[NewAge reference at c3372b1](https://github.com/NodeJSmith/bg3-newage/tree/c3372b1988109a2fd1d35897e1895e387f7a916e).
No upstream Python/.NET/extractor is executed and no game archive is required.

Save ceilings remain 128 MiB file/member, 512 MiB cumulative expansion and a
30-second aggregate deadline, including UI read/Worker lifetime. Existing generic
structural and identity caps are unchanged. The independent identity traversal
also has a 2M step bound and a bounded anonymous-candidate report. Cancellation
terminates the one-use Worker. Bytes remain local and ephemeral.

## One kernel and bounded search

`planner/engine.cjs` is shared by manual and detected snapshots. Strategies are
structural templates (melee, ranged, throw, unarmed, spell attack, multi-hit,
control, support), not branches on named builds. Editable action source/casting
ability, spell, concentration, resources, prebuff/trigger assumptions and burst
policy feed the same calculations. Generic, burst and sustained scenarios have
1–6 rounds (default 3), explicit AC/save/resistance/target/incoming/rest/reaction/
kill assumptions. Rules are explicit user assumptions: Honour / Non-Honour.

Closed-form d20 probabilities (independent enumeration oracle tests) model attack hit/crit/advantage, saving throws,
dice versus flat crit damage, spell rays, AC/setters, concentration and resource
use. Concentration includes its natural-roll exception; ordinary combat saves do
not. Haste/Bloodlust Honour action differences and Fighter/ordinary/Pact Extra
Attack differences are explicit. Kill-trigger actions require a kill assumption.
Manual equipment locks are hard, explicit reservations are hard, personal claims
are soft. Capacity is one per canonical identity, never save occurrence count.
Graceful Cloth identities stay separate; no inferred aliases or copies.

Full-loadout compatibility covers paired rings, melee dual wielding, 2H/offhand exclusion, weapon
configuration and confirmed armour/shield/weapon proficiencies. Every reviewed compatible item seeds full-loadout evaluation, followed by a deterministic bounded cross-slot pair prefix (512 seeds). Deterministic
coordinate sweeps refine those loadouts, with scarce-resource alternatives and a
bare baseline retained. No prose-derived generic gear score is used for pruning.
Up to 8 loadouts per character + unassigned; independent exhaustive joint search
is bounded by 9^4 = 6,561 combinations. Hard locks cannot become unassigned.

#1 is personal preference, not a claim of party assignment. #2 excludes the
canonical #1 loadout (ring permutations are not alternatives), holds other proposed
assignments fixed, and enforces locks/reservations/capacity. No feasible #2 is
explicitly reported. Conflicting hard intent is infeasible and never discarded.
Equal-unit damage objectives are summed; mixed-role plans use explicit character
order lexicographically, never a hidden DPR+AC+control scalar. AC is a documented
secondary tie-break within a character's modeled objective; identical metrics prefer fewer claimed resources. Loadouts and full explanations use native disclosures so mobile output stays compact.

All results say **Best among evaluated candidates**. They are not global optima.
One shared budget spans generation/evaluation/allocation: <=20k evaluations,
2M charged steps, 5s Worker deadline, 1 MiB final output. Cancellation/context
invalidation terminates jobs; bounded search is labeled. A small session cache
keys the complete request (scope, catalogue/progress/mode/build/strategy/scenario/
source/reservations), excluding only the redundant request counter.

## Coverage and assumptions

All 555 identities are explicitly accounted in `planner/gear-data.json` with exact
canonical key/sourceRow/full existing strong-ID set. 20 SUPPORTED, 73 PARTIAL,
462 UNMODELED, 0 INAPPLICABLE. This is mechanics coverage, not acquisition coverage.
93 reviewed items have effect metadata with source/applicability/stacking/trigger/
duration/rules/support/fixture. Others are unranked, not silently scored zero.
An unmodeled hard lock prevents a supported numerical plan.

Each result is PARTIAL because unreviewed features can materially change a real
build. UI exposes omissions rather than claiming a universally best build.
Approximation boundaries: expected Acuity buildup/turn decay, incoming damage,
control against eligible targets only, no geometry/movement, no universal DRS
chains, no general subclass/spellbook/condition simulation. Spell resources and
casting source are manual assumptions, not automatic class-entitlement proof.
Acuity modifies spell attack/DC; Synergy adds the explicitly selected casting
modifier to weapon attacks only after its explicit trigger assumption. These are
distinct. Item-granted restoration is budgeted only with precombat/rest permission;
unimplemented special weapon actions remain unmodeled. Unknown support/utility
is never represented as an invented damage bonus. Feats such as Alert entered
manually are not implemented unless explicitly named in the reviewed kernel.

Data discrepancies deliberately kept out of the old catalogue: Whispering Promise
uses two-turn Bless, not the older ten-turn prose; Soul Catching's current Wiki
wording differs from old advantage prose; Sword of Justice's current recharge
also differs. Those unsupported details are not silently inherited by this model.

## Spoilers, context, privacy, deployment

The active **Story** spoiler mode controls this view; the Companion Guide override
does not. Minimal/Light return unranked public-safe name/type/status rows before
mechanics lookup/evaluation/conflicts. No concealed mechanics influence counts,
order, alternatives or accessibility output. A stricter mode cancels jobs, clears
results/cache/readings/gear locks/reservations, and synchronously reprojects.
Story/auth/backend change destroys all builds/save associations/reservations and
advances an opaque epoch. A→B→A cannot resurrect state. Same-Story progress changes
invalidate recommendations. Navigation preserves state, Tracker nodes/focus/scroll
and pending state; reload discards planner state. No new localStorage,
sessionStorage, IndexedDB, cookie or backend persistence. No ownership inference,
Tracker writes, auth/RLS changes, PWA activation or transport change.

Five intentional public additions: planner.js, planner.css, planner-core.js,
planner-worker.js, planner-save-worker.js. `scripts/build-planner.cjs` validates
source capability boundaries and deterministically generates bundles. Packaging
is now 51 files; research/tests/docs/scripts/source metadata stay excluded. Public
static mechanics are inspectable source data, not an assertion of UI spoiler leak.

## Sources and verification

Primary mechanics: [Classes](https://bg3.wiki/wiki/Classes),
[Extra Attack](https://bg3.wiki/wiki/Extra_Attack),
[Attack rolls](https://bg3.wiki/wiki/Attacks),
[Saving throws](https://bg3.wiki/wiki/Saving_throws),
[Unarmed Strike](https://bg3.wiki/wiki/Unarmed_Strike),
[Critical hit](https://bg3.wiki/wiki/Critical_hit),
[Concentration](https://bg3.wiki/wiki/Concentration),
[Armour Class](https://bg3.wiki/wiki/Armour_Class),
[Arcane Acuity](https://bg3.wiki/wiki/Arcane_Acuity_(condition)),
[Arcane Synergy](https://bg3.wiki/wiki/Arcane_Synergy_(condition)); each reviewed item
has its own exact Wiki page source. Gamestegy [build categories](https://gamestegy.com/bg3/builds)
were used to sanity-check the generic martial/thrower/caster/control/support
archetypes, not copied as gear mandates or treated as a numeric mechanics oracle.

Permanent tests: closed DTO/provenance/identity, all classes/levels/subclasses,
independent math oracles, tiny exhaustive solver oracle, Story adapter/isolation,
source/spoiler projection, scarcity/reservations/locks, NewAge malformed and exact
owner-map fixtures, real generated Worker capability, deterministic bundle parity,
packaging. Native Chrome QA is in `scripts/qa-planner.cjs`: disposable profile,
blocked backend/writes, 320/390/768/1280, manual/party/source/scenario/keyboard/
spoiler/Story navigation and optional explicitly authorized local-save measurement.
No private fixture, save path/hash, raw entity ID or payload belongs in this file.

## Sanitized real-save compatibility result

The original measurement rejected profile `134217985` (not profile `1`). That
unsupported result was correct for the earlier reference-only implementation.
The current reader now has a separate, independently implemented strict profile:
`lsmf-08000101-tag123`. The authorized read-only rerun surfaced **four anonymous
candidates**, each with direct level, current class split, mapped subclass and
observed effective abilities. No private
values or identifiers are recorded here. Source fingerprint/stat stayed unchanged.

## Strict real-profile capability and safe limits

The 48-byte header must have exact profile `0x08000101`, marker 32, reserved tail
zero, and exact arena/table/name accounting. Name length is u32; the following
u32 is constrained to the observed opaque tag 123, never used as an entity count
or identity. Interpreted components have exact names, versions and strides:
Level 0/32, EntityId 0/16, Character 0/1, Player 0/1, Stats 3/36, direct Level
0/4, Classes 0/16. Unknown component contents/versions remain opaque and cannot
supply fields.
A different tag/profile/layout stays unsupported; there is no profile bypass.

The complete directory and owner-map envelope are checked before output: finite
counts/ranges, array/name overlap, unique names/entities, unique component maps,
exact owner count, unique/in-range owner indices, metadata alias rejection.
Empty owner-map buckets require exactly three all-ones pointers plus count zero.
The Level component is selected by exact name, not its directory position.

Candidates require the SAME explicit owner index in player, character and stats
maps. Direct level is independently read from that owner's current level
component, only in the supported 1–12 range. It is never progression length,
XP, class total, identity or adjacent row. These values are partial Detected fields
in the existing BuildSnapshot. Observed abilities never become base abilities.
A candidate is not a proven companion identity or current-party membership.
Selection is explicit; reading never adds a planner party automatically.

Current classes use that SAME owner's direct ClassesComponent vector, with
bounded 40-byte ClassInfo records and metadata/fixed-array alias checks. The
public serialized reference describes its level as u64; BG3SE's primary ClassInfo
declaration instead defines **int32 Level** plus alignment padding. The u64
attempt was rejected; independent int32 fixtures with zero/nonzero/all-ones
padding and the read-only rerun established the narrow supported layout. Padding
is not a level or an identifier. Class GUIDs use the reviewed pair-swapped
encoding, then a finite pinned map (12 base classes / 46 mapped subclasses).

Every class level must be 1–12, class names unique and their sum exactly equal
to the independently detected direct current level. Unknown class IDs, duplicate
classes or contradictory totals yield Classes Unknown; invalid pointers/ranges
reject the whole result. Unknown or wrong-class subclass IDs stay Unknown with
an issue, never a companion/default subclass. Mapped subclasses must meet the
existing class level threshold. Current class totals are unordered: **no level
order, starting class or current level-up choices are inferred**. Progression and
character-creation history are never used to patch missing current fields.

Feats/ASI, base abilities, proficiencies, spells, choices and passives remain
Unknown/manual. An unknown list is never confirmed empty. Manual overrides remain
in force; a separately overridden level that conflicts with detected class totals
keeps Classes Unknown until the user resolves the discrepancy.

Party was investigated independently. A Player marker and party-member component
exist, but a component name or matching count is not proof of the exact current
party relation. Live Party Member definitions include runtime EntityHandles; no
reviewed serialized translation was established. No IN CURRENT PARTY claim ships.

Equipment was investigated independently. Wielding references have a structural
EntityId shape, but that is not the full character → current slot → exact item
instance → catalogue proof. Serialized MemberData does not justify treating every
tail word as a slot. Public sources disagree about stale container rows and
runtime handles. Main/offhand and ring 1/2 are never assigned by order, stats
family, CurrentTemplate or occurrence. **Zero automatic equipped slots**, ownership
Unknown, no inventory quantities or Tracker-found changes.

Manual overrides survive subsequent reads, Clear and replacement. Detection is
retained underneath overrides while valid; Clear removes detected values and
provenance immediately from both DTO and DOM. Unconfirmed manual drafts survive
candidate selection. Selection change cancels pending work before another
character is rendered. Existing Story/account/spoiler/close/new-file/deadline
invalidation and single-use Workers remain active. Anonymous candidates expose
no companion names before the existing Act visibility gate.

The only private payload read is Globals through the existing validated archive,
resource and exact root NewAge/NewAge capability. No meta, SaveInfo, LevelCache,
StorySave, thumbnail or new codec was needed. Payloads stay in memory. No raw
buffer capability reaches UI. Per-field output is restricted to level, reviewed class/subclass totals, observed scores, opaque
session references and fixed issue codes. No raw UUIDs are returned. Source diagnostics use
counts only; browser captures use synthetic/manual data before private reading.

The unchanged limits are 128 MiB file/member, 512 MiB aggregate expansion, 30s
aggregate UI/Worker deadline and 2M identity steps. The validated read consumed
about 22.8 MB expansion; browser reading was within the deadline. Performance is
not a promise that other profiles/saves will decode. All structure failure paths
return no partial candidates. Generic parser, codecs and research limits remain
unchanged. Public packaging retains 51 paths; source/test/docs remain excluded.

Permanent independent synthetic tests cover both profiles, malformed directories,
versions, tags, unsafe integers, overlaps/aliases, duplicate entities/maps/owners,
wrong-owner association, row reordering, opaque history/equipment, exact class/subclass and unknown-ID gates, exact
work-limit boundary, cancellation, DTO provenance and manual overrides. Native QA
uses the actual generated Worker, four widths and disposable contexts with all
backend/write requests blocked. The real file never enters a fixture or screenshot.

Primary references (read as format leads, never executed/imported):
[original ImHex format research](https://github.com/LennardF1989/BG3-ImHex-Patterns/blob/master/ImHex/includes/bg3/lsmf.pat),
[pinned NewAge reference](https://github.com/NodeJSmith/bg3-newage/tree/c3372b1988109a2fd1d35897e1895e387f7a916e),
[serialized-format research](https://github.com/danielsamuels/bg3-savefile-parser/blob/9578ff7c46a1aa40c805f6b7beecf907f10fb3b8/FORMAT.md),
[header/type-record cross-check](https://github.com/Wahkah/BG3SE/blob/main/src/bgse/formats/lsmf.py),
[live Stats/ClassInfo definitions](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Components/Stats.h),
[live Party definitions](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Components/Party.h),
[live Inventory definitions](https://github.com/Norbyte/bg3se/blob/main/BG3Extender/GameDefinitions/Components/Inventory.h).
Live structures and heuristic upstream joins are not serialized semantic proof.

Next milestone: independently prove the explicit identity/party/entity relation
and current progression/choice semantics using controlled ground truth on authorized surfaces.
Keep unsupported fields Unknown; do not repair them with adjacency, XP, build
similarity or pre-respec history. Equipment additionally needs a reviewed current
slot/instance/catalogue chain, independently of party/build detection.

Additional spell-action rotations under Haste/Bloodlust/Action Surge are explicitly
UNMODELED rather than evaluated as if the extra actions did not exist. Disable
those assumptions for the supported base spell comparison. Martial extra-action
profiles remain explicitly modeled and independently tested.

Non-healing support utility (such as Bless) is not ranked as fake healing. The
supported support comparison uses Healing Word with declared resources. Negative
physical damage-floor cases are explicitly unmodeled. Capped ability bonuses
never reduce an already-higher manually confirmed baseline.

Weapon proficiency accepts an exact reviewed weapon type as well as a confirmed
simple/martial category. A Wizard can declare Quarterstaff without being granted
all simple weapons. Generic class fixtures use explicitly partial relevant
proficiency lists, never invented universal armour/weapon training.

## Save-source UX and mechanics hardening

Build source is the visible first step: **Load build from BG3 save** or **Create
build manually**. The save picker and drop area are never inside a disclosure.
Selection requires an explicit current-Story session association. Replacement,
Clear, association removal and security-context changes cancel obsolete work and
clear detected observations/candidates without deleting manual corrections.
Unsupported/malformed profiles offer a clear manual continuation. The source UX also supports the strict 1.1 profile documented above; no new save
surface or codec is introduced.

The source state is per selected character: manual or save-assisted, with idle,
selected, reading, decoded, unsupported or invalid substate. File objects and
candidates stay in session memory; no file name is transmitted or logged.

Typed reusable rules in effects.cjs specify scope, target, explicit condition,
magnitude/dice/type, frequency, hand, stacking, duration, cost, support and source.
combat.cjs models one bonus-action pool, Thief Fast Hands, melee offhand ability
conditions, Champion crit, explicit Sneak Attack, Smite first-hit resource
distributions, Paladin 11's Improved Smite, declared styles and optional All In.
Weapon enchantment/dice/riders are per active hand. Rerolls and flat/dice crit
semantics use independent numerical oracles. GWM bonus attacks are kill-round
gated; the additional crit-trigger branch remains unmodeled, not guaranteed.

New reviewed families include STR-damage weapons, casting-ability weapons,
conditional elemental/psychic/radiant riders, crit thresholds, on-crit flat
riders, concentration/coating effects, elemental cantrip augmentation,
Spellmight auto-toggle, Scarlet Remittance declared stacks, unarmed/ranged
bonuses, setters/capped bonuses/penalties, DC/AC/initiative/concentration gear,
one-use long-rest Arcane Battery and finite on-hit reactions. No DRS chains,
inactive stat-stick sets, extra spatial targets or automatic kills are inferred.

All 555 identities carry conservative recommendation-importance triage. Unknown
equipment roles are HIGH until reviewed. Distribution: HIGH 17 SUPPORTED /
72 PARTIAL / 415 UNMODELED; MEDIUM 3 / 1 / 47; LOW 0. This is an explicit
triage boundary, not a claim that 555 mechanics were fully researched. In Full,
Needs manual review lists high-impact unmodeled and partial competitors.
Unmodeled items are excluded; partial items compare only reviewed dimensions.
No exact superiority over omitted effects is claimed. Minimal/Light construct
none of this review/ranking/mechanics DOM and never evaluate hidden mechanics.

Search has hard local evaluation allowances within the unchanged aggregate
20k / 2M / 5s ceilings. Resource-heavy Smite searches get smaller local budgets
(900 personal / 300 scarcity) so a four-character six-round plan remains useful.
Truncation is explicit; it is not a global optimum claim. Public packaging
remains the same 51 paths. All original Tracker, guide, import, parser, codec,
progress, transport, service-worker and deployment settings are unchanged.

Primary facts: per-item Wiki sources in gear-data.json and the rule pages:
[Offhand](https://bg3.wiki/wiki/Off-Hand_Attack_(Melee)),
[Fast Hands](https://bg3.wiki/wiki/Fast_Hands),
[Sneak Attack](https://bg3.wiki/wiki/Sneak_Attack_(Melee)),
[Divine Smite](https://bg3.wiki/wiki/Divine_Smite),
[Improved Smite](https://bg3.wiki/wiki/Improved_Divine_Smite),
[Organ Rearranger](https://bg3.wiki/wiki/Organ_Rearranger),
[All In](https://bg3.wiki/wiki/Great_Weapon_Master:_All_In),
[Sharpshooter](https://bg3.wiki/wiki/Sharpshooter:_All_In).
The current Wiki's Gloves of Crushing double-applied attack passive is explicitly
approximate/patch-sensitive. Historical Graceful Cloth (Araj) remains unmodeled
and distinct from the current Esther item; no DEX bonus was copied across.

The common-build quality matrix covers melee/ranged martial, dual wield, 2H,
shield, monk, throw, rogue/Thief, crit, Smite, spell/multi/control/support,
multiclass order, burst and conservation. Native browser regressions exercise
picker, drop, association, replacement, malformed/unsupported fallback, Clear,
timeout, oversize, late Worker rejection, 2–4 party members, four widths and
spoiler/Story isolation in disposable contexts. Private saves never enter tests.

Melee Caster was cross-checked against the shared passive notes, not just its
misleading attack-only tooltip: both Sylvan Scimitar and Infernal Rapier use the
highest available class casting modifier for attack and damage, and never grant
it to the other hand. A sole noncasting Fighter/Rogue uses the explicit casting
ability assumption because origin/default ability is not inferred.
[Reviewed passive](https://bg3.wiki/wiki/Melee_Caster).

## Exact origin identity extension

The strict 1.1 profile now permits one additional field: an explicitly allowlisted
origin definition attached through the **same validated owner** as Player,
Character and Stats. See [the proof and remaining boundaries](planner-identity-equipment.md).
This supersedes earlier checkpoint statements that every candidate is anonymous;
the reference profile still emits anonymous observations only. Build fields,
current-party uncertainty, equipment uncertainty and all resource ceilings stay
as described above. Neither class defaults nor inferred body/stats adjacency
participate in identity resolution.

Identity stays session-local in the existing BuildSnapshot detected/override
field. The existing explicit Act roster gates candidate headings, selected party,
editor values and conflict labels before DOM/accessibility output. Dark Urge is
shown only after an Act reveal in Full. Counts/order do not depend on concealed
identity. Clear/replacement/context invalidation clears detections; manual
corrections remain. Candidates may be explicitly used or ignored; no automatic
party is constructed. The Full-only equipped panel distinguishes all twelve
melee/ranged/accessory slots while leaving unproven slots Unknown. It does not
create equipment locks, claim ownership or mutate Tracker progress.
