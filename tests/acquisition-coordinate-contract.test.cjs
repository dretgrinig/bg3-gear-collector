'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDataset, createResolver } = require('../acquisition-metadata.js');

const clone = value => JSON.parse(JSON.stringify(value));
const evidence = () => [{url:'https://bg3.wiki/wiki/Test_Relic', section:'Where to find'}];
const item = () => ({act:'ACT 1',name:'Test Relic',gameIds:['TEST_RELIC'],source:'https://bg3.wiki/wiki/Test_Relic'});
function fixture() {
  return {schemaVersion:2,datasetVersion:'2.0.0-test',entries:[{
    id:'entry:test',coverage:'reviewed',bindings:[{id:'binding:test',act:'ACT 1',progressKey:'act 1|test relic',gameIds:['TEST_RELIC'],wikiPage:'Test Relic'}],
    routes:[{id:'route:test',type:'container',coordinates:{x:12,y:-8,space:'Test chamber',subject:'container'},coordinateReview:{state:'exact'},validity:'current',sources:evidence(),review:{state:'reviewed'}}]
  }]};
}
function edit(mutator) { const data=fixture(); mutator(data.entries[0].routes[0],data); return data; }
function valid(data) {
  const checked=validateDataset(data); assert.equal(checked.ok,true,JSON.stringify(checked.issues));
  assert.deepEqual(checked.issues,[]); return checked.dataset;
}
function invalid(data, path) {
  const checked=validateDataset(data); assert.equal(checked.ok,false); assert.equal(checked.dataset,null);
  if(path) assert.ok(checked.issues.some(issue=>issue.path===path),JSON.stringify(checked.issues));
  const resolver=createResolver(data); assert.equal(resolver.schemaVersion,null); assert.equal(resolver.resolve(item()),null); assert.deepEqual(resolver.reviewedRoutesFor(item()),[]);
}
function navigationPoint() {
  return {label:'Required component',location:{name:'Test cavern',wikiPage:'Test Cavern'},sublocation:'Upper ledge',coordinates:{x:-30,y:0,space:'Test cavern',subject:'component'},sources:evidence()};
}
const routePath='$.entries[0].routes[0]';

test('schema 2 exposes an explicit coordinate review without changing strict binding identity',()=>{
  const data=fixture(),resolver=createResolver(data); valid(data); assert.equal(resolver.schemaVersion,2);
  assert.equal(resolver.resolve(item()).id,'entry:test'); assert.equal(resolver.reviewedRoutesFor(item())[0].coordinateReview.state,'exact');
  for(const incoming of [{...item(),gameIds:[]},{...item(),gameIds:['TEST_RELIC','EXTRA']},{...item(),act:'ACT 2'},{...item(),source:'https://bg3.wiki/wiki/Other_Relic'}]) assert.equal(resolver.resolve(incoming),null);
});
for(const state of ['exact','reference']) test(`schema 2 ${state} requires and preserves a reviewed coordinate`,()=>{
  const data=edit(route=>{route.coordinateReview={state,reason:'Reviewed acquisition anchor.'};});
  const route=valid(data).entries[0].routes[0]; assert.equal(route.coordinateReview.state,state); assert.deepEqual({...route.coordinates},{x:12,y:-8,space:'Test chamber',subject:'container'});
  invalid(edit(route=>{route.coordinateReview={state};route.coordinates=null;}),routePath+'.coordinates');
});
for(const state of ['pending','conflict','not_documented','not_applicable']) test(`schema 2 ${state} records an explicit null instead of default coordinates`,()=>{
  const data=edit(route=>{route.coordinateReview={state,reason:'No fixed reviewed point.'};route.coordinates=null;});
  const route=valid(data).entries[0].routes[0]; assert.equal(route.coordinates,null); assert.equal(route.coordinateReview.state,state);
  invalid(edit(route=>{route.coordinateReview={state,reason:'No fixed reviewed point.'};}),routePath+'.coordinates');
});
for(const subject of ['actor','corpse','container','entrance','encounter','former_container','component','location','item','interaction','crafting_station']) test(`schema 2 validates coordinate role ${subject}`,()=>{
  const route=valid(edit(route=>{route.coordinates.subject=subject;})).entries[0].routes[0]; assert.equal(route.coordinates.subject,subject);
});
for(const [label,mutator,path] of [
  ['missing coordinateReview',r=>{delete r.coordinateReview;},'.coordinateReview'],
  ['null coordinateReview',r=>{r.coordinateReview=null;},'.coordinateReview'],
  ['missing coordinateReview state',r=>{r.coordinateReview={};},'.coordinateReview.state'],
  ['unknown coordinateReview state',r=>{r.coordinateReview.state='verified';},'.coordinateReview.state'],
  ['extra coordinateReview field',r=>{r.coordinateReview.reviewed=true;},'.coordinateReview.reviewed'],
  ['blank optional reason',r=>{r.coordinateReview.reason=' ';},'.coordinateReview.reason'],
  ['HTML reason',r=>{r.coordinateReview.reason='<b>Exact</b>';},'.coordinateReview.reason'],
  ['missing coordinates',r=>{delete r.coordinates;},'.coordinates'],
  ['undefined coordinates',r=>{r.coordinates=undefined;},'.coordinates'],
  ['unknown coordinate role',r=>{r.coordinates.subject='unreviewed_map';},'.coordinates.subject'],
  ['coordinate string',r=>{r.coordinates.x='12';},'.coordinates.x'],
  ['nonfinite coordinate',r=>{r.coordinates.y=Infinity;},'.coordinates.y'],
  ['unverified exact point without evidence',r=>{r.review.state='draft';r.sources=[];},'.sources'],
  ['not-applicable without reason',r=>{r.coordinates=null;r.coordinateReview={state:'not_applicable'};},'.coordinateReview.reason'],
  ['not-applicable without evidence',r=>{r.coordinates=null;r.coordinateReview={state:'not_applicable',reason:'Created in inventory.'};r.review.state='draft';r.sources=[];},'.sources']
]) test(`schema 2 rejects ${label} failure-atomically`,()=>invalid(edit(mutator),routePath+path));

