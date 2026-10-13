import { finiteNumber, isDate, isId, isRecord, isText, stableHash } from '../../shared/validation.mjs';

export const LOCAL_PLAN_DECLARATIONS = Object.freeze({
  'open-evidence': { kind: 'mail.commitment', ruleId: 'overdue-commitment', actionId: 'review' },
  'draft-reply': { kind: 'mail.commitment', ruleId: 'overdue-commitment', actionId: 'draft' },
  'plan-focus': { kind: 'calendar.availability', ruleId: 'focus-opportunity', actionId: 'plan' },
  'reflect-sleep': { kind: 'health.sleep', ruleId: 'sleep-reflection', actionId: 'reflect' },
  'draft-catchup': { kind: 'relationship.contact', ruleId: 'relationship-catchup', actionId: 'catchup' },
  'plan-step': { kind: 'metric.update', ruleId: 'metric-checkin', actionId: 'step' }
});
export const isMeasurementObservation = (observation) => observation && ['metric.update', 'health.sleep'].includes(observation.kind);
function only(value, allowed, path, issues) {
  if (!isRecord(value)) { issues.push(`${path}: object required`); return false; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`${path}.${key}: unknown authority or snapshot field`);
  return true;
}
function refs(value, path, issues, limit = 20) {
  if (!Array.isArray(value) || value.length > limit || value.some(id => !isId(id)) || new Set(value).size !== value.length) issues.push(`${path}: distinct bounded identifiers required`);
}
export function measurementIssues(value, path = 'baseline') {
  const issues = [];
  if (!only(value, ['observationId','key','value','unit','direction','target','observedAt','unitSource'], path, issues)) return issues;
  if (!isId(value.observationId) || !isId(value.key) || !finiteNumber(value.value) || !finiteNumber(value.target)
    || !isText(value.unit, 80) || !['increase','decrease'].includes(value.direction) || !isDate(value.observedAt) || value.unitSource !== 'goal-declared') issues.push(`${path}: exact source measurement and declared metric contract required`);
  return issues;
}

