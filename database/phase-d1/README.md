# Phase D1: local concurrency protocol draft

This directory is a review draft, not a deployment instruction. No hosted migration
has been applied. The current client, `config.js`, original `supabase-schema.sql`,
existing RLS policies and v5/v6 import behavior are unchanged.

## Files and staged activation

1. `001_progress_protocol.sql` adds three protected tables and two versioned RPCs.
   It preserves the legacy protocol and initializes `enforced=false`. Snapshots work;
   mutations fail with SQLSTATE `55000` until the optional cutover.
2. `002_enforce_progress_protocol.sql` is a separate, incompatible cutover draft.
   It drains in-flight work, blocks direct progress mutations, checks effective
   browser-role privileges, invalidates all existing base revisions, and only then
   enables the mutation RPC. It must not be applied while the deployed client still
   relies on direct upserts. Re-running an already enabled cutover does not bump
   revisions again.
3. `rollback_002.sql` is **operational rollback = read-only progress safety mode**.
   It drains accepted mutations, keeps direct legacy INSERT/UPDATE/DELETE revoked,
   checks effective browser-role privileges, and disables the mutation RPC through
   its locked control flag. Owner reads, progress, revisions and operation receipts
   remain intact. Delayed and queued legacy requests stay rejected; rollback never
   restores blind writes. Repeating rollback does not advance or reset history.
4. `rollback_001.sql` is **destructive local/dev teardown only, never production
   operational rollback**. It removes the added functions and revision/receipt state
   and refuses to run while enforcement is enabled. Existing Story/progress rows
   remain, and it does not restore legacy write grants. Never reset history and then
   accept pending operations from the previous protocol lifetime.

All scripts are transactional. None automatically connects to Supabase or runs a
remote migration. The preview hostname currently shares the configured backend;
Cloudflare preview deployment is not database isolation.

### Operational rollback and safe resume

Rollback uses the same control-row -> Stories -> progress lock order as cutover.
An RPC already holding the shared control lock must finish its transaction before
rollback can proceed. Table locks drain previously permitted legacy transactions;
requests queued behind the migration cannot bypass the revoked write privileges
after commit, including previously prepared statements.

The snapshot RPC and owner SELECT policies remain available in safety mode, with
`protocol_enforced=false`. Every mutation RPC call, including an exact receipt retry,
fails with `55000` while disabled. No progress, revision or receipt is changed by
operational rollback. Database owners/service roles remain privileged administrative
capabilities; they must not perform unversioned writes during safety mode.

To resume the protocol in an isolated test database, reapply `002`. It closes legacy
grants before enabling RPC writes in the same transaction and conservatively advances
existing Story revisions once, invalidating bases retained across the pause. It does
not reset history or remove receipts: an exact old operation retry still returns its
original acknowledgement without replaying the write. Fetch a fresh snapshot before
submitting new intent. Repeating an already enabled cutover does not bump revisions.
Do not use `rollback_001` to resume or operate a deployed database.

## RPC contract

`bg3_progress_snapshot_v1(p_story_id uuid)` explicitly checks `auth.uid()` ownership
and reads the owned Story, revision, enforcement flag and ordered progress rows in
one SQL statement. It returns:

```json
{"story_id":"…","revision":"1","protocol_enforced":true,"records":[]}
```

`records=[]` is a valid empty owned Story. Missing/foreign Stories and missing auth
raise `42501`, rather than returning a plausible empty snapshot. Revisions are
decimal strings so a future JavaScript client cannot lose bigint precision.

`bg3_mutate_progress_v1(p_story_id uuid, p_expected_revision bigint,
p_operation_id uuid, p_changes jsonb)` accepts an entire nonempty batch:

```json
[{"item_key":"example","status":"todo","client_updated_at":"2026-09-30T12:00:00Z"}]
```

The RPC locks the control row in shared mode, then locks the owned parent Story.
It validates all rows and looks up the operation receipt under that lock. An exact
duplicate returns the original saved acknowledgement, even after newer operations;
changed payload/base/user for an existing operation ID raises `22023`. Object-key
order is ignored by JSONB equality; array order and timestamp spelling remain part
of the request. Retries must retain the exact request and operation ID.

With no matching receipt, the expected revision must equal the current revision.
A mismatch returns `{"outcome":"conflict","story_id":"…","revision":"…"}`
without changing progress, revision or receipts. A matching request updates/inserts
the whole batch, advances the Story revision once, saves the receipt, and returns:

```json
{"outcome":"applied","story_id":"…","operation_id":"…","revision":"2"}
```

The same Story lock protects absent-row inserts and unrelated-item edits. Unrelated
edits may conflict intentionally. Every status, including `todo`, is a stored row.
Client timestamps are finite metadata only: no timestamp orders or authorizes a
write. Any failure rolls back all rows, the revision and the receipt together.

Bounds: 1–5000 unique canonical lowercase item keys, 1–512 characters per key,
at most 1 MiB of JSON text, exactly the three documented string fields per row,
`found`/`todo`/`skipped`, and finite PostgreSQL timestamps. Malformed intent raises
`22023`; UUID/bigint type parsing can fail before the function runs. Revision overflow
also fails transactionally. No automatic conflict retry or client rebase is added.

