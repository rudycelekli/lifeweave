import { nowDate, DAY, HOUR } from './shared/time.mjs';

export const DEMO_CLOCK = '2026-10-13T16:00:00.000Z';
export function createDemoState(nowISO = DEMO_CLOCK) {
  const now = nowDate(nowISO);
  const timestamp = (offset) => new Date(now.getTime() + offset).toISOString();
  const source = { kind: 'synthetic-fixture', date: now.toISOString(), ref: 'examples/demo.json' };
  const connections = [
    ['demo-mail', 'synthetic-mail', ['mail.read']],
    ['demo-calendar', 'synthetic-calendar', ['calendar.read']],
    ['demo-health', 'synthetic-health', ['health.sleep.read']],
    ['demo-contacts', 'synthetic-contacts', ['contacts.read']],
    ['demo-manual', 'synthetic-manual', ['manual.read']]
  ].map(([id, provider, scopes]) => ({ id, provider, status: 'connected', scopes, consentAt: timestamp(-30 * DAY), expiresAt: timestamp(30 * DAY), synthetic: true }));
  return { version: 1, tenantId: 'local', fixture: { synthetic: true, clock: now.toISOString(), description: 'All goals, signals, and providers in this fixture are invented. No external accounts are connected.' },
    goals: [
      { id: 'goal-career', title: 'Deliver a useful client proposal', dimension: 'career', status: 'active', priority: 88, metric: { key: 'proposalsSent', target: 3, unit: 'proposals', direction: 'increase' }, source },
      { id: 'goal-learning', title: 'Build a consistent learning practice', dimension: 'learning', status: 'active', priority: 78, metric: { key: 'focusMinutes', target: 180, unit: 'minutes/week', direction: 'increase' }, source },
      { id: 'goal-wellbeing', title: 'Protect a regular sleep routine', dimension: 'wellbeing', status: 'active', priority: 76, metric: { key: 'sleepHours', target: 7.5, unit: 'hours', direction: 'increase' }, source },
      { id: 'goal-relationships', title: 'Stay in touch with people who matter', dimension: 'relationships', status: 'active', priority: 72, metric: { key: 'contactIntervalDays', target: 14, unit: 'days', direction: 'decrease' }, source },
      { id: 'goal-finances', title: 'Understand my household budget', dimension: 'finances', status: 'active', priority: 60, metric: { key: 'monthlySavings', target: 500, unit: 'USD', direction: 'increase' }, source },
      { id: 'goal-historical', title: 'Review a historical ambition before adopting it', dimension: 'personal', status: 'candidate', priority: 100,
        source: { kind: 'historical-document', date: '2020-12-09', ref: 'synthetic-historical-example' } }
    ], connections,
    observations: [
      { id: 'demo-mail-overdue', tenantId: 'local', connectorId: 'demo-mail', kind: 'mail.commitment', occurredAt: timestamp(-2 * DAY), goalIds: ['goal-career'], summary: 'Synthetic: a promised client proposal was due yesterday.', data: { dueAt: timestamp(-DAY), completed: false, synthetic: true } },
      { id: 'demo-calendar-window', tenantId: 'local', connectorId: 'demo-calendar', kind: 'calendar.availability', occurredAt: timestamp(-HOUR), goalIds: ['goal-learning'], summary: 'Synthetic: a 60-minute calendar window was explicitly confirmed free.', data: { startsAt: timestamp(2 * HOUR), endsAt: timestamp(3 * HOUR), available: true, synthetic: true } },
      ...[6.1, 6.3, 5.9].map((sleepHours, index) => ({ id: `demo-sleep-${index + 1}`, tenantId: 'local', connectorId: 'demo-health', kind: 'health.sleep', occurredAt: timestamp(-(3 - index) * DAY + 6 * HOUR), goalIds: ['goal-wellbeing'], summary: `Synthetic sleep record ${index + 1}.`, metrics: { sleepHours }, data: { synthetic: true } })),
      { id: 'demo-contact', tenantId: 'local', connectorId: 'demo-contacts', kind: 'relationship.contact', occurredAt: timestamp(-HOUR), goalIds: ['goal-relationships'], summary: 'Synthetic: last-contact date was supplied by the user.', data: { personLabel: 'a friend', lastContactAt: timestamp(-21 * DAY), synthetic: true } },
      { id: 'demo-budget-unknown', tenantId: 'local', connectorId: 'demo-manual', kind: 'manual.note', occurredAt: timestamp(-HOUR), goalIds: ['goal-finances'], summary: 'Synthetic: no current savings measurement has been imported.', metrics: {}, data: { synthetic: true, measurementState: 'unknown' } },
      { id: 'demo-historical-note', tenantId: 'local', connectorId: 'demo-manual', kind: 'manual.note', occurredAt: timestamp(-HOUR), goalIds: ['goal-historical'], summary: 'Synthetic historical material remains a candidate for explicit user review.', data: { synthetic: true } }
    ],
    preferences: { timezone: 'America/New_York', quietHours: { start: 22, end: 7 }, dailySurfaceBudget: 4 }, feedback: [], deliveries: [] };
}
