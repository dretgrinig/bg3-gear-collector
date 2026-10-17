# Acquisition enrichment — Phase 2 pilot UI

Phase 2 introduced the optional presentation layer for the original ten reviewed pilot entries. [Checkpoint 1A](acquisition-act1-1a.md), [Checkpoint 1B](acquisition-act1-1b.md) and [Checkpoint 1C](acquisition-act1-1c.md) extended canonical data and the generated bundle to forty entries. The current Full Details coordinate checkpoint adds schema 2 coordinate review and compact presentation; strict identity resolution remains unchanged. [Act 1 Batch 1](acquisition-act1-batch1.md) adds fifteen data-only entries; [Act 1 Batch 2](acquisition-act1-batch2.md) adds fifteen more; [Act 1 Batch 3](acquisition-act1-batch3.md) adds another fifteen for a total of eighty-five. [Act 1 Batch 4A](acquisition-act1-batch4a.md) adds 47 entries and 51 routes for 132 total entries (127 Act 1 items). Renderer, schema and integration code are unchanged. No discovery fields or progress identities are introduced.

## Files and API

- `acquisition-ui.js`: pure CommonJS renderer, `createAcquisitionUI(metadataModule, dataset)`.
- `assets/acquisition-pilot.js`: generated browser bundle containing the canonical resolver, pilot data and the same renderer. No runtime data fetch or external dependency.
- `scripts/build-acquisition-bundle.cjs`: deterministic local builder. Run `node scripts/build-acquisition-bundle.cjs` after an approved source change; do not edit the generated asset directly. It uses the canonical `validateDataset()` before serialization or writing; invalid metadata fails with source/path/code diagnostics and leaves the output untouched.
- `index.html`: optional bundle loading, Full disclosure integration, scoped styles and offline packaging.
- `tests/acquisition-ui.test.cjs`: production renderer, actual application filtering/rendering and offline-handler regression coverage.
- `tests/acquisition-bundle-build.test.cjs`: actual CLI rejection before any write, canonical diagnostics, deterministic valid output/data/versions.
- `scripts/qa-acquisition-late-arrival.cjs`: optional native-browser regression using installed Playwright/Chrome, fully intercepted local responses and disposable contexts.

The factory returns a frozen object:

```js
const ui = createAcquisitionUI(metadataModule, dataset);
ui.renderableReviewedRoutesFor(item, mode); // frozen routes, or []
ui.render(item, mode); // { acquisitionHtml, referencesHtml }
```

The browser global `BG3AcquisitionUI` exposes the same methods plus `offlineSource()`, which returns a self-contained replay of the generated bundle. It initializes no DOM, storage, network or timers.

## Visibility and facts

Only exact `full` mode performs item resolution. Both the application and renderer gate Minimal/Light before lookup or enrichment markup construction. Opened protected disclosures contain no new route, actor, location, coordinates, conditions or reference nodes/attributes. Existing protected-mode disclosure content and broad-region policy are unchanged.

Only reviewed routes with current or historical validity render. Historical routes carry an explicit **Historical / unavailable** label. Uncertain, draft and disputed routes are omitted. Routes remain separate, and their labels are derived from the validated route type rather than stored in the JSON.

Inside native **More info**, **Effect** comes first with the existing Properties and description content preserved verbatim, escaped as before. **Where to find** follows with one compact geography line per distinct destination, prominent X/Y and a short method sentence. The existing item Wiki link follows; the renderer keeps `referencesHtml` as an empty compatibility field. Canonical evidence URLs and section/revision pins remain in the reviewed JSON and docs, without an evidence list in the normal UI.

Destination grouping compares the complete exact location/Wiki/sublocation/coordinate/review/navigation/Act/validity tuple. It groups only presentation, including identical subsets; every route and method remains separate. No route numbering, shared-location label, long prerequisites or Notes panels are shown. A simple reviewed check may be shown briefly; other conditions become **Conditional route — see Wiki.** Rich conditions/notes remain canonical facts, not executable availability rules. `actor_loot` is **Carried by**, preserving its distinction from drop/steal.

