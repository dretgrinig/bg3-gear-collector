const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', '..', 'index.html'), 'utf8');
// Execute the real inline implementation against isolated DOM/storage/SDK mocks.
const section = (start, end) => {
  const first = html.indexOf(start), last = html.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Application section missing: ${start}`);
  return html.slice(first, last);
};
const core = section('const DBKEY=', 'async function migrateLegacyAuthStorage()');
const authSupport = section('async function migrateLegacyAuthStorage()', 'async function initCloud(');
const reset = section('$("reset").onclick=', '$("export").onclick=');
const imports = section('let importMode="merge";', '$("saveOffline").onclick=');
const triggers = section('$("syncNow").onclick=', '// --- PWA shell');
const sessions = section('async function handleSession(', '/* v7.6.1: duplicate');
const bootstrap = section('async function initCloud(', 'async function handleSession(');
const passwords = section('$("savePassword").onclick=', '$("sendMagicLink").onclick=');
const login = section('$("signInPassword").onclick=', '$("showPasswordPanel").onclick=');
const logout = section('$("signOut").onclick=', '$("syncNow").onclick=');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const record = (status = 'found', timestamp = '2026-09-29T10:00:00.000Z') => ({
  status, client_updated_at: timestamp, dirty: true
});
const row = (item_key, value) => ({ item_key, status: value.status, client_updated_at: value.client_updated_at });
const ownedStories = (userId = 'user-a') => [
  { id: 'A', name: 'A', user_id: userId, created_at: '2026-09-29T10:00:00.000Z' },
  { id: 'B', name: 'B', user_id: userId, created_at: '2026-09-29T11:00:00.000Z' }
];

function harness({ userId = 'user-a', stories = ownedStories(userId) } = {}) {
  const storage = new Map(), timers = new Map(), reads = [], writes = [], renders = [], errors = [];
  const authReads = [], authWrites = [], bootReads = [], authCallbacks = [], storyReads = [], storyWrites = [], calls = [], events = new Map();
  const signOuts = [], signIns = [], adoptedSessions = [], storageCalls = [], storageFaults = new Map(), alerts = [];
  const clientOptions = [], activeAuthCallbacks = new Set();
  let timerId = 0, clock = Date.parse('2026-09-29T12:00:00.000Z');
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', innerHTML: '', className: ['authSignedIn', 'passwordPanel'].includes(id) ? 'hidden' : '', disabled: false, options: [],
      add(option) { this.options.push(option); }, click() {}, focus() {},
    });
    const value = elements.get(id);
    if (!value._htmlAccessor) {
      let html = '';
      Object.defineProperty(value, 'innerHTML', {
        get() { return html; },
        set(content) { html = content; if (content === '') this.options = []; }
      });
      value._htmlAccessor = true;
      const classes = () => new Set(value.className.split(/\s+/).filter(Boolean));
      value.classList = {
        add(...names) { const list = classes(); names.forEach(name => list.add(name)); value.className = [...list].join(' '); },
        remove(...names) { const list = classes(); names.forEach(name => list.delete(name)); value.className = [...list].join(' '); },
        contains(name) { return classes().has(name); }
      };
    }
    return value;
  };
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  function request(queue, details) {
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    const entry = { ...details, resolve, reject };
    queue.push(entry);
    calls.push(entry);
    // SDK reads/mutations are thenable builders; keep request metadata mutable
    // so filters added after select()/update() are observable in assertions.
    return {
      select() { return this; }, single() { return this; },
      order(column) { entry.order = column; return this; },
      eq(column, value) {
        entry.filters = entry.filters || {};
        entry.filters[column] = value;
        if (column === 'story_id') entry.storyId = value;
        if (column === 'user_id') entry.userId = value;
        return this;
      },
      then(done, fail) { return promise.then(done, fail); },
      catch(fail) { return promise.catch(fail); },
      finally(done) { return promise.finally(done); },
      abortSignal(signal) { entry.signal = signal; return this; }
    };
  }
  const client = {
    auth: {
      getUser() { return request(authReads, { type: 'session' }); },
      getSession() { return request(bootReads, { type: 'bootstrap-session' }); },
      signOut(options) { return request(signOuts, { type: 'sign-out', options: options ? clone(options) : null }); },
      signInWithPassword(value) { return request(signIns, { type: 'sign-in', value: clone(value) }); },
      setSession(value) { return request(adoptedSessions, { type: 'adopt-session', value: clone(value) }); },
      onAuthStateChange(callback) {
        authCallbacks.push(callback);
        activeAuthCallbacks.add(callback);
        return { data: { subscription: { unsubscribe() { activeAuthCallbacks.delete(callback); } } } };
      },
      stopAutoRefresh() {}, startAutoRefresh() {},
      updateUser(value) { return request(authWrites, { type: 'password', value: clone(value) }); }
    },
    from(table) {
      assert.ok(['stories', 'story_progress'].includes(table), 'unknown table in isolated mock');
      return {
        select(columns) {
          return request(table === 'stories' ? storyReads : reads,
            { type: table === 'stories' ? 'stories' : 'progress', columns, table });
        },
        upsert(items, options) {
          assert.equal(table, 'story_progress');
          assert.equal(options.onConflict, 'story_id,item_key');
          return request(writes, { type: 'upload', table, items: clone(items) });
        },
        insert(value) { return request(storyWrites, { type: 'create', table, value: clone(value) }); },
        update(value) { return request(storyWrites, { type: 'rename', table, value: clone(value) }); }
      };
    }
  };
  const storageMethod = method => ({ get: 'getItem', set: 'setItem', remove: 'removeItem' }[method] || method);
  const faultKey = (method, key) => storageMethod(method) + '\0' + key;
  function storageOperation(method, key, value) {
    storageCalls.push({ method, key, ...(value === undefined ? {} : { value: String(value) }) });
    const fault = storageFaults.get(faultKey(method, key)) || storageFaults.get(faultKey(method, '*'));
    if (fault) throw fault;
    if (method === 'getItem') return storage.get(key) ?? null;
    if (method === 'setItem') storage.set(key, String(value));
    else storage.delete(key);
  }
  const context = vm.createContext({
    window: {
      BG3_CLOUD_CONFIG: { supabaseUrl: 'mock', supabasePublishableKey: 'mock' }, supabase: {
        createClient(url, publishableKey, options) { clientOptions.push(options); return client; }
      },
      addEventListener(name, callback) {
        if (!events.has(name)) events.set(name, []);
        events.get(name).push(callback);
      }
    },
    navigator: { onLine: true }, document: { getElementById: element },
    location: { hash: '', pathname: '/', search: '' },
    history: { replaceState() {} },
    Option: function Option(name, id) { this.name = name; this.text = name; this.id = id; },
    localStorage: {
      getItem: id => storageOperation('getItem', id),
      setItem: (id, value) => storageOperation('setItem', id, value),
      removeItem: id => storageOperation('removeItem', id)
    }, Date: FakeDate, AbortController,
    setTimeout(callback, delay = 0) {
      const id = ++timerId; timers.set(id, { callback, delay, at: clock + delay }); return id;
    },
    clearTimeout: id => timers.delete(id),
    render: () => renders.push(vm.runInContext('({id:activeStoryId, progress:{...progress}})', context)),
    confirm: () => true, alert: message => alerts.push(String(message)), URLSearchParams,
    console: { error: error => errors.push(error), warn() {}, log() {} }
  });
  vm.runInContext([core, authSupport, reset, imports, triggers, sessions, passwords, bootstrap, login, logout].join('\n'), context);
  context.mockClient = client;
  context.fixtureUserId = userId;
  context.fixtureStories = clone(stories);
  const app = vm.runInContext(`({
    sync: syncCurrentStory, activate: activateStory, mark: markRecord,
    payload: progressFromPayload, create: createStory, rename: renameActiveStory,
    load: loadCloudStories, session: handleSession, init: initCloud,
    logout() { return $("signOut").onclick(); },
    login(email='regression@example.invalid', password='Regression-only-password-123!') {
      $("authEmail").value=email; $("authPassword").value=password;
      return $("signInPassword").onclick();
    },
    migrate: migrateLegacyAuthStorage, storedSession: readStoredSession,
    authStore: authStorage, authPresent: authStoragePresent,
    authKeys() { return { current: AUTH_STORAGE_KEY, legacy: LEGACY_SUPABASE_AUTH_KEY }; },
    user() { return currentUser?.id || null; },
    password(value='Regression-only-password-123!') {
      $("newPassword").value=value; $("confirmPassword").value=value;
      return $("savePassword").onclick();
    },
    recover(options) { return typeof recoverBackend === 'function' ? recoverBackend(options) : loadCloudStories(); },
    backend() { return typeof backendState === 'undefined' ? 'unknown' : backendState; },
    canWrite(id=null) { return typeof canWriteCloud === 'function' ? canWriteCloud(id) : !!currentUser; },
    setUser(id) { currentUser=id?{id}:null; },
    logoutPending() { explicitSignOut=true; },
    state() { return {id:activeStoryId, records:storyRecords, progress, stories}; },
    reset() { $("reset").onclick(); },
    async import(payload, mode='merge') {
      importMode=mode;
      await $("file").onchange({target:{files:[{text:async()=>JSON.stringify(payload)}],value:'file'}});
    },
    setup() { supabaseClient=mockClient; currentUser=fixtureUserId?{id:fixtureUserId}:null; stories=fixtureStories; }
  })`, context);
  app.setup();
  const seed = (id, items) => storage.set('bg3-gear-story-progress-v7:' + id,
    JSON.stringify({ format: 'bg3-story-progress', formatVersion: 1, storyId: id, items }));
  const cached = id => JSON.parse(storage.get('bg3-gear-story-progress-v7:' + id)).items;
  const seedCloudStories = (owner, values = ownedStories(owner), cacheOwner = owner) => {
    const snapshot = { userId: cacheOwner, stories: clone(values), verifiedAt: '2026-09-29T11:00:00.000Z' };
    storage.set('bg3-gear-cloud-stories-v7:' + owner, JSON.stringify(snapshot));
    return snapshot;
  };
  return {
    app, reads, writes, authReads, authWrites, bootReads, authCallbacks, storyReads, storyWrites, calls, renders, errors,
    signOuts, signIns, adoptedSessions, storageCalls, alerts, clientOptions,
    failStorage(method, key, error = new Error('Mock storage unavailable')) { storageFaults.set(faultKey(method, key), error); },
    clearStorageFaults() { storageFaults.clear(); },
    emitAuth: (event, owner) => activeAuthCallbacks.forEach(callback => callback(event, owner ? { user: { id: owner } } : null)),
    seed, cached, seedCloudStories, storage, context, element,
    readyBackend: values => ready({ app, authReads, storyReads, context }, values || ownedStories(userId)),
    state: () => clone(app.state()), status: () => element('cloudStatus').innerHTML,
    trigger: name => (events.get(name) || []).forEach(callback => callback()),
    manualSync: () => element('syncNow').onclick(),
    clock: value => { clock = Date.parse(value); },
    timerCount: () => timers.size,
    runTimers: () => {
      const due = [...timers.entries()].filter(([, timer]) => timer.delay <= 500);
      for (const [id, timer] of due) { timers.delete(id); timer.callback(); }
    },
    advance(milliseconds) {
      clock += milliseconds;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= clock);
      for (const [id, timer] of due) { timers.delete(id); timer.callback(); }
    }
  };
}

async function ready(h, values = ownedStories()) {
  // Baseline Phase A has no backend gate. After Phase B, earn ready state through
  // real recovery and mocked verified responses; never assign backendState directly.
  if (vm.runInContext('typeof recoverBackend', h.context) === 'undefined') return;
  const authIndex = h.authReads.length, storyIndex = h.storyReads.length;
  const running = h.app.recover({ flush: false });
  assert.equal(h.authReads.length, authIndex + 1);
  h.authReads[authIndex].resolve({ data: { user: { id: values[0]?.user_id || 'user-a' } }, error: null });
  await tick();
  assert.equal(h.storyReads.length, storyIndex + 1);
  h.storyReads[storyIndex].resolve({ data: clone(values), error: null });
  await running;
  assert.equal(h.app.backend(), 'ready', 'Phase A tests must establish verified backend readiness');
}

async function setup(items = { item: record() }) {
  const h = harness();
  h.seed('A', items);
  h.seed('B', { 'b-only': record('skipped') });
  await h.app.activate('A', { sync: false });
  await ready(h);
  return h;
}

module.exports = { harness, setup, ready, clone, tick, record, row, ownedStories };
