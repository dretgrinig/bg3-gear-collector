# Save evidence preview and explicit Apply (develop)

The Tracker's **Save evidence preview** action opens a separate dialog. Choose or drop one local `.lsv`. Processing is local in a dedicated Worker; the save is never uploaded. Save evidence does not prove current ownership. The parser still reports ownership **unknown**, instance **unresolved**, and never interprets absence as a negative state.

## User-confirmed additive workflow

Nothing is selected by default. Only exact, unambiguous catalogue-match rows have selection controls. **Select visible** selects the current page (up to 30 rows); **Clear selection** clears all pages. Selections can span pages/search filters but are cleared on every spoiler-mode change. There is no select-all-save action and ambiguity cannot be resolved or applied here.

Each eligible row shows its actual current Story status: **Already found** or **Not marked found**. **Mark selected as found** opens a compact confirmation with new/already-found counts. The results and file controls are hidden/inert during confirmation, so the confirmation is visible even after a long list. Cancel restores the selection and focus. Confirm changes only selected exact keys through the Tracker's existing `markRecord(key, "found")` path. Missing, unselected, ambiguous and unsupported evidence never unsets or replaces anything. Already-found records, including their timestamps, remain unchanged. Results re-read actual canonical progress; repeat Apply is a no-op.

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

`node --test tests/save-preview-apply.test.cjs tests/save-preview.test.cjs tests/pages-build.test.cjs` exercises actual canonical mutations in the isolated app harness, normal mocked authenticated sync, exact selection, no-op/idempotency, Story/auth/catalogue/record races, concurrent storage, partial failures, memory-only durability, parser/Worker privacy, DTO/schema and deterministic packaging.

`scripts/qa-save-preview.cjs` retains the previous preview lifecycle/keyboard/privacy coverage. `scripts/qa-save-apply.cjs` exercises selection, confirmation, canonical local progress, retry, Story/file/mode races, keyboard/focus, responsive layout and reload in disposable contexts at 320/390/768/1280. All backend/non-GET requests are blocked. `BG3_QA_ORIGIN` selects the actual hosted deployment; actual mutations use disposable local-only Stories with no account or backend. Optional explicitly authorized `BG3_REAL_SAVE` uses native product intake, only a small selected set, source fingerprint/stat before/after in memory and sanitized counts/timing. Only synthetic public catalogue screenshots are written. No private values are emitted or committed.
