import { goalIssues } from './goal-system/domain/goal.mjs';
import { observationIssues } from './observations/domain/observation.mjs';
import { finiteNumber, isDate, isId, isRecord, isText, jsonIssues } from './shared/validation.mjs';
import { validTimezone } from './shared/time.mjs';
import { extensionIssues } from './shared-context/domain/extensions.mjs';

export function validateState(state) {
  const issues = jsonIssues(state);
  if (issues.length) return { valid: false, issues };
  if (!isRecord(state)) return { valid: false, issues: ['state: must be a JSON object'] };
  if (state.version !== 1) issues.push('version: must be 1');
  if (!isId(state.tenantId)) issues.push('tenantId: invalid identifier');
  for (const key of ['goals', 'observations', 'connections', 'feedback']) if (!Array.isArray(state[key])) issues.push(`${key}: array required`);
  if (issues.length) return { valid: false, issues };
  const ids = new Set();
  if (state.goals.length > 100) issues.push('goals: at most 100');
  state.goals.forEach((goal, i) => {
    issues.push(...goalIssues(goal, `goals[${i}]`));
    if (!isRecord(goal)) return;
    if (ids.has(goal.id)) issues.push(`goals[${i}].id: duplicate`);
    ids.add(goal.id);
  });
  const observationIds = new Set();
  state.observations.forEach((observation, i) => {
    issues.push(...observationIssues(observation, `observations[${i}]`));
    if (!isRecord(observation)) return;
    if (observationIds.has(observation.id)) issues.push(`observations[${i}].id: duplicate`);
    observationIds.add(observation.id);
    if (observation.tenantId !== state.tenantId) issues.push(`observations[${i}].tenantId: tenant mismatch`);
    if (Array.isArray(observation.goalIds)) for (const id of observation.goalIds) if (!ids.has(id)) issues.push(`observations[${i}].goalIds: unknown goal ${id}`);
  });
  const connectionIds = new Set();
  if (state.connections.length > 100) issues.push('connections: at most 100');
  state.connections.forEach((connection, i) => {
    const path = `connections[${i}]`;
    if (!isRecord(connection)) { issues.push(`${path}: object required`); return; }
    if (!isId(connection.id)) issues.push(`${path}.id: invalid identifier`);
    if (connectionIds.has(connection.id)) issues.push(`${path}.id: duplicate`);
    connectionIds.add(connection.id);
    if (!isText(connection.provider, 120)) issues.push(`${path}.provider: short text required`);
    if (!['connected', 'disconnected'].includes(connection.status)) issues.push(`${path}.status: connected or disconnected required`);
    if (!Array.isArray(connection.scopes) || connection.scopes.length > 30 || connection.scopes.some((scope) => !isId(scope)) || new Set(connection.scopes).size !== connection.scopes.length) issues.push(`${path}.scopes: distinct identifiers required`);
    if (connection.consentAt !== undefined && !isDate(connection.consentAt)) issues.push(`${path}.consentAt: ISO timestamp required`);
    if (connection.expiresAt !== undefined && !isDate(connection.expiresAt)) issues.push(`${path}.expiresAt: ISO timestamp required`);
    if (connection.status === 'connected' && connection.consentAt === undefined) issues.push(`${path}.consentAt: explicit consent required when connected`);
    if (connection.expiresAt && connection.consentAt && Date.parse(connection.expiresAt) <= Date.parse(connection.consentAt)) issues.push(`${path}: expiration must follow consent`);
    if (connection.tenantId !== undefined && connection.tenantId !== state.tenantId) issues.push(`${path}.tenantId: tenant mismatch`);
    for (const key of ['accessToken', 'refreshToken', 'password', 'secret', 'apiKey']) if (Object.hasOwn(connection, key)) issues.push(`${path}.${key}: credentials must stay in host secure storage`);
  });
  const preferences = state.preferences;
  if (!isRecord(preferences)) issues.push('preferences: object required');
  else {
    if (!validTimezone(preferences.timezone)) issues.push('preferences.timezone: valid IANA timezone required');
    const quiet = preferences.quietHours;
    if (!isRecord(quiet) || ![quiet.start, quiet.end].every((n) => Number.isInteger(n) && n >= 0 && n <= 23)) issues.push('preferences.quietHours: start and end must be hours 0 to 23');
    if (!Number.isInteger(preferences.dailySurfaceBudget) || preferences.dailySurfaceBudget < 0 || preferences.dailySurfaceBudget > 20) issues.push('preferences.dailySurfaceBudget: integer 0 to 20 required');
  }
  state.feedback.forEach((feedback, i) => {
    const path = `feedback[${i}]`;
    if (!isRecord(feedback) || !isId(feedback.surfaceId) || !['done', 'dismiss', 'snooze'].includes(feedback.kind) || !isDate(feedback.at)) { issues.push(`${path}: surfaceId, kind, and ISO at required`); return; }
    if (feedback.kind === 'snooze' && (!isDate(feedback.until) || Date.parse(feedback.until) <= Date.parse(feedback.at))) issues.push(`${path}.until: must be an ISO timestamp after at`);
    if (feedback.tenantId !== undefined && feedback.tenantId !== state.tenantId) issues.push(`${path}.tenantId: tenant mismatch`);
    if (feedback.goalId !== undefined && !ids.has(feedback.goalId)) issues.push(`${path}.goalId: unknown goal`);
    if (feedback.evidenceRefs !== undefined && (!Array.isArray(feedback.evidenceRefs) || feedback.evidenceRefs.some((id) => !isId(id)))) issues.push(`${path}.evidenceRefs: identifiers required`);
  });
  if (state.deliveries !== undefined) {
    if (!Array.isArray(state.deliveries)) issues.push('deliveries: array required');
    else state.deliveries.forEach((receipt, i) => {
      if (!isRecord(receipt) || !isId(receipt.surfaceId) || !isDate(receipt.at) || receipt.tenantId !== state.tenantId) issues.push(`deliveries[${i}]: surfaceId, at, and current tenantId required`);
    });
  }
  if(issues.length)return {valid:false,issues};
  issues.push(...extensionIssues(state));
  return { valid: issues.length === 0, issues };
}
