# Cloudflare Pages artifact boundary

Both production (`main`) and develop previews must publish **only `dist/`**.
Repository-only files remain in git and are not deployment inputs.

## Pages settings

In the existing `bg3-gear-collector` Pages project's build settings, configure the
production and preview environments consistently:

- Root directory: repository root (leave the existing root setting unchanged).
- Build command: `node scripts/build-pages.cjs`
- Build output directory: `dist`

Do not run the acquisition generator as part of deployment. Packaging copies the
already reviewed bundle and canonical JSON byte-for-byte and adds no dependencies.
No tracker runtime, backend, protocol, PWA or database configuration changes are
needed. Ensure the deploying branch contains this packaging checkpoint before
expecting a successful build. Do not redeploy the older main branch without it.

These are required settings, not a claim that dashboard configuration or a new
deployment has already been completed. Confirm the actual saved settings and the
exact deployed commit in Cloudflare before clearing the release gate.

## Build and public inventory

Run `node scripts/build-pages.cjs` from a checkout. The script checks required
inputs, rejects symlinks, removes old `dist/`, then copies an explicit file and
asset-directory allowlist. It never copies the repository root recursively.

Current output:

```text
404.html
assets/acquisition-pilot.js
assets/bg.jpg
assets/companion-guide.css
assets/companion-guide-model.js
assets/companion-guide.js
config.js
data/acquisition.v1.json
data/companion-guide.v1.json
icons/icon-180.png
icons/icon-192.png
icons/icon-32.png
icons/icon-512.png
index.html
manifest.json
service-worker.js
versioned-progress.js
```

`index.html` directly loads `versioned-progress.js` and the acquisition bundle.
The standalone acquisition source modules are build/test inputs already embedded
in that bundle; they do not need separate deployed copies. `config.js`, the
manifest and retirement-only service-worker URL retain their existing bytes and
paths. No worker registration or versioned-transport activation is added.

Excluded: `experiments/`, `docs/`, `tests/`, `scripts/`, `database/`, repository
metadata, README, example config, preview markers, standalone build-only modules
and SQL files. Research stays available in git for local use. Future public assets
must be deliberately reviewed against the permanent inventory test.

## Verification and release gate

1. Run `node --test tests/pages-build.test.cjs` and build the artifact.
2. Serve **dist only**. Check tracker and asset loading, acquisition Full mode,
   Minimal/Light isolation, the two reviewed source aliases, root query/fragment
   URLs, default-off transport, disabled PWA and unchanged retirement worker.
3. Verify copied bytes against source; no reviewed runtime/data file may change.
4. After an explicitly authorized commit/push, confirm Cloudflare built the exact
   commit using the command/output above. Verify the develop hostname retains
   DEV PREVIEW; production must not display it.
5. Require HTTP **404**, not HTTP-200 tracker fallback, for both workbench URL
   forms, parser files, representative docs/tests/scripts/database files and
   directories, `/README.md`, `/config.example.js` and `/preview-test.txt`.
   Required runtime files must remain HTTP 200. Check console/runtime errors.

The top-level static `404.html` disables Pages' implicit SPA fallback for missing
files. The tracker has no client-side pathname routes; its root query/fragment
URLs remain on the existing index. No redirect rules or per-path URL hacks are
needed. See [Cloudflare route/404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).

Output exclusion applies to new builds; it does not remove existing immutable
historical deployments. Any historical-artifact cleanup is a separate action.
Until the actual Pages settings and a dist-based develop deployment pass these
checks, deployment verification and the v0.9.1 release gate remain pending.

## Companion Content Guide

The 17-file artifact includes the isolated guide ES modules/CSS and its explicit
reviewed JSON input. The guide is a view in the Tracker shell, not a pathname
route. Open it from the start area and verify return focus/scroll, Full utility,
Minimal/Light projection, local reveals, retry, and context invalidation at
320/390/768/1280 px. Guide browsing must cause no persistence/backend writes.
The original prototype, test fixtures, docs and research remain outside dist.
