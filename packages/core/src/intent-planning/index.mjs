import { validateState } from '../state.mjs';
import { evaluate } from '../proactive-planning/application/evaluate.mjs';
import { validateSurface } from '../proactive-planning/domain/surface.mjs';
import { observationDecision } from '../action-policy/application/evaluate-consent.mjs';
import { OBSERVATION_POLICIES } from '../action-policy/domain/capabilities.mjs';
import { effectiveObservation, contextSourceFingerprint } from '../shared-context/application/corrections.mjs';
import { assertValid, cloneJson, isDate, isId, isRecord, isText, jsonIssues, stableHash, ValidationError } from '../shared/validation.mjs';
import { DAY, nowDate } from '../shared/time.mjs';

const MIN_MINUTES = 5, MAX_MINUTES = 240;
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normal = text => text.toLowerCase().replace(/[\s]+/g, ' ').trim();
const immutableConstraints = ['explicit-user-request', 'active-goal-required', 'current-consented-evidence', 'scenario-only', 'no-external-authority'];

function inputObject(input, keys, label) {
  const issues = jsonIssues(input, label);
  if (issues.length) throw new ValidationError(issues);
  if (!isRecord(input) || Object.keys(input).some(key => !keys.includes(key))) throw new ValidationError([`${label}: bounded fields required`]);
}
function stateAndClock(state, now) { assertValid(validateState(state)); return nowDate(now); }
function boundedMinutes(minutes) { return Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES; }
function makeBrief(goal, minutes) {
  return { ...(goal ? { goalId: goal.id } : {}), title: goal ? `Focus on ${goal.title}` : 'Choose a focus goal',
    ...(minutes !== undefined ? { minutes } : {}), constraints: [...immutableConstraints], evidenceRefs: [] };
}
function unavailable(brief, reason) { return { status: 'unavailable', brief, reason }; }
function question(brief, kind, text, choices, identity) {
  return { status: 'needs-clarification', brief, question: { id: `iq-${stableHash({ identity, kind, text, choices })}`, kind, text, choices } };
}
function explicitGoalMatches(state, request) {
  const text = normal(request);
  return state.goals.filter(goal => {
    const id = new RegExp(`(^|[^a-z0-9._:-])${escape(goal.id.toLowerCase())}($|[^a-z0-9._:-])`);
    const title = new RegExp(`(^|[^a-z0-9])${escape(normal(goal.title))}($|[^a-z0-9])`);
    const dimension = new RegExp(`\\b${escape(goal.dimension.toLowerCase())}\\s+(?:goal|objective)\\b`);
    return id.test(text) || title.test(text) || dimension.test(text);
  });
}

/** Deliberately small grammar: explicit focus request + active goal + numeric minutes.
 * Optional answer resolves only a freshly re-derived question and exact choice.
 * Carry the selected goalId when the result asks a second time-limit question.
 * Request text cannot confirm calendar availability, consent, facts, or action rights. */
export function compileIntent(state, input, { now } = {}) {
  const at = stateAndClock(state, now);
  inputObject(input, ['request', 'goalId', 'minutes', 'answer'], 'intent');
  const { answer, ...baseInput } = input;
  if (answer === undefined) return compileIntentInternal(state, baseInput, { now: at });
  inputObject(answer, ['questionId', 'value'], 'intent.answer');
  if (!isId(answer.questionId) || !['string', 'number'].includes(typeof answer.value)) throw new ValidationError(['intent.answer: questionId and typed choice required']);
  // Re-derive against current facts. A past question, another tenant's question,
  // or a choice absent from this exact question cannot establish intent.
  const current = compileIntentInternal(state, baseInput, { now: at });
  if (current.status !== 'needs-clarification' || current.question.id !== answer.questionId
    || !current.question.choices.some(choice => choice.value === answer.value)) throw new ValidationError(['intent.answer: current exact question and choice required']);
  if (current.question.kind === 'goal') return compileIntentInternal(state, { ...baseInput, goalId: answer.value }, { now: at });
  return compileIntentInternal(state, { ...baseInput, minutes: answer.value }, { now: at }, true);
}

