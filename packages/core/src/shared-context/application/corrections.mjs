import { validateState } from '../../state.mjs';
import { assertValid, cloneJson, isDate, isId, isRecord, jsonIssues, stableHash, ValidationError } from '../../shared/validation.mjs';
import { nowDate } from '../../shared/time.mjs';
import { observationDecision } from '../../action-policy/application/evaluate-consent.mjs';

export const contextSourceFingerprint=observation=>`source-${stableHash(observation)}`;

/** Internal validated projection; original source is never changed. */
export function projectContextCorrections(state,observation,at) {
  const result=cloneJson(observation);
  if(!observationDecision(state,observation,at).allowed)return result;
  const fingerprint=contextSourceFingerprint(observation);
  const records=(state.contextCorrections||[]).filter(record=>record.tenantId===state.tenantId&&record.observationId===observation.id
    &&observation.goalIds.includes(record.goalId)&&record.sourceFingerprint===fingerprint&&Date.parse(record.at)<=at.getTime())
    .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id));
  for(const record of records)for(const [field,value] of Object.entries(record.fields)) {
    if(observation.data?.[field]===undefined){result.data||={};result.data[field]=value;}
  }
  return result;
}
export function effectiveObservation(state,observation,{now}={}) {
  assertValid(validateState(state));const issues=jsonIssues(observation,'observation');if(issues.length)throw new ValidationError(issues);
  const original=state.observations.find(item=>item.id===observation?.id);
  if(!original||contextSourceFingerprint(original)!==contextSourceFingerprint(observation))throw new ValidationError(['observation: exact original source required']);
  return projectContextCorrections(state,original,nowDate(now));
}
export function recordContextCorrection(state,input,{now}={}) {
  assertValid(validateState(state));const issues=jsonIssues(input,'correction');if(issues.length)throw new ValidationError(issues);
  if(!isRecord(input)||Object.keys(input).some(key=>!['goalId','observationId','fields'].includes(key))||!isId(input.goalId)||!isId(input.observationId)||!isRecord(input.fields)
    ||Object.keys(input.fields).length<1||Object.keys(input.fields).some(key=>!['dueAt','completed'].includes(key)))throw new ValidationError(['correction: exact missing commitment fields required']);
  const at=nowDate(now),observation=state.observations.find(item=>item.id===input.observationId);
  if(!observation||observation.kind!=='mail.commitment'||!observation.goalIds.includes(input.goalId)||!state.goals.some(goal=>goal.id===input.goalId&&goal.status==='active')
    ||!observationDecision(state,observation,at).allowed)throw new ValidationError(['correction: current goal-linked consented commitment required']);
  for(const [field,value] of Object.entries(input.fields)) {
    if(observation.data?.[field]!==undefined)throw new ValidationError(['correction: existing source facts cannot be overwritten']);
    if(field==='dueAt'?!isDate(value):typeof value!=='boolean')throw new ValidationError(['correction: explicit ISO dueAt or boolean completed required']);
  }
  const next=cloneJson(state);next.contextCorrections||=[];
  const sourceFingerprint=contextSourceFingerprint(observation);
  const receipt={id:`correction-${stableHash({tenantId:state.tenantId,goalId:input.goalId,observationId:observation.id,fields:input.fields,at:at.toISOString()})}`,
    tenantId:state.tenantId,goalId:input.goalId,observationId:observation.id,fields:cloneJson(input.fields),at:at.toISOString(),sourceFingerprint};
  if(!next.contextCorrections.some(record=>record.id===receipt.id))next.contextCorrections.push(receipt);
  assertValid(validateState(next));return next;
}
