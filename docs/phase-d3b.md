# Phase D3B: opt-in import and bulk progress client

Versioned transport remains disabled by default. No SQL, shared backend config,
Supabase migration, production connection or cutover is part of this change.
The normal deployment still selects the existing legacy transport. Bulk semantics
below apply only to the explicitly enabled isolated versioned profile.

## File validation and context

Before reading a file, capture its unique attempt, mode, user, Story, auth/backend
generations, SDK client, backend URL/scope, versioned engine, record-map identity
and observed edit tokens/bulk identity. Recheck after reading, after confirmation,
after client identity bootstrap and within the checkpoint lock before staging.
Story A→B→A, account/logout, mode changes and overlapping reads invalidate older
attempts. A newer attempt cannot be overwritten by an older read. Failed/cancelled
input remains selected for retry; no file is modified.

Parse and validate the entire status map before staging any intent. v5 boolean
maps and v6 items/state/status maps remain supported; true/false mean found/todo.
Keys normalize with trim/lowercase, collisions reject the entire file, and unknown
catalogue keys are kept. Invalid structures/statuses, duplicate normalized keys,
more than 5000 supplied records, overlong keys and payloads exceeding the D1/D3A
1 MiB bound reject before mutation. No non-atomic chunking is used. Dictionary
operations preserve own prototype-shaped keys. Imported revision/journal metadata
cannot establish trusted server state.

## Durable staged intent and ordering

Merge imports update only supplied item intent and use the existing D1 patch RPC.
One observed trusted primary may be superseded by the import's direct successor.
Competing, untrusted or newer tokens remain alternatives requiring explicit review.
Omitted items receive no clearing intent.

Reset/replace stage one bulk descriptor per backend/user/Story/client, containing
an immutable intent UUID, mode, exact supplied records/payload fingerprint, observed
tokens and trusted base or dependency. Reset records are []; replace supplies only
the imported records. Clearing is always derived by D3A from authoritative database
rows, including cloud-only/skipped rows, never from the client catalogue. Empty
replacement/reset require confirmation and are supported.

A descriptor is durable only after coordinated checkpoint persistence succeeds.
First offline staging bootstraps the client identity under the existing account
Web Lock; adopting a different identity cancels the captured import safely. Lock
and storage failures preserve scoped memory/export, warn about durability and
block sends. A different recovered client ID cannot discard an existing memory-only
bulk descriptor; it remains exportable with dispatch blocked. Only one staged bulk descriptor may exist; a second action cannot
replace it. A changed stored payload under the same UUID fails closed.

An older immutable patch head resolves first. Bulk waits for its acknowledgement
and matching coherent snapshot; external advancement requires review. Checkbox
edits after staging depend on the bulk barrier, remain separate, and never enter
the bulk records array. Bulk acknowledgement settles only exact captured tokens.
Later/unseen alternatives survive. The next patch waits for a snapshot containing
that bulk acknowledgement; stale snapshots/caches cannot resurrect cleared rows.

## Dispatch, retry and conflict

The single unresolved operation journal supports either the unchanged D1 patch
shape or a bulk shape with kind, Story, decimal-string expected revision, operation
UUID, mode and records. Bulk uses bg3_bulk_progress_v1; patch continues using
bg3_mutate_progress_v1. Journals and checkpoint heads are coordinated and must
match exactly before sending. Unknown outcomes retain and retry the same UUID,
base, mode and records, including after reload. An old receipt acknowledges only
its captured intent and never replaces a newer coherent snapshot.

Normal revision conflicts retain the descriptor/local intent and enter review;
they do not mark Supabase unavailable. Bulk review captures cloud revision,
scope/client, exact candidate token sets and bulk identity/payload fingerprint.
Both whole-operation buttons reject changed boundaries before resolving anything.
Keeping bulk creates a new UUID at the explicitly reviewed revision; releasing it
preserves later checkbox intent for separate review. Unseen competitors cannot be
settled by the old displayed form. Pending immutable RPCs must resolve first.

Dispatch still requires session → Stories → ownership → validated coherent snapshot
→ reconciliation → writes, verified availability, durable identity/journal/checkpoint
and protocol_enforced === true. Missing RPCs, malformed responses, disabled protocol
or 55000 never fall back to direct table writes. Generation/map guards reject obsolete
responses; current-generation malformed responses close the backend gate even after
switching Stories. Existing single-flight/cooldown/bounded lock rules remain in use;
no polling/retry loop is added. Cloud success stays successful if later local saving
fails; exports include staged bulk, pending operation and competing tokens.

## Verification boundary

Tests execute the real handlers/engine with deterministic file, SDK, clock, storage
and lock mocks. The database suite runs real independent PostgreSQL sessions in a
private disposable cluster. Neither suite connects to production. Hosted JWT,
PostgREST bigint/JSON/RPC routing, effective grants, schema-cache lifecycle and
privileged writer closure still need isolated verification before activation.

Automatic orphan-journal cleanup, tombstone/receipt retention, production cutover,
UI polish and catalogue changes remain deferred.

## Verification results

| Run | Result |
| --- | --- |
| New regressions against approved D3A client | 78 failed, 15 passed (93 total); none skipped/cancelled |
| Full app suite after implementation | 411/411 passed, including all original 318 and 93 D3B regressions |
| Existing D1 database suite | 57/57 passed |
| Existing D3A database suite | 72/72 passed |

The tests-first baseline uses the approved HEAD HTML/engine under temporary paths,
without reverting the working tree. Additional implementation edge cases also had
focused failing runs before their fixes. Temporary PostgreSQL processes/clusters
and runtime were stopped and removed after database verification.
