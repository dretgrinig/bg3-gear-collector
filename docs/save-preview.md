# Save evidence preview (develop)

The Tracker's **Save evidence preview** action opens a separate read-only dialog. Choose or drop one local `.lsv`; close, cancel, replace the file or change Story to release the temporary attempt. Nothing can be applied to progress. Ownership is always unknown; missing evidence never means unowned. Search/Act filtering operate on the Story-safe catalogue projection. Minimal/Light omit exact details, references, ambiguity/diagnostic totals and multiplicity. Full shows catalogue details and clearly labelled evidence-record counts. Results are paged in groups of 30. Full has a direct switch between catalogue matches and ambiguous groups; protected modes remove that control entirely.

## Bounded local path

The main thread reads one File (128 MiB ceiling), transfers its buffer to a fresh classic Worker and enforces one original 30-second deadline including intake, startup, parsing, matching, DTO validation and preparation. Cancel/close/replacement/context changes terminate the Worker and invalidate queued replies. Worker network/import APIs are disabled; it is self-contained and needs no remote dependency. No file bytes, names, raw Stats/templates, private identifiers, payloads or source paths are uploaded, logged or persisted. No import localStorage/sessionStorage/IndexedDB/cookies/backend writes occur. Cleanup releases references; no forensic memory-erasure guarantee is made.

Only LSPK v18 non-solid one-part archives, exact Globals.lsf, LSF v7 format 0 and the already-supported bounded codec profiles are admitted. Existing parser/structure/identity ceilings remain unchanged. Whole-resource validation precedes exact Stats-family matching using the existing reviewed extractor/matcher and its aggregate identity budget. CurrentTemplate is not a static catalogue identity. No LevelCache, ownership, holder, Creator or ECS join is introduced. Malformed/unsupported/resource-limit/timeout/cancel outcomes yield safe fixed errors, never partial previews or weaker retries.

The full validated 555-item Tracker catalogue must be ready; fallback data is refused. Its complete existing gameIds and canonical progress keys are pinned per attempt. Catalogue refresh, auth or Story context replacement invalidates the preview. Repeated records aggregate as evidence multiplicity, not owned quantity. All ambiguous catalogue candidates remain represented; no first-match choice. Version 1 DTO matches [the frozen schema](lsv-import-preview.schema.json); schema syntax and pinned-catalogue membership/order/uniqueness/aggregate limits are validated on both sides. The [frozen contract](lsv-import-preview-contract.md) remains normative.

## Build / artifact

Run `node scripts/build-save-preview.cjs` after changing the engine, schema or proven decoder sources. It produces deterministic `assets/save-preview-core.js` and `assets/save-preview-worker.js`. Only the generic resource decoder is included; targeted/equality/framing-inspection research APIs are excluded. Original decoder/parser/inventory sources remain unchanged. `assets/save-preview.js` and `assets/save-preview.css` are the scoped UI. Cloudflare's existing `node scripts/build-pages.cjs` copies committed assets; it does not generate or fetch code during deployment.

The public artifact is exactly **46 files**: the prior 42 plus those four preview assets. Root source adapters, experiments, workbench, tests, scripts, documentation and private saves remain excluded. PWA/service-worker retirement, auth/anonymous-auth, sync/versioned transport, Story/progress semantics, classifier/catalogue identity and exact DEV PREVIEW gate remain unchanged.

Historical Tracker byte guards remain strict: `tests/fixtures/save-preview-shell.json` reverses only the exact reviewed additive shell, with negative drift tests. The historical research-only 42-file test is pinned to its original reviewed source commit; the current packaging suite separately enforces the exact 46-file inventory. No test permits arbitrary omitted code or inventory drift.

## Verification

`node --test tests/save-preview.test.cjs tests/pages-build.test.cjs` checks matching, DTO privacy, prototype keys, malformed/unsupported/size/deadline behavior, real generated Worker messages, deterministic bundle parity, spoiler-safe counts/search/fields and exact packaging. Run full LSV and repository suites after stabilization.

`scripts/qa-save-preview.cjs` tests the actual product UI with fabricated files at 320/390/768/1280 in disposable Chrome contexts, including file/drop input, cancellation, second-file races, errors, keyboard/focus, ARIA, strict-mode transitions, Story reset, reload cleanup and storage/network instrumentation. `BG3_QA_ORIGIN` selects the hosted develop deployment. Optional `BG3_REAL_SAVE` requires explicit user authorization; it runs through the same browser file input, checks source fingerprint/stat before/after in memory and reports only sanitized status/count/timing metadata. Private bytes/paths/hashes/payloads never enter the repository. Normal SDK/catalogue asset GETs are identified separately; backend/non-GET requests fail QA. Screenshot captures use synthetic public catalogue evidence only.

Apply, ownership import and Party Optimizer owned-gear integration remain blocked. Further ownership/instance/holder/ECS research is post-MVP and does not block this conservative preview.

## Shipping checkpoint verification

Final local verification: 67 product unit/Worker/schema regressions, 1,055 LSV tests, 5,947 complete repository tests, 15 packaging tests and 268 native product checks all pass with no failures/skips. The authorized controlled save completed through actual browser intake, the dedicated Worker and safe DTO/UI; ownership remained unknown, no preview persistence or unexpected/backend requests were observed, and the private source content/stat stayed unchanged. No private file names, hashes, identifiers, payloads or per-item private evidence are included here. Hosted verification is performed against the resulting develop commit.
