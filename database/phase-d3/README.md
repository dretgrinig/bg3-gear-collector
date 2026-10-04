# Phase D3A: local atomic reset/replace RPC draft

This is an additive **local review draft**, not a production deployment instruction.
It adds no client behavior, tables, policies, backend configuration or feature flag.
D1 SQL, D2, v5/v6 import behavior and default-off versioned transport are unchanged.
No production connection or hosted migration is part of this work.

## Files and prerequisites

- `003_bulk_progress_protocol.sql`: requires D1 `001`; installs one new RPC under
  the trusted D1 migration role and preserves all progress/revision/receipt state.
  The shared control-row lock drains active mutations before install/reapply.
  It does not enable enforcement or restore direct write grants.
- D1 `002` remains the separate incompatible cutover draft. Both mutation endpoints
  reject with SQLSTATE `55000` until that existing enforcement flag is true.
- `rollback_003.sql`: drains active mutations and removes only the bulk RPC.
  D1 versioned checkbox mutations remain available if enforcement remains active.
  Owner reads, rows, revisions, receipts, enforcement and revoked legacy grants
  remain unchanged. Repeating removal is safe; reinstall permits exact old retries
  without replaying their writes or resetting history.
- **Operational whole-protocol rollback is D1 `rollback_002`, READ-ONLY safety mode.**
  It drains both RPCs and blocks every mutation/receipt retry, including the new
  endpoint. Reapplying D1 `002` invalidates old bases without removing receipts.
- D1 `rollback_001` remains destructive local/dev teardown only. Remove D3's RPC
  first; never use it for production rollback or reuse erased revision history.

These scripts do not automatically run anywhere. Do not apply them to the shared
Supabase backend; a preview hostname is not an isolated database. Future activation
and hosted verification require a separate review and isolated environment.

## RPC contract

`bg3_bulk_progress_v1(p_story_id uuid, p_expected_revision bigint,
p_operation_id uuid, p_mode text, p_records jsonb)` accepts `reset` or `replace`.

For reset, `p_records` must be `[]`. Every authoritative progress row in the owned
Story, including cloud-only and `skipped` rows, becomes `todo`; keys are retained.
For replace, validate the entire array first, set every omitted authoritative row
to `todo`, then UPSERT the supplied rows in that same transaction. Supplied `todo`,
`found` and `skipped` are supported. Clearing never depends on a catalogue/cache.
Empty replace is a reset; both empty operations advance the revision and record
one receipt even if the Story has zero rows. Tombstones get finite server timestamps;
supplied client timestamps remain metadata only, never concurrency authority.

Payload rows match D1 exactly:

```json
[{"item_key":"example","status":"found","client_updated_at":"2026-01-01T00:00:00Z"}]
```

Inputs allow 0–5000 unique canonical lowercase keys, 1–512 characters per key,
exactly these three string fields, finite timestamps and at most 1 MiB of JSONB
text. Invalid/null shapes, duplicates, extra fields, negative/null expected bases,
missing UUIDs, unknown modes and a nonempty reset are rejected before any progress
mutation. Bounds apply to submitted records, not the number of existing Story rows.
No chunking, time-based conflict resolution, unversioned fallback or partial clear
is used. The whole mutation rolls back on a write/receipt/overflow failure.

The RPC takes D1's control shared lock, explicitly locks/checks the authenticated
owner's Story, validates all input, checks its receipt and compares the expected
revision under that same Story lock. This serializes both endpoints, including
concurrent absent-row inserts and unrelated-item edits. Ownership is checked before
revealing any revision or receipt. Revision advances exactly once on success.

Successful acknowledgement and stale-base conflict match D1's response shapes:

```json
{"outcome":"applied","story_id":"…","operation_id":"…","revision":"2"}
{"outcome":"conflict","story_id":"…","revision":"2"}
```

Revisions are decimal strings on output. A conflict changes no row, revision or
receipt; a malformed request raises `22023`. Missing/foreign ownership raises
`42501`. SQL UUID/bigint parameter parsing may reject input before function entry.

## Idempotency and receipts

