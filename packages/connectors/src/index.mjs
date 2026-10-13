import { createHash } from 'node:crypto';
import { validateSurface } from '@lifeweave/core';
const MAX_RECORDS = 500;
const MAX_TEXT = 4000;
const text = value => typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
const date = value => {
  if(typeof value==='string'&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw new Error('Provider timestamp requires an explicit timezone');
  const result = new Date(value);
  if (!value || !Number.isFinite(result.valueOf())) throw new Error('Provider returned an invalid timestamp');
  if(typeof value==='string'){const [year,month,day]=value.slice(0,10).split('-').map(Number);if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())throw new Error('Provider returned an invalid calendar date');}
  return result.toISOString();
};
const optionsCheck = options => {
  if (!options || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(options.tenantId) || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(options.connectorId)) throw new Error('A host-owned tenantId and connectorId are required');
  if (!Array.isArray(options.goalIds) || options.goalIds.some(id => typeof id !== 'string' || id.length > 100)) throw new Error('Goal mapping must be explicit');
};
const envelope = (id, kind, occurredAt, summary, options, data = {}, metrics) => ({
  id: `${options.connectorId.slice(0,25)}:${createHash('sha256').update(`${options.connectorId}:${id}`).digest('hex')}`, tenantId: options.tenantId,
  connectorId: options.connectorId, kind, occurredAt: date(occurredAt),
  goalIds: [...options.goalIds], summary: text(summary).slice(0,2000), data,
  ...(metrics ? { metrics } : {})
});

/** Normalize provider data. Message content cannot become a commitment without host-confirmed fields. */
export function normalizeGraphMail(response, options) {
  optionsCheck(options);
  if (!response || !Array.isArray(response.value) || response.value.length > MAX_RECORDS) throw new Error('Invalid Graph mail page');
  return response.value.map(item => {
    if (typeof item.id !== 'string') throw new Error('Graph message id missing');
    return envelope(item.id, 'mail.message', item.receivedDateTime,
      `${text(item.subject)}\n${text(item.bodyPreview)}`, options,
      { providerId: text(item.id), subject: text(item.subject), sourceUrl: 'https://outlook.office.com/mail/' });
  });
}

export function normalizeGraphCalendar(response, options) {
  optionsCheck(options);
  if (!response || !Array.isArray(response.value) || response.value.length > MAX_RECORDS) throw new Error('Invalid Graph calendar page');
  return response.value.map(item => {
    // Graph adapter requests UTC via Prefer header. Never silently interpret unspecified local time.
    const start = item.start?.dateTime, end = item.end?.dateTime;
    const zone = item.start?.timeZone;
    if (zone !== 'UTC' || item.end?.timeZone !== 'UTC' || typeof start !== 'string' || typeof end !== 'string') throw new Error('Graph calendar adapter requires explicit UTC timestamps');
    const startsAt = date(start.endsWith('Z') ? start : `${start}Z`);
    const endsAt = date(end.endsWith('Z') ? end : `${end}Z`);
    if (new Date(endsAt) <= new Date(startsAt)) throw new Error('Calendar event has invalid duration');
    return envelope(item.id, 'calendar.event', options.observedAt, text(item.subject), options,
      { startsAt, endsAt, busy: item.showAs !== 'free', cancelled: Boolean(item.isCancelled) });
  });
}

export function normalizeGmail(response, options) {
  optionsCheck(options);
  const records = Array.isArray(response) ? response : [response];
  if (records.length > MAX_RECORDS) throw new Error('Gmail import too large');
  return records.map(item => {
    if (!item || typeof item.id !== 'string' || !/^\d+$/.test(String(item.internalDate))) throw new Error('Invalid Gmail message');
    const subject = item.payload?.headers?.find(header => header.name?.toLowerCase() === 'subject')?.value;
    return envelope(item.id, 'mail.message', Number(item.internalDate), `${text(subject)}\n${text(item.snippet)}`, options,
      { providerId: text(item.id), subject: text(subject), sourceUrl: 'https://mail.google.com/mail/' });
  });
}

/** A local JSON bridge can accept only explicit observations, never tools or executable commands. */
export function normalizeHealthExport(rows, options) {
  optionsCheck(options);
  if (!Array.isArray(rows) || rows.length > MAX_RECORDS) throw new Error('Expected at most 500 health records');
  return rows.map(row => {
    if (!row || typeof row.id !== 'string' || !Number.isFinite(row.sleepHours) || row.sleepHours < 0 || row.sleepHours > 24) throw new Error('Invalid sleep export');
    return envelope(row.id, 'health.sleep', row.occurredAt, 'Imported sleep duration', options, {}, { sleepHours: row.sleepHours });
  });
}

