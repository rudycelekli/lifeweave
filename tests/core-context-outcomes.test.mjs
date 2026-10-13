import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, DEMO_CLOCK, validateState, evaluate, ingestObservations, buildSharedContext, upsertContextEntity, capturePlanBaseline,
  recordPlanOutcome, buildOutcomeLedger, pruneContextData, effectiveObservation, recordContextCorrection, ValidationError } from '../packages/core/src/index.mjs';

const NOW=DEMO_CLOCK,LATER='2026-10-13T17:00:00.000Z',REPORT='2026-10-13T19:30:00.000Z';
const clone=value=>JSON.parse(JSON.stringify(value));
function measured(id,value,at=NOW,goalId='goal-learning',key='focusMinutes') {
  return {id,tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:at,goalIds:[goalId],summary:'Explicit measured value',metrics:{[key]:value},data:{}};
}
function draftState() {
  let state=createDemoState();state=ingestObservations(state,[measured('baseline',10,'2026-10-13T15:00:00.000Z')],{now:NOW});
  const frame=evaluate(state,{now:NOW,mode:'replay'}).surfaces.find(item=>item.ruleId==='focus-opportunity');
  const plan={id:'plan-test',tenantId:'local',surfaceId:frame.id,goalId:frame.goalId,actionId:frame.actions[0].id,intent:frame.actions[0].payload.intent,text:'User-authored local focus draft',
    focusMinutes:25,requestedMinutes:30,status:'draft',createdAt:NOW,evidenceRefs:frame.evidenceRefs,baseline:capturePlanBaseline(state,{goalId:frame.goalId},{now:NOW})};
  state.plans=[plan];assert.equal(validateState(state).valid,true);return state;
}

test('shared context is explicit, tenant-scoped, freshness-aware and independent of display gates',()=>{
  let state=createDemoState();state.preferences.dailySurfaceBudget=0;state.preferences.quietHours={start:11,end:13};
  state=upsertContextEntity(state,{id:'alex-person',tenantId:'local',kind:'person',label:'Alex',goalIds:['goal-learning']},{now:NOW});
  state=upsertContextEntity(state,{id:'alex-project',tenantId:'local',kind:'project',label:'Alex',goalIds:[]},{now:NOW});
  state.observations[1].data.entityIds=['alex-project'];state.observations[1].summary='Narrative mentions Morgan and an unrelated project; no merge permitted.';
  const context=buildSharedContext(state,{now:NOW}),goal=context.goals.find(item=>item.goal.id==='goal-learning');
  assert.equal(context.tenantId,'local');assert.equal(context.goals.length,5);assert.equal(goal.people[0].id,'alex-person');assert.equal(goal.projects[0].id,'alex-project');
  assert.equal(goal.latestMeasurement,null);assert(!context.goals.some(item=>item.goal.id==='goal-historical'));
  assert(!JSON.stringify(context).includes('morgan-person'));
  state.connections[1].status='disconnected';const revoked=buildSharedContext(state,{now:NOW}).goals.find(item=>item.goal.id==='goal-learning');
  assert.equal(revoked.evidence.length,0);assert.equal(revoked.projects.length,0);assert.equal(revoked.people.length,1); // Independent user-authored link remains.
  const stale=createDemoState();stale.observations[1].occurredAt='2026-10-01T16:00:00Z';assert.equal(buildSharedContext(stale,{now:NOW}).goals[1].evidence.length,0);
});

test('entity upserts are immutable; foreign tenants, unknown links, duplicate identities and unsafe inputs reject',()=>{
  const state=createDemoState(),before=JSON.stringify(state);
  const next=upsertContextEntity(state,{id:'person-1',tenantId:'local',kind:'person',label:'Sam',goalIds:['goal-career']},{now:NOW});
  assert.equal(JSON.stringify(state),before);assert.equal(next.contextEntities.length,1);
  for(const entity of [{id:'person-2',tenantId:'foreign',kind:'person',label:'A',goalIds:[]},{id:'person-2',tenantId:'local',kind:'person',label:'A',goalIds:['unknown']},
    {id:'person-2',tenantId:'local',kind:'person',label:'A',goalIds:[],scopes:['mail.send']}])assert.throws(()=>upsertContextEntity(next,entity,{now:NOW}),ValidationError);
  const bad=clone(next);bad.observations[0].data.entityIds=['not-known'];assert.equal(validateState(bad).valid,false);
  const same=clone(next);same.contextEntities.push(clone(same.contextEntities[0]));assert.equal(validateState(same).valid,false);
});