export function extensionIssues(state, { allowDangling = false } = {}) {
  const issues = [], goals = new Map(state.goals.map(goal => [goal?.id,goal])), observations = new Map(state.observations.map(item => [item?.id,item]));
  const entities = new Map(), plans = new Map(), receipts = new Set();
  for (const key of ['contextEntities','plans','outcomes','gapFeedback','contextCorrections']) {
    if (state[key] !== undefined && (!Array.isArray(state[key]) || state[key].length > 100)) issues.push(`${key}: at most 100 entries required`);
  }
  if (Array.isArray(state.contextEntities)) state.contextEntities.forEach((entity,i) => {
    const path=`contextEntities[${i}]`;
    if (!only(entity,['id','tenantId','kind','label','goalIds'],path,issues)) return;
    if (!isId(entity.id) || entities.has(entity.id)) issues.push(`${path}.id: unique identifier required`);
    if (entity.tenantId!==state.tenantId) issues.push(`${path}.tenantId: tenant mismatch`);
    if (!['person','project'].includes(entity.kind) || !isText(entity.label,160)) issues.push(`${path}: person/project kind and short label required`);
    refs(entity.goalIds,`${path}.goalIds`,issues);
    if (Array.isArray(entity.goalIds)&&!allowDangling) for(const id of entity.goalIds) if(!goals.has(id))issues.push(`${path}.goalIds: unknown goal`);
    entities.set(entity.id,entity);
  });
  state.observations.forEach((observation,i) => {
    const links=observation?.data?.entityIds;
    if (links!==undefined) {
      refs(links,`observations[${i}].data.entityIds`,issues);
      if(Array.isArray(links)&&!allowDangling) for(const id of links)if(!entities.has(id))issues.push(`observations[${i}].data.entityIds: unknown entity`);
    }
  });
  if (Array.isArray(state.plans)) state.plans.forEach((plan,i) => {
    const path=`plans[${i}]`;
    if(!only(plan,['id','tenantId','surfaceId','goalId','actionId','intent','text','focusMinutes','requestedMinutes','status','createdAt','evidenceRefs','baseline','contextSnapshot'],path,issues))return;
    if(!isId(plan.id)||plans.has(plan.id))issues.push(`${path}.id: unique identifier required`);
    if(plan.tenantId!==state.tenantId)issues.push(`${path}.tenantId: tenant mismatch`);
    for(const key of ['surfaceId','goalId','actionId'])if(!isId(plan[key]))issues.push(`${path}.${key}: identifier required`);
    if(!goals.has(plan.goalId)&&!allowDangling)issues.push(`${path}.goalId: unknown goal`);
    if(!Object.hasOwn(LOCAL_PLAN_DECLARATIONS,plan.intent)||plan.status!=='draft'||!isText(plan.text,4000)||!isDate(plan.createdAt))issues.push(`${path}: declared local intent, draft status, bounded text and createdAt required`);
    refs(plan.evidenceRefs,`${path}.evidenceRefs`,issues,30);
    if(!plan.evidenceRefs?.length)issues.push(`${path}.evidenceRefs: evidence required`);
    if(Array.isArray(plan.evidenceRefs)&&!allowDangling)for(const id of plan.evidenceRefs)if(!observations.has(id))issues.push(`${path}.evidenceRefs: unknown source`);
    if(plan.focusMinutes!==undefined&&(!Number.isInteger(plan.focusMinutes)||plan.focusMinutes<5||plan.intent!=='plan-focus'))issues.push(`${path}.focusMinutes: focus draft minutes required`);
    if(plan.requestedMinutes!==undefined&&(!Number.isInteger(plan.requestedMinutes)||plan.requestedMinutes<5||plan.requestedMinutes>1440||plan.intent!=='plan-focus'
      ||plan.focusMinutes!==undefined&&plan.focusMinutes>plan.requestedMinutes))issues.push(`${path}.requestedMinutes: declared focus limit 5 to 1440 required`);
    if(plan.baseline!==undefined) {
      issues.push(...measurementIssues(plan.baseline,`${path}.baseline`));
      if(isRecord(plan.baseline)) {
        const source=observations.get(plan.baseline.observationId);
        if(!allowDangling&&(!isMeasurementObservation(source)||!source.goalIds.includes(plan.goalId)||source.metrics?.[plan.baseline.key]!==plan.baseline.value||source.occurredAt!==plan.baseline.observedAt))issues.push(`${path}.baseline: snapshot must match the exact goal-linked source`);
        if(Date.parse(plan.baseline.observedAt)>Date.parse(plan.createdAt))issues.push(`${path}.baseline: source must precede draft`);
      }
    }
    if(plan.contextSnapshot!==undefined&&only(plan.contextSnapshot,['entityIds'],`${path}.contextSnapshot`,issues)) {
      refs(plan.contextSnapshot.entityIds,`${path}.contextSnapshot.entityIds`,issues);
      if(Array.isArray(plan.contextSnapshot.entityIds)&&!allowDangling)for(const id of plan.contextSnapshot.entityIds)if(!entities.has(id))issues.push(`${path}.contextSnapshot: unknown entity`);
    }
    plans.set(plan.id,plan);
  });
  if(Array.isArray(state.outcomes))state.outcomes.forEach((outcome,i)=>{
    const path=`outcomes[${i}]`;
    if(!only(outcome,['id','tenantId','planId','at','kind','note','effortMinutes','usefulness','measurementObservationId','attribution'],path,issues))return;
    if(!isId(outcome.id)||!isId(outcome.planId)||receipts.has(outcome.planId))issues.push(`${path}: one identified receipt per plan required`);
    if(outcome.tenantId!==state.tenantId)issues.push(`${path}.tenantId: tenant mismatch`);
    if(!isDate(outcome.at)||outcome.kind!=='user-report'||outcome.attribution!=='not-established'||!['useful','not-useful','unknown'].includes(outcome.usefulness))issues.push(`${path}: dated user report and unknown attribution required`);
    if(outcome.note!==undefined&&!isText(outcome.note,2000))issues.push(`${path}.note: bounded text required`);
    if(outcome.effortMinutes!==undefined&&(!finiteNumber(outcome.effortMinutes)||outcome.effortMinutes<0||outcome.effortMinutes>1440))issues.push(`${path}.effortMinutes: finite 0 to 1440 required`);
    const plan=plans.get(outcome.planId);
    if(!plan&&!allowDangling)issues.push(`${path}.planId: unknown draft`);
    if(plan&&Date.parse(outcome.at)<Date.parse(plan.createdAt))issues.push(`${path}.at: report cannot precede draft`);
    if(outcome.measurementObservationId!==undefined) {
      if(!isId(outcome.measurementObservationId))issues.push(`${path}.measurementObservationId: identifier required`);
      const source=observations.get(outcome.measurementObservationId);
      if(!allowDangling&&(!isMeasurementObservation(source)||plan&&!source.goalIds.includes(plan.goalId)))issues.push(`${path}.measurementObservationId: exact goal-linked actual source required`);
      if(source&&plan&&(source.id===plan.baseline?.observationId||Date.parse(source.occurredAt)<Date.parse(plan.createdAt)||Date.parse(source.occurredAt)>Date.parse(outcome.at)
        ||plan.baseline&&Date.parse(source.occurredAt)<=Date.parse(plan.baseline.observedAt)))issues.push(`${path}: measurement must be a distinct chronological later source`);
    }
    receipts.add(outcome.planId);
  });
  if(Array.isArray(state.gapFeedback))state.gapFeedback.forEach((receipt,i)=>{
    const path=`gapFeedback[${i}]`;
    if(!only(receipt,['gapId','kind','at','until','tenantId','goalId'],path,issues))return;
    if(!isId(receipt.gapId)||!isId(receipt.goalId)||!goals.has(receipt.goalId)&&!allowDangling||receipt.tenantId!==state.tenantId||!isDate(receipt.at)||!['pause','snooze'].includes(receipt.kind))issues.push(`${path}: exact tenant, known goal and dated pause/snooze required`);
    if(receipt.kind==='snooze'&&(!isDate(receipt.until)||Date.parse(receipt.until)<=Date.parse(receipt.at)||Date.parse(receipt.until)-Date.parse(receipt.at)>7*86400000))issues.push(`${path}.until: after at and at most seven days required`);
    if(receipt.kind==='pause'&&receipt.until!==undefined)issues.push(`${path}.until: pause has no expiration field`);
  });
  if(Array.isArray(state.contextCorrections))state.contextCorrections.forEach((receipt,i)=>{
    const path=`contextCorrections[${i}]`;
    if(!only(receipt,['id','tenantId','goalId','observationId','fields','at','sourceFingerprint'],path,issues))return;
    if(!isId(receipt.id)||!isId(receipt.goalId)||!isId(receipt.observationId)||receipt.tenantId!==state.tenantId||!isDate(receipt.at)
      ||typeof receipt.sourceFingerprint!=='string'||!/^source-[a-f0-9]{16}$/.test(receipt.sourceFingerprint))issues.push(`${path}: exact source/goal/tenant correction identity required`);
    if(!allowDangling&&(!goals.has(receipt.goalId)||!observations.has(receipt.observationId)))issues.push(`${path}: known goal and source required`);
    if(!only(receipt.fields,['dueAt','completed'],`${path}.fields`,issues)||!Object.keys(receipt.fields||{}).length)issues.push(`${path}.fields: missing typed fields required`);
    else for(const [field,value] of Object.entries(receipt.fields))if(field==='dueAt'?!isDate(value):typeof value!=='boolean')issues.push(`${path}.fields: ISO dueAt and boolean completed only`);
    const source=observations.get(receipt.observationId);
    if(source&&receipt.sourceFingerprint===`source-${stableHash(source)}`) {
      if(source.kind!=='mail.commitment'||!source.goalIds.includes(receipt.goalId))issues.push(`${path}: correction must target a goal-linked commitment`);
      if(isRecord(receipt.fields))for(const field of Object.keys(receipt.fields))if(source.data?.[field]!==undefined)issues.push(`${path}: existing original facts cannot be corrected`);
    }
  });
  return issues;
}
