# Acquisition enrichment — Phase 1

Phase 1 introduced an isolated metadata draft for v0.8.7-era catalogue identities. The validator, resolver and pilot data remain independent of tracker state. The separately approved [Phase 2 presentation integration](acquisition-ui.md) now bundles them for Full-mode disclosures; it does not change identity, classifiers, catalogue caches or progress.

## Files and API

- `acquisition-metadata.js`: standalone CommonJS validator and deterministic resolver; no file reads, network, DOM, storage or timers.
- `data/acquisition.v1.json`: schema **1**, dataset **1.1.0-act1.1a**; twenty catalogue entries, twenty-one bindings, twenty-four acquisition routes. The original ten-entry pilot is unchanged; [Checkpoint 1A](acquisition-act1-1a.md) adds ten reviewed Act 1 routes.
- `tests/acquisition-metadata.test.cjs`: contract tests plus existing application functions exercised through their established mocked boundaries.

```js
const { validateDataset, createResolver } = require('../acquisition-metadata.js');
const checked = validateDataset(input);
// { ok, dataset: frozenCopyOrNull, issues: [{ path, code, message }] }
const resolver = createResolver(input);
// { schemaVersion, datasetVersion, issues, resolve(item), reviewedRoutesFor(item) }
```

Validation is failure-atomic for the whole dataset. A missing or invalid dataset returns null versions, diagnostics, no matching entries and an empty frozen route list. An invalid later entry cannot expose earlier entries. Inputs are copied, not rewritten or frozen; validated output and issues are deeply frozen. Dictionaries use null prototypes, and private lookup tables use Map/Set. Prototype-shaped strings are ordinary identities.

`resolve()` returns a stable validated entry object for an unambiguous match. `reviewedRoutesFor()` returns only routes whose review state is `reviewed`. **Review is not availability**: historical and uncertain validity remains explicit and must be labelled by any future consumer. Draft/disputed routes may be retained as data but cannot enter that list. There is no caller-controlled `published` or `publishable` field.

## Schema 1

All objects have a closed set of supported fields; unknown fields are rejected. Required fields cannot be omitted. Optional route metadata may be absent or null, preserving unknown values rather than inventing defaults.

| Object | Fields |
| --- | --- |
| Dataset | Required `schemaVersion: 1`, nonempty `datasetVersion`, `entries[]` |
| Entry | Required immutable `id`, nonempty `bindings[]`, `coverage`, `routes[]` |
| Binding | Required explicit `id`, `act`, exact `progressKey`, complete `gameIds[]`, specific `wikiPage` |
| Route | Required explicit `id`, `type`, `validity`, `sources[]`, `review`; optional `acts`, `actor`, `location`, `sublocation`, `coordinates`, `conditions`, `notes` |
| Actor/location | Required plain `name`; optional decoded `wikiPage` title |
| Coordinates | Required finite numeric `x`, `y`, nonempty `space`, `subject` |
| Source | Required HTTPS BG3 Wiki `url`, relevant `section`; optional positive safe-integer `revisionId` |
| Review | Required `state`; optional calendar-valid `reviewedAt` (YYYY-MM-DD), `reviewer` |

Enums:

- Coverage: `unreviewed`, `partial`, `reviewed`. Unreviewed entries cannot contain reviewed routes; coverage is an editorial assessment, not an exhaustive engine availability claim.
- Types: `purchase`, `drop`, `actor_loot`, `quest_reward`, `gift`, `craft`, `combine`, `container`, `world`, `ability`, `steal`, `disarm`.
- Route Acts: unique nonempty array of `1`, `2`, `3`, `prologue`; absent/null means unknown. Catalogue binding Acts remain exactly `ACT 1`, `ACT 2`, `ACT 3`.
- Coordinate subjects: `actor`, `container`, `entrance`, `item`, `interaction`, `crafting_station`.
- Validity: `current`, `historical`, `uncertain`.
- Review: `reviewed`, `draft`, `disputed`. Reviewed routes require evidence; draft/disputed may have none.

Conditions have optional `prerequisites`, `before`, `after`, `exclusions` buckets. Each bucket is null or an array of `{kind, subject, value?}`. Kinds: `item`, `ability`, `level`, `quest`, `npc`, `class`, `check`, `interaction`, `choice`, `faith`. Values are plain strings, finite numbers or booleans. These are reviewed facts, **not an executable availability evaluator**. Alternative paths use separate routes or explicit factual notes; bucket contents must not accidentally turn alternatives into mandatory conjunctions.

Zero and negative coordinates are valid. Numeric strings, NaN and infinity are invalid. Missing coordinates never become `(0,0)`. `space` is a reviewed source scene/map label, not an invented engine map ID. `subject` records what that point describes. Missing notes/conditions/geography remain unknown; an empty known bucket is distinct from an unknown bucket.

Plain metadata is not HTML or a ready-made UI string. Future presentation must escape data. Sparse arrays, accessors, cycles, non-JSON values, duplicate entry/binding/route IDs and malformed nested objects are rejected. IDs are explicit and immutable; they are never array indices or generated from current item display names.

## Identity and binding

The input shape is the existing normalized item `{act, name, gameIds, source}`. Raw `links.Name`, when supplied, is an additional identity check and must agree with `source`.

