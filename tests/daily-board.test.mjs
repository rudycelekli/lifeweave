import test from 'node:test';
import assert from 'node:assert/strict';
import {composeDailyBoard,createDemoState,DEMO_CLOCK,evaluate,applyFeedback,recordSurfaceDelivery,recordContextCorrection,ingestObservations,ValidationError} from '../packages/core/src/index.mjs';

const NOW=DEMO_CLOCK,clone=value=>structuredClone(value),frames=board=>[...(board.primary?[board.primary]:[]),...board.supporting];
const careerMetric={id:'career-metric',tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:NOW,goalIds:['goal-career'],summary:'Explicit proposal count',metrics:{proposalsSent:0},data:{}};

test('daily board is immutable, capped at three, and references only current evaluated frames',()=>{
  const state=createDemoState(),before=JSON.stringify(state),expected=evaluate(state,{now:NOW}).surfaces;
  const board=composeDailyBoard(state,{now:NOW});
  assert.equal(board.version,1);assert.equal(board.status,'ready');assert.equal(board.reason,'current-moves');assert.equal(board.tenantId,'local');assert.equal(board.localDay,'2026-10-13');
  assert.equal(frames(board).length,3);assert.equal(board.supporting.length,2);assert.equal(board.hiddenCount,1);assert.equal(board.eligibleCount,4);
  assert.deepEqual(board.surfaceIds,frames(board).map(frame=>frame.id));
  for(const frame of frames(board))assert.deepEqual(frame,expected.find(item=>item.id===frame.id));
  assert.equal(JSON.stringify(state),before);assert.equal(state.deliveries.length,0);assert.equal(state.feedback.length,0);
  board.primary.title='Caller-edited copy';assert.notEqual(state.goals[0].title,'Caller-edited copy');assert.deepEqual(composeDailyBoard(state,{now:NOW}).surfaceIds,expected.slice(0,3).map(frame=>frame.id));
});

test('board prefers distinct goals before filling extra slots for one goal',()=>{
  let state=createDemoState();state.preferences.dailySurfaceBudget=8;state=ingestObservations(state,[careerMetric],{now:NOW});
  const board=composeDailyBoard(state,{now:NOW});
  assert.deepEqual(frames(board).map(frame=>frame.goalId),['goal-career','goal-learning','goal-wellbeing']);
  assert.equal(board.hiddenCount,2);assert.equal(frames(board).filter(frame=>frame.goalId==='goal-career').length,1);
  for(const goal of state.goals)if(goal.status==='active'&&goal.id!=='goal-career')goal.status='paused';
  const filled=composeDailyBoard(state,{now:NOW});assert.equal(frames(filled).length,2);assert(frames(filled).every(frame=>frame.goalId==='goal-career'));assert.equal(filled.hiddenCount,0);
});

test('explicit limit and deterministic priority/confidence/identity ordering survive input reorder',()=>{
  const state=createDemoState();state.goals.find(goal=>goal.id==='goal-learning').priority=70;state.goals.find(goal=>goal.id==='goal-wellbeing').priority=72;state.goals.find(goal=>goal.id==='goal-relationships').priority=73;
  const first=composeDailyBoard(state,{now:NOW}),reordered=clone(state);reordered.goals.reverse();reordered.observations.reverse();
  assert.deepEqual(composeDailyBoard(reordered,{now:NOW}),first);
  assert.deepEqual(frames(first).map(frame=>frame.goalId),['goal-career','goal-learning','goal-relationships']);
  for(const limit of [1,2,3]){const board=composeDailyBoard(state,{now:NOW,limit});assert.equal(frames(board).length,limit);assert.equal(board.supporting.length,limit-1);assert.equal(board.hiddenCount,4-limit);}
});

