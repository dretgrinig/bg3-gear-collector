/* Acquisition enrichment schemas 1 and 2. Deterministic validation and identity resolution. */
'use strict';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const ACTS = new Set(['ACT 1', 'ACT 2', 'ACT 3']);
const ROUTE_TYPES = new Set(['purchase', 'drop', 'actor_loot', 'quest_reward', 'gift', 'craft', 'combine', 'container', 'world', 'ability', 'steal', 'disarm']);
const CONDITION_KINDS = new Set(['item', 'ability', 'level', 'quest', 'npc', 'class', 'check', 'interaction', 'choice', 'faith']);
const SUBJECTS = new Set(['actor', 'container', 'entrance', 'item', 'interaction', 'crafting_station']);
const SUBJECTS_V2 = new Set([...SUBJECTS, 'corpse', 'encounter', 'former_container', 'component', 'location']);
const COORDINATE_STATES = new Set(['exact', 'reference', 'pending', 'conflict', 'not_documented', 'not_applicable']);
const EMPTY = Object.freeze([]);
// Exact reviewed legacy catalogue sources. This is lookup compatibility only;
// the strict Wiki/evidence URL parser and dataset schema remain unchanged.
const REVIEWED_SOURCE_ALIASES = Object.freeze([
  Object.freeze({ act: 'ACT 3', progressKey: 'act 3|shapeshifter hat', source: 'https://baldursgate3.wiki.fextralife.com/Shapeshifter+Hat', page: 'Shapeshifter_Hat' }),
  Object.freeze({ act: 'ACT 3', progressKey: 'act 3|burnished ring', source: 'https://baldursgate3.wiki.fextralife.com/Burnished+Ring', page: 'Burnished_Ring' })
]);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const token = value => nonempty(value) && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
function standardPrototype(value, array) {
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype === null) return true;
  if (prototype === (array ? Array.prototype : Object.prototype)) return true;
  // Accept native JSON containers from another realm, not custom prototypes.
  if (!prototype || (array ? !Array.isArray(prototype) : Object.getPrototypeOf(prototype) !== null)) return false;
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
  const intrinsic = constructor && own(constructor, 'value') && typeof constructor.value === 'function'
    ? Object.getOwnPropertyDescriptor(constructor.value, 'prototype') : null;
  const name = intrinsic ? Object.getOwnPropertyDescriptor(constructor.value, 'name') : null;
  return !!intrinsic && own(intrinsic, 'value') && intrinsic.value === prototype && !!constructor && own(constructor, 'value') && typeof constructor.value === 'function' &&
    !!name && own(name, 'value') && name.value === (array ? 'Array' : 'Object') && /\[native code\]/.test(Function.prototype.toString.call(constructor.value));
}
function arrayKeysValid(value) {
  return !Object.getOwnPropertySymbols(value).length && Object.getOwnPropertyNames(value).every(key =>
    key === 'length' || (/^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length));
}
const plainText = value => nonempty(value) && !/<\/?[a-z][^>]*>|<!--/i.test(value) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) freeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

// Copy data properties only: no getters, prototypes, sparse arrays or cycles.
// Freeze the copy later, never the caller's metadata or catalogue objects.
function copyJSON(value, path, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || value === null) throw { path, code: 'json', message: 'Expected finite JSON data.' };
  if (ancestors.has(value)) throw { path, code: 'cycle', message: 'Cyclic data is not supported.' };
  const array = Array.isArray(value);
  if (!standardPrototype(value, array)) throw { path, code: 'prototype', message: 'Expected a plain data object.' };
  if (Object.getOwnPropertySymbols(value).length) throw { path, code: 'json', message: 'Symbol keys are not JSON data.' };
  ancestors.add(value);
  const output = array ? [] : Object.create(null);
  try {
    const keys = Object.getOwnPropertyNames(value);
    if (array && !arrayKeysValid(value)) throw { path, code: 'array', message: 'Array properties are not supported.' };
    const wanted = array ? Array.from({ length: value.length }, (_, index) => String(index)) : keys;
    for (const key of wanted) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      const childPath = array ? `${path}[${key}]` : `${path}.${key}`;
      if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable) throw { path: childPath, code: 'json', message: 'Expected an own enumerable data property.' };
      output[key] = copyJSON(descriptor.value, childPath, ancestors);
    }
  } finally { ancestors.delete(value); }
  return output;
}