1. Preserve original fields. Compute lookup copies only.
2. Require the exact Act and the current `(act + '|' + name).toLowerCase()` compatibility key. The key is a guard, not an enrichment identity and never replaces progress keys.
3. Require the **entire** reviewed game-ID set, order-independent. A known subset, unknown addition, duplicate, malformed value or wrong Act fails closed.
4. A supplied specific Wiki page must agree. Unknown/conflicting/foreign/malformed supplied URLs cannot downgrade to a name match. Missing/empty source is allowed only with a complete nonempty approved game-ID set.
5. A genuinely absent game-ID field is treated as an empty set only for an explicitly reviewed empty-ID binding. Own undefined/null and inherited strong fields remain invalid. Empty-ID matching additionally requires a specific agreeing item page; generic Act/list pages cannot establish identity.
6. URL lookup copies decode percent encoding once, normalize Unicode NFC and spaces/underscores. Case, curly/straight apostrophes, parenthetical names and IDs are not fuzzy-matched. Original URLs remain intact.
7. Accept only canonical `https://bg3.wiki/wiki/Title` or pinned `https://bg3.wiki/w/index.php?title=Title&oldid=Revision`. No credentials, ports, fragments, extra query parameters, duplicate parameters or normalized traversal paths. A supplied revision ID must agree with the pinned URL.
8. More than one matching binding is ambiguous even within one entry and returns no enrichment; arrival order cannot select a winner.

Catalogue game IDs are opaque values in their existing namespace. Wiki UIDs, Stats IDs, templates and save IDs are not conflated. The two Graceful Cloth entries deliberately retain different Act/progress identities despite their shared ID and item page. Only Gloves of Heroism has an explicit no-ID fallback binding; generic fallback records stay unmatched.

## Reviewed pilot and evidence

All pilot route sources retain permanent Wiki links, revision IDs and section labels in the JSON. Facts are concise paraphrases. Canonical pages were read and their permanent-link revision IDs checked; direct oldid retrieval was unavailable in the browsing tool. Additional actor/location/quest pages are pinned where needed for context.

| Catalogue entry | Routes | Primary evidence | Deliberate limits |
| --- | --- | --- | --- |
| Armour of Devotion — Act 2 | Purchase | [426502](https://bg3.wiki/w/index.php?title=Armour_of_Devotion&oldid=426502), Where to find | Actor coordinates unknown because source points do not agree; no unverified purchase availability conditions |
| Helldusk Armour — Act 3 | Actor carried gear | [419447](https://bg3.wiki/w/index.php?title=Helldusk_Armour&oldid=419447), Where to find / Notes | Partial; actor coordinates unknown; no invented drop/steal/disarm method or early exploit route |
| Blazer of Benevolence — Act 1 | Quest reward | [416539](https://bg3.wiki/w/index.php?title=Blazer_of_Benevolence&oldid=416539), Where to find; Rescue Volo 422309 | No supported acquisition coordinates |
| Gloves of Heroism — Act 1 | Container | [418972](https://bg3.wiki/w/index.php?title=Gloves_of_Heroism&oldid=418972), Where to find / Notes | Access alternatives retained as facts; specific no-ID fallback binding |
| Phalar Aluve — Act 1 | Three world interactions | [432441](https://bg3.wiki/w/index.php?title=Phalar_Aluve&oldid=432441), Where to find / Notes | Partial; complex paladin/blood alternatives omitted |
| Dolor Amarus — Act 3 | Two drops, conditional purchase | [417871](https://bg3.wiki/w/index.php?title=Dolor_Amarus&oldid=417871); Highberry 419527; Facemaker 418355 | Partial; actor coordinates unknown for all routes; exploit/other branches omitted |
| Adamantine Longsword — Act 1 | Craft | [415813](https://bg3.wiki/w/index.php?title=Adamantine_Longsword&oldid=415813); Adamantine Forge quest 415810 | Reviewed ingredient and forge facts; exact station coordinates unknown |
| Devotee’s Mace — catalogue Act 3 | Ability | [417675](https://bg3.wiki/w/index.php?title=Devotee%27s_Mace&oldid=417675); Arm Thy Servant 417807; Divine Intervention 382846 | Route Act, actor and all geography unknown; catalogue Act is not an availability claim |
| The Graceful Cloth (Esther) — Act 1 | Current purchase | [428954](https://bg3.wiki/w/index.php?title=The_Graceful_Cloth&oldid=428954), Where to find | Exact actor coordinates unknown (source point identifies her camp); no unverified purchase conditions |
| The Graceful Cloth (Araj) — Act 2 | Historical purchase | [428954](https://bg3.wiki/w/index.php?title=The_Graceful_Cloth&oldid=428954), Notes | Pre-Patch-4 route; historical coordinates/sublocation unknown |

Coverage is reviewed for seven entries and partial for Helldusk, Phalar and Dolor. Factual routes may disagree with current compatibility Vendor/Loot/Quest categories. This module does not call `acquisitionFor()` or correct those categories.

Wiki attribution and source links must remain with future derived content. [BG3 Wiki reuse terms](https://bg3.wiki/wiki/bg3wiki:Copyrights) depend on content history; this draft does not assert a new blanket licence for copied source material. No long source passages or runtime scraping are included.

## Verification and future boundary

Run the complete app suite with the existing Node runtime:

```sh
node --test tests/*.test.cjs
```

The new tests validate synthetic contracts independently of the pilot, match all ten pilot entries through the real current normalizers, preserve all 555 distinct progress keys, and exercise existing v5/v6 import/export handlers and Story isolation using mocks. Expected catalogue remains **556 source rows / 555 unique items**, Vendor **63/50/67**, Loot **131/94/125**, Quest **25/0/0**. Phase 1 left existing tests unchanged; Phase 2 test-boundary adjustments are documented separately.

The approved Phase 2 disclosure policy and browser/offline packaging are documented in [acquisition-ui.md](acquisition-ui.md). Enriched search/filter behavior, expanded coverage and classifier changes remain deferred. Static metadata is inspectable; spoiler protection is a presentation policy. No storage/database migration or production service access is required. Versioned progress transport and the DEV PREVIEW gate remain untouched.
