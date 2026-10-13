const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
export const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;

export class ValidationError extends Error {
  constructor(issues) {
    super(`Invalid LifeWeave input: ${issues.join('; ')}`);
    this.name = 'ValidationError';
    this.issues = [...issues];
  }
}

export const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
export const isId = (value) => typeof value === 'string' && ID_PATTERN.test(value);
export const isText = (value, max = 2000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
export function isDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, y, m, d, h, min, sec, , offsetH, offsetM] = match;
  const leap = Number(y) % 4 === 0 && (Number(y) % 100 !== 0 || Number(y) % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= days[Number(m) - 1]
    && Number(h) <= 23 && Number(min) <= 59 && Number(sec) <= 59
    && (offsetH === undefined || Number(offsetH) <= 23 && Number(offsetM) <= 59) && Number.isFinite(Date.parse(value));
}

// Inspect descriptors first. Validation must never execute an untrusted getter.
export function jsonIssues(value, path = '$', depth = 0, seen = new Set(), maxDepth = 12) {
  const issues = [];
  if (depth > maxDepth) return [`${path}: nesting exceeds ${maxDepth}`];
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && value.length > 10000) issues.push(`${path}: text exceeds 10000 characters`);
    return issues;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${path}: number must be finite`];
  if (typeof value !== 'object') return [`${path}: must contain JSON values only`];
  if (!Array.isArray(value) && !isRecord(value)) return [`${path}: must be a plain JSON object`];
  if (seen.has(value)) return [`${path}: cyclic value`];
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > (Array.isArray(value) ? 2001 : 100)) issues.push(`${path}: too many entries`);
  if (Array.isArray(value) && Object.keys(descriptors).length !== value.length + 1) issues.push(`${path}: sparse arrays or extra properties are forbidden`);
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string') { issues.push(`${path}: symbol keys are forbidden`); continue; }
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) { issues.push(`${path}.${key}: array properties are forbidden`); continue; }
    const descriptor = descriptors[key];
    if (FORBIDDEN_KEYS.has(key)) { issues.push(`${path}.${key}: unsafe property name`); continue; }
    if (!('value' in descriptor)) { issues.push(`${path}.${key}: accessors are forbidden`); continue; }
    if (!descriptor.enumerable) { issues.push(`${path}.${key}: hidden properties are forbidden`); continue; }
    issues.push(...jsonIssues(descriptor.value, `${path}.${key}`, depth + 1, seen, maxDepth));
  }
  seen.delete(value);
  return issues;
}

export function assertValid(result) {
  if (!result.valid) throw new ValidationError(result.issues);
}

export function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Noncryptographic identity only; no authenticity claim. No native dependency.
export function stableHash(value) {
  const input = typeof value === 'string' ? value : stableStringify(value);
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    a = Math.imul(a ^ input.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ input.charCodeAt(i), 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