test('quiet hours and zero attention budget produce quiet board without hidden gaps or new facts',()=>{
  const night='2026-10-14T02:30:00Z',state=createDemoState(night),board=composeDailyBoard(state,{now:night});
  assert.equal(board.status,'quiet');assert.equal(board.reason,'quiet-hours');assert.equal(board.primary,null);assert.deepEqual(board.supporting,[]);assert.equal(board.hiddenCount,0);assert.equal(board.eligibleCount,0);
  assert(!Object.hasOwn(board,'gaps'));assert(!Object.hasOwn(board,'question'));
  state.preferences.dailySurfaceBudget=0;state.preferences.quietHours={start:0,end:0};
  const budget=composeDailyBoard(state,{now:night});assert.equal(budget.reason,'attention-budget');assert.equal(budget.surfaceIds.length,0);
  const replay=composeDailyBoard(state,{now:night,mode:'replay'});assert.equal(replay.status,'ready');assert.equal(replay.surfaceIds.length,3);
});

test('empty or candidate-only workspace is passive onboarding and never activates historical goals',()=>{
  const state=createDemoState();state.goals.forEach(goal=>{goal.status='candidate';});
  const board=composeDailyBoard(state,{now:NOW});assert.equal(board.status,'onboarding');assert.equal(board.reason,'no-active-goals');assert.equal(board.primary,null);assert.equal(board.hiddenCount,0);assert(state.goals.every(goal=>goal.status==='candidate'));
  const empty={version:1,tenantId:'business-local',goals:[],observations:[],connections:[],preferences:{timezone:'America/New_York',quietHours:{start:22,end:7},dailySurfaceBudget:4},feedback:[]};
  assert.equal(composeDailyBoard(empty,{now:NOW}).status,'onboarding');assert.equal(composeDailyBoard(empty,{now:NOW}).tenantId,'business-local');
  const unknown=createDemoState();unknown.observations=[];const quiet=composeDailyBoard(unknown,{now:NOW});assert.equal(quiet.status,'quiet');assert.equal(quiet.reason,'no-current-moves');assert.doesNotMatch(quiet.brief,/achieved|completed|healthy|behind|score/i);
});

test('revoked, future and stale sources are absent even in replay, while foreign tenant rejects safely',()=>{
  const state=createDemoState();state.connections.find(connection=>connection.id==='demo-health').status='disconnected';
  state.observations.find(observation=>observation.id==='demo-mail-overdue').occurredAt='2026-10-14T16:00:00Z';
  state.observations.find(observation=>observation.id==='demo-calendar-window').occurredAt='2026-10-01T16:00:00Z';
  const board=composeDailyBoard(state,{now:NOW,mode:'replay'});assert.deepEqual(frames(board).map(frame=>frame.goalId),['goal-relationships']);assert.equal(board.hiddenCount,0);
  const foreign=createDemoState();foreign.observations[0].tenantId='foreign';assert.throws(()=>composeDailyBoard(foreign,{now:NOW}),ValidationError);
});

test('handled/dismissed/snoozed feedback remains enforced for board replay as well as live',()=>{
  let state=createDemoState();const initial=evaluate(state,{now:NOW,mode:'replay'}).surfaces;
  state=applyFeedback(state,{surfaceId:initial[0].id,kind:'done'},{now:NOW});state=applyFeedback(state,{surfaceId:initial[1].id,kind:'dismiss'},{now:NOW});state=applyFeedback(state,{surfaceId:initial[2].id,kind:'snooze',until:'2026-10-14T16:00:00Z'},{now:NOW});
  for(const mode of ['live','replay']){const board=composeDailyBoard(state,{now:NOW,mode});assert.deepEqual(frames(board).map(frame=>frame.id),[initial[3].id]);assert.equal(board.hiddenCount,0);}
});

test('only acknowledged shown moves consume attention; hidden fourth can fill a handled slot',()=>{
  let state=createDemoState();const initial=composeDailyBoard(state,{now:NOW}),hidden=evaluate(state,{now:NOW}).surfaces.find(frame=>!initial.surfaceIds.includes(frame.id));
  state=recordSurfaceDelivery(state,initial.surfaceIds,{now:NOW});assert.equal(state.deliveries.length,3);assert(!state.deliveries.some(receipt=>receipt.surfaceId===hidden.id));
  state=applyFeedback(state,{surfaceId:initial.primary.id,kind:'done'},{now:NOW});
  const next=composeDailyBoard(state,{now:NOW});assert(next.surfaceIds.includes(hidden.id));assert.equal(next.surfaceIds.length,3);assert.equal(state.deliveries.length,3);
});

