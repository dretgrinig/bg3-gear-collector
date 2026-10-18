# Companion Content Guide

Read-only view inside the Tracker shell. No pathname routing, new dependency,
backend integration or persistence. The shared brand/DEV PREVIEW header remains
visible. Tracker controls and item nodes stay mounted; entry/return only switch
visibility and restore the entry focus and captured viewport. Existing background
work is untouched.

## Source and review boundary

Source: reviewed `companion-guide-v0.3 2.zip`, version 0.3, 51 original research
records. `tests/fixtures/companion-guide-original.json` independently preserves
all original metadata, IDs, routes, evidence markers, copy and source URLs.
`data/companion-guide.v1.json` adds schema 1 and per-record presentation metadata;
original research is not rewritten. This is spoiler-presentation review, not
exhaustive factual reverification. The player-observed evidence remains labelled
and is not upgraded to a confirmed claim.

Availability, recruitment, Origin-player context and quest conditions are not
modeled. A suggested swap may be unavailable. Priorities are editorial, not game
requirements. The user explicitly chooses an Act before three companions; no Act is
inferred from Story progress. Party and romance inputs live in memory only.

## Spoiler boundary

The adapter consumes existing `spoilerMode()` without changing defaults or
preferences. Its opaque scope identity changes for Story/account/sign-out/backend
namespace changes; auth/backend invalidation revisions are separate. Preference-only
updates change inherited mode, not scope identity or security revision. No raw
account/Story identifiers reach the guide. Notification placement and existing
preference-cache warming stay unchanged.

The native segmented control offers Story (default), Minimal, Light and Full.
Overrides live only in the guide controller's memory, survive navigation,
close/reopen and retry, and never write Tracker preferences or storage. Reload
starts with Story. Without a valid Story, following uses Minimal; explicit guide
choices remain usable. Logical scope changes reset the choice to Story; returning
to a previous Story does not restore an override. Same-scope security revisions
retain the choice but preserve existing broader view/reveal invalidation.

One effective mode feeds the original projection and every downstream permission
gate. Effective changes synchronously clear reveals, notes and discovery filters,
preserve explicit Act/party/romance, discard stale async work and leave Route for
Browse when entering a protected mode. Equivalent effective modes retain browsing
state. Inherited preference changes under an override are remembered without
rerendering guide results or stealing focus; selecting Story uses the latest value.
No polling, backend patching or additional storage listener is introduced.

Every entry and original route was reviewed. Original `why_spoiler_free` and low
spoiler labels often name encounters, quest progression, outcomes or recruitment.
They are NOT treated as safe. Minimal deliberately uses fixed neutral guidance
with no companion associations, priorities, geography or recommendation. Light
adds only explicitly reviewed broad regions below; sensitive/ambiguous parentage
is withheld. This conservative fallback avoids manufacturing safe recommendations.
Both protected modes withhold route mode because original route order/group names
contain exact geography and progression. The UI explains this limitation.

Projection is followed by the explicit Act reveal gate before filters, search, counts and planning. Full recommendations
use the original whole-party enumeration and ALL eligible Act records before
display filtering. Independent prototype-produced regression fixtures retain its
must/strong scoring, romance, retention and multi-swap behavior.

A protected entry can be deliberately revealed locally. This does not enable
hidden search/filter/recommendation context or affect other entries. Original
research notes require a second explicit action in every mode and are not inserted
in closed DOM. No concealed values occur in protected attributes, options or live
regions. Stable raw IDs stay in data; protected DOM uses opaque positional tokens.
Shipped JSON remains inspectable in developer tools: this prevents accidental
spoilers, not source inspection.

## Per-record safe presentation review

Every row uses the same fixed neutral guidance in Minimal. Light admits only the
listed broad region. No raw companion/rank/missability field is projected.

