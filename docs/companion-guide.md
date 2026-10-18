# Companion Content Guide — final information and draft contract

The guide remains a local, read-only companion-content view inside the Tracker.
All 51 original research records, IDs, source URLs, evidence markers, raw notes,
metadata and route definitions are preserved. `presentation` is separately
reviewed output metadata; raw `why_spoiler_free`, encounter summaries and notes
are not rendered, even behind Sources & notes. This is presentation review against
existing research, not new factual verification or a recruitment/availability model.

## Information levels

| Mode | Direct output | Entry-local disclosure |
|---|---|---|
| Minimal | Reviewed broad area, neutral content label | Reveal companion: names/portraits only |
| Light | Companions/portraits, reviewed broad area, neutral guidance | Reveal exact location: reviewed exact site and neutral access copy only |
| Full | Exact site, practical trigger/timing, party recommendations | Sources & notes: original source links and a reviewed evidence caveat |

Dialogue results, approval results, scene outcomes, consequences and twists are
excluded from every level. Full is practical guidance, not a scene summary.
Unknown exact sites and unreviewed broad parentage remain withheld rather than
inferred. Original research remains inspectable in shipped JSON; UI safety is
not an attempt to prevent source inspection. Raw research is never destructively
rewritten. Player-observed evidence is not upgraded to independent confirmation.

One reviewed projection feeds Act gating, per-entry reveal, search, filters,
counts, grouping, recommendations and DOM. Minimal reveal cannot expose exact
geography. Light reveals cannot expose raw encounter text. Each reveal is local;
revealed safe fields may participate in search, but unrevealed fields cannot.
Mode changes clear reveals, optional sources and search synchronously.

Route is available in all modes. Minimal/Light group by reviewed broad areas in
fixed broad-area order and opaque token order within each area. Concealed exact
fields and original route order/labels cannot change this ordering. Unreviewed
broad areas are labelled only by Act. Full uses reviewed geographic route labels,
with plot/progression notes withheld. The original recommendation algorithm and
its independent prototype fixtures are unchanged. Only Full supplies its reviewed
practical context; protected modes cannot derive swaps from concealed ranks.

The existing explicitly selected Act gate remains first: no names, portraits,
romance options or results before an Act choice. The reviewed 6/9/10 identity
roster remains shared by modes and makes no claim about live recruitment. A
stricter mode hides associations and prunes any restored selection outside the
current Act roster; it does not invent a new mode-specific recruitment roster.

## One local UI draft

Key: `bg3-companion-guide-draft-v1`.

```json
{"version":1,"scope":"companion-scope-sha256-<opaque digest>","act":1,"party":["Gale","Astarion","Shadowheart"],"romance":"Shadowheart","view":"route"}
```

Only Act, party, romance and Browse/Route persist. Spoiler override returns to
Story after reload. Reveals, sources, research, search, loading/errors and filters
are never persisted. Writes happen on relevant selection changes, never unload.
All storage operations are guarded; unavailable storage leaves an in-memory guide.

The stable Story/account/backend scope inputs are digested with WebCrypto SHA-256 into the
opaque guide identity. Raw Story/account/backend IDs never enter the draft. The
old session counter alone was not reload-safe. Pending digests cannot restore or
save drafts; stale digest completion cannot change a newer scope. Environments
without WebCrypto retain session-only behavior and cannot incorrectly restore a
counter-colliding draft. Session-only sign-out flags still revoke the previous draft
but are excluded from its reload identity. This is a scoped pseudonymous key, not an auth token.

Only the initial resolved scope may restore once. Version, exact field inventory,
scope, Act, party bounds/uniqueness/current roster, romance and view are checked.
Invalid versions/JSON/scope/Act fail to an anonymous start. Invalid party/romance
are pruned; invalid view falls back to Browse. No stored value grants a spoiler
reveal. A retained Act represents the user's prior deliberate choice in that scope.

Story/account/backend namespace transitions clear the one current draft and reset
the guide. A → B → A does not resurrect A. Scope notification clears the draft even
if the guide module has not been opened. Same-scope auth/backend refresh revisions revoke transient reveals/search but
retain validated setup and the current draft. No Story preference, auth, backend, sync, progress,
ownership, acquisition, PWA, transport, research or production configuration change
is introduced. The explicit public artifact remains exactly 42 files.

## All-record presentation audit