test('board follows confirmed typed projections without rewriting original source or inventing KPIs',()=>{
  let state=createDemoState();delete state.observations[0].data.completed;delete state.observations[0].data.dueAt;const raw=JSON.stringify(state.observations[0]);
  assert(!frames(composeDailyBoard(state,{now:NOW})).some(frame=>frame.ruleId==='overdue-commitment'));
  state=recordContextCorrection(state,{goalId:'goal-career',observationId:'demo-mail-overdue',fields:{dueAt:'2026-10-12T16:00:00Z',completed:false}},{now:NOW});
  const board=composeDailyBoard(state,{now:NOW});assert.equal(board.primary.ruleId,'overdue-commitment');assert.equal(JSON.stringify(state.observations[0]),raw);assert.equal(state.observations.find(observation=>observation.id==='demo-budget-unknown').metrics.monthlySavings,undefined);
});

test('local day uses IANA timezone including DST, while output contains no source credentials or unrelated history',()=>{
  const now='2026-11-01T05:30:00Z',state=createDemoState(now);state.preferences.timezone='America/New_York';
  const board=composeDailyBoard(state,{now,mode:'replay'});assert.equal(board.localDay,'2026-11-01');assert.equal(board.at,'2026-11-01T05:30:00.000Z');
  state.preferences.timezone='America/Los_Angeles';assert.equal(composeDailyBoard(state,{now,mode:'replay'}).localDay,'2026-10-31');
  state.observations[0].data.body='Private raw full email';state.plans=[];const encoded=JSON.stringify(composeDailyBoard(state,{now,mode:'replay'}));assert(!encoded.includes('Private raw full email'));assert(!encoded.includes('consentAt'));assert(!encoded.includes('outcomes'));assert(!encoded.includes('plans'));
});

test('unsafe option getters, executable keys, noninteger bounds and unsupported modes reject without execution',()=>{
  let executed=0;const options={now:NOW};Object.defineProperty(options,'limit',{enumerable:true,get(){executed++;return 3;}});
  assert.throws(()=>composeDailyBoard(createDemoState(),options),ValidationError);assert.equal(executed,0);
  for(const limit of [0,4,-1,1.5,'3',null])assert.throws(()=>composeDailyBoard(createDemoState(),{now:NOW,limit}),ValidationError);
  assert.throws(()=>composeDailyBoard(createDemoState(),{now:NOW,mode:'unsafe'}),ValidationError);assert.throws(()=>composeDailyBoard(createDemoState(),{now:NOW,code:'activate candidates'}),ValidationError);
  assert.equal(composeDailyBoard(createDemoState(),{now:new Date(NOW)}).surfaceIds.length,3);
});

test('independent evaluator policy audit over 64 interventions proves board is always an immutable evaluated subset',()=>{
  for(let variant=0;variant<64;variant++){
    const state=createDemoState();if(variant&1)state.connections[0].status='disconnected';if(variant&2)state.observations[1].occurredAt='2026-10-14T16:00:00Z';if(variant&4)state.goals[2].status='candidate';if(variant&8)state.preferences.dailySurfaceBudget=0;if(variant&16)state.preferences.quietHours={start:11,end:13};if(variant&32)state.preferences.dailySurfaceBudget=1;
    const before=JSON.stringify(state),evaluated=evaluate(state,{now:NOW}).surfaces,board=composeDailyBoard(state,{now:NOW});
    assert.equal(JSON.stringify(state),before);assert(board.surfaceIds.length<=3);assert.equal(board.hiddenCount,evaluated.length-board.surfaceIds.length);
    for(const frame of frames(board)){assert.deepEqual(frame,evaluated.find(item=>item.id===frame.id));assert.equal(state.goals.find(goal=>goal.id===frame.goalId).status,'active');for(const id of frame.evidenceRefs){const source=state.observations.find(item=>item.id===id);assert.equal(source.tenantId,state.tenantId);assert(Date.parse(source.occurredAt)<=Date.parse(NOW));assert.equal(state.connections.find(connection=>connection.id===source.connectorId).status,'connected');}}
  }
});