| Original stable ID | Act | Light broad region | Protected guidance decision |
|---|---:|---|---|
| a1-grove-zorru | 1 | Wilderness | Neutral; exact context/associations withheld |
| a1-swamp-gandrel | 1 | Wilderness | Neutral; exact context/associations withheld |
| a1-blighted-necromancy | 1 | Wilderness | Neutral; exact context/associations withheld |
| a1-risen-karlach-wyll | 1 | Wilderness | Neutral; exact context/associations withheld |
| a1-waukeens-wyll | 1 | Wilderness | Neutral; exact context/associations withheld |
| a1-gith-patrol | 1 | Wilderness | Neutral; exact context/associations withheld |
| a1-creche | 1 | Mountain Pass | Neutral; exact context/associations withheld |
| a1-grymforge | 1 | Underdark | Neutral; exact context/associations withheld |
| a2-entry-shadowheart | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-lastlight-dammon | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-lastlight-raphael | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-lastlight-isobel | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-lastlight-art | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-reithwin-halsin | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-moonrise-araj | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-moonrise-balthazar-room | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-moonrise-prison | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-mausoleum-raphael | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-gauntlet-general | 2 | Withheld | Neutral; exact context/associations withheld |
| a2-gauntlet-yurgir | 2 | Withheld | Neutral; exact context/associations withheld |
| a2-shadowfell | 2 | Withheld | Neutral; exact context/associations withheld |
| a2-assault-jaheira | 2 | Shadow-Cursed Lands | Neutral; exact context/associations withheld |
| a2-colony-mizora | 2 | Withheld | Neutral; exact context/associations withheld |
| a2-colony-gale | 2 | Withheld | Neutral; exact context/associations withheld |
| a2-colony-minthara | 2 | Withheld | Neutral; exact context/associations withheld |
| a3-rivington-orin | 3 | Rivington | Neutral; exact context/associations withheld |
| a3-circus-zethino | 3 | Rivington | Neutral; exact context/associations withheld |
| a3-openhand-tara | 3 | Rivington | Neutral; exact context/associations withheld |
| a3-gur-camp | 3 | Rivington | Neutral; exact context/associations withheld |
| a3-ferg | 3 | Rivington | Neutral; exact context/associations withheld |
| a3-danthelon | 3 | Wyrm's Crossing | Neutral; exact context/associations withheld |
| a3-western-beach | 3 | Rivington | Neutral; exact context/associations withheld |
| a3-flophouse | 3 | Wyrm's Crossing | Neutral; exact context/associations withheld |
| a3-sharess-drow | 3 | Wyrm's Crossing | Neutral; exact context/associations withheld |
| a3-sharess-voss | 3 | Wyrm's Crossing | Neutral; exact context/associations withheld |
| a3-coronation | 3 | Wyrm's Crossing | Neutral; exact context/associations withheld |
| a3-guildhall | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-counting-house | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-cistern | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-jaheira-home | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-sorcerous | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-stormshore-gale | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-house-grief | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-cazador | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-iron-throne | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-wyrmway | 3 | Withheld | Neutral; exact context/associations withheld |
| a3-house-hope | 3 | Withheld | Neutral; exact context/associations withheld |
| a3-murder-tribunal | 3 | Lower City | Neutral; exact context/associations withheld |
| a3-bhaal-orin | 3 | Withheld | Neutral; exact context/associations withheld |
| a3-gortash-final | 3 | Withheld | Neutral; exact context/associations withheld |
| a3-lowercity-general | 3 | Lower City | Neutral; exact context/associations withheld |

All original route groups/notes remain Full-only. Only nonempty displayed groups
contribute to the route overview, sequential numbering and next-stop labels.
No route or next-stop text is built from an excluded record.

## Implementation and QA

- `assets/companion-guide-model.js`: validation, projection and pure original planner.
- `assets/companion-guide.js`: memory-only controller, stale-load guards and scoped DOM.
- `assets/companion-guide.css`: selectors scoped to the dedicated guide root.
- `index.html`: additive shell adapter and presentation notifications only.

