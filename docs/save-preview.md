# Save evidence preview and explicit Apply (develop)

The Tracker's **Import from BG3 save** action opens a separate dialog. Choose or drop one local `.lsv`. Processing is local in a dedicated Worker; the save is never uploaded. Save evidence does not prove current ownership. The parser still reports ownership **unknown**, instance **unresolved**, and never interprets absence as a negative state.

## User-confirmed additive workflow

New exact matches are selected automatically across the entire spoiler-safe result set. Already-found items are summarized and removed from the actionable list; ambiguous groups are never selectable. **Select all new** and **Clear selection** work globally, independent of search, Act filtering or the 30-row page. Page navigation retains selection. Every spoiler-mode change invalidates confirmation and clears selection before recomputing the safe projection.

**Import all new items** reviews all currently eligible new matches regardless of checkbox customization. **Import selected items** reviews only checked eligible new matches across all pages. Both require explicit confirmation and use the existing `markRecord(key, "found")` path. Confirmation is concise and receives keyboard focus; Cancel restores focus to its initiating action. Missing, unselected, ambiguous, unsupported and hidden evidence never unsets or replaces anything. Already-found records and timestamps remain unchanged. Results re-read actual canonical progress; repeat imports are disabled/no-ops when nothing remains.

The summary uses unique exact catalogue identities in the current spoiler projection, not evidence occurrences or ownership quantities. It shows new/already-found counts and, only in Full, reviewed ambiguous-group counts. Zero diagnostic categories are omitted. Search and Act filtering change presentation only, not global counts or selection scope. All-new and all-already-found states have concise copy.

**Clear session** aborts readers/Workers, invalidates callbacks and confirmation, discards DTO/selection/file references and resets the file input without changing Story progress or unrelated app state. It works before, during and after parsing/import. Save matches do not establish ownership.

Plans are ephemeral, one-use capabilities in a private WeakSet. Each captures the existing `captureProgressAction()` guards (Story ID, record-map identity, user/auth/backend/client/transport context and action sequence), the catalogue reference, spoiler mode and selected statuses/timestamps. Storage is reconciled before planning and before applying. A selected record changing during confirmation forces re-confirmation; A→B→A Story changes cannot resurrect a plan. File replacement, close and mode change discard pending UI plans and selections. The pinned full catalogue must still match at review/confirmation. No weaker fallback exists.

Canonical writes are synchronous individual mutations, not a faux transaction. Each result is verified against real record state, including a mutation that throws after updating state. Failures preserve successful changes and retain only still-unapplied selections for explicit retry. No snapshot rollback, persistent import history or Undo is introduced: existing manual APIs cannot safely compare-and-revert later concurrent edits. A local persistence failure is reported as memory-only, with export-before-reload guidance, not durable success. Normal existing sync/offline gates apply; no import-specific queue, transport, backend operation or evidence upload exists.

## Spoilers and privacy

Search/Act filtering and Apply eligibility use the existing Story-safe catalogue projection **before** counts, selection, confirmation or DOM. Minimal/Light omit exact details, references, ambiguity/diagnostic totals and multiplicity. Full shows reviewed catalogue details and clearly labelled evidence-record counts. Protected-mode counts do not depend on concealed diagnostics. Mode changes discard selections/confirmation and remove concealed details immediately. An item absent from that safe projection cannot be selected through the core selection validator.

Only canonical progress records from the user's explicit confirmation may persist/sync, exactly as if manually checked in the Tracker. File bytes, names, raw Stats/templates, private identifiers, payloads, evidence DTO, source paths and preview selections never persist or reach the backend. Close/Story change releases the attempt. Cleanup is best-effort reference release, not forensic memory erasure.

## Bounded local path

The main thread uses an abortable FileReader (128 MiB ceiling), transfers to a fresh classic Worker and enforces one original 30-second deadline including intake, startup, parsing, matching, DTO validation and preparation. Worker network/import APIs are disabled. Existing LSPK v18, Globals.lsf, LSF v7 format 0, bounded codec/resource/identity validation and limits are unchanged. No LevelCache/holder/Creator/ECS join, ownership classification or new matching fallback is introduced. The complete validated 555-item canonical catalogue and all existing gameIds are pinned per attempt. Malformed/unsupported/resource-limit/timeout outcomes yield fixed safe errors without partial previews.

Version 1 [DTO schema](lsv-import-preview.schema.json) and evidence semantics remain unchanged. The [original preview contract](lsv-import-preview-contract.md) now has an explicit user-confirmed Apply addendum; only its prior prohibition on user progress actions is superseded. Ownership inference remains prohibited.

## Build / artifact

`node scripts/build-save-preview.cjs` generates deterministic `assets/save-preview-core.js` and `assets/save-preview-worker.js`; `assets/save-preview.js` and scoped CSS implement the UI. Original parser/resource/inventory/codec sources remain unchanged. The Pages artifact remains exactly **46 files**. Source adapters, research, tests, scripts and documentation remain excluded. Cloudflare configuration, PWA retirement, auth, RLS, existing sync/versioned default-off transport, Story/progress semantics, catalogue/classifiers and exact DEV PREVIEW gate are unchanged.

Historical Tracker byte guards remain exact: the inverse fixture covers only reviewed additive integration; unrelated body edits still fail. No broad test stripping is allowed.

## Verification

`node --test tests/save-import-ux.test.cjs tests/save-preview-apply.test.cjs tests/save-preview.test.cjs tests/pages-build.test.cjs` exercises actual canonical mutations in the isolated app harness, normal mocked authenticated sync, exact selection, no-op/idempotency, Story/auth/catalogue/record races, concurrent storage, partial failures, memory-only durability, parser/Worker privacy, DTO/schema and deterministic packaging.

`scripts/qa-save-preview.cjs` retains the previous preview lifecycle/keyboard/privacy coverage. `scripts/qa-save-apply.cjs` exercises selection, confirmation, canonical local progress, retry, Story/file/mode races, keyboard/focus, responsive layout and reload in disposable contexts at 320/390/768/1280. All backend/non-GET requests are blocked. `BG3_QA_ORIGIN` selects the actual hosted deployment; actual mutations use disposable local-only Stories with no account or backend. Optional explicitly authorized `BG3_REAL_SAVE` uses native product intake for global Import all and a customized multi-page Import selected flow, with source fingerprint/stat before/after in memory and sanitized counts/timing. Only synthetic public catalogue screenshots are written. No private values are emitted or committed.
