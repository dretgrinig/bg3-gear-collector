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

Independent LSMF v1 envelope reader: relative base 48; component table records 48;
core.v0.Level version 0 / 32 bytes; owner map records 32 / indices u32; reviewed
Stats v3 version 0 / 36 bytes; progression v3 version 0 / 16 bytes; level-up data
v3 version 0 / 96 bytes. Table/range/count/overlap/duplicate/reference validation
precedes output. Entity IDs stay internal and are never emitted. Component-owner
association uses only exact owner maps. Stats candidates must also have nonempty
validated progression references. Candidates are anonymous and explicitly chosen,
never automatically added as an active party. No partial fields on structural
failure. Unknown/missing/unsupported profile => manual completion.

Currently promoted automatic field: **observed effective abilities**. Identity,
active party, current level/classes/subclasses, feats/ASIs, base abilities,
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

The previously authorized save was read through the production build-reader
Worker after synthetic and native-browser gates. Archive/Globals structural
processing respected existing limits. Its LSMF header profile is `134217985`,
which differs from the independently supported reference envelope profile `1`.
No automatic fields were promoted. Manual completion and optimization succeeded.
The source fingerprint/stat remained unchanged. No private values, paths, hashes
or payloads were retained in git. This is an explicit unsupported-profile
boundary, not a claim that the real save has no characters or build information.

The current positive auto-detection coverage is synthetic/native-Worker proof
for the pinned reference profile, **not demonstrated real-save build recovery**.
Expanding that reader requires independently reviewing the evidenced envelope;
this milestone does not accept unknown layouts by bypassing validation. Profile
compatibility metadata is structural research only; no new ownership evidence.

Next priorities: review that current LSMF envelope and public class/feat mappings;
review additional mechanics beyond the 93-item current comparison surface;
extend action schedules/resources/inactive-weapon sets and subclass rules with
independent oracles. Boss/Party scenario extensions can reuse typed build fields,
scenario, strategy action source/budgets/concentration, per-loadout metric vectors,
resource capacities and the deterministic joint solver. They must not add hidden
cross-unit scores or infer live resources/spatial relations.

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
Unsupported/malformed profiles offer a clear manual continuation. Detection remains
limited to the same reviewed reference profile; no new save surface or codec.

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