Malformed/missing data shows an in-view retry without touching storage. Data fetch
uses the explicit same-origin JSON asset with omitted credentials. Context changes
and closing abort guide-only loads; stale responses cannot restore old UI. Inputs
stay mounted during filtering; search has no change/blur rerender handler. Local
reveal/research updates preserve their original buttons and focus.

Run focused checks with `node --test tests/companion-guide.test.cjs tests/pages-build.test.cjs`.
Historical acquisition whole-file guards remove only exact fixture-checked shell
additions; every original Tracker byte is still compared. A regression proves an
unrelated renderer edit remains detectable and guide adapter drift is rejected.

Build with `node scripts/build-pages.cjs`. Run the repeatable native QA script:

```sh
BG3_PLAYWRIGHT_MODULE=/path/to/playwright BG3_CHROME_PATH=/path/to/chrome node scripts/qa-companion-guide.cjs
```

It serves dist only, uses fresh disposable contexts at 320/390/768/1280, blocks
Supabase/external writes, and supplies a local catalogue fixture. It checks pure
guide storage effects separately from explicit Tracker preference/Story actions.
Captures and reports default to an OS temporary directory. No real account or
existing browser profile is used. The exact 27-file public inventory is tested;
prototype/research/docs/tests/QA scripts remain excluded. Nothing is deployed by
these checks.

Closing the guide empties its generated DOM while retaining only its in-memory
controller. This also prevents the existing offline-HTML export from serializing
guide selections/reveals. Reopening reconstructs the guide without duplicating
root event handlers. Standalone Tracker offline HTML does not embed the guide’s
modules/JSON; unavailable assets use the recoverable loading/return path. Tracker
export logic itself is unchanged.

## Local companion portraits

The ten WebP portraits are copied byte-for-byte from the supplied
`companion-guide-v0.3 4/assets/portraits/` folder. Only those images are added to
public assets; the supplied prototype code and research are not shipped.
`companion-guide.js` maps exact supported companion names to fixed local files,
including `Lae'zel` → `laezel.webp`; there is no fuzzy matching or image service.
The model, original 51 records and recommendation algorithm are unchanged.

The same labelled portrait is used in party choice buttons, the selected party,
Full card companion rows, Out/In suggestions and companion explanation rows.
Minimal/Light card associations remain absent until deliberate local reveal.
Images are decorative (`alt=""`, avatar hidden from accessibility), with visible
names providing the label. Fixed avatar boxes retain an initial underneath; a
captured image error removes only the failed image. No remote fallback, storage,
backend call or automatic party action is introduced. Styles stay guide-scoped.

Provenance from the supplied `portrait-sources.json`: portraits are Larian Studios
assets; the supplied manifest refers to these BG3 Wiki file pages for attribution
and fan-content terms. These are provenance links, not runtime image dependencies.

