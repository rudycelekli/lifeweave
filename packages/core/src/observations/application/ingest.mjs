import { validateState } from '../../state.mjs';
import { assertValid, cloneJson, isRecord, jsonIssues, stableStringify, ValidationError } from '../../shared/validation.mjs';
import { nowDate } from '../../shared/time.mjs';
import { observationDecision } from '../../action-policy/application/evaluate-consent.mjs';
import { observationFingerprint, observationIssues } from '../domain/observation.mjs';

export function ingestObservations(state, observations, { now } = {}) {
  assertValid(validateState(state));
  const issues = jsonIssues(observations, 'observations');
  if (!Array.isArray(observations)) issues.push('observations: array required');
  if (issues.length) throw new ValidationError(issues);
  const at = nowDate(now), next = cloneJson(state);
  const byId = new Map(next.observations.map((item) => [item.id, item]));
  const fingerprints = new Set(next.observations.map(observationFingerprint));
  observations.forEach((observation, i) => {
    const shapeIssues = observationIssues(observation, `observations[${i}]`);
    if (shapeIssues.length) throw new ValidationError(shapeIssues);
    const decision = observationDecision(state, observation, at);
    if (!decision.allowed) throw new ValidationError([`observations[${i}]: ${decision.reason}`]);
    for (const goalId of observation.goalIds) if (!state.goals.some((goal) => goal.id === goalId)) throw new ValidationError([`observations[${i}]: unknown goal ${goalId}`]);
    if (byId.has(observation.id)) {
      if (stableStringify(byId.get(observation.id)) !== stableStringify(observation)) throw new ValidationError([`observations[${i}]: conflicting observation ID`]);
      return;
    }
    const fingerprint = observationFingerprint(observation);
    if (fingerprints.has(fingerprint)) return;
    const copy = cloneJson(observation);
    byId.set(copy.id, copy); fingerprints.add(fingerprint); next.observations.push(copy);
  });
  assertValid(validateState(next));
  return next;
}