Keep D1's protected `(story_id, operation_id)` receipt namespace. New requests bind
that identity to the authenticated owner and this exact envelope:

```json
{"rpc":"bg3_bulk_progress_v1","version":1,"mode":"replace","expected_revision":"1","records":[]}
```

An exact retry returns the original saved acknowledgement with no DML, even after
newer writes or a safe pause/resume. Changing mode, records, base, array order or
timestamp spelling raises `22023`; JSONB object-key order is immaterial. Existing
D1 request envelopes lack the RPC/version/mode fields, so either endpoint rejects
cross-RPC UUID reuse instead of replaying the other request. No receipt rewrite is
needed. A saved receipt is not a current snapshot and must not overwrite newer
cloud state. Both receipt retries and new operations are blocked while disabled.

## Security and verification boundary

Run under the trusted D1 migration role; trusted function ownership is a prerequisite.
`CREATE OR REPLACE` does not verify/reassign an existing function owner. The function
is `VOLATILE SECURITY DEFINER`, with `search_path = pg_catalog, pg_temp`, explicitly
qualified application/auth relations and built-in functions, and no dynamic SQL.
PUBLIC/anon execution is revoked and authenticated EXECUTE is granted in the creation
transaction; other pre-existing/default role grants require isolated verification. Existing
RLS, owner reads and direct-DML revokes remain intact; private revision/receipt
state gets no new browser grants. A privileged service/database owner can still
bypass application protocols; such writers must be separately isolated/audited.

Local SQL tests use synthetic auth claims and independent real PostgreSQL sessions.
They do not establish hosted JWT verification, PostgREST bigint/JSON serialization,
RPC schema-cache routing, hosted default grants/function owner or privileged-writer
closure. Verify those in an isolated Supabase project before any activation.

## Local tests

The runner accepts no DSN, credentials or existing cluster. Each invocation creates
its own private Unix-socket cluster with TCP disabled, removes inherited PG routing
settings, and destroys the cluster afterward. D1/D3 suites run serially because D1
exercises global rollback/teardown; they are never concurrent suites on one cluster.

```sh
# Tests first: D1 + cutover only, omit D3 and observe the new regressions fail.
PG_BIN_DIR=/absolute/local/postgres/bin node tests/database/run.cjs --d3-baseline
# Complete unchanged D1 suite, then fresh D1 protocol state + D3 suite.
PG_BIN_DIR=/absolute/local/postgres/bin node tests/database/run.cjs --d3
# Existing full app suite, mocks only.
node --test tests/*.test.cjs
```

D3 tests force actual lock waits between independent sessions for checkbox/reset,
checkbox/replace, reset/reset, reset/replace, replace/replace and absent-row inserts.
They also cover stale/delayed writes, old/lost acknowledgements, exact concurrent
retries, cross-RPC/request identity, coherent snapshots, ownership/grants, payload
bounds, full transaction failures, read-only rollback/resume, safe RPC removal and
reinstallation, empty resets/replacements and more than 5000 stored tombstones.

Client-side D3 journaling/barriers, import validation/file-read guards, bulk review
and offline reconnect integration are explicitly deferred. This draft enables none
of them and makes no production data change.

## D3A verification results

| Run | Result |
| --- | --- |
| D1-only regression baseline, bulk RPC absent | 71 new subtests failed; 72 failures including parent; 0 skipped/cancelled |
| Unchanged D1 suite | 57/57 passed |
| D3A suite | 72/72 passed, including 71 regression subtests |
| Existing app suite | 318/318 passed |

The local verification used native PostgreSQL 17.10 from a temporary, registry
SHA512/signature-verified `@embedded-postgres/darwin-x64@17.10.0-beta.17` runtime.
Because it omits psql, a temporary Python/libpq CLI bridge executed the SQL in the
real server. The bridge enforces the runner's private local socket scope, preserves
the SQL search path and was smoke-tested with separate sessions, dollar-quoted
SQL, transaction/error stopping and SQLSTATE output. No system installation or
production database was used. Temporary clusters and runtime are removed afterward.
