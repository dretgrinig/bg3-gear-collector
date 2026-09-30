'use strict';

// Deliberately failing safety assertions against the unchanged legacy schema.
// Run separately: PG_BIN_DIR=/absolute/existing/bin node tests/database/run.cjs --baseline
const test = require('node:test');
const assert = require('node:assert/strict');
const { newStory, sql, asUser, literal } = require('./helpers.cjs');
const upsert = (story, key, status, timestamp) => sql(asUser(`
  insert into public.story_progress(story_id,item_key,status,client_updated_at)
  values(${literal(story)},${literal(key)},${literal(status)},${literal(timestamp)})
  on conflict(story_id,item_key) do update set status=excluded.status,client_updated_at=excluded.client_updated_at;`));
const read = (story, key) => sql(asUser(`select status from public.story_progress where story_id=${literal(story)} and item_key=${literal(key)};`));

test('baseline: two clients from the same base must not silently overwrite the accepted edit', async () => {
  const story = await newStory();
  await upsert(story, 'same-base', 'todo', '2026-01-01T00:00:00Z');
  assert.equal(await read(story, 'same-base'), 'todo'); // device A base
  assert.equal(await read(story, 'same-base'), 'todo'); // device B same base
  await upsert(story, 'same-base', 'found', '2026-01-02T00:00:00Z');
  await upsert(story, 'same-base', 'skipped', '2026-01-02T00:00:00Z');
  assert.equal(await read(story, 'same-base'), 'found', 'legacy upsert overwrote device A without conflict');
});

test('baseline: delayed stale write must not overwrite a newer committed write', async () => {
  const story = await newStory();
  await upsert(story, 'delayed', 'found', '2026-01-03T00:00:00Z');
  await upsert(story, 'delayed', 'todo', '2026-01-01T00:00:00Z');
  assert.equal(await read(story, 'delayed'), 'found', 'older timestamp still wins when its write arrives last');
});

test('baseline: competing absent-item inserts must not silently overwrite the first insert', async () => {
  const story = await newStory();
  assert.equal(await read(story, 'absent'), ''); // both devices saw no row
  await upsert(story, 'absent', 'found', '2026-01-01T00:00:00Z');
  await upsert(story, 'absent', 'todo', '2026-01-01T00:00:00Z');
  assert.equal(await read(story, 'absent'), 'found', 'ON CONFLICT UPDATE bypasses absent-base protection');
});
