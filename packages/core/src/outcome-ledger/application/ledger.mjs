import { validateState } from '../../state.mjs';
import { assertValid, cloneJson, isId, isRecord, jsonIssues, stableHash, ValidationError } from '../../shared/validation.mjs';
import { nowDate } from '../../shared/time.mjs';
import { observationDecision, connectionDecision } from '../../action-policy/application/evaluate-consent.mjs';
import { OBSERVATION_POLICIES } from '../../action-policy/domain/capabilities.mjs';
import { extensionIssues, isMeasurementObservation, LOCAL_PLAN_DECLARATIONS } from '../../shared-context/domain/extensions.mjs';
import { measurementFrom } from '../../shared-context/application/context.mjs';
import { contextSourceFingerprint, projectContextCorrections } from '../../shared-context/application/corrections.mjs';

function planDecision(state,plan,now) {
  if(!plan||plan.tenantId!==state.tenantId||Date.parse(plan.createdAt)>now.getTime())return {allowed:false,reason:'future-or-foreign-draft'};
  const declaration=LOCAL_PLAN_DECLARATIONS[plan.intent];
  if(!declaration||plan.actionId!==declaration.actionId)return {allowed:false,reason:'undeclared-local-action'};
  const expected=`sf-${stableHash({tenantId:state.tenantId,goalId:plan.goalId,ruleId:declaration.ruleId,evidenceRefs:[...plan.evidenceRefs].sort()})}`;
  if(plan.surfaceId!==expected)return {allowed:false,reason:'forged-draft-grounding'};
  for(const ref of [...plan.evidenceRefs,...(plan.baseline?[plan.baseline.observationId]:[])]) {
    const observation=state.observations.find(item=>item.id===ref);
    if(!observation)return {allowed:false,reason:'missing-source'};
    const decision=observationDecision(state,observation,now);
    if(!decision.allowed)return decision;
    if(!observation.goalIds.includes(plan.goalId))return {allowed:false,reason:'unmapped-draft-source'};
    if(plan.evidenceRefs.includes(ref)&&observation.kind!==declaration.kind)return {allowed:false,reason:'undeclared-draft-source'};
    if(plan.evidenceRefs.includes(ref)&&Date.parse(observation.occurredAt)>Date.parse(plan.createdAt))return {allowed:false,reason:'source-after-draft'};
    const original=projectContextCorrections(state,observation,new Date(plan.createdAt));
    if(plan.evidenceRefs.includes(ref)&&original.kind==='mail.commitment'&&(!original.data?.dueAt||original.data?.completed!==false||Date.parse(original.data.dueAt)>=Date.parse(plan.createdAt)))return {allowed:false,reason:'unknown-original-commitment'};
    if(plan.evidenceRefs.includes(ref)&&original.kind==='calendar.availability'&&original.data?.available!==true)return {allowed:false,reason:'unconfirmed-original-window'};
  }
  if(plan.focusMinutes!==undefined||plan.requestedMinutes!==undefined) {
    const slot=state.observations.find(item=>item.id===plan.evidenceRefs[0]);
    const available=Math.floor((Date.parse(slot?.data?.endsAt)-Math.max(Date.parse(plan.createdAt),Date.parse(slot?.data?.startsAt)))/60000);
    if(!Number.isFinite(available)||plan.focusMinutes>available||plan.requestedMinutes>available)return {allowed:false,reason:'focus-draft-outside-window'};
  }
  return {allowed:true,reason:'declared-local-draft'};
}
function receiptDecision(state,receipt,plan,now) {
  if(Date.parse(receipt.at)>now.getTime())return {allowed:false,reason:'future-outcome'};
  if(receipt.measurementObservationId) {
    const source=state.observations.find(item=>item.id===receipt.measurementObservationId);
    if(!source)return {allowed:false,reason:'missing-outcome-source'};
    return observationDecision(state,source,now);
  }
  return {allowed:true,reason:'user-report'};
}

export function recordPlanOutcome(state,input,{now}={}) {
  assertValid(validateState(state));const issues=jsonIssues(input,'outcome');if(issues.length)throw new ValidationError(issues);
  if(!isRecord(input)||Object.keys(input).some(key=>!['planId','note','effortMinutes','usefulness','measurementObservationId'].includes(key))||!isId(input.planId))throw new ValidationError(['outcome: exact local report fields required']);
  const at=nowDate(now),plan=(state.plans||[]).find(item=>item.id===input.planId);
  const decision=planDecision(state,plan,at);if(!decision.allowed)throw new ValidationError([`outcome: ${decision.reason}`]);
  if(input.measurementObservationId) {
    const measurement=state.observations.find(item=>item.id===input.measurementObservationId);
    if(!isMeasurementObservation(measurement)||!observationDecision(state,measurement,at).allowed)throw new ValidationError(['outcome: current actual measurement required']);
  }
  const next=cloneJson(state);next.outcomes||=[];
  const receipt={id:`outcome-${stableHash({tenantId:state.tenantId,planId:plan.id})}`,tenantId:state.tenantId,planId:plan.id,at:at.toISOString(),kind:'user-report',
    ...(input.note!==undefined?{note:input.note}:{}),...(input.effortMinutes!==undefined?{effortMinutes:input.effortMinutes}:{}),
    usefulness:input.usefulness||'unknown',...(input.measurementObservationId!==undefined?{measurementObservationId:input.measurementObservationId}:{}),attribution:'not-established'};
  const index=next.outcomes.findIndex(item=>item.planId===plan.id);
  if(index>=0&&Date.parse(next.outcomes[index].at)>at.getTime())throw new ValidationError(['outcome: retroactive report cannot replace a later report']);
  if(index<0)next.outcomes.push(receipt);else next.outcomes[index]=receipt;
  assertValid(validateState(next));return next;
}