## Ownership and privilege boundary

The additions have RLS enabled, no browser policies, and explicit table privilege
revokes for PUBLIC/anon/authenticated, including default Supabase grants. Keeping
revisions separate prevents the existing unrestricted Stories UPDATE grant from
exposing them. Only authenticated callers receive EXECUTE on the two RPCs.

RPCs use `SECURITY DEFINER`, `search_path = pg_catalog, pg_temp`, fully qualified
application/auth relations and no dynamic SQL. Their trusted migration owner must
have the required table access; never assign them to a browser role. Because a
definer can bypass RLS, explicit `auth.uid()`/Story ownership checks are mandatory
before receipt lookup, conflict disclosure or writes. JWT verification remains the
Supabase boundary; the local fixture only simulates that identity setting.

The cutover checks both table and column privileges, including role inheritance.
Existing owner/service-role/DBA privileges remain administrative capabilities;
external privileged writers must follow the same lock/version protocol or stay
disabled. Custom API roles and other privileged legacy write RPCs also need a
separate audit before cutover; the draft asserts the baseline anon/authenticated
roles. Browser callers must never receive service-role credentials. Preserve
existing RLS policies rather than treating the privileged RPC as an ownership bypass.

Control-first locking drains RPCs before cutover/rollback table locks. Arbitrary
mixed legacy/RPC multi-statement transactions are outside the client protocol;
PostgreSQL can abort a deadlock, so migration callers must handle rollback. Receipts
are immutable to clients and are not pruned: a retry-retention policy needs separate
design before cleanup can be safe.

## Local tests and limitations

The database test runner under `tests/database/` creates a disposable PostgreSQL
cluster, synthetic users/Stories and the auth.uid()/role fixture. It never reads app
configuration, accepts a hosted URL or contacts a remote database. PostgreSQL binaries
must be provided explicitly using `PG_BIN_DIR`; there is no automatic installation.
The runner uses a private Unix socket with TCP listening disabled and removes the
cluster after completion. Baseline mode loads only the unchanged original schema.

```sh
PG_BIN_DIR=/absolute/path/to/postgres/bin node tests/database/run.cjs --baseline
PG_BIN_DIR=/absolute/path/to/postgres/bin node tests/database/run.cjs
node --test tests/*.test.cjs
```

Baseline failures are expected demonstrations of unsafe legacy upserts. Protocol
tests use real separate sessions and lock barriers, not JavaScript mocks. They test
the additive phase, optional cutover, retries, failures and rollback. A simulated auth
fixture verifies database ownership/permissions, not hosted JWT issuance or PostgREST
behavior; a future isolated Supabase integration check remains necessary before rollout.

For this review run, the approved temporary native PostgreSQL package omitted psql.
A temporary Python/libpq command bridge executes the same real server queries,
transactions and independent sessions; it is not a database emulator or repository
dependency. A standard PostgreSQL installation with psql runs the unchanged suite.
The downloaded runtime and bridge are removed after verification.

### Verification for this draft

Verified locally on native PostgreSQL 17.10 using synthetic data only:

| Run | Result |
| --- | --- |
| Unchanged legacy schema baseline | 3 tests failed as expected: same-base overwrite, delayed stale overwrite, competing absent-item inserts |
| Original operational rollback with new lifecycle tests | 5 regression subtests failed as expected because legacy writes succeeded (6 TAP failures including the parent) |
| Phase D1 database suite after the rollback fix | 57 passed, 0 failed (56 subtests plus the parent test) |
| Existing Phase A/B/C suite | 194 passed, 0 failed |

The database suite includes real overlapping transactions, coherent snapshots,
duplicate/late/concurrent retries, changed-ID intent rejection, clock skew, `todo`,
ownership/RLS, private-state tampering, metadata validation, temporary-object
shadowing, batch/receipt-write failure rollback, overflow, grant closure and both
rollback paths. Successful receipt retry after an injected receipt-write failure
also confirms that aborted operations leave no partial receipt or revision.
Lifecycle tests additionally hold real RPC and legacy transactions open while
cutover/rollback waits, queue a prepared legacy request behind cutover, and queue
an UPSERT behind the actual rollback transaction. They verify read-only rollback,
direct CRUD rejection, owner-only reads, stable revision/receipt history, disabled
RPC retries, idempotent rollback and safe re-enforcement without history reset.

Design references: [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html)
and [secure definer functions](https://www.postgresql.org/docs/current/sql-createfunction.html).

## Explicitly outside D1

No client protocol, conflict UI, imports, reset/replace RPCs, pending-operation
journal, production rollout or remote migrations are implemented. Future bulk RPCs
must use the same control/Story locks, revision and receipt discipline, and advance
the revision even for an empty reset. Existing dirty caches have no trusted base
revision: a future client must preserve them and explicitly reconcile them, never
silently attach a fresh base or fall back to legacy writes. A saved old receipt is an
acknowledgement of its original operation, not a current progress snapshot.
