import { ACTION_CAPABILITIES } from '../../action-policy/domain/capabilities.mjs';
import { finiteNumber, isDate, isId, isRecord, isText, jsonIssues } from '../../shared/validation.mjs';
import { calculatorIssues } from './expression.mjs';

const BLOCK_KEYS = {
  text: ['type', 'id', 'text'],
  metric: ['type', 'id', 'label', 'value', 'target', 'unit'],
  checklist: ['type', 'id', 'items'],
  timeline: ['type', 'id', 'items'],
  trend: ['type', 'id', 'label', 'unit', 'points'],
  calculator: ['type', 'id', 'label', 'inputs', 'outputs']
};
const LOCAL_INTENTS = new Set(['open-evidence', 'draft-reply', 'plan-focus', 'reflect-sleep', 'draft-catchup', 'plan-step']);
function executablePayloadIssues(value, path, issues) {
  if (!isRecord(value) && !Array.isArray(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (['code', 'script', 'html', 'javascript', 'eval', 'onClick', 'systemPrompt', 'instructions', 'scopes', 'capability', 'permissions', 'approval'].includes(key)) issues.push(`${path}.${key}: executable or authority payload forbidden`);
    executablePayloadIssues(child, `${path}.${key}`, issues);
  }
}
function onlyKeys(value, allowed, path, issues) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`${path}.${key}: unknown field`);
}
export function validateSurface(surface) {
  // Six expression levels include intervening args arrays and a SurfaceFrame envelope.
  const issues = jsonIssues(surface, '$', 0, new Set(), 24);
  if (issues.length) return { valid: false, issues };
  if (!isRecord(surface)) return { valid: false, issues: ['surface: object required'] };
  onlyKeys(surface, ['version', 'id', 'goalId', 'dimension', 'title', 'reason', 'priority', 'confidence', 'evidenceRefs', 'createdAt', 'expiresAt', 'status', 'blocks', 'actions', 'ruleId', 'sourceKind'], 'surface', issues);
  if (surface.version !== 1) issues.push('surface.version: must be 1');
  for (const key of ['id', 'goalId', 'dimension']) if (!isId(surface[key])) issues.push(`surface.${key}: invalid identifier`);
  for (const key of ['title', 'reason']) if (!isText(surface[key], key === 'title' ? 300 : 2000)) issues.push(`surface.${key}: bounded text required`);
  if (!finiteNumber(surface.priority) || surface.priority < 0 || surface.priority > 100) issues.push('surface.priority: 0 to 100 required');
  if (!finiteNumber(surface.confidence) || surface.confidence < 0 || surface.confidence > 1) issues.push('surface.confidence: 0 to 1 required');
  if (!Array.isArray(surface.evidenceRefs) || surface.evidenceRefs.length === 0 || surface.evidenceRefs.some((id) => !isId(id)) || new Set(surface.evidenceRefs).size !== surface.evidenceRefs.length) issues.push('surface.evidenceRefs: distinct evidence identifiers required');
  if (!isDate(surface.createdAt) || !isDate(surface.expiresAt) || Date.parse(surface.expiresAt) <= Date.parse(surface.createdAt)) issues.push('surface: valid increasing createdAt and expiresAt required');
  if (surface.status !== 'active') issues.push('surface.status: only active surfaces are renderable');
  if (surface.ruleId !== undefined && !isId(surface.ruleId)) issues.push('surface.ruleId: invalid identifier');
  if (surface.sourceKind !== undefined && !isId(surface.sourceKind)) issues.push('surface.sourceKind: invalid identifier');
  if (!Array.isArray(surface.blocks) || surface.blocks.length > 12) issues.push('surface.blocks: at most 12 blocks required');
  else surface.blocks.forEach((block, i) => {
    const path = `surface.blocks[${i}]`;
    if (!isRecord(block) || !Object.hasOwn(BLOCK_KEYS, block.type)) { issues.push(`${path}: unsupported block type`); return; }
    onlyKeys(block, BLOCK_KEYS[block.type], path, issues);
    if (block.id !== undefined && !isId(block.id)) issues.push(`${path}.id: invalid identifier`);
    if (block.type === 'text' && !isText(block.text, 2000)) issues.push(`${path}.text: bounded text required`);
    if (['metric', 'trend'].includes(block.type) && (!isText(block.label, 200) || !isText(block.unit, 80))) issues.push(`${path}: label and unit required`);
    if (block.type === 'metric' && (!(block.value === null || finiteNumber(block.value)) || block.target !== undefined && !finiteNumber(block.target))) issues.push(`${path}: value must be a finite number or null; target finite when provided`);
    if (block.type === 'calculator') issues.push(...calculatorIssues(block, path));
    if (block.type === 'checklist') {
      if (!Array.isArray(block.items) || block.items.length > 20) issues.push(`${path}.items: at most 20 items required`);
      else block.items.forEach((item, j) => {
        if (!isRecord(item) || !isId(item.id) || !isText(item.text, 500) || typeof item.done !== 'boolean') { issues.push(`${path}.items[${j}]: id, text, and done required`); return; }
        onlyKeys(item, ['id', 'text', 'done'], `${path}.items[${j}]`, issues);
      });
    }
    if (block.type === 'timeline') {
      if (!Array.isArray(block.items) || block.items.length > 30) issues.push(`${path}.items: at most 30 items required`);
      else block.items.forEach((item, j) => {
        if (!isRecord(item) || !isDate(item.at) || !isText(item.label, 500)) { issues.push(`${path}.items[${j}]: at and label required`); return; }
        onlyKeys(item, ['at', 'label'], `${path}.items[${j}]`, issues);
      });
    }
    if (block.type === 'trend') {
      if (!Array.isArray(block.points) || block.points.length > 60) issues.push(`${path}.points: at most 60 points required`);
      else block.points.forEach((point, j) => {
        if (!isRecord(point) || !isDate(point.at) || !finiteNumber(point.value)) { issues.push(`${path}.points[${j}]: at and finite value required`); return; }
        onlyKeys(point, ['at', 'value'], `${path}.points[${j}]`, issues);
      });
    }
  });
  if (!Array.isArray(surface.actions) || surface.actions.length > 8) issues.push('surface.actions: at most 8 required');
  else surface.actions.forEach((action, i) => {
    const path = `surface.actions[${i}]`;
    if (!isRecord(action)) { issues.push(`${path}: object required`); return; }
    onlyKeys(action, ['id', 'label', 'kind', 'capability', 'payload', 'requiresApproval'], path, issues);
    if (!isId(action.id) || !isText(action.label, 160) || !['local', 'external'].includes(action.kind)) issues.push(`${path}: id, label, and kind required`);
    if (action.kind === 'local' && action.capability !== undefined) issues.push(`${path}: local action cannot claim an external capability`);
    if (action.kind === 'local' && action.requiresApproval !== undefined) issues.push(`${path}: local action cannot declare external approval`);
    if (action.kind === 'external' && (!ACTION_CAPABILITIES.includes(action.capability) || action.requiresApproval !== true)) issues.push(`${path}: external capability and requiresApproval:true required`);
    if (action.payload !== undefined && !isRecord(action.payload)) issues.push(`${path}.payload: inert object required`);
    if (isRecord(action.payload)) {
      executablePayloadIssues(action.payload, `${path}.payload`, issues);
      if (action.kind === 'local' && action.payload.intent !== undefined && !LOCAL_INTENTS.has(action.payload.intent)) issues.push(`${path}.payload.intent: unsupported local intent`);
      if (action.payload.observationId !== undefined && !isId(action.payload.observationId)) issues.push(`${path}.payload.observationId: identifier required`);
    }
    if (surface.actions.some((other, j) => j < i && other?.id === action.id)) issues.push(`${path}.id: duplicate action identifier`);
  });
  return { valid: issues.length === 0, issues };
}
