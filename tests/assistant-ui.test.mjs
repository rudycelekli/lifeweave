import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createDemoState, DEMO_CLOCK, compileAssistantResponse, evaluate, validateAssistantResponse } from '@lifeweave/core';
import { createAssistantPanel, renderAssistantResponse } from '../apps/web/workspace-tools.mjs';

const clone = value => structuredClone(value);
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
  for (const key of ['document', 'Element', 'HTMLElement', 'Event']) globalThis[key] = dom.window[key];
  return dom;
}
function send(dom, panel, text) {
  panel.element.querySelector('input').value = text;
  panel.element.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}
function click(root, text) {
  const button = [...root.querySelectorAll('button')].find(item => item.textContent === text);
  assert(button, `Expected button: ${text}`); button.click();
}
function envelope(request = 'What matters today?', state = createDemoState()) {
  return { workspace: 'demo', responseId: 'response-test', response: compileAssistantResponse(state, { request }, { now: DEMO_CLOCK }) };
}

test('single assistant request box makes no startup requests; examples only fill the visible input', () => {
  const dom = fixture(), requests = [], responses = [];
  const panel = createAssistantPanel({ workspace: 'demo', request: (...args) => requests.push(args), isCurrent: () => true, onResponse: value => responses.push(value), onFocus: () => assert.fail('No startup focus') });
  try {
    document.body.append(panel.element);
    assert.equal(panel.element.querySelectorAll('input').length, 1);
    assert.equal(panel.element.querySelector('label').textContent, 'Ask LifeWeave');
    assert.equal(panel.element.querySelector('input').maxLength, 2000);
    assert.equal(panel.element.querySelector('details').open, false);
    assert.equal(panel.pending, false);
    click(panel.element, 'Compare my next steps');
    assert.equal(panel.element.querySelector('input').value, 'Compare my next steps');
    assert.deepEqual(requests, []); assert.deepEqual(responses, []);
  } finally { panel.dispose(); dom.window.close(); }
});

test('brief, progress and comparison render the same recorded values, units, reasons and unknowns', () => {
  const dom = fixture(), state = createDemoState(), before = clone(state);
  try {
    for (const request of ['What matters today?', 'Show my progress', 'Compare my next steps']) {
      const result = envelope(request, state), response = result.response, rendered = renderAssistantResponse(result);
      document.body.replaceChildren(rendered);
      assert.equal(rendered.querySelector('h2').textContent, response.title);
      if (response.table) {
        const table = rendered.querySelector('table');
        assert.equal(table.getAttribute('aria-label'), response.title);
        assert.deepEqual([...table.querySelectorAll('th')].map(cell => cell.textContent), response.table.columns);
        assert([...table.querySelectorAll('th')].every(cell => cell.scope === 'col'));
        const rows = [...table.querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent));
        assert.deepEqual(rows, response.table.rows.map(row => row.values.map((value, index) => value === null ? 'Unknown' : response.table.columns[index] === 'Recorded at' && typeof value === 'string' ? new Date(value).toLocaleString() : String(value))));
      } else {
        assert.deepEqual([...rendered.querySelectorAll('.answer-line p')].map(row => row.textContent), response.facts.map(fact => fact.value === null ? 'Unknown' : String(fact.value)));
      }
      for (const text of response.text) assert(rendered.textContent.includes(text));
      if (response.kind === 'progress') { assert.match(rendered.textContent, /Unknown/); assert.match(rendered.textContent, /hours/); assert.match(rendered.textContent, /USD/); assert.match(rendered.textContent, /5\.9/); }
    }
    assert.deepEqual(state, before);
  } finally { dom.window.close(); }
});

test('ready answer awaits a fresh host review before delivering any result to the response callback', async () => {
  const dom = fixture(), base = envelope('Show my progress'), calls = [], delivered = []; let releaseReview;
  const panel = createAssistantPanel({ workspace: 'demo', isCurrent: () => true, onFocus: () => assert.fail('Not focus'), onResponse: value => delivered.push(value), request: (route, body) => {
    calls.push({ route, body: clone(body) });
    return route.endsWith('/review') ? new Promise(resolve => { releaseReview = resolve; }) : Promise.resolve(clone(base));
  } });
  try {
    document.body.append(panel.element); send(dom, panel, 'Show my progress'); await settle();
    assert.deepEqual(calls, [{ route: '/api/responses', body: { request: 'Show my progress' } }, { route: '/api/responses/review', body: { responseId: base.responseId } }]);
    assert.equal(delivered.length, 0); assert.equal(panel.pending, true);
    const reviewed = clone(base); releaseReview(reviewed); await settle();
    assert.equal(delivered.length, 1); assert.equal(delivered[0], reviewed); assert.equal(panel.pending, false);
    assert.equal(validateAssistantResponse(delivered[0].response, createDemoState(), { now: DEMO_CLOCK }).valid, true);
  } finally { panel.dispose(); dom.window.close(); }
});

