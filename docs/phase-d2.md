# Phase D2: opt-in versioned progress client

The transport is **disabled by default**. Nothing in this change enables the
flag or changes the configured backend, D1 SQL, schema, or deployed protocol.
All validation here uses the mocked app and the disposable D1 PostgreSQL suite.

## Gate and deployment boundary

An isolated test deployment may provide `window.BG3_PROGRESS_PROTOCOL` before
the main app script, with `enabled: true` and `isolatedBackend` equal to its
separate `BG3_CLOUD_CONFIG.supabaseUrl`. A preview hostname alone is not an
isolated backend. The existing shared Supabase project is explicitly blocked,
including equivalent URL spellings. The test harness uses a non-network `mock`
backend. No production activation is included.

Versioned mutations also require a verified authenticated session and owned
Story list, a coherent validated snapshot with `protocol_enforced === true`,
a durable client identity/checkpoint/immutable operation journal, and Web Locks
support. Unsupported capabilities keep cached progress and export usable while
blocking mutations. Missing RPCs, malformed responses, disabled enforcement,
and SQLSTATE `55000` never select the legacy table transport. With the flag off,
the existing transport and import behavior remain unchanged.

## State and ordering

- `unknown`: validate session → Stories → ownership → coherent progress snapshot.
- `ready`: edits carry a trusted decimal-string base revision and immutable UUID
  token. Revisions use canonical decimal strings and BigInt comparisons only.
- `pending`: persist one immutable operation UUID, expected revision, exact
  ordered changes and captured tokens before dispatch. Persist uncertainty before
  handing the request to the SDK.
- Unknown outcome: retain that operation and retry its identical ID/base/payload
  after revalidation, even if a fresh snapshot has advanced. D1 receipts decide
  whether it already committed; a receipt never replaces a newer snapshot.
- `review` / `conflict`: preserve local intent and stop new writes. Fetch current
  cloud state, then let the user explicitly choose selected local intent or cloud
  values. A changed revision never silently rebases independent local edits.
- `readonly` / `blocked`: preserve cache, journal and memory intent; show the
  reason and keep export available. Healthy cloud sync remains successful when
  later local persistence fails.

An acknowledgement clears only the tokens captured in that operation. Newer
edits remain dirty. Edits depending on an in-flight operation can obtain its
successor base only after its receipt and a matching coherent snapshot; external
revision advancement requires review instead. Same-revision inconsistent rows
or a snapshot older than a known acknowledgement are rejected.

Transport passes and initial durable client-ID creation are serialized with a
browser lock scoped to backend/user. A queued lock has a bounded wait and checks
the captured auth/backend/Story/map again before requesting anything. No polling
or lock retry loop is added. Existing recovery single-flight/cooldown/manual
retry rules remain in effect.

Checkpoint persistence has its own short lock scoped to backend/user/Story/client,
separate from the transport lock. Edits update memory immediately, but remain
non-durable until the locked reread, reconciliation and write complete. Queued
saves coalesce and use current memory after acquiring the lock; journal/head
creation and dispatch uncertainty use the same checkpoint lock. Failed lock or
storage attempts stop without automatic retry. Transport awaits persistence and
rechecks the captured context before continuing.

Unacknowledged edit tokens outrank stored timestamps and retained acknowledgement
display. Distinct competing tokens are retained as a primary edit plus per-item
`alternatives`, with their exact token, status, timestamp and base metadata. A
checkpoint lock orders persistence, not user intent; it never settles another
tab's token. Both alternatives survive reload and appear in review and export.
Existing v1 checkpoints without `alternatives` load as having no competitors;
supplied alternatives must validate before their checkpoint is accepted.
New operations pause until explicit resolution; an existing immutable operation
can still resolve its exact unknown outcome. Its receipt settles only its captured
tokens, promoting any surviving alternative to review rather than acknowledging it.

Review chooses an exact local token or the current cloud value for selected items,
settles only those items' observed candidates, and creates a fresh reviewed token
for a kept local value. The rendered form captures an immutable boundary containing
the scope, revision and exact candidate token sets, plus its auth/backend/Story-map
context. Both buttons validate that boundary before resolving anything. If a
selected item's candidates or cloud revision changed, the entire stale action is
rejected without settling tokens or creating an operation. A candidate arriving
after a valid choice remains unresolved.
Unrelated rerenders preserve inclusion and selected alternatives for unchanged
item sets in the same context and revision. Changed sets are unchecked and their
local selection cleared, requiring fresh confirmation against the displayed set.
Review after an acknowledgement waits for a fresh snapshot. Direct subsequent
edits supersede only the primary token they actually observed; alternatives remain
for review. Settled tokens cannot be resurrected by another tab's stale checkpoint.
Restored item dictionaries use null prototypes, including for `__proto__` keys.

Responses first validate the captured auth/backend generation, then status and
body; current-generation failures close the appropriate gate even after a
Story switch. Only the current Story and fresh record-map identity may merge or
acknowledge. Logout/account changes invalidate the context without deleting
Story caches or journals.

## Legacy caches and storage

Original v7 Story caches remain untouched in versioned mode. Legacy dirty edits
have no trusted base and remain visible/exportable, but cannot upload before a
cloud snapshot and explicit review. Persisted per-item legacy fingerprints keep
an unchanged, already-reviewed original cache from resurrecting old intent after
reload. Clean legacy rows provide cached display until cloud verification and
are never automatically uploaded. v5/v6 merge-import parsing remains supported. Opt-in exports include explicit
`todo` statuses so memory-only unchecks are captured; default exports are unchanged.
The optional `versionedProgress` export field preserves primary and competing edit
tokens for review/backup. It is not trusted revision metadata for v5/v6 imports.

Protocol state is scoped to backend/user/Story/client; immutable journals carry
that complete scope. Corrupt/inaccessible journals fail closed and preserve raw
storage. Failed writes retain memory intent with a durability warning. A changed
established client ID cannot silently replace an unresolved journal. Recovery of
an initially unreadable ID preserves volatile edits as untrusted review intent.

## Deferred and verification limits

D3B adds opt-in client merge-import, replace-import and reset support; see
[Phase D3B](phase-d3b.md). Atomic bulk actions require the separately reviewed
D3A RPC in an isolated backend. Nothing activates the deployed versioned flag.
Production cutover, hosted JWT/PostgREST integration and privileged-writer
verification still require a separate isolated environment and approval.

Operation journals and settled-token history deliberately have no automatic
cleanup in this draft. A future retention policy must never remove unresolved
requests or resurrect settled intent; quota failure blocks new dispatch and
keeps memory/export available.

Run app tests with `node --test tests/*.test.cjs`. Run the unchanged D1 database
suite with `PG_BIN_DIR=/absolute/local/postgres/bin node tests/database/run.cjs`;
it creates and removes its own private local cluster and accepts no remote DSN.
