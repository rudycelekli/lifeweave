import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const coreDir = fileURLToPath(new URL('../', import.meta.url));
const projectDir = path.resolve(coreDir, '../..');
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]));
  return groups.flat();
}
const testFiles = (await readdir(path.join(projectDir, 'tests')))
  .filter((name) => /^core.*\.test\.mjs$/.test(name)).sort().map((name) => path.join(projectDir, 'tests', name));
const args = ['--test', '--test-reporter=tap', ...testFiles];
const run = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: projectDir });
const output = (run.stdout || '') + (run.stderr || '');
const count = (key) => Number(new RegExp(`^# ${key} (\\d+)`, 'm').exec(output)?.[1] || 0);
const paths = [...await filesIn(path.join(coreDir, 'src')), path.join(coreDir, 'package.json'), ...testFiles, path.join(projectDir, 'examples/demo.json')].sort();
const sourceFiles = await Promise.all(paths.map(async (file) => ({
  path: path.relative(projectDir, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex')
})));
const receipt = { version: 1, status: run.status === 0 && count('tests') > 0 ? 'passed' : 'failed',
  at: new Date().toISOString(), nodeVersion: process.version, command: [process.execPath, ...args],
  exitCode: run.status, counts: { tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped') },
  sourceFiles, limitations: ['Synthetic replay and independent policy interventions only.',
    'No live account is connected by core and no external actions are executed.',
    'Goal attainment, human effort, and total session cost are unmeasured.',
    'Type declarations are authored but a TypeScript compiler was unavailable in this runtime.'] };
await writeFile(path.join(coreDir, 'verification.tap'), output);
await writeFile(path.join(coreDir, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, counts: receipt.counts, receipt: path.join(coreDir, 'verification.json') }, null, 2));
process.exitCode = receipt.status === 'passed' ? 0 : 1;
