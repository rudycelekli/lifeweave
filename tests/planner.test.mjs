import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, DEMO_CLOCK } from '../packages/core/src/index.mjs';
import { createModelPlanner, ModelPlannerError } from '../packages/planner/src/index.mjs';

const endpoint = 'http://127.0.0.1:11434/v1/chat/completions';
const clone = (value) => JSON.parse(JSON.stringify(value));
const input = (state = createDemoState()) => ({ state, goalId: 'goal-learning', request: 'Make this scenario easier to scan.', now: DEMO_CLOCK });
const reply = (frame) => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(frame) } }] }), { headers: { 'Content-Type': 'application/json' } });
function mockPlanner(change = () => {}, options = {}) {
  const calls = [];
  const planner = createModelPlanner({ endpoint, model: 'test-model', ...options, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    const frame = clone(JSON.parse(JSON.parse(init.body).messages[1].content).baseSurface);
    change(frame); return reply(frame);
  } });
  return { planner, calls };
}

test('actual mocked chatcompletion produces a review-only grounded presentation proposal', async () => {
  const { planner, calls } = mockPlanner((frame) => { frame.title = 'Pick a focused session'; frame.blocks.reverse(); frame.blocks.find((block) => block.type === 'calculator').inputs[0].value = 30; });
  const state = createDemoState(), before = JSON.stringify(state), proposal = await planner.propose(input(state));
  assert.equal(proposal.requiresReview, true);
  assert.deepEqual(proposal.provenance, { kind: 'model-proposal', model: 'test-model', requestCount: 1 });
  assert.equal(proposal.surface.goalId, 'goal-learning');
  assert.equal(proposal.surface.title, 'Pick a focused session');
  assert.equal(JSON.stringify(state), before);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, endpoint);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(JSON.parse(calls[0].init.body).response_format.type, 'json_object');
});

test('loopback endpoint allowlist rejects arbitrary URLs, embedded credentials, redirect targets and unapproved disclosure', () => {
  for (const target of ['http://example.invalid/v1/chat/completions', 'https://example.invalid/v1/chat/completions', 'http://127.0.0.1:11434/other',
    'http://user:password@localhost/v1/chat/completions', `${endpoint}?key=secret`, `${endpoint}#fragment`, 'file:///v1/chat/completions']) {
    assert.throws(() => createModelPlanner({ endpoint: target, model: 'm', fetchImpl: () => {} }), ModelPlannerError);
  }
  assert.throws(() => createModelPlanner({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'm', allowRemote: true }), /endpoint-not-authorized/);
  assert.throws(() => createModelPlanner({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'm', allowDisclosure: true }), /endpoint-not-authorized/);
  assert.doesNotThrow(() => createModelPlanner({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'm', allowRemote: true, allowDisclosure: true, fetchImpl: () => {} }));
  assert.doesNotThrow(() => createModelPlanner({ endpoint: 'http://[::1]:11434/v1/chat/completions', model: 'm', fetchImpl: () => {} }));
});

test('only selected current policy-valid base frame reaches prompt; raw content and unrelated data are withheld', async () => {
  const state = createDemoState();
  state.observations[0].summary = 'Private unrelated career mail must not leave';
  state.observations[0].data.body = 'Private raw message body';
  state.observations[0].data.accessToken = 'raw-observation-token';
  state.connections[2].status = 'disconnected';
  const { planner, calls } = mockPlanner(); await planner.propose(input(state));
  const body = calls[0].init.body;
  for (const privateData of ['Private unrelated', 'Private raw', 'raw-observation-token', 'demo-sleep', 'demo-health', 'health.sleep.read']) assert(!body.includes(privateData));
  assert(!body.includes('connections'));
  assert(!body.includes('observations'));
  const career = mockPlanner(); await career.planner.propose({ ...input(state), goalId: 'goal-career' });
  assert(!career.calls[0].init.body.includes('Private unrelated career mail'));
  assert(career.calls[0].init.body.includes('Recorded evidence item 1'));
});

test('credentials remain auth header only; secret echo/input/transport errors never expose them', async () => {
  const key = 'host-secret-test-key';
  const good = mockPlanner(() => {}, { apiKey: key });
  const result = await good.planner.propose(input());
  assert.equal(good.calls[0].init.headers.Authorization, `Bearer ${key}`);
  assert(!good.calls[0].init.body.includes(key));
  assert(!JSON.stringify(result).includes(key));
  const blocked = mockPlanner(() => {}, { apiKey: key });
  await assert.rejects(blocked.planner.propose({ ...input(), request: `Please include ${key}` }), /credential-in-prompt/);
  assert.equal(blocked.calls.length, 0);
  const echo = mockPlanner((frame) => { frame.title = key; }, { apiKey: key });
  await assert.rejects(echo.planner.propose(input()), (error) => error.code === 'credential-in-response' && !error.message.includes(key));
  const failed = createModelPlanner({ endpoint, model: 'm', apiKey: key, fetchImpl: async () => { throw new Error(`Private failure ${key}`); } });
  await assert.rejects(failed.propose(input()), (error) => error.code === 'model-transport-failed' && !error.message.includes(key) && error.cause === undefined);
});

test('candidate, disconnected, stale, future, and evidence-free goals never trigger model requests', async () => {
  for (const mutate of [
    (s) => { s.goals[1].status = 'candidate'; }, (s) => { s.connections[1].status = 'disconnected'; },
    (s) => { s.observations[1].occurredAt = '2026-10-01T16:00:00Z'; },
    (s) => { s.observations[1].occurredAt = '2026-10-14T16:00:00Z'; },
    (s) => { s.observations[1].kind = 'calendar.event'; },
    (s) => { s.observations[1].tenantId = 'foreign'; }
  ]) {
    const state = createDemoState(); mutate(state); const { planner, calls } = mockPlanner();
    await assert.rejects(planner.propose(input(state)), ModelPlannerError); assert.equal(calls.length, 0);
  }
});

