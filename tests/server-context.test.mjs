import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalServer } from '../apps/web/server.mjs';
import { createDemoState } from '../packages/core/src/demo.mjs';

const NOW = '2026-10-13T16:00:00.000Z';
async function client(local) {
  const bootstrap = await fetch(`${local.origin}/api/bootstrap`);
  const cookie = bootstrap.headers.get('set-cookie').split(';')[0], csrf = (await bootstrap.json()).csrfToken;
  return async (route, { mode = 'demo', body, headers = {} } = {}) => {
    const response = await fetch(`${local.origin}${route}?workspace=${mode}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie,
        ...(body === undefined ? {} : { Origin: local.origin, 'Content-Type': 'application/json', 'X-Lifeweave-Csrf': csrf }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, value: await response.json() };
  };
}
async function fixture({ state, clock = () => NOW } = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lifeweave-context-api-'));
  if (state) await fs.writeFile(path.join(dataDir, 'demo.json'), JSON.stringify(state), { mode: 0o600 });
  let local = await createLocalServer({ port: 0, dataDir, clock, intervalMs: 60000 }), request = await client(local), closed = false;
  return {
    dataDir, get request() { return request; }, get status() { return local.status; },
    restart: async () => { await local.close(); closed = true; local = await createLocalServer({ port: 0, dataDir, clock, intervalMs: 60000 }); closed = false; request = await client(local); },
    cleanup: async () => { if (!closed) { await local.close(); closed = true; } await fs.rm(dataDir, { recursive: true, force: true }); }
  };
}
const snap = async (f, mode = 'demo') => (await f.request('/api/state', { mode })).value;
const focusInput = frame => frame.blocks.find(block => block.type === 'calculator').inputs.find(input => input.id === 'focusMinutes');

test('loopback intent continues goal then time clarification and saves only a constrained local draft', async () => {
  const state = createDemoState(), extra = structuredClone(state.goals.find(goal => goal.id === 'goal-learning'));
  extra.id = 'second-learning'; extra.title = 'Read a technical book'; state.goals.push(extra);
  const f = await fixture({ state });
  try {
    const request = 'Help my learning goal for 15 minutes and 30 seconds';
    const first = await f.request('/api/intent', { body: { request } });
    assert.equal(first.status, 200); assert.equal(first.value.question.kind, 'goal'); assert.equal(first.value.previewId, undefined);
    const next = await f.request('/api/intent', { body: { request, answer: { questionId: first.value.question.id, value: 'goal-learning' } } });
    assert.equal(next.status, 200); assert.equal(next.value.question.kind, 'minutes'); assert.equal(next.value.brief.goalId, 'goal-learning');
    const ready = await f.request('/api/intent', { body: { request, goalId: next.value.brief.goalId, answer: { questionId: next.value.question.id, value: 15 } } });
    assert.equal(ready.status, 200); assert.equal(ready.value.status, 'ready'); assert.ok(ready.value.previewId);
    assert.equal(focusInput(ready.value.surface).max, 15); assert.equal(ready.value.brief.minutes, 15);
    assert.equal((await f.request('/api/intent/review', { body: { previewId: ready.value.previewId } })).status, 200);
    const surface = ready.value.surface, draft = { surfaceId: surface.id, actionId: surface.actions[0].id, text: 'A bounded synthetic focus draft', intentPreviewId: ready.value.previewId };
    assert.equal((await f.request('/api/plans', { body: { ...draft, focusMinutes: 20 } })).status, 400);
    assert.equal((await f.request('/api/plans', { body: { ...draft, focusMinutes: 15 } })).status, 200);
    const plan = (await f.request('/api/plans')).value.plans[0];
    assert.equal(plan.focusMinutes, 15); assert.equal(plan.requestedMinutes, 15); assert.equal(plan.status, 'draft');
    assert.equal(f.status.externalActions, 0);
    assert.equal((await f.request('/api/model')).value.configured, false);
  } finally { await f.cleanup(); }
});

test('intent previews reject cross-workspace use, source revocation, elapsed expiry and feedback changes', async () => {
  let now = NOW;
  const f = await fixture({ clock: () => now });
  try {
    const requested = { request: 'Help my learning goal for 30 minutes' };
    const first = (await f.request('/api/intent', { body: requested })).value;
    assert.equal(first.status, 'ready');
    assert.equal((await f.request('/api/intent/review', { mode: 'personal', body: { previewId: first.previewId } })).status, 400);
    assert.equal((await f.request('/api/plans', { mode: 'business', body: { surfaceId: first.surface.id, actionId: first.surface.actions[0].id,
      text: 'Foreign preview', focusMinutes: 15, intentPreviewId: first.previewId } })).status, 400);
    assert.equal((await snap(f, 'business')).state.plans?.length || 0, 0);
    await f.request('/api/feedback', { body: { surfaceId: first.surface.id, kind: 'dismiss' } });
    assert.equal((await f.request('/api/intent/review', { body: { previewId: first.previewId } })).status, 400);
    await f.request('/api/reset-demo', { body: {} });
    const second = (await f.request('/api/intent', { body: requested })).value;
    await f.request('/api/revoke', { body: { connectorId: 'demo-calendar' } });
    assert.equal((await f.request('/api/intent/review', { body: { previewId: second.previewId } })).status, 400);
    assert.equal((await f.request('/api/intent', { body: requested })).value.status, 'unavailable');
    await f.request('/api/reset-demo', { body: {} });
    const third = (await f.request('/api/intent', { body: requested })).value;
    now = third.surface.expiresAt;
    assert.equal((await f.request('/api/intent/review', { body: { previewId: third.previewId } })).status, 400);
    assert.equal(f.status.externalActions, 0);
  } finally { await f.cleanup(); }
});

test('clarification answers reject stale or foreign choice IDs through the actual API', async () => {
  const f = await fixture();
  try {
    const request = 'Help my learning goal for half an hour', first = (await f.request('/api/intent', { body: { request } })).value;
    assert.equal(first.question.kind, 'minutes');
    for (const answer of [{ questionId: 'iq-stale', value: 15 }, { questionId: first.question.id, value: '15' },
      { questionId: first.question.id, value: 14 }, { questionId: first.question.id, value: 'goal-historical' }]) {
      assert.equal((await f.request('/api/intent', { body: { request, answer } })).status, 400);
    }
    assert.equal((await f.request('/api/intent', { mode: 'personal', body: { request, answer: { questionId: first.question.id, value: 15 } } })).status, 400);
    assert.equal((await f.request('/api/intent', { body: { request, minutes: 15 } })).value.status, 'needs-clarification');
    const before = (await snap(f)).state;
    assert.equal((await f.request('/api/intent', { body: { request, answer: { questionId: first.question.id, value: 15 } } })).value.status, 'ready');
    assert.deepEqual((await snap(f)).state, before);
  } finally { await f.cleanup(); }
});

test('ongoing focus preview tolerates subminute clock drift but rejects a changed measured window', async () => {
  let now = NOW;
  const state = createDemoState(), slot = state.observations.find(record => record.kind === 'calendar.availability');
  slot.data.startsAt = new Date(Date.parse(NOW) - 5 * 60000).toISOString();
  // Leave thirty seconds of margin so a 500ms advance changes only the
  // derived current start timestamp, not the measured whole-minute capacity.
  slot.data.endsAt = new Date(Date.parse(NOW) + 60 * 60000 + 30000).toISOString();
  const f = await fixture({ state, clock: () => now });
  try {
    const ready = await f.request('/api/intent', { body: { request: 'Help my learning goal for 25 minutes' } });
    assert.equal(ready.status, 200); assert.equal(ready.value.status, 'ready');
    assert.equal(ready.value.surface.blocks.find(block => block.type === 'metric' && block.unit === 'minutes').value, 60);
    now = new Date(Date.parse(NOW) + 500).toISOString();
    assert.equal((await f.request('/api/intent/review', { body: { previewId: ready.value.previewId } })).status, 200);
    now = new Date(Date.parse(NOW) + 61000).toISOString();
    assert.equal((await f.request('/api/intent/review', { body: { previewId: ready.value.previewId } })).status, 400);
    assert.equal((await f.request('/api/plans', { body: { surfaceId: ready.value.surface.id, actionId: ready.value.surface.actions[0].id,
      text: 'Expired measured capacity must be reviewed again', focusMinutes: 25, intentPreviewId: ready.value.previewId } })).status, 400);
    assert.equal((await f.request('/api/plans')).value.plans?.length || 0, 0);
  } finally { await f.cleanup(); }
});

test('gap confirmation adds explicit immutable correction overlays, persists them and rechecks source consent', async () => {
  const state = createDemoState(), original = state.observations.find(record => record.kind === 'mail.commitment');
  original.data = {};
  const raw = structuredClone(original), f = await fixture({ state });
  try {
    const gaps = (await f.request('/api/context-gaps')).value.gaps, due = gaps.find(gap => gap.field === 'dueAt');
    const value = '2026-10-12T16:00:00.000Z';
    assert.equal((await snap(f)).queue.surfaces.some(frame => frame.ruleId === 'overdue-commitment'), false);
    const suggested = await f.request('/api/context-gaps/resolve', { body: { gapId: due.id, value } });
    assert.equal(suggested.status, 200); assert.equal(suggested.value.requiresConfirmation, true); assert.equal(suggested.value.patch.fields.dueAt, value);
    assert.deepEqual((await snap(f)).state.observations.find(record => record.id === raw.id), raw);
    assert.equal((await f.request('/api/context-gaps/confirm', { body: { gapId: due.id, value, confirmed: false } })).status, 400);
    assert.equal((await f.request('/api/context-gaps/confirm', { mode: 'business', body: { gapId: due.id, value, confirmed: true } })).status, 400);
    assert.equal((await f.request('/api/context-gaps/confirm', { body: { gapId: due.id, value, confirmed: true } })).status, 200);
    assert.equal((await f.request('/api/context-gaps/confirm', { body: { gapId: due.id, value, confirmed: true } })).status, 400);
    const completed = (await f.request('/api/context-gaps')).value.gaps.find(gap => gap.field === 'completed');
    assert.equal((await f.request('/api/context-gaps/confirm', { body: { gapId: completed.id, value: false, confirmed: true } })).status, 200);
    const corrected = (await snap(f)).state;
    assert.deepEqual(corrected.observations.find(record => record.id === raw.id), raw);
    assert.equal(corrected.contextCorrections.length, 2);
    assert.equal((await snap(f)).queue.surfaces.some(frame => frame.ruleId === 'overdue-commitment'), true);
    await f.restart();
    assert.deepEqual((await snap(f)).state.contextCorrections, corrected.contextCorrections);
    assert.deepEqual((await snap(f)).state.observations.find(record => record.id === raw.id), raw);
    const stored = JSON.parse(await fs.readFile(path.join(f.dataDir, 'demo.json'), 'utf8'));
    assert.deepEqual(stored.observations.find(record => record.id === raw.id), raw);
    assert.equal((await fs.stat(path.join(f.dataDir, 'demo.json'))).mode & 0o777, 0o600);
    await f.request('/api/revoke', { body: { connectorId: raw.connectorId } });
    const revoked = (await snap(f)).state;
    assert.equal(revoked.observations.some(record => record.id === raw.id), false);
    assert.equal(revoked.contextCorrections.length, 0);
    assert.equal((await f.request('/api/context-gaps/confirm', { body: { gapId: completed.id, value: false, confirmed: true } })).status, 400);
  } finally { await f.cleanup(); }
});

test('exact missing-fact pause persists without consuming surface feedback or accepting foreign gaps', async () => {
  const state = createDemoState(); state.observations.find(record => record.kind === 'mail.commitment').data = {};
  const f = await fixture({ state });
  try {
    const gap = (await f.request('/api/context-gaps')).value.gaps.find(item => item.field === 'dueAt');
    const before = (await snap(f)).state.feedback;
    assert.equal((await f.request('/api/context-gaps/feedback', { mode: 'personal', body: { gapId: gap.id, kind: 'pause' } })).status, 400);
    assert.equal((await f.request('/api/context-gaps/feedback', { body: { gapId: gap.id, kind: 'pause' } })).status, 200);
    assert.equal((await f.request('/api/context-gaps')).value.gaps.some(item => item.id === gap.id), false);
    assert.deepEqual((await snap(f)).state.feedback, before);
    await f.restart();
    assert.equal((await f.request('/api/context-gaps')).value.gaps.some(item => item.id === gap.id), false);
    assert.deepEqual((await snap(f)).state.feedback, before);
    assert.equal((await f.request('/api/context-gaps/resolve', { body: { gapId: gap.id, value: NOW } })).value.status, 'unavailable');
  } finally { await f.cleanup(); }
});

test('a user outcome report mints no measurement; only distinct later evidence yields a noncausal delta and survives restart', async () => {
  let now = NOW;
  const f = await fixture({ clock: () => now });
  try {
    const mode = 'personal', goalId = 'g-progress';
    assert.equal((await f.request('/api/goals', { mode, body: { id: goalId, title: 'Practice a skill', dimension: 'learning', priority: 70,
      metric: { key: 'sessions', target: 10, unit: 'sessions', direction: 'increase' } } })).status, 200);
    await f.request('/api/local-consent', { mode, body: { health: false } });
    const measured = (id, value, occurredAt) => ({ id, tenantId: 'local', connectorId: 'local-import', kind: 'metric.update', occurredAt,
      goalIds: [goalId], summary: 'Explicit synthetic session measurement', metrics: { sessions: value }, data: {} });
    await f.request('/api/observations', { mode, body: { observations: [measured('baseline', 2, now)] } });
    const surface = (await snap(f, mode)).queue.surfaces.find(frame => frame.ruleId === 'metric-checkin');
    assert.equal((await f.request('/api/plans', { mode, body: { surfaceId: surface.id, actionId: surface.actions[0].id, text: 'Synthetic skill practice draft' } })).status, 200);
    const plan = (await f.request('/api/plans', { mode })).value.plans[0], before = (await snap(f, mode)).state;
    assert.equal(plan.baseline.value, 2);
    assert.equal((await f.request('/api/outcomes', { mode: 'business', body: { planId: plan.id, usefulness: 'useful' } })).status, 400);
    assert.equal((await f.request('/api/outcomes', { mode, body: { planId: plan.id, note: 'I completed eight sessions', effortMinutes: 20, usefulness: 'useful' } })).status, 200);
    const reported = (await f.request('/api/outcomes', { mode })).value.entries[0];
    assert.equal(reported.status, 'reported'); assert.equal(reported.latest, null); assert.equal(reported.delta, null); assert.equal(reported.attribution, 'not-established');
    assert.deepEqual((await snap(f, mode)).state.observations, before.observations); assert.deepEqual((await snap(f, mode)).state.goals, before.goals);
    assert.equal((await f.request('/api/outcomes', { mode, body: { planId: plan.id, measurementObservationId: 'baseline' } })).status, 400);
    now = '2026-10-13T16:01:00.000Z';
    assert.equal((await f.request('/api/observations', { mode, body: { observations: [measured('later-measurement', 8, now)] } })).status, 200);
    now = '2026-10-13T16:02:00.000Z';
    assert.equal((await f.request('/api/outcomes', { mode, body: { planId: plan.id, usefulness: 'useful', measurementObservationId: 'later-measurement' } })).status, 200);
    const ledger = (await f.request('/api/outcomes', { mode })).value, entry = ledger.entries[0];
    assert.equal(entry.status, 'measured'); assert.equal(entry.baseline.value, 2); assert.equal(entry.latest.value, 8); assert.equal(entry.delta, 6);
    assert.equal(entry.attribution, 'not-established'); assert.equal(ledger.stats.measured, 1); assert.equal(ledger.stats.comparable, 1);
    const durable = (await snap(f, mode)).state;
    await f.restart();
    assert.deepEqual((await snap(f, mode)).state.outcomes, durable.outcomes); assert.deepEqual((await snap(f, mode)).state.observations, durable.observations);
    assert.equal((await f.request('/api/outcomes', { mode })).value.entries[0].delta, 6);
    await f.request('/api/revoke', { mode, body: { connectorId: 'local-import' } });
    const revoked = (await snap(f, mode)).state;
    assert.equal(revoked.observations.length, 0); assert.equal(revoked.plans.length, 0); assert.equal(revoked.outcomes.length, 0);
    assert.equal((await f.request('/api/outcomes', { mode })).value.entries.length, 0);
  } finally { await f.cleanup(); }
});

test('new local context endpoints reject unknown authority fields and bad CSRF without changing durable state', async () => {
  const f = await fixture();
  try {
    const before = (await snap(f)).state;
    for (const [route, body] of [
      ['/api/intent', { request: 'Help my learning goal', permissions: ['computer.use'] }],
      ['/api/intent', { request: 'Help my learning goal for half an hour', answer: { questionId: 'iq-forged', value: 15, confirmed: true } }],
      ['/api/intent/review', { previewId: 'intent-forged', authorize: true }],
      ['/api/context-gaps/resolve', { gapId: 'cg-forged', value: NOW, tenantId: 'other' }],
      ['/api/context-gaps/confirm', { gapId: 'cg-forged', value: NOW, confirmed: true, scopes: ['mail.read'] }],
      ['/api/context-gaps/feedback', { gapId: 'cg-forged', kind: 'pause', until: NOW }],
      ['/api/context-entities', { kind: 'person', label: 'Synthetic person', goalIds: ['goal-learning'], tenantId: 'other' }],
      ['/api/outcomes', { planId: 'plan-forged', usefulness: 'useful', metrics: { sessions: 8 } }]
    ]) assert.equal((await f.request(route, { body })).status, 400, route);
    assert.equal((await f.request('/api/intent', { body: { request: 'Help my learning goal' }, headers: { 'X-Lifeweave-Csrf': 'wrong' } })).status, 403);
    assert.deepEqual((await snap(f)).state, before);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.dataDir, 'demo.json'), 'utf8')), before);
    assert.equal(f.status.externalActions, 0);
  } finally { await f.cleanup(); }
});
