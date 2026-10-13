import { validateState } from '../../state.mjs';
import { assertValid, cloneJson, isDate, isId, isRecord, jsonIssues, ValidationError } from '../../shared/validation.mjs';
import { DAY, localParts, nowDate } from '../../shared/time.mjs';
import { buildCandidates, evaluate } from './evaluate.mjs';

export function applyFeedback(state, input, { now } = {}) {
  assertValid(validateState(state));
  const issues = jsonIssues(input, 'feedback');
  if (issues.length) throw new ValidationError(issues);
  if (!isRecord(input) || !isId(input.surfaceId) || !['done', 'dismiss', 'snooze'].includes(input.kind)) throw new ValidationError(['feedback: valid surfaceId and kind required']);
  if (Object.keys(input).some((key) => !['surfaceId', 'kind', 'until'].includes(key))) throw new ValidationError(['feedback: unknown authority fields forbidden']);
  const at = nowDate(now);
  const candidate = buildCandidates(state, at).candidates.find((item) => item.id === input.surfaceId);
  if (!candidate) throw new ValidationError(['feedback.surfaceId: current evidence-linked surface required']);
  const until = input.kind === 'snooze' ? input.until || new Date(at.getTime() + DAY).toISOString() : undefined;
  if (input.kind === 'snooze' && (!isDate(until) || Date.parse(until) <= at.getTime())) throw new ValidationError(['feedback.until: ISO timestamp after now required']);
  const next = cloneJson(state);
  const receipt = { surfaceId: candidate.id, kind: input.kind, at: at.toISOString(), tenantId: state.tenantId,
    goalId: candidate.goalId, ruleId: candidate.ruleId, evidenceRefs: candidate.evidenceRefs, ...(until ? { until } : {}) };
  // Repeated identical clicks are idempotent at the same clock instant.
  if (!next.feedback.some((item) => item.surfaceId === receipt.surfaceId && item.kind === receipt.kind && item.at === receipt.at && item.until === receipt.until)) next.feedback.push(receipt);
  assertValid(validateState(next));
  return next;
}

export function recordSurfaceDelivery(state, surfaceIds, { now } = {}) {
  assertValid(validateState(state));
  const issues = jsonIssues(surfaceIds, 'surfaceIds');
  if (issues.length || !Array.isArray(surfaceIds) || surfaceIds.some((id) => !isId(id))) throw new ValidationError(issues.length ? issues : ['surfaceIds: array of identifiers required']);
  const at = nowDate(now), today = localParts(at, state.preferences.timezone).day;
  const available = new Set(evaluate(state, { now: at, mode: 'live' }).surfaces.map((item) => item.id));
  for (const id of surfaceIds) if (!available.has(id)) throw new ValidationError([`surfaceIds: ${id} was not eligible for live delivery`]);
  const next = cloneJson(state);
  next.deliveries ||= [];
  for (const id of new Set(surfaceIds)) {
    if (!next.deliveries.some((item) => item.surfaceId === id && localParts(new Date(item.at), state.preferences.timezone).day === today)) next.deliveries.push({ surfaceId: id, at: at.toISOString(), tenantId: state.tenantId });
  }
  assertValid(validateState(next));
  return next;
}