test('focus asks exact goal then minute questions and requires an explicit fresh use of its bounded working view', async () => {
  const dom = fixture(), state = createDemoState(), extra = clone(state.goals.find(goal => goal.id === 'goal-learning'));
  extra.id = 'other-learning'; state.goals.push(extra);
  const calls = [], results = [], focused = [], delivered = []; let latest;
  const panel = createAssistantPanel({ workspace: 'demo', isCurrent: () => true, onResponse: value => delivered.push(value), onFocus: value => focused.push(value), request: async (route, body) => {
    calls.push({ route, body: clone(body) });
    if (route.endsWith('/review')) return { ...clone(latest), previewId: 'focus-preview' };
    const response = compileAssistantResponse(state, body, { now: DEMO_CLOCK }); results.push(clone(response));
    latest = { workspace: 'demo', responseId: 'response-focus', response }; return clone(latest);
  } });
  try {
    document.body.append(panel.element); send(dom, panel, 'Help my learning goal for 60 seconds'); await settle();
    assert.equal(results[0].question.kind, 'goal');
    const goal = results[0].question.choices.find(choice => choice.value === 'goal-learning'); click(panel.element, goal.label); await settle();
    assert.deepEqual(calls[1].body, { request: 'Help my learning goal for 60 seconds', answer: { questionId: results[0].question.id, value: 'goal-learning' } });
    assert.equal(results[1].question.kind, 'minutes');
    const minute = results[1].question.choices.find(choice => choice.value === 15); assert(minute); assert.match(minute.label, /15/);
    click(panel.element, minute.label); await settle();
    assert.deepEqual(calls[2].body, { request: 'Help my learning goal for 60 seconds', goalId: 'goal-learning', answer: { questionId: results[1].question.id, value: 15 } });
    assert.match(panel.element.querySelector('.assistant-preview').textContent, /15 minutes/);
    assert.equal(focused.length, 0); assert.equal(delivered.length, 0); assert.equal(calls.length, 3);
    click(panel.element, 'Use this focus view'); await settle();
    assert.deepEqual(calls[3], { route: '/api/responses/review', body: { responseId: 'response-focus' } });
    assert.equal(focused.length, 1); assert.equal(focused[0].previewId, 'focus-preview');
    assert.equal(focused[0].brief.minutes, 15); assert.deepEqual(focused[0].surface, latest.response.surface);
  } finally { panel.dispose(); dom.window.close(); }
});

test('late request results from disposed, changed or foreign workspaces cannot trigger callbacks or review', async () => {
  for (const scenario of ['disposed', 'workspace-changed', 'foreign-envelope']) {
    const dom = fixture(), delivered = [], calls = []; let release, current = true;
    const panel = createAssistantPanel({ workspace: 'demo', isCurrent: () => current, onResponse: value => delivered.push(value), onFocus: value => delivered.push(value), request: route => { calls.push(route); return new Promise(resolve => { release = resolve; }); } });
    try {
      document.body.append(panel.element); send(dom, panel, 'Show my progress');
      if (scenario === 'disposed') panel.dispose(); else if (scenario === 'workspace-changed') current = false;
      const result = envelope('Show my progress'); if (scenario === 'foreign-envelope') result.workspace = 'business';
      release(result); await settle(); assert.equal(delivered.length, 0); assert.deepEqual(calls, ['/api/responses']);
      assert.equal(panel.element.querySelector('.assistant-preview').textContent, '');
    } finally { panel.dispose(); dom.window.close(); }
  }
});

