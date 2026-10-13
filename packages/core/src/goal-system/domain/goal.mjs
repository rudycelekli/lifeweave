import { finiteNumber, isDate, isId, isRecord, isText } from '../../shared/validation.mjs';

export const GOAL_STATUSES = Object.freeze(['active', 'candidate', 'paused']);
export function goalIssues(goal, path = 'goal') {
  if (!isRecord(goal)) return [`${path}: must be an object`];
  const issues = [];
  if (!isId(goal.id)) issues.push(`${path}.id: invalid identifier`);
  if (!isText(goal.title, 300)) issues.push(`${path}.title: required text of at most 300 characters`);
  if (!isId(goal.dimension)) issues.push(`${path}.dimension: invalid identifier`);
  if (!GOAL_STATUSES.includes(goal.status)) issues.push(`${path}.status: must be active, candidate, or paused`);
  if (!finiteNumber(goal.priority) || goal.priority < 0 || goal.priority > 100) issues.push(`${path}.priority: must be 0 to 100`);
  if (goal.metric !== undefined) {
    const metric = goal.metric;
    if (!isRecord(metric) || !isId(metric.key) || !finiteNumber(metric.target) || !isText(metric.unit, 80) || !['increase', 'decrease'].includes(metric.direction)) issues.push(`${path}.metric: key, finite target, unit, and direction are required`);
  }
  if (goal.source !== undefined) {
    const source = goal.source;
    if (!isRecord(source) || !isText(source.kind, 80) || !isText(source.ref, 1000) || !(isDate(source.date) || typeof source.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.date))) issues.push(`${path}.source: kind, date, and ref are required`);
  }
  return issues;
}
