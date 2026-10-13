import { isDate, ValidationError } from './validation.mjs';

export const HOUR = 3600000;
export const DAY = 24 * HOUR;
export function nowDate(now) {
  const value = now === undefined ? new Date() : now instanceof Date ? new Date(now) : isDate(now) ? new Date(now) : null;
  if (!value || !Number.isFinite(value.getTime())) throw new ValidationError(['now: must be a Date or ISO timestamp with timezone']);
  return value;
}
export function validTimezone(timezone) {
  if (typeof timezone !== 'string' || timezone.length > 100) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return true; } catch { return false; }
}
export function localParts(date, timezone) {
  const values = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (type) => values.find((item) => item.type === type)?.value;
  return { day: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) };
}
export function inQuietHours(date, preferences) {
  const { start, end } = preferences.quietHours;
  if (start === end) return false;
  const hour = localParts(date, preferences.timezone).hour;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