test('baseline captures actual source and declared units; helper rejects getters without executing them',()=>{
  const state=draftState(),baseline=state.plans[0].baseline;
  assert.deepEqual(baseline,{observationId:'baseline',key:'focusMinutes',value:10,unit:'minutes/week',direction:'increase',target:180,observedAt:'2026-10-13T15:00:00.000Z',unitSource:'goal-declared'});
  assert.equal(capturePlanBaseline(state,{goalId:'goal-finances'},{now:NOW}),null);
  let executions=0;const input={};Object.defineProperty(input,'goalId',{enumerable:true,get(){executions++;return'goal-learning';}});
  assert.throws(()=>capturePlanBaseline(state,input,{now:NOW}),ValidationError);assert.equal(executions,0);
  const forged=clone(state);forged.plans[0].baseline.value=999;assert.equal(validateState(forged).valid,false);
});

test('user reports do not mint measurements or mutate draft/goal/evidence; one receipt per plan',()=>{
  const state=draftState(),before=JSON.stringify(state),next=recordPlanOutcome(state,{planId:'plan-test',note:'I worked on it',effortMinutes:28,usefulness:'useful'},{now:REPORT});
  assert.equal(JSON.stringify(state),before);assert.deepEqual(next.goals,state.goals);assert.deepEqual(next.observations,state.observations);assert.deepEqual(next.plans,state.plans);
  const ledger=buildOutcomeLedger(next,{now:REPORT});assert.equal(ledger.entries[0].status,'reported');assert.equal(ledger.entries[0].latest,null);assert.equal(ledger.entries[0].delta,null);assert.equal(ledger.entries[0].attribution,'not-established');
  const repeated=recordPlanOutcome(next,{planId:'plan-test',usefulness:'not-useful'},{now:REPORT});assert.equal(repeated.outcomes.length,1);assert.equal(buildOutcomeLedger(repeated,{now:REPORT}).stats.reported,1);
  for(const input of [{planId:'plan-test',completedKpi:180},{planId:'plan-test',status:'completed'},{planId:'plan-test',measurement:999},{planId:'unknown'},{planId:'plan-test',tenantId:'foreign'},{planId:'plan-test',effortMinutes:-1}])assert.throws(()=>recordPlanOutcome(state,input,{now:REPORT}),ValidationError);
});

test('explicit later measurement computes descriptive delta with unknown attribution, including reverse direction',()=>{
  let state=draftState();state=ingestObservations(state,[measured('later',40,LATER)],{now:LATER});
  state=recordPlanOutcome(state,{planId:'plan-test',measurementObservationId:'later',usefulness:'useful'},{now:REPORT});
  const entry=buildOutcomeLedger(state,{now:REPORT}).entries[0];assert.equal(entry.status,'measured');assert.equal(entry.delta,30);assert.equal(entry.comparison,'matching-goal-declarations');assert.equal(entry.attribution,'not-established');
  const reverse=draftState();reverse.goals[1].metric.direction='decrease';reverse.plans[0].baseline.direction='decrease';
  reverse.observations.push(measured('lower',5,LATER));const lower=recordPlanOutcome(reverse,{planId:'plan-test',measurementObservationId:'lower'},{now:REPORT});
  assert.equal(buildOutcomeLedger(lower,{now:REPORT}).entries[0].delta,-5); // Signed source difference; no causal/success label.
});