function pageTitle(value) {
  if (!token(value) || /[\\/?#\u0000-\u001f]|:\/\//.test(value)) return null;
  const title = value.normalize('NFC').replace(/ /g, '_');
  return title === '.' || title === '..' ? null : title;
}
function genericPage(title) {
  return /^(?:List_of_|Category:|Template:|bg3wiki:|Main_Page$|Act_(?:One|Two|Three|1|2|3)$|Prologue$)/i.test(title);
}

// Lookup normalization only; the original URL/title is retained in the copy.
function wikiIdentity(value) {
  if (!token(value)) return null;
  const authority = /^https:\/\/([^/?#]+)/i.exec(value);
  if (!authority || authority[1].toLowerCase() !== 'bg3.wiki' || value.includes('#')) return null;
  try {
    const raw = /^https:\/\/bg3\.wiki([^?#]*)(?:\?([^#]*))?$/i.exec(value);
    if (!raw || decodeURIComponent(raw[1]).split('/').some(part => part === '.' || part === '..') || raw[1].includes('\\')) return null;
    if (raw[2] !== undefined) decodeURIComponent(raw[2]); // Reject malformed encoding rather than replacement characters.
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'bg3.wiki' || url.username || url.password || url.port || url.hash) return null;
    if (url.pathname.startsWith('/wiki/') && raw[2] === undefined) {
      const page = pageTitle(decodeURIComponent(url.pathname.slice(6)));
      return page ? { page, revisionId: null } : null;
    }
    if (url.pathname !== '/w/index.php') return null;
    const keys = Array.from(url.searchParams.keys());
    if (keys.length !== 2 || !keys.includes('title') || !keys.includes('oldid')) return null;
    const page = pageTitle(url.searchParams.get('title')), revision = url.searchParams.get('oldid');
    if (!page || !/^[1-9]\d*$/.test(revision)) return null;
    const revisionId = Number(revision);
    return Number.isSafeInteger(revisionId) ? { page, revisionId } : null;
  } catch { return null; }
}

function gameIdsValid(value) {
  if (!Array.isArray(value) || !standardPrototype(value, true) || !arrayKeysValid(value)) return false;
  const seen = new Set();
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable || !token(descriptor.value) || seen.has(descriptor.value)) return false;
    seen.add(descriptor.value);
  }
  return true;
}

function validateDataset(input) {
  const issues = [];
  const issue = (path, code, message) => issues.push({ path, code, message });
  let dataset;
  try { dataset = copyJSON(input, '$', new Set()); }
  catch (error) {
    issue(typeof error.path === 'string' ? error.path : '$', typeof error.code === 'string' ? error.code : 'json', typeof error.message === 'string' ? error.message : 'Invalid JSON data.');
    return Object.freeze({ ok: false, dataset: null, issues: freeze(issues) });
  }
  function shape(value, allowed, required, path) {
    if (!record(value)) { issue(path, 'object', 'Expected a data object.'); return false; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) issue(`${path}.${key}`, 'field', 'Unsupported field.');
    for (const key of required) if (!own(value, key)) issue(`${path}.${key}`, 'required', 'Required field is missing.');
    return true;
  }
  const text = (value, path, plain = false) => {
    if (!(plain ? plainText(value) : token(value))) issue(path, 'text', 'Expected nonempty plain text.');
  };
  const enumeration = (value, allowed, path) => { if (!allowed.has(value)) issue(path, 'enum', 'Unsupported value.'); };
  const array = (value, path, min = 0) => {
    if (!Array.isArray(value) || value.length < min) { issue(path, 'array', `Expected an array with at least ${min} entries.`); return false; }
    return true;
  };
  const unique = (value, seen, path) => {
    text(value, path);
    if (seen.has(value)) issue(path, 'duplicate', 'Duplicate identity.');
    seen.add(value);
  };
  function entity(value, path) {
    if (value === null) return;
    if (!shape(value, ['name', 'wikiPage'], ['name'], path)) return;
    text(value.name, `${path}.name`, true);
    if (own(value, 'wikiPage') && !pageTitle(value.wikiPage)) issue(`${path}.wikiPage`, 'page', 'Expected a specific Wiki page title.');
  }
  function source(value, path) {
    if (!shape(value, ['url', 'revisionId', 'section'], ['url', 'section'], path)) return;
    const identity = wikiIdentity(value.url);
    if (!identity) issue(`${path}.url`, 'source', 'Expected a canonical or pinned HTTPS BG3 Wiki page URL.');
    text(value.section, `${path}.section`, true);
    if (own(value, 'revisionId')) {
      if (!Number.isSafeInteger(value.revisionId) || value.revisionId <= 0) issue(`${path}.revisionId`, 'revision', 'Expected a positive safe integer revision.');
      else if (identity && identity.revisionId !== null && identity.revisionId !== value.revisionId) issue(`${path}.revisionId`, 'revision', 'Revision must agree with the pinned URL.');
    }
  }
  function coordinates(value, path) {
    if (!shape(value, ['x', 'y', 'space', 'subject'], ['x', 'y', 'space', 'subject'], path)) return;
    for (const axis of ['x', 'y']) if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) issue(`${path}.${axis}`, 'coordinate', 'Expected a finite coordinate number.');
    text(value.space, `${path}.space`, true);
    enumeration(value.subject, dataset.schemaVersion === 2 ? SUBJECTS_V2 : SUBJECTS, `${path}.subject`);
  }
  function coordinateReview(route, path) {
    const value = route.coordinateReview, p = `${path}.coordinateReview`;
    if (!shape(value, ['state', 'reason'], ['state'], p)) return;
    enumeration(value.state, COORDINATE_STATES, `${p}.state`);
    if (own(value, 'reason')) text(value.reason, `${p}.reason`, true);
    const pointRequired = value.state === 'exact' || value.state === 'reference';
    if (pointRequired && !record(route.coordinates)) issue(`${path}.coordinates`, 'coordinate', 'Verified coordinate states require a coordinate point.');
    if (COORDINATE_STATES.has(value.state) && !pointRequired && route.coordinates !== null) issue(`${path}.coordinates`, 'coordinate', 'This coordinate state requires explicit null coordinates.');
    if (value.state === 'not_applicable' && !own(value, 'reason')) issue(`${p}.reason`, 'required', 'A coordinate exception requires a plain-text reason.');
    if ((pointRequired || value.state === 'not_applicable') && (!Array.isArray(route.sources) || !route.sources.length)) issue(`${path}.sources`, 'evidence', 'Verified points and coordinate exceptions require evidence.');
  }
  function navigationPoints(value, path) {
    if (!array(value, path, 1)) return;
    value.forEach((point, index) => {
      const p = `${path}[${index}]`;
      if (!shape(point, ['label', 'location', 'sublocation', 'coordinates', 'sources'], ['label', 'coordinates', 'sources'], p)) return;
      text(point.label, `${p}.label`, true);
      if (own(point, 'location')) {
        if (point.location === null) issue(`${p}.location`, 'object', 'Expected a navigation location object.');
        else entity(point.location, `${p}.location`);
      }
      if (own(point, 'sublocation')) text(point.sublocation, `${p}.sublocation`, true);
      coordinates(point.coordinates, `${p}.coordinates`);
      if (array(point.sources, `${p}.sources`, 1)) point.sources.forEach((value, index) => source(value, `${p}.sources[${index}]`));
    });
  }
  function conditions(value, path) {
    if (value === null) return;
    if (!shape(value, ['prerequisites', 'before', 'after', 'exclusions'], [], path)) return;
    for (const bucket of Object.keys(value)) {
      if (value[bucket] === null || !array(value[bucket], `${path}.${bucket}`)) continue;
      value[bucket].forEach((condition, index) => {
        const p = `${path}.${bucket}[${index}]`;
        if (!shape(condition, ['kind', 'subject', 'value'], ['kind', 'subject'], p)) return;
        enumeration(condition.kind, CONDITION_KINDS, `${p}.kind`); text(condition.subject, `${p}.subject`, true);
        if (own(condition, 'value') && !(typeof condition.value === 'boolean' || (typeof condition.value === 'number' && Number.isFinite(condition.value)) || plainText(condition.value))) issue(`${p}.value`, 'condition', 'Expected a plain string, finite number or boolean.');
      });
    }
  }
  const entryIDs = new Set(), bindingIDs = new Set(), routeIDs = new Set();
  if (shape(dataset, ['schemaVersion', 'datasetVersion', 'entries'], ['schemaVersion', 'datasetVersion', 'entries'], '$')) {
    if (![1, 2].includes(dataset.schemaVersion)) issue('$.schemaVersion', 'version', 'Only schema versions 1 and 2 are supported.');
    text(dataset.datasetVersion, '$.datasetVersion');
    if (array(dataset.entries, '$.entries')) dataset.entries.forEach((entry, ei) => {
      const ep = `$.entries[${ei}]`;
      if (!shape(entry, ['id', 'bindings', 'coverage', 'routes'], ['id', 'bindings', 'coverage', 'routes'], ep)) return;
      unique(entry.id, entryIDs, `${ep}.id`);
      enumeration(entry.coverage, new Set(['unreviewed', 'partial', 'reviewed']), `${ep}.coverage`);
      if (array(entry.bindings, `${ep}.bindings`, 1)) entry.bindings.forEach((binding, bi) => {
        const bp = `${ep}.bindings[${bi}]`;
        if (!shape(binding, ['id', 'act', 'progressKey', 'gameIds', 'wikiPage'], ['id', 'act', 'progressKey', 'gameIds', 'wikiPage'], bp)) return;
        unique(binding.id, bindingIDs, `${bp}.id`); enumeration(binding.act, ACTS, `${bp}.act`);
        text(binding.progressKey, `${bp}.progressKey`);
        const prefix = typeof binding.act === 'string' ? binding.act.toLowerCase() + '|' : '';
        if (typeof binding.progressKey !== 'string' || binding.progressKey !== binding.progressKey.toLowerCase() || !prefix || !binding.progressKey.startsWith(prefix) || !binding.progressKey.slice(prefix.length).trim()) issue(`${bp}.progressKey`, 'compatibility', 'Expected the existing lowercased Act/name progress key.');
        if (!gameIdsValid(binding.gameIds)) issue(`${bp}.gameIds`, 'gameIds', 'Expected a complete unique array of nonempty game IDs.');
        const page = pageTitle(binding.wikiPage);
        if (!page || genericPage(page)) issue(`${bp}.wikiPage`, 'page', 'Expected a specific reviewed item page title.');
      });
      if (array(entry.routes, `${ep}.routes`)) entry.routes.forEach((route, ri) => {
        const rp = `${ep}.routes[${ri}]`;
        const coordinateContract = dataset.schemaVersion === 2;
        const fields = ['id', 'type', 'acts', 'actor', 'location', 'sublocation', 'coordinates', 'conditions', 'notes', 'validity', 'sources', 'review'];
        const required = ['id', 'type', 'validity', 'sources', 'review'];
        if (coordinateContract) { fields.push('coordinateReview', 'navigationPoints'); required.push('coordinates', 'coordinateReview'); }
        if (!shape(route, fields, required, rp)) return;
        unique(route.id, routeIDs, `${rp}.id`); enumeration(route.type, ROUTE_TYPES, `${rp}.type`);
        enumeration(route.validity, new Set(['current', 'historical', 'uncertain']), `${rp}.validity`);
        if (own(route, 'acts') && route.acts !== null && array(route.acts, `${rp}.acts`, 1)) {
          const seen = new Set();
          for (const act of route.acts) {
            if (![1, 2, 3, 'prologue'].includes(act) || seen.has(act)) issue(`${rp}.acts`, 'act', 'Expected unique Acts 1, 2, 3 or prologue.');
            seen.add(act);
          }
        }
        for (const key of ['actor', 'location']) if (own(route, key)) entity(route[key], `${rp}.${key}`);
        if (own(route, 'sublocation') && route.sublocation !== null) text(route.sublocation, `${rp}.sublocation`, true);
        if (own(route, 'coordinates') && route.coordinates !== null) coordinates(route.coordinates, `${rp}.coordinates`);
        if (coordinateContract) {
          coordinateReview(route, rp);
          if (own(route, 'navigationPoints')) navigationPoints(route.navigationPoints, `${rp}.navigationPoints`);
        }
        if (own(route, 'conditions')) conditions(route.conditions, `${rp}.conditions`);
        if (own(route, 'notes') && route.notes !== null && array(route.notes, `${rp}.notes`)) route.notes.forEach((note, ni) => text(note, `${rp}.notes[${ni}]`, true));
        if (array(route.sources, `${rp}.sources`)) route.sources.forEach((value, si) => source(value, `${rp}.sources[${si}]`));
        if (shape(route.review, ['state', 'reviewedAt', 'reviewer'], ['state'], `${rp}.review`)) {
          enumeration(route.review.state, new Set(['reviewed', 'draft', 'disputed']), `${rp}.review.state`);
          if (own(route.review, 'reviewer')) text(route.review.reviewer, `${rp}.review.reviewer`, true);
          if (own(route.review, 'reviewedAt')) {
            const date = route.review.reviewedAt;
            if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) issue(`${rp}.review.reviewedAt`, 'date', 'Expected a valid YYYY-MM-DD review date.');
          }
          if (route.review.state === 'reviewed') {
            if (!Array.isArray(route.sources) || !route.sources.length) issue(`${rp}.sources`, 'evidence', 'Reviewed routes require evidence.');
            if (entry.coverage === 'unreviewed') issue(`${ep}.coverage`, 'review', 'Unreviewed coverage cannot expose reviewed routes.');
          }
        }
      });
    });
  }
  return Object.freeze({ ok: issues.length === 0, dataset: issues.length ? null : freeze(dataset), issues: freeze(issues) });
}

// Distinguish absence from malformed own data and inherited identity values.
function field(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return key in object ? { invalid: true } : { present: false };
  return own(descriptor, 'value') ? { present: true, value: descriptor.value } : { invalid: true };
}
function signature(act, progressKey, ids) {
  // Never trust a caller's iterator to reinterpret the validated complete IDs.
  const copied = [];
  for (let index = 0; index < ids.length; index++) copied.push(Object.getOwnPropertyDescriptor(ids, String(index)).value);
  copied.sort();
  return JSON.stringify([act, progressKey, copied]);
}

function createResolver(input) {
  const checked = validateDataset(input), bindings = new Map(), reviewed = new Map();
  if (checked.ok) for (const entry of checked.dataset.entries) {
    reviewed.set(entry.id, Object.freeze(entry.routes.filter(route => route.review.state === 'reviewed')));
    for (const binding of entry.bindings) {
      const key = signature(binding.act, binding.progressKey, binding.gameIds);
      if (!bindings.has(key)) bindings.set(key, []);
      bindings.get(key).push({ entry, page: pageTitle(binding.wikiPage) });
    }
  }
  function resolve(item) {
    if (!checked.ok || !record(item)) return null;
    try {
      const act = field(item, 'act'), name = field(item, 'name'), ids = field(item, 'gameIds'), source = field(item, 'source'), links = field(item, 'links');
      if (act.invalid || name.invalid || ids.invalid || source.invalid || links.invalid || !ACTS.has(act.value) || !token(name.value)) return null;
      const gameIds = ids.present ? ids.value : [];
      if (!gameIdsValid(gameIds)) return null;
      const progressKey = (act.value + '|' + name.value).toLowerCase();
      const lookupIdentity = value => {
        const identity = wikiIdentity(value);
        if (identity) return identity;
        // An absent/inherited/malformed ID field cannot use an external alias.
        if (!ids.present || gameIds.length !== 0) return null;
        const alias = REVIEWED_SOURCE_ALIASES.find(candidate => candidate.act === act.value &&
          candidate.progressKey === progressKey && candidate.source === value);
        return alias ? { page: alias.page, revisionId: null } : null;
      };
      const pages = [];
      if (source.present) {
        if (source.value !== '') {
          const identity = lookupIdentity(source.value);
          if (!identity || genericPage(identity.page)) return null;
          pages.push(identity.page);
        }
      }
      if (links.present) {
        if (!record(links.value)) return null;
        const link = field(links.value, 'Name');
        if (link.invalid) return null;
        if (link.present) {
          const identity = lookupIdentity(link.value);
          if (!identity || genericPage(identity.page)) return null;
          pages.push(identity.page);
        }
      }
      if (new Set(pages).size > 1 || (!gameIds.length && !pages.length)) return null;
      const candidates = bindings.get(signature(act.value, progressKey, gameIds)) || EMPTY;
      const matching = candidates.filter(candidate => !pages.length || candidate.page === pages[0]);
      return matching.length === 1 ? matching[0].entry : null;
    } catch { return null; }
  }
  return Object.freeze({
    schemaVersion: checked.ok ? checked.dataset.schemaVersion : null,
    datasetVersion: checked.ok ? checked.dataset.datasetVersion : null,
    issues: checked.issues,
    resolve,
    reviewedRoutesFor(item) { const entry = resolve(item); return entry ? reviewed.get(entry.id) : EMPTY; }
  });
}

module.exports = Object.freeze({ validateDataset, createResolver });