Each row below was reviewed against its preserved research text. The practical
field is a conservative extraction, never an added outcome or invented prerequisite.
Minimal uses broad area only; Light adds names and optionally the reviewed site;
Full adds the listed practical guidance. Sources & notes exposes links and a
standard evidence caveat only, never the preserved raw notes.

| Stable ID | Broad area in protected modes | Reviewed Full site | Practical guidance |
|---|---|---|---|
| a1-grove-zorru | Wilderness | Druid Grove | Talk to Zorru with Lae'zel in your party. |
| a1-swamp-gandrel | Wilderness | Riverside Teahouse area | Bring Astarion when approaching Gandrel in the Riverside Teahouse area. |
| a1-blighted-necromancy | Wilderness | Blighted Village | Check the Necromancy of Thay with Astarion; Gale is an alternative companion for this stop. |
| a1-risen-karlach-wyll | Wilderness | Risen Road / Toll House | Bring Wyll and Karlach when visiting the Paladins of Tyr at the Toll House. |
| a1-waukeens-wyll | Wilderness | Waukeen's Rest | Bring Wyll when speaking with Florrick. Check this stop promptly once the situation is triggered. |
| a1-gith-patrol | Wilderness | Mountain Pass approach | Bring Lae'zel when approaching the githyanki patrol. |
| a1-creche | Mountain Pass | Crèche Y'llek | Explore the crèche with Lae'zel; this recommendation covers several stops in the area. |
| a1-grymforge | Underdark | Grymforge | Consider Shadowheart for exploration. No party swap is needed solely for this stop. |
| a2-entry-shadowheart | Shadow-Cursed Lands | Shadowlands entry | Consider Shadowheart while exploring the region. No party swap is required at the entry. |
| a2-lastlight-dammon | Shadow-Cursed Lands | Last Light Inn | Bring Karlach when visiting Dammon at Last Light Inn. |
| a2-lastlight-raphael | Shadow-Cursed Lands | Last Light Inn | Bring Astarion when speaking with Raphael at Last Light Inn. |
| a2-lastlight-isobel | Shadow-Cursed Lands | Last Light Inn | Consider Shadowheart when speaking with Isobel; this is an optional party choice. |
| a2-lastlight-art | Shadow-Cursed Lands | Last Light Inn | Follow the Art Cullagh lead and speak with Halsin. He may still be a camp follower rather than an active party companion. |
| a2-reithwin-halsin | Shadow-Cursed Lands | Reithwin / Tollhouse / House of Healing | Consider Halsin while exploring Reithwin and the nearby Thorm locations. |
| a2-moonrise-araj | Shadow-Cursed Lands | Moonrise Towers | Bring Astarion when speaking with Araj Oblodra. |
| a2-moonrise-balthazar-room | Shadow-Cursed Lands | Balthazar's Room | Bring Gale when examining the experiment in Balthazar's Room. |
| a2-moonrise-prison | Shadow-Cursed Lands | Moonrise Towers Prison | Use your preferred party for the prison. Wyll, Karlach and Astarion are optional choices. |
| a2-mausoleum-raphael | Shadow-Cursed Lands | Grand Mausoleum entrance | Bring Astarion when speaking with Raphael at the Grand Mausoleum entrance. Karlach is an optional additional choice. |
| a2-gauntlet-general | Act 2 area (parentage withheld) | Gauntlet of Shar | Explore the Gauntlet with Shadowheart; this is an area-wide recommendation. |
| a2-gauntlet-yurgir | Act 2 area (parentage withheld) | Yurgir's Lair | Bring Astarion when following Raphael's request at Yurgir's Lair. |
| a2-shadowfell | Act 2 area (parentage withheld) | Shadowfell | Bring Shadowheart before entering this area. |
| a2-assault-jaheira | Shadow-Cursed Lands | Moonrise Towers assault | Check Jaheira's involvement at Moonrise Towers; she may be an attached follower. Minthara is an optional choice. |
| a2-colony-mizora | Act 2 area (parentage withheld) | Tadpoling Centre | Bring Wyll before entering the Colony; party changes are unavailable inside. Check Mizora's pod with him present. |
| a2-colony-gale | Act 2 area (parentage withheld) | Mind Flayer Colony | Bring Gale for the Colony sequence if you want to check his companion content. |
| a2-colony-minthara | Act 2 area (parentage withheld) | Mind Flayer Colony | Consider Minthara while exploring the Colony. |
| a3-rivington-orin | Rivington | Rivington | Consider Minthara when exploring Rivington. |
| a3-circus-zethino | Rivington | Circus of the Last Days | Bring your selected romance companion when speaking with Zethino. |
| a3-openhand-tara | Rivington | Open Hand Temple roof | Bring Gale when visiting Tara on the Open Hand Temple roof. |
| a3-gur-camp | Rivington | Gur Camp | Bring Astarion when speaking with Ulma at the Gur Camp. |
| a3-ferg | Rivington | Refugee area | Bring Shadowheart when speaking with Ferg Drogher. Complete any desired shopping beforehand. |
| a3-danthelon | Wyrm's Crossing | Danthelon's Dancing Axe | Bring Jaheira when visiting the Harper safehouse at Danthelon's Dancing Axe. |
| a3-western-beach | Rivington | Western Beach | Use your preferred party at the Western Beach. Jaheira is an optional choice. |
| a3-flophouse | Wyrm's Crossing | Fraygo's Flophouse | Bring Astarion when meeting Petras and Dalyria. Disable active sunlight effects before approaching. |
| a3-sharess-drow | Wyrm's Crossing | Sharess' Caress | Bring your selected romance companion when visiting the drow twins. |
| a3-sharess-voss | Wyrm's Crossing | Sharess' Caress / Devil's Den | Bring Lae'zel before visiting Voss and Raphael in the Devil's Den. Karlach is an optional, player-reported choice. |
| a3-coronation | Wyrm's Crossing | Wyrm's Rock Fortress | Bring Karlach and Wyll when attending the coronation. |
| a3-guildhall | Lower City | Guildhall | Bring Jaheira when speaking with Nine-Fingers Keene. |
| a3-counting-house | Lower City | The Counting House | Bring Jaheira when following the Stone Lord lead at the Counting House. |
| a3-cistern | Lower City | Abandoned Cistern | Consider Jaheira for the Abandoned Cistern. This recommendation does not claim she must occupy an active party slot. |
| a3-jaheira-home | Lower City | Elerrathin's Home | Bring Jaheira to Elerrathin's Home. Minsc is an additional choice if already recruited. |
| a3-sorcerous | Lower City | Sorcerous Sundries / Sorcerous Vault | Bring Gale when looking for the Annals of Karsus in the Sorcerous Vault. |
| a3-stormshore-gale | Lower City | Stormshore Tabernacle | Follow Gale's quest lead to Stormshore Tabernacle after the Annals of Karsus. |
| a3-house-grief | Lower City | House of Grief / Cloister of Sombre Embrace | Bring Shadowheart when visiting the House of Grief. Jaheira and Minsc are additional choices if available. |
| a3-cazador | Lower City | Cazador's Palace | Bring Astarion when visiting Cazador's Palace. |
| a3-iron-throne | Lower City | Iron Throne | Consider Wyll for the Iron Throne. His active presence is not a mechanical requirement. |
| a3-wyrmway | Act 3 area (parentage withheld) | The Wyrmway | Bring Wyll for the Wyrmway trials. |
| a3-house-hope | Act 3 area (parentage withheld) | House of Hope | Consider Lae'zel for the House of Hope; a party swap is not mechanically required. |
| a3-murder-tribunal | Lower City | Murder Tribunal | Consider Jaheira and Minsc when visiting the Murder Tribunal. |
| a3-bhaal-orin | Act 3 area (parentage withheld) | Temple of Bhaal | Consider Minthara when visiting the Temple of Bhaal. |
| a3-gortash-final | Act 3 area (parentage withheld) | Withheld: exact site not established | Bring Karlach when following her quest lead to Gortash. |
| a3-lowercity-general | Lower City | Lower City general exploration | Consider Jaheira and, if already recruited, Minsc for general Lower City exploration. |

## Verification

Permanent sentinel regressions cover all information levels, local reveals, safe Route ordering and scoped draft restore/invalidation. Existing independent recommendation, original research and exact Tracker-byte boundary guards remain active. Disposable native browser QA covers 320/390/768/1280, all records/modes, reload, scope transitions, corrupt/unavailable storage, keyboard/focus, Tracker preservation and blocked backend access. Internal tests/docs/research remain excluded from deployment.
