# BG3 Gear Collector v7 CLOUD DEV

This build is the architecture step after v6 Mobile/PWA. It introduces **Stories** and a cloud-sync adapter while keeping the existing BG3 item keys and v5/v6 JSON import compatibility.

## What works without Supabase
- Responsive desktop/mobile collector UI
- Multiple local Stories/playthroughs
- Per-Story progress
- v5/v6 JSON import into the currently selected Story
- JSON export as backup
- Local/offline cache

## Enable cloud sync
1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase-schema.sql`.
3. In Supabase Auth, keep Email enabled. Add your GitHub Pages URL to the allowed redirect URLs before testing magic-link login.
4. In the project **Connect** dialog (or Settings > API Keys), copy:
   - Project URL
   - **Publishable** key (`sb_publishable_...`)
5. Put only those two values in `config.js`. **Never put a secret/service-role key in the browser app.**
6. Deploy the folder to GitHub Pages.

## Cloud behavior
- A checkbox change updates instantly locally, then syncs to `story_progress`.
- `found` and `todo` are both stored with a client timestamp. This lets an offline *uncheck* sync correctly later instead of being mistaken for “no data”.
- When the app opens, gets focus, comes back online, or you press **Synka nu**, local and cloud records are reconciled using the latest client timestamp.
- Each Story has independent progress.
- JSON export remains available as a user-controlled backup.

## Current development limitation
Local Stories created before signing in are intentionally **not automatically uploaded**. For the first cloud migration, create the cloud Story (for example `Siberia`) and use the existing v5/v6 JSON import while that Story is selected. This avoids ambiguous merges during the initial transition.
