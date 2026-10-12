/* Pure presentation of validated acquisition enrichment. */
'use strict';

const EMPTY_ROUTES = Object.freeze([]);
const EMPTY_HTML = Object.freeze({ acquisitionHtml: '', referencesHtml: '' });
const ROUTE_LABELS = Object.freeze({
  purchase: 'Sold by',
  drop: 'Dropped by',
  actor_loot: 'Carried by',
  quest_reward: 'Quest reward',
  gift: 'Given by',
  craft: 'Crafted',
  combine: 'Combined',
  container: 'Found in container',
  world: 'Found in world',
  ability: 'Granted by ability',
  steal: 'Stolen from',
  disarm: 'Obtained by disarming'
});
const COORDINATE_SUBJECTS = Object.freeze({
  actor: 'Actor', container: 'Container', entrance: 'Entrance', item: 'Item',
  interaction: 'Interaction', crafting_station: 'Crafting station'
});
const CONDITION_LABELS = Object.freeze({
  prerequisites: 'Prerequisites', before: 'Before', after: 'After', exclusions: 'Exclusions'
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
function line(label, value) {
  return `<div class="acquisition-line"><span class="acquisition-label">${escapeHTML(label)}</span><span>${escapeHTML(value)}</span></div>`;
}
function conditionText(condition) {
  const hasValue = Object.prototype.hasOwnProperty.call(condition, 'value');
  return condition.subject + (hasValue ? ': ' + String(condition.value) : '');
}
function renderLocation(route) {
  let details = '';
  if (route.location) details += line('Location', route.location.name);
  if (route.sublocation) details += line('Sublocation', route.sublocation);
  if (route.coordinates) {
    const coordinates = route.coordinates;
    if (Number.isFinite(coordinates.x) && Number.isFinite(coordinates.y)) {
      details += line('Coordinates', `${coordinates.space} · ${COORDINATE_SUBJECTS[coordinates.subject]}: X ${coordinates.x}, Y ${coordinates.y}`);
    }
  }
  return details;
}
function geographyIdentity(route) {
  // Compare the complete reviewed tuple by values, without normalizing away
  // distinctions. Different availability/Act contexts keep their own geography.
  return JSON.stringify([
    route.location ? [route.location.name, route.location.wikiPage ?? null] : null,
    route.sublocation ?? null,
    route.coordinates ? [route.coordinates.x, route.coordinates.y, route.coordinates.space, route.coordinates.subject] : null,
    route.validity, route.acts ?? null
  ]);
}
function sharedLocationFor(routes) {
  if (routes.length < 2 || !renderLocation(routes[0])) return '';
  const identity = geographyIdentity(routes[0]);
  if (!routes.every(route => geographyIdentity(route) === identity)) return '';
  return `<div class="acquisition-shared-location"><p class="acquisition-shared-label">Shared location · all routes</p>${renderLocation(routes[0])}</div>`;
}
function routeLabel(route) {
  return ROUTE_LABELS[route.type] + (route.actor ? ' ' + route.actor.name : '');
}
function renderRoute(route, sharedLocation, number) {
  const actor = route.actor ? ' ' + route.actor.name : '';
  const historical = route.validity === 'historical'
    ? '<span class="acquisition-historical">Historical</span>' : '';
  const numbering = number ? `<span class="acquisition-route-number">Route ${number} ·</span>` : '';
  let details = sharedLocation ? '' : renderLocation(route);
  if (route.conditions) for (const bucket of Object.keys(CONDITION_LABELS)) {
    const conditions = route.conditions[bucket];
    if (conditions && conditions.length) details += line(CONDITION_LABELS[bucket], conditions.map(conditionText).join('; '));
  }
  if (route.notes && route.notes.length) details += line('Notes', route.notes.join(' '));
  return `<div class="acquisition-route"><div class="acquisition-route-heading">${numbering}<span>${escapeHTML(ROUTE_LABELS[route.type] + actor)}</span>${historical}</div>${details}</div>`;
}
function sourcePage(source) {
  // Validation already pins the source authority and URL forms. Parse only its
  // page label here; source URLs are evidence links, never visible prose.
  const url = new URL(source.url);
  return (url.pathname === '/w/index.php'
    ? url.searchParams.get('title')
    : decodeURIComponent(url.pathname.slice('/wiki/'.length))).replace(/_/g, ' ');
}
function renderReferences(routes) {
  const seen = new Set(), links = [];
  for (const route of routes) for (const source of route.sources) {
    const identity = JSON.stringify([source.url, source.section]);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const label = `BG3 Wiki · ${sourcePage(source)} · ${source.section} ↗`;
    links.push(`<li><a class="wiki acquisition-reference" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a></li>`);
  }
  if (!links.length) return '';
  const primary = links.slice(0, 3), additional = links.slice(3);
  const more = additional.length
    ? `<details class="acquisition-more-sources"><summary>More sources (${additional.length})</summary><ul>${additional.join('')}</ul></details>` : '';
  return `<section class="acquisition-references"><h4>References</h4><ul>${primary.join('')}</ul>${more}</section>`;
}

function createAcquisitionUI(metadataModule, dataset) {
  let resolver = null;
  try {
    // The canonical resolver validates and copies the complete dataset. Keep
    // identity decisions there instead of matching item names in presentation.
    if (metadataModule && typeof metadataModule.createResolver === 'function') {
      const candidate = metadataModule.createResolver(dataset);
      if (candidate && typeof candidate.reviewedRoutesFor === 'function') resolver = candidate;
    }
  } catch { /* An unavailable optional module leaves the baseline UI intact. */ }

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
    // Gate before resolving or reading any item field, including in disclosures.
    if (mode !== 'full') return EMPTY_HTML;
    const routes = renderableReviewedRoutesFor(item, mode);
    if (!routes.length) return EMPTY_HTML;
    try {
      const sharedLocation = sharedLocationFor(routes), labels = new Map();
      for (const route of routes) {
        const label = routeLabel(route); labels.set(label, (labels.get(label) || 0) + 1);
      }
      return Object.freeze({
        acquisitionHtml: `<section class="acquisition-enrichment"><h4>Acquisition</h4>${sharedLocation}${routes.map((route, index) => renderRoute(route, !!sharedLocation, labels.get(routeLabel(route)) > 1 ? index + 1 : null)).join('')}</section>`,
        referencesHtml: renderReferences(routes)
      });
    } catch { return EMPTY_HTML; }
  }
  return Object.freeze({ render, renderableReviewedRoutesFor });
}

module.exports = Object.freeze({ createAcquisitionUI });