Schema 2 distinguishes exact acquisition points from navigation references and explicit coordinate exceptions. Reference roles (entrance, encounter point, former container, etc.) remain visible; inventory-assembly component waypoints are explicitly labelled, never presented as finished-item acquisition points. Pending/conflict/not-documented states are supported but none remain in the current 155 routes. Schema 1 fixtures remain supported without inventing review states for their null coordinates. See [coordinate backfill](acquisition-coordinate-backfill.md).

Every rendered data value is escaped. Metadata is never added to catalogue items, search blobs, options, sort keys, classifiers, badges, counts or progress. The original inline catalogue acquisition/location text is unchanged and is not copied into the new section.

## Optional loading and offline export

The optional bundle uses `defer`, so it does not block the following inline application bootstrap. Its load handler calls `hydrateAcquisitionDetails()`: Minimal/Light return without touching the item trees; Full inserts only Where to find after existing mechanics and before the original Wiki link inside existing disclosures. A WeakMap associates each rendered surface with its exact original catalogue item, and a temporary Map shares one factual render across desktop/mobile. Rows, cards, summaries, controls and existing links are retained, including focus, native listeners and disclosure open state. Repeated hydration does not duplicate sections. A matched item with no prior disclosure receives an append-only native More info wrapper. No backend/status/review renderer or sync is called. `DOMContentLoaded` still waits for deferred scripts under normal browser semantics; core UI rendering does not. Missing or invalid optional metadata leaves the baseline item UI intact; optional API property reads are guarded too.

Offline export works on a detached document clone. It empties the serialized desktop/mobile list containers before saving so Full markup cannot appear before a restored protected preference is applied. If the bundle is available, its script is embedded inline using `offlineSource()`; the exported catalogue then rebuilds the lists through the current presentation policy. The live document, catalogue and progress maps are untouched. Missing metadata exports retain baseline behavior. Existing offline packaging outside this narrow presentation adjustment is unchanged.

Static source assets remain inspectable; spoiler policy governs rendered presentation, not secrecy. No enrichment is written to localStorage, catalogue caches, progress records or Supabase. No storage/database migration is required.

## Verification and boundaries

Run the complete application suite with `node --test tests/*.test.cjs`. The tests verify all route types, review/validity policy, entire protected desktop/mobile DOM including attributes and opened disclosures, escaping, discovery isolation, missing/late bundle behavior and actual Full export → protected restoration. The former Phase 1 assertion that there was no UI integration now asserts persistent module/discovery isolation. The existing catalogue-copy test gains a detached-clone DOM boundary to exercise the same real export handler; its assertions remain unchanged.

Isolated browser checks use local responses and throwaway contexts at 320, 390, 768 and 1280 pixels, including native keyboard disclosures, link focus and offline reopen. The native late-arrival runner checks pointerdown → metadata arrival → pointerup, held Space activation, node identity, focus, disclosure state, scroll/filter state and zero protected-mode mutations. Configure existing tooling explicitly; it never installs or downloads a runtime:

```sh
BG3_PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
BG3_CHROME_PATH=/absolute/path/to/installed/chrome \
node scripts/qa-acquisition-late-arrival.cjs
```

Catalogue invariants remain **556 source rows / 555 unique items**, Vendor **63/50/67**, Loot **131/94/125**, Quest **25/0/0**; all 555 progress keys, both Graceful Cloth contexts and retained Battlemage source row 54 remain unchanged.

Auth, sync, Story ownership/progress/themes/preferences, broad-region mapping, PWA, SQL/database, versioned transport and DEV PREVIEW gating are outside this phase. Expansion beyond the current 132 entries, enriched discovery, availability evaluation and save-ID adapters require separate approval. No .lsv Phase B work is included.
