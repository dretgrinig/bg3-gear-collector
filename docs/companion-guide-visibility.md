# Companion identity display review and V2 artwork

## Policy boundary

The user approved a separately reviewed Act-based visibility roster shared by
Story/Minimal/Light/Full. Before a deliberate Act choice, all identities remain
concealed. Modes continue to control encounter associations and exact content.
This roster permits **name display**, never claims a companion is recruited,
alive, available at this point, romanceable, or compatible with the player's
choices. It is cumulative and independent of the 51 content records. Missing
content associations do not remove an otherwise reviewed identity.

Reviewed 2026-10-18 against BG3 Wiki:

| Identities | First display Act | Review evidence |
|---|---:|---|
| Astarion, Gale, Karlach, Lae'zel, Shadowheart, Wyll | 1 | [Companions: Origin companions](https://bg3.wiki/wiki/Companions#Origin_companions) identifies the six early Origin companions. |
| Halsin | 2 | [Halsin: Recruitment](https://bg3.wiki/wiki/Halsin#Recruitment) places full companion recruitment in Act Two; earlier follower/camp context is not used to reveal recruitability in Act One. |
| Jaheira | 2 | [Jaheira: Recruitment](https://bg3.wiki/wiki/Jaheira#Recruitment) allows full recruitment near the end of Act Two, with conditional later cases. This is not an early-Act availability guarantee. |
| Minthara | 2 | [Minthara: Recruitment](https://bg3.wiki/wiki/Minthara#Recruitment) explicitly separates Act One encounters from permanent recruitment in Act Two. |
| Minsc | 3 | [Minsc: Recruitment](https://bg3.wiki/wiki/Minsc#Recruitment) places recruitment in Act Three. |

Thus the display sets contain 6 / 9 / 10 identities, shared by all modes. The
explicit Act choice permits that Act's identity disclosures even if the player
has not completed its relevant events. There is no save/progress inference,
heuristic extraction from prose, remote lookup, or new stored state.

`assets/companion-guide-visibility.js` uses exact existing companion names, a
fixed first-display-Act map, strict Act normalization and a projection gate.
Unknown Acts fail closed. Full records with contradictory future structured
identities are withheld. Protected projections remain independent of concealed
associations. Original content, recommendation scoring and source/evidence data
are not rewritten.

## Supplied V2 art provenance

Sources: user-supplied `companion-guide-design-assets-v2.zip`, `bg-desktop.png`
and `bg-mobile.png`. The zip's reference crops are reference-only. No reference
board or original unused variant is added to runtime/public output.

| Runtime file under `assets/guide-v2/` | Source and transformation | Dimensions |
|---|---|---:|
| bg-desktop.webp | Dedicated bg-desktop.png; WebP quality 90, no resizing | 1672×941 |
| bg-mobile.webp | Dedicated bg-mobile.png; WebP quality 90, no resizing | 1086×1448 |
| anonymous-companion.webp | Supplied anonymous-companion.png; proportional downscale, lossless WebP | 128×128 |
| panel-texture.webp | Supplied optimized WebP, unchanged | 1200×464 |
| back / lock / party / romance / search / filter / browse / route / swap / selected .webp | Corresponding supplied icons/*.png; proportional downscale, lossless WebP | 48×48 each |

Transforms preserve the supplied style, silhouettes and alpha. Output metadata
is stripped; no private/local paths are embedded. The two backgrounds total
185,604 bytes, versus 3,596,193 source PNG bytes. Asset hashes, independent sizes
and format/metadata regressions are in `tests/fixtures/guide-v2-assets.json` and
`tests/guide-visual-assets.test.cjs`. No product dependency is added.

At widths below 960px, the portrait-oriented background uses 74% top framing;
wide layouts use the landscape art with right/top framing. Both use cover with
source aspect ratio preserved and dark overlays behind content. The breakpoint
matches the existing wide five-column layout. Only the active background is
requested. Cards use a restrained dark texture; semantic priority colors remain
unchanged. All icons are decorative; real text/native semantics remain primary.

Anonymous graphics are identical across three party slots and carry only the
neutral label “Hidden companion”. If their image fails, the same local neutral
lock graphic remains. Portrait errors retain the established initial fallback
after safe reveal. Decorative icon failures remove only the failed image.
