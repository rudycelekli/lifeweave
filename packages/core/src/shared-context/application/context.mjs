import { validateState } from '../../state.mjs';
import { assertValid, cloneJson, isId, isRecord, jsonIssues, ValidationError } from '../../shared/validation.mjs';
import { nowDate } from '../../shared/time.mjs';
import { observationDecision } from '../../action-policy/application/evaluate-consent.mjs';
import { isMeasurementObservation } from '../domain/extensions.mjs';
import { projectContextCorrections } from './corrections.mjs';

export function eligibleEvidence(state, now) {
  return state.observations.filter(observation=>observationDecision(state,observation,now).allowed).map(observation=>projectContextCorrections(state,observation,now));
}
export function measurementFrom(goal, observation) {
  if(!goal?.metric||!isMeasurementObservation(observation)||!observation.goalIds.includes(goal.id)||typeof observation.metrics?.[goal.metric.key]!=='number')return null;
  return {observationId:observation.id,key:goal.metric.key,value:observation.metrics[goal.metric.key],unit:goal.metric.unit,direction:goal.metric.direction,target:goal.metric.target,observedAt:observation.occurredAt,unitSource:'goal-declared'};
}
export function capturePlanBaseline(state,input, {now}={}) {
  assertValid(validateState(state));const issues=jsonIssues(input,'baseline');if(issues.length)throw new ValidationError(issues);
  if(!isRecord(input)||Object.keys(input).some(key=>key!=='goalId')||!isId(input.goalId))throw new ValidationError(['baseline: exact goal identifier required']);
  const {goalId}=input,at=nowDate(now);
  const goal=state.goals.find(item=>item.id===goalId&&item.status==='active');
  if(!goal)return null;
  const measurements=eligibleEvidence(state,at).map(observation=>measurementFrom(goal,observation)).filter(Boolean)
    .sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)||a.observationId.localeCompare(b.observationId));
  return measurements.length?cloneJson(measurements[0]):null;
}
export function buildSharedContext(state,{now}={}) {
  assertValid(validateState(state));const at=nowDate(now),eligible=eligibleEvidence(state,at);
  const withheld=state.observations.map(observation=>({observation,decision:observationDecision(state,observation,at)})).filter(item=>!item.decision.allowed)
    .map(item=>({id:item.observation.id,reason:item.decision.reason}));
  const goals=state.goals.filter(goal=>goal.status==='active').map(goal=>{
    const evidence=eligible.filter(item=>item.goalIds.includes(goal.id));
    const linked=new Set(evidence.flatMap(item=>item.data?.entityIds||[]));
    const entities=(state.contextEntities||[]).filter(entity=>entity.goalIds.includes(goal.id)||linked.has(entity.id));
    const measurements=evidence.map(item=>measurementFrom(goal,item)).filter(Boolean).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)||a.observationId.localeCompare(b.observationId));
    return {goal:{id:goal.id,title:goal.title,dimension:goal.dimension,...(goal.metric?{metric:cloneJson(goal.metric)}:{})},evidence:cloneJson(evidence),latestMeasurement:measurements[0]||null,
      people:cloneJson(entities.filter(entity=>entity.kind==='person')),projects:cloneJson(entities.filter(entity=>entity.kind==='project'))};
  });
  return {tenantId:state.tenantId,at:at.toISOString(),goals,withheld};
}
export function upsertContextEntity(state,input,{now}={}) {
  assertValid(validateState(state));nowDate(now);
  const issues=jsonIssues(input,'entity');if(issues.length)throw new ValidationError(issues);
  if(!isRecord(input)||input.tenantId!==state.tenantId)throw new ValidationError(['entity: current tenant object required']);
  const next=cloneJson(state);next.contextEntities||=[];
  const index=next.contextEntities.findIndex(entity=>entity.id===input.id);
  if(index<0)next.contextEntities.push(cloneJson(input));else next.contextEntities[index]=cloneJson(input);
  assertValid(validateState(next));return next;
}
