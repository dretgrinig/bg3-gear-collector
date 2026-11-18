# Party-aware Top-3 loadout proposals

Baseline: `a45c3586c7b40849ea24078a1c4a712a6089b040`.

## Meaning of each rank

- **Current**: existing detected save equipment or the session manual override.
- **#1**: the chosen character's loadout in the joint feasible party allocation.
- **#2**: the best retained evaluated alternative excluding that character's #1
  canonical loadout signature, while all other characters keep their #1 choices.
- **#3**: the next such counterfactual, excluding both #1 and #2 signatures.

Cards show modeled AC alongside the primary objective so equal-output ties are
readable. Weaponless martial proposals are explicitly marked baseline-only/manual
review, never evidence that the current slot is Empty.

These are full loadout proposals, not isolated per-item BiS lists. Excluding a
loadout does not forbid every item it contains. Ring swaps with the same item
set are one signature, never another rank. A missing alternative is explicit;
there are no invented fillers. Only #1 choices form the simultaneous party plan.
Do not combine #2/#3 from several characters without recomputing allocation.

## Existing bounded engine, stronger allocation presentation

The existing mechanics/score/build/scenario pipeline is reused unchanged. Source
items and locks are canonicalized before bounded seed generation. Supported
current items in the selected source can seed a proposal; no whole-current-build
score is invented from partial slots. A maximum of eight retained candidates per
member goes through the existing exhaustive joint solver (at most 9^4 terminal
combinations per solve, including unassigned). At most four additional bounded
refinements insert up to three already evaluated feasible alternatives per member
and re-solve. The previous chosen allocation remains available in each refinement,
so the party objective cannot decrease. All work shares the existing 20k scoring
attempt, 2M step, 5s deadline/cancellation and 1 MiB output bounds. No unbounded
catalogue Cartesian product is introduced.

Results remain **best among retained evaluated candidates**, not a global BiS
claim. Truncated generation or unfinished refinement is visible. Within this
bounded pool the solver maximizes the sum of comparable primary objectives.
Mixed damage/control/healing roles keep the existing lexicographic policy, now
in stable natural character-ID/creation order, independent of array order. Their
units are never silently added or described as a proven common utility metric.
AC, fewer claimed resources, and canonical signature break objective ties.

Contests identify the allocated member and whether the reason is the modeled
party total, explicit mixed-role priority, or a hard lock/reservation. This is
not an unsupported precise marginal-gain claim. Scarcity alternatives respect
all other #1 assignments and all hard intent.

## Current equipment and source policy

The exact holder/slot/catalogue proof and Unknown/Empty boundary are unchanged.
Projected current keys are shown separately from proposals. Current holder
annotations distinguish keeping gear, proposed transfers, and multiple observed
holders with unproven physical-copy capacity. No observation adds copies, Found,
locks, reservations, inventory ownership, or a backend write.

**Story Gear still contains only items marked Found in that Story.** A detected
current item outside that pool stays informational, with a warning. Theoretical
uses projected catalogue entries irrespective of Found. Current source entries
with unmodeled mechanics are warned and excluded from numerical seeding/ranking;
partial high-impact competitors retain the existing manual-review warnings.
Mechanics support, catalogue data and scoring formulas are unchanged.

Only the selected proposed weapon strategy maps current ranged-main to the
modeled active `weapon` slot. Inactive melee/ranged stat sticks are not inferred.
No active set, ranged-offhand, unknown Empty or 2H-blocking evidence is invented.
Current is never overwritten; manual override removal restores retained detection.
Removing the last equipment lock also clears its override rather than leaving a
false confirmed-empty equipment list.

## Party and spoiler boundaries

Known camp/benched characters are excluded by default. A visible session checkbox
explicitly includes them; it does not relabel the save party state. Unknown-party
manual drafts are explicitly selected planner members. A hard reservation for an
excluded camp member blocks calculation until the user includes that member or
removes the reservation; it is never silently reassigned. No automatic party-fill,
new save reading, multiplayer broadening or ownership research occurs.

Minimal/Light return their existing unranked projection before current analysis,
mechanics lookup, ranking, counts, contests or manual review. Full projected-out
keys cannot seed or appear in current/rank explanations. UI identity labels still
use the shared Act roster. Stricter mode/Act/Story invalidation and cancellation
retain the existing node/state/progress/persistence boundaries.

## Regression and browser strategy

Permanent regressions use tiny independent pools and exhaustive two-character
score/allocation oracles, independently checking #1 party total and conditional
#2/#3 feasibility. They cover two/four-member marginal contests, keep/replace/move,
source modes, hard intent, camp scope, unknown slots, unreviewed mechanics, manual
corrections, projected-out identities, duplicate observations, ring signatures,
and input-order determinism. The existing current-gear test now verifies the
new informational fields and exactly charged current-entry steps while retaining
full equality of scoring, capacity, allocations and the remaining result.

Native Chrome QA exercises the real generated reader and optimizer Workers at
320/390/768/1280: three rank cards, Current vs Proposed transfer, joint capacity,
alternative feasibility, locks/reservations, detection after override removal,
camp exclusion/inclusion, keyboard focus, overflow, stricter spoiler DOM and
accessibility removal, no Tracker/storage/backend writes. No private save is
needed or read for this milestone.

The public artifact remains 51 files. Only planner UI/CSS/core/optimizer assets
change; save reader, parser/codecs/limits, acquisition data, Tracker, guide,
Story/progress/auth/transport/PWA and deployment configuration remain unchanged.
