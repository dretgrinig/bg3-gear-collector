/* Opt-in revision protocol state. No network, auth, or legacy transport here. */
(function (root) {
  "use strict";
  const MAX_REVISION = 9223372036854775807n;
  const statuses = new Set(["found", "todo", "skipped"]);
  const object = value => !!value && typeof value === "object" && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const map = () => Object.create(null);
  const dictionary = value => Object.assign(map(), copy(value));
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const uuidShape = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const timestamp = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  const itemKey = value => typeof value === "string" && value.length > 0 && [...value].length <= 512 && value.trim() === value && value.toLowerCase() === value;
  function requireValue(condition, message) { if (!condition) throw new Error(message); }
  function validRevision(value) {
    return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 19 && BigInt(value) <= MAX_REVISION;
  }
  function stable(value) {
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    if (object(value)) return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
    return JSON.stringify(value);
  }
  function freeze(value) {
    if (object(value) || Array.isArray(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function validRecord(value) {
    return object(value) && statuses.has(value.status) && timestamp(value.client_updated_at);
  }
  function validateSnapshot(data, storyId) {
    requireValue(object(data) && data.story_id === storyId && validRevision(data.revision) && typeof data.protocol_enforced === "boolean" && Array.isArray(data.records), "Malformed coherent progress snapshot");
    const keys = new Set();
    for (const row of data.records) {
      requireValue(object(row) && itemKey(row.item_key) && validRecord(row) && timestamp(row.updated_at) && !keys.has(row.item_key), "Malformed coherent progress row");
      keys.add(row.item_key);
    }
    return copy(data);
  }
  function validateOperation(op) {
    requireValue(object(op) && typeof op.storyId === "string" && op.storyId && validRevision(op.expectedRevision) && uuidShape(op.operationId) && Array.isArray(op.changes) && op.changes.length >= 1 && op.changes.length <= 5000, "Malformed immutable progress operation");
    requireValue(Object.keys(op).every(key => ["storyId", "expectedRevision", "operationId", "changes"].includes(key)), "Unexpected operation fields");
    const keys = new Set();
    for (const row of op.changes) {
      requireValue(object(row) && itemKey(row.item_key) && validRecord(row) && Object.keys(row).length === 3 && Object.keys(row).every(key => ["item_key", "status", "client_updated_at"].includes(key)) && !keys.has(row.item_key), "Malformed mutation row");
      keys.add(row.item_key);
    }
    const encoded = encodeURIComponent(JSON.stringify(op.changes));
    requireValue(encoded.replace(/%[0-9A-F]{2}/g, "x").length + op.changes.length * 12 <= 1048576, "Progress operation exceeds protocol bounds");
    return op;
  }
  function validateResult(data, op) {
    validateOperation(op);
    requireValue(object(data) && data.story_id === op.storyId && validRevision(data.revision), "Malformed progress mutation response");
    if (data.outcome === "applied") {
      requireValue(data.operation_id === op.operationId && BigInt(data.revision) === BigInt(op.expectedRevision) + 1n, "Malformed progress acknowledgement");
    } else requireValue(data.outcome === "conflict" && data.revision !== op.expectedRevision, "Unknown or impossible progress mutation outcome");
    return copy(data);
  }

  function create({ scope, clientId = "default", read, write, uuid, records, legacyRecords, coordinate, onPersistence } = {}) {
    requireValue(object(scope) && ["backend", "userId", "storyId"].every(key => typeof scope[key] === "string" && scope[key]) && typeof clientId === "string" && clientId && typeof read === "function" && typeof write === "function" && typeof uuid === "function", "Progress scope and storage adapters required");
    scope = freeze(copy(scope));
    const prefix = "bg3-versioned-v1:" + encodeURIComponent(JSON.stringify([scope.backend, scope.userId, scope.storyId]));
    const keys = Object.freeze({ checkpoint: prefix + ":client:" + encodeURIComponent(clientId), operation: id => prefix + ":operation:" + id });
    let snapshot = null, edits = map(), alternatives = map(), acceptedDisplay = map(), pending = null, lastAck = null, resolution = null, ambiguous = false;
    let settledTokens = new Set(), legacySeen = map();
    let verified = false, durable = true, hardIssue = "", softIssue = "", coordinationIssue = "", conflict = false;
    let persistenceTail = Promise.resolve(), persistenceVersion = 0, savedVersion = 0, pendingPersistence = 0, pendingSave = null, persistenceIssue = "";
    function newToken() { const value = uuid(); requireValue(uuidShape(value), "UUID generator unavailable"); return value; }
    function recordView() {
      const result = map();
      if (snapshot) for (const row of snapshot.records) result[row.item_key] = { status: row.status, client_updated_at: row.client_updated_at, dirty: false };
      for (const [key, value] of Object.entries(acceptedDisplay)) result[key] = { ...value, dirty: false };
      for (const [key, value] of Object.entries(edits)) result[key] = { ...value.record, dirty: true, versioned_edit_token: value.token };
      return result;
    }
    function validEdit(value) {
      return object(value) && uuidShape(value.token) && validRecord(value.record) && value.record.dirty === true && typeof value.review === "boolean" && (value.baseRevision === null || validRevision(value.baseRevision)) && (value.dependsOn === null || uuidShape(value.dependsOn)) && (value.awaitingRevision === null || validRevision(value.awaitingRevision));
    }
    function itemEdits(key) { return [...(own(edits, key) ? [edits[key]] : []), ...(alternatives[key] || [])]; }
    function allEdits() { return Object.keys(edits).flatMap(itemEdits); }
    function pruneSettled() {
      for (const key of new Set([...Object.keys(edits), ...Object.keys(alternatives)])) {
        const remaining = itemEdits(key).filter(value => !settledTokens.has(value.token));
        const promoted = remaining.length && remaining[0].token !== edits[key]?.token;
        if (remaining.length) {
          edits[key] = remaining[0];
          if (promoted || remaining.length > 1) remaining.forEach(value => { value.review = true; });
        } else delete edits[key];
        if (remaining.length > 1) alternatives[key] = remaining.slice(1);
        else delete alternatives[key];
      }
    }
    function retainStoredEdit(key, storedEdit) {
      if (settledTokens.has(storedEdit.token)) return;
      const existing = itemEdits(key).find(value => value.token === storedEdit.token);
      if (existing) {
        if (stable(existing.record) !== stable(storedEdit.record)) hardIssue = "Stored edit token changed payload";
        return;
      }
      if (!own(edits, key)) {
        edits[key] = copy(storedEdit);
        if (verified && !pending && (storedEdit.baseRevision !== snapshot?.revision || storedEdit.dependsOn || storedEdit.awaitingRevision)) {
          edits[key].review = true; edits[key].baseRevision = null; edits[key].dependsOn = null; edits[key].awaitingRevision = null;
        }
      } else {
        // Acquiring the lock observes another intent; it does not supersede it.
        (alternatives[key] ||= []).push(copy(storedEdit));
        itemEdits(key).forEach(value => { value.review = true; });
      }
    }
    function validCheckpoint(value) {
      try {
        if (!object(value) || value.format !== "bg3-versioned-checkpoint" || value.formatVersion !== 1 || stable(value.scope) !== stable(scope) || value.clientId !== clientId || !object(value.edits) || !object(value.acceptedDisplay)) return false;
        if (value.snapshot !== null) validateSnapshot(value.snapshot, scope.storyId);
        if (!Object.entries(value.edits).every(([key, value]) => itemKey(key) && validEdit(value))) return false;
        if (own(value, "alternatives")) {
          if (!object(value.alternatives)) return false;
          for (const [key, entries] of Object.entries(value.alternatives)) {
            if (!itemKey(key) || !own(value.edits, key) || !Array.isArray(entries) || !entries.length || !entries.every(validEdit)) return false;
            const tokens = [value.edits[key].token, ...entries.map(edit => edit.token)];
            if (new Set(tokens).size !== tokens.length) return false;
          }
        }
        if (!Object.entries(value.acceptedDisplay).every(([key, value]) => itemKey(key) && validRecord(value))) return false;
        if (value.head !== null && (!object(value.head) || !uuidShape(value.head.operationId) || typeof value.head.fingerprint !== "string")) return false;
        if (value.lastAck !== null && (!object(value.lastAck) || !uuidShape(value.lastAck.operationId) || !validRevision(value.lastAck.revision))) return false;
        if (value.resolution !== null && (!object(value.resolution) || !uuidShape(value.resolution.operationId) || typeof value.resolution.fingerprint !== "string" || !["applied", "conflict", "rejected"].includes(value.resolution.outcome) || !object(value.resolution.tokens) || !Object.entries(value.resolution.tokens).every(([key, token]) => itemKey(key) && uuidShape(token)))) return false;
        return typeof value.conflict === "boolean" && typeof value.ambiguous === "boolean" && Array.isArray(value.settledTokens) && value.settledTokens.every(uuidShape) && object(value.legacySeen) && Object.entries(value.legacySeen).every(([key, value]) => itemKey(key) && typeof value === "string");
      } catch (_) { return false; }
    }
    function validJournal(value) {
      try {
        if (!object(value) || value.format !== "bg3-versioned-operation" || value.formatVersion !== 1 || stable(value.scope) !== stable(scope) || value.clientId !== clientId || !object(value.tokens)) return false;
        validateOperation(value.operation);
        return value.operation.storyId === scope.storyId && value.fingerprint === stable(value.operation) && Object.keys(value.tokens).length === value.operation.changes.length && value.operation.changes.every(row => uuidShape(value.tokens[row.item_key]));
      } catch (_) { return false; }
    }
    function get(key, validate) {
      let result;
      try { result = read(key, validate); } catch (error) { result = { state: "inaccessible", error }; }
      if (!object(result) || !["ok", "missing", "corrupt", "inaccessible"].includes(result.state)) result = { state: "inaccessible" };
      if (result.state === "ok" && !validate(result.value)) result = { state: "corrupt" };
      if (result.state === "corrupt") hardIssue = "Corrupt progress storage; preserved for export and review";
      if (result.state === "inaccessible") durable = false;
      return result;
    }
    function put(key, value) {
      try { return write(key, copy(value))?.state === "ok"; } catch (_) { return false; }
    }
    function envelope() {
      return { format: "bg3-versioned-checkpoint", formatVersion: 1, scope, clientId, snapshot, edits, alternatives, acceptedDisplay, head: pending ? { operationId: pending.operation.operationId, fingerprint: pending.fingerprint } : null, lastAck, resolution, ambiguous, conflict, settledTokens: [...settledTokens], legacySeen };
    }
    function journalFor(head) {
      const result = get(keys.operation(head.operationId), validJournal);
      if (result.state !== "ok" || result.value.operation.operationId !== head.operationId || result.value.fingerprint !== head.fingerprint) {
        if (result.state !== "inaccessible") hardIssue = "Missing or mismatched immutable operation journal";
        return null;
      }
      return freeze(copy(result.value));
    }
    function importRecord(key, record, source = "stored") {
      if (!itemKey(key) || !validRecord(record)) { hardIssue = "Invalid stored progress shape"; return; }
      if (settledTokens.has(record.versioned_edit_token)) return;
      const current = recordView()[key], edit = edits[key];
      if (edit && record.versioned_edit_token === edit.token) {
        if (record.status !== edit.record.status || record.client_updated_at !== edit.record.client_updated_at) hardIssue = "Stored edit token changed payload";
        return;
      }
      if (resolution?.outcome === "applied" && resolution.tokens[key] === record.versioned_edit_token) return;
      const cloud = snapshot?.records.find(row => row.item_key === key);
      if (!record.dirty && cloud?.status === record.status && cloud.client_updated_at === record.client_updated_at) return;
      if (current && current.status === record.status && current.client_updated_at === record.client_updated_at) return;
      if (edit) {
        // A timestamp cannot supersede an unacknowledged immutable token.
        if (record.dirty && record.status !== edit.record.status) {
          edit.review = true; edit.baseRevision = null; edit.dependsOn = null; edit.awaitingRevision = null;
        }
        return;
      }
      edits[key] = { token: newToken(), record: { status: record.status, client_updated_at: record.client_updated_at, dirty: true }, baseRevision: null, dependsOn: null, awaitingRevision: null, review: true, source };
    }
    function mergeStored(value) {
      coordinationIssue = "";
      if (value.head && (!pending || value.head.operationId !== pending.operation.operationId || value.head.fingerprint !== pending.fingerprint)) {
        if (resolution?.operationId !== value.head.operationId || resolution.fingerprint !== value.head.fingerprint) {
          if (pending) coordinationIssue = "Another unresolved operation head requires review or reload";
          else {
            pending = journalFor(value.head); ambiguous = true;
          }
        }
      }
      for (const token of value.settledTokens) settledTokens.add(token);
      pruneSettled();
      for (const [key, fingerprint] of Object.entries(value.legacySeen)) if (!own(legacySeen, key)) legacySeen[key] = fingerprint;
      for (const [key, storedEdit] of Object.entries(value.edits)) {
        retainStoredEdit(key, storedEdit);
      }
      for (const [key, entries] of Object.entries(value.alternatives || {})) entries.forEach(edit => retainStoredEdit(key, edit));
      // Cached acknowledgements older than a coherent snapshot are not new intent.
      if (!snapshot || !value.lastAck || BigInt(snapshot.revision) < BigInt(value.lastAck.revision)) {
        for (const [key, record] of Object.entries(value.acceptedDisplay)) importRecord(key, record);
      }
    }
    function persistLocked() {
      if (hardIssue) return false;
      coordinationIssue = "";
      const stored = get(keys.checkpoint, validCheckpoint);
      if (stored.state === "ok") mergeStored(stored.value);
      if (["corrupt", "inaccessible"].includes(stored.state) || hardIssue || coordinationIssue) return false;
      return put(keys.checkpoint, envelope());
    }
    function persistenceWork(work) {
      // A standalone synchronous adapter has one owner. Browser adapters must
      // supply cross-tab coordination, or explicitly disable persistence.
      if (coordinate === undefined) {
        const result = work(); durable = result.durable; return result.value;
      }
      durable = false;
      if (typeof coordinate !== "function") { persistenceIssue = "Checkpoint coordination unavailable; edits remain memory-only"; return null; }
      pendingPersistence++;
      const job = persistenceTail.then(() => coordinate(() => {
        persistenceIssue = "";
        // Build the envelope from current memory only after acquiring the lock.
        const version = persistenceVersion;
        return { ...work(), version };
      })).then(result => {
        requireValue(object(result) && typeof result.durable === "boolean", "Checkpoint coordinator did not complete");
        return result;
      }).catch(() => {
        persistenceIssue = "Checkpoint coordination failed; edits remain memory-only";
        return { value: null, durable: false };
      }).then(result => {
        pendingPersistence--;
        if (result.durable) savedVersion = result.version;
        durable = result.durable && !pendingPersistence && result.version === persistenceVersion;
        return result.value;
      }).then(value => {
        try { onPersistence?.(); } catch (_) { /* Rendering cannot undo persistence. */ }
        return value;
      });
      persistenceTail = job;
      return job;
    }
    function persist() {
      persistenceVersion++; durable = false;
      if (coordinate === undefined) return persistenceWork(() => { const saved = persistLocked(); return { value: saved, durable: saved }; });
      if (pendingSave) return false;
      queueSave(); return false;
    }
    function queueSave() {
      const job = persistenceWork(() => { const saved = persistLocked(); return { value: saved, durable: saved }; });
      if (!job) return;
      pendingSave = job.then(saved => {
        pendingSave = null;
        // Only new intent arriving during a successful save needs another pass.
        // A failed save stops here; later explicit work may attempt persistence.
        if (saved && savedVersion !== persistenceVersion) queueSave();
        return saved;
      });
    }
    function flushPersistence() {
      const tail = persistenceTail;
      return tail.then(() => pendingSave).then(() => tail === persistenceTail ? durable : flushPersistence());
    }
    const stored = get(keys.checkpoint, validCheckpoint);
    if (stored.state === "ok") {
      snapshot = copy(stored.value.snapshot); edits = dictionary(stored.value.edits); alternatives = dictionary(stored.value.alternatives || {}); acceptedDisplay = dictionary(stored.value.acceptedDisplay);
      lastAck = copy(stored.value.lastAck); resolution = copy(stored.value.resolution); conflict = stored.value.conflict;
      settledTokens = new Set(stored.value.settledTokens); legacySeen = dictionary(stored.value.legacySeen);
      pruneSettled();
      if (stored.value.head) { pending = journalFor(stored.value.head); ambiguous = true; }
    }
    const initial = legacyRecords || records;
    if (initial !== undefined) {
      if (!object(initial)) hardIssue = "Invalid legacy progress shape";
      else for (const [key, record] of Object.entries(initial)) {
        if (!itemKey(key) || !validRecord(record) || typeof record.dirty !== "boolean") { hardIssue = "Invalid legacy progress shape"; continue; }
        if (record.dirty) observeLegacy(key, record);
        else if (!snapshot && !edits[key]) acceptedDisplay[key] = { status: record.status, client_updated_at: record.client_updated_at, dirty: false };
      }
    }
    function reviewKeys() { return Object.keys(edits).filter(key => edits[key].review || alternatives[key]?.length); }
    function needsSnapshot() { return !!lastAck && (!verified || !snapshot || BigInt(snapshot.revision) < BigInt(lastAck.revision)); }
    function mode() {
      if (hardIssue || coordinationIssue) return "blocked";
      if (softIssue === "readonly") return "readonly";
      if (!verified || !snapshot) return "unknown";
      if (!snapshot.protocol_enforced || softIssue === "readonly") return "readonly";
      if (softIssue || !durable) return "blocked";
      if (pending) return "pending";
      if (reviewKeys().length) return conflict ? "conflict" : "review";
      if (needsSnapshot()) return "unknown";
      return "ready";
    }
    function writeAllowed() {
      return !!(verified && snapshot?.protocol_enforced && !hardIssue && !coordinationIssue && !softIssue && (pending || (!reviewKeys().length && !needsSnapshot())));
    }
    function canWrite() { return durable && writeAllowed(); }
    function acceptSnapshot(data) {
      let next;
      try { next = validateSnapshot(data, scope.storyId); } catch (error) { softIssue = error.message; verified = false; throw error; }
      if (snapshot && BigInt(next.revision) < BigInt(snapshot.revision) || lastAck && BigInt(next.revision) < BigInt(lastAck.revision)) { softIssue = "Progress revision moved backwards"; verified = false; throw new Error(softIssue); }
      if (snapshot?.protocol_enforced && next.protocol_enforced && snapshot.revision === next.revision && stable([...snapshot.records].sort((a,b)=>a.item_key.localeCompare(b.item_key))) !== stable([...next.records].sort((a,b)=>a.item_key.localeCompare(b.item_key)))) {
        softIssue = "Progress changed without advancing its server revision"; verified = false; throw new Error(softIssue);
      }
      snapshot = next; verified = true; softIssue = "";
      acceptedDisplay = map();
      if (!pending) for (const edit of allEdits()) {
        if (edit.awaitingRevision && edit.awaitingRevision === next.revision && lastAck?.revision === next.revision && !edit.review) {
          edit.baseRevision = next.revision; edit.dependsOn = null; edit.awaitingRevision = null;
        } else if (edit.baseRevision !== next.revision || edit.awaitingRevision) {
          edit.review = true; edit.baseRevision = null; edit.dependsOn = null; edit.awaitingRevision = null;
        }
      }
      persist();
      return { accepted: true, cacheDurable: durable, mode: mode() };
    }
    function edit(key, record) {
      requireValue(itemKey(key) && validRecord(record), "Invalid local checkbox intent");
      const previous = edits[key], dependency = pending?.operation.operationId || (needsSnapshot() ? lastAck.operationId : null);
      if (previous) settledTokens.add(previous.token);
      const reviewed = !!previous?.review || !verified || !snapshot || (!dependency && !snapshot.protocol_enforced);
      edits[key] = { token: newToken(), record: { status: record.status, client_updated_at: record.client_updated_at, dirty: true }, baseRevision: reviewed || dependency ? null : snapshot.revision, dependsOn: dependency, awaitingRevision: dependency && !pending ? lastAck.revision : null, review: reviewed, source: "local" };
      persist();
      return copy(recordView()[key]);
    }
    function observeLegacy(key, record) {
      const fingerprint = stable({ status: record.status, client_updated_at: record.client_updated_at, dirty: record.dirty });
      if (legacySeen[key] === fingerprint) return;
      legacySeen[key] = fingerprint;
      importRecord(key, record, "legacy");
    }
    function refresh() {
      const stored = get(keys.checkpoint, validCheckpoint);
      if (stored.state === "ok") mergeStored(stored.value);
      return inspect();
    }
    function observeRecords(values) {
      requireValue(object(values), "Invalid stored progress map");
      for (const [key, value] of Object.entries(values)) observeLegacy(key, value);
      persist();
      return recordView();
    }
    function checkOperation(op) {
      try {
        validateOperation(op);
        requireValue(pending && pending.fingerprint === stable(op), "Operation payload changed after journaling");
        const journal = journalFor({ operationId: op.operationId, fingerprint: pending.fingerprint });
        requireValue(journal && stable(journal.operation) === stable(op), "Immutable journal does not match request");
        return true;
      } catch (error) { softIssue = error.message; return false; }
    }
    function markDispatched(op) {
      return persistenceWork(() => {
        if (!persistLocked() || !checkOperation(op)) return { value: null, durable: false };
        const wasAmbiguous = ambiguous;
        // Persist uncertainty under the same lock as the head before sending.
        ambiguous = true;
        const saved = persistLocked();
        return { value: saved ? { wasAmbiguous } : null, durable: saved };
      });
    }
    function prepareOperation() {
      return persistenceWork(prepareOperationLocked);
    }
    function prepareOperationLocked() {
      const saved = persistLocked();
      const finish = (value = null, durable = saved) => ({ value, durable });
      if (!saved || !writeAllowed()) return finish();
      if (!pending) {
        const intent = Object.entries(edits);
        if (!intent.length) return finish();
        if (intent.some(([, value]) => value.review || value.baseRevision !== snapshot.revision || value.dependsOn || value.awaitingRevision)) return finish();
        if (BigInt(snapshot.revision) === MAX_REVISION) { softIssue = "Progress revision exhausted"; return finish(); }
        const operation = { storyId: scope.storyId, expectedRevision: snapshot.revision, operationId: newToken(), changes: intent.map(([item_key, value]) => ({ item_key, status: value.record.status, client_updated_at: value.record.client_updated_at })) };
        try { validateOperation(operation); } catch (error) { softIssue = error.message; return finish(); }
        const journal = { format: "bg3-versioned-operation", formatVersion: 1, scope, clientId, operation, fingerprint: stable(operation), tokens: Object.fromEntries(intent.map(([key, value]) => [key, value.token])) };
        const existing = get(keys.operation(operation.operationId), validJournal);
        if (existing.state !== "missing" || !put(keys.operation(operation.operationId), journal)) { softIssue = "Immutable operation could not be saved; edits remain memory-only"; return finish(null, false); }
        pending = freeze(copy(journal));
        ambiguous = false;
        if (!persistLocked()) return finish(null, false);
      }
      const head = get(keys.checkpoint, validCheckpoint);
      if (head.state !== "ok" || head.value.head?.operationId !== pending.operation.operationId || head.value.head?.fingerprint !== pending.fingerprint) { coordinationIssue = "Operation head changed before dispatch"; return finish(null, false); }
      if (!checkOperation(pending.operation)) return finish(null, false);
      return finish(freeze(copy(pending.operation)), true);
    }
    function acceptResult(data, op) {
      let result;
      // Storage may become inaccessible after dispatch. Validate against the
      // already frozen in-memory request; cache failures cannot undo cloud success.
      try {
        validateOperation(op);
        requireValue(pending && pending.fingerprint === stable(op), "Acknowledgement does not match pending operation");
        result = validateResult(data, op);
      } catch (error) { softIssue = error.message; throw error; }
      const completed = pending;
      resolution = { operationId: op.operationId, fingerprint: completed.fingerprint, outcome: result.outcome, tokens: copy(completed.tokens) };
      ambiguous = false;
      if (result.outcome === "conflict") {
        pending = null; conflict = true;
        for (const value of allEdits()) { value.review = true; value.baseRevision = null; value.dependsOn = null; value.awaitingRevision = null; }
        const persisted = persist();
        return { accepted: true, applied: false, conflict: true, needsSnapshot: true, cacheDurable: persisted };
      }
      // A receipt is only an acknowledgement. It cannot replace a newer snapshot.
      pending = null; lastAck = { operationId: op.operationId, revision: result.revision }; conflict = false;
      const currentSnapshotIncludesAck = verified && snapshot && BigInt(snapshot.revision) >= BigInt(result.revision);
      for (const row of completed.operation.changes) settledTokens.add(completed.tokens[row.item_key]);
      pruneSettled();
      for (const row of completed.operation.changes) {
        if (!own(edits, row.item_key) && !currentSnapshotIncludesAck) acceptedDisplay[row.item_key] = { status: row.status, client_updated_at: row.client_updated_at, dirty: false };
      }
      for (const value of allEdits()) {
        if (value.dependsOn === op.operationId) {
          value.dependsOn = null;
          if (verified && snapshot?.revision === result.revision && !value.review) { value.baseRevision = result.revision; value.awaitingRevision = null; }
          else if (currentSnapshotIncludesAck) { value.review = true; value.baseRevision = null; value.awaitingRevision = null; }
          else { value.baseRevision = null; value.awaitingRevision = result.revision; }
        } else if (!verified || value.baseRevision !== snapshot?.revision || value.awaitingRevision || value.dependsOn) {
          // Adopting an older head must not strand independent stale-base intent
          // without a visible review path, or silently attach it to a newer base.
          value.review = true; value.baseRevision = null; value.dependsOn = null; value.awaitingRevision = null;
        }
      }
      const persisted = persist();
      return { accepted: true, applied: true, conflict: false, needsSnapshot: needsSnapshot(), cacheDurable: persisted };
    }
    function captureReview(keys = reviewKeys()) {
      return freeze(copy({ scope, clientId, revision: snapshot?.revision || null, candidates: Object.fromEntries(keys.map(key => [key, itemEdits(key).map(value => value.token).sort()])) }));
    }
    function review(selectedKeys, choice, selectedTokens = map(), displayed) {
      requireValue(Array.isArray(selectedKeys) && ["local", "cloud"].includes(choice) && verified && snapshot, "A current snapshot and explicit review choice are required");
      requireValue(!pending && !hardIssue && !coordinationIssue, "Resolve the immutable pending operation before review");
      requireValue(!needsSnapshot(), "A fresh snapshot after the acknowledgement is required for review");
      requireValue(object(selectedTokens), "Review token selections required");
      // UI callers pass the immutable rendered boundary. Synchronous callers
      // without a displayed form explicitly observe their selected items now.
      if (displayed === undefined) displayed = captureReview(selectedKeys);
      const stale = () => { const error = new Error("Displayed review changed; review the current candidates again"); error.code = "BG3_REVIEW_STALE"; throw error; };
      if (!object(displayed) || stable(displayed.scope) !== stable(scope) || displayed.clientId !== clientId || displayed.revision !== snapshot.revision || !object(displayed.candidates)) stale();
      const keys = [...new Set(selectedKeys)];
      for (const key of keys) {
        const shown = own(displayed.candidates, key) ? displayed.candidates[key] : null;
        if (!own(edits, key) || !Array.isArray(shown) || !shown.length || !shown.every(uuidShape) || new Set(shown).size !== shown.length || stable([...shown].sort()) !== stable(itemEdits(key).map(value => value.token).sort())) stale();
      }
      if (!keys.length) return recordView();
      const choices = keys.map(key => {
        const candidates = itemEdits(key), token = own(selectedTokens, key) ? selectedTokens[key] : undefined;
        const selected = token === undefined ? edits[key] : candidates.find(value => value.token === token);
        const divergent = candidates.some(value => stable(value.record) !== stable(edits[key].record));
        requireValue(choice === "cloud" || selected && (!divergent || token !== undefined), "Choose an exact competing edit token for review");
        return { key, candidates, selected, reviewedToken: choice === "local" ? newToken() : null };
      });
      for (const { key, candidates, selected, reviewedToken } of choices) {
        // Only the alternatives observed by this explicit choice are retired.
        candidates.forEach(value => settledTokens.add(value.token));
        delete alternatives[key];
        if (choice === "cloud") delete edits[key];
        else edits[key] = { ...selected, token: reviewedToken, baseRevision: snapshot.revision, dependsOn: null, awaitingRevision: null, review: false, source: "reviewed" };
      }
      if (!reviewKeys().length) conflict = false;
      persist();
      return recordView();
    }
    function block(reason = "Progress verification required") {
      softIssue = /55000|read.?only|not enforced|protocol-disabled/i.test(String(reason)) ? "readonly" : String(reason);
      verified = false;
      if (pending) { ambiguous = true; persist(); }
      return mode();
    }
    function rejectOperation(code, op, { wasAmbiguous = ambiguous } = {}) {
      requireValue(["22023", "55000"].includes(String(code)) && pending && pending.fingerprint === stable(op), "A definite rejection must match the pending operation");
      // A disabled protocol cannot look up receipts: a previous ambiguous send
      // may already have committed, so retain its exact request until resume.
      if (String(code) === "55000" && wasAmbiguous) { softIssue = "readonly"; verified = false; return { retained: true, cacheDurable: persist() }; }
      resolution = { operationId: op.operationId, fingerprint: pending.fingerprint, outcome: "rejected", tokens: copy(pending.tokens) };
      pending = null; ambiguous = false; conflict = String(code) === "22023";
      for (const value of allEdits()) { value.review = true; value.baseRevision = null; value.dependsOn = null; value.awaitingRevision = null; }
      softIssue = String(code) === "55000" ? "readonly" : "Rejected operation requires explicit review";
      verified = false;
      return { retained: false, cacheDurable: persist() };
    }
    function inspect() {
      return copy({ mode: mode(), snapshot, baseRevision: snapshot?.revision || null, pending: pending?.operation || null, edits, alternatives, reviewKeys: reviewKeys(), durable, reason: hardIssue || coordinationIssue || softIssue || persistenceIssue || (!durable ? "Edits remain memory-only; storage is not durable" : reviewKeys().length ? "Local intent requires explicit review against the cloud revision" : ""), needsSnapshot: needsSnapshot(), protocolEnforced: verified && snapshot?.protocol_enforced === true, ambiguous });
    }
    return Object.freeze({ get mode() { return mode(); }, get snapshot() { return copy(snapshot); }, keys, viewRecords: () => copy(recordView()), inspect, edit, observeRecords, acceptSnapshot, prepareOperation, acceptResult, captureReview, review, block, rejectOperation, canWrite, checkOperation, markDispatched, refresh, flushPersistence });
  }
  root.BG3VersionedProgress = Object.freeze({ create, validRevision, validateSnapshot, validateResult });
})(typeof window === "object" ? window : globalThis);