function compileIntentInternal(state, input, { now }, confirmedMinutes = false) {
  const at = stateAndClock(state, now);
  inputObject(input, ['request', 'goalId', 'minutes'], 'intent');
  if (!isText(input.request, 2000)) throw new ValidationError(['intent.request: text of at most 2000 characters required']);
  if (input.goalId !== undefined && !isId(input.goalId)) throw new ValidationError(['intent.goalId: identifier required']);
  if (input.minutes !== undefined && !boundedMinutes(input.minutes)) throw new ValidationError(['intent.minutes: integer 5 to 240 required']);
  let brief = makeBrief(undefined, input.minutes);
  const request = normal(input.request);
  if (/[<>`{}]|\b(?:eval|exec|execute|javascript|systemprompt|permissions?|authorize|activate|delete|send|book|purchase|override|ignore|grant|revoke|shell|terminal|reschedule)\b|\b(?:do not|don't|not|except|instead of)\b/.test(request)
    || !/\b(?:help|plan|focus|work|study|learn|learning)\b/.test(request)) return unavailable(brief, 'unsupported-focus-grammar');
  const parsed = [...request.matchAll(/(?<![a-z0-9.+-])(-?\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/g)].map(match => Number(match[1]));
  const unsupportedTime = /\b(?:hours?|seconds?|tomorrow|yesterday)\b|\b\d+(?:\.\d+)?\s*(?:milliseconds?|ms|secs?|s|h|hrs?|d|days?|w|weeks?|months?|m)\b|[-+]\s+\d+\s*(?:minutes?|mins?)\b|\d+(?:\.\d+)?\s*(?:to|-|or|and)\s*\d+\s*(?:minutes?|mins?)\b|\bin\s+\d+\s*(?:minutes?|mins?)\b/.test(request)
    || parsed.some(value => !boundedMinutes(value)) || parsed.length === 0 && /\b(?:minutes?|mins?)\b/.test(request);
  const contradictoryTime = parsed.length > 1 || input.minutes !== undefined && parsed.length && input.minutes !== parsed[0];
  const minutes = confirmedMinutes ? input.minutes : unsupportedTime || contradictoryTime ? undefined : input.minutes ?? parsed[0];
  const matches = explicitGoalMatches(state, request);
  const active = state.goals.filter(goal => goal.status === 'active').sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  if (!active.length) return unavailable(brief, 'no-active-goals');
  let goal;
  if (input.goalId !== undefined) {
    goal = active.find(item => item.id === input.goalId);
    if (!goal) return unavailable(brief, 'active-goal-required');
    if (matches.length && !matches.some(item => item.id === goal.id)) return unavailable(makeBrief(goal, minutes), 'contradictory-goal');
  } else {
    if (matches.some(item => item.status !== 'active')) return unavailable(brief, 'inactive-goal-reference');
    if (matches.length === 1) goal = matches[0];
    else {
      const choices = (matches.length ? matches : active).slice(0, 10).map(item => ({ id: item.id, label: item.title, value: item.id }));
      return question(makeBrief(undefined, minutes), 'goal', 'Which active goal should this focus session support?', choices,
        { tenantId: state.tenantId, kind: 'goal', request, goalIds: choices.map(item => item.id), minutes });
    }
  }
  brief = makeBrief(goal, minutes);
  // Explicit interaction bypasses delivery gates only. Replay still enforces consent,
  // freshness, active goals, and dismiss/snooze feedback; it cannot manufacture a slot.
  const result = evaluate(state, { now: at, mode: 'replay' });
  const base = result.surfaces.find(frame => frame.goalId === goal.id && frame.ruleId === 'focus-opportunity');
  if (!base) return unavailable(brief, 'no-current-eligible-focus-window');
  brief.evidenceRefs = [...base.evidenceRefs];
  const scenario = base.blocks.find(block => block.type === 'calculator' && block.id === 'focus-scenario');
  const focus = scenario?.inputs.find(item => item.id === 'focusMinutes');
  if (!focus || focus.max < MIN_MINUTES) return unavailable(brief, 'unsupported-focus-scenario');
  if (!confirmedMinutes && (unsupportedTime || contradictoryTime)) {
    const choices = [...new Set([15, 25, 30, Math.min(MAX_MINUTES, focus.max)].filter(value => boundedMinutes(value) && value <= focus.max))]
      .slice(0, 4).map(value => ({ id: `minutes-${value}`, label: `${value} minutes`, value }));
    return { ...question(brief, 'minutes', 'That time wording is not supported or is contradictory. Choose one exact minute limit for this scenario.', choices,
      { tenantId: state.tenantId, kind: 'minutes', request, goalId: goal.id, evidenceRefs: base.evidenceRefs,
        sourceFingerprints: base.evidenceRefs.map(id => contextSourceFingerprint(state.observations.find(item => item.id === id))), max: focus.max }),
      reason: contradictoryTime ? 'contradictory-minutes' : 'unsupported-duration-grammar' };
  }
  const surface = cloneJson(base), inputBlock = surface.blocks.find(block => block.type === 'calculator' && block.id === 'focus-scenario').inputs.find(item => item.id === 'focusMinutes');
  if (minutes !== undefined) {
    const max = Math.min(inputBlock.max, minutes), step = inputBlock.step || 1;
    inputBlock.max = max;
    inputBlock.value = inputBlock.min + Math.floor((max - inputBlock.min) / step) * step;
  }
  brief.minutes = inputBlock.value;
  if (confirmedMinutes) brief.constraints.push('explicit-time-clarification');
  brief.constraints.push(...(minutes !== undefined ? [`user-minute-limit:${minutes}`] : ['existing-scenario-default']), `observed-window-limit:${focus.max}`, 'calendar-availability-not-inferred-from-request');
  assertValid(validateSurface(surface));
  return { status: 'ready', brief, surface };
}

function gapQuestion(id, kind, text, field) {
  return { id: `gq-${id.slice(3)}`, kind, text, ...(field ? { field } : {}),
    choices: field === 'completed' ? [{ id: 'completed-yes', label: 'Completed', value: true }, { id: 'completed-no', label: 'Incomplete', value: false }] : [] };
}
function createGap(state, goal, { kind, reason, missingFacts, evidenceRefs = [], observationId, connectorId, field, resolution, facts = {} }) {
  const id = `cg-${stableHash({ tenantId: state.tenantId, goalId: goal.id, kind, missingFacts, observationId, connectorId, facts })}`;
  const text = field === 'dueAt' ? 'What exact due date and time should this commitment record use?'
    : field === 'completed' ? 'Is this recorded commitment completed or incomplete?'
    : kind === 'consent' ? 'Review the source connection and its explicit read consent.'
    : kind === 'metric-record' ? 'Record a current measurement from an explicitly consented source.'
    : 'Add a current, explicitly linked source record for this active goal.';
  return { id, goalId: goal.id, kind, type: kind, ...(field ? { field } : {}), ...(observationId ? { observationId } : {}),
    ...(connectorId ? { connectorId } : {}), evidenceRefs, reason, missingFacts, resolution, question: gapQuestion(id, kind, text, field) };
}
function validateGapFeedback(state) {
  if (state.gapFeedback === undefined) return;
  if (!Array.isArray(state.gapFeedback) || state.gapFeedback.length > 100) throw new ValidationError(['gapFeedback: at most 100 receipts required']);
  for (const receipt of state.gapFeedback) {
    inputObject(receipt, ['gapId', 'kind', 'at', 'until', 'tenantId', 'goalId'], 'gapFeedback');
    if (!isId(receipt.gapId) || !['pause', 'snooze'].includes(receipt.kind) || !isDate(receipt.at)
      || receipt.tenantId !== state.tenantId || !state.goals.some(goal => goal.id === receipt.goalId)
      || receipt.kind === 'pause' && receipt.until !== undefined || receipt.kind === 'snooze' && (!isDate(receipt.until)
        || Date.parse(receipt.until) <= Date.parse(receipt.at) || Date.parse(receipt.until) - Date.parse(receipt.at) > 7 * DAY)) {
      throw new ValidationError(['gapFeedback: scoped bounded receipt required']);
    }
  }
}
const gapRank = { consent: 0, source: 1, 'commitment-field': 2, 'metric-record': 3 };

/** Missing facts are unknown. No narrative becomes a due date or completion flag. */
export function detectContextGaps(state, input = {}, { now } = {}) {
  const at = stateAndClock(state, now);
  inputObject(input, ['goalId'], 'contextGaps');
  if (input.goalId !== undefined && (!isId(input.goalId) || !state.goals.some(goal => goal.id === input.goalId))) throw new ValidationError(['contextGaps.goalId: known goal required']);
  validateGapFeedback(state);
  const gaps = [];
  for (const goal of state.goals.filter(item => item.status === 'active' && (input.goalId === undefined || item.id === input.goalId))) {
    const linked = state.observations.filter(item => item.goalIds.includes(goal.id));
    const eligible = [], consentSeen = new Set();
    for (const observation of linked) {
      const decision = observationDecision(state, observation, at);
      if (decision.allowed) { eligible.push(observation); continue; }
      if (['missing-connection', 'consent-revoked', 'missing-current-consent', 'consent-expired', 'missing-scope'].includes(decision.reason)) {
        const scope = OBSERVATION_POLICIES[observation.kind].scope, key = `${observation.connectorId}:${scope}`;
        if (consentSeen.has(key)) continue;
        consentSeen.add(key);
        const connection = state.connections.find(item => item.id === observation.connectorId);
        gaps.push(createGap(state, goal, { kind: 'consent', reason: decision.reason, missingFacts: [`read-consent:${scope}`],
          connectorId: observation.connectorId, resolution: 'host-connection', facts: { scope, status: connection?.status || 'missing',
            scopes: [...(connection?.scopes || [])].sort(), consentAt: connection?.consentAt || null, expiresAt: connection?.expiresAt || null } }));
      }
    }
    if (!eligible.length && !consentSeen.size) gaps.push(createGap(state, goal, { kind: 'source', reason: linked.length ? 'no-current-eligible-source' : 'no-linked-source',
      missingFacts: ['current-linked-observation'], resolution: 'import-observation', facts: { records: linked.map(item => ({ id: item.id, occurredAt: item.occurredAt, decision: observationDecision(state, item, at).reason })).sort((a, b) => a.id.localeCompare(b.id)) } }));
    for (const observation of eligible.filter(item => item.kind === 'mail.commitment')) {
      const effective = effectiveObservation(state, observation, { now: at });
      for (const field of ['dueAt', 'completed']) if (effective.data?.[field] === undefined) gaps.push(createGap(state, goal, {
        kind: 'commitment-field', field, observationId: observation.id, connectorId: observation.connectorId,
        evidenceRefs: [observation.id], reason: `unknown-${field}`, missingFacts: [`data.${field}`], resolution: 'typed-observation',
        facts: { sourceFingerprint: contextSourceFingerprint(observation), occurredAt: observation.occurredAt,
          dueAt: effective.data?.dueAt ?? null, completed: effective.data?.completed ?? null } }));
    }
    if (goal.metric && !eligible.some(item => ['metric.update', 'health.sleep'].includes(item.kind) && typeof item.metrics?.[goal.metric.key] === 'number'
      || goal.metric.key === 'contactIntervalDays' && item.kind === 'relationship.contact' && item.data?.lastContactAt)) {
      gaps.push(createGap(state, goal, { kind: 'metric-record', reason: 'no-current-explicit-measurement',
        missingFacts: [`metrics.${goal.metric.key}`], resolution: 'import-observation',
        facts: { metric: goal.metric, eligibleIds: eligible.map(item => item.id).sort() } }));
    }
  }
  const currentFeedback = (state.gapFeedback || []).filter(item => Date.parse(item.at) <= at.getTime());
  return gaps.filter(gap => {
    const latest = currentFeedback.filter(item => item.gapId === gap.id && item.goalId === gap.goalId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return !latest || latest.kind === 'snooze' && Date.parse(latest.until) <= at.getTime();
  }).sort((a, b) => gapRank[a.kind] - gapRank[b.kind] || a.goalId.localeCompare(b.goalId)
    || (a.field === 'dueAt' ? 0 : 1) - (b.field === 'dueAt' ? 0 : 1) || a.id.localeCompare(b.id));
}

/** Returns one inert correction proposal. Host must confirm and revalidate before applying.
 * Connections, scopes, goal authority and measured KPIs cannot be changed by this API. */
export function resolveContextGap(state, input, { now } = {}) {
  const at = stateAndClock(state, now);
  inputObject(input, ['gapId', 'value'], 'resolveContextGap');
  if (!isId(input.gapId)) throw new ValidationError(['resolveContextGap.gapId: identifier required']);
  const gap = detectContextGaps(state, {}, { now: at }).find(item => item.id === input.gapId);
  if (!gap) return { status: 'unavailable', gapId: input.gapId, requiresConfirmation: true, reason: 'gap-not-current' };
  if (gap.resolution !== 'typed-observation') return { status: 'unavailable', gapId: gap.id, requiresConfirmation: true, reason: 'host-source-or-consent-required' };
  if (gap.field === 'dueAt' ? !isDate(input.value) : typeof input.value !== 'boolean') throw new ValidationError([`resolveContextGap.value: ${gap.field === 'dueAt' ? 'explicit ISO date and time with timezone' : 'explicit boolean'} required`]);
  return { status: 'suggested', gapId: gap.id, requiresConfirmation: true,
    patch: { kind: 'observation-fields', observationId: gap.observationId, fields: { [gap.field]: input.value } } };
}