| Companion | Local file | Supplied source |
|---|---|---|
| Astarion | `assets/portraits/astarion.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Astarion.png) |
| Gale | `assets/portraits/gale.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Gale.png) |
| Halsin | `assets/portraits/halsin.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Halsin.png) |
| Jaheira | `assets/portraits/jaheira.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Jaheira.png) |
| Karlach | `assets/portraits/karlach.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Karlach.png) |
| Lae'zel | `assets/portraits/laezel.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Lae%27zel.png) |
| Minsc | `assets/portraits/minsc.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Minsc.png) |
| Minthara | `assets/portraits/minthara.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Minthara.png) |
| Shadowheart | `assets/portraits/shadowheart.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Shadowheart.png) |
| Wyll | `assets/portraits/wyll.webp` | [BG3 Wiki](https://bg3.wiki/wiki/File:Portrait_Wyll.png) |

## Guide-local spoiler control verification

`tests/guide-spoiler-mode.test.cjs` covers the inherited-mode/choice matrix,
invalid values, scope/security transitions, equivalent modes, clear/reset behavior,
retry/close/reopen and stale completions. Shared adapter tests guard opaque scope
and revision semantics. Historical guards still compare every original Tracker
byte after exact fixture-checked shell additions; portrait guards use that same
boundary for the intentionally changed adapter.

Native QA includes keyboard radio semantics, 44px segments, mode transitions,
ignored Tracker preference updates preserving focused nodes, Story reset and
zero guide-caused writes. Set `BG3_QA_ORIGIN` to a verified hosted origin to run
that same script against deployed runtime assets in fresh disposable contexts.
The SDK/analytics scripts are neutralized and catalogue input is the local fixture;
no real account/profile or Supabase/external writes are used. Data, runtime JS/CSS
and portraits are loaded from the selected origin. Hosted verification does not
change deployment configuration.

## Mobile-first presentation

The guide uses two component breakpoints (620px and 960px), with a two-column
portrait grid on phones, four columns on tablets and five on desktop. Every
choice retains its visible name, decorative local portrait, native button and
pressed state; the visual selection check is hidden from accessibility output.
The selected-party line is a lighter summary, rather than a second set of tiles.
Act and optional romance controls precede party selection.

The always-visible native spoiler radios and effective-mode status keep the same
controller and invalidation rules. The introduction is concise; the complete
research limitations remain reachable in the native “About this guide” disclosure.
Search stays visible. Secondary filters use a native “Filters” disclosure, whose
summary reports active non-search filters using the existing safe filter state.
These disclosures add no persistent preference or storage writes.

Cards lead with region, location and encounter, then show the editorial priority,
party advice and companion reasons. Out/In direction labels and decorative arrows
remain separate for multi-swaps. Sources and intentionally revealed research are
visually grouped below the primary content. Desktop companion reasons share two
columns; phone content flows in one column with bounded, readable line lengths.
No reviewed facts, source links, evidence markers or recommendation logic change.

`tests/guide-polish.test.cjs` guards factual/source preservation and presentation
semantics. Native browser QA covers all four widths, all 51 records, compact setup,
44px targets, native filter/about disclosure keyboard behavior, decorative checks,
long-content wrapping, portrait fallback and the existing spoiler/state/focus/
loading/retry paths. Screenshots are reviewed visually before shipping. Public
packaging remains the same 27-file allowlist.


## Anonymous start gate and V2 art

Before explicit Act selection, the controller publishes no companion identities,
selected party, romance, filters, results, route groups, plans or detail/research
access. The shell constructs only three uniform anonymous party-slot graphics;
real buttons/options/portraits are not constructed and then hidden. Romance and
search/filter/view controls fail closed. No real portrait requests occur.

A separate reviewed identity-display roster is shared by all effective modes,
as explicitly approved for this checkpoint. It is independent of encounter
mentions and is **not** a recruitment, survival, romance or live availability
model. Minimal/Light still conceal content associations through the unchanged
projection. See [reviewed policy and art provenance](companion-guide-visibility.md).

Act changes prune invalid party/romance selections and clear reveals, notes and
filters. Cleared Act and Story/account/security resets restore anonymity; former
choices do not resurrect. Still-safe choices retain their nodes and effective
mode changes retain the explicit Act and safe roster selections. Late async data
cannot bypass the current gate. Detail/research access checks current Act even
when a caller retains an older view. The model, 51 records and algorithm are intact.

Runtime art is limited to fourteen final WebP images and the reviewed visibility
module. This intentionally expands public packaging from 27 to 42 files; source
PNGs, the zip, reference boards and generation reports stay outside public assets.
The art uses dedicated mobile/desktop backgrounds at the existing 960px wide
layout breakpoint, subtle card texture and ten supplied decorative UI icons.
The fixed background layer stays below the shared header and preserves source
aspect ratio with cover; returning to Tracker removes this guide-only artwork.