test('interactive intent bypasses display gates only, never revoked health permission', async () => {
  const state = createDemoState(); state.preferences.dailySurfaceBudget = 0;
  const closed = mockPlanner(); await assert.rejects(closed.planner.propose(input(state)), /no-current-grounded-surface/); assert.equal(closed.calls.length, 0);
  const interactive = mockPlanner(); const proposal = await interactive.planner.propose({ ...input(state), interactive: true }); assert.equal(proposal.requiresReview, true);
  state.connections[2].status = 'disconnected';
  const health = mockPlanner(); await assert.rejects(health.planner.propose({ ...input(state), goalId: 'goal-wellbeing', interactive: true }), /no-current-grounded-surface/); assert.equal(health.calls.length, 0);
  const night = '2026-10-14T02:30:00Z', quiet = createDemoState(night);
  const proactive = mockPlanner(); await assert.rejects(proactive.planner.propose({ ...input(quiet), now: night }), /no-current-grounded-surface/); assert.equal(proactive.calls.length, 0);
  const requested = mockPlanner(); assert.equal((await requested.planner.propose({ ...input(quiet), now: night, interactive: true })).requiresReview, true);
});

test('context, evidence, priority, expiration and actions cannot be forged', async () => {
  for (const mutate of [
    (s) => { s.goalId = 'goal-historical'; }, (s) => { s.id = 'forged-id'; },
    (s) => { s.evidenceRefs = ['invented-source']; }, (s) => { s.priority += 1; },
    (s) => { s.confidence = 0.999; }, (s) => { s.expiresAt = '2099-01-01T00:00:00Z'; },
    (s) => { s.tenantId = 'foreign'; }, (s) => { s.actions[0].kind = 'external'; s.actions[0].capability = 'computer.use'; s.actions[0].requiresApproval = true; },
    (s) => { s.blocks.push({ type: 'text', text: 'Invented facts' }); }
  ]) { const { planner } = mockPlanner(mutate); await assert.rejects(planner.propose(input()), ModelPlannerError); }
});

test('measured numeric values, timeline timestamps, trend points and calculator structures are fixed', async () => {
  for (const mutate of [
    (s) => { s.blocks.find((b) => b.type === 'metric').value = 999; },
    (s) => { s.blocks.find((b) => b.type === 'metric').unit = 'earned dollars'; },
    (s) => { s.blocks.find((b) => b.type === 'timeline').items[0].at = '2026-10-13T12:00:00Z'; },
    (s) => { s.blocks.find((b) => b.type === 'calculator').inputs[0].max = 1000; },
    (s) => { s.blocks.find((b) => b.type === 'calculator').outputs[0].expression = 10000; },
    (s) => { s.blocks.find((b) => b.type === 'calculator').inputs[0].value = 1000; }
  ]) { const { planner } = mockPlanner(mutate); await assert.rejects(planner.propose(input()), ModelPlannerError); }
  const health = mockPlanner((s) => { s.blocks.find((b) => b.type === 'trend').points[0].value = 8; });
  await assert.rejects(health.planner.propose({ ...input(), goalId: 'goal-wellbeing' }), /fabricated-measurement/);
});

test('single lifetime request cap includes failures and disallows hidden retries', async () => {
  const { planner, calls } = mockPlanner(); await planner.propose(input()); await assert.rejects(planner.propose(input()), /request-budget-exhausted/); assert.equal(calls.length, 1);
  const zero = mockPlanner(() => {}, { maxRequests: 0 }); await assert.rejects(zero.planner.propose(input()), /request-budget-exhausted/); assert.equal(zero.calls.length, 0);
  let attempts = 0; const failure = createModelPlanner({ endpoint, model: 'm', fetchImpl: async () => { attempts++; return new Response('do not echo', { status: 500 }); } });
  await assert.rejects(failure.propose(input()), /model-http-failed/); await assert.rejects(failure.propose(input()), /request-budget-exhausted/); assert.equal(attempts, 1);
});

test('timeout works even when injected transport ignores abort; no retry occurs', async () => {
  let signal, count = 0;
  const planner = createModelPlanner({ endpoint, model: 'm', timeoutMs: 10, fetchImpl: async (_url, init) => { signal = init.signal; count++; return new Promise(() => {}); } });
  await assert.rejects(planner.propose(input()), /timeout/);
  assert.equal(signal.aborted, true); assert.equal(count, 1); assert.equal(planner.requestCount, 1);
});

test('provider tool calls, markdown, malformed JSON and oversized responses are refused', async () => {
  for (const response of [
    new Response('invalid JSON'), new Response(JSON.stringify({ choices: [{ message: { content: '```json {} ```' } }] })),
    new Response(JSON.stringify({ choices: [{ message: { content: '{}', tool_calls: [{ name: 'sendMail' }] } }] })),
    new Response('x'.repeat(128001))
  ]) {
    const planner = createModelPlanner({ endpoint, model: 'm', fetchImpl: async () => response });
    await assert.rejects(planner.propose(input()), ModelPlannerError);
  }
});

test('consent revoked during model await invalidates otherwise valid response', async () => {
  const state = createDemoState();
  const planner = createModelPlanner({ endpoint, model: 'm', fetchImpl: async (_url, init) => {
    const base = JSON.parse(JSON.parse(init.body).messages[1].content).baseSurface;
    state.connections[1].status = 'disconnected'; return reply(base);
  } });
  await assert.rejects(planner.propose(input(state)), /grounding-changed/);
});