test('schema 2 finite zero coordinates remain explicit source data and do not become a missing-point fallback',()=>{
  const route=valid(edit(route=>{route.coordinates.x=0;route.coordinates.y=-12.5;})).entries[0].routes[0];
  assert.equal(route.coordinates.x,0);assert.equal(route.coordinates.y,-12.5);
  invalid(edit(route=>{delete route.coordinates.x;}),routePath+'.coordinates.x');
});
test('schema 1 retains its original fields and roles while refusing schema 2 additions',()=>{
  const legacy=fixture();legacy.schemaVersion=1;delete legacy.entries[0].routes[0].coordinateReview;valid(legacy);
  const withReview=clone(legacy);withReview.entries[0].routes[0].coordinateReview={state:'exact'};invalid(withReview,routePath+'.coordinateReview');
  const withPoints=clone(legacy);withPoints.entries[0].routes[0].navigationPoints=[navigationPoint()];invalid(withPoints,routePath+'.navigationPoints');
  const newRole=clone(legacy);newRole.entries[0].routes[0].coordinates.subject='corpse';invalid(newRole,routePath+'.coordinates.subject');
  const omitted=clone(legacy);delete omitted.entries[0].routes[0].coordinates;valid(omitted);
});
test('unsupported future schema versions remain rejected',()=>{const data=fixture();data.schemaVersion=3;invalid(data,'$.schemaVersion');});
test('schema 2 reviewed coordinate evidence does not promote a draft route into published review',()=>{
  const data=edit(route=>{route.review.state='draft';});valid(data);assert.deepEqual(createResolver(data).reviewedRoutesFor(item()),[]);
});
test('inventory assembly keeps component navigation distinct from finished-item acquisition coordinates',()=>{
  const data=edit(route=>{route.type='combine';route.coordinates=null;route.coordinateReview={state:'not_applicable',reason:'Combined in one character inventory.'};route.navigationPoints=[navigationPoint(),{...navigationPoint(),label:'Second component',coordinates:{x:40,y:-20,space:'Other cavern',subject:'entrance'}}];});
  const routes=createResolver(data).reviewedRoutesFor(item()); valid(data); assert.equal(routes.length,1);assert.equal(routes[0].type,'combine');assert.equal(routes[0].coordinates,null);
  assert.equal(routes[0].navigationPoints.length,2);assert.equal(routes[0].navigationPoints[0].coordinates.subject,'component');assert.equal(routes[0].navigationPoints[1].coordinates.subject,'entrance');
});
test('reference routes may retain separate evidence-backed navigation points without inventing extra routes',()=>{
  const data=edit(route=>{route.coordinateReview={state:'reference',reason:'Initial encounter location.'};route.coordinates.subject='encounter';route.navigationPoints=[navigationPoint()];});
  assert.equal(valid(data).entries[0].routes.length,1);assert.equal(createResolver(data).reviewedRoutesFor(item()).length,1);
});
for(const [label,mutator,path] of [
  ['null navigationPoints',r=>{r.navigationPoints=null;},'.navigationPoints'],
  ['empty navigationPoints',r=>{r.navigationPoints=[];},'.navigationPoints'],
  ['unknown point field',r=>{r.navigationPoints[0].routeId='extra';},'.navigationPoints[0].routeId'],
  ['missing point label',r=>{delete r.navigationPoints[0].label;},'.navigationPoints[0].label'],
  ['blank point label',r=>{r.navigationPoints[0].label=' ';},'.navigationPoints[0].label'],
  ['HTML point label',r=>{r.navigationPoints[0].label='<b>Component</b>';},'.navigationPoints[0].label'],
  ['null point coordinate',r=>{r.navigationPoints[0].coordinates=null;},'.navigationPoints[0].coordinates'],
  ['missing point coordinate',r=>{delete r.navigationPoints[0].coordinates;},'.navigationPoints[0].coordinates'],
  ['string point coordinate',r=>{r.navigationPoints[0].coordinates.y='0';},'.navigationPoints[0].coordinates.y'],
  ['unknown point role',r=>{r.navigationPoints[0].coordinates.subject='map';},'.navigationPoints[0].coordinates.subject'],
  ['unknown coordinate field',r=>{r.navigationPoints[0].coordinates.z=4;},'.navigationPoints[0].coordinates.z'],
  ['missing point evidence',r=>{delete r.navigationPoints[0].sources;},'.navigationPoints[0].sources'],
  ['empty point evidence',r=>{r.navigationPoints[0].sources=[];},'.navigationPoints[0].sources'],
  ['foreign point source',r=>{r.navigationPoints[0].sources[0].url='https://example.com/wiki/Test_Relic';},'.navigationPoints[0].sources[0].url'],
  ['source fragment',r=>{r.navigationPoints[0].sources[0].url+='\u0023Where_to_find';},'.navigationPoints[0].sources[0].url'],
  ['pinned source revision mismatch',r=>{r.navigationPoints[0].sources[0]={url:'https://bg3.wiki/w/index.php?title=Test_Relic&oldid=42',revisionId:43,section:'Where to find'};},'.navigationPoints[0].sources[0].revisionId'],
  ['extra point source field',r=>{r.navigationPoints[0].sources[0].verified=true;},'.navigationPoints[0].sources[0].verified'],
  ['null point location',r=>{r.navigationPoints[0].location=null;},'.navigationPoints[0].location'],
  ['invalid point location',r=>{r.navigationPoints[0].location.name='';},'.navigationPoints[0].location.name'],
  ['extra point location field',r=>{r.navigationPoints[0].location.kind='map';},'.navigationPoints[0].location.kind'],
  ['null point sublocation',r=>{r.navigationPoints[0].sublocation=null;},'.navigationPoints[0].sublocation'],
  ['HTML point sublocation',r=>{r.navigationPoints[0].sublocation='<b>Upper ledge</b>';},'.navigationPoints[0].sublocation']
]) test(`navigation contract rejects ${label}`,()=>invalid(edit((route,data)=>{route.navigationPoints=[navigationPoint()];mutator(route,data);}),routePath+path));

