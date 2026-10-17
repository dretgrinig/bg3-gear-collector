/* Pure compact presentation of validated acquisition enrichment. */
'use strict';

const EMPTY_ROUTES = Object.freeze([]);
const EMPTY_HTML = Object.freeze({ acquisitionHtml: '', referencesHtml: '' });
const CONDITION_BUCKETS = Object.freeze(['prerequisites', 'before', 'after', 'exclusions']);
const CHECK_SUBJECTS = new Set(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma',
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation',
  'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival']);
const COORDINATE_ROLES = Object.freeze({ actor: 'Actor', corpse: 'Corpse', container: 'Container', entrance: 'Entrance',
  encounter: 'Encounter point', former_container: 'Former container', component: 'Component', location: 'Location',
  item: 'Item', interaction: 'Interaction', crafting_station: 'Crafting station' });

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
function coordinateReviewFor(route) {
  // Schema 1 has no explicit coordinate review. Preserve its point verbatim;
  // a null legacy point receives no invented status, location or coordinates.
  return route.coordinateReview || { state: route.coordinates ? 'exact' : null };
}
function geographyIdentity(route) {
  const review = coordinateReviewFor(route);
  const pointIdentity = point => [point.label,
    point.location ? [point.location.name, point.location.wikiPage ?? null] : null,
    point.sublocation ?? null, point.coordinates ? [point.coordinates.x, point.coordinates.y, point.coordinates.space, point.coordinates.subject] : null];
  // Full tuples compare by exact values. Only destination presentation is
  // grouped; every canonical method and conditional route remains separate.
  return JSON.stringify([
    route.location ? [route.location.name, route.location.wikiPage ?? null] : null,
    route.sublocation ?? null,
    route.coordinates ? [route.coordinates.x, route.coordinates.y, route.coordinates.space, route.coordinates.subject] : null,
    [review.state, review.reason ?? null], route.navigationPoints ? route.navigationPoints.map(pointIdentity) : null,
    route.validity, route.acts ?? null
  ]);
}
function geographyLine(point, prefix = '') {
  const parts = [];
  if (point.location) parts.push(point.location.name);
  if (point.sublocation) parts.push(point.sublocation);
  const coordinates = point.coordinates;
  if (coordinates && Number.isFinite(coordinates.x) && Number.isFinite(coordinates.y)) {
    if (coordinates.space && !parts.includes(coordinates.space)) parts.push(coordinates.space);
  }
  if (!parts.length && !coordinates && !prefix) return '';
  const labels = [prefix, ...parts].filter(Boolean).map(escapeHTML).join(' · ');
  const xy = coordinates && Number.isFinite(coordinates.x) && Number.isFinite(coordinates.y)
    ? `<span class="acquisition-coordinate">X: ${escapeHTML(coordinates.x)} Y: ${escapeHTML(coordinates.y)}</span>` : '';
  return `<div class="acquisition-geography">${labels}${labels && xy ? ' · ' : ''}${xy}</div>`;
}
function renderDestination(route) {
  let html = geographyLine(route);
  const review = coordinateReviewFor(route);
  if (review.state === 'reference') {
    const role = route.coordinates && COORDINATE_ROLES[route.coordinates.subject];
    if (role) html += `<div class="acquisition-coordinate-note">${escapeHTML(role)}</div>`;
  } else if (review.state === 'not_applicable') {
    html += `<div class="acquisition-exception">${escapeHTML(review.reason)}</div>`;
  } else if (review.state === 'pending' || review.state === 'conflict' || review.state === 'not_documented') {
    const text = { pending: 'Coordinates pending.', conflict: 'Coordinates conflict — see Wiki.', not_documented: 'Coordinates not documented.' }[review.state];
    html += `<div class="acquisition-exception">${text}</div>`;
  }
  if (route.navigationPoints) {
    html += `<div class="acquisition-navigation">${route.navigationPoints.map(point => {
      const role = COORDINATE_ROLES[point.coordinates.subject] || 'Navigation point';
      return `<div class="acquisition-navigation-point">${geographyLine(point, `${role}: ${point.label}`)}</div>`;
    }).join('')}</div>`;
  }
  return html;
}
function conciseSubject(route, kind) {
  const conditions = route.conditions && route.conditions.prerequisites;
  if (!conditions) return null;
  const matches = conditions.filter(condition => condition.kind === kind);
  return matches.length === 1 && matches[0].subject.length <= 100 ? matches[0].subject : null;
}
function methodText(route) {
  const actor = route.actor && route.actor.name;
  switch (route.type) {
    case 'purchase': return `Vendor: ${actor ? `Sold by ${actor}` : 'See Wiki'}.`;
    case 'drop': return `Loot: ${actor ? `Dropped by ${actor}` : 'Dropped here'}.`;
    case 'actor_loot': return `Loot: ${actor ? `Carried by ${actor}` : 'Carried loot — see Wiki'}.`;
    case 'quest_reward': {
      const quest = conciseSubject(route, 'quest');
      return `Quest reward: ${quest ? `Reward for ${quest}` : actor ? `Given by ${actor}` : 'See Wiki'}.`;
    }
    case 'gift': return `Gift: ${actor ? `Given by ${actor}` : 'See Wiki'}.`;
    case 'craft': return `Craft: ${actor ? `Made by ${actor}` : 'Forged here'}.`;
    case 'combine': return `Combine: ${actor || 'Assemble in inventory'}.`;
    case 'container': return `Container: ${actor || 'Found in a container'}.`;
    case 'world': return `World: ${actor || 'Found here'}.`;
    case 'ability': return `Ability: ${conciseSubject(route, 'ability') || actor || 'Created by an ability'}.`;
    case 'steal': return `Steal: ${actor ? `From ${actor}` : 'See Wiki'}.`;
    case 'disarm': return `Disarm: ${actor || 'See Wiki'}.`;
    default: throw new Error('Unsupported reviewed method');
  }
}
function conditionQualification(route) {
  const conditions = route.conditions;
  if (!conditions) return '';
  const populated = CONDITION_BUCKETS.filter(bucket => conditions[bucket] && conditions[bucket].length);
  if (!populated.length) return '';
  if (populated.length === 1 && populated[0] === 'prerequisites' && conditions.prerequisites.length === 1) {
    const condition = conditions.prerequisites[0];
    if (condition.kind === 'check' && CHECK_SUBJECTS.has(condition.subject) && Number.isInteger(condition.value) && condition.value >= 0 && condition.value <= 99) {
      return `${condition.subject} check (DC ${condition.value}).`;
    }
  }
  return 'Conditional route — see Wiki.';
}
function renderRoute(route) {
  const historical = route.validity === 'historical'
    ? '<span class="acquisition-historical">Historical / unavailable</span>' : '';
  const qualification = conditionQualification(route);
  return `<div class="acquisition-route"><div class="acquisition-route-heading"><span>${escapeHTML(methodText(route))}</span>${historical}</div>${qualification ? `<div class="acquisition-condition">${escapeHTML(qualification)}</div>` : ''}</div>`;
}
function groupDestinations(routes) {
  const identities = new Map(), groups = [];
  for (const route of routes) {
    const identity = geographyIdentity(route);
    let group = identities.get(identity);
    if (!group) { group = { destination: route, routes: [] }; identities.set(identity, group); groups.push(group); }
    group.routes.push(route);
  }
  return groups;
}
function createAcquisitionUI(metadataModule, dataset) {
  let resolver = null;
  try {
    if (metadataModule && typeof metadataModule.createResolver === 'function') {
      const candidate = metadataModule.createResolver(dataset);
      if (candidate && typeof candidate.reviewedRoutesFor === 'function') resolver = candidate;
    }
  } catch { /* Optional enrichment leaves baseline gear information intact. */ }
  function renderableReviewedRoutesFor(item, mode) {
    if (mode !== 'full' || !resolver) return EMPTY_ROUTES;
    try {
      const reviewed = resolver.reviewedRoutesFor(item);
      const routes = reviewed.filter(route => route.review.state === 'reviewed' &&
        (route.validity === 'current' || route.validity === 'historical'));
      return routes.length ? Object.freeze(routes) : EMPTY_ROUTES;
    } catch { return EMPTY_ROUTES; }
  }
  function render(item, mode) {
    // Gate before resolution or reading any item/acquisition field.
    if (mode !== 'full') return EMPTY_HTML;
    const routes = renderableReviewedRoutesFor(item, mode);
    if (!routes.length) return EMPTY_HTML;
    try {
      const points = groupDestinations(routes).map(group =>
        `<div class="acquisition-point">${renderDestination(group.destination)}${group.routes.map(renderRoute).join('')}</div>`).join('');
      return Object.freeze({ acquisitionHtml: `<section class="acquisition-enrichment"><h4>Where to find</h4>${points}</section>`, referencesHtml: '' });
    } catch { return EMPTY_HTML; }
  }
  return Object.freeze({ render, renderableReviewedRoutesFor });
}
module.exports = Object.freeze({ createAcquisitionUI });
