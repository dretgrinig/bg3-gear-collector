# Planner save / Story safety (v0.11.1)

## Evidence boundary

The existing bounded reader selects only Globals.lsf → exact root NewAge/NewAge.
The reviewed profile-63 and profile-123 output contains character/build evidence,
not a proven campaign key or monotonic save sequence. The existing identity,
Creator/Template, inventory and party relations identify entities inside one
snapshot; they do not prove a run identity. SaveInfo compatibility/display fields
and opaque session-looking fields have no reviewed cross-run stability contract.
No new serialized surface was opened, no private save was reread, and no decoder,
profile, limit or equipment-proof rule changed for this milestone.

Therefore no deterministic run identity or timeline is claimed. Filename, file
mtime, Tav identity, party/gear/level similarity and upload time are never used.
There is no run fingerprint, raw UUID, timestamp history or persistence.

## Affinity / freshness

- **UNVERIFIED**: default after every new save; no automatic Story Gear combination.
- **MATCHED / manual-session**: only after an explicit user confirmation for the
  selected Story and this successful loaded snapshot. UI says “confirmed by you”
  and “not verified from save identity”. It is not engine-proven identity.
- **MISMATCH**: the gate rejects it, but the current reader cannot prove a different
  run, so the application does not fabricate this state or a matching Story.
- **Freshness UNVERIFIED**: independent of manual affinity; warning remains even
  after linking. No CURRENT_OR_NEWER or OLDER_THAN_LAST_ACCEPTED promotion is
  implemented without deterministic monotonic evidence. Consequently an old save
  cannot be automatically detected; confirmation does not make its timeline proven.

Multiple saves require renewed confirmation even if they look identical. Reusing
an association across them would invent run continuity. Deterministic run/time
support needs separately reviewed evidence, not a heuristic extension here.

## Source gate and provenance

Always-visible Save & Story panel shows local load state, current Story label,
manual/unverified affinity and unverified timeline. Read without linking uses
Theoretical; explicit session linking enables Story Gear. Unlinking removes
results immediately. Source switching invalidates recommendations and reservations
are still checked against the chosen pool. Engine gates Story Gear before source
projection, candidate generation, counts, mechanics or explanations. Detected fields
without a valid context-bound confirmation also fail closed. Theoretical stays
available regardless of affinity. Story Gear continues to mean Tracker Found.

No guessed Story switch action is offered. Current evidence is informational and
never promotes Found, quantity or ownership. Both source modes retain existing
spoiler projection and Current/Proposed separation.

## Scope, replacement and races

One loaded save is shared as candidate evidence across character drafts. Choosing a
candidate is explicit; no automatic party fill. Starting a replacement clears the
previous save snapshot, its confirmation, results and save-scoped assumptions.
The full new response is validated before atomic commit. Corruption, unsupported
profile, timeout, cancellation and stale Worker results leave no partially loaded
snapshot. Job generations and exact opaque transaction tokens reject old replies.

- Character drafts created manually before any save are session-level and retained
  until they become save-assisted.
- Detection and all edits confirmed while a save is loaded are save-scoped.
  Replacing/clearing the save resets those drafts, overrides, locks, labels and
  explicit camp inclusion. Switching detected characters resets old character
  overrides too.
- Reservations reset when replacing/clearing a save; strategies, scenario, source
  preference and Act preference are session-only (security context resets Act).
- Story/account/backend context changes clear loaded evidence and session builds,
  rather than carrying a manual association across security contexts. A→B→A does
  not resurrect it. Rename changes only the Story label; exact opaque context
  identity remains. Same-name Stories remain separate. Deletion cannot redirect
  an association or resurrect data. The label is escaped text, never an identity.
- Leaving/re-entering keeps a completed local session. Pending work is cancelled.
- Stricter spoiler mode clears save evidence and detailed equipment state.

Clear loaded save affects only planner-local state, never the Tracker Story or
progress. No raw save data, identifiers, association map or localStorage keys are
created. Payload decoding remains local/in-memory in a single-use bounded Worker;
no backend capability is passed to the planner. Existing legacy transport, auth,
PWA retirement and versioned-default-off settings remain unchanged.

## Verification

`tests/planner-save-safety.test.cjs` uses fabricated independent session decisions,
production engine requests, rejection assertions and mutation checks. The existing
engine fixture explicitly models user-confirmed association when testing detected
builds; dedicated missing/stale/unverified/mismatch receipt tests prove the gate.
`tests/planner-save-safety-adapter.test.cjs` checks real readonly adapter identity,
rename/delete/same-name behavior and absence of reads/writes. The existing strict
whole-shell byte guard accepts exactly the new presentation label addition.

`node scripts/qa-planner-save-safety.cjs` uses disposable Chrome contexts, fabricated
saves through the actual reader/optimizer Workers, blocked backend/write requests,
all four widths, keyboard actions, context changes, replacement/clear, malformed
load and cancellation/race recovery. It has no real-save hook. Optional
BG3_QA_ORIGIN selects the develop preview for the same assertions; no live account
profile or real Story is used. Packaging remains the same 51-file public allowlist;
new source/tests/docs are excluded. The generated save-reader Worker is unchanged.
