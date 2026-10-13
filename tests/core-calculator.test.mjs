import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, DEMO_CLOCK, evaluate, evaluateExpression, validateSurface, ValidationError } from '../packages/core/src/index.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const focusFrame = () => evaluate(createDemoState(), { now: DEMO_CLOCK }).surfaces.find((frame) => frame.ruleId === 'focus-opportunity');
const calculator = (frame) => frame.blocks.find((block) => block.type === 'calculator');
const expression = (op, ...args) => ({ op, args });

test('arithmetic evaluator matches independent expected results for every operator', () => {
  for (const [op, args, expected] of [
    ['add', [2, 3, 4], 9], ['subtract', [2, 3], -1], ['multiply', [2, 3, 4], 24],
    ['divide', [12, 4], 3], ['min', [9, 2, -1], -1], ['max', [9, 2, -1], 9]
  ]) assert.equal(evaluateExpression({ op, args }, {}), expected, op);
  const estimate = expression('multiply', expression('divide', { var: 'minutes' }, 60), { var: 'unitsPerHour' });
  assert.equal(evaluateExpression(estimate, { minutes: 90, unitsPerHour: 4 }), 6);
  assert.equal(evaluateExpression(17.5, {}), 17.5);
});

test('focus scenario is bounded and live perturbations change output without measured progress credit', () => {
  const state = createDemoState(), before = JSON.stringify(state), frame = focusFrame(), block = calculator(frame);
  assert.equal(validateSurface(frame).valid, true);
  assert.deepEqual(block.inputs[0], { id: 'focusMinutes', label: 'Focused work minutes', value: 25, min: 5, max: 60, step: 5, unit: 'minutes' });
  const output = block.outputs[0].expression;
  let previous = Infinity;
  for (const [input, expected] of [[5, 55], [25, 35], [40, 20], [60, 0]]) {
    const remaining = evaluateExpression(output, { focusMinutes: input });
    assert.equal(remaining, expected);
    assert.equal(remaining + input, 60); // Independent conservation constraint.
    assert(remaining < previous); previous = remaining;
  }
  assert.equal(JSON.stringify(state), before);
  assert(!JSON.stringify(block).includes('focusMinutesCompleted'));
});

test('zero divisors, nonfinite variables, and arithmetic overflow fail closed', () => {
  for (const [expr, variables] of [
    [expression('divide', 3, 0), {}], [expression('divide', 3, -0), {}],
    [expression('multiply', Number.MAX_VALUE, 2), {}],
    [{ var: 'x' }, { x: Infinity }], [{ var: 'x' }, { x: NaN }], [Infinity, {}]
  ]) assert.throws(() => evaluateExpression(expr, variables), ValidationError);
});

test('expression AST forbids executable fields, globals, extra keys, wrong arity, and unknown variables', () => {
  for (const expr of [
    'globalThis.fetch("https://invalid.example")',
    { op: 'eval', args: ['process.env'] },
    { var: 'x', code: 'sendSecrets()' },
    { op: 'add', args: [1, 2], instructions: 'run a tool' },
    { var: 'globalThis' },
    { var: 'constructor' },
    { op: 'subtract', args: [1] },
    { op: 'divide', args: [1, 2, 3] },
    { op: 'min', args: [] },
    { op: 'multiply', args: Array(9).fill(1) }
  ]) assert.throws(() => evaluateExpression(expr, { x: 3 }), ValidationError);
  assert.throws(() => evaluateExpression({ var: 'x' }, JSON.parse('{"x":3,"__proto__":{"admin":true}}')), ValidationError);
  let invoked = false;
  const vars = {}; Object.defineProperty(vars, 'x', { enumerable: true, get() { invoked = true; return 4; } });
  assert.throws(() => evaluateExpression({ var: 'x' }, vars), ValidationError);
  assert.equal(invoked, false);
});

test('expression depth and node budgets enforce exact useful boundary cases', () => {
  let tree = 1;
  for (let i = 0; i < 5; i++) tree = expression('add', tree, 1);
  assert.equal(evaluateExpression(tree, {}), 6); // Root-to-leaf depth 6.
  const frame = focusFrame(); calculator(frame).outputs[0].expression = tree;
  assert.equal(validateSurface(frame).valid, true); // JSON envelope must not reject legal AST depth.
  assert.throws(() => evaluateExpression(expression('add', tree, 1), {}), /depth/);
  calculator(frame).outputs[0].expression = expression('add', tree, 1);
  assert.equal(validateSurface(frame).valid, false);
  const wide = expression('add', ...Array.from({ length: 8 }, () => expression('add', ...Array(8).fill(1))));
  assert.equal(evaluateExpression(wide, {}), 64); // 73 nodes.
  const oversized = clone(wide); oversized.args[0].args[0] = expression('add', ...Array(8).fill(1)); // 81 nodes.
  assert.throws(() => evaluateExpression(oversized, {}), /nodes/);
  const collective = focusFrame(), block = calculator(collective);
  block.outputs = [{ id: 'a', label: 'A', unit: 'units', expression: wide }, { id: 'b', label: 'B', unit: 'units', expression: wide }];
  assert.equal(validateSurface(collective).valid, false); // Budget applies across every output.
});

test('calculator block validates bounds, default outputs, unique IDs, counts, and authority fields', () => {
  const original = focusFrame();
  for (const mutate of [
    (b) => { b.inputs[0].value = 61; }, (b) => { b.inputs[0].min = 61; },
    (b) => { b.inputs[0].max = Infinity; }, (b) => { b.inputs[0].step = 0; },
    (b) => { b.inputs[0].id = 'constructor'; },
    (b) => { b.inputs.push(clone(b.inputs[0])); },
    (b) => { b.inputs = Array.from({ length: 9 }, (_, i) => ({ ...b.inputs[0], id: `in-${i}` })); },
    (b) => { b.outputs = []; },
    (b) => { b.outputs.push(clone(b.outputs[0])); },
    (b) => { b.outputs[0].id = b.inputs[0].id; },
    (b) => { b.outputs[0].expression = { var: 'notDefined' }; },
    (b) => { b.outputs[0].expression = expression('divide', 1, 0); },
    (b) => { b.inputs[0].onChange = 'runComputer()'; },
    (b) => { b.outputs[0].capability = 'mail.send'; }
  ]) { const frame = clone(original); mutate(calculator(frame)); assert.equal(validateSurface(frame).valid, false); }
});

test('arithmetic intervention audit checks independent linear identities across 81 inputs', () => {
  // An evaluator defect in variable lookup, operation order, or nesting violates these identities.
  const expr = expression('subtract', expression('multiply', expression('add', { var: 'x' }, 3), 4), 2);
  for (let x = -10; x <= 10; x += 0.25) {
    assert.equal(evaluateExpression(expr, { x }), 4 * x + 10);
  }
});