test('unit, key, direction and target drift never reinterpret baseline or assert comparable progress',()=>{
  for(const change of [metric=>{metric.unit='hours/week';},metric=>{metric.key='studySessions';},metric=>{metric.direction='decrease';},metric=>{metric.target=999;}]){
    let state=draftState();change(state.goals[1].metric);
    state=ingestObservations(state,[measured('later',40,LATER,'goal-learning',state.goals[1].metric.key)],{now:LATER});
    state=recordPlanOutcome(state,{planId:'plan-test',measurementObservationId:'later'},{now:REPORT});
    const entry=buildOutcomeLedger(state,{now:REPORT}).entries[0];assert.equal(entry.delta,null);assert.equal(entry.comparison,'incomparable');assert.equal(entry.baseline.unit,'minutes/week');assert.equal(entry.attribution,'not-established');
  }
});

test('baseline itself, duplicate timestamps, unrelated goals and out-of-order/future measurements cannot become later outcomes',()=>{
  const state=draftState();state.observations.push(measured('same-time',10,'2026-10-13T15:00:00Z'),measured('before-plan',12,'2026-10-13T15:30:00Z'),measured('future',50,'2026-10-14T16:00:00Z'),measured('unrelated',50,LATER,'goal-finances','monthlySavings'));
  for(const id of ['baseline','same-time','before-plan','future','unrelated'])assert.throws(()=>recordPlanOutcome(state,{planId:'plan-test',measurementObservationId:id},{now:REPORT}),ValidationError);
  const reported=recordPlanOutcome(state,{planId:'plan-test'},{now:REPORT});assert.throws(()=>recordPlanOutcome(reported,{planId:'plan-test'},{now:NOW}),/retroactive/);
  const historical=buildOutcomeLedger(reported,{now:NOW});assert.equal(historical.entries[0].status,'draft');assert(historical.withheld.some(item=>item.reason==='future-outcome'));
});

test('source revocation purges baselines, later-measurement outcomes, context links and raw-derived text while preserving unrelated manual entities',()=>{
  let state=draftState();state=upsertContextEntity(state,{id:'manual-person',tenantId:'local',kind:'person',label:'Independent manual name',goalIds:['goal-learning']},{now:NOW});
  state.observations[1].data.entityIds=['manual-person'];state.plans[0].contextSnapshot={entityIds:['manual-person']};
  state=ingestObservations(state,[measured('later',40,LATER)],{now:LATER});state=recordPlanOutcome(state,{planId:'plan-test',measurementObservationId:'later',note:'Private later-source note'},{now:REPORT});
  state.connections.find(item=>item.id==='demo-manual').status='disconnected';
  assert.equal(buildOutcomeLedger(state,{now:REPORT}).entries.length,0); // Baseline is a separate protected dependency.
  const before=JSON.stringify(state),pruned=pruneContextData(state,{now:REPORT});assert.equal(JSON.stringify(state),before);
  assert.equal(pruned.plans.length,0);assert.equal(pruned.outcomes.length,0);assert(!JSON.stringify(pruned).includes('Private later-source note'));assert.equal(pruned.contextEntities[0].label,'Independent manual name');
  let distinct=draftState();distinct=ingestObservations(distinct,[measured('later',40,LATER)],{now:LATER});distinct=recordPlanOutcome(distinct,{planId:'plan-test',measurementObservationId:'later',note:'Derived measurement note'},{now:REPORT});
  distinct.observations=distinct.observations.filter(item=>item.id!=='later');const cleaned=pruneContextData(distinct,{now:REPORT});assert.equal(cleaned.plans.length,1);assert.equal(cleaned.outcomes.length,0);
});

test('duplicate plan links do not double count one actual measurement or comparison',()=>{
  let state=draftState();state.plans.push({...clone(state.plans[0]),id:'plan-two'});state=ingestObservations(state,[measured('later',40,LATER)],{now:LATER});
  for(const id of ['plan-test','plan-two'])state=recordPlanOutcome(state,{planId:id,measurementObservationId:'later'},{now:REPORT});
  const stats=buildOutcomeLedger(state,{now:REPORT}).stats;assert.equal(stats.reported,2);assert.equal(stats.measured,1);assert.equal(stats.comparable,1);assert.equal(stats.attribution,'not-established');
});