test('optional navigation geography may be absent because the reviewed coordinate retains its map space',()=>{
  const data=edit(route=>{const point=navigationPoint();delete point.location;delete point.sublocation;route.navigationPoints=[point];});valid(data);
});
for(const key of ['coordinateReview','navigationPoints','point coordinates','point source']) test(`${key} accessors fail closed without invoking caller code`,()=>{
  let calls=0;const data=edit(route=>{route.navigationPoints=[navigationPoint()];});const route=data.entries[0].routes[0];
  const [object,property]=key==='coordinateReview'?[route.coordinateReview,'state']:key==='navigationPoints'?[route,'navigationPoints']:key==='point coordinates'?[route.navigationPoints[0].coordinates,'x']:[route.navigationPoints[0].sources[0],'url'];
  Object.defineProperty(object,property,{enumerable:true,get(){calls++;throw new Error('Getter executed');}});invalid(data);assert.equal(calls,0);
});
test('navigation arrays reject holes and custom prototypes, and point cycles fail closed',()=>{
  invalid(edit(route=>{route.navigationPoints=[navigationPoint(),,navigationPoint()];}));
  invalid(edit(route=>{route.navigationPoints=[Object.assign(Object.create({unexpected:true}),navigationPoint())];}));
  invalid(edit(route=>{const point=navigationPoint();point.location=point;route.navigationPoints=[point];}));
});
test('coordinate reviews and navigation output are frozen copies and prototype-shaped labels remain plain text',()=>{
  const data=edit(route=>{route.navigationPoints=[navigationPoint()];route.navigationPoints[0].label='__proto__';});const before=clone(data),output=valid(data),route=output.entries[0].routes[0];
  assert.deepEqual(data,before);assert.ok(!Object.isFrozen(data));assert.ok(!Object.isFrozen(data.entries[0].routes[0].navigationPoints[0]));
  for(const value of [route.coordinateReview,route.navigationPoints,route.navigationPoints[0],route.navigationPoints[0].coordinates,route.navigationPoints[0].sources,route.navigationPoints[0].sources[0]])assert.ok(Object.isFrozen(value));
  data.entries[0].routes[0].coordinateReview.state='pending';data.entries[0].routes[0].navigationPoints[0].coordinates.x=99;
  assert.equal(route.coordinateReview.state,'exact');assert.equal(route.navigationPoints[0].coordinates.x,-30);assert.equal(route.navigationPoints[0].label,'__proto__');assert.equal({}.polluted,undefined);
});
test('an invalid later navigation point invalidates earlier validated entries and route publication',()=>{
  const data=fixture(),later=clone(data.entries[0]);later.id='entry:later';later.bindings[0].id='binding:later';later.routes[0].id='route:later';later.routes[0].navigationPoints=[navigationPoint()];later.routes[0].navigationPoints[0].coordinates.x='30';data.entries.push(later);invalid(data);
});