export function buildOutcomeLedger(state,{now}={}) {
  assertValid(validateState(state));const at=nowDate(now),entries=[],withheld=[];
  for(const plan of state.plans||[]) {
    const decision=planDecision(state,plan,at);
    if(!decision.allowed){withheld.push({planId:plan.id,reason:decision.reason});continue;}
    const goal=state.goals.find(item=>item.id===plan.goalId);
    const receipt=(state.outcomes||[]).find(item=>item.planId===plan.id);
    let outcome;
    if(receipt) {
      const valid=receiptDecision(state,receipt,plan,at);
      if(valid.allowed)outcome=receipt;else withheld.push({planId:plan.id,reason:valid.reason});
    }
    const baseline=plan.baseline?cloneJson(plan.baseline):null;
    const observed=outcome?.measurementObservationId?state.observations.find(item=>item.id===outcome.measurementObservationId):null;
    const latest=observed?measurementFrom(goal,observed):null;
    const comparable=Boolean(baseline&&latest&&baseline.observationId!==latest.observationId&&Date.parse(latest.observedAt)>Date.parse(baseline.observedAt)
      &&baseline.key===latest.key&&baseline.unit===latest.unit&&baseline.direction===latest.direction&&baseline.target===latest.target);
    const candidateDelta=comparable?latest.value-baseline.value:null;
    const delta=Number.isFinite(candidateDelta)?candidateDelta:null;
    entries.push({planId:plan.id,goalId:plan.goalId,status:latest?'measured':outcome?'reported':'draft',draft:cloneJson(plan),evidenceRefs:[...plan.evidenceRefs],
      ...(outcome?{outcome:cloneJson(outcome)}:{}),baseline,latest,delta,
      comparison:delta!==null?'matching-goal-declarations':outcome?.measurementObservationId?'incomparable':'no-later-measurement',attribution:'not-established'});
  }
  // Counts describe unique drafts/reports, never success rankings or causal effect.
  return {tenantId:state.tenantId,at:at.toISOString(),entries,withheld,stats:{drafts:entries.length,reported:entries.filter(entry=>entry.outcome).length,
    measured:new Set(entries.filter(entry=>entry.latest).map(entry=>entry.latest.observationId)).size,
    comparable:new Set(entries.filter(entry=>entry.delta!==null).map(entry=>`${entry.baseline.observationId}|${entry.latest.observationId}|${entry.baseline.key}|${entry.baseline.unit}|${entry.baseline.direction}|${entry.baseline.target}`)).size,attribution:'not-established'}};
}

/** Immutable purge after source/goal changes; intentionally tolerates dangling derived refs. */
export function pruneContextData(state,{now}={}) {
  const issues=jsonIssues(state);if(issues.length)throw new ValidationError(issues);
  if(!isRecord(state))throw new ValidationError(['state: object required']);
  const next=cloneJson(state),base=cloneJson(state);
  for(const key of ['contextEntities','plans','outcomes','gapFeedback','contextCorrections'])delete base[key];
  for(const observation of base.observations||[])if(observation?.data)delete observation.data.entityIds;
  assertValid(validateState(base));
  const shapeIssues=extensionIssues(next,{allowDangling:true});if(shapeIssues.length)throw new ValidationError(shapeIssues);
  const at=nowDate(now),goalIds=new Set(next.goals.map(goal=>goal.id));
  const retainable=observation=>observation&&connectionDecision(next,observation.connectorId,OBSERVATION_POLICIES[observation.kind].scope,at).allowed;
  next.observations=next.observations.filter(retainable);
  if(next.contextEntities)next.contextEntities=next.contextEntities.map(entity=>({...entity,goalIds:entity.goalIds.filter(id=>goalIds.has(id))}));
  const entityIds=new Set((next.contextEntities||[]).map(entity=>entity.id)),observationIds=new Set(next.observations.map(item=>item.id));
  for(const observation of next.observations)if(observation.data?.entityIds)observation.data.entityIds=observation.data.entityIds.filter(id=>entityIds.has(id));
  if(next.plans)next.plans=next.plans.filter(plan=>goalIds.has(plan.goalId)&&[...plan.evidenceRefs,...(plan.baseline?[plan.baseline.observationId]:[])].every(id=>observationIds.has(id)))
    .map(plan=>({...plan,...(plan.contextSnapshot?{contextSnapshot:{entityIds:plan.contextSnapshot.entityIds.filter(id=>entityIds.has(id))}}:{})}));
  const planIds=new Set((next.plans||[]).map(plan=>plan.id));
  if(next.outcomes)next.outcomes=next.outcomes.filter(receipt=>planIds.has(receipt.planId)&&(!receipt.measurementObservationId||observationIds.has(receipt.measurementObservationId)));
  if(next.gapFeedback)next.gapFeedback=next.gapFeedback.filter(receipt=>goalIds.has(receipt.goalId));
  if(next.contextCorrections)next.contextCorrections=next.contextCorrections.filter(receipt=>goalIds.has(receipt.goalId)&&observationIds.has(receipt.observationId)
    &&receipt.sourceFingerprint===contextSourceFingerprint(next.observations.find(observation=>observation.id===receipt.observationId)));
  assertValid(validateState(next));return next;
}
