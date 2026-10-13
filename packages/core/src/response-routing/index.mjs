import { validateState } from '../state.mjs';
import { evaluate } from '../proactive-planning/application/evaluate.mjs';
import { validateSurface } from '../proactive-planning/domain/surface.mjs';
import { compileIntent } from '../intent-planning/index.mjs';
import { buildSharedContext } from '../shared-context/application/context.mjs';
import { observationDecision } from '../action-policy/application/evaluate-consent.mjs';
import { assertValid, cloneJson, finiteNumber, isDate, isId, isRecord, isText, jsonIssues, stableHash, stableStringify, ValidationError } from '../shared/validation.mjs';
import { nowDate } from '../shared/time.mjs';

const KINDS = ['brief', 'answer', 'progress', 'comparison', 'focus'];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = value => value.toLowerCase().replace(/\s+/g, ' ').trim();
const eq = (a, b) => stableStringify(a) === stableStringify(b);
const refs = value => Array.isArray(value) && value.length <= 2000 && value.every(isId) && new Set(value).size === value.length;
function objectInput(value, keys, label) {
  const issues = jsonIssues(value, label);
  if (issues.length || !isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) throw new ValidationError(issues.length ? issues : [`${label}: declared JSON fields required`]);
}
function classify(request) {
  if (/\b(?:daily brief|brief me|what matters|today's brief|today brief|plan my day)\b/.test(request)) return 'brief';
  if (/\b(?:progress|how am i doing|where do i stand|measurements?|metrics?|kpis?)\b/.test(request)) return 'progress';
  if (/\b(?:compare|comparison)\b/.test(request) && /\b(?:steps?|moves?|options?|goals?)\b/.test(request)) return 'comparison';
  if (/\b(?:next step|next move|what should i do|what next|what is next|what should i focus on)\b/.test(request)) return 'answer';
  if (/\b(?:focus|study|learning|learn|minutes?|mins?|plan|work)\b/.test(request)) return 'focus';
  return null;
}
function goalMatches(state, request) {
  return state.goals.filter(goal => new RegExp(`(^|[^a-z0-9._:-])${escape(goal.id.toLowerCase())}($|[^a-z0-9._:-])`).test(request)
    || new RegExp(`(^|[^a-z0-9])${escape(normalize(goal.title))}($|[^a-z0-9])`).test(request)
    || new RegExp(`\\b${escape(goal.dimension.toLowerCase())}\\s+goals?\\b`).test(request));
}
function base(state, at, kind) {
  return { version: 1, tenantId: state.tenantId, createdAt: at.toISOString(), kind, status: 'ready',
    title: { brief: 'What matters now', answer: 'A grounded next step', progress: 'Current recorded progress', comparison: 'Compare current next steps', focus: 'A bounded focus scenario' }[kind],
    text: [], goalIds: [], evidenceRefs: [], facts: [], planner: 'deterministic-grammar-v1' };
}
function unavailable(response, reason, text) { return { ...response, status: 'unavailable', reason, text: [text] }; }
function measurementFact(context) {
  const metric = context.goal.metric, latest = context.latestMeasurement;
  return { id: `af-${stableHash({ goalId: context.goal.id, kind: 'measurement', ref: latest?.observationId || null })}`, goalId: context.goal.id,
    kind: latest ? 'measurement' : 'unknown', label: context.goal.title, value: latest?.value ?? null,
    ...(metric ? { unit: metric.unit, target: metric.target, direction: metric.direction } : {}),
    ...(latest ? { observedAt: latest.observedAt } : {}), evidenceRefs: latest ? [latest.observationId] : [] };
}
function stepFact(state, surface) {
  const goal = state.goals.find(item => item.id === surface.goalId);
  const at = Math.max(...surface.evidenceRefs.map(id => Date.parse(state.observations.find(item => item.id === id).occurredAt)));
  return { id: `af-${stableHash({ tenantId: state.tenantId, surfaceId: surface.id })}`, goalId: goal.id, kind: 'next-step', label: goal.title,
    value: surface.title, observedAt: new Date(at).toISOString(), evidenceRefs: [...surface.evidenceRefs] };
}
function progressTable(facts) {
  return { columns: ['Goal', 'Latest', 'Target', 'Unit', 'Recorded at'], rows: facts.map(fact => ({ goalId: fact.goalId, label: fact.label,
    values: [fact.label, fact.value, fact.target ?? null, fact.unit ?? 'Not declared', fact.observedAt ?? null], evidenceRefs: [...fact.evidenceRefs],
    ...(fact.observedAt ? { observedAt: fact.observedAt } : {}) })) };
}
function comparisonTable(state, surfaces) {
  return { columns: ['Goal', 'Next step', 'Why now'], rows: surfaces.map(surface => ({ goalId: surface.goalId,
    label: state.goals.find(goal => goal.id === surface.goalId)?.title || 'Unknown goal',
    values: [state.goals.find(goal => goal.id === surface.goalId)?.title || 'Unknown goal', surface.title, surface.reason], evidenceRefs: [...surface.evidenceRefs] })) };
}
function goalQuestion(state, request, kind, choices) {
  return { id: `aq-${stableHash({ tenantId: state.tenantId, request, kind, choices })}`, kind: 'goal', text: 'Which active goal do you mean?', choices };
}
function sameCurrentFrame(state, original, current, at) {
  if (!original || !current || original.id !== current.id || Date.parse(original.createdAt) > at.getTime()
    || Date.parse(original.expiresAt) <= at.getTime() || Date.parse(original.expiresAt) > Date.parse(current.expiresAt)) return false;
  const projected = frame => {
    const copy = cloneJson(frame); delete copy.createdAt; delete copy.expiresAt;
    if (frame.ruleId === 'focus-opportunity') {
      const slot = state.observations.find(item => item.id === frame.evidenceRefs[0]);
      const timeline = copy.blocks.find(block => block.type === 'timeline');
      if (!Number.isFinite(Date.parse(slot?.data?.startsAt))) return null;
      const expectedStart = new Date(Math.max(Date.parse(frame.createdAt), Date.parse(slot.data.startsAt))).toISOString();
      if (!timeline || timeline.items[0]?.at !== expectedStart) return null;
      // Only this validated projected timestamp changes with subminute clock drift.
      // Measured minutes, reason, calculator caps, slot end, references and actions remain exact.
      delete timeline.items[0].at;
    }
    return copy;
  };
  const before = projected(original), after = projected(current);
  return before !== null && after !== null && eq(before, after);
}

/** Pure deterministic request routing. No model calls, state writes, or action execution. */
export function compileAssistantResponse(state, input, { now } = {}) {
  assertValid(validateState(state)); const at = nowDate(now);
  objectInput(input, ['request', 'goalId', 'minutes', 'answer'], 'assistantRequest');
  if (!isText(input.request, 2000) || input.goalId !== undefined && !isId(input.goalId)
    || input.minutes !== undefined && (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 240)) throw new ValidationError(['assistantRequest: bounded request, goal identifier, and numeric minute limit required']);
  const request = normalize(input.request);
  const hostile = /[<>`{}]|\b(?:eval|exec|execute|javascript|permissions?|authorize|activate|delete|send|book|purchase|override|ignore|grant|revoke|shell|terminal|reschedule)\b/.test(request);
  const kind = classify(request) || 'answer', response = base(state, at, kind);
  if (hostile || !classify(request)) return unavailable({ ...response, kind: 'answer', title: 'Unsupported request' }, 'unsupported-request-grammar', 'Supported requests are a daily brief, current progress, a comparison of next steps, a next step, or a focus scenario.');
  if (kind === 'focus') {
    const intent = compileIntent(state, input, { now: at });
    Object.assign(response, intent, { input: cloneJson(input), goalIds: intent.brief.goalId ? [intent.brief.goalId] : [], evidenceRefs: [...intent.brief.evidenceRefs] });
    response.title = intent.brief.title;
    response.text = [intent.status === 'ready' ? 'This scenario uses a currently confirmed window. It is a local proposal and does not change calendar availability.'
      : intent.status === 'needs-clarification' ? intent.question.text : 'A current eligible focus window could not be established for this request.'];
    assertValid(validateAssistantResponse(response)); return response;
  }
  if (input.minutes !== undefined) return unavailable(response, 'focus-only-minute-limit', 'Minute limits apply to the supported focus scenario.');
  const matches = goalMatches(state, request), active = state.goals.filter(goal => goal.status === 'active');
  let selected = active, confirmedGoal;
  if (input.answer !== undefined) {
    objectInput(input.answer, ['questionId', 'value'], 'assistantRequest.answer');
    const { answer, ...original } = input, current = compileAssistantResponse(state, original, { now: at });
    if (current.status !== 'needs-clarification' || input.answer.questionId !== current.question.id || !current.question.choices.some(choice => choice.value === input.answer.value)) throw new ValidationError(['assistantRequest.answer: current question and exact active-goal choice required']);
    confirmedGoal = input.answer.value;
  }
  const selectedId = confirmedGoal || input.goalId;
  if (selectedId !== undefined) {
    selected = active.filter(goal => goal.id === selectedId);
    if (!selected.length || matches.length && !matches.some(goal => goal.id === selectedId)) return unavailable(response, 'active-goal-reference-required', 'Select a currently active goal that matches the request.');
  } else if (matches.some(goal => goal.status !== 'active')) return unavailable(response, 'inactive-goal-reference', 'Historical and paused goals require a separate explicit goal decision.');
  else if (matches.length > 1) {
    const choices = matches.slice(0, 10).map(goal => ({ id: goal.id, label: goal.title, value: goal.id }));
    return { ...response, status: 'needs-clarification', text: ['Choose one active goal before continuing.'], question: goalQuestion(state, request, kind, choices) };
  } else if (matches.length === 1) selected = matches;
  if (!selected.length) return unavailable(response, 'no-active-goals', 'No active goal is available. Choose a current goal before asking for grounded next steps.');
  response.goalIds = selected.map(goal => goal.id);
  if (kind === 'progress') {
    const context = buildSharedContext(state, { now: at });
    response.facts = context.goals.filter(item => response.goalIds.includes(item.goal.id)).map(measurementFact);
    response.table = progressTable(response.facts);
    response.text = ['Values are current typed source measurements. Unknown values remain unknown; units and targets come from the goal declaration. A report or handled suggestion does not establish achieved progress or causal benefit.'];
  } else {
    const surfaces = evaluate(state, { now: at, mode: 'replay' }).surfaces.filter(surface => response.goalIds.includes(surface.goalId));
    response.surfaces = surfaces.slice(0, kind === 'answer' ? 1 : 3);
    response.facts = response.surfaces.map(surface => stepFact(state, surface));
    if (!response.surfaces.length) return unavailable(response, 'no-current-eligible-next-step', 'No current consented, fresh, unsuppressed next step is established. Missing facts are unknown.');
    response.text = [kind === 'comparison' ? 'Compare these currently eligible local next steps and their recorded reasons. The evidence does not predict success or establish a universal life score.'
      : 'These next steps come from currently eligible evidence and active goals. They do not authorize external actions.'];
    if (kind === 'comparison') response.table = comparisonTable(state, response.surfaces);
  }
  response.evidenceRefs = [...new Set(response.facts.flatMap(fact => fact.evidenceRefs))].sort();
  assertValid(validateAssistantResponse(response)); return response;
}

/** Strict inert-data validation. Optional state enables current semantic grounding checks. */
export function validateAssistantResponse(response, state, { now } = {}) {
  const issues = jsonIssues(response);
  if (issues.length) return { valid: false, issues };
  const only = (value, keys, label) => { if (!isRecord(value)) { issues.push(`${label}: JSON object required`); return false; }
    for (const key of Object.keys(value)) if (!keys.includes(key)) issues.push(`${label}.${key}: unknown field`); return true; };
  if (!only(response, ['version', 'tenantId', 'createdAt', 'kind', 'status', 'title', 'text', 'goalIds', 'evidenceRefs', 'facts', 'planner', 'table', 'surfaces', 'surface', 'brief', 'question', 'input', 'reason'], 'response')) return { valid: false, issues };
  if (response.version !== 1 || !isId(response.tenantId) || !isDate(response.createdAt) || !KINDS.includes(response.kind)
    || !['ready', 'needs-clarification', 'unavailable'].includes(response.status) || response.planner !== 'deterministic-grammar-v1'
    || !isText(response.title, 400) || !Array.isArray(response.text) || response.text.length > 10 || response.text.some(text => !isText(text, 2000))
    || !refs(response.goalIds) || response.goalIds.length > 100 || !refs(response.evidenceRefs) || !Array.isArray(response.facts) || response.facts.length > 100) issues.push('response: bounded identity, kind, status, text and fact arrays required');
  if (Array.isArray(response.facts)) for (const fact of response.facts) {
    if (!only(fact, ['id', 'goalId', 'kind', 'label', 'value', 'unit', 'target', 'direction', 'observedAt', 'evidenceRefs'], 'fact')) continue;
    if (!isId(fact.id) || !isId(fact.goalId) || !['measurement', 'next-step', 'unknown'].includes(fact.kind) || !isText(fact.label, 300) || !refs(fact.evidenceRefs)
      || fact.kind === 'measurement' && (!finiteNumber(fact.value) || fact.evidenceRefs.length !== 1 || !isDate(fact.observedAt))
      || fact.kind === 'next-step' && (!isText(fact.value, 300) || !fact.evidenceRefs.length || !isDate(fact.observedAt))
      || fact.kind === 'unknown' && (fact.value !== null || fact.evidenceRefs.length || fact.observedAt !== undefined)
      || fact.unit !== undefined && !isText(fact.unit, 80) || fact.target !== undefined && !finiteNumber(fact.target)
      || fact.direction !== undefined && !['increase', 'decrease'].includes(fact.direction)) issues.push('fact: exact typed value and evidence contract required');
  }
  if (response.table !== undefined && only(response.table, ['columns', 'rows'], 'table')) {
    if (!Array.isArray(response.table.columns) || response.table.columns.length > 8 || !response.table.columns.length || response.table.columns.some(column => !isText(column, 80))
      || !Array.isArray(response.table.rows) || response.table.rows.length > 100) issues.push('table: bounded columns and rows required');
    else for (const row of response.table.rows) {
      if (!only(row, ['goalId', 'label', 'values', 'evidenceRefs', 'observedAt'], 'row')) continue;
      if (!isId(row.goalId) || !isText(row.label, 300) || !refs(row.evidenceRefs) || row.observedAt !== undefined && !isDate(row.observedAt)
        || !Array.isArray(row.values) || row.values.length !== response.table.columns.length || row.values.some(value => value !== null && !(finiteNumber(value) || typeof value === 'string' && value.length <= 1000))) issues.push('row: bounded inert typed cells required');
    }
  }
  if (response.surfaces !== undefined && (!Array.isArray(response.surfaces) || response.surfaces.length > (response.kind === 'answer' ? 1 : 3))) issues.push('surfaces: one answer or at most three brief/comparison frames required');
  for (const surface of [...(Array.isArray(response.surfaces) ? response.surfaces : []), ...(response.surface ? [response.surface] : [])]) issues.push(...validateSurface(surface).issues);
  if (response.question !== undefined && only(response.question, ['id', 'kind', 'text', 'choices'], 'question')) {
    if (!isId(response.question.id) || !['goal', 'minutes'].includes(response.question.kind) || !isText(response.question.text, 1000)
      || !Array.isArray(response.question.choices) || !response.question.choices.length || response.question.choices.length > 10) issues.push('question: bounded explicit choices required');
    else for (const choice of response.question.choices) if (!only(choice, ['id', 'label', 'value'], 'choice') || !isId(choice.id) || !isText(choice.label, 300)
      || !(response.question.kind === 'goal' ? typeof choice.value === 'string' && isId(choice.value) && choice.id === choice.value
        : Number.isInteger(choice.value) && choice.value >= 5 && choice.value <= 240)) issues.push('choice: typed scoped goal or minutes required');
  }
  if (response.brief !== undefined && only(response.brief, ['goalId', 'title', 'minutes', 'constraints', 'evidenceRefs'], 'brief')) {
    if (response.brief.goalId !== undefined && !isId(response.brief.goalId) || !isText(response.brief.title, 400)
      || response.brief.minutes !== undefined && (!Number.isInteger(response.brief.minutes) || response.brief.minutes < 5 || response.brief.minutes > 240)
      || !Array.isArray(response.brief.constraints) || response.brief.constraints.length > 20 || response.brief.constraints.some(value => !isText(value, 300)) || !refs(response.brief.evidenceRefs)) issues.push('brief: bounded focus contract required');
  }
  if (response.input !== undefined) {
    if (only(response.input, ['request', 'goalId', 'minutes', 'answer'], 'input') && (!isText(response.input.request, 2000)
      || response.input.goalId !== undefined && !isId(response.input.goalId) || response.input.minutes !== undefined && (!Number.isInteger(response.input.minutes) || response.input.minutes < 5 || response.input.minutes > 240))) issues.push('input: exact bounded original request required');
    if (isRecord(response.input) && response.input.answer !== undefined && only(response.input.answer, ['questionId', 'value'], 'input.answer') && (!isId(response.input.answer.questionId)
      || !(typeof response.input.answer.value === 'string' && isId(response.input.answer.value) || Number.isInteger(response.input.answer.value) && response.input.answer.value >= 5 && response.input.answer.value <= 240))) issues.push('input.answer: bounded typed answer required');
  }
  if (response.reason !== undefined && !isText(response.reason, 120)) issues.push('reason: bounded text required');
  if (issues.length) return { valid: false, issues };
  const referenced = [...new Set([...(response.facts || []).flatMap(fact => fact.evidenceRefs || []),
    ...(response.surfaces || []).flatMap(surface => surface.evidenceRefs || []), ...(response.surface?.evidenceRefs || []), ...(response.brief?.evidenceRefs || [])])].sort();
  if (!eq(referenced, [...response.evidenceRefs].sort())) issues.push('response.evidenceRefs: exact visible fact and frame references required');
  if (response.status === 'needs-clarification' && !response.question || response.status !== 'needs-clarification' && response.question !== undefined
    || response.status !== 'ready' && (response.surface !== undefined || response.surfaces?.length || response.facts?.length || response.table !== undefined)) issues.push('response: status and presentation must agree');
  if (response.kind === 'focus' && (!response.input || !response.brief || response.status === 'ready' && !response.surface)
    || response.kind !== 'focus' && (response.input !== undefined || response.brief !== undefined || response.surface !== undefined)) issues.push('response: focus representation must remain distinct');
  if (issues.length || state === undefined) return { valid: issues.length === 0, issues };
  const stateCheck = validateState(state); if (!stateCheck.valid) return { valid: false, issues: stateCheck.issues };
  let at; try { at = nowDate(now); } catch (error) { return { valid: false, issues: error.issues || ['invalid clock'] }; }
  if (response.tenantId !== state.tenantId || Date.parse(response.createdAt) > at.getTime()) issues.push('response: current tenant and nonfuture response required');
  const active = state.goals.filter(goal => goal.status === 'active');
  if (response.goalIds.some(id => !active.some(goal => goal.id === id))) issues.push('response.goalIds: current active goal required');
  if (response.question?.kind === 'goal' && response.question.choices.some(choice => !active.some(goal => goal.id === choice.value
    && choice.id === goal.id && choice.label === goal.title))) issues.push('question: exact current active-goal identity and label required');
  const context = buildSharedContext(state, { now: at }), current = evaluate(state, { now: at, mode: 'replay' }).surfaces;
  for (const ref of response.evidenceRefs) if (!state.observations.some(record => record.id === ref && observationDecision(state, record, at).allowed)) issues.push('response.evidenceRefs: current consented source required');
  for (const fact of response.facts) {
    if (!response.goalIds.includes(fact.goalId)) issues.push('fact: response goal scope mismatch');
    if (fact.kind === 'measurement' || fact.kind === 'unknown') {
      const goalContext = context.goals.find(item => item.goal.id === fact.goalId);
      if (!goalContext || !eq(fact, measurementFact(goalContext))) issues.push('fact: typed measurement or unknown must match current goal declarations and source');
    } else if (!current.some(surface => eq(fact, stepFact(state, surface)))) issues.push('fact: current eligible next step required');
  }
  if (response.kind === 'progress' && response.table && !eq(response.table, progressTable(response.facts))) issues.push('table: cells must match progress facts');
  if (response.surfaces) for (const surface of response.surfaces) if (!current.some(item => sameCurrentFrame(state, surface, item, at))) issues.push('surface: current eligible exact frame required');
  if (response.kind === 'comparison' && response.table && !eq(response.table, comparisonTable(state, response.surfaces || []))) issues.push('table: cells must match eligible next steps');
  if (response.kind === 'focus') {
    try {
      const intent = compileIntent(state, response.input, { now: at });
      if (intent.status !== response.status || !eq(intent.brief, response.brief)
        || response.status === 'ready' && !sameCurrentFrame(state, response.surface, intent.surface, at)
        || !eq(intent.question, response.question)) issues.push('focus: current exact intent grounding required');
    } catch { issues.push('focus: original request can no longer be grounded'); }
  }
  return { valid: issues.length === 0, issues };
}
