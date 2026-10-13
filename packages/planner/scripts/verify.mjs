import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const packageDir = fileURLToPath(new URL('../', import.meta.url)), projectDir = path.resolve(packageDir, '../..');
const testFile = path.join(projectDir, 'tests/planner.test.mjs');
const args = ['--test', '--test-reporter=tap', testFile];
const run = spawnSync(process.execPath, args, { cwd: projectDir, encoding: 'utf8' });
const output = (run.stdout || '') + (run.stderr || '');
const count = (key) => Number(new RegExp(`^# ${key} (\\d+)`, 'm').exec(output)?.[1] || 0);
const files = ['src/index.mjs', 'src/index.d.ts', 'package.json', 'README.md', 'LICENSE', 'scripts/verify.mjs'].map((file) => path.join(packageDir, file));
files.push(testFile);
const sourceFiles = await Promise.all(files.map(async (file) => ({ path: path.relative(projectDir, file),
  sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
const receipt = { version: 1, status: run.status === 0 && count('tests') > 0 ? 'passed' : 'failed', at: new Date().toISOString(),
  nodeVersion: process.version, exitCode: run.status, command: [process.execPath, ...args],
  counts: { tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped') },
  sourceFiles, liveModelCalls: 0, paidProviderCalls: 0,
  limitations: ['Injected mock chat-completion transports only; no local or remote model canary.',
    'No empirical model quality, life outcome, latency, or total-cost comparison.',
    'Model copy remains semantically untrusted and requires human review plus a fresh host policy check.',
    'Type declarations require parent clean-package compiler verification.'] };
await writeFile(path.join(packageDir, 'verification.tap'), output);
await writeFile(path.join(packageDir, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, counts: receipt.counts, receipt: path.join(packageDir, 'verification.json') }, null, 2));
process.exitCode = receipt.status === 'passed' ? 0 : 1;