test('changed response, changed review ID, revoked review or stale context during review is refused', async () => {
  for (const scenario of ['response-changed', 'id-changed', 'revoked', 'workspace-changed', 'disposed']) {
    const dom = fixture(), base = envelope(), delivered = []; let release, reject, current = true;
    const panel = createAssistantPanel({ workspace: 'demo', isCurrent: () => current, onResponse: value => delivered.push(value), onFocus: value => delivered.push(value), request: route => route.endsWith('/review') ? new Promise((resolve, refusal) => { release = resolve; reject = refusal; }) : Promise.resolve(clone(base)) });
    try {
      document.body.append(panel.element); send(dom, panel, 'What matters today?'); await settle(); assert.equal(panel.pending, true);
      const checked = clone(base);
      if (scenario === 'response-changed') checked.response.title = 'Changed after preview';
      if (scenario === 'id-changed') checked.responseId = 'another-response';
      if (scenario === 'workspace-changed') current = false;
      if (scenario === 'disposed') panel.dispose();
      if (scenario === 'revoked') reject(new Error('Private health evidence was revoked')); else release(checked);
      await settle(); assert.equal(delivered.length, 0); assert.equal(panel.pending, false);
      assert.doesNotMatch(panel.element.textContent, /Private health evidence was revoked/);
    } finally { panel.dispose(); dom.window.close(); }
  }
});

test('explicit focus use refuses an altered frame, missing host preview or late context invalidation', async () => {
  for (const scenario of ['altered-frame', 'missing-preview', 'workspace-changed', 'disposed']) {
    const dom = fixture(), base = envelope('Help my learning goal for 25 minutes'), focused = [];
    let release, current = true;
    const panel = createAssistantPanel({ workspace: 'demo', isCurrent: () => current, onResponse: () => assert.fail('Not a text answer'), onFocus: value => focused.push(value), request: route => route.endsWith('/review') ? new Promise(resolve => { release = resolve; }) : Promise.resolve(clone(base)) });
    try {
      document.body.append(panel.element); send(dom, panel, 'Help my learning goal for 25 minutes'); await settle();
      assert.equal(base.response.status, 'ready'); click(panel.element, 'Use this focus view'); assert.equal(panel.pending, true);
      const checked = { ...clone(base), previewId: 'host-preview' };
      if (scenario === 'altered-frame') checked.response.surface.title = 'A different focus view';
      if (scenario === 'missing-preview') delete checked.previewId;
      if (scenario === 'workspace-changed') current = false;
      if (scenario === 'disposed') panel.dispose();
      release(checked); await settle(); assert.equal(focused.length, 0); assert.equal(panel.pending, false);
      if (scenario === 'altered-frame' || scenario === 'missing-preview') assert.equal(panel.element.querySelector('.assistant-preview').textContent, '');
    } finally { panel.dispose(); dom.window.close(); }
  }
});

test('working-view buttons pass only the validated current registry frames; unknown executable blocks are rejected', () => {
  const dom = fixture(), state = createDemoState(), result = envelope('Compare my next steps', state), opened = [];
  try {
    const section = renderAssistantResponse(result, { onOpen: surface => opened.push(surface) }); document.body.append(section);
    for (const button of section.querySelectorAll('.response-tools button')) button.click();
    assert.deepEqual(opened, result.response.surfaces);
    const registry = evaluate(state, { now: DEMO_CLOCK, mode: 'replay' }).surfaces;
    for (const surface of opened) assert.deepEqual(surface, registry.find(current => current.id === surface.id));
    const executable = clone(result); executable.response.surfaces[0].blocks.push({ type: 'code', source: 'window.secret()' });
    assert.throws(() => renderAssistantResponse(executable), /Invalid assistant response/);
    const malformed = clone(result); malformed.response.surfaces[0].actions.push({ id: 'injected', label: 'Send', kind: 'external', capability: 'unknown.execute' });
    assert.throws(() => renderAssistantResponse(malformed), /Invalid assistant response/);
  } finally { dom.window.close(); }
});

test('untrusted answer labels, cells and explanatory copy stay inert text with no HTML execution', () => {
  const dom = fixture(), result = envelope('Compare my next steps'), payload = '<img src=x onerror="window.injected=1"><script>window.injected=2</script>';
  try {
    result.response.title = payload; result.response.text[0] = payload;
    result.response.table.columns[1] = payload; result.response.table.rows[0].values[1] = payload;
    result.response.surfaces[0].title = payload;
    assert.equal(validateAssistantResponse(result.response).valid, true);
    const section = renderAssistantResponse(result); document.body.append(section);
    assert(section.textContent.includes(payload)); assert.equal(section.querySelectorAll('img,script').length, 0);
    assert.equal(dom.window.injected, undefined); assert.equal(section.querySelector('h2').textContent, payload);
    assert.equal(section.querySelectorAll('th')[1].textContent, payload);
    assert.equal(section.querySelectorAll('tbody tr')[0].querySelectorAll('td')[1].textContent, payload);
  } finally { dom.window.close(); }
});