/** Only these fixed HTTPS read endpoints are reachable. Tokens never leave the host adapter. */
export function createGraphReader({ accessToken, fetchImpl = globalThis.fetch }) {
  if (typeof accessToken !== 'string' || accessToken.length < 8 || /[\r\n]/.test(accessToken)) throw new Error('A host-supplied access token is required');
  const read = async path => {
    const response = await fetchImpl(`https://graph.microsoft.com/v1.0/${path}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', Prefer: 'outlook.timezone="UTC"' }
    });
    if (!response.ok) throw new Error(`Graph read failed (${response.status})`);
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error('Graph response too large');
    return JSON.parse(body);
  };
  return Object.freeze({
    readMail: () => read('me/messages?$top=50&$select=id,subject,bodyPreview,receivedDateTime'),
    readCalendar: ({ start, end }) => {
      const a = date(start), b = date(end);
      if (new Date(b) <= new Date(a) || new Date(b) - new Date(a) > 31 * 86400000) throw new Error('Calendar window must be positive and at most 31 days');
      return read(`me/calendarView?startDateTime=${encodeURIComponent(a)}&endDateTime=${encodeURIComponent(b)}&$top=100&$select=id,subject,start,end,showAs,isCancelled`);
    }
  });
}

/** Protocol bridge: transport receives only state events; it cannot grant action permission. */
export async function emitAgUiSurface(surface, emit) {
  if (typeof emit !== 'function') throw new Error('Host event sink is required');
  const validation=validateSurface(surface);
  if(!validation.valid)throw new Error(`Invalid SurfaceFrame: ${validation.issues.join('; ')}`);
  await emit({ type: 'CUSTOM', name: 'lifeweave.surface', value: structuredClone(surface) });
}

export const integrationCatalog = Object.freeze([
  { id: 'local-import', name: 'Local evidence', category: 'Files', status: 'implemented', scope: 'manual.read', mode: 'Explicit JSON import', note: 'Works locally. You choose the evidence and goal mapping.' },
  { id: 'microsoft', name: 'Outlook + Microsoft Calendar', category: 'Mail & time', status: 'mock-tested', scope: 'Mail.Read / Calendars.Read', mode: 'Read-only Graph adapter', note: 'Host token reader and normalization implemented. OAuth, pagination and live canaries remain.' },
  { id: 'gmail', name: 'Gmail', category: 'Mail', status: 'mock-tested', scope: 'gmail.readonly', mode: 'Normalization adapter', note: 'Message normalization implemented. OAuth and live fetching remain.' },
  { id: 'google-calendar', name: 'Google Calendar', category: 'Time', status: 'planned', scope: 'calendar.readonly', mode: 'Provider adapter', note: 'Requires a user-owned Google connection and read/revoke acceptance.' },
  { id: 'health-export', name: 'Sleep export', category: 'Wellbeing', status: 'mock-tested', scope: 'health.sleep.read', mode: 'Local JSON bridge', note: 'Explicit records only. HealthKit requires a consented native bridge.' },
  { id: 'healthkit', name: 'Apple Health', category: 'Wellbeing', status: 'planned', scope: 'Per-type HealthKit permissions', mode: 'Native iOS companion', note: 'A browser cannot directly read the HealthKit store. Native companion not built.' },
  { id: 'oura', name: 'Oura / wearable APIs', category: 'Wellbeing', status: 'planned', scope: 'Per-provider consent', mode: 'Provider adapters', note: 'Availability and partner access must be checked for each provider.' },
  { id: 'slack', name: 'Slack / Teams', category: 'Communication', status: 'planned', scope: 'Selected channels only', mode: 'Communication adapter', note: 'Read scopes, retention and shared workspace boundaries require setup.' },
  { id: 'hermes', name: 'Hermes agent', category: 'Agent runtime', status: 'planned', scope: 'Host allowlist', mode: 'Isolated runtime bridge', note: 'Use an isolated process. Do not inherit broad terminal/MCP authority.' },
  { id: 'ag-ui', name: 'CopilotKit / AG-UI', category: 'Interface', status: 'contract-tested', scope: 'Surface state only', mode: 'Custom event bridge', note: 'Generic event sink is implemented. CopilotKit client integration remains.' },
  { id: 'openui', name: 'OpenUI', category: 'Interface', status: 'planned', scope: 'Trusted component registry', mode: 'Renderer adapter', note: 'Keep generated components behind our validation and policy boundary.' },
  { id: 'mcp', name: 'MCP tools', category: 'Tools', status: 'planned', scope: 'Per-tool capabilities', mode: 'Host broker', note: 'Tool discovery is not execution authority. No generic MCP executor in this build.' },
  { id: 'computer-use', name: 'Computer use / ruOS', category: 'Desktop', status: 'planned', scope: 'Session and action approval', mode: 'Isolated host handoff', note: 'Must use explicit session scope and a reviewable action. No desktop controller here.' },
  { id: 'habits', name: 'Atomic You / habitsAPP', category: 'Habits', status: 'planned', scope: 'Selected export', mode: 'Local source adapter', note: 'Patterns reviewed; backend, credentials and code remain separate.' }
]);