test('typed corrections project effective facts while raw source stays immutable and stale authority never applies',()=>{
  let state=createDemoState();delete state.observations[0].data.dueAt;delete state.observations[0].data.completed;const raw=JSON.stringify(state.observations[0]);
  assert(!evaluate(state,{now:NOW,mode:'replay'}).surfaces.some(item=>item.ruleId==='overdue-commitment'));
  state=recordContextCorrection(state,{goalId:'goal-career',observationId:'demo-mail-overdue',fields:{dueAt:'2026-10-12T16:00:00Z',completed:false}},{now:NOW});
  assert.equal(JSON.stringify(state.observations[0]),raw);assert.equal(effectiveObservation(state,state.observations[0],{now:NOW}).data.completed,false);
  assert(evaluate(state,{now:NOW,mode:'replay'}).surfaces.some(item=>item.ruleId==='overdue-commitment'));
  assert.equal(buildSharedContext(state,{now:NOW}).goals[0].evidence[0].data.completed,false);
  for(const fields of [{metrics:{progress:100}},{capability:'mail.send'},{completed:'yes'}])assert.throws(()=>recordContextCorrection(state,{goalId:'goal-career',observationId:'demo-mail-overdue',fields},{now:NOW}),ValidationError);
  const changed=clone(state);changed.observations[0].summary='A revised original provider record';assert.equal(effectiveObservation(changed,changed.observations[0],{now:NOW}).data.completed,undefined);assert.equal(pruneContextData(changed,{now:NOW}).contextCorrections.length,0);
  const revoked=clone(state);revoked.connections[0].status='disconnected';assert.equal(pruneContextData(revoked,{now:NOW}).contextCorrections.length,0);
});

test('optional extensions reject foreign IDs, forged snapshots, future reports, authority keys and invalid context feedback without breaking old v1',()=>{
  assert.equal(validateState(createDemoState()).valid,true);
  for(const mutate of [
    s=>{s.plans[0].tenantId='foreign';},s=>{s.plans[0].status='completed';},s=>{s.plans[0].baseline.observationId='missing';},
    s=>{s.plans[0].contextSnapshot={entityIds:['unknown']};},s=>{s.plans[0].requestedMinutes=1000;s.plans[0].focusMinutes=1001;},
    s=>{s.outcomes=[{id:'x',tenantId:'foreign',planId:'plan-test',at:REPORT,kind:'user-report',usefulness:'unknown',attribution:'not-established'}];},
    s=>{s.gapFeedback=[{gapId:'g',tenantId:'local',goalId:'goal-learning',kind:'snooze',at:NOW,until:'2026-11-01T16:00:00Z'}];}
  ]){const state=draftState();mutate(state);assert.equal(validateState(state).valid,false);}
  const forged=draftState();forged.plans[0].surfaceId='sf-forged';assert.throws(()=>recordPlanOutcome(forged,{planId:'plan-test'},{now:REPORT}),/forged/);
  const stale=draftState();assert.equal(buildOutcomeLedger(stale,{now:'2026-12-01T16:00:00Z'}).entries.length,0);
});

test('declared draft cannot consume source evidence observed only after the draft or unconfirmed calendar facts',()=>{
  const later=draftState();later.observations.find(item=>item.id==='demo-calendar-window').occurredAt=LATER;
  assert.throws(()=>recordPlanOutcome(later,{planId:'plan-test'},{now:REPORT}),/source-after-draft/);
  const unknown=draftState();delete unknown.observations.find(item=>item.id==='demo-calendar-window').data.available;
  assert.throws(()=>recordPlanOutcome(unknown,{planId:'plan-test'},{now:REPORT}),/unconfirmed-original-window/);
});

test('finite raw measurements cannot overflow a ledger delta into invented nonfinite progress',()=>{
  let state=draftState();state.observations.find(item=>item.id==='baseline').metrics.focusMinutes=-Number.MAX_VALUE;state.plans[0].baseline.value=-Number.MAX_VALUE;
  state=ingestObservations(state,[measured('later',Number.MAX_VALUE,LATER)],{now:LATER});state=recordPlanOutcome(state,{planId:'plan-test',measurementObservationId:'later'},{now:REPORT});
  const entry=buildOutcomeLedger(state,{now:REPORT}).entries[0];assert.equal(entry.delta,null);assert.equal(entry.comparison,'incomparable');assert.equal(entry.attribution,'not-established');
});
