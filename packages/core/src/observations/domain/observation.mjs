import { finiteNumber, isDate, isId, isRecord, isText, stableHash } from '../../shared/validation.mjs';
import { OBSERVATION_POLICIES } from '../../action-policy/domain/capabilities.mjs';

export function observationIssues(observation, path = 'observation') {
  if (!isRecord(observation)) return [`${path}: must be an object`];
  const issues = [];
  for (const key of ['id', 'tenantId', 'connectorId']) if (!isId(observation[key])) issues.push(`${path}.${key}: invalid identifier`);
  if (!Object.hasOwn(OBSERVATION_POLICIES, observation.kind)) issues.push(`${path}.kind: unsupported kind`);
  if (!isDate(observation.occurredAt)) issues.push(`${path}.occurredAt: ISO timestamp with timezone required`);
  if (!Array.isArray(observation.goalIds) || observation.goalIds.length > 20 || observation.goalIds.some((value) => !isId(value)) || new Set(observation.goalIds).size !== observation.goalIds.length) issues.push(`${path}.goalIds: at most 20 distinct identifiers required`);
  if (!isText(observation.summary, 2000)) issues.push(`${path}.summary: required text of at most 2000 characters`);
  if (observation.metrics !== undefined && (!isRecord(observation.metrics) || Object.entries(observation.metrics).some(([key, value]) => !isId(key) || !finiteNumber(value)))) issues.push(`${path}.metrics: identifier keys and finite numeric values required`);
  if (observation.data !== undefined && !isRecord(observation.data)) issues.push(`${path}.data: must be an inert JSON object`);
  // Typed rule fields are validated. Narratives and extra data never become instructions.
  const data = observation.data || {};
  for (const key of ['instructions', 'systemPrompt', 'scopes', 'capability', 'tenantId', 'consentAt', 'permissions', 'approval', 'actions', 'executableCode']) {
    if (Object.hasOwn(data, key)) issues.push(`${path}.data.${key}: evidence cannot provide authority`);
  }
  if (observation.kind === 'mail.commitment') {
    if (data.dueAt !== undefined && !isDate(data.dueAt)) issues.push(`${path}.data.dueAt: ISO timestamp required`);
    if (data.completed !== undefined && typeof data.completed !== 'boolean') issues.push(`${path}.data.completed: boolean required`);
  }
  if (observation.kind === 'calendar.availability') {
    for (const key of ['startsAt', 'endsAt']) if (data[key] !== undefined && !isDate(data[key])) issues.push(`${path}.data.${key}: ISO timestamp required`);
    if (data.available !== undefined && typeof data.available !== 'boolean') issues.push(`${path}.data.available: boolean required`);
    if (data.startsAt && data.endsAt && Date.parse(data.endsAt) <= Date.parse(data.startsAt)) issues.push(`${path}.data: endsAt must follow startsAt`);
  }
  if (observation.kind === 'health.sleep' && observation.metrics?.sleepHours !== undefined && (observation.metrics.sleepHours < 0 || observation.metrics.sleepHours > 24)) issues.push(`${path}.metrics.sleepHours: must be 0 to 24`);
  if (observation.kind === 'relationship.contact') {
    if (data.lastContactAt !== undefined && !isDate(data.lastContactAt)) issues.push(`${path}.data.lastContactAt: ISO timestamp required`);
    if (data.personLabel !== undefined && !isText(data.personLabel, 160)) issues.push(`${path}.data.personLabel: short text required`);
  }
  return issues;
}

export function observationFingerprint(observation) {
  // Exclude ID and narrative: two adapters importing the same structured signal deduplicate.
  return stableHash({ tenantId: observation.tenantId, connectorId: observation.connectorId, kind: observation.kind,
    occurredAt: observation.occurredAt, goalIds: [...observation.goalIds].sort(), metrics: observation.metrics || {}, data: observation.data || {} });
}
