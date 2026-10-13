import { finiteNumber, isId, isRecord, isText, jsonIssues, ValidationError } from '../../shared/validation.mjs';

const OPERATORS = Object.freeze({ add: [2, 8], subtract: [2, 2], multiply: [2, 8], divide: [2, 2], min: [2, 8], max: [2, 8] });
const MAX_DEPTH = 6, MAX_NODES = 80;
const isVariableId = (value) => isId(value) && !['constructor', 'prototype', '__proto__'].includes(value);
function keysAre(record, expected) {
  const keys = Object.keys(record);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

// All callers first reject accessors, prototypes, cycles, and excessive JSON depth.
export function expressionIssues(expression, variableIds, path = 'expression', budget = { nodes: 0 }, depth = 1) {
  budget.nodes += 1;
  if (depth > MAX_DEPTH) return [`${path}: expression depth exceeds ${MAX_DEPTH}`];
  if (budget.nodes > MAX_NODES) return [`${path}: expression nodes exceed ${MAX_NODES}`];
  if (finiteNumber(expression)) return [];
  if (!isRecord(expression)) return [`${path}: finite number or expression node required`];
  if (Object.hasOwn(expression, 'var')) {
    if (!keysAre(expression, ['var']) || !isVariableId(expression.var)) return [`${path}: variable node must contain only a valid var identifier`];
    return variableIds.has(expression.var) ? [] : [`${path}: unknown input ${expression.var}`];
  }
  if (!keysAre(expression, ['op', 'args']) || !Object.hasOwn(OPERATORS, expression.op) || !Array.isArray(expression.args)) return [`${path}: known arithmetic operator and args only required`];
  const [min, max] = OPERATORS[expression.op];
  if (expression.args.length < min || expression.args.length > max) return [`${path}: ${expression.op} requires ${min === max ? min : `${min} to ${max}`} arguments`];
  return expression.args.flatMap((arg, i) => expressionIssues(arg, variableIds, `${path}.args[${i}]`, budget, depth + 1));
}

function calculate(expression, variables) {
  if (typeof expression === 'number') return expression;
  if (Object.hasOwn(expression, 'var')) return variables[expression.var];
  const args = expression.args.map((arg) => calculate(arg, variables));
  let result;
  switch (expression.op) {
    case 'add': result = args.reduce((a, b) => a + b, 0); break;
    case 'subtract': result = args[0] - args[1]; break;
    case 'multiply': result = args.reduce((a, b) => a * b, 1); break;
    case 'divide': {
      if (args[1] === 0) throw new ValidationError(['expression: division by zero']);
      result = args[0] / args[1]; break;
    }
    case 'min': result = Math.min(...args); break;
    case 'max': result = Math.max(...args); break;
    default: throw new ValidationError(['expression: unsupported operator']);
  }
  if (!Number.isFinite(result)) throw new ValidationError(['expression: arithmetic result must be finite']);
  return result;
}

/** Evaluate an inert bounded arithmetic tree. No eval, code generation, or access to host globals. */
export function evaluateExpression(expression, variables) {
  const issues = [...jsonIssues(expression, 'expression', 0, new Set(), 16), ...jsonIssues(variables, 'variables')];
  if (issues.length) throw new ValidationError(issues);
  if (!isRecord(variables) || Object.keys(variables).length > 8 || Object.entries(variables).some(([key, value]) => !isVariableId(key) || !finiteNumber(value))) throw new ValidationError(['variables: at most 8 valid input identifiers and finite numeric values required']);
  issues.push(...expressionIssues(expression, new Set(Object.keys(variables))));
  if (issues.length) throw new ValidationError(issues);
  return calculate(expression, variables);
}

export function calculatorIssues(block, path) {
  const issues = [], inputIds = new Set(), outputIds = new Set(), variables = {};
  if (!isText(block.label, 200)) issues.push(`${path}.label: bounded text required`);
  if (!Array.isArray(block.inputs) || block.inputs.length < 1 || block.inputs.length > 8) issues.push(`${path}.inputs: 1 to 8 controls required`);
  else block.inputs.forEach((input, i) => {
    const location = `${path}.inputs[${i}]`;
    if (!isRecord(input) || Object.keys(input).some((key) => !['id', 'label', 'value', 'min', 'max', 'step', 'unit'].includes(key))) { issues.push(`${location}: only typed control fields are allowed`); return; }
    if (!isVariableId(input.id) || inputIds.has(input.id)) issues.push(`${location}.id: distinct input identifier required`);
    if (!isText(input.label, 200) || !isText(input.unit, 80)) issues.push(`${location}: label and unit required`);
    if (![input.value, input.min, input.max].every(finiteNumber) || input.min > input.max || input.value < input.min || input.value > input.max) issues.push(`${location}: finite value within valid bounds required`);
    if (input.step !== undefined && (!finiteNumber(input.step) || input.step <= 0)) issues.push(`${location}.step: finite positive step required`);
    if (isVariableId(input.id)) { inputIds.add(input.id); variables[input.id] = input.value; }
  });
  const budget = { nodes: 0 };
  if (!Array.isArray(block.outputs) || block.outputs.length < 1 || block.outputs.length > 8) issues.push(`${path}.outputs: 1 to 8 results required`);
  else block.outputs.forEach((output, i) => {
    const location = `${path}.outputs[${i}]`;
    if (!isRecord(output) || !keysAre(output, ['id', 'label', 'unit', 'expression'])) { issues.push(`${location}: id, label, unit, and expression only required`); return; }
    if (!isVariableId(output.id) || outputIds.has(output.id) || inputIds.has(output.id)) issues.push(`${location}.id: distinct output identifier required`);
    outputIds.add(output.id);
    if (!isText(output.label, 200) || !isText(output.unit, 80)) issues.push(`${location}: label and unit required`);
    issues.push(...expressionIssues(output.expression, inputIds, `${location}.expression`, budget));
    if (!issues.length) {
      try { calculate(output.expression, variables); }
      catch (error) { issues.push(`${location}: ${error.message}`); }
    }
  });
  return issues;
}
